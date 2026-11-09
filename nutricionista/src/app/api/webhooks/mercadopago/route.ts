import { verifyMpSignature } from '@/lib/mercadopago-core'
import { buscarPagamento, mpConfigured } from '@/lib/mercadopago'
import { processarCobrancaAssinatura, processarPagamentoMP, sincronizarAssinatura } from '@/lib/pagamentos'

/**
 * Notificações (Webhooks) do Mercado Pago: eventos "Pagamentos" e, se a assinatura mensal for usada,
 * "Planos e assinaturas" (subscription_preapproval e subscription_authorized_payment).
 * 1. Valida a assinatura (`x-signature`) antes de qualquer coisa: 401 se não bater ou se for antiga.
 * 2. Só processa `type === 'payment'`.
 * 3. Nunca confia no corpo: busca o pagamento na API (`GET /v1/payments/{id}`) e aplica a regra única.
 * Responde rápido (o Mercado Pago espera no máximo 22 s) e é idempotente: reenvios dão o mesmo resultado.
 */
export async function POST(req: Request) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? ''
  if (!mpConfigured()) return new Response('Mercado Pago não configurado', { status: 404 })
  const url = new URL(req.url)
  const body = (await req.json().catch(() => null)) as { type?: string; action?: string; data?: { id?: string | number } } | null
  // O id assinado é o da query string (data.id); o corpo só serve de reserva para o tipo.
  const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id')
  const check = verifyMpSignature({ xSignature: req.headers.get('x-signature'), xRequestId: req.headers.get('x-request-id'), dataId, secret })
  if (!check.ok) return new Response('Assinatura inválida', { status: 401 })

  const type = url.searchParams.get('type') ?? body?.type ?? url.searchParams.get('topic')
  if (!dataId) return new Response('ok', { status: 200 })
  // Assinatura mensal (opcional): mudança de situação e cobranças recorrentes.
  if (type === 'subscription_preapproval' || type === 'subscription_authorized_payment') {
    try {
      if (type === 'subscription_preapproval') return Response.json({ ok: true, status: await sincronizarAssinatura(dataId, 'webhook') })
      return Response.json({ ok: true, ...(await processarCobrancaAssinatura(dataId)) })
    } catch {
      return new Response('Tente de novo', { status: 500 })
    }
  }
  if (type !== 'payment') return new Response('ok', { status: 200 })
  try {
    const payment = await buscarPagamento(dataId)
    const r = await processarPagamentoMP(payment, 'webhook')
    return Response.json({ ok: true, status: r.status })
  } catch {
    // Falha temporária (rede ou API): 500 faz o Mercado Pago reenviar mais tarde; o cron também concilia.
    return new Response('Tente de novo', { status: 500 })
  }
}
