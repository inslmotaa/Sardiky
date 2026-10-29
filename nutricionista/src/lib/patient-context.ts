import 'server-only'
import { cache } from 'react'
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { DEFAULT_FEATURES, type AppFeatures } from '@/db/schema'

/** Cadastro do paciente logado, com os recursos do app liberados (memorizado por requisição). */
export const getPatient = cache(async (patientId: string) => {
  const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, patientId))
  if (!p) throw new Error('Cliente não encontrado')
  return { ...p, features: { ...DEFAULT_FEATURES, ...p.features } as AppFeatures }
})

export async function featuresOf(patientId: string) {
  return (await getPatient(patientId)).features
}

export async function currentPublishedPlan(patientId: string) {
  const [plan] = await db
    .select()
    .from(schema.mealPlans)
    .where(and(eq(schema.mealPlans.patientId, patientId), eq(schema.mealPlans.status, 'publicado')))
    .orderBy(desc(schema.mealPlans.publishedAt))
    .limit(1)
  return plan ?? null
}
