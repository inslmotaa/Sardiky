'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { assertFree } from '@/lib/booking'
import { failure, formObject, UserError, zodErrors, type ActionState } from '@/lib/action'
import { newCode } from '@/lib/auth/tokens'
import { notifyUser, renderTemplate, sendEmail } from '@/lib/notify'
import { fitsWorkingHours } from '@/lib/scheduling'
import { getSettings, getWorkingHours } from '@/lib/settings'
import { addDays, fmtDay, zonedParts, zonedToUtc } from '@/lib/time'
import { jitsiRoom, nationalHolidays } from '@/lib/feriados'
import { randomBytes } from 'node:crypto'
import { day, email, optStr, phone, str, time, uuid } from '@/lib/validation'

async function loadAppointment(id: string) {
  if (!uuid.safeParse(id).success) throw new UserError('Consulta inválida.')
  const [a] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, id))
  if (!a) throw new UserError('Consulta não encontrada.')
  return a
}

/** Avisa o paciente pelo sistema (se tiver conta) e por e-mail (se configurado). */
async function tellPatient(a: typeof schema.appointments.$inferSelect, kind: 'confirmacao' | 'cancelamento' | 'remarcacao') {
  const s = await getSettings()
  const p = zonedParts(a.startAt, s.timezone)
  const vars = { nome: a.contactName.split(' ')[0], data: fmtDay(p.date), hora: p.time, servico: a.serviceName, codigo: a.code }
  const text =
    kind === 'cancelamento'
      ? renderTemplate(s.templates.cancelamento, vars)
      : kind === 'remarcacao'
        ? `Olá, ${vars.nome}! Sua consulta foi remarcada para ${vars.data} às ${vars.hora}.`
        : renderTemplate(s.templates.confirmacao, vars)
  if (a.patientId) {
    const [pt] = await db.select({ userId: schema.patients.userId }).from(schema.patients).where(eq(schema.patients.id, a.patientId))
    const title = kind === 'confirmacao' ? 'Consulta confirmada' : kind === 'cancelamento' ? 'Consulta cancelada' : 'Consulta remarcada'
    await notifyUser(pt?.userId, title, `${vars.data} às ${vars.hora} · ${a.serviceName}`, '/paciente/consultas')
  }
  await sendEmail(a.contactEmail, kind === 'confirmacao' ? 'Consulta confirmada' : kind === 'cancelamento' ? 'Consulta cancelada' : 'Consulta remarcada', text)
}

function refresh(id?: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/agenda')
  if (id) revalidatePath(`/admin/agenda/${id}`)
}

/** Consulta on-line confirmada sem link: cria uma sala no Jitsi Meet (gratuito, sem conta). */
async function meetingFor(a: { modality: string; meetingUrl: string | null }) {
  if (a.modality !== 'online' || a.meetingUrl) return a.meetingUrl
  const s = await getSettings()
  return jitsiRoom(s.professionalName, randomBytes(6).toString('hex'))
}

export async function confirmAppointment(id: string): Promise<void> {
  const user = await requireTeam('agenda')
  const a = await loadAppointment(id)
  if (a.status !== 'pendente') return
  const meetingUrl = await meetingFor(a)
  await db.update(schema.appointments).set({ status: 'confirmada', meetingUrl, updatedAt: new Date() }).where(eq(schema.appointments.id, id))
  await tellPatient(a, 'confirmacao')
  await audit(user, 'consulta_confirmada', 'consulta', { entityId: id, patientId: a.patientId })
  refresh(id)
}

export async function setAppointmentOutcome(id: string, status: 'realizada' | 'faltou'): Promise<void> {
  const user = await requireTeam('agenda')
  const a = await loadAppointment(id)
  if (!['confirmada', 'pendente', 'realizada', 'faltou'].includes(a.status)) return
  await db.update(schema.appointments).set({ status, updatedAt: new Date() }).where(eq(schema.appointments.id, id))
  // Após um atendimento realizado, agenda o próximo retorno conforme a frequência definida.
  if (status === 'realizada' && a.patientId) {
    const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, a.patientId))
    if (p?.followUpDays) {
      const s = await getSettings()
      const base = zonedParts(a.startAt, s.timezone).date
      const next = new Date(Date.parse(base + 'T12:00:00Z') + p.followUpDays * 86_400_000).toISOString().slice(0, 10)
      await db.update(schema.patients).set({ nextFollowUp: next }).where(eq(schema.patients.id, p.id))
    }
  }
  await audit(user, `consulta_${status}`, 'consulta', { entityId: id, patientId: a.patientId })
  refresh(id)
}

export async function cancelAppointment(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireTeam('agenda')
    const a = await loadAppointment(String(fd.get('id')))
    if (!['pendente', 'confirmada'].includes(a.status)) return { error: 'Esta consulta não está ativa.' }
    const reason = String(fd.get('reason') ?? '').trim().slice(0, 300) || null
    await db.update(schema.appointments).set({ status: 'cancelada', cancelReason: reason, updatedAt: new Date() }).where(eq(schema.appointments.id, a.id))
    if (fd.get('notify') === 'on') await tellPatient(a, 'cancelamento')
    await audit(user, 'consulta_cancelada', 'consulta', { entityId: a.id, patientId: a.patientId })
    refresh(a.id)
    return { ok: true, message: 'Consulta cancelada e horário liberado.' }
  } catch (err) {
    return failure(err)
  }
}

export async function rescheduleAppointment(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ id: uuid, day, time, outside: z.string().optional() }).safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await requireTeam('agenda')
    const a = await loadAppointment(parsed.data.id)
    if (!['pendente', 'confirmada'].includes(a.status)) return { error: 'Só é possível remarcar consultas ativas.' }
    const s = await getSettings()
    const duration = (a.endAt.getTime() - a.startAt.getTime()) / 60_000
    if (parsed.data.outside !== 'on' && !fitsWorkingHours(parsed.data.day, parsed.data.time, duration, await getWorkingHours())) {
      return { error: 'Fora do horário de atendimento. Marque “permitir fora do expediente” para confirmar mesmo assim.' }
    }
    const start = zonedToUtc(parsed.data.day, parsed.data.time, s.timezone)
    const end = new Date(start.getTime() + duration * 60_000)
    await db.transaction(async (tx) => {
      await assertFree(tx, start, end, s.bufferMinutes, a.id)
      await tx.update(schema.appointments).set({ startAt: start, endAt: end, reminderSentAt: null, updatedAt: new Date() }).where(eq(schema.appointments.id, a.id))
    })
    await tellPatient({ ...a, startAt: start }, 'remarcacao')
    await audit(user, 'consulta_remarcada', 'consulta', { entityId: a.id, patientId: a.patientId, details: { de: a.startAt.toISOString(), para: start.toISOString() } })
    refresh(a.id)
    return { ok: true, message: 'Consulta remarcada.' }
  } catch (err) {
    return failure(err)
  }
}

export async function updateAppointmentDetails(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      id: uuid,
      meetingUrl: z
        .string()
        .trim()
        .optional()
        .transform((v) => v || null)
        .refine((v) => v === null || /^https:\/\//.test(v), 'Use um link https://'),
      internalNotes: optStr(2000),
    })
    .safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await requireTeam('agenda')
    await loadAppointment(parsed.data.id)
    await db
      .update(schema.appointments)
      .set({ meetingUrl: parsed.data.meetingUrl, internalNotes: parsed.data.internalNotes, updatedAt: new Date() })
      .where(eq(schema.appointments.id, parsed.data.id))
    await audit(user, 'consulta_editada', 'consulta', { entityId: parsed.data.id })
    refresh(parsed.data.id)
    return { ok: true, message: 'Informações salvas.' }
  } catch (err) {
    return failure(err)
  }
}

/** Vincula um agendamento a um paciente existente ou cria o cadastro a partir dele. */
export async function linkAppointmentPatient(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireTeam('cadastro')
    const a = await loadAppointment(String(fd.get('id')))
    const existing = String(fd.get('patientId') ?? '')
    let patientId: string
    if (existing) {
      if (!uuid.safeParse(existing).success) return { error: 'Paciente inválido.' }
      patientId = existing
    } else {
      const [p] = await db
        .insert(schema.patients)
        .values({ fullName: a.contactName, email: a.contactEmail, phone: a.contactPhone, status: 'ativo', stage: 'Avaliação inicial' })
        .returning({ id: schema.patients.id })
      patientId = p.id
      await audit(user, 'paciente_criado', 'paciente', { entityId: p.id, patientId: p.id, details: { origem: 'agendamento' } })
    }
    await db.update(schema.appointments).set({ patientId, updatedAt: new Date() }).where(eq(schema.appointments.id, a.id))
    await db.update(schema.consents).set({ patientId }).where(and(eq(schema.consents.subjectEmail, a.contactEmail)))
    refresh(a.id)
    return { ok: true, message: 'Agendamento vinculado ao cadastro do paciente.' }
  } catch (err) {
    return failure(err)
  }
}

const createSchema = z.object({
  patientId: z.string().optional(),
  name: optStr(120),
  email: z.string().optional(),
  phone: z.string().optional(),
  serviceId: uuid,
  modality: z.enum(['presencial', 'online']),
  day,
  time,
  status: z.enum(['pendente', 'confirmada']),
  outside: z.string().optional(),
  internalNotes: optStr(2000),
})

export async function createAppointmentAdmin(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = createSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  let id = ''
  try {
    const user = await requireTeam('agenda')
    const s = await getSettings()
    const [svc] = await db.select().from(schema.services).where(eq(schema.services.id, d.serviceId))
    if (!svc) return { error: 'Serviço não encontrado.' }
    let contact: { name: string; email: string; phone: string; patientId: string | null }
    if (d.patientId) {
      const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, d.patientId))
      if (!p) return { error: 'Paciente não encontrado.' }
      contact = { name: p.fullName, email: p.email ?? '', phone: p.phone ?? '', patientId: p.id }
    } else {
      const c = z.object({ name: str(120, 'Informe o nome'), email, phone }).safeParse({ name: d.name ?? '', email: d.email ?? '', phone: d.phone ?? '' })
      if (!c.success) return zodErrors(c.error)
      contact = { ...c.data, patientId: null }
    }
    if (d.outside !== 'on' && !fitsWorkingHours(d.day, d.time, svc.durationMinutes, await getWorkingHours())) {
      return { error: 'Fora do horário de atendimento. Marque “permitir fora do expediente” para confirmar mesmo assim.' }
    }
    const start = zonedToUtc(d.day, d.time, s.timezone)
    const end = new Date(start.getTime() + svc.durationMinutes * 60_000)
    await db.transaction(async (tx) => {
      await assertFree(tx, start, end, s.bufferMinutes)
      const [row] = await tx
        .insert(schema.appointments)
        .values({
          patientId: contact.patientId,
          serviceId: svc.id,
          serviceName: svc.name,
          modality: d.modality,
          startAt: start,
          endAt: end,
          status: d.status,
          priceCents: svc.priceCents,
          contactName: contact.name,
          contactEmail: contact.email,
          contactPhone: contact.phone,
          isReturning: Boolean(contact.patientId),
          internalNotes: d.internalNotes,
          meetingUrl: d.status === 'confirmada' ? await meetingFor({ modality: d.modality, meetingUrl: null }) : null,
          source: 'admin',
          code: newCode(),
        })
        .returning({ id: schema.appointments.id })
      id = row.id
    })
    await audit(user, 'consulta_criada', 'consulta', { entityId: id, patientId: contact.patientId })
    refresh()
  } catch (err) {
    return failure(err)
  }
  redirect(`/admin/agenda/${id}`)
}

/** Gera (ou troca) o link da videochamada da consulta. */
export async function generateMeetingLink(id: string): Promise<void> {
  const user = await requireTeam('agenda')
  const a = await loadAppointment(id)
  const s = await getSettings()
  const meetingUrl = jitsiRoom(s.professionalName, randomBytes(6).toString('hex'))
  await db.update(schema.appointments).set({ meetingUrl, updatedAt: new Date() }).where(eq(schema.appointments.id, a.id))
  await audit(user, 'videochamada_gerada', 'consulta', { entityId: a.id, patientId: a.patientId })
  refresh(a.id)
}

/** Bloqueia na agenda os feriados nacionais do ano (e, se marcado, os pontos facultativos). */
export async function importHolidays(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ year: z.coerce.number().int().min(2024).max(2100), optional: z.string().optional() }).safeParse(formObject(fd))
  if (!parsed.success) return { error: 'Ano inválido.' }
  try {
    const user = await requireTeam('agenda')
    const s = await getSettings()
    const existing = await db.select({ startAt: schema.timeBlocks.startAt, reason: schema.timeBlocks.reason }).from(schema.timeBlocks)
    let added = 0
    for (const h of nationalHolidays(parsed.data.year)) {
      if (h.optional && parsed.data.optional !== 'on') continue
      const startAt = zonedToUtc(h.date, '00:00', s.timezone)
      const endAt = zonedToUtc(addDays(h.date, 1), '00:00', s.timezone)
      const reason = `Feriado: ${h.name}`
      if (existing.some((e) => e.startAt.getTime() === startAt.getTime() && e.reason === reason)) continue
      await db.insert(schema.timeBlocks).values({ startAt, endAt, reason, createdBy: user.id })
      added++
    }
    await audit(user, 'feriados_importados', 'agenda', { details: { ano: parsed.data.year, quantidade: added } })
    refresh()
    return { ok: true, message: added ? `${added} feriados de ${parsed.data.year} bloqueados na agenda.` : `Os feriados de ${parsed.data.year} já estavam bloqueados.` }
  } catch (err) {
    return failure(err)
  }
}

const blockSchema = z.object({ day, start: time, endDay: day, end: time, reason: optStr(200) })

export async function createBlock(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = blockSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await requireTeam('agenda')
    const s = await getSettings()
    const startAt = zonedToUtc(parsed.data.day, parsed.data.start, s.timezone)
    const endAt = zonedToUtc(parsed.data.endDay, parsed.data.end, s.timezone)
    if (endAt <= startAt) return { error: 'O fim precisa ser depois do início.' }
    await db.insert(schema.timeBlocks).values({ startAt, endAt, reason: parsed.data.reason ?? '', createdBy: user.id })
    await audit(user, 'bloqueio_criado', 'agenda', { details: { startAt, endAt } })
    refresh()
    return { ok: true, message: 'Horário bloqueado. Ele não aparecerá mais para agendamento.' }
  } catch (err) {
    return failure(err)
  }
}

export async function deleteBlock(id: string): Promise<void> {
  const user = await requireTeam('agenda')
  if (!uuid.safeParse(id).success) return
  await db.delete(schema.timeBlocks).where(eq(schema.timeBlocks.id, id))
  await audit(user, 'bloqueio_removido', 'agenda', { entityId: id })
  refresh()
}
