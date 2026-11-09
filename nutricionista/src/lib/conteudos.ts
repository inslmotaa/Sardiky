/**
 * Regras dos Conteúdos (blog), puras e testadas em tests/unit/conteudos.test.ts.
 * Um post aparece no site (e no sitemap) só se estiver "publicado" e com data de hoje ou passada.
 */

export type PostStatus = 'rascunho' | 'publicado'
export const POST_STATUS: Record<PostStatus, string> = { rascunho: 'Rascunho', publicado: 'Publicado' }

/** "Café da manhã: 5 ideias!" → "cafe-da-manha-5-ideias" (sem acento, até 80 caracteres). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Visível no site: publicado e com data de publicação até hoje (no fuso do site). */
export const postVisivel = (p: { status: string; publishedOn: string }, today: string) => p.status === 'publicado' && p.publishedOn <= today

/** "2026-11-09" → "9 de novembro de 2026". */
export function dataPost(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${d} de ${meses[m - 1]} de ${y}`
}
