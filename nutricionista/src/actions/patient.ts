'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { failure, formObject, UserError, zodErrors, type ActionState } from '@/lib/action'
import { parseAnswers } from '@/lib/forms'
import { notifyTeam } from '@/lib/team'
import { getSettings } from '@/lib/settings'
import { saveUpload, IMAGE_TYPES } from '@/lib/storage'
import { rateLimit } from '@/lib/rate-limit'
import { fmtDateTime, todayIn } from '@/lib/time'
import { day, int, optNum, optStr, str, time, uuid } from '@/lib/validation'

/* ------------------------------ diário ------------------------------ */

const diarySchema = z.object({
  date: day,
  time,
  meal: str(60, 'Escolha a refeição'),
  foods: str(1000, 'Descreva o que consumiu'),
  quantity: optStr(300),
  hunger: z.union([z.literal(''), int(1, 5)]).optional(),
  satiety: z.union([z.literal(''), int(1, 5)]).optional(),
  adherence: z.enum(['total', 'parcial', 'nao_seguiu']).optional().or(z.literal('')),
  notes: optStr(1000),
})

export async function addDiaryEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const parsed = diarySchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  if (d.date > todayIn()) return { fieldErrors: { date: 'Não é possível registrar datas futuras' }, error: 'Revise a data.' }
  try {
    let photoFileId: string | null = null
    const photo = fd.get('photo')
    if (photo instanceof File && photo.size > 0) {
      if (!rateLimit(`upload:${user.id}`, 30, 3_600_000)) throw new UserError('Limite de envios atingido. Tente mais tarde.')
      const saved = await saveUpload(photo, IMAGE_TYPES)
      if ('error' in saved) return { fieldErrors: { photo: saved.error! }, error: saved.error }
      const [f] = await db
        .insert(schema.files)
        .values({
          patientId: user.patientId,
          uploadedBy: user.id,
          kind: 'foto_refeicao',
          title: `Refeição ${d.meal} ${d.date}`,
          mime: saved.mime,
          size: saved.size,
          storageKey: saved.key,
          visibleToPatient: true,
        })
        .returning({ id: schema.files.id })
      photoFileId = f.id
    }
    await db.insert(schema.diaryEntries).values({
      patientId: user.patientId,
      date: d.date,
      time: d.time,
      meal: d.meal,
      foods: d.foods,
      quantity: d.quantity,
      hunger: d.hunger ? Number(d.hunger) : null,
      satiety: d.satiety ? Number(d.satiety) : null,
      adherence: d.adherence || null,
      notes: d.notes,
      photoFileId,
    })
    revalidatePath('/paciente/diario')
    return { ok: true, message: 'Registro salvo no seu diário.' }
  } catch (err) {
    return failure(err)
  }
}

export async function deleteDiaryEntry(id: string) {
  const user = await requirePatient()
  if (!uuid.safeParse(id).success) return
  // Só apaga registros do próprio paciente e ainda sem comentário do profissional.
  await db
    .delete(schema.diaryEntries)
    .where(and(eq(schema.diaryEntries.id, id), eq(schema.diaryEntries.patientId, user.patientId), isNull(schema.diaryEntries.professionalComment)))
  revalidatePath('/paciente/diario')
}

/* ------------------------- medidas informadas ------------------------- */

const selfMeasureSchema = z.object({
  date: day,
  weightKg: optNum(20, 400),
  waistCm: optNum(30, 250),
  hipCm: optNum(30, 250),
  notes: optStr(300),
})

export async function addSelfMeasurement(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const parsed = selfMeasureSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  if (d.date > todayIn()) return { fieldErrors: { date: 'Data futura' }, error: 'Revise a data.' }
  if (d.weightKg == null && d.waistCm == null && d.hipCm == null) return { error: 'Informe ao menos uma medida.' }
  try {
    await db.insert(schema.measurements).values({
      patientId: user.patientId,
      date: d.date,
      source: 'paciente', // nunca exibido como medição profissional
      weightKg: d.weightKg,
      waistCm: d.waistCm,
      hipCm: d.hipCm,
      notes: d.notes,
      createdBy: user.id,
    })
    revalidatePath('/paciente/evolucao')
    revalidatePath('/paciente')
    return { ok: true, message: 'Medida registrada como “informada por você”.' }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------------ mensagens ------------------------------ */

export async function sendPatientMessage(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const parsed = str(3000, 'Escreva sua mensagem').safeParse(fd.get('body'))
  if (!parsed.success) return { fieldErrors: { body: parsed.error.issues[0].message }, error: parsed.error.issues[0].message }
  if (!rateLimit(`msg:${user.id}`, 30, 3_600_000)) return { error: 'Muitas mensagens em pouco tempo. Aguarde um pouco.' }
  try {
    await db.insert(schema.messages).values({ patientId: user.patientId, senderId: user.id, fromPatient: true, body: parsed.data })
    await notifyTeam('clinico', 'Nova mensagem de paciente', user.name, `/admin/pacientes/${user.patientId}?aba=mensagens`)
    revalidatePath('/paciente/mensagens')
    return { ok: true, message: 'Mensagem enviada. O retorno acontece em horário de atendimento.' }
  } catch (err) {
    return failure(err)
  }
}

export async function markNotificationsRead() {
  const user = await requirePatient()
  await db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)))
  revalidatePath('/paciente')
}

/* ----------------------------- formulários ----------------------------- */

export async function submitForm(assignmentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  if (!uuid.safeParse(assignmentId).success) return { error: 'Formulário inválido.' }
  const [a] = await db
    .select()
    .from(schema.formAssignments)
    .where(and(eq(schema.formAssignments.id, assignmentId), eq(schema.formAssignments.patientId, user.patientId)))
  if (!a) return { error: 'Formulário não encontrado.' }
  if (a.answeredAt) return { error: 'Este formulário já foi enviado.' }
  const { answers, errors } = parseAnswers(a.fields, fd)
  if (Object.keys(errors).length) {
    return { error: 'Revise as respostas destacadas.', fieldErrors: Object.fromEntries(Object.entries(errors).map(([k, v]) => [`f_${k}`, v])) }
  }
  try {
    await db.update(schema.formAssignments).set({ answers, answeredAt: new Date() }).where(eq(schema.formAssignments.id, a.id))
    if (a.kind === 'consentimento') {
      await db.insert(schema.consents).values({ userId: user.id, patientId: user.patientId, kind: `termo:${a.title}`.slice(0, 80), version: a.id })
    }
    await notifyTeam('clinico', 'Formulário respondido', `${user.name} · ${a.title}`, `/admin/pacientes/${user.patientId}?aba=formularios`)
    await audit(user, 'formulario_respondido', 'formulario', { entityId: a.id, patientId: user.patientId })
    revalidatePath('/paciente/formularios')
    revalidatePath('/paciente')
    return { ok: true, message: 'Respostas enviadas. Obrigado!' }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------------ consultas ------------------------------ */

export async function cancelOwnAppointment(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const id = String(fd.get('id') ?? '')
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 300)
  if (!uuid.safeParse(id).success) return { error: 'Consulta inválida.' }
  const [a] = await db
    .select()
    .from(schema.appointments)
    .where(and(eq(schema.appointments.id, id), eq(schema.appointments.patientId, user.patientId)))
  if (!a || !['pendente', 'confirmada'].includes(a.status)) return { error: 'Esta consulta não pode ser cancelada.' }
  const s = await getSettings()
  const hoursLeft = (a.startAt.getTime() - Date.now()) / 3_600_000
  if (hoursLeft < 24) {
    return { error: 'Cancelamentos com menos de 24 horas de antecedência devem ser combinados diretamente com o consultório.' }
  }
  await db
    .update(schema.appointments)
    .set({ status: 'cancelada', cancelReason: reason ? `Cancelada pelo paciente: ${reason}` : 'Cancelada pelo paciente', updatedAt: new Date() })
    .where(eq(schema.appointments.id, a.id))
  await notifyTeam('agenda', 'Consulta cancelada pelo paciente', `${user.name} · ${fmtDateTime(a.startAt, s.timezone)}`, `/admin/agenda/${a.id}`)
  await audit(user, 'consulta_cancelada', 'consulta', { entityId: a.id, patientId: user.patientId })
  revalidatePath('/paciente/consultas')
  return { ok: true, message: 'Consulta cancelada. O horário foi liberado.' }
}

/* -------------------------------- LGPD -------------------------------- */

const requestSchema = z.object({
  type: z.enum(['acesso', 'correcao', 'exclusao', 'portabilidade', 'revogacao'], 'Escolha o tipo de solicitação'),
  details: optStr(2000),
})

export async function createDataRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const parsed = requestSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  await db.insert(schema.dataRequests).values({ patientId: user.patientId, requesterName: user.name, type: parsed.data.type, details: parsed.data.details })
  await notifyTeam('config', 'Nova solicitação LGPD', `${user.name} · ${parsed.data.type}`, '/admin/privacidade')
  await audit(user, 'lgpd_solicitacao', 'solicitacao', { patientId: user.patientId, details: { type: parsed.data.type } })
  revalidatePath('/paciente/meus-dados')
  return { ok: true, message: 'Solicitação registrada. Você receberá retorno no prazo legal.' }
}
