import Link from 'next/link'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { planSources } from '@/lib/plan-sources'
import { countItems, mealCount, normalizePlan } from '@/lib/plan'
import { fmtDateTime } from '@/lib/time'
import { NewPlanForm } from '@/components/NewPlanForm'
import { NoAccess, PageHead, StatusBadge, Empty } from '@/components/ui'

export default async function PlansPage() {
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  const s = await getSettings()
  const [plans, templates, patients, sources] = await Promise.all([
    db
      .select({ p: schema.mealPlans, name: schema.patients.fullName })
      .from(schema.mealPlans)
      .innerJoin(schema.patients, eq(schema.patients.id, schema.mealPlans.patientId))
      .where(eq(schema.mealPlans.isTemplate, false))
      .orderBy(desc(schema.mealPlans.updatedAt))
      .limit(100),
    db.select().from(schema.mealPlans).where(eq(schema.mealPlans.isTemplate, true)).orderBy(asc(schema.mealPlans.title)),
    db.select({ id: schema.patients.id, name: schema.patients.fullName }).from(schema.patients).where(and(isNull(schema.patients.anonymizedAt))).orderBy(asc(schema.patients.fullName)),
    planSources(),
  ])
  const drafts = plans.filter((x) => x.p.status === 'rascunho')
  return (
    <div className="stack" style={{ ['--gap' as string]: '24px' }}>
      <PageHead title="Planos alimentares" subtitle="Rascunhos, planos publicados e modelos reutilizáveis." />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="stack">
          <div className="card">
            <h2 style={{ fontSize: '1.1rem' }}>Rascunhos aguardando revisão ({drafts.length})</h2>
            {drafts.length === 0 ? (
              <p className="muted">Nenhum rascunho.</p>
            ) : (
              <ul className="list">
                {drafts.map(({ p, name }) => (
                  <li key={p.id}>
                    <Link href={`/admin/planos/${p.id}`}>
                      <strong>{name}</strong> · v{p.version} {p.title}
                    </Link>
                    <div className="small muted">Editado em {fmtDateTime(p.updatedAt, s.timezone)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h2 style={{ fontSize: '1.1rem' }}>Modelos</h2>
            {templates.length === 0 ? (
              <p className="muted">Nenhum modelo.</p>
            ) : (
              <ul className="list">
                {templates.map((t) => (
                  <li key={t.id} className="row row--between">
                    <Link href={`/admin/planos/${t.id}`}>{t.title}</Link>
                    <span className="small muted">
                      {mealCount(normalizePlan(t.content))} refeições · {countItems(normalizePlan(t.content))} itens
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Criar plano ou modelo</h2>
          <NewPlanForm patients={patients} sources={sources} />
        </section>
      </div>
      <section>
        <h2 style={{ fontSize: '1.1rem' }}>Atualizados recentemente</h2>
        {plans.length === 0 ? (
          <Empty>Nenhum plano.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Plano</th>
                  <th>Versão</th>
                  <th>Situação</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(({ p, name }) => (
                  <tr key={p.id}>
                    <td>{name}</td>
                    <td>
                      <Link href={`/admin/planos/${p.id}`}>{p.title}</Link>
                    </td>
                    <td>v{p.version}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="nowrap">{fmtDateTime(p.updatedAt, s.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
