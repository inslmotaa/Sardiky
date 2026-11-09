import Link from 'next/link'
import type { Metadata } from 'next'
import { noIndex } from '@/lib/seo'
import { redirect } from 'next/navigation'
import { login, logout, requestMagicLink } from '@/actions/auth'
import { getCurrentUser } from '@/lib/auth/session'
import { destinationFor, emailVerificationRequired } from '@/lib/auth/accounts'
import { googleConfigured } from '@/lib/auth/google'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { GoogleLink, PasswordInput } from '@/components/AuthWidgets'
import { ClearCacheOnMount } from '@/components/pwa'
import { AuthTabs } from '@/components/AuthTabs'

export const metadata: Metadata = { title: 'Entrar', robots: noIndex }

const ERRORS: Record<string, string> = {
  google: 'Não foi possível entrar com o Google. Tente novamente ou use e-mail e senha.',
  inativo: 'Esta conta está desativada. Fale com o seu coach.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const user = await getCurrentUser()
  // Conectado, mas tentou abrir uma área de outro perfil: mostra o aviso em vez de redirecionar em círculo.
  if (user && sp['sem-acesso']) {
    return (
      <div className="card stack">
        <h1 style={{ fontSize: '1.6rem' }}>Sem acesso a esta área</h1>
        <p className="muted" style={{ margin: 0 }}>
          {sp['sem-acesso'] === 'painel'
            ? 'O painel é exclusivo do coach e da equipe.'
            : 'A área do cliente é exclusiva dos clientes.'}{' '}
          Você está conectado como <strong>{user.name}</strong>.
        </p>
        <Link href={user.role === 'patient' ? '/paciente' : '/admin'} className="btn btn--primary btn--block">
          Ir para a minha área
        </Link>
        <form action={logout}>
          <button type="submit" className="btn btn--block">
            Sair e entrar com outra conta
          </button>
        </form>
      </div>
    )
  }
  if (user) redirect(await destinationFor(user, sp.next))
  const google = googleConfigured()
  return (
    <div className="card stack">
      <ClearCacheOnMount />
      <AuthTabs current="entrar" next={sp.next} />
      <div>
        <h1 style={{ fontSize: '1.6rem' }}>Entrar</h1>
        <p className="muted" style={{ margin: 0 }}>
          Um só acesso para clientes e para o coach: depois de entrar, você vai direto para a sua área.
        </p>
      </div>
      {sp.senha && <p className="alert alert--ok">Senha definida. Entre com a nova senha.</p>}
      {sp.saiu && <p className="alert alert--info">Você saiu da sua conta.</p>}
      {sp.next && !sp.saiu && <p className="alert alert--info">Entre para continuar.</p>}
      {sp.erro && ERRORS[sp.erro] && <p className="alert alert--error">{ERRORS[sp.erro]}</p>}
      <ActionForm action={login} className="stack">
        <input type="hidden" name="next" value={sp.next ?? ''} />
        <Field label="E-mail" name="email">
          <input name="email" type="email" autoComplete="username" required />
        </Field>
        <Field label="Senha" name="password">
          <PasswordInput name="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="btn btn--primary btn--block" pendingText="Entrando…">
          Entrar
        </SubmitButton>
      </ActionForm>
      {google && (
        <>
          <div className="auth-sep">
            <span>ou</span>
          </div>
          <GoogleLink href={`/api/auth/google${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ''}`} label="Entrar com Google" />
        </>
      )}
      <details className="disclosure magic-link">
        <summary>Sem senha? Receba um link de acesso por e-mail</summary>
        <ActionForm action={requestMagicLink} className="stack" resetOnSuccess>
          <input type="hidden" name="next" value={sp.next ?? ''} />
          <Field label="Endereço para receber o link" name="email" hint="O link vale por 15 minutos e só funciona uma vez.">
            <input name="email" type="email" autoComplete="email" required />
          </Field>
          <SubmitButton className="btn btn--block" pendingText="Enviando…">
            Enviar link de acesso
          </SubmitButton>
        </ActionForm>
      </details>
      <div className="auth-links">
        <Link href="/recuperar-senha">Esqueci minha senha</Link>
        {emailVerificationRequired() && <Link href="/criar-conta/confirme">Reenviar confirmação de e-mail</Link>}
      </div>
    </div>
  )
}
