/**
 * Regras do Mercado Pago sem acesso a banco nem rede (funções puras, testadas em tests/unit/mercadopago.test.ts):
 * assinatura do webhook, tradução de status, conferência de valor e período do plano pago.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

/* ----------------------------- assinatura do webhook ----------------------------- */

/**
 * Valida o cabeçalho `x-signature` das notificações (Webhooks) do Mercado Pago.
 *
 * Formato (documentação "Notificações > Webhooks", seção "Validar origem da notificação"):
 * https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *   - `x-signature: ts=<timestamp>,v1=<hash>`
 *   - texto assinado (manifest): `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 *     · `data.id` vem da query string (`?data.id=…`) e, se for alfanumérico, vai em minúsculas;
 *     · partes que não vierem na notificação são omitidas do texto;
 *   - `v1` = HMAC-SHA256 em hexadecimal do texto, com a "assinatura secreta" do painel.
 * Recusa também notificações com `ts` mais velho que `maxAgeMs` (padrão: 10 minutos).
 * O `ts` do Mercado Pago vem em milissegundos; aceitamos também segundos.
 */
export function verifyMpSignature(o: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
  secret: string
  now?: number
  maxAgeMs?: number
}): { ok: true } | { ok: false; reason: string } {
  if (!o.secret) return { ok: false, reason: 'segredo ausente' }
  if (!o.xSignature) return { ok: false, reason: 'sem assinatura' }
  const parts = Object.fromEntries(
    o.xSignature.split(',').map((p) => {
      const i = p.indexOf('=')
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    }),
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1 || !/^\d+$/.test(ts) || !/^[0-9a-f]+$/i.test(v1)) return { ok: false, reason: 'assinatura malformada' }
  const tsMs = ts.length <= 10 ? Number(ts) * 1000 : Number(ts)
  const now = o.now ?? Date.now()
  if (Math.abs(now - tsMs) > (o.maxAgeMs ?? 10 * 60_000)) return { ok: false, reason: 'notificação antiga' }
  const id = o.dataId ? (/^[a-z0-9]+$/i.test(o.dataId) ? o.dataId.toLowerCase() : o.dataId) : null
  const manifest = `${id ? `id:${id};` : ''}${o.xRequestId ? `request-id:${o.xRequestId};` : ''}ts:${ts};`
  const expected = createHmac('sha256', o.secret).update(manifest).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(v1.toLowerCase(), 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'assinatura inválida' }
  return { ok: true }
}

/** Gera um `x-signature` válido (usado no servidor falso dos testes e na documentação). */
export function signMpNotification(o: { dataId: string | null; xRequestId: string | null; ts: number; secret: string }) {
  const id = o.dataId ? (/^[a-z0-9]+$/i.test(o.dataId) ? o.dataId.toLowerCase() : o.dataId) : null
  const manifest = `${id ? `id:${id};` : ''}${o.xRequestId ? `request-id:${o.xRequestId};` : ''}ts:${o.ts};`
  return `ts=${o.ts},v1=${createHmac('sha256', o.secret).update(manifest).digest('hex')}`
}

/* ------------------------------- status e regras ------------------------------- */

export type LocalStatus = 'pendente' | 'pago' | 'cancelado' | 'estornado'

/** Status do Mercado Pago → status do lançamento no sistema. */
export function traduzirStatusMP(status: string | null | undefined): LocalStatus {
  switch (status) {
    case 'approved':
      return 'pago'
    case 'refunded':
    case 'charged_back':
      return 'estornado'
    case 'rejected':
    case 'cancelled':
    case 'expired':
      return 'cancelado'
    default:
      // pending, in_process, authorized, in_mediation e desconhecidos: aguardando.
      return 'pendente'
  }
}

/** O que importa de um pagamento do Mercado Pago (GET /v1/payments/{id}). */
export type MpPayment = {
  id: number | string
  status: string
  status_detail?: string
  external_reference?: string | null
  transaction_amount?: number
  currency_id?: string
  payment_type_id?: string
  payment_method_id?: string
  date_approved?: string | null
}

/** A linha de `payments` que a cobrança representa. */
export type PaymentRow = { id: string; status: LocalStatus; amountCents: number; providerRef: string | null; providerStatus: string | null }

export type MpDecision =
  | { kind: 'divergencia'; motivo: string }
  | { kind: 'nada' }
  | {
      kind: 'atualizar'
      set: { status: LocalStatus; providerRef: string; providerStatus: string; method?: string | null; paidAt?: string | null }
      /** true só quando esta notificação é a que torna o lançamento "pago" (libera o acesso uma única vez). */
      aprovou: boolean
      /** true só quando o lançamento passa a "estornado". */
      estornou: boolean
    }

const METHOD_LABEL: Record<string, string> = {
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  ticket: 'Boleto',
  bank_transfer: 'Pix',
  account_money: 'Saldo Mercado Pago',
  prepaid_card: 'Cartão pré-pago',
}

/** Forma de pagamento legível: "Pix", "Cartão de crédito (visa)", "Boleto (bolbradesco)". */
export function metodoMP(p: Pick<MpPayment, 'payment_type_id' | 'payment_method_id'>) {
  if (p.payment_method_id === 'pix') return 'Pix'
  const type = p.payment_type_id ? (METHOD_LABEL[p.payment_type_id] ?? p.payment_type_id) : null
  if (!type) return p.payment_method_id ?? null
  return p.payment_method_id && type !== 'Pix' ? `${type} (${p.payment_method_id})` : type
}

/**
 * Regra única, usada pelo webhook, pela página de retorno e pela conciliação do cron.
 * Idempotente: aplicada várias vezes ao mesmo pagamento, dá o mesmo resultado e só aprova uma vez.
 * Nunca libera se o valor ou a moeda não baterem com a cobrança.
 */
export function aplicarPagamentoMP(mp: MpPayment, row: PaymentRow, today: string): MpDecision {
  const next = traduzirStatusMP(mp.status)
  if (next === 'pago' || next === 'pendente') {
    const cents = Math.round(Number(mp.transaction_amount ?? NaN) * 100)
    if (mp.currency_id !== 'BRL') return { kind: 'divergencia', motivo: `moeda ${mp.currency_id ?? 'ausente'} (esperado BRL)` }
    if (!Number.isFinite(cents) || cents !== row.amountCents) return { kind: 'divergencia', motivo: `valor ${cents / 100} (esperado ${row.amountCents / 100})` }
  }
  const ref = String(mp.id)
  // Já pago: só um estorno muda alguma coisa (um "pendente" atrasado não desfaz a aprovação).
  if (row.status === 'pago' && next !== 'estornado') {
    return row.providerRef === ref && row.providerStatus === mp.status ? { kind: 'nada' } : { kind: 'atualizar', set: { status: 'pago', providerRef: ref, providerStatus: mp.status }, aprovou: false, estornou: false }
  }
  if (row.status === 'estornado') return { kind: 'nada' }
  if (row.status === next && row.providerRef === ref && row.providerStatus === mp.status) return { kind: 'nada' }
  const set: Extract<MpDecision, { kind: 'atualizar' }>['set'] = { status: next, providerRef: ref, providerStatus: mp.status }
  if (next === 'pago') {
    set.method = metodoMP(mp)
    set.paidAt = mp.date_approved ? mp.date_approved.slice(0, 10) : today
  }
  return { kind: 'atualizar', set, aprovou: next === 'pago' && row.status !== 'pago', estornou: next === 'estornado' }
}

/* ------------------------------- período do plano ------------------------------- */

const addDaysIso = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const addMonthsIso = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1, 12))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate()
  first.setUTCDate(Math.min(d, last))
  return first.toISOString().slice(0, 10)
}

/**
 * Período do plano pago: começa hoje ou, se for renovação com o plano atual ainda em vigor,
 * no dia seguinte ao término atual. Termina em início + meses − 1 dia.
 */
export function periodoDoPlano(today: string, currentEnd: string | null, months: number) {
  const start = currentEnd && currentEnd >= today ? addDaysIso(currentEnd, 1) : today
  const end = addDaysIso(addMonthsIso(start, Math.max(1, months)), -1)
  return { start, end }
}

/** Link do pagamento no painel do Mercado Pago (Atividade da conta, busca pelo número da operação). */
export const linkNoPainelMP = (paymentRef: string) => `https://www.mercadopago.com.br/activities?q=${encodeURIComponent(paymentRef)}`
