import { describe, expect, it } from 'vitest'
import { parseAnswers, type FormField } from '@/lib/forms'
import { planContentSchema } from '@/lib/plan'
import { parseMoney } from '@/lib/format'
import { phone } from '@/lib/validation'

describe('formulários configuráveis', () => {
  const fields: FormField[] = [
    { id: 'obj', label: 'Objetivo', type: 'textarea', required: true, options: [], help: '' },
    { id: 'ref', label: 'Refeições', type: 'select', required: true, options: ['3', '4'], help: '' },
    { id: 'rest', label: 'Restrições', type: 'checkbox', required: false, options: ['Lactose', 'Glúten'], help: '' },
    { id: 'termo', label: 'Aceite', type: 'consent', required: true, options: [], help: '' },
  ]
  it('valida obrigatórios e opções permitidas', () => {
    const fd = new FormData()
    fd.set('f_ref', '7')
    fd.append('f_rest', 'Lactose')
    fd.append('f_rest', 'Inventada')
    const { answers, errors } = parseAnswers(fields, fd)
    expect(errors.obj).toBeDefined()
    expect(errors.ref).toBe('Opção inválida')
    expect(errors.termo).toBeDefined()
    expect(answers.rest).toEqual(['Lactose'])
  })
  it('aceita respostas válidas e ignora campos desconhecidos', () => {
    const fd = new FormData()
    fd.set('f_obj', 'Mais disposição')
    fd.set('f_ref', '4')
    fd.set('f_termo', 'on')
    fd.set('f_hack', 'x')
    const { answers, errors } = parseAnswers(fields, fd)
    expect(errors).toEqual({})
    expect(answers).not.toHaveProperty('hack')
    expect(answers.termo).toBe(true)
  })
})

describe('plano alimentar', () => {
  const base = { v: 2, days: [{ id: 'd', label: 'Todos os dias', meals: [] as unknown[] }] }
  it('rejeita refeição sem nome e horário inválido', () => {
    const bad = { ...base, days: [{ id: 'd', label: 'Todos', meals: [{ id: 'a', name: '', time: '7h', options: [{ id: 'o', items: [] }] }] }] }
    expect(planContentSchema.safeParse(bad).success).toBe(false)
  })
  it('aceita um plano bem formado e preenche os padrões', () => {
    const ok = {
      ...base,
      days: [{ id: 'd', label: 'Todos', meals: [{ id: 'a', name: 'Almoço', time: '12:30', options: [{ id: 'o', items: [{ id: 'i', name: 'Arroz', per100: { kcal: 128, protein: 2.5, carbs: 28.1, fat: 0.2, fiber: 1.6 }, grams: 100, subs: [{ name: 'Batata' }] }] }] }] }],
    }
    const r = planContentSchema.safeParse(ok)
    expect(r.success).toBe(true)
    expect(r.data!.mode).toBe('calculado')
    expect(r.data!.days[0].meals[0].options[0].label).toBe('Opção 1')
  })
  it('rejeita quantidades negativas', () => {
    const neg = { ...base, days: [{ id: 'd', label: 'Todos', meals: [{ id: 'a', name: 'Almoço', time: '', options: [{ id: 'o', items: [{ id: 'i', name: 'Arroz', grams: -5 }] }] }] }] }
    expect(planContentSchema.safeParse(neg).success).toBe(false)
  })
})

describe('valores e contatos', () => {
  it('converte valores em reais para centavos', () => {
    expect(parseMoney('1.234,56')).toBe(123456)
    expect(parseMoney('150')).toBe(15000)
    expect(parseMoney('R$ 99,90')).toBe(9990)
    expect(parseMoney('-5')).toBeNull()
  })
  it('normaliza telefones', () => {
    expect(phone.parse('(11) 98765-4321')).toBe('11987654321')
    expect(phone.safeParse('1234').success).toBe(false)
  })
})
