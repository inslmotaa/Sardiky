import 'server-only'
import { asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { Nutrients } from './nutricao'

export type FoodOption = {
  id: string
  name: string
  group: string
  source: string
  per100: Nutrients
  cookingFactor: number | null
  measures: { name: string; grams: number }[]
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
  }))
}
