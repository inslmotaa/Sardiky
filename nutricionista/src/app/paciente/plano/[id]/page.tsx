import { notFound } from 'next/navigation'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { uuid } from '@/lib/validation'
import { PlanPage } from '@/components/PatientPlanPage'

export default async function PatientPlanVersion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePatient()
  if (!uuid.safeParse(id).success) notFound()
  const plans = await db
    .select()
    .from(schema.mealPlans)
    .where(and(eq(schema.mealPlans.patientId, user.patientId), inArray(schema.mealPlans.status, ['publicado', 'arquivado'])))
    .orderBy(desc(schema.mealPlans.publishedAt))
  const plan = plans.find((p) => p.id === id && (p.status === 'publicado' || p.visibleInHistory))
  if (!plan) notFound()
  return <PlanPage plan={plan} history={plans.filter((p) => p.status === 'arquivado' && p.visibleInHistory && p.id !== plan.id)} />
}
