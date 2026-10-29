/**
 * Tabela nutricional completa dos alimentos (módulo puro, sem banco): nutrientes da
 * TACO 4ª ed., formatação de "Tr" (traços), "NA" (não se aplica) e "—" (não analisado), somas por porção
 * e as citações das fontes usadas no painel.
 */
import { fmt } from './nutricao'

export type NutrientValue = number | 'Tr' | 'NA' | null
export type NutrientTable = Record<string, NutrientValue>

export type NutrientInfo = { key: string; label: string; unit: string; digits: number; section: 'macro' | 'mineral' | 'vitamina' | 'outros' }

/** Nutrientes da TACO 4ª ed., na ordem da tabela publicada. */
export const TACO_NUTRIENTS: NutrientInfo[] = [
  { key: 'kcal', label: 'Energia', unit: 'kcal', digits: 0, section: 'macro' },
  { key: 'proteina', label: 'Proteína', unit: 'g', digits: 1, section: 'macro' },
  { key: 'lipideos', label: 'Lipídeos (gorduras)', unit: 'g', digits: 1, section: 'macro' },
  { key: 'carboidrato', label: 'Carboidrato', unit: 'g', digits: 1, section: 'macro' },
  { key: 'fibra', label: 'Fibra alimentar', unit: 'g', digits: 1, section: 'macro' },
  { key: 'colesterol', label: 'Colesterol', unit: 'mg', digits: 0, section: 'macro' },
  { key: 'calcio', label: 'Cálcio', unit: 'mg', digits: 0, section: 'mineral' },
  { key: 'ferro', label: 'Ferro', unit: 'mg', digits: 1, section: 'mineral' },
  { key: 'magnesio', label: 'Magnésio', unit: 'mg', digits: 0, section: 'mineral' },
  { key: 'fosforo', label: 'Fósforo', unit: 'mg', digits: 0, section: 'mineral' },
  { key: 'potassio', label: 'Potássio', unit: 'mg', digits: 0, section: 'mineral' },
  { key: 'sodio', label: 'Sódio', unit: 'mg', digits: 0, section: 'mineral' },
  { key: 'zinco', label: 'Zinco', unit: 'mg', digits: 1, section: 'mineral' },
  { key: 'cobre', label: 'Cobre', unit: 'mg', digits: 2, section: 'mineral' },
  { key: 'manganes', label: 'Manganês', unit: 'mg', digits: 2, section: 'mineral' },
  { key: 'rae', label: 'Vitamina A (RAE)', unit: 'µg', digits: 0, section: 'vitamina' },
  { key: 're', label: 'Vitamina A (RE)', unit: 'µg', digits: 0, section: 'vitamina' },
  { key: 'retinol', label: 'Retinol', unit: 'µg', digits: 0, section: 'vitamina' },
  { key: 'tiamina', label: 'Tiamina (B1)', unit: 'mg', digits: 2, section: 'vitamina' },
  { key: 'riboflavina', label: 'Riboflavina (B2)', unit: 'mg', digits: 2, section: 'vitamina' },
  { key: 'niacina', label: 'Niacina (B3)', unit: 'mg', digits: 2, section: 'vitamina' },
  { key: 'piridoxina', label: 'Piridoxina (B6)', unit: 'mg', digits: 2, section: 'vitamina' },
  { key: 'vitaminaC', label: 'Vitamina C', unit: 'mg', digits: 1, section: 'vitamina' },
  { key: 'umidade', label: 'Umidade', unit: '%', digits: 1, section: 'outros' },
  { key: 'cinzas', label: 'Cinzas', unit: 'g', digits: 1, section: 'outros' },
]

export const NUTRIENT_SECTIONS: Record<NutrientInfo['section'], string> = {
  macro: 'Energia e macronutrientes',
  mineral: 'Minerais',
  vitamina: 'Vitaminas',
  outros: 'Outros',
}

/** Vitaminas, minerais e outros itens somados na análise do plano alimentar. */
export const PLAN_MICROS = [
  'fibra',
  'calcio',
  'ferro',
  'magnesio',
  'potassio',
  'sodio',
  'zinco',
  'rae',
  'vitaminaC',
  'tiamina',
  'riboflavina',
  'niacina',
  'piridoxina',
  'colesterol',
] as const

export const NUTRIENT_BY_KEY = Object.fromEntries(TACO_NUTRIENTS.map((n) => [n.key, n])) as Record<string, NutrientInfo>

/** "Tr" (traços), "NA" (não se aplica), "—" (não analisado) ou o número arredondado como na tabela. */
export function fmtNutrient(v: NutrientValue | undefined, digits: number) {
  if (v === 'Tr' || v === 'NA') return v
  if (v == null) return '—'
  return fmt(v, digits)
}

/** Valor da tabela numa porção (traços e "não se aplica" contam como zero). */
export function nutrientIn(table: NutrientTable, key: string, grams: number): number | null {
  const v = table[key]
  if (v == null) return null
  if (v === 'Tr' || v === 'NA') return 0
  return (v * grams) / 100
}

/**
 * Soma de vitaminas e minerais de vários itens (alimento + gramas). Itens sem o nutriente
 * analisado na tabela não entram na soma e são contados em `missing`, para avisar que o
 * total é parcial.
 */
export function sumNutrients(items: { table: NutrientTable | null | undefined; grams: number }[], keys: readonly string[]) {
  const totals: Record<string, number> = {}
  const missing: Record<string, number> = {}
  for (const k of keys) {
    totals[k] = 0
    missing[k] = 0
  }
  for (const it of items) {
    for (const k of keys) {
      const v = it.table ? nutrientIn(it.table, k, it.grams) : null
      if (v == null) missing[k]++
      else totals[k] += v
    }
  }
  return { totals, missing, count: items.length }
}

export const SOURCE_LABEL: Record<string, string> = {
  TACO: 'TACO 4ª ed.',
  Complementar: 'Complementar',
  proprio: 'Próprio (rótulo)',
}

export const TACO_CITATION =
  'NEPA/UNICAMP. Tabela Brasileira de Composição de Alimentos – TACO. 4ª ed. revisada e ampliada. Campinas: NEPA/UNICAMP, 2011.'
export const IBGE_CITATION =
  'IBGE. Pesquisa de Orçamentos Familiares 2008-2009: tabela de medidas referidas para os alimentos consumidos no Brasil. Rio de Janeiro: IBGE, 2011.'
