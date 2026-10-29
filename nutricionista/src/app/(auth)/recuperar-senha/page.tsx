import Link from 'next/link'
import type { Metadata } from 'next'
import { requestPasswordReset } from '@/actions/auth'
import { integrationStatus } from '@/lib/integrations'
import { ActionForm, Field, SubmitButton } from '@/components/form'

export const metadata: Metadata = { title: 'Recuperar senha', robots: { index: false } }

export default function ForgotPage() {
  const email = integrationStatus().email
  return (
    <div className="card stack">
      <h1 style={{ fontSize: '1.6rem' }}>Recuperar senha</h1>
      <p className="muted" style={{ margin: 0 }}>
        Informe o e-mail cadastrado. Enviaremos um link para criar uma nova senha.
      </p>
      {!email && (
        <p className="alert alert--warn small">
          O envio de e-mails ainda não foi configurado neste ambiente. Em demonstração, o link aparece apenas no registro
          (log) do servidor. Clientes podem pedir ao coach um novo link de acesso.
        </p>
      )}
      <ActionForm action={requestPasswordReset} className="stack">
        <Field label="E-mail" name="email">
          <input name="email" type="email" autoComplete="email" />
        </Field>
        <SubmitButton className="btn btn--primary btn--block" pendingText="Enviando…">
          Enviar link
        </SubmitButton>
      </ActionForm>
      <Link href="/login" className="small">
        Voltar para o login
      </Link>
    </div>
  )
}
