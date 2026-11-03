import { describe, expect, it } from 'vitest'
import { contractInfo } from '@/lib/contract'

describe('plano contratado', () => {
  it('sem prazo por padrão; com término definido pelo coach, avisa perto do fim', () => {
    const tri = { name: 'Trimestral', sessions: 3 }
    expect(contractInfo(tri, '2026-10-01', null, '2026-11-03')).toMatchObject({ end: null, daysLeft: null, status: 'sem-prazo' })
    expect(contractInfo(tri, null, null, '2026-11-03')).toMatchObject({ status: 'sem-prazo' })
    expect(contractInfo(tri, '2026-10-01', '2027-01-01', '2026-11-03')).toMatchObject({ daysLeft: 59, status: 'vigente' })
    expect(contractInfo(tri, '2026-08-10', '2026-11-10', '2026-11-03')).toMatchObject({ daysLeft: 7, status: 'vencendo' })
    expect(contractInfo(tri, '2026-07-01', '2026-10-01', '2026-11-03')).toMatchObject({ status: 'vencido' })
  })
})

describe('ativar só parte do plano', () => {
  it('retira opções e refeições vazias e lista as refeições retiradas', async () => {
    const { dropEmptyMeals, emptyPlan } = await import('@/lib/plan')
    const plan = emptyPlan([
      { name: 'Café da manhã', time: '07:00' },
      { name: 'Almoço', time: '12:30' },
    ])
    const cafe = plan.days[0].meals[0]
    cafe.options[0].items.push({
      id: 'a',
      foodId: null,
      name: 'Pão',
      group: '',
      per100: null,
      grams: null,
      measure: null,
      text: '1 unidade',
      notes: '',
      locked: false,
      subs: [],
    })
    cafe.options.push({ id: 'o2', label: 'Opção 2', items: [] })
    const { content, removed } = dropEmptyMeals(plan)
    expect(removed).toEqual(['Almoço'])
    expect(content.days[0].meals.map((m) => m.name)).toEqual(['Café da manhã'])
    expect(content.days[0].meals[0].options).toHaveLength(1)
  })
})
