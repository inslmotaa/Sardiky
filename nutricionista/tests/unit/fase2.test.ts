import { describe, expect, it } from 'vitest'
import { bodyFatFromSkinfolds, leanMass, protocolSites, siri } from '@/lib/nutricao'
import { adherence, classify, daysSince, streak, weeklyAdherence } from '@/lib/acompanhamento'
import type { PlanContent } from '@/lib/plan'

/** Fase 2: composição corporal por dobras e adesão ao plano. */

describe('percentual de gordura por dobras cutâneas', () => {
  it('Siri: %G = 495 ÷ D − 450', () => {
    expect(siri(1.05)).toBeCloseTo(21.43, 2)
  })
  it('Jackson-Pollock 3 dobras (homem: peitoral, abdominal, coxa)', () => {
    const r = bodyFatFromSkinfolds('jp3', 'M', 30, { peitoral: 10, abdominal: 20, coxa: 15 })!
    expect(r.sumMm).toBe(45)
    expect(r.density).toBeCloseTo(1.0676965, 6)
    expect(r.pct).toBeCloseTo(13.61, 2)
  })
  it('Jackson-Pollock 3 dobras usa tríceps, suprailíaca e coxa na mulher', () => {
    expect(protocolSites('jp3', 'F')).toEqual(['triceps', 'suprailiaca', 'coxa'])
    expect(bodyFatFromSkinfolds('jp3', 'F', 30, { peitoral: 10, abdominal: 20, coxa: 15 })).toBeNull()
  })
  it('Jackson-Pollock 7 dobras (mulher, 35 anos, soma 105 mm)', () => {
    const r = bodyFatFromSkinfolds('jp7', 'F', 35, { peitoral: 10, axilarMedia: 12, triceps: 15, subescapular: 14, abdominal: 20, suprailiaca: 16, coxa: 18 })!
    expect(r.sumMm).toBe(105)
    expect(r.pct).toBeCloseTo(21.71, 2)
  })
  it('Durnin-Womersley com coeficiente da faixa etária (mulher, 25 anos, soma 55 mm)', () => {
    const r = bodyFatFromSkinfolds('durnin', 'F', 25, { biceps: 8, triceps: 18, subescapular: 15, suprailiaca: 14 })!
    expect(r.density).toBeCloseTo(1.1599 - 0.0717 * Math.log10(55), 8)
    expect(r.pct).toBeCloseTo(28.21, 2)
    // Faixa de 50 anos ou mais usa outro coeficiente.
    const older = bodyFatFromSkinfolds('durnin', 'F', 55, { biceps: 8, triceps: 18, subescapular: 15, suprailiaca: 14 })!
    expect(older.density).toBeCloseTo(1.1339 - 0.0645 * Math.log10(55), 8)
  })
  it('dobra faltando ou zerada não gera resultado; massa magra a partir do %G', () => {
    expect(bodyFatFromSkinfolds('jp7', 'M', 30, { peitoral: 10 })).toBeNull()
    expect(bodyFatFromSkinfolds('jp3', 'M', 30, { peitoral: 0, abdominal: 20, coxa: 15 })).toBeNull()
    expect(leanMass(70, 25)).toBe(52.5)
  })
})

const meal = (id: string) => ({ id, name: id, time: '', notes: '', options: [{ id: 'o1', label: 'Opção 1', items: [] }] })
const plan: PlanContent = {
  v: 2,
  mode: 'livre',
  targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null },
  guidance: '',
  days: [
    // 4 refeições por dia em todos os dias da semana.
    { id: 'd', label: 'Todos os dias', weekdays: [], meals: [meal('a'), meal('b'), meal('c'), meal('d')] },
  ],
}

describe('adesão ao plano', () => {
  it('feita conta 1, parcial ½ e pulada 0 sobre as refeições previstas', () => {
    // 2 dias × 4 refeições = 8 previstas; 5 feitas + 2 parciais = 6 → 75%.
    const logs = [
      ...['a', 'b', 'c'].map(() => ({ date: '2026-10-19', status: 'feita' })),
      { date: '2026-10-20', status: 'feita' },
      { date: '2026-10-20', status: 'feita' },
      { date: '2026-10-20', status: 'parcial' },
      { date: '2026-10-19', status: 'parcial' },
      { date: '2026-10-18', status: 'feita' }, // fora do período
    ]
    expect(adherence(plan, logs, '2026-10-19', '2026-10-20')).toEqual({ pct: 75, done: 6, planned: 8 })
  })
  it('não conta dias antes do início do plano e sem plano não há adesão', () => {
    const logs = [{ date: '2026-10-20', status: 'feita' }]
    expect(adherence(plan, logs, '2026-10-14', '2026-10-20', '2026-10-20')!.pct).toBe(25)
    expect(adherence(null, logs, '2026-10-14', '2026-10-20')).toBeNull()
  })
  it('dias da semana diferentes têm números diferentes de refeições', () => {
    const p: PlanContent = { ...plan, days: [{ id: 't', label: 'Treino', weekdays: [1], meals: [meal('a'), meal('b'), meal('c'), meal('d'), meal('e')] }, plan.days[0]] }
    // 2026-10-19 é segunda-feira (5 refeições); 2026-10-20 terça (4).
    expect(adherence(p, [], '2026-10-19', '2026-10-20')!.planned).toBe(9)
  })
  it('classificação com limites configuráveis', () => {
    expect(classify(80)).toBe('em_dia')
    expect(classify(79)).toBe('dificuldade')
    expect(classify(40)).toBe('dificuldade')
    expect(classify(39)).toBe('sem_progresso')
    expect(classify(null)).toBe('sem_progresso')
    expect(classify(70, { good: 70, low: 30 })).toBe('em_dia')
  })
  it('sequência de dias registrando e dias sem registro', () => {
    expect(streak(['2026-10-20', '2026-10-19', '2026-10-18', '2026-10-16'], '2026-10-20')).toBe(3)
    expect(streak(['2026-10-19', '2026-10-18'], '2026-10-20')).toBe(2)
    expect(streak(['2026-10-17'], '2026-10-20')).toBe(0)
    expect(daysSince('2026-10-17', '2026-10-20')).toBe(3)
    expect(daysSince(null, '2026-10-20')).toBeNull()
  })
  it('adesão semanal em blocos de 7 dias', () => {
    const w = weeklyAdherence(plan, [{ date: '2026-10-20', status: 'feita' }], '2026-10-20', 2)
    expect(w).toHaveLength(2)
    expect(w[1]).toEqual({ from: '2026-10-14', to: '2026-10-20', pct: 4 })
    expect(w[0].pct).toBe(0)
  })
})
