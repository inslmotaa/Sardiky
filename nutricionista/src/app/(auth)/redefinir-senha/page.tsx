import Link from 'next/link'
import type { Metadata } from 'next'
import { resetPassword } from '@/actions/auth'
import { findValidToken } from '@/lib/auth/reset'
import { ActionForm, Field, SubmitButton } from '@/components/form'

export const metadata: Metadata = { title: 'Definir senha', robots: { index: false }, referrer: 'no-referrer' }

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams
  const row = await findValidToken(token)
  if (!row) {
    return (
      <div className="card stack">
        <h1 style={{ fontSize: '1.6rem' }}>Link inválido ou expirado</h1>
        <p className="muted">Por segurança, os links valem por tempo limitado e só podem ser usados uma vez.</p>
        <Link href="/recuperar-senha" className="btn btn--primary">
          Solicitar novo link
        </Link>
      </div>
    )
  }
  const invite = row.token.type === 'convite'
  return (
    <div className="card stack">
      <h1 style={{ fontSize: '1.6rem' }}>{invite ? 'Crie sua senha de acesso' : 'Nova senha'}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {invite ? `Olá, ${row.user.name.split(' ')[0]}! ` : ''}Use pelo menos 8 caracteres, com letras e números.
      </p>
      <ActionForm action={resetPassword} className="stack">
        <input type="hidden" name="token" value={token} />
        <input type="email" name="username" value={row.user.email} autoComplete="username" readOnly hidden />
        <Field label="Nova senha" name="password">
          <input name="password" type="password" autoComplete="new-password" minLength={8} />
        </Field>
        <Field label="Repita a senha" name="confirm">
          <input name="confirm" type="password" autoComplete="new-password" />
        </Field>
        {invite && (
          <p className="small muted" style={{ margin: 0 }}>
            Ao criar a senha, você concorda com o tratamento dos seus dados pessoais e de saúde para o seu acompanhamento
            nutricional, conforme a <Link href="/privacidade">Política de Privacidade</Link>.
          </p>
        )}
        <SubmitButton className="btn btn--primary btn--block">{invite ? 'Criar senha e continuar' : 'Salvar nova senha'}</SubmitButton>
      </ActionForm>
    </div>
  )
}
