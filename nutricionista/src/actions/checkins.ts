'use server'

import { revalidatePath } from 'next/cache'
import { FOTOS_CORPO, hasConsent, setConsent } from '@/lib/corpo-server'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requirePatient, requireTeam } from '@/lib/auth/session'
import { accessExpired } from '@/lib/auth/patient-gate'
import { assertPatientAccess } from '@/lib/team-access'
import { audit } from '@/lib/audit'
import { failure, formObject, zodErrors, type ActionState } from '@/lib/action'
import { getSettings } from '@/lib/settings'
import { notifyTeam } from '@/lib/team'
import { pushToTeam } from '@/lib/push'
import { rateLimit } from '@/lib/rate-limit'
import { IMAGE_TYPES, saveUpload } from '@/lib/storage'
import { addDays, todayIn } from '@/lib/time'
import { day, int, optNum, optStr, uuid } from '@/lib/validation'
import { checkinState, nextDueDate } from '@/lib/checkin-rules'
import { scheduleCheckins } from '@/lib/checkins'

/* ------------------------------ coach ------------------------------ */

/** Frequência do check-in por cliente (ex.: a cada 15 dias, junto com os ajustes do plano). Vazio desliga. */
export async function setCheckinSchedule(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      every: z.union([z.literal(''), int(3, 90)]).optional(),
      firstDue: z.union([z.literal(''), day]).optional(),
    })
    .safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const every = parsed.data.every ? Number(parsed.data.every) : null
  try {
    const user = await requireTeam('clinico')
    if (!uuid.safeParse(patientId).success) return { error: 'Cliente inválido.' }
    await assertPatientAccess(user, patientId)
    const s = await getSettings()
    const today = todayIn(s.timezone)
    const firstDue = every ? parsed.data.firstDue || addDays(today, every) : null
    if (firstDue && firstDue < today) return { fieldErrors: { firstDue: 'Data no passado' }, error: 'O primeiro check-in precisa ser hoje ou depois.' }
    await scheduleCheckins(patientId, every, firstDue)
    await audit(user, 'checkin_agendado', 'paciente', { entityId: patientId, patientId, details: { aCadaDias: every, primeiro: firstDue } })
    revalidatePath(`/admin/pacientes/${patientId}`)
    return { ok: true, message: every ? `Check-in a cada ${every} dias; o próximo vence em ${firstDue!.split('-').reverse().join('/')}.` : 'Check-ins desligados para este cliente.' }
  } catch (err) {
    return failure(err)
  }
}

/** O coach marca o check-in como visto, com um comentário opcional que o cliente lê no app. */
export async function reviewCheckin(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const note = z.object({ coachNote: optStr(1000) }).safeParse(formObject(fd))
  if (!note.success) return zodErrors(note.error)
  try {
    const user = await requireTeam('clinico')
    if (!uuid.safeParse(id).success) return { error: 'Check-in inválido.' }
    const [c] = await db.select().from(schema.checkins).where(eq(schema.checkins.id, id))
    if (!c || c.status !== 'enviado') return { error: 'Check-in não encontrado.' }
    await assertPatientAccess(user, c.patientId)
    await db
      .update(schema.checkins)
      .set({ reviewedAt: new Date(), reviewedBy: user.id, coachNote: note.data.coachNote ?? null })
      .where(eq(schema.checkins.id, id))
    await audit(user, 'checkin_revisado', 'paciente', { entityId: id, patientId: c.patientId })
    revalidatePath(`/admin/pacientes/${c.patientId}`)
    revalidatePath('/admin/acompanhamento')
    return { ok: true, message: 'Check-in marcado como visto.' }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------------ cliente ------------------------------ */

const scale = z.union([z.literal(''), int(1, 5)]).optional().transform((v) => (v ? Number(v) : undefined))
const checkinSchema = z.object({
  adesao: scale,
  energia: scale,
  fome: scale,
  sono: scale,
  treinos: z.union([z.literal(''), int(0, 21)]).optional().transform((v) => (v === '' || v == null ? undefined : Number(v))),
  dificuldades: optStr(1000),
  comentario: optStr(1000),
  weightKg: optNum(20, 400),
  waistCm: optNum(30, 250),
  hipCm: optNum(30, 250),
  abdomenCm: optNum(30, 250),
})

/**
 * Envia o check-in pendente: questionário, peso e medidas (que entram nos gráficos como "informadas
 * por você") e até 3 fotos opcionais, privadas (só o cliente e o coach veem). Agenda o próximo.
 */
export async function submitCheckin(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  if (await accessExpired(user.patientId)) return { error: 'Seu plano terminou. Renove para voltar a registrar.' }
  const parsed = checkinSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  if (!d.adesao) return { fieldErrors: { adesao: 'Escolha de 1 a 5' }, error: 'Diga quanto você seguiu o plano.' }
  const photos = fd.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  if (photos.length > 3) return { fieldErrors: { photos: 'Até 3 fotos' }, error: 'Envie no máximo 3 fotos.' }
  try {
    const id = String(fd.get('checkinId') ?? '')
    if (!uuid.safeParse(id).success) return { error: 'Check-in inválido.' }
    const s = await getSettings()
    const today = todayIn(s.timezone)
    const [c] = await db.select().from(schema.checkins).where(and(eq(schema.checkins.id, id), eq(schema.checkins.patientId, user.patientId)))
    if (!c) return { error: 'Check-in não encontrado.' }
    const state = checkinState(c, today)
    if (state === 'enviado') return { error: 'Este check-in já foi enviado.' }
    if (state === 'aguardando') return { error: 'Este check-in ainda não abriu.' }
    if (photos.length && !rateLimit(`upload:${user.id}`, 30, 3_600_000)) return { error: 'Limite de envios atingido. Tente mais tarde.' }
    // Fotos do corpo só com o consentimento específico (tipo fotos_corpo), dado aqui mesmo ou antes.
    if (photos.length && !(await hasConsent(user.patientId, FOTOS_CORPO))) {
      if (fd.get('consentFotos') !== 'on')
        return { fieldErrors: { photos: 'Autorize o envio de fotos do corpo' }, error: 'Para enviar fotos do corpo, marque a autorização logo abaixo das fotos.' }
      await setConsent(user.id, user.patientId, FOTOS_CORPO, true)
      await audit(user, 'consentimento_fotos_corpo', 'consentimento', { patientId: user.patientId })
    }

    // Fotos privadas: arquivos do próprio cliente, nunca públicos.
    const photoIds: string[] = []
    for (const [i, photo] of photos.entries()) {
      const saved = await saveUpload(photo, IMAGE_TYPES)
      if ('error' in saved) return { fieldErrors: { photos: saved.error! }, error: `Foto ${i + 1}: ${saved.error}` }
      const [f] = await db
        .insert(schema.files)
        .values({ patientId: user.patientId, uploadedBy: user.id, kind: 'checkin', title: `Check-in ${c.dueDate} · foto ${i + 1}`, mime: saved.mime, size: saved.size, storageKey: saved.key, visibleToPatient: true, isPublic: false })
        .returning({ id: schema.files.id })
      photoIds.push(f.id)
    }

    const [p] = await db.select({ every: schema.patients.checkinEveryDays, name: schema.patients.fullName }).from(schema.patients).where(eq(schema.patients.id, user.patientId))
    await db.transaction(async (tx) => {
      let measurementId: string | null = null
      if (d.weightKg != null || d.waistCm != null || d.hipCm != null || d.abdomenCm != null) {
        const [m] = await tx
          .insert(schema.measurements)
          .values({ patientId: user.patientId, date: today, source: 'paciente', weightKg: d.weightKg, waistCm: d.waistCm, hipCm: d.hipCm, abdomenCm: d.abdomenCm, notes: 'Check-in', createdBy: user.id })
          .returning({ id: schema.measurements.id })
        measurementId = m.id
      }
      await tx
        .update(schema.checkins)
        .set({
          status: 'enviado',
          submittedAt: new Date(),
          answers: { adesao: d.adesao, energia: d.energia, fome: d.fome, sono: d.sono, treinos: d.treinos, dificuldades: d.dificuldades ?? undefined, comentario: d.comentario ?? undefined },
          weightKg: d.weightKg,
          measures: { waistCm: d.waistCm ?? undefined, hipCm: d.hipCm ?? undefined, abdomenCm: d.abdomenCm ?? undefined },
          photoFileIds: photoIds,
          measurementId,
        })
        .where(eq(schema.checkins.id, c.id))
      // Próximo check-in na mesma cadência (se a frequência continua ligada).
      if (p?.every) {
        const next = nextDueDate(c.dueDate, p.every, today)
        await tx.insert(schema.checkins).values({ patientId: user.patientId, dueDate: next }).onConflictDoNothing()
        await tx.update(schema.patients).set({ nextCheckinDue: next }).where(eq(schema.patients.id, user.patientId))
      }
    })
    await audit(user, 'checkin_enviado', 'paciente', { entityId: c.id, patientId: user.patientId, details: { fotos: photoIds.length, atrasado: state === 'atrasado' } })
    await notifyTeam('clinico', 'Check-in recebido', `${p?.name ?? 'Cliente'} enviou o check-in`, `/admin/pacientes/${user.patientId}?aba=checkins`, user.patientId)
    await pushToTeam('clinico', { title: 'Check-in recebido', body: `${p?.name ?? 'Cliente'} enviou o check-in`, url: `/admin/pacientes/${user.patientId}?aba=checkins` }, user.patientId)
    revalidatePath('/paciente')
  } catch (err) {
    return failure(err)
  }
  // O formulário some depois do envio (o próximo prazo ainda não abriu): a confirmação vem na página.
  redirect('/paciente/checkin?enviado=1')
}
