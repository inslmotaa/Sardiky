import { describe, expect, it } from 'vitest'
import { emailLink, instagramLink } from '@/lib/social'

describe('links sociais só com valores reais', () => {
  it('Instagram: @usuario, usuario ou URL viram o link certo; vazio ou só o domínio não', () => {
    expect(instagramLink('@andre.farion')).toEqual({ url: 'https://www.instagram.com/andre.farion/', handle: 'andre.farion' })
    expect(instagramLink('https://instagram.com/andrefarion/?hl=pt')).toEqual({ url: 'https://www.instagram.com/andrefarion/', handle: 'andrefarion' })
    expect(instagramLink('instagram.com/andre_farion')?.handle).toBe('andre_farion')
    for (const bad of ['', null, 'https://instagram.com/', 'https://www.instagram.com', 'PREENCHER: ex. @andrefarion', '@', 'com espaço']) expect(instagramLink(bad)).toBeNull()
  })
  it('e-mail: só com formato válido', () => {
    expect(emailLink('contato@farion.com.br')).toEqual({ url: 'mailto:contato@farion.com.br', email: 'contato@farion.com.br' })
    for (const bad of ['', null, 'contato@', 'PREENCHER', 'a@b']) expect(emailLink(bad)).toBeNull()
  })
})
