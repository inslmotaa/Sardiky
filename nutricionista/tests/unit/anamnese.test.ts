import { describe, expect, it } from 'vitest'
import { ANAMNESIS_STEPS, answerText, stepComplete, stepSchema } from '@/lib/anamnese-form'
import { maskPhone } from '@/lib/format'

const step = (key: string) => ANAMNESIS_STEPS.find((s) => s.key === key)!

describe('anamnese em etapas', () => {
  it('tem as 6 etapas de perguntas pedidas (a 7ª é a revisão)', () => {
    expect(ANAMNESIS_STEPS.map((s) => s.title)).toEqual(['Dados pessoais', 'Objetivo', 'Saúde', 'Medidas', 'Rotina', 'Alimentação'])
  })

  it('valida campos obrigatórios, opções, datas e números (com vírgula)', () => {
    const pessoais = stepSchema(step('pessoais'))
    const bad = pessoais.safeParse({ nascimento: '2999-01-01', sexo: 'Outro', profissao: '', cidade: '' })
    expect(bad.success).toBe(false)
    const fields = bad.success ? [] : bad.error.issues.map((i) => i.path[0])
    expect(fields).toEqual(expect.arrayContaining(['nascimento', 'sexo', 'cidade']))
    expect(pessoais.safeParse({ nascimento: '1990-05-20', sexo: 'Feminino', profissao: '', cidade: 'Curitiba' }).success).toBe(true)

    const medidas = stepSchema(step('medidas'))
    const ok = medidas.safeParse({ peso: '68,4', altura: '163', cintura: '' })
    expect(ok.success && ok.data).toMatchObject({ peso: 68.4, altura: 163, cintura: null })
    expect(medidas.safeParse({ peso: '900', altura: '163', cintura: '' }).success).toBe(false)
  })

  it('sabe quando uma etapa está completa e formata respostas para o painel e o PDF', () => {
    expect(stepComplete(step('saude'), {})).toBe(true) // nada obrigatório
    expect(stepComplete(step('objetivo'), {})).toBe(false)
    const f = step('medidas').fields.find((x) => x.id === 'peso')!
    expect(answerText(f, 68.4)).toBe('68,4 kg')
    expect(answerText(step('pessoais').fields[0], '1990-05-20')).toBe('20/05/1990')
  })
})

describe('máscara de WhatsApp', () => {
  it('formata celular e fixo', () => {
    expect(maskPhone('41999998888')).toBe('(41) 99999-8888')
    expect(maskPhone('4133334444')).toBe('(41) 3333-4444')
    expect(maskPhone('41')).toBe('(41')
  })
})
