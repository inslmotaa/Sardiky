import { describe, expect, it } from 'vitest'
import { pendenciasDoSite } from '../../scripts/pendencias.mjs'

const ok = {
  bio: 'Coach com 10 anos de experiência em acompanhamento.',
  method: 'Avaliação, plano e ajustes.',
  specialties: ['Emagrecimento'],
  differentials: ['Atendimento próximo'],
  contactEmail: 'contato@andrefarion.com.br',
  privacyContact: 'privacidade@andrefarion.com.br',
  instagram: 'https://www.instagram.com/andrefarion/',
  photoFileId: '00000000-0000-0000-0000-000000000001',
}

describe('pendências de conteúdo do site', () => {
  it('nada pendente com dados reais', () => expect(pendenciasDoSite(ok)).toEqual([]))

  it('lista biografia com PREENCHER, e-mail example.com, Instagram vazio, foto e "(Texto de exemplo — …)"', () => {
    const list = pendenciasDoSite({
      ...ok,
      bio: 'PREENCHER: 3 a 5 frases. (Texto de exemplo — ajuste em Configurações.)',
      contactEmail: 'contato@example.com',
      instagram: '',
      photoFileId: null,
    })
    expect(list.map((x) => x.campo)).toEqual(['bio', 'email', 'instagram', 'foto', 'sobre'])
    expect(list.every((x) => x.onde === 'perfil')).toBe(true)
  })

  it('texto de exemplo no método ou nos diferenciais também conta', () => {
    expect(pendenciasDoSite({ ...ok, differentials: ['(Texto de exemplo – troque)'] }).map((x) => x.campo)).toEqual(['sobre'])
    expect(pendenciasDoSite({ ...ok, privacyContact: 'dpo@example.com' }).map((x) => x.campo)).toEqual(['email'])
  })
})
