import { z } from 'zod'

const text = (max: number) => z.string().trim().max(max)

export const planItemSchema = z.object({
  id: z.string().max(40),
  food: text(160).min(1, 'Informe o alimento'),
  quantity: text(40).default(''),
  householdMeasure: text(80).default(''),
  notes: text(300).default(''),
  substitutions: z
    .array(
      z.object({
        food: text(160).min(1, 'Informe a substituição'),
        quantity: text(40).default(''),
        householdMeasure: text(80).default(''),
      }),
    )
    .max(20)
    .default([]),
})

export const planMealSchema = z.object({
  id: z.string().max(40),
  name: text(80).min(1, 'Dê um nome à refeição'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido').or(z.literal('')),
  notes: text(600).default(''),
  items: z.array(planItemSchema).max(40),
})

export const planContentSchema = z.object({
  meals: z.array(planMealSchema).max(15),
  guidance: text(5000).default(''),
})

export type PlanItem = z.infer<typeof planItemSchema>
export type PlanMeal = z.infer<typeof planMealSchema>
export type PlanContent = z.infer<typeof planContentSchema>

export const emptyPlan = (): PlanContent => ({ meals: [], guidance: '' })

export function countItems(content: PlanContent) {
  return content.meals.reduce((n, m) => n + m.items.length, 0)
}
