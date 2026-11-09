import 'server-only'
import { and, desc, eq, lte } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { todayIn } from '@/lib/time'

/** Conteúdos visíveis no site: publicados e com data até hoje, do mais novo ao mais antigo. */
export async function visiblePosts(limit?: number) {
  const s = await getSettings()
  const q = db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.status, 'publicado'), lte(schema.posts.publishedOn, todayIn(s.timezone))))
    .orderBy(desc(schema.posts.publishedOn), desc(schema.posts.createdAt))
  return limit ? q.limit(limit) : q
}

export async function postBySlug(slug: string) {
  const [p] = await db.select().from(schema.posts).where(eq(schema.posts.slug, slug))
  return p ?? null
}
