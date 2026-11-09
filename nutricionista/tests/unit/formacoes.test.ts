import { describe, expect, it } from 'vitest'
import { credentialsText, parseCredentials } from '@/lib/formacoes'

describe('formações e certificações (Sobre)', () => {
  it('lê "Curso | Instituição | Ano" por linha, mais recentes primeiro', () => {
    const r = parseCredentials('Coaching em saúde | Instituto X | 2019\n\n  Nutrição esportiva aplicada | Universidade Y | 2023 ', 2026)
    expect(r.error).toBeUndefined()
    expect(r.items).toEqual([
      { course: 'Nutrição esportiva aplicada', institution: 'Universidade Y', year: 2023 },
      { course: 'Coaching em saúde', institution: 'Instituto X', year: 2019 },
    ])
    expect(parseCredentials(credentialsText(r.items), 2026).items).toEqual(r.items)
  })
  it('recusa linha incompleta ou ano inválido', () => {
    expect(parseCredentials('Curso sem instituição | 2020', 2026).error).toMatch(/Linha 1/)
    expect(parseCredentials('Curso | Escola | 1890', 2026).error).toMatch(/ano inválido/)
    expect(parseCredentials('Curso | Escola | 2030', 2026).error).toMatch(/ano inválido/)
    expect(parseCredentials('', 2026)).toEqual({ items: [] })
  })
})
