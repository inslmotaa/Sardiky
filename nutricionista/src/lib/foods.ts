import 'server-only'
import { asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { Nutrients } from './nutricao'
import { PLAN_MICROS, type NutrientTable } from './tabela-nutricional'

export type FoodOption = {
  id: string
  name: string
  group: string
  source: string
  per100: Nutrients
  cookingFactor: number | null
  measures: { name: string; grams: number }[]
  /** Vitaminas e minerais por 100 g usados na análise do plano (TACO 4ª ed.). */
  micros: NutrientTable
}

/** Base de alimentos ativa com medidas caseiras (usada no editor e nas calculadoras). */
export async function loadFoods(): Promise<FoodOption[]> {
  const rows = await db.select().from(schema.foods).where(eq(schema.foods.active, true)).orderBy(asc(schema.foods.name))
  const ids = rows.map((r) => r.id)
  const measures = ids.length ? await db.select().from(schema.householdMeasures).where(inArray(schema.householdMeasures.foodId, ids)) : []
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    group: r.group,
    source: r.source,
    per100: { kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, fiber: r.fiber },
    cookingFactor: r.cookingFactor,
    measures: measures.filter((m) => m.foodId === r.id).map((m) => ({ name: m.name, grams: m.grams })),
    micros: Object.fromEntries(PLAN_MICROS.map((k) => [k, r.nutrients[k] ?? null])),
  }))
}

/** Vitaminas e minerais só dos alimentos usados no plano (para o quadro do cliente, quando ligado). */
export async function microsForPlan(content: unknown): Promise<Record<string, NutrientTable>> {
  const ids = [...new Set(JSON.stringify(content ?? {}).match(/"foodId":"([0-9a-f-]{36})"/g)?.map((m) => m.slice(10, 46)) ?? [])]
  if (!ids.length) return {}
  const rows = await db.select({ id: schema.foods.id, nutrients: schema.foods.nutrients }).from(schema.foods).where(inArray(schema.foods.id, ids))
  return Object.fromEntries(rows.map((r) => [r.id, Object.fromEntries(PLAN_MICROS.map((k) => [k, r.nutrients[k] ?? null]))]))
}
