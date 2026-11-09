import 'server-only'
import { randomUUID } from 'node:crypto'
import type { MpPayment } from './mercadopago-core'

/**
 * Mercado Pago (Checkout Pro) pela API REST, com `fetch` (sem SDK).
 * O access token fica só no servidor: nunca vai para o navegador, para o banco ou para os logs.
 * `MERCADOPAGO_API_BASE` existe só para os testes (servidor falso local).
 */
const base = () => (process.env.MERCADOPAGO_API_BASE || 'https://api.mercadopago.com').replace(/\/$/, '')

export const mpConfigured = () => Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_WEBHOOK_SECRET)

export class MpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'MpError'
  }
}

async function mp<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new MpError('Mercado Pago não configurado', 0)
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  if (init.method === 'POST') headers['X-Idempotency-Key'] = init.idempotencyKey ?? randomUUID()
  const res = await fetch(`${base()}${path}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) {
    // Só o status e a mensagem do Mercado Pago; nunca o cabeçalho com o token.
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new MpError(`Mercado Pago ${res.status}: ${body?.message ?? res.statusText}`, res.status)
  }
  return (await res.json()) as T
}

export type MpPreferenceInput = {
  paymentId: string
  title: string
  unitPrice: number
  payer: { email: string; name: string }
  appUrl: string
  maxInstallments: number
  statementDescriptor: string
  expiresInDays?: number
}

/** Cria a preferência do Checkout Pro (o link de pagamento) para a cobrança `paymentId`. */
export async function criarPreferencia(i: MpPreferenceInput) {
  const now = new Date()
  const until = new Date(now.getTime() + (i.expiresInDays ?? 3) * 86_400_000)
  const body = {
    items: [{ id: i.paymentId, title: i.title, quantity: 1, currency_id: 'BRL', unit_price: i.unitPrice }],
    payer: { email: i.payer.email, name: i.payer.name },
    external_reference: i.paymentId,
    back_urls: {
      success: `${i.appUrl}/paciente/pagamento/retorno`,
      pending: `${i.appUrl}/paciente/pagamento/retorno`,
      failure: `${i.appUrl}/paciente/pagamento/retorno`,
    },
    auto_return: 'approved',
    notification_url: `${i.appUrl}/api/webhooks/mercadopago`,
    payment_methods: { installments: Math.min(12, Math.max(1, i.maxInstallments)) },
    statement_descriptor: i.statementDescriptor.slice(0, 13),
    expires: true,
    expiration_date_from: now.toISOString(),
    expiration_date_to: until.toISOString(),
  }
  // Mesma cobrança, mesma chave: um clique duplo não cria duas preferências.
  return mp<{ id: string; init_point: string; sandbox_init_point?: string }>('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify(body),
    idempotencyKey: `pref-${i.paymentId}-${i.unitPrice}`,
  })
}

/** Consulta um pagamento (fonte da verdade: nunca confie no corpo da notificação). */
export const buscarPagamento = (id: string | number) => mp<MpPayment>(`/v1/payments/${encodeURIComponent(String(id))}`)

/** Pagamentos de uma cobrança (external_reference = payments.id), do mais recente ao mais antigo. */
export async function buscarPorReferencia(externalReference: string) {
  const r = await mp<{ results: MpPayment[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc`,
  )
  return r.results ?? []
}


/* ------------------------- assinatura (preapproval) ------------------------- */

export type MpPreapproval = {
  id: string
  status: 'pending' | 'authorized' | 'paused' | 'cancelled' | string
  external_reference?: string | null
  init_point?: string
  reason?: string
  auto_recurring?: { transaction_amount?: number; frequency?: number; frequency_type?: string; currency_id?: string }
}
export type MpAuthorizedPayment = {
  id: string | number
  preapproval_id: string
  transaction_amount?: number
  status?: string
  payment?: { id: string | number; status: string; status_detail?: string }
}

/**
 * Assinatura recorrente (sem mensalidade extra do sistema): o cliente autoriza no Mercado Pago e a
 * cobrança mensal acontece no cartão dele. `external_reference` = "assinatura:<cliente>:<plano>".
 */
export async function criarAssinatura(i: { patientId: string; packageId: string; reason: string; amount: number; payerEmail: string; appUrl: string }) {
  return mp<MpPreapproval>('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason: i.reason.slice(0, 120),
      external_reference: `assinatura:${i.patientId}:${i.packageId}`,
      payer_email: i.payerEmail,
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: i.amount, currency_id: 'BRL' },
      back_url: `${i.appUrl}/paciente/pagamento/retorno?assinatura=1`,
      notification_url: `${i.appUrl}/api/webhooks/mercadopago`,
      status: 'pending',
    }),
    idempotencyKey: `ass-${i.patientId}-${i.packageId}-${new Date().toISOString().slice(0, 13)}`,
  })
}
export const buscarAssinatura = (id: string) => mp<MpPreapproval>(`/preapproval/${encodeURIComponent(id)}`)
export const cancelarAssinaturaMP = (id: string) => mp<MpPreapproval>(`/preapproval/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) })
export const buscarCobrancaAssinatura = (id: string | number) => mp<MpAuthorizedPayment>(`/authorized_payments/${encodeURIComponent(String(id))}`)
