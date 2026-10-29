import { describe, expect, it } from 'vitest'
import taco from '@/db/data/taco-4ed.json'
import ibge from '@/db/data/ibge-medidas.json'
import { TACO_FOODS } from '@/db/foods-taco'
import { fmtNutrient, nutrientIn, PLAN_MICROS, sumNutrients, TACO_NUTRIENTS, type NutrientTable } from '@/lib/tabela-nutricional'

type Row = { code: number; name: string; category: string; group: string; n: NutrientTable }
const rows = taco as Row[]
const byName = (name: string) => rows.find((r) => r.name === name)!

describe('TACO 4ª ed. importada da planilha oficial', () => {
  it('tem os 597 alimentos, com número e categoria oficiais', () => {
    expect(rows).toHaveLength(597)
    expect(new Set(rows.map((r) => r.code)).size).toBe(597)
    expect(new Set(rows.map((r) => r.category)).size).toBe(15)
  })

  it('confere com a tabela publicada (valores por 100 g)', () => {
    expect(byName('Arroz, tipo 1, cozido').n).toMatchObject({ kcal: 128, proteina: 2.5, carboidrato: 28.1, lipideos: 0.2, fibra: 1.6 })
    expect(byName('Banana, prata, crua').n).toMatchObject({ kcal: 98, proteina: 1.3, carboidrato: 26, fibra: 2, vitaminaC: 21.6, sodio: 'Tr' })
    expect(byName('Feijão, carioca, cozido').n).toMatchObject({ kcal: 76, proteina: 4.8, fibra: 8.5, ferro: 1.3 })
    expect(byName('Frango, peito, sem pele, grelhado').n).toMatchObject({ kcal: 159, proteina: 32, colesterol: 89 })
  })

  it('mantém "Tr" (traços), "NA" (não se aplica) e "não analisado"', () => {
    expect(byName('Arroz, tipo 1, cozido').n.colesterol).toBe('NA')
    expect(byName('Arroz, tipo 1, cozido').n.tiamina).toBe('Tr')
    // A própria TACO não traz energia/macros do leite líquido.
    expect(byName('Leite, de vaca, integral').n.kcal).toBeNull()
  })

  it('usa os nomes oficiais nos alimentos iniciais com medidas caseiras', () => {
    for (const f of TACO_FOODS.filter((x) => x.taco)) {
      const row = byName(f.taco!)
      expect(row, f.taco).toBeTruthy()
      expect(f.kcal).toBe(row.n.kcal)
    }
  })
})

describe('medidas caseiras do IBGE', () => {
  it('só traz medidas caseiras (sem grama, quilo ou litro) e com acentos', () => {
    const list = ibge as [string, string, string, number][]
    expect(list.length).toBeGreaterThan(7000)
    expect(list.some(([, , m]) => ['GRAMA', 'QUILO', 'MILILITRO', 'LITRO'].includes(m))).toBe(false)
    expect(list.some(([food, , m, g]) => food.startsWith('ARROZ') && m === 'COLHER DE ARROZ/SERVIR' && g === 45)).toBe(true)
    expect(list.some(([, , m]) => m === 'XÍCARA DE CHÁ')).toBe(true)
  })
})

describe('tabela nutricional', () => {
  it('formata traços, "não se aplica" e "não analisado"', () => {
    expect(fmtNutrient('Tr', 1)).toBe('Tr')
    expect(fmtNutrient('NA', 1)).toBe('NA')
    expect(fmtNutrient(null, 1)).toBe('—')
    expect(fmtNutrient(21.6, 1)).toBe('21,6')
  })

  it('calcula a porção (traços e NA contam como zero)', () => {
    const t: NutrientTable = { vitaminaC: 21.6, sodio: 'Tr', colesterol: 'NA', retinol: null }
    expect(nutrientIn(t, 'vitaminaC', 50)).toBeCloseTo(10.8)
    expect(nutrientIn(t, 'sodio', 50)).toBe(0)
    expect(nutrientIn(t, 'colesterol', 50)).toBe(0)
    expect(nutrientIn(t, 'retinol', 50)).toBeNull()
  })

  it('soma o dia e conta os itens sem o dado (total parcial)', () => {
    const banana = byName('Banana, prata, crua').n
    const feijao = byName('Feijão, carioca, cozido').n
    const r = sumNutrients(
      [
        { table: banana, grams: 100 },
        { table: feijao, grams: 200 },
        { table: null, grams: 50 },
      ],
      PLAN_MICROS,
    )
    expect(r.totals.ferro).toBeCloseTo(0.4 + 2.6)
    expect(r.missing.ferro).toBe(1)
    expect(r.count).toBe(3)
  })

  it('cobre todos os nutrientes da TACO', () => {
    const keys = Object.keys(byName('Banana, prata, crua').n)
    expect(TACO_NUTRIENTS.map((n) => n.key).sort()).toEqual(keys.sort())
  })
})
