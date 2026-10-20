import Link from 'next/link'
import type { schema } from '@/db'
import { fmtDay } from '@/lib/time'
import { PatientPlan } from './nutri/PatientPlan'
import { normalizePlan } from '@/lib/plan'
import type { AppFeatures } from '@/db/schema'
import { PrintButton } from './form'
import { PageHead } from './ui'

export function PlanPage({
  plan,
  history,
  features,
  weekday,
}: {
  plan: typeof schema.mealPlans.$inferSelect
  history: (typeof schema.mealPlans.$inferSelect)[]
  features: AppFeatures
  weekday: number
}) {
  const isCurrent = plan.status === 'publicado'
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead
        title={plan.title}
        subtitle={
          <>
            Versão {plan.version} · publicada em {plan.publishedAt ? fmtDay(plan.publishedAt.toISOString().slice(0, 10)) : '—'}
            {plan.validFrom && ` · válida de ${fmtDay(plan.validFrom)}`}
            {plan.validUntil && ` até ${fmtDay(plan.validUntil)}`}
          </>
        }
        actions={
          <>
            <a className="btn btn--primary" href={isCurrent ? '/paciente/plano/pdf' : `/paciente/plano/pdf?id=${plan.id}`} download>
              Baixar PDF
            </a>
            <PrintButton label="Imprimir" />
          </>
        }
      />
      {!isCurrent && (
        <p className="alert alert--warn">
          Esta é uma versão anterior, mantida apenas para consulta. <Link href="/paciente/plano">Ver o plano atual</Link>.
        </p>
      )}
      <p className="muted small no-print" style={{ margin: 0 }}>
        Plano elaborado e revisado pelo nutricionista. Em caso de dúvida, use as mensagens — não altere quantidades por conta própria.
      </p>
      <PatientPlan content={normalizePlan(plan.content)} features={features} weekday={weekday} />
      {history.length > 0 && (
        <section className="card no-print">
          <h2 style={{ fontSize: '1.1rem' }}>Versões anteriores</h2>
          <ul className="list">
            {history.map((h) => (
              <li key={h.id} className="row row--between">
                <span>
                  Versão {h.version} · {h.publishedAt ? fmtDay(h.publishedAt.toISOString().slice(0, 10)) : '—'}
                  {h.validUntil && <span className="muted small"> · até {fmtDay(h.validUntil)}</span>}
                </span>
                <Link href={`/paciente/plano/${h.id}`} className="btn btn--sm">
                  Ver
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
