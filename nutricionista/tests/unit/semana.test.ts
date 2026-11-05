import { describe, expect, it } from 'vitest'
import { emptyPlan, weekdaysLabel, weekRows, type PlanContent } from '@/lib/plan'

function twoDays(): PlanContent {
  const base = emptyPlan([
    { name: 'Café da manhã', time: '07:00' },
    { name: 'Almoço', time: '12:30' },
  ])
  const treino = { ...base.days[0], id: 'treino', label: 'Dia de treino', weekdays: [1, 3, 5] }
  const descanso = { ...structuredClone(base.days[0]), id: 'descanso', label: 'Dia de descanso', weekdays: [] as number[] }
  treino.meals[0].options[0].items.push({
    id: 'i1',
    foodId: null,
    name: 'Banana',
    group: '',
    per100: { kcal: 98, protein: 1.3, carbs: 26, fat: 0.1, fiber: 2 },
    grams: 100,
    measure: null,
    text: '',
    notes: '',
    locked: false,
    subs: [],
  })
  return { ...base, days: [treino, descanso] }
}

describe('visão da semana do plano', () => {
  it('cada dia do plano mostra os dias da semana que cobre', () => {
    const p = twoDays()
    expect(weekdaysLabel(p, 'treino')).toBe('Seg, Qua, Sex')
    expect(weekdaysLabel(p, 'descanso')).toBe('Ter, Qui, Sáb, Dom')
    expect(weekdaysLabel(emptyPlan([{ name: 'Café', time: '07:00' }]), emptyPlan().days[0].id)).toBe('')
  })
  it('uma linha por dia, de segunda a domingo, com tipo de dia, refeições e kcal', () => {
    const rows = weekRows(twoDays())
    expect(rows.map((r) => r.short)).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])
    expect(rows[0]).toMatchObject({ dayLabel: 'Dia de treino', meals: ['07:00 Café da manhã', '12:30 Almoço'], kcal: 98 })
    expect(rows[1]).toMatchObject({ dayLabel: 'Dia de descanso', kcal: 0 })
  })
})

describe('medidas caseiras sempre com o peso da base', async () => {
  const { withBaseMeasure } = await import('@/lib/nutricao')
  const { consistentMeasures } = await import('@/lib/plan')
  const banana = [{ name: 'unidade média', grams: 60 }]
  it('65 g de banana viram "1 unidade média" com 60 g (o peso da base)', () => {
    expect(withBaseMeasure(65, banana)).toEqual({ grams: 60, measure: { name: 'unidade média', grams: 60, qty: 1 } })
    expect(withBaseMeasure(200, [{ name: 'colher de sopa', grams: 25 }])).toEqual({ grams: 200, measure: { name: 'colher de sopa', grams: 25, qty: 8 } })
    expect(withBaseMeasure(37, [{ name: 'xícara', grams: 120 }])).toEqual({ grams: 37, measure: null })
  })
  it('planos já salvos: a substituição passa a pesar quantidade × medida; o item ajusta a quantidade', () => {
    const p = twoDays()
    const it0 = p.days[0].meals[0].options[0].items[0]
    it0.measure = { name: 'unidade média', grams: 60, qty: 1 }
    it0.grams = 100
    it0.subs.push({ foodId: null, name: 'Banana prata', per100: null, grams: 65, measure: { name: 'unidade média', grams: 60, qty: 1 }, text: '' })
    consistentMeasures(p)
    expect(it0.subs[0].grams).toBe(60)
    expect(it0.measure!.qty).toBeCloseTo(1.67, 2)
  })
})
