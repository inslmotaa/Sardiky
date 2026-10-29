/**
 * Alimentos mais usados, com medidas caseiras e fator de cocção (peso cozido ÷ peso cru).
 * Os valores por 100 g vêm da TACO 4ª ed. (NEPA/Unicamp, 2011) — campo `taco` com o nome
 * oficial. A base completa (597 alimentos) é importada de src/db/data/taco-4ed.json.
 * Três itens não têm energia/macros analisados na TACO (leite líquido e grão-de-bico
 * cozido): ficam como "Complementar", com valores de referência a conferir.
 */
import alimentos from './data/alimentos-iniciais.json'

export type SeedFood = {
  name: string
  /** Nome oficial na TACO 4ª ed. (quando o alimento está na tabela). */
  taco?: string
  group: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium?: number
  cookingFactor?: number
  measures: [string, number][]
}

// Os dados ficam em JSON para serem lidos também pelo importador de produção (scripts/tabelas/importar.mjs).
export const TACO_FOODS = alimentos as SeedFood[]
