'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CONSENT_COOKIE, CONSENT_MAX_AGE, isPublicSitePath, type PixelConfig } from '@/lib/pixels'

/**
 * Consentimento de cookies e pixels (Meta e Google). Só existe quando algum pixel está ligado
 * no painel; sem aceite, nada de terceiros é carregado. Os scripts rodam apenas nas páginas
 * públicas: um clique para o login, a área do cliente ou o painel recarrega a página inteira,
 * deixando os pixels para trás.
 */
type W = Window &
  typeof globalThis & {
    fbq?: ((...a: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown; disablePushState?: boolean }
    _fbq?: unknown
    dataLayer?: unknown[]
    gtag?: (...a: unknown[]) => void
  } & Record<string, unknown>

const OPEN_EVENT = 'farion:cookies'

function readConsent(): 'aceito' | 'recusado' | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`))
  return m?.[1] === 'aceito' || m?.[1] === 'recusado' ? m[1] : null
}

function writeConsent(v: 'aceito' | 'recusado') {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${v}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`
}

function addScript(src: string) {
  const el = document.createElement('script')
  el.async = true
  el.src = src
  document.head.appendChild(el)
}

function loadPixels(cfg: PixelConfig) {
  const w = window as W
  if (cfg.meta && !w.fbq) {
    const n = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod(...args)
      else n.queue!.push(args)
    } as NonNullable<W['fbq']>
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    // Sem rastrear mudanças de endereço automaticamente: só as páginas públicas, uma a uma.
    n.disablePushState = true
    w.fbq = n
    w._fbq = n
    addScript('https://connect.facebook.net/pt_BR/fbevents.js')
    w.fbq('init', cfg.meta)
  }
  if (cfg.google && !w.gtag) {
    w.dataLayer = w.dataLayer || []
    // gtag.js espera o objeto "arguments" na fila.
    w.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments)
    }
    w.gtag('js', new Date())
    w.gtag('config', cfg.google, { send_page_view: false })
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.google)}`)
  }
}

function trackPage(cfg: PixelConfig, path: string) {
  const w = window as W
  if (cfg.meta) w.fbq?.('track', 'PageView')
  if (cfg.google) w.gtag?.('event', 'page_view', { page_path: path, page_location: window.location.origin + path, page_title: document.title })
}

export function SitePixels({ config }: { config: PixelConfig }) {
  const pathname = usePathname()
  const [consent, setConsent] = useState<'aceito' | 'recusado' | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    const c = readConsent()
    setConsent(c)
    setOpen(c === null)
    const reopen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, reopen)
    return () => window.removeEventListener(OPEN_EVENT, reopen)
  }, [])

  // Com aceite: carrega uma vez e registra cada página pública visitada.
  useEffect(() => {
    if (consent !== 'aceito' || !isPublicSitePath(pathname)) return
    loadPixels(config)
    loaded.current = true
    trackPage(config, pathname)
  }, [consent, pathname, config])

  // Saindo do site público (login, área do cliente, painel): navegação completa, sem os pixels.
  useEffect(() => {
    if (consent !== 'aceito') return
    const onClick = (e: MouseEvent) => {
      if (!loaded.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || isPublicSitePath(url.pathname)) return
      e.preventDefault()
      e.stopPropagation()
      if (config.google) (window as W)[`ga-disable-${config.google}`] = true
      window.location.assign(url.href)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [consent, config])

  if (!open) return null
  const choose = (v: 'aceito' | 'recusado') => {
    const before = consent
    writeConsent(v)
    setConsent(v)
    setOpen(false)
    // A política de segurança da página libera os pixels só com o cookie de aceite: recarrega para valer.
    if (v === 'aceito' || before === 'aceito') window.location.reload()
  }
  const names = [config.meta && 'Meta (Facebook e Instagram)', config.google && 'Google'].filter(Boolean).join(' e ')
  return (
    <div className="cookie-banner" role="dialog" aria-labelledby="cookie-titulo" aria-describedby="cookie-texto">
      <p id="cookie-titulo" className="cookie-banner__title">
        Cookies de medição
      </p>
      <p id="cookie-texto" className="cookie-banner__text">
        Com a sua permissão, usamos cookies de {names} para medir de onde vêm as visitas e melhorar os anúncios. Sem permissão, nada disso é carregado.{' '}
        <Link href="/privacidade#cookies">Saiba mais</Link>.
      </p>
      <div className="cookie-banner__actions">
        <button type="button" className="pill pill--sm" onClick={() => choose('recusado')}>
          Recusar
        </button>
        <button type="button" className="pill pill--sm pill--solid" onClick={() => choose('aceito')}>
          Aceitar
        </button>
      </div>
    </div>
  )
}

/** Botão do rodapé para rever a escolha de cookies. */
export function CookiePrefsButton() {
  return (
    <button type="button" className="tl-footer__link-btn" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      / Preferências de cookies
    </button>
  )
}
