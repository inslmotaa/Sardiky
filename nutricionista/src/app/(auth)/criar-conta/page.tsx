import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth/session'
import { googleConfigured } from '@/lib/auth/google'
import { money } from '@/lib/format'
import { monthsLabel } from '@/lib/planos'
import { SignUpForm } from '@/components/AuthWidgets'

export const metadata: Metadata = { title: 'Criar conta' }

type SP = Promise<Record<string, string | undefined>>

/** Cadastro do cliente. ?plano=<id> guarda o plano escolhido; ?next=/agendar segue para o agendamento depois da anamnese. */
export default async function CreateAccountPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const plano = sp.plano && /^[0-9a-f-]{36}$/.test(sp.plano) ? sp.plano : null
  const next = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : null
  const user = await getCurrentUser()
  if (user) redirect(user.role === 'patient' ? (plano ? `/agendar?plano=${plano}` : (next ?? '/paciente')) : '/admin')
  const [pkg] = plano ? await db.select().from(schema.packages).where(and(eq(schema.packages.id, plano), eq(schema.packages.active, true))) : []
  return (
    <div className="card stack">
      <div>
        <h1 style={{ fontSize: '1.6rem' }}>Criar conta</h1>
        <p className="muted" style={{ margin: 0 }}>
          Com a conta você preenche a anamnese, agenda a consulta e acompanha o seu plano pelo app.
        </p>
      </div>
      {pkg && (
        <p className="alert alert--ok" style={{ margin: 0 }}>
          Plano escolhido: <strong>{pkg.name}</strong> · {money(pkg.priceCents)} · {monthsLabel(pkg.months)}
        </p>
      )}
      {sp.google === 'sem-conta' && (
        <p className="alert alert--info" style={{ margin: 0 }}>
          Ainda não há conta com esse Google. Marque a caixa da Política de privacidade e use “Criar conta com Google”.
        </p>
      )}
      <SignUpForm plano={pkg?.id ?? null} next={next} google={googleConfigured()} />
      <div className="auth-links">
        <span>
          Já tem conta? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Entrar</Link>
        </span>
      </div>
    </div>
  )
}
