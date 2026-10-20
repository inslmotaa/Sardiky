import { describe, expect, it } from 'vitest'
import { shoppingList, shoppingQuantity } from '@/lib/compras'
import { restrictionAlerts, restrictionsFromText } from '@/lib/restricoes'
import { easter, jitsiRoom, nationalHolidays } from '@/lib/feriados'
import type { PlanContent } from '@/lib/plan'

const per100 = { kcal: 100, protein: 1, carbs: 1, fat: 1, fiber: 0 }
const item = (foodId: string, name: string, group: string, grams: number | null, text = '') => ({
  id: foodId + Math.random(), foodId, name, group, per100, grams, measure: null, text, notes: '', locked: false, subs: [],
})
const plan: PlanContent = {
  v: 2,
  mode: 'calculado',
  targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null },
  guidance: '',
  days: [
    {
      id: 'treino', label: 'Treino', weekdays: [1, 3, 5],
      meals: [{ id: 'a', name: 'Almoço', time: '12:00', notes: '', options: [{ id: 'o1', label: 'Opção 1', items: [item('arroz', 'Arroz, tipo 1, cozido', 'cereais', 100), item('ovo', 'Ovo de galinha, inteiro, cozido', 'carnes', 100)] }] }],
    },
    {
      id: 'todos', label: 'Demais dias', weekdays: [],
      meals: [{ id: 'b', name: 'Almoço', time: '12:00', notes: '', options: [{ id: 'o1', label: 'Opção 1', items: [item('arroz', 'Arroz, tipo 1, cozido', 'cereais', 50), item('sal', 'Salada verde', 'verduras', null, 'à vontade')] }] }],
    },
  ],
}

describe('lista de compras', () => {
  const foods = new Map([
    ['arroz', { cookingFactor: 2.5, measures: [] }],
    ['ovo', { cookingFactor: null, measures: [{ name: 'unidade', grams: 50 }] }],
  ])
  const list = shoppingList(plan, foods)
  it('soma a semana pelo dia de cada dia da semana e converte cozido em cru', () => {
    // 3 dias × 100 g + 4 dias × 50 g = 500 g cozido → 200 g cru (fator 2,5).
    const arroz = list.find((i) => i.key === 'arroz')!
    expect(arroz.grams).toBe(200)
    expect(arroz.raw).toBe(true)
    expect(shoppingQuantity(arroz)).toBe('200 g (cru)')
  })
  it('mostra unidades quando o alimento tem medida “unidade”', () => {
    const ovo = list.find((i) => i.key === 'ovo')!
    expect(ovo.grams).toBe(300)
    expect(ovo.units).toBe(6)
    expect(shoppingQuantity(ovo)).toBe('≈ 6 unidades (300 g)')
  })
  it('itens sem gramas aparecem com o texto do plano e a lista vem agrupada', () => {
    const sal = list.find((i) => i.name === 'Salada verde')!
    expect(shoppingQuantity(sal)).toBe('à vontade')
    expect(list.map((i) => i.groupLabel)).toEqual([...list.map((i) => i.groupLabel)].sort((a, b) => a.localeCompare(b)))
  })
  it('acima de 1 kg mostra em kg', () => {
    expect(shoppingQuantity({ key: 'x', name: 'x', group: 'frutas', groupLabel: 'Frutas', grams: 1240, raw: false, units: null, notes: [] })).toBe('1,3 kg')
  })
})

describe('restrições alimentares', () => {
  it('alerta lactose, glúten, vegetariano e ovo pelos nomes e grupos', () => {
    expect(restrictionAlerts({ name: 'Queijo minas frescal', group: 'laticinios' }, ['lactose'])).toEqual(['Lactose'])
    expect(restrictionAlerts({ name: 'Iogurte natural sem lactose', group: 'laticinios' }, ['lactose'])).toEqual([])
    expect(restrictionAlerts({ name: 'Pão francês', group: 'cereais' }, ['gluten'])).toEqual(['Glúten'])
    expect(restrictionAlerts({ name: 'Pão de queijo', group: 'cereais' }, ['gluten'])).toEqual([])
    expect(restrictionAlerts({ name: 'Frango, peito sem pele, grelhado', group: 'carnes' }, ['vegetariano'])).toEqual(['Vegetariano(a)'])
    expect(restrictionAlerts({ name: 'Ovos mexidos', group: 'carnes' }, ['ovo', 'vegetariano'])).toEqual(['Ovo'])
    expect(restrictionAlerts({ name: 'Arroz, integral, cozido', group: 'cereais' }, ['lactose', 'gluten', 'vegano'])).toEqual([])
  })
  it('converte as opções marcadas na anamnese', () => {
    expect(restrictionsFromText(['Lactose', 'Glúten', 'Vegetariano(a)', 'Nenhuma']).sort()).toEqual(['gluten', 'lactose', 'vegetariano'])
    expect(restrictionsFromText(['Frutos do mar'])).toEqual(['frutos_do_mar'])
  })
})

describe('feriados e videochamada', () => {
  it('Páscoa e feriados móveis', () => {
    expect(easter(2025)).toBe('2025-04-20')
    expect(easter(2026)).toBe('2026-04-05')
    expect(easter(2027)).toBe('2027-03-28')
    const h = nationalHolidays(2026)
    expect(h.find((x) => x.name === 'Sexta-feira Santa')!.date).toBe('2026-04-03')
    expect(h.find((x) => x.name === 'Carnaval (terça-feira)')!.date).toBe('2026-02-17')
    expect(h.find((x) => x.name === 'Corpus Christi')!.date).toBe('2026-06-04')
    expect(h.filter((x) => !x.optional)).toHaveLength(10)
  })
  it('sala do Jitsi com nome da marca sem acentos', () => {
    expect(jitsiRoom('André Farion', 'ab12cd34ef')).toBe('https://meet.jit.si/AndreFarion-ab12cd34ef')
  })
})
