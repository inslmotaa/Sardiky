'use client'

import { useRef } from 'react'
import type { ActionState } from '@/lib/action'
import { ActionForm, SubmitButton } from '@/components/form'

/** Mensagem rápida para um paciente, com respostas prontas e atalho para o WhatsApp. */
export function QuickMessage({
  name,
  action,
  replies,
  whatsapp,
}: {
  name: string
  action: (state: ActionState, fd: FormData) => Promise<ActionState>
  replies: string[]
  whatsapp: string | null
}) {
  const box = useRef<HTMLTextAreaElement>(null)
  const first = name.split(' ')[0]
  return (
    <details className="quick-msg">
      <summary className="btn btn--sm">Mensagem</summary>
      <div className="quick-msg__panel">
        <ActionForm action={action} className="stack" resetOnSuccess>
          {replies.length > 0 && (
            <div className="row" style={{ gap: 6 }}>
              {replies.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="chip"
                  onClick={() => {
                    if (box.current) box.current.value = r.replace(/\{nome\}/g, first)
                    box.current?.focus()
                  }}
                >
                  {r.length > 40 ? `${r.slice(0, 38)}…` : r}
                </button>
              ))}
            </div>
          )}
          <label className="field">
            <span className="field__label">Mensagem para {first}</span>
            <textarea ref={box} name="body" rows={3} maxLength={5000} defaultValue={`Oi, ${first}! Como está indo com o plano esta semana?`} />
          </label>
          <div className="row">
            <SubmitButton className="btn btn--primary btn--sm" pendingText="Enviando…">
              Enviar no app
            </SubmitButton>
            {whatsapp && (
              <a className="btn btn--sm" href={whatsapp} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            )}
          </div>
        </ActionForm>
      </div>
    </details>
  )
}
