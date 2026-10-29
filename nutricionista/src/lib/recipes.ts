import 'server-only'
import { asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { recipeNutrients, ZERO, type Nutrients } from './nutricao'
import type { FoodOption } from './foods'
import type { PlanContent } from './plan'

type Recipe = typeof schema.recipes.$inferSelect

/** Prefixo dos ids de receita dentro do plano (o item do plano aponta para “r:<id>”). */
export const RECIPE_PREFIX = 'r:'

/** Nutrientes da receita: total, por porção e por 100 g (peso final pronto). */
export function recipeInfo(r: Recipe) {
  const ings = r.ingredients.filter((i) => i.per100 && i.grams > 0) as { per100: Nutrients; grams: number }[]
  const rawWeight = r.ingredients.reduce((n, i) => n + i.grams, 0)
  const finalWeight = r.finalWeightG && r.finalWeightG > 0 ? r.finalWeightG : rawWeight
  const n = recipeNutrients(ings, finalWeight, r.portions)
  return { ...n, perPortion: n.perPortion ?? ZERO, per100: n.per100 ?? ZERO, finalWeight, portionGrams: r.portions > 0 ? finalWeight / r.portions : finalWeight }
}

export async function loadRecipes() {
  return db.select().from(schema.recipes).orderBy(asc(schema.recipes.title))
}

/** Receitas como “alimentos” do editor de planos (grupo Receitas, medida “porção”). */
export function recipesAsFoods(recipes: Recipe[]): FoodOption[] {
  return recipes
    .filter((r) => r.ingredients.length > 0)
    .map((r) => {
      const info = recipeInfo(r)
      return {
        id: `${RECIPE_PREFIX}${r.id}`,
        name: `Receita: ${r.title}`,
        group: 'receitas',
        source: 'receita',
        per100: info.per100,
        cookingFactor: null,
        measures: [{ name: 'porção', grams: Math.round(info.portionGrams) }],
        // Receitas não têm vitaminas e minerais calculados: entram como "sem dado" na análise do plano.
        micros: {},
      }
    })
}

/** Receitas que aparecem para o paciente: as liberadas para todos e as vinculadas ao plano dele. */
export function recipeIdsInPlan(plan: PlanContent | null) {
  const ids = new Set<string>()
  for (const d of plan?.days ?? []) for (const m of d.meals) for (const o of m.options) for (const it of o.items) if (it.foodId?.startsWith(RECIPE_PREFIX)) ids.add(it.foodId.slice(RECIPE_PREFIX.length))
  return ids
}

export async function recipesByIds(ids: string[]) {
  return ids.length ? db.select().from(schema.recipes).where(inArray(schema.recipes.id, ids)) : []
}

export async function recipeById(id: string) {
  const [r] = await db.select().from(schema.recipes).where(eq(schema.recipes.id, id))
  return r ?? null
}

/** Para a lista de compras: troca cada receita do plano pelos ingredientes, na proporção da porção. */
export function expandRecipes(plan: PlanContent, recipes: Recipe[]): PlanContent {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const copy = structuredClone(plan)
  for (const d of copy.days)
    for (const m of d.meals)
      for (const o of m.options) {
        o.items = o.items.flatMap((it) => {
          const r = it.foodId?.startsWith(RECIPE_PREFIX) ? byId.get(it.foodId.slice(RECIPE_PREFIX.length)) : undefined
          if (!r || !it.grams) return [it]
          const k = it.grams / recipeInfo(r).finalWeight
          return r.ingredients.map((ing, i) => ({
            ...it,
            id: `${it.id}-${i}`,
            foodId: ing.foodId,
            name: ing.name,
            group: '',
            grams: ing.grams * k,
            measure: null,
            per100: ing.per100,
          }))
        })
      }
  return copy
}
