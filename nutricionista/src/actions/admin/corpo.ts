'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { assertPatientAccess } from '@/lib/team-access'
import { audit } from '@/lib/audit'
import { failure, type ActionState } from '@/lib/action'
import { getSettings } from '@/lib/settings'
import { recordHeight } from '@/lib/corpo-server'
import { setPhotoComment } from '@/lib/photos'
import { notifyUser } from '@/lib/notify'
import { pushToUser } from '@/lib/push'
import { todayIn } from '@/lib/time'
import { day, optNum, uuid } from '@/lib/validation'

/** Parte 7, lado do coach: altura com histórico, comentário nas fotos do corpo e reação às fotos do prato. */

async function patientFor(patientId: string) {
  const user = await requireTeam('clinico')
  if (!uuid.safeParse(patientId).success) throw new Error('Cliente inválido.')
  await assertPatientAccess(user, patientId)
  const [p] = await db.select({ id: schema.patients.id, userId: schema.patients.userId }).from(schema.patients).where(eq(schema.patients.id, patientId))
  if (!p) throw new Error('Cliente não encontrado.')
  return { user, p }
}

export async function updatePatientHeight(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const h = optNum(100, 230).safeParse(fd.get('heightCm') ?? '')
  if (!h.success || h.data == null) return { fieldErrors: { heightCm: 'Informe a altura entre 100 e 230 cm' }, error: 'Altura inválida.' }
  try {
    const { user } = await patientFor(patientId)
    const s = await getSettings()
    const date = day.safeParse(fd.get('date') || todayIn(s.timezone))
    if (!date.success) return { fieldErrors: { date: 'Data inválida' }, error: 'Revise a data.' }
    await recordHeight(patientId, date.data, h.data, 'profissional', user.id)
    await audit(user, 'altura_registrada', 'paciente', { entityId: patientId, patientId, details: { origem: 'coach' } })
    revalidatePath(`/admin/pacientes/${patientId}`)
    return { ok: true, message: 'Altura registrada no histórico.' }
  } catch (err) {
    return failure(err)
  }
}

/** Comentário do coach num conjunto de fotos do corpo: o cliente vê no app (e recebe um aviso). */
export async function commentPhotoSet(patientId: string, date: string, _: ActionState, fd: FormData): Promise<ActionState> {
  if (!day.safeParse(date).success) return { error: 'Data inválida.' }
  const comment = String(fd.get('comment') ?? '').trim().slice(0, 1000) || null
  try {
    const { user, p } = await patientFor(patientId)
    const [has] = await db
      .select({ id: schema.progressPhotos.id })
      .from(schema.progressPhotos)
      .where(and(eq(schema.progressPhotos.patientId, patientId), eq(schema.progressPhotos.date, date)))
      .limit(1)
    if (!has) return { error: 'Não há fotos nesta data.' }
    await setPhotoComment(patientId, date, comment, user.id)
    if (comment && p.userId) {
      await notifyUser(p.userId, 'O coach comentou suas fotos', comment.slice(0, 80), '/paciente/evolucao#fotos')
      await pushToUser(p.userId, 'mensagens', { title: 'Comentário nas suas fotos', body: comment.slice(0, 90), url: '/paciente/evolucao#fotos' })
    }
    await audit(user, 'fotos_comentadas', 'foto', { patientId, details: { data: date } })
    revalidatePath(`/admin/pacientes/${patientId}`)
    return { ok: true, message: comment ? 'Comentário enviado ao cliente.' : 'Comentário removido.' }
  } catch (err) {
    return failure(err)
  }
}

const REACTIONS = ['otimo', 'bom', 'atencao'] as const

/** Reação rápida à foto do prato (Ótimo, Bom, Atenção); tocar de novo tira a reação. */
export async function reactDiaryEntry(patientId: string, entryId: string, reaction: string): Promise<void> {
  if (!uuid.safeParse(entryId).success) return
  const { user, p } = await patientFor(patientId)
  const value = (REACTIONS as readonly string[]).includes(reaction) ? (reaction as (typeof REACTIONS)[number]) : null
  const [entry] = await db
    .select({ id: schema.diaryEntries.id, meal: schema.diaryEntries.meal, current: schema.diaryEntries.professionalReaction })
    .from(schema.diaryEntries)
    .where(and(eq(schema.diaryEntries.id, entryId), eq(schema.diaryEntries.patientId, patientId)))
  if (!entry) return
  const next = entry.current === value ? null : value
  await db.update(schema.diaryEntries).set({ professionalReaction: next, commentedAt: new Date() }).where(eq(schema.diaryEntries.id, entry.id))
  if (next && p.userId) {
    const label = next === 'otimo' ? 'Ótimo' : next === 'bom' ? 'Bom' : 'Atenção'
    await notifyUser(p.userId, `O coach reagiu ao seu prato: ${label}`, entry.meal, '/paciente/diario')
  }
  await audit(user, 'diario_reacao', 'diario', { entityId: entryId, patientId, details: { reacao: next } })
  revalidatePath(`/admin/pacientes/${patientId}`)
}
