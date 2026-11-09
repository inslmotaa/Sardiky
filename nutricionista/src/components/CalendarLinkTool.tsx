'use client'

import { useActionState, useState } from 'react'
import type { CalendarLinkState } from '@/actions/lembretes'

/** Gera o link secreto de assinatura do calendário e mostra uma única vez, com "Copiar". */
export function CalendarLinkTool({ action, hasLink }: { action: (s: CalendarLinkState) => Promise<CalendarLinkState>; hasLink: boolean }) {
  const [state, formAction, pending] = useActionState(action, {} as CalendarLinkState)
  const [copied, setCopied] = useState(false)
  return (
    <div className="stack" style={{ ['--gap' as string]: '8px' }}>
      <form action={formAction}>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Gerando…' : hasLink ? 'Gerar um novo link (o atual para de funcionar)' : 'Criar link de assinatura'}
        </button>
      </form>
      {state.error && (
        <p className="alert alert--error small" role="alert" style={{ margin: 0 }}>
          {state.error}
        </p>
      )}
      {state.webcal && (
        <div className="alert alert--ok small stack" role="status" style={{ ['--gap' as string]: '6px', margin: 0 }}>
          <span>{state.message}</span>
          <a href={state.webcal} className="btn btn--primary btn--sm" style={{ justifySelf: 'start' }}>
            Assinar no calendário do celular
          </a>
          <label className="field">
            <span className="field__label">Link para o Google Agenda (Adicionar calendário → Por URL)</span>
            <input readOnly value={state.https} onFocus={(e) => e.currentTarget.select()} aria-label="Link de assinatura do calendário" />
          </label>
          <button
            type="button"
            className="btn btn--sm"
            style={{ justifySelf: 'start' }}
            onClick={async () => {
              await navigator.clipboard?.writeText(state.https ?? '').catch(() => {})
              setCopied(true)
            }}
          >
            {copied ? 'Copiado' : 'Copiar link'}
          </button>
        </div>
      )}
    </div>
  )
}
