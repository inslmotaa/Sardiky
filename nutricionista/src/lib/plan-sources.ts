import 'server-only'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { fmtDay } from './time'

/** Modelos e planos publicados que podem servir de base para um novo plano. */
export async function planSources(patientId?: string) {
  const [templates, own] = await Promise.all([
    db.select().from(schema.mealPlans).where(eq(schema.mealPlans.isTemplate, true)).orderBy(asc(schema.mealPlans.title)),
    patientId
      ? db
          .select()
          .from(schema.mealPlans)
          .where(and(eq(schema.mealPlans.patientId, patientId), inArray(schema.mealPlans.status, ['publicado', 'arquivado'])))
          .orderBy(desc(schema.mealPlans.version))
      : Promise.resolve([]),
  ])
  return [
    ...own.map((p) => ({ id: p.id, label: `Versão ${p.version} deste cliente (${p.publishedAt ? fmtDay(p.publishedAt.toISOString().slice(0, 10)) : ''})` })),
    ...templates.map((t) => ({ id: t.id, label: `Modelo: ${t.title}` })),
  ]
}
