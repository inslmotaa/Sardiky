'use client'

import { useActionState, useState } from 'react'
import type { ActionState } from '@/lib/action'
import { waHref } from '@/lib/whatsapp'

type Pkg = { id: string; name: string; priceLabel: string }
type State = ActionState & { url?: string }

/** Painel: gera o link do Checkout Pro para um plano e oferece "Copiar link" e "Enviar pelo WhatsApp". */
export function PaymentLinkTool({
  action,
  packages,
  defaultPackageId,
  firstName,
  phone,
  message,
}: {
  action: (s: State, fd: FormData) => Promise<State>
  packages: Pkg[]
  defaultPackageId?: string | null
  firstName: string
  phone: string | null
  /** Texto do modelo "Link de pagamento" (Configurações → Mensagens), com {link} a preencher. */
  message?: string
}) {
  const [state, formAction, pending] = useActionState(action, {} as State)
  const [copied, setCopied] = useState(false)
  const text = (message ?? `Olá, ${firstName}! Segue o link para o pagamento do seu plano (Pix, cartão ou boleto): {link}`).replace('{link}', state.url ?? '')
  const wa = state.url ? waHref(phone, text) : null
  return (
    <div className="stack" style={{ ['--gap' as string]: '10px' }}>
      <form action={formAction} className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 220 }}>
          <label htmlFor="link-plano">Plano</label>
          <select id="link-plano" name="packageId" defaultValue={defaultPackageId ?? packages[0]?.id}>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.priceLabel}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Gerando…' : 'Gerar link de pagamento'}
        </button>
      </form>
      {state.error && <p className="alert alert--error">{state.error}</p>}
      {state.url && (
        <div className="alert alert--ok stack" style={{ ['--gap' as string]: '8px' }}>
          <span>{state.message}</span>
          <input readOnly value={state.url} aria-label="Link de pagamento" onFocus={(e) => e.currentTarget.select()} />
          <div className="row">
            <button
              type="button"
              className="btn btn--sm"
              onClick={async () => {
                await navigator.clipboard?.writeText(state.url!).catch(() => undefined)
                setCopied(true)
              }}
            >
              {copied ? 'Copiado!' : 'Copiar link'}
            </button>
            {wa && (
              <a className="btn btn--sm btn--whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
                Enviar pelo WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
