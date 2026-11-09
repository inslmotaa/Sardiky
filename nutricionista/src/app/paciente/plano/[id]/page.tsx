import { notFound } from 'next/navigation'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireActivePatient } from '@/lib/auth/patient-gate'
import { featuresOf } from '@/lib/patient-context'
import { getSettings } from '@/lib/settings'
import { todayIn, weekdayOf } from '@/lib/time'
import { uuid } from '@/lib/validation'
import { PlanPage } from '@/components/PatientPlanPage'
import { microsForPlan } from '@/lib/foods'

export default async function PatientPlanVersion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireActivePatient()
  const features = await featuresOf(user.patientId)
  const weekday = weekdayOf(todayIn((await getSettings()).timezone))
  if (!uuid.safeParse(id).success) notFound()
  const plans = await db
    .select()
    .from(schema.mealPlans)
    .where(and(eq(schema.mealPlans.patientId, user.patientId), inArray(schema.mealPlans.status, ['publicado', 'arquivado'])))
    .orderBy(desc(schema.mealPlans.publishedAt))
  const plan = plans.find((p) => p.id === id && (p.status === 'publicado' || p.visibleInHistory))
  if (!plan) notFound()
  const micros = features.micronutrientes ? await microsForPlan(plan.content) : undefined
  return <PlanPage micros={micros} features={features} weekday={weekday} plan={plan} history={plans.filter((p) => p.status === 'arquivado' && p.visibleInHistory && p.id !== plan.id)} />
}
