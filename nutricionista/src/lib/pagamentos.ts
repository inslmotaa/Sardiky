import 'server-only'
import { and, desc, eq, gte, lt, lte, ne } from 'drizzle-orm'
import { db, schema } from '@/db'
import { audit } from './audit'
import { buscarPorReferencia, criarPreferencia, mpConfigured } from './mercadopago'
import { aplicarPagamentoMP, periodoDoPlano, type LocalStatus, type MpPayment } from './mercadopago-core'
import { notifyUser, sendEmail } from './notify'
import { claimReminder, pushToTeam, pushToUser } from './push'
import { getSettings } from './settings'
import { notifyTeam } from './team'
import { todayIn } from './time'
import { money } from './format'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Actor = { id: string; name: string; role: 'admin' | 'staff' | 'patient' }

const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/* --------------------------------- acesso --------------------------------- */

/**
 * O cliente precisa pagar antes de usar a área? Só quando o Mercado Pago está configurado,
 * o cadastro foi feito pelo site (payment_required) e ainda não há pagamento aprovado.
 * Clientes cadastrados pelo coach ou liberados manualmente nunca ficam bloqueados.
 */
export async function needsPayment(patientId: string) {
  if (!mpConfigured()) return false
  const [p] = await db.select({ required: schema.patients.paymentRequired }).from(schema.patients).where(eq(schema.patients.id, patientId))
  if (!p?.required) return false
  const [paid] = await db
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(and(eq(schema.payments.patientId, patientId), eq(schema.payments.status, 'pago')))
    .limit(1)
  return !paid
}

/**
 * Efeitos de um plano pago (Mercado Pago ou liberação manual): plano do cliente, situação ativa
 * e período (renovação em vigor começa no dia seguinte ao término atual).
 */
export async function liberarPlano(tx: Tx, patientId: string, packageId: string, today: string) {
  const [[p], [pkg]] = await Promise.all([
    tx.select().from(schema.patients).where(eq(schema.patients.id, patientId)),
    tx.select().from(schema.packages).where(eq(schema.packages.id, packageId)),
  ])
  if (!p || !pkg) return null
  const { start, end } = periodoDoPlano(today, p.packageEnd, pkg.months)
  await tx
    .update(schema.patients)
    .set({ packageId: pkg.id, status: 'ativo', packageStart: start, packageEnd: end, paymentRequired: false, updatedAt: new Date() })
    .where(eq(schema.patients.id, patientId))
  return { patient: p, pkg, start, end }
}

/* --------------------------------- cobrança --------------------------------- */

/**
 * Cria (ou reaproveita, se houver uma pendente do mesmo plano com menos de 24 h) a cobrança no sistema
 * e a preferência no Mercado Pago. O valor vem sempre do banco, nunca do navegador.
 */
export async function iniciarCobranca(patientId: string, packageId: string, actor: Actor) {
  const s = await getSettings()
  const [[pkg], [patient]] = await Promise.all([
    db.select().from(schema.packages).where(and(eq(schema.packages.id, packageId), eq(schema.packages.active, true))),
    db.select().from(schema.patients).where(eq(schema.patients.id, patientId)),
  ])
  if (!pkg) throw new Error('Plano indisponível.')
  if (!patient) throw new Error('Cliente não encontrado.')
  const since = new Date(Date.now() - 24 * 3_600_000)
  let [row] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.patientId, patientId),
        eq(schema.payments.packageId, pkg.id),
        eq(schema.payments.status, 'pendente'),
        eq(schema.payments.provider, 'mercadopago'),
        eq(schema.payments.amountCents, pkg.priceCents),
        gte(schema.payments.createdAt, since),
      ),
    )
    .orderBy(desc(schema.payments.createdAt))
    .limit(1)
  if (!row) {
    ;[row] = await db
      .insert(schema.payments)
      .values({
        patientId,
        packageId: pkg.id,
        description: `Plano ${pkg.name}`,
        amountCents: pkg.priceCents,
        status: 'pendente',
        source: 'provedor',
        provider: 'mercadopago',
        dueDate: todayIn(s.timezone),
        createdBy: actor.id,
      })
      .returning()
  }
  const pref = await criarPreferencia({
    paymentId: row.id,
    title: `Acompanhamento ${pkg.name} — ${s.siteName}`,
    unitPrice: pkg.priceCents / 100,
    payer: { email: patient.email ?? '', name: patient.fullName },
    appUrl: appUrl(),
    maxInstallments: s.mpMaxInstallments,
    statementDescriptor: s.mpStatementDescriptor || 'FARION',
  })
  await db.update(schema.payments).set({ providerPreferenceId: pref.id }).where(eq(schema.payments.id, row.id))
  await audit(actor, 'cobranca_mercadopago_criada', 'pagamento', { entityId: row.id, patientId, details: { plano: pkg.name, valor: pkg.priceCents } })
  return { paymentId: row.id, initPoint: pref.init_point, pkg }
}

/* ------------------------------ confirmação ------------------------------ */

export type ProcessResult = { status: LocalStatus | null; aprovou: boolean; ignorado?: string }

/**
 * Aplica um pagamento do Mercado Pago (já buscado na API) à cobrança correspondente.
 * Usado pelo webhook, pela página de retorno e pela conciliação do cron. Idempotente.
 * `onlyPatientId`: a página de retorno só aplica pagamentos do próprio cliente.
 */
export async function processarPagamentoMP(mp: MpPayment, origem: 'webhook' | 'retorno' | 'cron', onlyPatientId?: string): Promise<ProcessResult> {
  const ref = mp.external_reference ?? ''
  if (!/^[0-9a-f-]{36}$/.test(ref)) return { status: null, aprovou: false, ignorado: 'sem referência' }
  const [row] = await db.select().from(schema.payments).where(and(eq(schema.payments.id, ref), eq(schema.payments.provider, 'mercadopago')))
  if (!row) return { status: null, aprovou: false, ignorado: 'cobrança não encontrada' }
  if (onlyPatientId && row.patientId !== onlyPatientId) return { status: null, aprovou: false, ignorado: 'outro cliente' }
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const decision = aplicarPagamentoMP(mp, { id: row.id, status: row.status, amountCents: row.amountCents, providerRef: row.providerRef, providerStatus: row.providerStatus }, today)

  if (decision.kind === 'nada') return { status: row.status, aprovou: false }
  if (decision.kind === 'divergencia') {
    // Avisa uma vez por pagamento divergente (o Mercado Pago reenvia a mesma notificação).
    const marker = `divergente:${mp.id}`
    if (row.providerStatus !== marker) {
      await db.update(schema.payments).set({ providerStatus: marker, providerRef: String(mp.id) }).where(eq(schema.payments.id, row.id))
      await audit(null, 'pagamento_divergente', 'pagamento', {
        entityId: row.id,
        patientId: row.patientId,
        details: { origem, motivo: decision.motivo, mp: mp.id, status: mp.status },
        actorLabel: 'Mercado Pago',
      })
      await notifyTeam('financeiro', 'Pagamento com valor divergente', `Cobrança ${row.description}: ${decision.motivo}. O acesso não foi liberado.`, row.patientId ? `/admin/pacientes/${row.patientId}?aba=financeiro` : '/admin/financeiro', row.patientId)
    }
    return { status: row.status, aprovou: false, ignorado: 'divergência' }
  }

  const { set } = decision
  let approved: Awaited<ReturnType<typeof liberarPlano>> = null
  let changed = false
  await db.transaction(async (tx) => {
    // Só aplica se o lançamento ainda estiver como lido (duas notificações ao mesmo tempo não aprovam duas vezes).
    const updated = await tx
      .update(schema.payments)
      .set({ status: set.status, providerRef: set.providerRef, providerStatus: set.providerStatus, ...(set.method ? { method: set.method } : {}), ...(set.paidAt ? { paidAt: set.paidAt } : {}) })
      .where(and(eq(schema.payments.id, row.id), eq(schema.payments.status, row.status)))
      .returning({ id: schema.payments.id })
    changed = updated.length > 0
    if (changed && decision.aprovou && row.patientId && row.packageId) approved = await liberarPlano(tx, row.patientId, row.packageId, today)
  })
  if (!changed) return { status: null, aprovou: false, ignorado: 'já atualizado' }

  if (decision.aprovou && approved) {
    const a = approved as NonNullable<Awaited<ReturnType<typeof liberarPlano>>>
    const link = `/admin/pacientes/${a.patient.id}?aba=financeiro`
    const title = `${a.patient.fullName} pagou o plano ${a.pkg.name}`
    await notifyTeam('financeiro', title, `${money(row.amountCents)} · ${set.method ?? 'Mercado Pago'}`, link, a.patient.id)
    await pushToTeam('financeiro', { title, body: money(row.amountCents), url: link, tag: `pagamento-${row.id}` }, a.patient.id)
    if (a.patient.userId) {
      await notifyUser(a.patient.userId, 'Pagamento confirmado', `Plano ${a.pkg.name}. Agora é só responder a anamnese.`, '/paciente/anamnese')
      await pushToUser(a.patient.userId, 'plano', { title: 'Pagamento confirmado', body: `Plano ${a.pkg.name}`, url: '/paciente', tag: 'pagamento' })
    }
    if (a.patient.email)
      await sendEmail(
        a.patient.email,
        'Pagamento confirmado',
        `Olá, ${a.patient.fullName.split(' ')[0]}!\n\nRecebemos o pagamento do Plano ${a.pkg.name} (${money(row.amountCents)}).\nPróximo passo: responda a anamnese em ${appUrl()}/paciente/anamnese\n`,
      )
    await audit(null, 'pagamento_aprovado', 'pagamento', {
      entityId: row.id,
      patientId: a.patient.id,
      details: { origem, mp: mp.id, plano: a.pkg.name, inicio: a.start, termino: a.end, metodo: set.method },
      actorLabel: 'Mercado Pago',
    })
  } else if (decision.estornou) {
    // Estorno: avisa o coach; quem decide se desativa o cliente é ele.
    await notifyTeam('financeiro', 'Pagamento estornado', `${row.description} (${money(row.amountCents)}) foi estornado no Mercado Pago.`, row.patientId ? `/admin/pacientes/${row.patientId}?aba=financeiro` : '/admin/financeiro', row.patientId)
    await audit(null, 'pagamento_estornado', 'pagamento', { entityId: row.id, patientId: row.patientId, details: { origem, mp: mp.id, status: mp.status }, actorLabel: 'Mercado Pago' })
  } else {
    await audit(null, 'pagamento_atualizado', 'pagamento', { entityId: row.id, patientId: row.patientId, details: { origem, mp: mp.id, status: mp.status }, actorLabel: 'Mercado Pago' })
  }
  return { status: set.status, aprovou: Boolean(decision.aprovou && approved) }
}

/**
 * Conciliação (cron, a cada 5 min): cobranças pendentes do Mercado Pago com menos de 7 dias são
 * consultadas pela referência; as mais antigas viram "cancelado".
 */
export async function conciliarPendentes(now = new Date()) {
  if (!mpConfigured()) return { consultadas: 0, canceladas: 0 }
  const limit = new Date(now.getTime() - 7 * 86_400_000)
  const pend = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.provider, 'mercadopago'), eq(schema.payments.status, 'pendente'), gte(schema.payments.createdAt, limit)))
  let consultadas = 0
  for (const row of pend) {
    try {
      const found = await buscarPorReferencia(row.id)
      consultadas++
      // O pagamento aprovado prevalece; sem ele, o mais recente.
      const best = found.find((p) => p.status === 'approved') ?? found[0]
      if (best) await processarPagamentoMP({ ...best, external_reference: row.id }, 'cron')
    } catch {
      // Falha de rede: tenta de novo na próxima rodada.
    }
  }
  const old = await db
    .update(schema.payments)
    .set({ status: 'cancelado', providerStatus: 'expired_local' })
    .where(and(eq(schema.payments.provider, 'mercadopago'), eq(schema.payments.status, 'pendente'), lt(schema.payments.createdAt, limit)))
    .returning({ id: schema.payments.id })
  return { consultadas, canceladas: old.length }
}

/**
 * Lembrete de renovação, uma única vez por término (reminder_log): faltando até 7 dias para o fim
 * do plano pago, push e e-mail para o cliente com o link de renovação.
 */
export async function lembretesDeRenovacao() {
  if (!mpConfigured()) return 0
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const limit = addDaysIso(today, 7)
  const due = await db
    .select({ id: schema.patients.id, userId: schema.patients.userId, name: schema.patients.fullName, email: schema.patients.email, end: schema.patients.packageEnd })
    .from(schema.patients)
    .where(and(eq(schema.patients.status, 'ativo'), gte(schema.patients.packageEnd, today), lte(schema.patients.packageEnd, limit)))
  let sent = 0
  for (const p of due) {
    if (!p.userId || !p.end || !(await claimReminder(p.userId, 'renovacao', p.end))) continue
    const days = Math.round((Date.parse(p.end) - Date.parse(today)) / 86_400_000)
    const body = days === 0 ? 'Seu plano termina hoje. Renove para continuar o acompanhamento.' : `Seu plano termina em ${days} ${days === 1 ? 'dia' : 'dias'}. Renove para continuar o acompanhamento.`
    await notifyUser(p.userId, 'Renove o seu plano', body, '/paciente/pagamento')
    await pushToUser(p.userId, 'lembretes', { title: 'Renove o seu plano', body, url: '/paciente/pagamento', tag: 'renovacao' })
    if (p.email) await sendEmail(p.email, 'Seu plano está terminando', `Olá, ${p.name.split(' ')[0]}!\n\n${body}\nRenove em ${appUrl()}/paciente/pagamento\n`)
    sent++
  }
  return sent
}

const addDaysIso = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/* ------------------------------ resumo e painel ------------------------------ */

/** Situação de pagamento da área do cliente: cobrança em aberto mais recente e pagamento aprovado. */
export async function paymentState(patientId: string) {
  const rows = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.patientId, patientId), ne(schema.payments.status, 'cancelado')))
    .orderBy(desc(schema.payments.createdAt))
    .limit(20)
  return {
    open: rows.find((r) => r.status === 'pendente' && r.provider === 'mercadopago') ?? null,
    paid: rows.find((r) => r.status === 'pago') ?? null,
  }
}

