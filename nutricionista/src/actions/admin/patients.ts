'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { failure, formObject, UserError, zodErrors, type ActionState } from '@/lib/action'
import { hashToken, newToken } from '@/lib/auth/tokens'
import { notifyUser, sendEmail } from '@/lib/notify'
import { getSettings } from '@/lib/settings'
import { deleteUpload, DOC_TYPES, saveUpload } from '@/lib/storage'
import { todayIn } from '@/lib/time'
import { day, int, optDay, optEmail, optNum, optStr, str, uuid } from '@/lib/validation'
import { onlyDigits, whatsappLink } from '@/lib/format'
import type { ExtraIndicator } from '@/db/schema'

const patientPath = (id: string, tab?: string) => `/admin/pacientes/${id}${tab ? `?aba=${tab}` : ''}`

async function patientOrThrow(id: string) {
  if (!uuid.safeParse(id).success) throw new UserError('Paciente inválido.')
  const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, id))
  if (!p || p.anonymizedAt) throw new UserError('Paciente não encontrado.')
  return p
}

/* ------------------------------ cadastro ------------------------------ */

const patientSchema = z.object({
  fullName: str(160, 'Informe o nome'),
  email: optEmail,
  phone: z
    .string()
    .optional()
    .transform((v) => (v ? onlyDigits(v) : null))
    .refine((v) => v === null || (v.length >= 10 && v.length <= 13), 'Telefone com DDD'),
  birthDate: optDay,
  sex: z
    .enum(['', 'F', 'M'])
    .optional()
    .transform((v) => v || null),
  heightCm: optNum(50, 250),
  objective: optStr(500),
  status: z.enum(['ativo', 'pausado', 'inativo', 'alta']),
  stage: str(80, 'Informe a etapa'),
  followUpDays: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 7 && v <= 365), 'Entre 7 e 365 dias'),
  nextFollowUp: optDay,
})

export async function createPatient(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = patientSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  let id = ''
  try {
    const user = await requireTeam('cadastro')
    if (parsed.data.email) {
      const [dup] = await db.select({ id: schema.patients.id }).from(schema.patients).where(eq(schema.patients.email, parsed.data.email))
      if (dup) return { fieldErrors: { email: 'Já existe um paciente com este e-mail' }, error: 'E-mail já cadastrado.' }
    }
    const [p] = await db.insert(schema.patients).values(parsed.data).returning({ id: schema.patients.id })
    id = p.id
    await audit(user, 'paciente_criado', 'paciente', { entityId: id, patientId: id })
  } catch (err) {
    return failure(err)
  }
  redirect(patientPath(id))
}

export async function updatePatient(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = patientSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await requireTeam('cadastro')
    const before = await patientOrThrow(id)
    await db.update(schema.patients).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.patients.id, id))
    if (before.userId && parsed.data.fullName !== before.fullName) {
      await db.update(schema.users).set({ name: parsed.data.fullName }).where(eq(schema.users.id, before.userId))
    }
    const changed = (Object.keys(parsed.data) as (keyof typeof parsed.data)[]).filter((k) => String(parsed.data[k] ?? '') !== String(before[k] ?? ''))
    await audit(user, 'paciente_editado', 'paciente', { entityId: id, patientId: id, details: { campos: changed } })
    revalidatePath(patientPath(id))
    return { ok: true, message: 'Cadastro atualizado.' }
  } catch (err) {
    return failure(err)
  }
}

/**
 * Cria (ou renova) o acesso do paciente à área exclusiva.
 * Gera um link de primeiro acesso válido por 7 dias, exibido uma única vez.
 */
export async function invitePatient(id: string, _: ActionState): Promise<ActionState> {
  try {
    const user = await requireTeam('cadastro')
    const p = await patientOrThrow(id)
    if (!p.email) return { error: 'Cadastre um e-mail para o paciente antes de liberar o acesso.' }
    let userId = p.userId
    if (!userId) {
      const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, p.email))
      if (existing) {
        if (existing.role !== 'patient') return { error: 'Este e-mail pertence a um usuário da equipe.' }
        const [linked] = await db.select({ id: schema.patients.id }).from(schema.patients).where(eq(schema.patients.userId, existing.id))
        if (linked) return { error: 'Este e-mail já está vinculado a outro paciente.' }
        userId = existing.id
      } else {
        const [u] = await db.insert(schema.users).values({ email: p.email, name: p.fullName, role: 'patient' }).returning({ id: schema.users.id })
        userId = u.id
      }
      await db.update(schema.patients).set({ userId }).where(eq(schema.patients.id, p.id))
    }
    await db.update(schema.users).set({ isActive: true }).where(eq(schema.users.id, userId))
    const token = newToken()
    await db.insert(schema.authTokens).values({ id: hashToken(token), userId, type: 'convite', expiresAt: new Date(Date.now() + 7 * 86_400_000) })
    const url = `${process.env.APP_URL ?? 'http://localhost:3000'}/redefinir-senha?token=${token}`
    const s = await getSettings()
    const inviteText = `Olá, ${p.fullName.split(' ')[0]}! ${s.professionalName} liberou seu acesso ao app do paciente. Crie sua senha neste link (válido por 7 dias): ${url}`
    const sent = await sendEmail(p.email, 'Seu acesso à área do paciente', inviteText)
    const wa = p.phone ? whatsappLink(p.phone.length <= 11 ? `55${p.phone}` : p.phone, inviteText) : null
    await audit(user, 'acesso_paciente_liberado', 'paciente', { entityId: p.id, patientId: p.id })
    revalidatePath(patientPath(p.id))
    return {
      ok: true,
      message: `${sent ? 'Convite enviado por e-mail. ' : ''}Link de primeiro acesso (válido por 7 dias, uso único — envie apenas ao paciente): ${url}`,
      links: wa ? [{ href: wa, label: 'Enviar convite pelo WhatsApp' }] : undefined,
    }
  } catch (err) {
    return failure(err)
  }
}

export async function revokePatientAccess(id: string): Promise<void> {
  const user = await requireTeam('cadastro')
  const p = await patientOrThrow(id)
  if (!p.userId) return
  await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, p.userId))
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, p.userId))
  await audit(user, 'acesso_paciente_bloqueado', 'paciente', { entityId: p.id, patientId: p.id })
  revalidatePath(patientPath(p.id))
}

/* ---------------------------- avaliações ---------------------------- */

const measurementSchema = z.object({
  date: day,
  weightKg: optNum(20, 400),
  heightCm: optNum(50, 250),
  bodyFatPct: optNum(2, 75),
  bodyFatMethod: optStr(80),
  waistCm: optNum(30, 250),
  hipCm: optNum(30, 250),
  armCm: optNum(10, 80),
  thighCm: optNum(20, 120),
  chestCm: optNum(40, 200),
  notes: optStr(1000),
})

export async function addMeasurement(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = measurementSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  if (d.bodyFatPct != null && !d.bodyFatMethod) return { fieldErrors: { bodyFatMethod: 'Informe o método usado' }, error: 'Informe o método do percentual de gordura.' }
  // Indicadores extras: pares extraLabel_N / extraValue_N / extraUnit_N.
  const extra: ExtraIndicator[] = []
  for (let i = 0; i < 5; i++) {
    const label = String(fd.get(`extraLabel_${i}`) ?? '').trim().slice(0, 60)
    const value = Number(String(fd.get(`extraValue_${i}`) ?? '').replace(',', '.'))
    if (label && Number.isFinite(value)) extra.push({ label, value, unit: String(fd.get(`extraUnit_${i}`) ?? '').trim().slice(0, 15) })
  }
  const values = [d.weightKg, d.heightCm, d.bodyFatPct, d.waistCm, d.hipCm, d.armCm, d.thighCm, d.chestCm]
  if (values.every((v) => v == null) && extra.length === 0) return { error: 'Informe ao menos uma medida.' }
  try {
    const user = await requireTeam('clinico')
    await patientOrThrow(patientId)
    await db.insert(schema.measurements).values({ ...d, patientId, source: 'profissional', extra, createdBy: user.id })
    await audit(user, 'avaliacao_registrada', 'avaliacao', { patientId })
    revalidatePath(patientPath(patientId, 'evolucao'))
    return { ok: true, message: 'Avaliação registrada.' }
  } catch (err) {
    return failure(err)
  }
}

export async function deleteMeasurement(patientId: string, id: string): Promise<void> {
  const user = await requireTeam('clinico')
  if (!uuid.safeParse(id).success) return
  await db.delete(schema.measurements).where(and(eq(schema.measurements.id, id), eq(schema.measurements.patientId, patientId)))
  await audit(user, 'avaliacao_excluida', 'avaliacao', { entityId: id, patientId })
  revalidatePath(patientPath(patientId, 'evolucao'))
}

/* -------------------------------- metas -------------------------------- */

const goalSchema = z.object({
  title: str(160, 'Descreva a meta'),
  description: optStr(500),
  metric: z
    .enum(['', 'weightKg', 'waistCm', 'hipCm', 'bodyFatPct', 'armCm', 'thighCm', 'chestCm'])
    .optional()
    .transform((v) => v || null),
  startValue: optNum(0, 500),
  targetValue: optNum(0, 500),
  unit: optStr(10),
  dueDate: optDay,
})

export async function addGoal(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = goalSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  if (parsed.data.metric && parsed.data.targetValue == null) return { fieldErrors: { targetValue: 'Informe o valor-alvo' }, error: 'Informe o valor-alvo.' }
  try {
    const user = await requireTeam('clinico')
    const p = await patientOrThrow(patientId)
    await db.insert(schema.goals).values({ ...parsed.data, patientId })
    if (p.userId) await notifyUser(p.userId, 'Nova meta definida', parsed.data.title, '/paciente/evolucao#metas')
    await audit(user, 'meta_criada', 'meta', { patientId })
    revalidatePath(patientPath(patientId, 'metas'))
    return { ok: true, message: 'Meta criada e visível na área do paciente.' }
  } catch (err) {
    return failure(err)
  }
}

export async function setGoalStatus(patientId: string, id: string, status: 'ativa' | 'concluida' | 'cancelada'): Promise<void> {
  const user = await requireTeam('clinico')
  if (!uuid.safeParse(id).success) return
  await db.update(schema.goals).set({ status }).where(and(eq(schema.goals.id, id), eq(schema.goals.patientId, patientId)))
  await audit(user, `meta_${status}`, 'meta', { entityId: id, patientId })
  revalidatePath(patientPath(patientId, 'metas'))
}

/* ---------------------------- notas clínicas ---------------------------- */

export async function addClinicalNote(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = str(10000, 'Escreva a anotação').safeParse(fd.get('body'))
  if (!parsed.success) return { fieldErrors: { body: parsed.error.issues[0].message }, error: parsed.error.issues[0].message }
  try {
    const user = await requireTeam('clinico')
    await patientOrThrow(patientId)
    await db.insert(schema.clinicalNotes).values({ patientId, authorId: user.id, body: parsed.data })
    await audit(user, 'nota_clinica_criada', 'nota_clinica', { patientId })
    revalidatePath(patientPath(patientId, 'notas'))
    return { ok: true, message: 'Anotação salva (visível apenas para a equipe clínica).' }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------------ documentos ------------------------------ */

export async function uploadDocument(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireTeam('clinico')
    await patientOrThrow(patientId)
    const title = String(fd.get('title') ?? '').trim().slice(0, 160)
    const file = fd.get('file')
    if (!title) return { fieldErrors: { title: 'Dê um nome ao documento' }, error: 'Dê um nome ao documento.' }
    if (!(file instanceof File)) return { fieldErrors: { file: 'Selecione um arquivo' }, error: 'Selecione um arquivo.' }
    const saved = await saveUpload(file, DOC_TYPES)
    if ('error' in saved) return { fieldErrors: { file: saved.error! }, error: saved.error }
    const share = fd.get('share') === 'on'
    await db.insert(schema.files).values({
      patientId,
      uploadedBy: user.id,
      kind: 'documento',
      title,
      mime: saved.mime,
      size: saved.size,
      storageKey: saved.key,
      visibleToPatient: share,
    })
    await audit(user, 'documento_anexado', 'arquivo', { patientId, details: { title, compartilhado: share } })
    revalidatePath(patientPath(patientId, 'documentos'))
    return { ok: true, message: 'Documento anexado.' }
  } catch (err) {
    return failure(err)
  }
}

export async function toggleDocumentShare(patientId: string, id: string): Promise<void> {
  const user = await requireTeam('clinico')
  if (!uuid.safeParse(id).success) return
  const [f] = await db.select().from(schema.files).where(and(eq(schema.files.id, id), eq(schema.files.patientId, patientId)))
  if (!f) return
  await db.update(schema.files).set({ visibleToPatient: !f.visibleToPatient }).where(eq(schema.files.id, id))
  await audit(user, f.visibleToPatient ? 'documento_ocultado' : 'documento_compartilhado', 'arquivo', { entityId: id, patientId })
  revalidatePath(patientPath(patientId, 'documentos'))
}

export async function deleteDocument(patientId: string, id: string): Promise<void> {
  const user = await requireTeam('clinico')
  if (!uuid.safeParse(id).success) return
  const [f] = await db.select().from(schema.files).where(and(eq(schema.files.id, id), eq(schema.files.patientId, patientId)))
  if (!f) return
  await db.delete(schema.files).where(eq(schema.files.id, id))
  await deleteUpload(f.storageKey)
  await audit(user, 'documento_excluido', 'arquivo', { entityId: id, patientId, details: { title: f.title } })
  revalidatePath(patientPath(patientId, 'documentos'))
}

/* ------------------------------ mensagens ------------------------------ */

export async function sendTeamMessage(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = str(5000, 'Escreva a mensagem').safeParse(fd.get('body'))
  if (!parsed.success) return { fieldErrors: { body: parsed.error.issues[0].message }, error: parsed.error.issues[0].message }
  try {
    const user = await requireTeam('clinico')
    const p = await patientOrThrow(patientId)
    const isGuidance = fd.get('guidance') === 'on'
    await db.insert(schema.messages).values({ patientId, senderId: user.id, fromPatient: false, isGuidance, body: parsed.data })
    // Ao responder, as mensagens do paciente contam como lidas.
    await db.update(schema.messages).set({ readAt: new Date() }).where(and(eq(schema.messages.patientId, patientId), eq(schema.messages.fromPatient, true)))
    if (p.userId) await notifyUser(p.userId, isGuidance ? 'Nova orientação do nutricionista' : 'Nova mensagem do nutricionista', undefined, '/paciente/mensagens')
    revalidatePath(patientPath(patientId, 'mensagens'))
    revalidatePath('/admin/mensagens')
    return { ok: true, message: p.userId ? 'Mensagem enviada.' : 'Mensagem registrada. O paciente ainda não tem acesso à área exclusiva.' }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------- formulários e diário ------------------------- */

export async function assignForm(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ templateId: uuid, dueDate: optDay }).safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await requireTeam('clinico')
    const p = await patientOrThrow(patientId)
    const [t] = await db.select().from(schema.formTemplates).where(eq(schema.formTemplates.id, parsed.data.templateId))
    if (!t) return { error: 'Modelo não encontrado.' }
    await db.insert(schema.formAssignments).values({ templateId: t.id, patientId, title: t.title, kind: t.kind, fields: t.fields, dueDate: parsed.data.dueDate })
    if (p.userId) await notifyUser(p.userId, 'Novo formulário para preencher', t.title, '/paciente/formularios')
    await audit(user, 'formulario_enviado', 'formulario', { patientId, details: { titulo: t.title } })
    revalidatePath(patientPath(patientId, 'formularios'))
    return { ok: true, message: p.userId ? 'Formulário enviado ao paciente.' : 'Formulário registrado; ficará visível quando o paciente tiver acesso.' }
  } catch (err) {
    return failure(err)
  }
}

export async function commentDiary(patientId: string, entryId: string, fd: FormData): Promise<void> {
  const user = await requireTeam('clinico')
  const comment = String(fd.get('comment') ?? '').trim().slice(0, 500)
  if (!comment || !uuid.safeParse(entryId).success) return
  await db
    .update(schema.diaryEntries)
    .set({ professionalComment: comment })
    .where(and(eq(schema.diaryEntries.id, entryId), eq(schema.diaryEntries.patientId, patientId)))
  const p = await patientOrThrow(patientId)
  if (p.userId) await notifyUser(p.userId, 'O nutricionista comentou seu diário', comment.slice(0, 80), '/paciente/diario')
  await audit(user, 'diario_comentado', 'diario', { entityId: entryId, patientId })
  revalidatePath(patientPath(patientId, 'diario'))
}

/* --------------------------- acompanhamento --------------------------- */

export async function scheduleFollowUp(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ followUpDays: int(7, 365) }).safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await requireTeam('cadastro')
    await patientOrThrow(patientId)
    const s = await getSettings()
    const next = new Date(Date.parse(todayIn(s.timezone) + 'T12:00:00Z') + parsed.data.followUpDays * 86_400_000).toISOString().slice(0, 10)
    await db.update(schema.patients).set({ followUpDays: parsed.data.followUpDays, nextFollowUp: next }).where(eq(schema.patients.id, patientId))
    await audit(user, 'frequencia_definida', 'paciente', { patientId })
    revalidatePath(patientPath(patientId))
    return { ok: true, message: 'Frequência atualizada.' }
  } catch (err) {
    return failure(err)
  }
}
