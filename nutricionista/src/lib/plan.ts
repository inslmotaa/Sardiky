import { z } from 'zod'
import { formatMeasure, scale, sum, times, ZERO, type Nutrients } from './nutricao'

/**
 * Plano alimentar (versão 2).
 * plano → dias (ex.: "Todos os dias", "Dia de treino") → refeições → opções → alimentos.
 * Cada alimento guarda uma cópia dos nutrientes por 100 g no momento em que foi
 * adicionado: editar a base de alimentos não altera planos já publicados.
 */

const text = (max: number) => z.string().trim().max(max)
const num = z.number().finite().nonnegative()

export const nutrientsSchema = z.object({ kcal: num, protein: num, carbs: num, fat: num, fiber: num })

const measureSchema = z.object({ name: text(60), grams: num, qty: num }).nullable().default(null)

export const substitutionSchema = z.object({
  foodId: z.string().max(40).nullable().default(null),
  name: text(160).min(1, 'Informe a substituição'),
  per100: nutrientsSchema.nullable().default(null),
  grams: num.nullable().default(null),
  measure: measureSchema,
  text: text(80).default(''),
})

export const planItemSchema = z.object({
  id: z.string().max(40),
  foodId: z.string().max(40).nullable().default(null),
  name: text(160).min(1, 'Informe o alimento'),
  group: text(30).default(''),
  per100: nutrientsSchema.nullable().default(null),
  grams: num.nullable().default(null),
  measure: measureSchema,
  /** Quantidade em texto livre (modo livre ou itens sem cálculo). */
  text: text(80).default(''),
  notes: text(300).default(''),
  locked: z.boolean().default(false),
  subs: z.array(substitutionSchema).max(20).default([]),
})

export const mealOptionSchema = z.object({
  id: z.string().max(40),
  label: text(40).default('Opção 1'),
  items: z.array(planItemSchema).max(40),
})

export const planMealSchema = z.object({
  id: z.string().max(40),
  name: text(80).min(1, 'Dê um nome à refeição'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido').or(z.literal('')),
  notes: text(600).default(''),
  options: z.array(mealOptionSchema).min(1).max(5),
})

export const planDaySchema = z.object({
  id: z.string().max(40),
  label: text(60).min(1, 'Dê um nome ao dia'),
  /** 0 = domingo … 6 = sábado. Vazio = vale para qualquer dia. */
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  meals: z.array(planMealSchema).max(15),
})

export const targetsSchema = z.object({
  kcal: num.nullable().default(null),
  protein: num.nullable().default(null),
  carbs: num.nullable().default(null),
  fat: num.nullable().default(null),
  fiber: num.nullable().default(null),
})

export const planContentSchema = z.object({
  v: z.literal(2),
  mode: z.enum(['calculado', 'livre']).default('calculado'),
  targets: targetsSchema.default({ kcal: null, protein: null, carbs: null, fat: null, fiber: null }),
  days: z.array(planDaySchema).min(1).max(7),
  guidance: text(5000).default(''),
})

export type Measure = z.infer<typeof measureSchema>
export type Substitution = z.infer<typeof substitutionSchema>
export type PlanItem = z.infer<typeof planItemSchema>
export type MealOption = z.infer<typeof mealOptionSchema>
export type PlanMeal = z.infer<typeof planMealSchema>
export type PlanDay = z.infer<typeof planDaySchema>
export type PlanTargets = z.infer<typeof targetsSchema>
export type PlanContent = z.infer<typeof planContentSchema>

export const uid = () => Math.random().toString(36).slice(2, 10)

export const emptyPlan = (): PlanContent => ({
  v: 2,
  mode: 'calculado',
  targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null },
  days: [{ id: uid(), label: 'Todos os dias', weekdays: [], meals: [] }],
  guidance: '',
})

/* ------------------------- compatibilidade (versão 1) ------------------------- */

type LegacyItem = { id?: string; food: string; quantity?: string; householdMeasure?: string; notes?: string; substitutions?: { food: string; quantity?: string; householdMeasure?: string }[] }
type LegacyPlan = { meals: { id?: string; name: string; time?: string; notes?: string; items: LegacyItem[] }[]; guidance?: string }

/** Converte planos no formato antigo (texto livre) para a versão 2, sem perder conteúdo. */
export function normalizePlan(raw: unknown): PlanContent {
  if (raw && typeof raw === 'object' && (raw as { v?: number }).v === 2) {
    const parsed = planContentSchema.safeParse(raw)
    if (parsed.success) return parsed.data
  }
  const legacy = raw as LegacyPlan
  const qty = (q?: string, m?: string) => [m, q].filter(Boolean).join(' · ')
  return {
    v: 2,
    mode: 'livre',
    targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null },
    days: [
      {
        id: 'todos',
        label: 'Todos os dias',
        weekdays: [],
        meals: (legacy?.meals ?? []).map((m) => ({
          id: m.id ?? uid(),
          name: m.name,
          time: m.time ?? '',
          notes: m.notes ?? '',
          options: [
            {
              id: 'o1',
              label: 'Opção 1',
              items: m.items.map((it) => ({
                id: it.id ?? uid(),
                foodId: null,
                name: it.food,
                group: '',
                per100: null,
                grams: null,
                measure: null,
                text: qty(it.quantity, it.householdMeasure),
                notes: it.notes ?? '',
                locked: false,
                subs: (it.substitutions ?? []).map((s) => ({ foodId: null, name: s.food, per100: null, grams: null, measure: null, text: qty(s.quantity, s.householdMeasure) })),
              })),
            },
          ],
        })),
      },
    ],
    guidance: legacy?.guidance ?? '',
  }
}

/* ------------------------------ cálculos do plano ------------------------------ */

export function itemNutrients(it: Pick<PlanItem, 'per100' | 'grams'>): Nutrients | null {
  return it.per100 && it.grams != null ? scale(it.per100, it.grams) : null
}

export function optionTotals(o: MealOption): Nutrients {
  return sum(o.items.map((it) => itemNutrients(it) ?? ZERO))
}

/** Totais do dia considerando a opção escolhida de cada refeição (padrão: a primeira). */
export function dayTotals(day: PlanDay, chosen: Record<string, string> = {}): Nutrients {
  return sum(day.meals.map((m) => optionTotals(m.options.find((o) => o.id === chosen[m.id]) ?? m.options[0])))
}

export function sortedMeals(day: PlanDay) {
  return [...day.meals].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
}

/** Dia do plano que vale para a data (pelo dia da semana); senão, o primeiro. */
export function dayForWeekday(plan: PlanContent, weekday: number) {
  return plan.days.find((d) => d.weekdays.includes(weekday)) ?? plan.days.find((d) => d.weekdays.length === 0) ?? plan.days[0]
}

export function countItems(plan: PlanContent) {
  return plan.days.reduce((n, d) => n + d.meals.reduce((m, meal) => m + meal.options.reduce((k, o) => k + o.items.length, 0), 0), 0)
}

export function mealCount(plan: PlanContent) {
  return plan.days[0]?.meals.length ?? 0
}

/** Texto da quantidade de um item: "100 g · 4 colheres de sopa". */
export function quantityLabel(it: Pick<PlanItem, 'grams' | 'measure' | 'text'>) {
  const parts: string[] = []
  if (it.measure && it.measure.qty > 0) parts.push(formatMeasure(it.measure.qty, it.measure.name))
  if (it.grams != null) parts.push(`${Math.round(it.grams)} g`)
  if (!parts.length && it.text) parts.push(it.text)
  return parts.join(' · ')
}

export { times }
