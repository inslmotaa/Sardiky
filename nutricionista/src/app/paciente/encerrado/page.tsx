import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, count, desc, eq, inArray, lt } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { accessExpired } from '@/lib/auth/patient-gate'
import { getSettings } from '@/lib/settings'
import { getPatient } from '@/lib/patient-context'
import { measurementsOf, series } from '@/lib/patient-data'
import { fmtDay, zonedParts } from '@/lib/time'
import { LineChart } from '@/components/LineChart'
import { PageHead } from '@/components/ui'

export const metadata: Metadata = { title: 'Seu histórico' }

/**
 * Plano vencido: a área do cliente mostra só o histórico (peso, planos anteriores em PDF, consultas,
 * check-ins e registros do diário) e o botão de renovar. Nada se perde: ao renovar, tudo volta.
 */
export default async function ExpiredPage() {
  const user = await requirePatient()
  if (!(await accessExpired(user.patientId))) redirect('/paciente')
  const [s, p, rows] = await Promise.all([getSettings(), getPatient(user.patientId), measurementsOf(user.patientId)])
  const [pkg] = p.packageId ? await db.select().from(schema.packages).where(eq(schema.packages.id, p.packageId)) : []
  const [plans, appts, [diary], [checks]] = await Promise.all([
    db
      .select({ id: schema.mealPlans.id, title: schema.mealPlans.title, version: schema.mealPlans.version, publishedAt: schema.mealPlans.publishedAt })
      .from(schema.mealPlans)
      .where(and(eq(schema.mealPlans.patientId, user.patientId), inArray(schema.mealPlans.status, ['publicado', 'arquivado'])))
      .orderBy(desc(schema.mealPlans.publishedAt))
      .limit(10),
    db
      .select({ id: schema.appointments.id, startAt: schema.appointments.startAt, service: schema.appointments.serviceName })
      .from(schema.appointments)
      .where(and(eq(schema.appointments.patientId, user.patientId), lt(schema.appointments.startAt, new Date()), eq(schema.appointments.status, 'realizada')))
      .orderBy(desc(schema.appointments.startAt))
      .limit(10),
    db.select({ n: count() }).from(schema.diaryEntries).where(eq(schema.diaryEntries.patientId, user.patientId)),
    db.select({ n: count() }).from(schema.checkins).where(and(eq(schema.checkins.patientId, user.patientId), eq(schema.checkins.status, 'enviado'))),
  ])
  const weights = series(rows, 'weightKg')

  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <PageHead
        title="Seu histórico"
        subtitle={`${pkg ? `Seu Plano ${pkg.name}` : 'Seu plano'} terminou em ${fmtDay(p.packageEnd)}. O histórico fica guardado: ao renovar, você volta de onde parou.`}
        actions={
          <Link href={`/paciente/pagamento${pkg ? `?plano=${pkg.id}` : ''}`} className="btn btn--primary">
            Renovar meu plano
          </Link>
        }
      />
      <section className="card" aria-labelledby="hist-peso">
        <h2 id="hist-peso" style={{ fontSize: '1.1rem' }}>
          Peso
        </h2>
        {weights.length > 1 ? <LineChart title="Peso" points={weights} unit="kg" height={170} /> : <p className="muted">Sem registros suficientes para o gráfico.</p>}
      </section>
      <div className="grid-2">
        <section className="card" aria-labelledby="hist-planos">
          <h2 id="hist-planos" style={{ fontSize: '1.1rem' }}>
            Planos alimentares
          </h2>
          {plans.length === 0 ? (
            <p className="muted">Nenhum plano publicado.</p>
          ) : (
            <ul className="list" aria-label="Planos alimentares anteriores">
              {plans.map((pl) => (
                <li key={pl.id} className="row row--between">
                  <span>
                    {pl.title} <span className="muted small">· versão {pl.version}{pl.publishedAt ? ` · ${fmtDay(zonedParts(pl.publishedAt, s.timezone).date)}` : ''}</span>
                  </span>
                  <a className="btn btn--sm" href={`/paciente/plano/pdf?id=${pl.id}`} download>
                    PDF
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="hist-resumo">
          <h2 id="hist-resumo" style={{ fontSize: '1.1rem' }}>
            Resumo do acompanhamento
          </h2>
          <ul className="list">
            <li>{appts.length} consulta(s) realizada(s){appts[0] ? `, a última em ${fmtDay(zonedParts(appts[0].startAt, s.timezone).date)}` : ''}</li>
            <li>{diary?.n ?? 0} registro(s) no diário</li>
            <li>{checks?.n ?? 0} check-in(s) enviado(s)</li>
            <li>
              Recibos e cópia dos seus dados em <Link href="/paciente/meus-dados">Meus dados</Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
