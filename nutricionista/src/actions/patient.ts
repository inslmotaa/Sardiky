'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { destroySession, requirePatient } from '@/lib/auth/session'
import { verifyPassword } from '@/lib/auth/password'
import { audit } from '@/lib/audit'
import { failure, formObject, UserError, zodErrors, type ActionState } from '@/lib/action'
import { parseAnswers } from '@/lib/forms'
import { notifyTeam } from '@/lib/team'
import { getSettings } from '@/lib/settings'
import { currentPublishedPlan, featuresOf } from '@/lib/patient-context'
import { saveUpload, CHAT_TYPES, DOC_TYPES, IMAGE_TYPES } from '@/lib/storage'
import { applyAnamnesis } from '@/lib/anamnese'
import { PRIVACY_VERSION } from '@/lib/constants'
import { chatFileTitle } from '@/lib/format'
import { postMessage } from '@/lib/chat'
import { pushToTeam } from '@/lib/push'
import { sendEmail } from '@/lib/notify'
import { deletePhoto, saveProgressPhotos } from '@/lib/photos'
import { rateLimit } from '@/lib/rate-limit'
import { addDays, fmtDateTime, todayIn } from '@/lib/time'
import type { DiaryItem } from '@/lib/plan'
import { day, int, optNum, optStr, str, time, uuid } from '@/lib/validation'

/* ------------------------------ diário ------------------------------ */

const DIARY_CHOICES = { total: 'feita', parcial: 'parcial', nao_seguiu: 'outra' } as const
const scale5 = z.union([z.literal(''), int(1, 5)]).optional()

const diarySchema = z.object({
  date: day,
  time,
  mealKey: z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^[\w-]{1,40}:[\w-]{1,40}$/.test(v), 'Refeição inválida'),
  optionId: optStr(40),
  meal: str(60, 'Escolha a refeição'),
  choice: z.enum(['', 'total', 'parcial', 'nao_seguiu']).optional().transform((v) => v || null),
  foods: optStr(1000),
  hunger: scale5,
  satiety: scale5,
  mood: scale5,
  notes: optStr(1000),
})
const diaryItemsSchema = z
  .array(z.object({ foodId: z.uuid().nullable(), name: z.string().trim().min(1).max(160), grams: z.number().positive().max(3000) }))
  .max(20, 'No máximo 20 alimentos por registro')

/** Guarda uma imagem enviada pelo paciente em pasta privada. */
async function savePatientImage(user: { id: string; patientId: string }, file: File, kind: string, title: string) {
  if (!rateLimit(`upload:${user.id}`, 30, 3_600_000)) throw new UserError('Limite de envios atingido. Tente mais tarde.')
  const saved = await saveUpload(file, IMAGE_TYPES)
  if ('error' in saved) return { error: saved.error! }
  const [f] = await db
    .insert(schema.files)
    .values({ patientId: user.patientId, uploadedBy: user.id, kind, title, mime: saved.mime, size: saved.size, storageKey: saved.key, visibleToPatient: true })
    .returning({ id: schema.files.id })
  return { id: f.id }
}

/**
 * Registro do diário. Para uma refeição do plano: “segui o plano”, “segui em parte” ou “comi outra coisa”
 * (alimentos da base com quantidade e/ou foto). Também marca a refeição na tela Hoje.
 */
export async function saveDiaryMeal(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  if (!(await featuresOf(user.patientId)).diario) return { error: 'O diário está desativado para a sua conta.' }
  const parsed = diarySchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  let rawItems: unknown = []
  try {
    rawItems = JSON.parse(String(fd.get('items') || '[]'))
  } catch {
    return { error: 'Lista de alimentos inválida.' }
  }
  const itemsParsed = diaryItemsSchema.safeParse(rawItems)
  if (!itemsParsed.success) return { error: itemsParsed.error.issues[0].message }
  const s = await getSettings()
  const today = todayIn(s.timezone)
  if (d.date > today) return { fieldErrors: { date: 'Não é possível registrar datas futuras' }, error: 'Revise a data.' }
  if (d.date < addDays(today, -30)) return { fieldErrors: { date: 'Registre dias dos últimos 30 dias' }, error: 'Revise a data.' }
  if (d.mealKey && !d.choice) return { fieldErrors: { choice: 'Escolha uma opção' }, error: 'Conte como foi: segui o plano, segui em parte ou comi outra coisa.' }
  const photo = fd.get('photo')
  const hasPhoto = photo instanceof File && photo.size > 0
  if ((d.choice === 'nao_seguiu' || !d.mealKey) && itemsParsed.data.length === 0 && !d.foods && !hasPhoto)
    return { fieldErrors: { foods: 'Descreva o que comeu' }, error: 'Adicione os alimentos, uma descrição ou uma foto do prato.' }

  try {
    // Nutrientes sempre vêm da base do servidor, nunca do navegador.
    const ids = itemsParsed.data.map((i) => i.foodId).filter((v): v is string => !!v)
    const foodRows = ids.length ? await db.select().from(schema.foods).where(inArray(schema.foods.id, ids)) : []
    const items: DiaryItem[] = itemsParsed.data.map((i) => {
      const f = foodRows.find((r) => r.id === i.foodId)
      return f
        ? { foodId: f.id, name: f.name, grams: Math.round(i.grams), per100: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber } }
        : { foodId: null, name: i.name, grams: Math.round(i.grams), per100: null }
    })
    const foodsText =
      d.foods ??
      (items.length
        ? items.map((i) => `${i.name} (${i.grams} g)`).join(', ')
        : d.choice === 'total'
          ? 'Segui o plano'
          : d.choice === 'parcial'
            ? 'Segui o plano em parte'
            : 'Foto do prato')

    let photoFileId: string | null = null
    if (hasPhoto) {
      const saved = await savePatientImage(user, photo, 'foto_refeicao', `Refeição ${d.meal} ${d.date}`)
      if ('error' in saved) return { fieldErrors: { photo: saved.error! }, error: saved.error }
      photoFileId = saved.id
    }
    const values = {
      patientId: user.patientId,
      date: d.date,
      time: d.time,
      meal: d.meal,
      mealKey: d.mealKey,
      foods: foodsText,
      items,
      hunger: d.hunger ? Number(d.hunger) : null,
      satiety: d.satiety ? Number(d.satiety) : null,
      mood: d.mood ? Number(d.mood) : null,
      adherence: d.choice,
      notes: d.notes,
    }
    // Uma refeição do plano tem um único registro por dia: registrar de novo atualiza.
    const [existing] = d.mealKey
      ? await db
          .select({ id: schema.diaryEntries.id, photoFileId: schema.diaryEntries.photoFileId })
          .from(schema.diaryEntries)
          .where(and(eq(schema.diaryEntries.patientId, user.patientId), eq(schema.diaryEntries.date, d.date), eq(schema.diaryEntries.mealKey, d.mealKey)))
      : []
    if (existing) {
      await db
        .update(schema.diaryEntries)
        .set({ ...values, photoFileId: photoFileId ?? existing.photoFileId })
        .where(eq(schema.diaryEntries.id, existing.id))
    } else {
      await db.insert(schema.diaryEntries).values({ ...values, photoFileId })
    }

    if (d.mealKey && d.choice) {
      const plan = await currentPublishedPlan(user.patientId)
      if (plan) {
        const status = DIARY_CHOICES[d.choice]
        await db
          .insert(schema.mealLogs)
          .values({ patientId: user.patientId, date: d.date, planId: plan.id, mealKey: d.mealKey, optionId: d.optionId, status })
          .onConflictDoUpdate({ target: [schema.mealLogs.patientId, schema.mealLogs.date, schema.mealLogs.mealKey], set: { status, optionId: d.optionId, planId: plan.id } })
      }
    }
    revalidatePath('/paciente/diario')
    revalidatePath('/paciente')
    const kind = d.choice === 'total' ? 'Que bom! ' : d.choice === 'parcial' ? 'Tudo certo, cada passo conta. ' : d.choice === 'nao_seguiu' ? 'Obrigado por contar. Amanhã é um novo dia. ' : ''
    return { ok: true, message: `${kind}Registro salvo no seu diário.` }
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
  if (!(await featuresOf(user.patientId)).peso) return { error: 'O registro de medidas está desativado para a sua conta.' }
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
  if (!(await featuresOf(user.patientId)).chat) return { error: 'As mensagens estão desativadas para a sua conta.' }
  const file = fd.get('attachment')
  const hasFile = file instanceof File && file.size > 0
  const body = String(fd.get('body') ?? '').trim()
  if (!body && !hasFile) return { fieldErrors: { body: 'Escreva sua mensagem' }, error: 'Escreva sua mensagem ou anexe um arquivo.' }
  if (body.length > 3000) return { fieldErrors: { body: 'Texto muito longo' }, error: 'Mensagem muito longa.' }
  if (!rateLimit(`msg:${user.id}`, 30, 3_600_000)) return { error: 'Muitas mensagens em pouco tempo. Aguarde um pouco.' }
  try {
    let attachmentFileId: string | null = null
    if (hasFile) {
      if (!rateLimit(`upload:${user.id}`, 30, 3_600_000)) throw new UserError('Limite de envios atingido. Tente mais tarde.')
      const saved = await saveUpload(file, CHAT_TYPES)
      if ('error' in saved) return { fieldErrors: { attachment: saved.error! }, error: saved.error }
      const [f] = await db
        .insert(schema.files)
        .values({ patientId: user.patientId, uploadedBy: user.id, kind: 'anexo_chat', title: chatFileTitle(saved.mime), mime: saved.mime, size: saved.size, storageKey: saved.key, visibleToPatient: true })
        .returning({ id: schema.files.id })
      attachmentFileId = f.id
    }
    await postMessage({ patientId: user.patientId, senderId: user.id, fromPatient: true, body, attachmentFileId, senderName: user.name })
    revalidatePath('/paciente/mensagens')
    return { ok: true }
  } catch (err) {
    return failure(err)
  }
}

/* --------------------------- fotos de evolução --------------------------- */

export async function addOwnProgressPhotos(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const date = day.safeParse(fd.get('date'))
  const s = await getSettings()
  if (!date.success || date.data > todayIn(s.timezone)) return { fieldErrors: { date: 'Data inválida' }, error: 'Revise a data.' }
  if (!rateLimit(`upload:${user.id}`, 30, 3_600_000)) return { error: 'Limite de envios atingido. Tente mais tarde.' }
  try {
    const r = await saveProgressPhotos(user.patientId, user.id, date.data, fd)
    if ('error' in r) return { error: r.error }
    await notifyTeam('clinico', 'Novas fotos de evolução', user.name, `/admin/pacientes/${user.patientId}?aba=evolucao`, user.patientId)
    await audit(user, 'fotos_evolucao_enviadas', 'foto', { patientId: user.patientId, details: { quantidade: r.saved } })
    revalidatePath('/paciente/evolucao')
    return { ok: true, message: r.saved === 1 ? 'Foto salva.' : `${r.saved} fotos salvas.` }
  } catch (err) {
    return failure(err)
  }
}

export async function deleteOwnProgressPhoto(id: string) {
  const user = await requirePatient()
  if (!uuid.safeParse(id).success) return
  // O paciente só exclui as fotos que ele mesmo enviou.
  if (await deletePhoto(user.patientId, id, user.id)) await audit(user, 'foto_evolucao_excluida', 'foto', { entityId: id, patientId: user.patientId })
  revalidatePath('/paciente/evolucao')
}

/** O paciente marca (ou desmarca) uma meta como concluída. */
export async function toggleOwnGoal(id: string) {
  const user = await requirePatient()
  if (!uuid.safeParse(id).success) return
  const [g] = await db.select().from(schema.goals).where(and(eq(schema.goals.id, id), eq(schema.goals.patientId, user.patientId)))
  if (!g || g.status === 'cancelada') return
  const done = g.status !== 'concluida'
  await db.update(schema.goals).set({ status: done ? 'concluida' : 'ativa', completedAt: done ? new Date() : null }).where(eq(schema.goals.id, g.id))
  if (done) await notifyTeam('clinico', 'Meta concluída pelo cliente', `${user.name} · ${g.title}`, `/admin/pacientes/${user.patientId}?aba=metas`, user.patientId)
  revalidatePath('/paciente/evolucao')
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
  // Anamnese: consentimento explícito para dados de saúde (registrado com versão e data) antes do envio.
  const needsConsent =
    a.kind === 'anamnese' &&
    !(await db.select({ id: schema.consents.id }).from(schema.consents).where(and(eq(schema.consents.patientId, user.patientId), eq(schema.consents.kind, 'anamnese_dados_saude'))))
      .length
  if (needsConsent && fd.get('lgpd_consent') !== 'on') errors.lgpd = 'É necessário autorizar o uso dos dados de saúde'
  if (Object.keys(errors).length) {
    return { error: 'Revise as respostas destacadas.', fieldErrors: Object.fromEntries(Object.entries(errors).map(([k, v]) => [k === 'lgpd' ? 'lgpd_consent' : `f_${k}`, v])) }
  }
  try {
    // Exames enviados nos campos de arquivo: pasta privada, visíveis ao paciente e à equipe clínica.
    for (const f of a.fields.filter((x) => x.type === 'file')) {
      const file = fd.get(`f_${f.id}`)
      if (!(file instanceof File) || file.size === 0) continue
      if (!rateLimit(`upload:${user.id}`, 30, 3_600_000)) throw new UserError('Limite de envios atingido. Tente mais tarde.')
      const saved = await saveUpload(file, DOC_TYPES)
      if ('error' in saved) return { fieldErrors: { [`f_${f.id}`]: saved.error! }, error: saved.error }
      const [row] = await db
        .insert(schema.files)
        .values({ patientId: user.patientId, uploadedBy: user.id, kind: 'exame', title: `${f.label}`.slice(0, 120), mime: saved.mime, size: saved.size, storageKey: saved.key, visibleToPatient: true })
        .returning({ id: schema.files.id })
      answers[f.id] = row.id
    }
    if (needsConsent) await db.insert(schema.consents).values({ userId: user.id, patientId: user.patientId, kind: 'anamnese_dados_saude', version: PRIVACY_VERSION })
    await db.update(schema.formAssignments).set({ answers, answeredAt: new Date() }).where(eq(schema.formAssignments.id, a.id))
    if (a.kind === 'anamnese' || a.fields.some((f) => f.mapsTo)) await applyAnamnesis(user.patientId, a.fields, answers)
    if (a.kind === 'consentimento') {
      await db.insert(schema.consents).values({ userId: user.id, patientId: user.patientId, kind: `termo:${a.title}`.slice(0, 80), version: a.id })
    }
    await notifyTeam('clinico', a.kind === 'anamnese' ? 'Anamnese recebida' : 'Formulário respondido', `${user.name} · ${a.title}`, `/admin/pacientes/${user.patientId}?aba=formularios`, user.patientId)
    if (a.kind === 'anamnese') {
      await pushToTeam('clinico', { title: 'Anamnese recebida', body: user.name, url: `/admin/pacientes/${user.patientId}?aba=formularios` }, user.patientId)
      const s = await getSettings()
      if (s.contactEmail) await sendEmail(s.contactEmail, `Anamnese recebida: ${user.name}`, `${user.name} enviou a anamnese pelo app. Veja as respostas no painel, na ficha do cliente.`)
    }
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
    return { error: 'Cancelamentos com menos de 24 horas de antecedência devem ser combinados diretamente com o seu coach.' }
  }
  await db
    .update(schema.appointments)
    .set({ status: 'cancelada', cancelReason: reason ? `Cancelada pelo cliente: ${reason}` : 'Cancelada pelo cliente', updatedAt: new Date() })
    .where(eq(schema.appointments.id, a.id))
  await notifyTeam('agenda', 'Consulta cancelada pelo cliente', `${user.name} · ${fmtDateTime(a.startAt, s.timezone)}`, `/admin/agenda/${a.id}`, user.patientId)
  await audit(user, 'consulta_cancelada', 'consulta', { entityId: a.id, patientId: user.patientId })
  revalidatePath('/paciente/consultas')
  return { ok: true, message: 'Consulta cancelada. O horário foi liberado.' }
}

/** O paciente confirma presença numa consulta já confirmada. */
export async function confirmPresence(id: string): Promise<void> {
  const user = await requirePatient()
  if (!uuid.safeParse(id).success) return
  const [a] = await db
    .select()
    .from(schema.appointments)
    .where(and(eq(schema.appointments.id, id), eq(schema.appointments.patientId, user.patientId)))
  if (!a || a.status !== 'confirmada' || a.startAt < new Date()) return
  await db.update(schema.appointments).set({ patientConfirmedAt: new Date(), updatedAt: new Date() }).where(eq(schema.appointments.id, a.id))
  const s = await getSettings()
  await notifyTeam('agenda', 'Cliente confirmou presença', `${user.name} · ${fmtDateTime(a.startAt, s.timezone)}`, `/admin/agenda/${a.id}`, user.patientId)
  await audit(user, 'presenca_confirmada', 'consulta', { entityId: a.id, patientId: user.patientId })
  revalidatePath('/paciente/consultas')
}

/** Pedido de remarcação: a equipe recebe o aviso e combina o novo horário. */
export async function requestReschedule(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const parsed = z.object({ id: uuid, note: optStr(500) }).safeParse(formObject(fd))
  if (!parsed.success) return { error: 'Consulta inválida.' }
  const [a] = await db
    .select()
    .from(schema.appointments)
    .where(and(eq(schema.appointments.id, parsed.data.id), eq(schema.appointments.patientId, user.patientId)))
  if (!a || !['pendente', 'confirmada'].includes(a.status) || a.startAt < new Date()) return { error: 'Esta consulta não pode ser remarcada.' }
  await db
    .update(schema.appointments)
    .set({ rescheduleRequestedAt: new Date(), rescheduleNote: parsed.data.note, updatedAt: new Date() })
    .where(eq(schema.appointments.id, a.id))
  const s = await getSettings()
  await notifyTeam('agenda', 'Pedido de remarcação', `${user.name} · ${fmtDateTime(a.startAt, s.timezone)}${parsed.data.note ? ` · ${parsed.data.note}` : ''}`, `/admin/agenda/${a.id}`, user.patientId)
  await pushToTeam('agenda', { title: 'Pedido de remarcação', body: `${user.name} · ${fmtDateTime(a.startAt, s.timezone)}`, url: `/admin/agenda/${a.id}` }, user.patientId)
  await audit(user, 'remarcacao_pedida', 'consulta', { entityId: a.id, patientId: user.patientId })
  revalidatePath('/paciente/consultas')
  return { ok: true, message: 'Pedido enviado. Seu coach vai entrar em contato para combinar o novo horário.' }
}

/** Avaliação da consulta realizada (1 a 5 estrelas e comentário opcional). */
export async function rateAppointment(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const parsed = z.object({ id: uuid, rating: int(1, 5), comment: optStr(1000) }).safeParse(formObject(fd))
  if (!parsed.success) return { fieldErrors: { rating: 'Escolha de 1 a 5 estrelas' }, error: 'Escolha de 1 a 5 estrelas.' }
  const [a] = await db
    .select()
    .from(schema.appointments)
    .where(and(eq(schema.appointments.id, parsed.data.id), eq(schema.appointments.patientId, user.patientId)))
  if (!a || a.status !== 'realizada') return { error: 'Só é possível avaliar consultas realizadas.' }
  if (a.ratedAt) return { error: 'Esta consulta já foi avaliada. Obrigado!' }
  await db
    .update(schema.appointments)
    .set({ rating: parsed.data.rating, ratingComment: parsed.data.comment, ratedAt: new Date() })
    .where(eq(schema.appointments.id, a.id))
  await notifyTeam('agenda', `Nova avaliação de consulta: ${'★'.repeat(parsed.data.rating)}`, user.name, `/admin/agenda/${a.id}`, user.patientId)
  await audit(user, 'consulta_avaliada', 'consulta', { entityId: a.id, patientId: user.patientId, details: { nota: parsed.data.rating } })
  revalidatePath('/paciente/consultas')
  return { ok: true, message: 'Obrigado pela avaliação!' }
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

/* --------------------------- Hoje: refeições, água e peso --------------------------- */

const MEAL_STATUS = ['feita', 'parcial', 'pulada'] as const

/** Marca (ou desmarca) uma refeição do plano ativo para hoje. */
export async function setMealStatus(mealKey: string, optionId: string, status: string): Promise<void> {
  const user = await requirePatient()
  if (!/^[\w-]{1,40}:[\w-]{1,40}$/.test(mealKey) || optionId.length > 40) return
  const plan = await currentPublishedPlan(user.patientId)
  if (!plan) return
  const s = await getSettings()
  const date = todayIn(s.timezone)
  const where = and(eq(schema.mealLogs.patientId, user.patientId), eq(schema.mealLogs.date, date), eq(schema.mealLogs.mealKey, mealKey))
  if (!MEAL_STATUS.includes(status as (typeof MEAL_STATUS)[number])) {
    await db.delete(schema.mealLogs).where(where)
  } else {
    await db
      .insert(schema.mealLogs)
      .values({ patientId: user.patientId, date, planId: plan.id, mealKey, optionId, status })
      .onConflictDoUpdate({ target: [schema.mealLogs.patientId, schema.mealLogs.date, schema.mealLogs.mealKey], set: { status, optionId, planId: plan.id } })
  }
  revalidatePath('/paciente')
}

/** Soma (ou tira) água do dia, em ml. */
export async function changeWater(delta: number): Promise<void> {
  const user = await requirePatient()
  if (!Number.isInteger(delta) || Math.abs(delta) > 1000) return
  if (!(await featuresOf(user.patientId)).agua) return
  const s = await getSettings()
  const date = todayIn(s.timezone)
  const [row] = await db
    .select()
    .from(schema.waterLogs)
    .where(and(eq(schema.waterLogs.patientId, user.patientId), eq(schema.waterLogs.date, date)))
  const ml = Math.max(0, Math.min(8000, (row?.ml ?? 0) + delta))
  await db
    .insert(schema.waterLogs)
    .values({ patientId: user.patientId, date, ml })
    .onConflictDoUpdate({ target: [schema.waterLogs.patientId, schema.waterLogs.date], set: { ml, updatedAt: new Date() } })
  revalidatePath('/paciente')
}

export async function quickWeight(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  if (!(await featuresOf(user.patientId)).peso) return { error: 'Registro de peso desativado pelo coach.' }
  const kg = optNum(20, 350).safeParse(fd.get('weightKg') ?? '')
  if (!kg.success || kg.data == null) return { fieldErrors: { weightKg: 'Informe o peso entre 20 e 350 kg' }, error: 'Peso inválido.' }
  const s = await getSettings()
  await db.insert(schema.measurements).values({ patientId: user.patientId, date: todayIn(s.timezone), source: 'paciente', weightKg: kg.data, createdBy: user.id })
  revalidatePath('/paciente')
  revalidatePath('/paciente/evolucao')
  return { ok: true, message: 'Peso registrado. Obrigado por acompanhar!' }
}

export async function completeOnboarding(): Promise<void> {
  const user = await requirePatient()
  await db.update(schema.users).set({ onboardedAt: new Date() }).where(eq(schema.users.id, user.id))
  revalidatePath('/paciente')
}

/**
 * "Excluir minha conta": encerra o acesso na hora (login, sessões e notificações) e registra o pedido de eliminação.
 * O prontuário fica guardado só pelo prazo das normas profissionais e é anonimizado pelo nutricionista em Privacidade.
 */
export async function deleteMyAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id))
  if (!row) return { error: 'Conta não encontrada.' }
  if (String(fd.get('confirm') ?? '').trim().toUpperCase() !== 'EXCLUIR') return { error: 'Digite EXCLUIR para confirmar.', fieldErrors: { confirm: 'Digite EXCLUIR' } }
  if (row.passwordHash && !(await verifyPassword(String(fd.get('password') ?? ''), row.passwordHash))) {
    return { error: 'Senha incorreta.', fieldErrors: { password: 'Senha incorreta' } }
  }
  await db.transaction(async (tx) => {
    await tx.insert(schema.dataRequests).values({
      patientId: user.patientId,
      requesterName: user.name,
      type: 'exclusao',
      details: 'Conta excluída pelo próprio titular no app. Acesso encerrado; falta anonimizar o prontuário quando o prazo de guarda permitir.',
    })
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, user.id))
    await tx.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, user.id))
    await tx
      .update(schema.users)
      .set({ isActive: false, email: `excluido-${user.id}@conta-removida.invalid`, name: 'Conta excluída', passwordHash: null, googleSub: null, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id))
    await tx.update(schema.patients).set({ userId: null, status: 'inativo', updatedAt: new Date() }).where(eq(schema.patients.id, user.patientId))
  })
  await notifyTeam('config', 'Conta excluída pelo cliente', user.name, '/admin/privacidade')
  await audit(user, 'conta_excluida', 'usuario', { entityId: user.id, patientId: user.patientId })
  await destroySession()
  redirect('/?conta=excluida')
}
