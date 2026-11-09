import { describe, expect, it } from 'vitest'
import { assinatura, fotosPublicas, iniciais, podePublicar, type TestimonialRules } from '@/lib/depoimentos'

const base: TestimonialRules = {
  text: 'Mudou minha rotina.',
  published: true,
  authorizedAt: new Date('2026-11-01'),
  authorizationMethod: 'app',
  beforeFileId: null,
  afterFileId: null,
  photosAuthorizedAt: null,
  photosAuthorizationMethod: null,
}

describe('depoimentos', () => {
  it('só publica com autorização registrada (data e forma) e texto', () => {
    expect(podePublicar(base)).toBe(true)
    expect(podePublicar({ ...base, authorizedAt: null })).toBe(false)
    expect(podePublicar({ ...base, authorizationMethod: null })).toBe(false)
    expect(podePublicar({ ...base, text: '  ' })).toBe(false)
  })
  it('fotos de antes e depois nunca por padrão: exigem autorização específica e o depoimento publicado', () => {
    const fotos = { ...base, beforeFileId: 'a', afterFileId: 'b' }
    expect(fotosPublicas(fotos)).toBe(false)
    expect(fotosPublicas({ ...fotos, photosAuthorizedAt: new Date(), photosAuthorizationMethod: 'escrita' })).toBe(true)
    expect(fotosPublicas({ ...fotos, photosAuthorizedAt: new Date(), photosAuthorizationMethod: 'escrita', published: false })).toBe(false)
    expect(fotosPublicas({ ...fotos, photosAuthorizedAt: new Date(), photosAuthorizationMethod: null })).toBe(false)
  })
  it('assinatura com iniciais (padrão) ou primeiro nome', () => {
    expect(iniciais('Beatriz de Souza Exemplo')).toBe('B. S. E.')
    expect(assinatura('Beatriz de Souza Exemplo', 'iniciais')).toBe('B. S. E.')
    expect(assinatura('Beatriz de Souza Exemplo', 'nome')).toBe('Beatriz E.')
    expect(assinatura('Lucas', 'nome')).toBe('Lucas')
  })
})
