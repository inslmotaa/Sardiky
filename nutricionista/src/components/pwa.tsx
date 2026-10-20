'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

/** Apaga as telas do paciente guardadas neste aparelho (ao sair ou entrar com outra conta). */
export async function clearPatientCache() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'logout' })
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith('paciente-paginas')).map((k) => caches.delete(k)))
    }
  } catch {
    // Sem suporte ou modo privado: nada guardado.
  }
}

/**
 * Registra o service worker (app instalável e plano sem internet) e avisa quando o aparelho está off-line.
 */
export function PwaClient({ offlineText }: { offlineText: string }) {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
    }
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  if (!offline) return null
  return (
    <div className="offline-banner" role="status">
      {offlineText}
    </div>
  )
}

/** Apaga o que estava guardado no aparelho antes de sair da conta. */
export function LogoutForm({ action, children }: { action: () => Promise<void>; children: ReactNode }) {
  return (
    <form
      action={async () => {
        await clearPatientCache()
        await action()
      }}
      className="no-print"
    >
      {children}
    </form>
  )
}

/** Na tela de login: nenhuma tela de outra conta fica guardada no aparelho. */
export function ClearCacheOnMount() {
  useEffect(() => {
    void clearPatientCache()
  }, [])
  return null
}

/**
 * Atualização ao vivo: consulta /api/live a cada poucos segundos (só com a aba visível) e
 * recarrega os dados da tela quando algo muda — plano ativado, mensagem nova, aviso novo.
 */
export function LiveUpdates({ scope, intervalMs = 4000, planToast }: { scope: string; intervalMs?: number; planToast?: string }) {
  const router = useRouter()
  const last = useRef<{ sig: string; plan: string | null } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      if (!stop && document.visibilityState === 'visible' && navigator.onLine) {
        try {
          const res = await fetch(`/api/live?${scope}`, { cache: 'no-store', headers: { accept: 'application/json' } })
          if (res.ok) {
            const data = (await res.json()) as { sig: string; plan?: string | null }
            const prev = last.current
            last.current = { sig: data.sig, plan: data.plan ?? null }
            if (prev && prev.sig !== data.sig) {
              if (planToast && data.plan && prev.plan !== data.plan) setToast(planToast)
              router.refresh()
            }
          }
        } catch {
          // Sem conexão: tenta de novo no próximo ciclo.
        }
      }
      if (!stop) timer = setTimeout(tick, intervalMs)
    }
    void tick()
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer)
        void tick()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stop = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [scope, intervalMs, planToast, router])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])
  return toast ? (
    <div className="toast" role="status">
      {toast}
    </div>
  ) : null
}

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

type PushState = 'loading' | 'unsupported' | 'denied' | 'off' | 'on' | 'ios-install'

/**
 * Liga/desliga as notificações push neste aparelho.
 * No iPhone, o push só funciona com o app instalado na tela inicial (iOS 16.4+).
 */
export function PushToggle({
  publicKey,
  subscribe,
  unsubscribe,
  compact = false,
}: {
  publicKey: string | null
  subscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) => Promise<{ ok?: boolean; error?: string }>
  unsubscribe: (endpoint: string) => Promise<void>
  compact?: boolean
}) {
  const [state, setState] = useState<PushState>('loading')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const run = async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
      if (!publicKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState(ios && !standalone ? 'ios-install' : 'unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setState('denied')
        return
      }
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      setState(sub ? 'on' : 'off')
    }
    run().catch(() => setState('unsupported'))
  }, [publicKey])

  const enable = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'off')
        return
      }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey!) })
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const r = await subscribe({ endpoint: json.endpoint, keys: json.keys })
      if (r.error) {
        setMsg(r.error)
        await sub.unsubscribe()
        return
      }
      setState('on')
      setMsg('Notificações ativadas neste aparelho.')
    } catch {
      setMsg('Não foi possível ativar as notificações neste navegador.')
    } finally {
      setBusy(false)
    }
  }
  const disable = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await unsubscribe(sub.endpoint)
        await sub.unsubscribe()
      }
      setState('off')
      setMsg('Notificações desativadas neste aparelho.')
    } finally {
      setBusy(false)
    }
  }

  const text: Record<PushState, string> = {
    loading: 'Verificando…',
    unsupported: 'Este navegador não recebe notificações push.',
    denied: 'As notificações foram bloqueadas. Libere nas configurações do navegador para este site.',
    off: 'Notificações desligadas neste aparelho.',
    on: 'Notificações ligadas neste aparelho.',
    'ios-install': 'No iPhone, instale o app (Compartilhar → Adicionar à Tela de Início) e abra por ele para receber notificações.',
  }
  return (
    <div className={compact ? 'row' : 'stack'} style={{ ['--gap' as string]: '8px', alignItems: compact ? 'center' : undefined }}>
      <span className="small">{text[state]}</span>
      {state === 'off' && (
        <button type="button" className="btn btn--primary btn--sm" onClick={enable} disabled={busy}>
          Ativar notificações
        </button>
      )}
      {state === 'on' && (
        <button type="button" className="btn btn--sm" onClick={disable} disabled={busy}>
          Desativar neste aparelho
        </button>
      )}
      {msg && (
        <span className="small muted" role="status">
          {msg}
        </span>
      )}
    </div>
  )
}
