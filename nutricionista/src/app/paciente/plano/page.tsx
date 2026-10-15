import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { PlanPage } from '@/components/PatientPlanPage'
import { PageHead, Empty } from '@/components/ui'

export default async function PatientPlanPage() {
  const user = await requirePatient()
  // Rascunhos nunca chegam ao paciente: só versões publicadas (e anteriores liberadas).
  const plans = await db
    .select()
    .from(schema.mealPlans)
    .where(and(eq(schema.mealPlans.patientId, user.patientId), inArray(schema.mealPlans.status, ['publicado', 'arquivado'])))
    .orderBy(desc(schema.mealPlans.publishedAt))
  const current = plans.find((p) => p.status === 'publicado')
  const history = plans.filter((p) => p.status === 'arquivado' && p.visibleInHistory)

  if (!current) {
    return (
      <>
        <PageHead title="Plano alimentar" />
        <Empty>Seu plano ainda não foi publicado. Assim que o nutricionista concluir a revisão, ele aparecerá aqui.</Empty>
      </>
    )
  }
  return <PlanPage plan={current} history={history} />
}
