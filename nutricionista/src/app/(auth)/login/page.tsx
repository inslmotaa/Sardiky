import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { login } from '@/actions/auth'
import { getCurrentUser } from '@/lib/auth/session'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { ClearCacheOnMount } from '@/components/pwa'

export const metadata: Metadata = { title: 'Entrar', robots: { index: false } }

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const user = await getCurrentUser()
  if (user) redirect(user.role === 'patient' ? '/paciente' : '/admin')
  return (
    <div className="card stack">
      <ClearCacheOnMount />
      <div>
        <h1 style={{ fontSize: '1.6rem' }}>Entrar</h1>
        <p className="muted" style={{ margin: 0 }}>
          Área do paciente e painel do consultório.
        </p>
      </div>
      {sp.senha && <p className="alert alert--ok">Senha definida. Entre com a nova senha.</p>}
      {sp.saiu && <p className="alert alert--info">Você saiu da sua conta.</p>}
      <ActionForm action={login} className="stack">
        <input type="hidden" name="next" value={sp.next ?? ''} />
        <Field label="E-mail" name="email">
          <input name="email" type="email" autoComplete="username" required />
        </Field>
        <Field label="Senha" name="password">
          <input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="btn btn--primary btn--block" pendingText="Entrando…">
          Entrar
        </SubmitButton>
      </ActionForm>
      <p className="small" style={{ margin: 0 }}>
        <Link href="/recuperar-senha">Esqueci minha senha</Link>
      </p>
      <p className="muted small" style={{ margin: 0 }}>
        Ainda não tem acesso? O acesso à área do paciente é liberado pelo consultório após a primeira consulta.
      </p>
    </div>
  )
}
