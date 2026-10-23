'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signUp } from '@/actions/auth'
import { ActionForm, Field, FieldError, SubmitButton } from '@/components/form'
import { maskPhone } from '@/lib/format'

export function PhoneInput({ name, defaultValue = '' }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(maskPhone(defaultValue))
  return (
    <input
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder="(00) 00000-0000"
      value={value}
      onChange={(e) => setValue(maskPhone(e.target.value))}
    />
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** Link para o "Entrar com Google" (navegação comum, não formulário: o Google fica fora do form-action do site). */
export function GoogleLink({ href, label, disabled, hint }: { href: string; label: string; disabled?: boolean; hint?: string }) {
  if (disabled)
    return (
      <span className="btn btn--block btn--google" aria-disabled="true" title={hint}>
        <GoogleMark /> {label}
      </span>
    )
  return (
    <a href={href} className="btn btn--block btn--google">
      <GoogleMark /> {label}
    </a>
  )
}

/** Formulário de cadastro do cliente (a caixa da Política de privacidade também libera o cadastro pelo Google). */
export function SignUpForm({ plano, next, google }: { plano: string | null; next: string | null; google: boolean }) {
  const [consent, setConsent] = useState(false)
  const q = new URLSearchParams({ consentimento: '1', ...(plano ? { plano } : {}), ...(next ? { next } : {}) })
  return (
    <div className="stack">
      <ActionForm action={signUp} className="stack">
        {plano && <input type="hidden" name="plano" value={plano} />}
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="Nome completo" name="name" required>
          <input name="name" type="text" autoComplete="name" maxLength={120} />
        </Field>
        <Field label="E-mail" name="email" required>
          <input name="email" type="email" autoComplete="email" />
        </Field>
        <Field label="WhatsApp" name="phone" required>
          <PhoneInput name="phone" />
        </Field>
        <div className="form-grid">
          <Field label="Senha" name="password" required hint="Mínimo de 8 caracteres, com letras e números.">
            <input name="password" type="password" autoComplete="new-password" minLength={8} />
          </Field>
          <Field label="Confirme a senha" name="confirm" required>
            <input name="confirm" type="password" autoComplete="new-password" />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Li e aceito a{' '}
            <Link href="/privacidade" target="_blank">
              Política de privacidade
            </Link>
            .
          </span>
        </label>
        <FieldError name="consent" />
        <SubmitButton className="btn btn--primary btn--block" pendingText="Criando conta…">
          Criar conta
        </SubmitButton>
      </ActionForm>
      {google && (
        <>
          <div className="auth-sep">
            <span>ou</span>
          </div>
          <GoogleLink href={`/api/auth/google?${q}`} label="Criar conta com Google" disabled={!consent} hint="Marque a caixa da Política de privacidade primeiro" />
          {!consent && <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>Para usar o Google, marque antes a caixa da Política de privacidade.</p>}
        </>
      )}
    </div>
  )
}
