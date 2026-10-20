import 'server-only'
import { and, eq, or, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { currentPublishedPlan } from './patient-context'
import { normalizePlan } from './plan'
import { loadRecipes, recipeIdsInPlan } from './recipes'

/** Receitas que o paciente pode ver: biblioteca liberada + receitas do plano dele. */
export async function recipesForPatient(patientId: string) {
  const plan = await currentPublishedPlan(patientId)
  const inPlan = recipeIdsInPlan(plan ? normalizePlan(plan.content) : null)
  const all = await loadRecipes()
  return all.filter((r) => r.visibleToAll || inPlan.has(r.id)).map((r) => ({ ...r, inPlan: inPlan.has(r.id) }))
}

/** Materiais liberados para todos ou para este paciente. */
export async function materialsForPatient(patientId: string) {
  return db
    .select()
    .from(schema.materials)
    .where(and(eq(schema.materials.active, true), or(eq(schema.materials.audience, 'todos'), sql`${schema.materials.patientIds} @> ${JSON.stringify([patientId])}::jsonb`)))
}
