'use server'

import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { clientIp, getCurrentUser } from '@/lib/auth/session'
import { newCode } from '@/lib/auth/tokens'
import { audit } from '@/lib/audit'
import { assertFree, getService, slotsForDay } from '@/lib/booking'
import { failure, formObject, zodErrors, type ActionState } from '@/lib/action'
import { rateLimit } from '@/lib/rate-limit'
import { getSettings } from '@/lib/settings'
import { notifyTeam } from '@/lib/team'
import { renderTemplate, sendEmail } from '@/lib/notify'
import { fmtDay, zonedToUtc } from '@/lib/time'
import { PRIVACY_VERSION } from '@/lib/constants'
import { day, email, optEmail, optStr, phone, str, time, uuid } from '@/lib/validation'

const bookingSchema = z.object({
  serviceId: uuid,
  modality: z.enum(['presencial', 'online'], 'Escolha a modalidade'),
  day,
  time,
  name: str(120, 'Informe seu nome'),
  email,
  phone,
  returning: z.enum(['sim', 'nao'], 'Informe se já é paciente'),
  notes: optStr(1000),
  consent: z.literal('on', 'É preciso concordar com a Política de Privacidade'),
  plano: z.string().optional(),
})

export async function createBooking(_: ActionState, fd: FormData): Promise<ActionState> {
  if (fd.get('website')) return { error: 'Não foi possível enviar.' } // campo-isca contra robôs
  const ip = (await clientIp()) ?? 'local'
  if (!rateLimit(`booking:${ip}`, 6, 60 * 60_000)) return { error: 'Muitos pedidos seguidos. Tente mais tarde ou fale pelo WhatsApp.' }

  const parsed = bookingSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  let code = ''
  try {
    const s = await getSettings()
    const svc = await getService(d.serviceId)
    if (!svc || !svc.isPublic) return { error: 'Serviço indisponível.' }
    if (svc.modality !== 'ambos' && svc.modality !== d.modality) return { error: 'Modalidade não disponível para este serviço.' }

    const start = zonedToUtc(d.day, d.time, s.timezone)
    const slots = await slotsForDay(d.day, svc.durationMinutes)
    if (!slots.some((x) => x.getTime() === start.getTime())) {
      return { error: 'Este horário não está mais disponível. Volte e escolha outro.' }
    }
    const end = new Date(start.getTime() + svc.durationMinutes * 60_000)
    // Cliente conectado: a consulta fica na ficha dele (não depende do e-mail digitado).
    const user = await getCurrentUser()
    const [patient] =
      user?.role === 'patient' && user.patientId
        ? await db.select({ id: schema.patients.id, packageId: schema.patients.packageId }).from(schema.patients).where(eq(schema.patients.id, user.patientId))
        : await db.select({ id: schema.patients.id, packageId: schema.patients.packageId }).from(schema.patients).where(eq(schema.patients.email, d.email))
    const [plan] =
      d.plano && /^[0-9a-f-]{36}$/.test(d.plano)
        ? await db.select({ id: schema.packages.id, name: schema.packages.name }).from(schema.packages).where(and(eq(schema.packages.id, d.plano), eq(schema.packages.active, true)))
        : []
    const notes = [plan ? `Plano de interesse: ${plan.name}` : null, d.notes].filter(Boolean).join('\n') || null
    code = newCode()

    await db.transaction(async (tx) => {
      await assertFree(tx, start, end, s.bufferMinutes)
      await tx.insert(schema.appointments).values({
        patientId: patient?.id ?? null,
        serviceId: svc.id,
        serviceName: svc.name,
        modality: d.modality,
        startAt: start,
        endAt: end,
        status: 'pendente',
        priceCents: svc.priceCents,
        contactName: d.name,
        contactEmail: d.email,
        contactPhone: d.phone,
        isReturning: d.returning === 'sim',
        patientNotes: notes,
        source: 'site',
        code,
      })
      await tx.insert(schema.consents).values({ subjectEmail: d.email, patientId: patient?.id ?? null, kind: 'agendamento', version: PRIVACY_VERSION })
      if (plan && patient && !patient.packageId) await tx.update(schema.patients).set({ packageId: plan.id, updatedAt: new Date() }).where(eq(schema.patients.id, patient.id))
    })

    await notifyTeam('agenda', 'Novo pedido de agendamento', `${d.name} · ${svc.name} · ${fmtDay(d.day)} ${d.time}`, '/admin/agenda?status=pendente')
    await sendEmail(
      d.email,
      'Recebemos seu pedido de agendamento',
      renderTemplate(
        'Olá, {nome}! Recebemos seu pedido de consulta ({servico}) para {data} às {hora}. Ele será confirmado pela nossa equipe. Código: {codigo}.',
        { nome: d.name, servico: svc.name, data: fmtDay(d.day), hora: d.time, codigo: code },
      ),
    )
    await audit(null, 'agendamento_solicitado', 'consulta', { details: { code } })
  } catch (err) {
    return failure(err)
  }
  redirect(`/agendar/confirmado?codigo=${code}`)
}

const leadSchema = z.object({
  name: str(120, 'Informe seu nome'),
  phone,
  email: optEmail,
  interest: optStr(120),
  message: optStr(1500),
  consent: z.literal('on', 'É preciso concordar com a Política de Privacidade'),
})

export async function createLead(_: ActionState, fd: FormData): Promise<ActionState> {
  if (fd.get('website')) return { ok: true, message: 'Recebemos sua mensagem.' }
  const ip = (await clientIp()) ?? 'local'
  if (!rateLimit(`lead:${ip}`, 5, 60 * 60_000)) return { error: 'Muitas mensagens seguidas. Tente mais tarde.' }
  const parsed = leadSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const d = parsed.data
    await db.insert(schema.leads).values({ name: d.name, phone: d.phone, email: d.email, interest: d.interest, message: d.message, consentAt: new Date() })
    await notifyTeam('site', 'Novo interessado pelo site', `${d.name}${d.interest ? ` · ${d.interest}` : ''}`, '/admin/interessados')
    return { ok: true, message: 'Obrigado! Recebemos seu contato e retornaremos em breve pelo telefone informado.' }
  } catch (err) {
    return failure(err)
  }
}
