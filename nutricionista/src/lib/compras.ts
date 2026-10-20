import { FOOD_GROUPS, fmt, normalize } from './nutricao'
import { dayForWeekday, type PlanContent } from './plan'

/**
 * Lista de compras da semana gerada a partir do plano (módulo puro).
 * Soma as quantidades de cada alimento nos 7 dias, pela opção escolhida em cada refeição
 * (padrão: a primeira). Alimentos cozidos viram peso cru pelo fator de cocção, quando conhecido.
 */

export type ShoppingItem = {
  key: string
  name: string
  group: string
  groupLabel: string
  grams: number
  raw: boolean
  /** Quantidade em unidades (quando o alimento tem medida “unidade”). */
  units: number | null
  /** Itens de plano livre, sem gramas: aparecem com o texto da quantidade. */
  notes: string[]
}

export type FoodInfo = { cookingFactor: number | null; measures: { name: string; grams: number }[] }

export function shoppingList(plan: PlanContent, foods: Map<string, FoodInfo> = new Map(), opts: { chosen?: Record<string, string>; weekdays?: number[] } = {}) {
  const weekdays = opts.weekdays ?? [0, 1, 2, 3, 4, 5, 6]
  const map = new Map<string, ShoppingItem>()
  for (const wd of weekdays) {
    const day = dayForWeekday(plan, wd)
    if (!day) continue
    for (const meal of day.meals) {
      const opt = meal.options.find((o) => o.id === opts.chosen?.[meal.id]) ?? meal.options[0]
      for (const it of opt?.items ?? []) {
        const key = it.foodId ?? `txt:${normalize(it.name)}`
        const info = it.foodId ? foods.get(it.foodId) : undefined
        let cur = map.get(key)
        if (!cur) {
          cur = { key, name: it.name, group: it.group || 'outros', groupLabel: FOOD_GROUPS[it.group] ?? 'Outros', grams: 0, raw: false, units: null, notes: [] }
          map.set(key, cur)
        }
        if (it.grams != null && it.grams > 0) {
          // Alimento cozido no plano → compra-se cru (ex.: arroz cozido ÷ 2,5).
          const factor = info?.cookingFactor
          const cooked = /cozid|grelhad|assad|refogad/i.test(it.name)
          if (factor && factor > 0 && cooked) {
            cur.grams += it.grams / factor
            cur.raw = true
          } else cur.grams += it.grams
        } else if (it.text) cur.notes.push(it.text)
      }
    }
  }
  for (const item of map.values()) {
    const info = item.key.startsWith('txt:') ? undefined : foods.get(item.key)
    const unit = info?.measures.find((m) => /^unidade/.test(m.name))
    item.units = unit && !item.raw && item.grams > 0 ? Math.ceil(item.grams / unit.grams) : null
    item.grams = Math.ceil(item.grams)
  }
  return [...map.values()].sort((a, b) => a.groupLabel.localeCompare(b.groupLabel) || a.name.localeCompare(b.name))
}

/** “1,2 kg”, “350 g”, “≈ 14 unidades (1,4 kg)”. */
export function shoppingQuantity(i: ShoppingItem) {
  if (i.grams <= 0) return i.notes.length ? [...new Set(i.notes)].slice(0, 2).join('; ') : 'a gosto'
  const weight = i.grams >= 1000 ? `${fmt(Math.ceil(i.grams / 100) / 10, 1)} kg` : `${Math.ceil(i.grams / 10) * 10} g`
  const w = i.raw ? `${weight} (cru)` : weight
  return i.units ? `≈ ${i.units} ${i.units === 1 ? 'unidade' : 'unidades'} (${w})` : w
}
