import type { Metadata } from 'next'

/**
 * SEO do site público: endereço base, metadados por página (título, descrição, canonical,
 * Open Graph e Twitter Card) e o que fica fora do índice.
 */

/** Endereço público do site (APP_URL), sem barra no fim. */
export function siteUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}

/** Áreas privadas e rotas de autenticação: fora do índice (robots.txt e meta robots). */
export const NO_INDEX_PATHS = [
  '/admin',
  '/painel',
  '/paciente',
  '/app',
  '/login',
  '/entrar',
  '/criar-conta',
  '/recuperar-senha',
  '/redefinir-senha',
  '/nova-senha',
  '/confirmar-email',
  '/agendar/confirmado',
  '/api/',
] as const

/** Páginas públicas fixas do site (entram no sitemap). */
export const PUBLIC_PAGES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/sobre', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/como-funciona', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/planos', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/conteudos', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/duvidas', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/agendar', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/privacidade', priority: 0.2, changeFrequency: 'yearly' },
]

/** Imagem padrão de compartilhamento (1200×630). */
export const DEFAULT_OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'André Farion, Coach: alimentação, rotina e bem-estar, com atendimento on-line',
}

/** Corta um texto em até `max` caracteres sem quebrar palavra (para meta description). */
export function clip(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '')}…`
}

/**
 * Metadados de uma página pública: título próprio, descrição, canonical e os mesmos dados
 * no Open Graph (WhatsApp, Instagram, Facebook) e no Twitter Card. A imagem vem do
 * opengraph-image gerado na raiz (ou da capa, quando houver).
 */
export function pageMeta(o: {
  title: string
  description: string
  path: string
  /** Título já completo (sem o sufixo " · Farion"). */
  absolute?: boolean
  type?: 'website' | 'article'
  image?: { url: string; alt: string }
  publishedTime?: string
  siteName?: string
}): Metadata {
  const description = clip(o.description)
  // Sem capa própria, usa a imagem gerada na identidade verde (src/app/opengraph-image.tsx).
  // Precisa vir explícita: o openGraph da página substitui o do layout, inclusive a imagem.
  const images = o.image ? [{ url: o.image.url, alt: o.image.alt }] : [{ ...DEFAULT_OG_IMAGE }]
  const twitterImages = o.image ? images : [{ ...DEFAULT_OG_IMAGE, url: '/twitter-image' }]
  return {
    title: o.absolute ? { absolute: o.title } : o.title,
    description,
    alternates: { canonical: o.path },
    openGraph: {
      title: o.title,
      description,
      url: o.path,
      type: o.type ?? 'website',
      locale: 'pt_BR',
      ...(o.siteName ? { siteName: o.siteName } : {}),
      images,
      ...(o.publishedTime ? { publishedTime: o.publishedTime } : {}),
    },
    twitter: { card: 'summary_large_image', title: o.title, description, images: twitterImages },
  }
}

/** Página fora do índice (área do cliente, painel, autenticação). */
export const noIndex: Metadata['robots'] = { index: false, follow: false }
