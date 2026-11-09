'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { failure, formObject, zodErrors, type ActionState } from '@/lib/action'
import { IMAGE_TYPES, saveUpload } from '@/lib/storage'
import { checkbox, day, optStr, str, uuid } from '@/lib/validation'
import { SLUG, slugify } from '@/lib/conteudos'

/**
 * Conteúdos (blog) no painel (permissão "site"): título, resumo, capa, texto em Markdown,
 * rascunho/publicado e data. A capa só fica pública enquanto o post estiver publicado.
 */
const postSchema = z.object({
  title: str(160, 'Dê um título ao conteúdo'),
  slug: z
    .string()
    .trim()
    .max(80, 'Endereço muito longo')
    .optional()
    .transform((v) => v ?? '')
    .refine((v) => v === '' || SLUG.test(v), 'Use só letras minúsculas, números e hífens (ex.: cafe-da-manha)'),
  summary: optStr(300),
  body: z.string().max(40000, 'Texto muito longo').optional().transform((v) => (v ?? '').trim()),
  status: z.enum(['rascunho', 'publicado'], 'Escolha rascunho ou publicado'),
  publishedOn: day,
  coverAlt: optStr(200),
  removeCover: checkbox,
})

function refresh(slug?: string) {
  revalidatePath('/conteudos')
  if (slug) revalidatePath(`/conteudos/${slug}`)
  revalidatePath('/sitemap.xml')
  revalidatePath('/admin/conteudos')
}

export async function savePost(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = postSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  const slug = d.slug || slugify(d.title)
  if (!slug) return { fieldErrors: { slug: 'Informe o endereço' }, error: 'Não foi possível criar o endereço a partir do título. Preencha o campo Endereço.' }
  if (d.status === 'publicado' && !d.body) return { fieldErrors: { body: 'Escreva o texto' }, error: 'Para publicar, escreva o texto do conteúdo.' }
  let newId = id
  try {
    const user = await requireTeam('site')
    if (id && !uuid.safeParse(id).success) return { error: 'Conteúdo inválido.' }
    const [current] = id ? await db.select().from(schema.posts).where(eq(schema.posts.id, id)) : []
    if (id && !current) return { error: 'Conteúdo não encontrado.' }
    const [dup] = await db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(id ? and(eq(schema.posts.slug, slug), ne(schema.posts.id, id)) : eq(schema.posts.slug, slug))
    if (dup) return { fieldErrors: { slug: 'Endereço já usado' }, error: 'Já existe um conteúdo com este endereço. Mude o endereço.' }

    // Capa nova (imagem): fica pública só enquanto o post estiver publicado.
    let coverFileId: string | null | undefined
    const cover = fd.get('cover')
    if (cover instanceof File && cover.size > 0) {
      const saved = await saveUpload(cover, IMAGE_TYPES)
      if ('error' in saved) return { fieldErrors: { cover: saved.error! }, error: saved.error }
      const [f] = await db
        .insert(schema.files)
        .values({ uploadedBy: user.id, kind: 'conteudo', title: `Capa · ${d.title}`, mime: saved.mime, size: saved.size, storageKey: saved.key, isPublic: false })
        .returning({ id: schema.files.id })
      coverFileId = f.id
    } else if (d.removeCover) coverFileId = null

    const values = {
      slug,
      title: d.title,
      summary: d.summary ?? '',
      body: d.body,
      status: d.status,
      publishedOn: d.publishedOn,
      coverAlt: d.coverAlt ?? '',
      updatedAt: new Date(),
      ...(coverFileId !== undefined ? { coverFileId } : {}),
    }
    if (id) await db.update(schema.posts).set(values).where(eq(schema.posts.id, id))
    else [{ id: newId }] = await db.insert(schema.posts).values({ ...values, authorId: user.id }).returning({ id: schema.posts.id })

    // Visibilidade das capas: a atual acompanha o status; a anterior (trocada ou removida) deixa de ser pública.
    const finalCover = coverFileId !== undefined ? coverFileId : (current?.coverFileId ?? null)
    if (finalCover) await db.update(schema.files).set({ isPublic: d.status === 'publicado' }).where(eq(schema.files.id, finalCover))
    if (current?.coverFileId && current.coverFileId !== finalCover)
      await db.update(schema.files).set({ isPublic: false }).where(eq(schema.files.id, current.coverFileId))

    await audit(user, id ? 'conteudo_editado' : 'conteudo_criado', 'conteudo', { entityId: newId!, details: { status: d.status, slug } })
    refresh(slug)
    if (current && current.slug !== slug) refresh(current.slug)
  } catch (err) {
    return failure(err)
  }
  if (!id) redirect(`/admin/conteudos/${newId}?criado=1`)
  return { ok: true, message: d.status === 'publicado' ? 'Conteúdo salvo e publicado.' : 'Rascunho salvo (não aparece no site).' }
}

export async function deletePost(id: string): Promise<void> {
  const user = await requireTeam('site')
  if (!uuid.safeParse(id).success) return
  const [p] = await db.delete(schema.posts).where(eq(schema.posts.id, id)).returning()
  if (p?.coverFileId) await db.update(schema.files).set({ isPublic: false }).where(eq(schema.files.id, p.coverFileId))
  await audit(user, 'conteudo_excluido', 'conteudo', { entityId: id, details: { slug: p?.slug } })
  refresh(p?.slug)
  redirect('/admin/conteudos')
}
