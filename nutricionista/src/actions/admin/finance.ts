'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { failure, formObject, UserError, zodErrors, type ActionState } from '@/lib/action'
import { parseMoney } from '@/lib/format'
import { getSettings } from '@/lib/settings'
import { todayIn } from '@/lib/time'
import { int, optDay, optStr, str, uuid } from '@/lib/validation'
import { titledLines } from '@/lib/planos'
import { assertPatientAccess } from '@/lib/team-access'
import { mpConfigured } from '@/lib/mercadopago'
import { iniciarCobranca, liberarPlano } from '@/lib/pagamentos'
import { notifyUser } from '@/lib/notify'

const money = (msg = 'Valor inválido') =>
  z
    .string()
    .optional()
    .transform((v) => (v ? parseMoney(v) : 0))
    .refine((v) => v !== null, msg)
    .transform((v) => v ?? 0)

const paymentSchema = z.object({
  patientId: z
    .string()
    .optional()
    .transform((v) => v || null),
  packageId: z
    .string()
    .optional()
    .transform((v) => v || null),
  description: str(200, 'Descreva o lançamento'),
  amount: money(),
  discount: money('Desconto inválido'),
  discountReason: optStr(200),
  status: z.enum(['pendente', 'pago']),
  method: optStr(40),
  dueDate: optDay,
  paidAt: optDay,
})

async function ensureFinance() {
  const user = await requireTeam('financeiro')
  const s = await getSettings()
  if (!s.financeEnabled) throw new UserError('O módulo financeiro está desativado nas configurações.')
  return user
}

export async function createPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = paymentSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  if (d.amount <= 0) return { fieldErrors: { amount: 'Informe o valor' }, error: 'Informe o valor.' }
  if (d.discount > d.amount) return { fieldErrors: { discount: 'Desconto maior que o valor' }, error: 'Desconto maior que o valor.' }
  if (d.discount > 0 && !d.discountReason) return { fieldErrors: { discountReason: 'Informe o motivo do desconto' }, error: 'Informe o motivo do desconto.' }
  try {
    const user = await ensureFinance()
    const s = await getSettings()
    const [row] = await db
      .insert(schema.payments)
      .values({
        patientId: d.patientId,
        packageId: d.packageId,
        description: d.description,
        amountCents: d.amount,
        discountCents: d.discount,
        discountReason: d.discountReason,
        status: d.status,
        method: d.method,
        dueDate: d.dueDate,
        paidAt: d.status === 'pago' ? (d.paidAt ?? todayIn(s.timezone)) : null,
        source: 'manual', // registro interno; nunca marcado como confirmado por provedor
        createdBy: user.id,
      })
      .returning({ id: schema.payments.id })
    await audit(user, 'lancamento_criado', 'pagamento', { entityId: row.id, patientId: d.patientId, details: { valor: d.amount, status: d.status } })
    revalidatePath('/admin/financeiro')
    if (d.patientId) revalidatePath(`/admin/pacientes/${d.patientId}`)
    return { ok: true, message: 'Lançamento registrado.' }
  } catch (err) {
    return failure(err)
  }
}

export async function markPaymentPaid(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ id: uuid, method: optStr(40), paidAt: optDay }).safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await ensureFinance()
    const s = await getSettings()
    const [p] = await db.select().from(schema.payments).where(eq(schema.payments.id, parsed.data.id))
    if (!p || p.status !== 'pendente') return { error: 'Lançamento não está pendente.' }
    await db
      .update(schema.payments)
      .set({ status: 'pago', method: parsed.data.method ?? p.method, paidAt: parsed.data.paidAt ?? todayIn(s.timezone) })
      .where(eq(schema.payments.id, p.id))
    await audit(user, 'pagamento_registrado', 'pagamento', { entityId: p.id, patientId: p.patientId })
    revalidatePath('/admin/financeiro')
    return { ok: true, message: 'Pagamento registrado.' }
  } catch (err) {
    return failure(err)
  }
}

export async function setPaymentStatus(id: string, status: 'cancelado' | 'estornado' | 'pendente'): Promise<void> {
  const user = await ensureFinance()
  if (!uuid.safeParse(id).success) return
  await db.update(schema.payments).set({ status, paidAt: status === 'pendente' ? null : undefined }).where(eq(schema.payments.id, id))
  await audit(user, `pagamento_${status}`, 'pagamento', { entityId: id })
  revalidatePath('/admin/financeiro')
}

/** Lança a cobrança de uma consulta realizada, usando o valor registrado no agendamento. */
export async function chargeAppointment(appointmentId: string): Promise<void> {
  const user = await ensureFinance()
  const [a] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, appointmentId))
  if (!a) return
  const [exists] = await db.select({ id: schema.payments.id }).from(schema.payments).where(eq(schema.payments.appointmentId, a.id))
  if (exists) return
  await db.insert(schema.payments).values({ patientId: a.patientId, appointmentId: a.id, description: a.serviceName, amountCents: a.priceCents, status: 'pendente', createdBy: user.id })
  await audit(user, 'lancamento_criado', 'pagamento', { patientId: a.patientId, details: { consulta: a.id } })
  revalidatePath('/admin/financeiro')
}

const packageSchema = z.object({
  id: z.string().optional(),
  name: str(80, 'Dê um nome ao plano'),
  description: optStr(300),
  months: int(1, 36),
  price: z
    .string()
    .transform((v) => parseMoney(v))
    .refine((v) => v !== null && v > 0, 'Valor inválido'),
  highlight: optStr(40),
  perks: z.string().max(2000).optional(),
  sort: int(0, 99),
})

/** Cria ou atualiza um plano de acompanhamento (o que aparece na seção "Planos" do site). */
export async function savePackage(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = packageSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await ensureFinance()
    const { id, price, perks, ...rest } = parsed.data
    const values = {
      ...rest,
      description: rest.description ?? '',
      priceCents: price!,
      // Validade usada no financeiro: a duração do plano em dias.
      validityDays: rest.months === 12 ? 365 : rest.months * 30,
      perks: titledLines(perks),
    }
    if (id) {
      if (!uuid.safeParse(id).success) return { error: 'Plano inválido.' }
      await db.update(schema.packages).set(values).where(eq(schema.packages.id, id))
      await audit(user, 'pacote_atualizado', 'pacote', { entityId: id, details: { nome: rest.name } })
    } else {
      await db.insert(schema.packages).values(values)
      await audit(user, 'pacote_criado', 'pacote', { details: { nome: rest.name } })
    }
    revalidatePath('/admin/financeiro')
    revalidatePath('/')
    return { ok: true, message: id ? 'Plano atualizado.' : 'Plano criado.' }
  } catch (err) {
    return failure(err)
  }
}

export async function togglePackage(id: string): Promise<void> {
  const user = await ensureFinance()
  if (!uuid.safeParse(id).success) return
  const [p] = await db.select().from(schema.packages).where(eq(schema.packages.id, id))
  if (!p) return
  await db.update(schema.packages).set({ active: !p.active }).where(eq(schema.packages.id, id))
  await audit(user, p.active ? 'pacote_desativado' : 'pacote_ativado', 'pacote', { entityId: id })
  revalidatePath('/admin/financeiro')
  revalidatePath('/')
}

/* --------------------------- Mercado Pago (painel) --------------------------- */

const planChoice = z.object({ packageId: z.string().refine((v) => uuid.safeParse(v).success, 'Escolha o plano') })

/**
 * Gera o link de pagamento (Checkout Pro) de um plano para o cliente, para copiar ou mandar pelo WhatsApp.
 * Exige a permissão financeiro e acesso ao cliente.
 */
export async function gerarLinkPagamento(patientId: string, _: ActionState, fd: FormData): Promise<ActionState & { url?: string }> {
  const parsed = planChoice.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await ensureFinance()
    if (!uuid.safeParse(patientId).success) return { error: 'Cliente inválido.' }
    await assertPatientAccess(user, patientId)
    if (!mpConfigured()) return { error: 'Mercado Pago não configurado.' }
    const r = await iniciarCobranca(patientId, parsed.data.packageId, user)
    revalidatePath(`/admin/pacientes/${patientId}`)
    return { ok: true, message: `Link do Plano ${r.pkg.name} gerado (válido por 3 dias).`, url: r.initPoint }
  } catch (err) {
    return failure(err)
  }
}

/**
 * "Liberar sem pagamento on-line": para quem pagou por fora. Cria o lançamento manual pago do plano
 * e libera o acesso com o mesmo período de um pagamento aprovado. Grava auditoria.
 */
export async function liberarSemPagamentoOnline(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = planChoice.extend({ method: optStr(40) }).safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await ensureFinance()
    if (!uuid.safeParse(patientId).success) return { error: 'Cliente inválido.' }
    await assertPatientAccess(user, patientId)
    const s = await getSettings()
    const today = todayIn(s.timezone)
    const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, parsed.data.packageId))
    if (!pkg) return { error: 'Plano não encontrado.' }
    let period: Awaited<ReturnType<typeof liberarPlano>> = null
    await db.transaction(async (tx) => {
      await tx.insert(schema.payments).values({
        patientId,
        packageId: pkg.id,
        description: `Plano ${pkg.name} (pago por fora)`,
        amountCents: pkg.priceCents,
        status: 'pago',
        method: parsed.data.method ?? 'Fora do sistema',
        dueDate: today,
        paidAt: today,
        source: 'manual',
        createdBy: user.id,
      })
      period = await liberarPlano(tx, patientId, pkg.id, today)
    })
    const p = period as Awaited<ReturnType<typeof liberarPlano>>
    await audit(user, 'acesso_liberado_sem_pagamento_online', 'pagamento', { patientId, details: { plano: pkg.name, inicio: p?.start, termino: p?.end } })
    if (p?.patient.userId) await notifyUser(p.patient.userId, 'Acesso liberado', `Plano ${pkg.name}. Agora é só responder a anamnese.`, '/paciente/anamnese')
    revalidatePath(`/admin/pacientes/${patientId}`)
    revalidatePath('/admin/financeiro')
    return { ok: true, message: `Acesso liberado: Plano ${pkg.name}${p ? ` até ${p.end.split('-').reverse().join('/')}` : ''}.` }
  } catch (err) {
    return failure(err)
  }
}
