'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { failure, formObject, zodErrors, type ActionState } from '@/lib/action'
import { IMAGE_TYPES, saveUpload } from '@/lib/storage'
import { getSettings } from '@/lib/settings'
import { todayIn } from '@/lib/time'
import { day, int, str, uuid } from '@/lib/validation'
import { fotosPublicas, podePublicar } from '@/lib/depoimentos'

/**
 * Depoimentos no painel (permissão "site"). Nada vai ao site sem autorização registrada (data e forma)
 * e aprovação do coach; fotos de antes e depois exigem uma autorização específica, separada.
 */
function refresh() {
  revalidatePath('/')
  revalidatePath('/admin/configuracoes')
}

/** As fotos ficam públicas (servidas sem login) só enquanto o depoimento puder mostrá-las. */
async function syncPhotoVisibility(id: string) {
  const [t] = await db.select().from(schema.testimonials).where(eq(schema.testimonials.id, id))
  if (!t) return
  const ids = [t.beforeFileId, t.afterFileId].filter((x): x is string => Boolean(x))
  if (ids.length) await db.update(schema.files).set({ isPublic: fotosPublicas(t) }).where(inArray(schema.files.id, ids))
}

export async function approveTestimonial(id: string): Promise<void> {
  const user = await requireTeam('site')
  if (!uuid.safeParse(id).success) return
  const [t] = await db.select().from(schema.testimonials).where(eq(schema.testimonials.id, id))
  if (!t || !podePublicar(t)) return // sem autorização registrada, nunca publica
  await db.update(schema.testimonials).set({ published: true, approvedBy: user.id, approvedAt: new Date() }).where(eq(schema.testimonials.id, id))
  await syncPhotoVisibility(id)
  await audit(user, 'depoimento_aprovado', 'depoimento', { entityId: id, patientId: t.patientId })
  refresh()
}

export async function hideTestimonial(id: string): Promise<void> {
  const user = await requireTeam('site')
  if (!uuid.safeParse(id).success) return
  await db.update(schema.testimonials).set({ published: false }).where(eq(schema.testimonials.id, id))
  await syncPhotoVisibility(id)
  await audit(user, 'depoimento_ocultado', 'depoimento', { entityId: id })
  refresh()
}

export async function deleteTestimonial(id: string): Promise<void> {
  const user = await requireTeam('site')
  if (!uuid.safeParse(id).success) return
  const [t] = await db.delete(schema.testimonials).where(eq(schema.testimonials.id, id)).returning()
  if (t) {
    const ids = [t.beforeFileId, t.afterFileId].filter((x): x is string => Boolean(x))
    if (ids.length) await db.update(schema.files).set({ isPublic: false }).where(inArray(schema.files.id, ids))
  }
  await audit(user, 'depoimento_excluido', 'depoimento', { entityId: id })
  refresh()
}

const authMethod = z.enum(['escrita', 'email', 'whatsapp'], 'Escolha a forma da autorização')

/** Depoimento recebido fora do app (por escrito, e-mail ou WhatsApp): exige a data e a forma da autorização. */
export async function createTestimonial(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      authorDisplay: str(80, 'Informe o nome ou as iniciais'),
      text: str(1000, 'Escreva o depoimento'),
      rating: z.union([z.literal(''), int(1, 5)]).optional(),
      authorizedAt: day,
      authorizationMethod: authMethod,
      publish: z.literal('on').optional(),
    })
    .safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  try {
    const user = await requireTeam('site')
    const s = await getSettings()
    if (d.authorizedAt > todayIn(s.timezone)) return { fieldErrors: { authorizedAt: 'Data no futuro' }, error: 'A data da autorização não pode estar no futuro.' }
    const publish = d.publish === 'on'
    const [t] = await db
      .insert(schema.testimonials)
      .values({
        authorDisplay: d.authorDisplay,
        text: d.text,
        rating: d.rating ? Number(d.rating) : null,
        date: todayIn(s.timezone),
        authorizedAt: new Date(`${d.authorizedAt}T12:00:00Z`),
        authorizationMethod: d.authorizationMethod,
        published: publish,
        ...(publish ? { approvedBy: user.id, approvedAt: new Date() } : {}),
      })
      .returning({ id: schema.testimonials.id })
    await audit(user, 'depoimento_criado', 'depoimento', { entityId: t.id, details: { forma: d.authorizationMethod, publicado: publish } })
    refresh()
    return { ok: true, message: publish ? 'Depoimento publicado.' : 'Depoimento salvo (ainda não publicado).' }
  } catch (err) {
    return failure(err)
  }
}

/**
 * Fotos de antes e depois de um depoimento: só com a autorização específica para as fotos
 * (marcada aqui, com data e forma). Sem ela, nada é gravado.
 */
export async function saveTestimonialPhotos(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      photosAuthorizedAt: day,
      photosAuthorizationMethod: authMethod,
      confirm: z.literal('on', { error: 'Confirme a autorização específica para as fotos' }),
    })
    .safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const before = fd.get('before')
  const after = fd.get('after')
  if (!(before instanceof File) || before.size === 0 || !(after instanceof File) || after.size === 0)
    return { fieldErrors: { before: 'Envie as duas fotos' }, error: 'Envie a foto de antes e a de depois.' }
  try {
    const user = await requireTeam('site')
    if (!uuid.safeParse(id).success) return { error: 'Depoimento inválido.' }
    const [t] = await db.select().from(schema.testimonials).where(and(eq(schema.testimonials.id, id)))
    if (!t) return { error: 'Depoimento não encontrado.' }
    const ids: string[] = []
    for (const [label, file] of [
      ['antes', before],
      ['depois', after],
    ] as const) {
      const up = await saveUpload(file, IMAGE_TYPES)
      if ('error' in up) return { error: `Foto de ${label}: ${up.error}` }
      const [f] = await db
        .insert(schema.files)
        .values({ patientId: t.patientId, uploadedBy: user.id, kind: 'depoimento', title: `Depoimento · ${label}`, mime: up.mime, size: up.size, storageKey: up.key, isPublic: false })
        .returning({ id: schema.files.id })
      ids.push(f.id)
    }
    await db
      .update(schema.testimonials)
      .set({
        beforeFileId: ids[0],
        afterFileId: ids[1],
        photosAuthorizedAt: new Date(`${parsed.data.photosAuthorizedAt}T12:00:00Z`),
        photosAuthorizationMethod: parsed.data.photosAuthorizationMethod,
      })
      .where(eq(schema.testimonials.id, id))
    await syncPhotoVisibility(id)
    await audit(user, 'depoimento_fotos_autorizadas', 'depoimento', { entityId: id, patientId: t.patientId, details: { forma: parsed.data.photosAuthorizationMethod } })
    refresh()
    return { ok: true, message: 'Fotos salvas com a autorização registrada.' }
  } catch (err) {
    return failure(err)
  }
}

/** Remove as fotos (e a autorização das fotos) de um depoimento. */
export async function removeTestimonialPhotos(id: string): Promise<void> {
  const user = await requireTeam('site')
  if (!uuid.safeParse(id).success) return
  const [t] = await db.select().from(schema.testimonials).where(eq(schema.testimonials.id, id))
  if (!t) return
  const ids = [t.beforeFileId, t.afterFileId].filter((x): x is string => Boolean(x))
  await db
    .update(schema.testimonials)
    .set({ beforeFileId: null, afterFileId: null, photosAuthorizedAt: null, photosAuthorizationMethod: null })
    .where(eq(schema.testimonials.id, id))
  if (ids.length) await db.update(schema.files).set({ isPublic: false }).where(inArray(schema.files.id, ids))
  await audit(user, 'depoimento_fotos_removidas', 'depoimento', { entityId: id })
  refresh()
}
