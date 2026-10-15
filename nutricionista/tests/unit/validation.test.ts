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
  it('rejeita refeição sem nome e horário inválido', () => {
    expect(planContentSchema.safeParse({ meals: [{ id: 'a', name: '', time: '7h', notes: '', items: [] }], guidance: '' }).success).toBe(false)
  })
  it('aceita um plano bem formado', () => {
    const r = planContentSchema.safeParse({
      meals: [{ id: 'a', name: 'Almoço', time: '12:30', items: [{ id: 'i', food: 'Arroz', quantity: '100 g', householdMeasure: '4 colheres', substitutions: [{ food: 'Batata' }] }] }],
    })
    expect(r.success).toBe(true)
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
