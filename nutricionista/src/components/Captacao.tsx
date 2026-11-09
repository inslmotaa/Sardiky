'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createLead } from '@/actions/public'
import { ActionForm, Field, FieldError, SubmitButton } from '@/components/form'
import { cleanPath, cleanReferrer, utmFromSearch, UTM_KEYS } from '@/lib/utm'

/** Origem da visita guardada só nesta aba (sessionStorage), para acompanhar o formulário. */
const KEY = 'farion-origem'
type Stored = Record<string, string>

function readOrigin(): Stored {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '{}') as Stored
  } catch {
    return {}
  }
}

/**
 * Registra de onde veio a visita: os utm_* do link (a cada novo link com UTM), a página de
 * entrada e o domínio de quem indicou (só na primeira página da visita).
 */
export function UtmCapture() {
  const pathname = usePathname()
  useEffect(() => {
    try {
      const current = readOrigin()
      const utm = utmFromSearch(window.location.search)
      const hasUtm = Object.keys(utm).length > 0
      if (Object.keys(current).length && !hasUtm) return
      const next: Stored = hasUtm ? { ...utm } : {}
      next.landing_path = cleanPath(window.location.pathname) ?? '/'
      const ref = cleanReferrer(document.referrer, window.location.hostname)
      if (ref) next.referrer = ref
      else if (current.referrer) next.referrer = current.referrer
      sessionStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* sem sessionStorage: segue sem origem */
    }
  }, [pathname])
  return null
}

/** Campos ocultos com a origem (revalidados no servidor). */
function OriginFields() {
  const [o, setO] = useState<Stored>({})
  useEffect(() => setO(readOrigin()), [])
  return (
    <>
      {[...UTM_KEYS, 'landing_path', 'referrer'].map((k) => (o[k] ? <input key={k} type="hidden" name={k} value={o[k]} /> : null))}
    </>
  )
}

const INTERESTS = ['Emagrecimento', 'Performance esportiva', 'Reeducação alimentar', 'Ainda não sei']

/** Formulário curto "quero saber mais": nome, WhatsApp, interesse e consentimento. */
export function SaberMaisForm({ id = 'saber-mais' }: { id?: string }) {
  return (
    <ActionForm action={createLead} className="saber-mais" resetOnSuccess id={id}>
      <input type="hidden" name="form" value="saber-mais" />
      <OriginFields />
      {/* Campo-isca para robôs: fica escondido de pessoas. */}
      <div className="hp" aria-hidden>
        <label>
          Site <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="saber-mais__grid">
        <Field label="Seu nome" name="name" required>
          <input name="name" autoComplete="name" maxLength={120} required />
        </Field>
        <Field label="WhatsApp com DDD" name="phone" required>
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="(11) 90000-0000" required />
        </Field>
        <Field label="Objetivo" name="interest">
          <select name="interest" defaultValue="">
            <option value="">Escolha (opcional)</option>
            {INTERESTS.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </Field>
      </div>
      <label className="saber-mais__consent">
        <input type="checkbox" name="consent" required />
        <span>
          Concordo em ser contatado e com a{' '}
          <Link href="/privacidade" target="_blank">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>
      <FieldError name="consent" />
      <SubmitButton className="pill pill--solid" pendingText="Enviando…">
        Quero saber mais <span aria-hidden>→</span>
      </SubmitButton>
    </ActionForm>
  )
}
