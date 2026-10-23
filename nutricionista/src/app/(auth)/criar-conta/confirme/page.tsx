import Link from 'next/link'
import type { Metadata } from 'next'
import { resendVerification } from '@/actions/auth'
import { ActionForm, Field, SubmitButton } from '@/components/form'

export const metadata: Metadata = { title: 'Confirme seu e-mail', robots: { index: false } }

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  return (
    <div className="card stack">
      {sp.erro ? (
        <>
          <h1 style={{ fontSize: '1.6rem' }}>Link inválido ou expirado</h1>
          <p className="muted" style={{ margin: 0 }}>
            O link de confirmação vale por 48 horas e só pode ser usado uma vez. Peça um novo abaixo.
          </p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: '1.6rem' }}>Confirme seu e-mail</h1>
          <p style={{ margin: 0 }}>
            Enviamos um link de confirmação para <strong>{sp.email ?? 'o seu e-mail'}</strong>. Abra o e-mail e toque no link para ativar sua conta.
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            Depois de confirmar, você já começa pela anamnese, que ajuda o André a preparar o seu acompanhamento.
          </p>
        </>
      )}
      <ActionForm action={resendVerification} className="stack">
        <Field label="E-mail" name="email">
          <input name="email" type="email" autoComplete="email" defaultValue={sp.email ?? ''} />
        </Field>
        <SubmitButton className="btn btn--block" pendingText="Enviando…">
          Reenviar link de confirmação
        </SubmitButton>
      </ActionForm>
      <p className="small" style={{ margin: 0 }}>
        Já confirmou? <Link href="/login">Entrar</Link>
      </p>
    </div>
  )
}
