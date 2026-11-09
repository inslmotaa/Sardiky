import type { MetadataRoute } from 'next'
import { and, desc, eq, lte } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { todayIn } from '@/lib/time'
import { PUBLIC_PAGES, siteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

/** sitemap.xml: páginas públicas e os Conteúdos publicados (nunca rascunhos nem posts agendados). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const s = await getSettings()
  const posts = await db
    .select({ slug: schema.posts.slug, updatedAt: schema.posts.updatedAt, publishedOn: schema.posts.publishedOn })
    .from(schema.posts)
    .where(and(eq(schema.posts.status, 'publicado'), lte(schema.posts.publishedOn, todayIn(s.timezone))))
    .orderBy(desc(schema.posts.publishedOn))
  const pages: MetadataRoute.Sitemap = PUBLIC_PAGES.map((p) => ({
    url: `${base}${p.path === '/' ? '' : p.path}`,
    lastModified: p.path === '/conteudos' && posts[0] ? posts[0].updatedAt : s.updatedAt,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }))
  return [
    ...pages,
    ...posts.map((p) => ({ url: `${base}/conteudos/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ]
}
