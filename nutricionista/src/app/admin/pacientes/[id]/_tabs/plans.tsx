import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { planSources } from '@/lib/plan-sources'
import { getSettings } from '@/lib/settings'
import { fmtDateTime, fmtDay } from '@/lib/time'
import { NewPlanForm } from '@/components/NewPlanForm'
import { StatusBadge, Empty } from '@/components/ui'

export async function PlansTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const s = await getSettings()
  const [plans, sources] = await Promise.all([
    db.select().from(schema.mealPlans).where(eq(schema.mealPlans.patientId, patient.id)).orderBy(desc(schema.mealPlans.version), desc(schema.mealPlans.createdAt)),
    planSources(patient.id),
  ])
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <section>
        <h2 style={{ fontSize: '1.1rem' }}>Histórico de planos</h2>
        {plans.length === 0 ? (
          <Empty>Nenhum plano criado para este paciente.</Empty>
        ) : (
          <ul className="card list">
            {plans.map((p) => (
              <li key={p.id} className="row row--between">
                <div>
                  <Link href={`/admin/planos/${p.id}`}>
                    <strong>
                      v{p.version} · {p.title}
                    </strong>
                  </Link>
                  <div className="small muted">
                    {p.publishedAt ? `Publicado em ${fmtDateTime(p.publishedAt, s.timezone)}` : `Editado em ${fmtDateTime(p.updatedAt, s.timezone)}`}
                    {p.validUntil && ` · válido até ${fmtDay(p.validUntil)}`}
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Novo plano</h2>
        <NewPlanForm patientId={patient.id} sources={sources} />
        <p className="muted small" style={{ margin: '12px 0 0' }}>
          Todo plano começa como rascunho e só aparece para o paciente depois que você revisa e publica.
        </p>
      </section>
    </div>
  )
}
