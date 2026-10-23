import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { featuresOf } from '@/lib/patient-context'
import { getSettings } from '@/lib/settings'
import { todayIn, weekdayOf } from '@/lib/time'
import { PlanPage } from '@/components/PatientPlanPage'
import { PageHead, Empty } from '@/components/ui'

export default async function PatientPlanPage() {
  const user = await requirePatient()
  const features = await featuresOf(user.patientId)
  const weekday = weekdayOf(todayIn((await getSettings()).timezone))
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
        <Empty>Seu plano ainda não foi publicado. Assim que o coach concluir a revisão, ele aparecerá aqui.</Empty>
      </>
    )
  }
  const prescriptions = await db
    .select()
    .from(schema.prescriptions)
    .where(and(eq(schema.prescriptions.patientId, user.patientId), eq(schema.prescriptions.active, true)))
    .orderBy(desc(schema.prescriptions.createdAt))
  return <PlanPage plan={current} history={history} features={features} weekday={weekday} prescriptions={prescriptions} />
}
