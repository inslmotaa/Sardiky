import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown, plainText, readingMinutes, safeHref } from '@/lib/markdown'
import { dataPost, postVisivel, SLUG, slugify } from '@/lib/conteudos'
import { cleanPath, cleanReferrer, originFromForm, originLabel, utmFromSearch } from '@/lib/utm'
import { activePixels, GOOGLE_TAG_ID, isPublicSitePath, META_PIXEL_ID } from '@/lib/pixels'
import { aboutLd, faqLd, homeLd, ldJson, postLd, serviceLd } from '@/lib/jsonld'
import { clip, NO_INDEX_PATHS, pageMeta, PUBLIC_PAGES } from '@/lib/seo'

/** Parte 3: SEO, Conteúdos (blog) e captação. */

describe('Markdown dos Conteúdos', () => {
  it('títulos, parágrafos, listas, citação e linha', () => {
    const b = parseMarkdown('# Grande\n\n## Seção\n### Sub\n\nUm parágrafo\nque continua.\n\n- a\n- b\n\n1. um\n2. dois\n\n> citação\n\n---')
    expect(b.map((x) => x.t)).toEqual(['h2', 'h2', 'h3', 'p', 'ul', 'ol', 'quote', 'hr'])
    expect(b[3]).toEqual({ t: 'p', c: [{ t: 'text', v: 'Um parágrafo que continua.' }] })
    expect(b[4]).toMatchObject({ t: 'ul', items: [[{ t: 'text', v: 'a' }], [{ t: 'text', v: 'b' }]] })
  })

  it('negrito, itálico, código e links seguros', () => {
    expect(parseInline('**forte** e *leve* e `x<y`')).toEqual([
      { t: 'strong', c: [{ t: 'text', v: 'forte' }] },
      { t: 'text', v: ' e ' },
      { t: 'em', c: [{ t: 'text', v: 'leve' }] },
      { t: 'text', v: ' e ' },
      { t: 'code', v: 'x<y' },
    ])
    expect(parseInline('[planos](/planos)')).toEqual([{ t: 'link', href: '/planos', external: false, c: [{ t: 'text', v: 'planos' }] }])
    expect(parseInline('[site](https://exemplo.com.br/a)')[0]).toMatchObject({ t: 'link', href: 'https://exemplo.com.br/a', external: true })
    // "_" no meio de palavra não vira itálico.
    expect(parseInline('nome_com_sublinhado')).toEqual([{ t: 'text', v: 'nome_com_sublinhado' }])
  })

  it('HTML e links perigosos viram texto', () => {
    expect(parseInline('<script>alert(1)</script>')).toEqual([{ t: 'text', v: '<script>alert(1)</script>' }])
    expect(parseInline('[clique](javascript:alert(1))')).toEqual([{ t: 'text', v: 'clique' }, { t: 'text', v: ')' }])
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('data:text/html,oi')).toBeNull()
    expect(safeHref('//evil.com')).toBeNull()
    expect(safeHref('mailto:oi@exemplo.com')).toEqual({ href: 'mailto:oi@exemplo.com', external: false })
    expect(safeHref('#secao')).toEqual({ href: '#secao', external: false })
  })

  it('texto puro e tempo de leitura', () => {
    expect(plainText('## Olá\n\n**Mundo** [link](/x)')).toBe('Olá Mundo link')
    expect(readingMinutes('palavra '.repeat(10))).toBe(1)
    expect(readingMinutes('palavra '.repeat(1000))).toBe(5)
  })
})

describe('Conteúdos: endereço e publicação', () => {
  it('slug sem acento e só com hífens', () => {
    expect(slugify('Café da manhã: 5 ideias rápidas!')).toBe('cafe-da-manha-5-ideias-rapidas')
    expect(slugify('  Arroz & Feijão  ')).toBe('arroz-e-feijao')
    expect(slugify('!!!')).toBe('')
    expect(slugify('a'.repeat(100)).length).toBe(80)
    expect(SLUG.test('cafe-da-manha')).toBe(true)
    expect(SLUG.test('Cafe')).toBe(false)
    expect(SLUG.test('a--b')).toBe(false)
  })

  it('visível só publicado e com data até hoje', () => {
    expect(postVisivel({ status: 'publicado', publishedOn: '2026-11-09' }, '2026-11-09')).toBe(true)
    expect(postVisivel({ status: 'publicado', publishedOn: '2026-11-10' }, '2026-11-09')).toBe(false)
    expect(postVisivel({ status: 'rascunho', publishedOn: '2026-01-01' }, '2026-11-09')).toBe(false)
    expect(dataPost('2026-11-09')).toBe('9 de novembro de 2026')
  })
})

describe('Origem dos interessados (UTM)', () => {
  it('lê e limpa os utm_*', () => {
    expect(utmFromSearch('?utm_source=instagram&utm_medium=bio&x=1&utm_campaign=%3Cb%3Enov')).toEqual({ utm_source: 'instagram', utm_medium: 'bio', utm_campaign: 'bnov' })
    expect(utmFromSearch('')).toEqual({})
  })

  it('página de entrada sem query e só o domínio de quem indicou', () => {
    expect(cleanPath('/conteudos/x?utm_source=a#topo')).toBe('/conteudos/x')
    expect(cleanPath('https://evil.com')).toBeNull()
    expect(cleanPath('//evil.com')).toBeNull()
    expect(cleanReferrer('https://l.instagram.com/?u=https%3A%2F%2Fsite&e=AT0', 'farion.com.br')).toBe('l.instagram.com')
    expect(cleanReferrer('https://farion.com.br/sobre', 'farion.com.br')).toBeNull()
    expect(cleanReferrer('javascript:alert(1)')).toBeNull()
  })

  it('monta a origem do formulário e o resumo do painel', () => {
    const o = originFromForm({ utm_source: ' instagram ', utm_medium: 'stories', utm_campaign: 'x'.repeat(300), landing_path: '/?utm_source=instagram', referrer: 'https://www.google.com/' })
    expect(o.utmSource).toBe('instagram')
    expect(o.utmCampaign).toHaveLength(100)
    expect(o.landingPath).toBe('/')
    expect(o.referrer).toBe('www.google.com')
    expect(originLabel({ utmSource: 'instagram', utmMedium: 'stories', utmCampaign: 'nov', referrer: null })).toBe('instagram / stories · campanha nov')
    expect(originLabel({ utmSource: null, utmMedium: null, utmCampaign: null, referrer: 'www.google.com' })).toBe('via www.google.com')
    expect(originLabel({ utmSource: null, utmMedium: null, utmCampaign: null, referrer: null })).toBeNull()
  })
})

describe('Pixels (Meta e Google) com consentimento', () => {
  it('validação dos IDs', () => {
    expect(META_PIXEL_ID.test('123456789012345')).toBe(true)
    expect(META_PIXEL_ID.test('12345abc')).toBe(false)
    expect(GOOGLE_TAG_ID.test('G-ABC123XYZ')).toBe(true)
    expect(GOOGLE_TAG_ID.test('AW-123456789')).toBe(true)
    expect(GOOGLE_TAG_ID.test('UA-1234-1')).toBe(false)
    expect(GOOGLE_TAG_ID.test('G-<script>')).toBe(false)
  })

  it('desligados por padrão; ligados só com ID válido', () => {
    expect(activePixels({ pixelsEnabled: false, metaPixelId: '123456789012345', googleTagId: 'G-ABC1234' })).toBeNull()
    expect(activePixels({ pixelsEnabled: true, metaPixelId: '', googleTagId: '' })).toBeNull()
    expect(activePixels({ pixelsEnabled: true, metaPixelId: 'abc', googleTagId: 'g-abc1234' })).toEqual({ meta: null, google: 'G-ABC1234' })
  })

  it('só nas páginas públicas', () => {
    for (const p of ['/', '/sobre', '/planos/', '/conteudos', '/conteudos/cafe-da-manha', '/privacidade?x=1']) expect(isPublicSitePath(p)).toBe(true)
    for (const p of ['/login', '/paciente', '/admin/conteudos', '/criar-conta', '/conteudos/a/b', '/api/health']) expect(isPublicSitePath(p)).toBe(false)
  })
})

const S = {
  siteName: 'Farion',
  professionalName: 'André Farion',
  professionalTitle: 'Coach',
  bio: 'Acompanhamento individual.',
  specialties: ['Emagrecimento'],
  whatsapp: '5511999990000',
  instagram: '@andre.farion',
  photoFileId: null,
}
const BASE = 'https://farion.com.br'

describe('Dados estruturados (JSON-LD)', () => {
  it('pessoa e serviço com título Coach, on-line, WhatsApp e Instagram', () => {
    const g = homeLd(S, BASE)['@graph'] as Record<string, unknown>[]
    const person = g.find((x) => x['@type'] === 'Person')!
    const service = g.find((x) => x['@type'] === 'ProfessionalService')!
    expect(person).toMatchObject({ name: 'André Farion', jobTitle: 'Coach', sameAs: ['https://www.instagram.com/andre.farion/'] })
    expect(service).toMatchObject({ telephone: '+5511999990000', areaServed: { '@type': 'Country', name: 'Brasil' }, sameAs: ['https://www.instagram.com/andre.farion/'] })
    expect(JSON.stringify(service)).toContain('Atendimento on-line')
    expect(JSON.stringify(g)).not.toMatch(/nutricionista|\bc\s*r\s*n\b|registro\s+profissional/i)
    expect(aboutLd(S, BASE)).toMatchObject({ '@type': 'ProfilePage', mainEntity: { '@type': 'Person' } })
  })

  it('sem WhatsApp e Instagram reais, eles ficam de fora', () => {
    const svc = serviceLd({ ...S, whatsapp: '', instagram: 'https://instagram.com/' }, BASE)
    expect(svc).not.toHaveProperty('telephone')
    expect(svc).not.toHaveProperty('sameAs')
  })

  it('FAQPage a partir das dúvidas; vazio → nada', () => {
    const f = faqLd([{ question: 'Como funciona?', answer: 'On-line.' }], BASE)!
    expect(f).toMatchObject({ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Como funciona?', acceptedAnswer: { '@type': 'Answer', text: 'On-line.' } }] })
    expect(faqLd([], BASE)).toBeNull()
  })

  it('post (BlogPosting) e JSON seguro dentro de <script>', () => {
    const p = postLd({ slug: 'x', title: 'T', summary: 'R', publishedOn: '2026-11-01', updatedAt: new Date('2026-11-02T00:00:00Z'), coverFileId: null }, S, BASE)
    expect(p).toMatchObject({ '@type': 'BlogPosting', headline: 'T', datePublished: '2026-11-01', url: `${BASE}/conteudos/x`, author: { jobTitle: 'Coach' } })
    expect(ldJson({ a: '</script><script>alert(1)</script>' })).not.toContain('</script>')
  })
})

describe('Metadados por página', () => {
  it('canonical, Open Graph em pt_BR e Twitter Card com imagem', () => {
    const m = pageMeta({ title: 'Sobre', description: 'Texto', path: '/sobre', siteName: 'Farion' })
    expect(m.alternates).toEqual({ canonical: '/sobre' })
    expect(m.openGraph).toMatchObject({ url: '/sobre', locale: 'pt_BR', siteName: 'Farion', images: [{ url: '/opengraph-image', width: 1200, height: 630 }] })
    expect(m.twitter).toMatchObject({ card: 'summary_large_image', images: [{ url: '/twitter-image' }] })
    const post = pageMeta({ title: 'P', description: 'd', path: '/conteudos/p', type: 'article', image: { url: '/arquivos/1', alt: 'capa' } })
    expect(post.openGraph).toMatchObject({ type: 'article', images: [{ url: '/arquivos/1', alt: 'capa' }] })
  })

  it('descrição até 160 caracteres sem cortar palavra', () => {
    const d = clip('palavra '.repeat(40))
    expect(d.length).toBeLessThanOrEqual(160)
    expect(d.endsWith('palavra…')).toBe(true)
    expect(clip('curta')).toBe('curta')
  })

  it('painel, área do cliente e autenticação fora do índice; páginas públicas no sitemap', () => {
    for (const p of ['/admin', '/painel', '/paciente', '/app', '/login', '/entrar', '/criar-conta', '/recuperar-senha', '/redefinir-senha', '/api/'])
      expect(NO_INDEX_PATHS).toContain(p)
    const paths = PUBLIC_PAGES.map((p) => p.path)
    expect(paths).toEqual(expect.arrayContaining(['/', '/sobre', '/como-funciona', '/planos', '/conteudos', '/duvidas']))
    for (const p of paths) expect(NO_INDEX_PATHS.some((n) => p.startsWith(n))).toBe(false)
  })
})
