import { describe, expect, it } from 'vitest'
import { contractInfo } from '@/lib/contract'
import { addMonthsSameDay } from '@/lib/time'

describe('plano contratado', () => {
  it('soma meses mantendo o dia, sem passar do fim do mês', () => {
    expect(addMonthsSameDay('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsSameDay('2026-10-15', 3)).toBe('2027-01-15')
    expect(addMonthsSameDay('2028-01-31', 1)).toBe('2028-02-29')
  })
  it('vigência, dias restantes e situação', () => {
    const tri = { name: 'Trimestral', months: 3, sessions: 3 }
    expect(contractInfo(tri, '2026-10-01', '2026-11-03')).toMatchObject({ end: '2027-01-01', daysLeft: 59, status: 'vigente' })
    expect(contractInfo(tri, '2026-08-10', '2026-11-03')).toMatchObject({ end: '2026-11-10', daysLeft: 7, status: 'vencendo' })
    expect(contractInfo(tri, '2026-07-01', '2026-11-03')).toMatchObject({ end: '2026-10-01', status: 'vencido' })
    expect(contractInfo(tri, null, '2026-11-03')).toMatchObject({ end: null, daysLeft: null, status: 'sem-inicio' })
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
