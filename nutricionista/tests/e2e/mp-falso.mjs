// Servidor falso do Mercado Pago para os testes de ponta a ponta (nunca usado em produção).
// O sistema fala com ele quando MERCADOPAGO_API_BASE aponta para cá (playwright.config.ts).
// Imita o que o sistema usa da API real:
//   POST /checkout/preferences          → { id, init_point }
//   GET  /checkout/:pref                → página de checkout com "Aprovar", "Pix (pendente)" e "Recusar"
//   GET  /v1/payments/:id               → pagamento
//   GET  /v1/payments/search?external_reference=…
// e, como o Mercado Pago, envia a notificação assinada (x-signature) ao aprovar.
// Rotas só de teste: POST /__test/aprovar/:id (Pix pago depois, sem notificação) e GET /__health.
import { createHmac } from 'node:crypto'
import http from 'node:http'

const PORT = Number(process.env.MP_FAKE_PORT ?? 3299)
const TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN ?? 'TEST-token-falso'
const SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? 'segredo-webhook-teste'
const prefs = new Map()
const payments = new Map()
let seq = 0

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}
const readBody = (req) =>
  new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data ? JSON.parse(data) : null))
  })
const sign = (dataId, requestId, ts) => {
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`
  return `ts=${ts},v1=${createHmac('sha256', SECRET).update(manifest).digest('hex')}`
}

async function notify(pref, payment) {
  const url = new URL(pref.notification_url)
  url.searchParams.set('data.id', String(payment.id))
  url.searchParams.set('type', 'payment')
  const requestId = `req-${payment.id}-${Date.now()}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signature': sign(payment.id, requestId, Date.now()), 'x-request-id': requestId },
    body: JSON.stringify({ type: 'payment', action: 'payment.created', data: { id: String(payment.id) } }),
  })
  return res.status
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const parts = url.pathname.split('/').filter(Boolean)
  if (url.pathname === '/__health') return json(res, 200, { ok: true })

  // Páginas do "checkout" (abertas pelo navegador, sem token).
  if (parts[0] === 'checkout' && parts[1] && req.method === 'GET') {
    const pref = prefs.get(parts[1])
    if (!pref) return json(res, 404, { message: 'preference not found' })
    if (parts[2] === 'pagar') {
      const result = url.searchParams.get('resultado') ?? 'aprovado'
      const status = result === 'aprovado' ? 'approved' : result === 'pix' ? 'pending' : 'rejected'
      const payment = {
        id: 5000 + ++seq,
        status,
        status_detail: status === 'approved' ? 'accredited' : status === 'pending' ? 'pending_waiting_transfer' : 'cc_rejected_other_reason',
        external_reference: pref.external_reference,
        transaction_amount: pref.items[0].unit_price,
        currency_id: pref.items[0].currency_id,
        payment_type_id: status === 'pending' ? 'bank_transfer' : 'credit_card',
        payment_method_id: status === 'pending' ? 'pix' : 'visa',
        date_approved: status === 'approved' ? new Date().toISOString() : null,
      }
      payments.set(String(payment.id), payment)
      if (status === 'approved') await notify(pref, payment).catch(() => 0)
      const back = new URL(status === 'approved' ? pref.back_urls.success : status === 'pending' ? pref.back_urls.pending : pref.back_urls.failure)
      back.searchParams.set('payment_id', String(payment.id))
      back.searchParams.set('collection_id', String(payment.id))
      back.searchParams.set('status', status)
      back.searchParams.set('external_reference', pref.external_reference)
      back.searchParams.set('preference_id', pref.id)
      res.writeHead(302, { Location: back.toString() })
      return res.end()
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    const link = (r, label) => `<p><a href="/checkout/${pref.id}/pagar?resultado=${r}">${label}</a></p>`
    return res.end(
      `<!doctype html><title>Mercado Pago (teste)</title><h1>Checkout de teste</h1><p>${pref.items[0].title} · R$ ${pref.items[0].unit_price}</p>` +
        `<p>Parcelas: até ${pref.payment_methods?.installments}x · Fatura: ${pref.statement_descriptor}</p>` +
        link('aprovado', 'Pagar com cartão (aprovado)') +
        link('pix', 'Pagar com Pix (pendente)') +
        link('recusado', 'Cartão recusado'),
    )
  }

  if (url.pathname.startsWith('/__test/aprovar/') && req.method === 'POST') {
    const p = payments.get(parts[2])
    if (!p) return json(res, 404, { message: 'not found' })
    Object.assign(p, { status: 'approved', status_detail: 'accredited', date_approved: new Date().toISOString() })
    return json(res, 200, p)
  }

  // API (exige o token).
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(res, 401, { message: 'invalid access token' })
  if (url.pathname === '/checkout/preferences' && req.method === 'POST') {
    if (!req.headers['x-idempotency-key']) return json(res, 400, { message: 'missing X-Idempotency-Key' })
    const body = await readBody(req)
    const id = `pref-${++seq}`
    prefs.set(id, { ...body, id })
    return json(res, 201, { id, init_point: `http://localhost:${PORT}/checkout/${id}` })
  }
  if (url.pathname === '/v1/payments/search' && req.method === 'GET') {
    const ref = url.searchParams.get('external_reference')
    const results = [...payments.values()].filter((p) => p.external_reference === ref).reverse()
    return json(res, 200, { results, paging: { total: results.length } })
  }
  if (parts[0] === 'v1' && parts[1] === 'payments' && parts[2] && req.method === 'GET') {
    const p = payments.get(parts[2])
    return p ? json(res, 200, p) : json(res, 404, { message: 'Payment not found' })
  }
  return json(res, 404, { message: 'not found' })
})

server.listen(PORT, () => console.log(`Mercado Pago falso em http://localhost:${PORT}`))
