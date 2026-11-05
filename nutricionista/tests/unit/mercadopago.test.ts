import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { aplicarPagamentoMP, metodoMP, periodoDoPlano, signMpNotification, traduzirStatusMP, verifyMpSignature, type MpPayment, type PaymentRow } from '@/lib/mercadopago-core'

const SECRET = 'assinatura-secreta-de-teste'
const NOW = Date.UTC(2026, 10, 5, 15, 0, 0)

describe('assinatura do webhook do Mercado Pago (x-signature)', () => {
  it('aceita a assinatura válida, montada como id:<data.id>;request-id:<x-request-id>;ts:<ts>;', () => {
    const ts = NOW - 30_000
    const v1 = createHmac('sha256', SECRET).update(`id:123456;request-id:req-1;ts:${ts};`).digest('hex')
    expect(verifyMpSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-1', dataId: '123456', secret: SECRET, now: NOW })).toEqual({ ok: true })
    // Gerada pelo mesmo cálculo do servidor falso dos testes.
    expect(verifyMpSignature({ xSignature: signMpNotification({ dataId: '123456', xRequestId: 'req-1', ts, secret: SECRET }), xRequestId: 'req-1', dataId: '123456', secret: SECRET, now: NOW }).ok).toBe(true)
  })

  it('recusa assinatura inválida, malformada, ausente ou com outro segredo', () => {
    const ts = NOW
    const good = signMpNotification({ dataId: '1', xRequestId: 'r', ts, secret: SECRET })
    expect(verifyMpSignature({ xSignature: good.replace(/.$/, (c) => (c === '0' ? '1' : '0')), xRequestId: 'r', dataId: '1', secret: SECRET, now: NOW }).ok).toBe(false)
    expect(verifyMpSignature({ xSignature: good, xRequestId: 'r', dataId: '2', secret: SECRET, now: NOW }).ok).toBe(false)
    expect(verifyMpSignature({ xSignature: good, xRequestId: 'outro', dataId: '1', secret: SECRET, now: NOW }).ok).toBe(false)
    expect(verifyMpSignature({ xSignature: good, xRequestId: 'r', dataId: '1', secret: 'outro-segredo', now: NOW }).ok).toBe(false)
    expect(verifyMpSignature({ xSignature: 'ts=abc,v1=zz', xRequestId: 'r', dataId: '1', secret: SECRET, now: NOW }).ok).toBe(false)
    expect(verifyMpSignature({ xSignature: null, xRequestId: 'r', dataId: '1', secret: SECRET, now: NOW }).ok).toBe(false)
    expect(verifyMpSignature({ xSignature: good, xRequestId: 'r', dataId: '1', secret: '', now: NOW }).ok).toBe(false)
  })

  it('recusa notificação com ts mais velho que 10 minutos (aceita ts em segundos ou milissegundos)', () => {
    const old = NOW - 11 * 60_000
    const sig = signMpNotification({ dataId: '1', xRequestId: 'r', ts: old, secret: SECRET })
    expect(verifyMpSignature({ xSignature: sig, xRequestId: 'r', dataId: '1', secret: SECRET, now: NOW })).toEqual({ ok: false, reason: 'notificação antiga' })
    const inSeconds = Math.floor((NOW - 60_000) / 1000)
    const sig2 = signMpNotification({ dataId: '1', xRequestId: 'r', ts: inSeconds, secret: SECRET })
    expect(verifyMpSignature({ xSignature: sig2, xRequestId: 'r', dataId: '1', secret: SECRET, now: NOW }).ok).toBe(true)
  })

  it('data.id alfanumérico vai em minúsculas; partes ausentes são omitidas do texto', () => {
    const ts = NOW
    const v1 = createHmac('sha256', SECRET).update(`id:abc123def;ts:${ts};`).digest('hex')
    // Sem x-request-id, e o id chega em maiúsculas na query.
    expect(verifyMpSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: null, dataId: 'ABC123DEF', secret: SECRET, now: NOW }).ok).toBe(true)
    const onlyTs = createHmac('sha256', SECRET).update(`ts:${ts};`).digest('hex')
    expect(verifyMpSignature({ xSignature: `ts=${ts},v1=${onlyTs}`, xRequestId: null, dataId: null, secret: SECRET, now: NOW }).ok).toBe(true)
  })
})

describe('tradução de status do Mercado Pago', () => {
  it.each([
    ['approved', 'pago'],
    ['pending', 'pendente'],
    ['in_process', 'pendente'],
    ['authorized', 'pendente'],
    ['rejected', 'cancelado'],
    ['cancelled', 'cancelado'],
    ['expired', 'cancelado'],
    ['refunded', 'estornado'],
    ['charged_back', 'estornado'],
  ])('%s → %s', (mp, local) => expect(traduzirStatusMP(mp)).toBe(local))

  it('forma de pagamento legível', () => {
    expect(metodoMP({ payment_type_id: 'bank_transfer', payment_method_id: 'pix' })).toBe('Pix')
    expect(metodoMP({ payment_type_id: 'credit_card', payment_method_id: 'visa' })).toBe('Cartão de crédito (visa)')
    expect(metodoMP({ payment_type_id: 'ticket', payment_method_id: 'bolbradesco' })).toBe('Boleto (bolbradesco)')
  })
})

const row = (over: Partial<PaymentRow> = {}): PaymentRow => ({ id: 'p1', status: 'pendente', amountCents: 63750, providerRef: null, providerStatus: null, ...over })
const mp = (over: Partial<MpPayment> = {}): MpPayment => ({
  id: 9001,
  status: 'approved',
  external_reference: 'p1',
  transaction_amount: 637.5,
  currency_id: 'BRL',
  payment_type_id: 'bank_transfer',
  payment_method_id: 'pix',
  date_approved: '2026-11-05T14:00:00.000-03:00',
  ...over,
})

describe('aplicarPagamentoMP: a regra usada pelo webhook, pelo retorno e pelo cron', () => {
  it('aprovado: vira "pago" com forma de pagamento e data, e libera o acesso', () => {
    const d = aplicarPagamentoMP(mp(), row(), '2026-11-05')
    expect(d).toEqual({
      kind: 'atualizar',
      set: { status: 'pago', providerRef: '9001', providerStatus: 'approved', method: 'Pix', paidAt: '2026-11-05' },
      aprovou: true,
      estornou: false,
    })
  })

  it('idempotente: a mesma notificação 3 vezes aprova uma vez só', () => {
    let current = row()
    const results = []
    for (let i = 0; i < 3; i++) {
      const d = aplicarPagamentoMP(mp(), current, '2026-11-05')
      results.push(d)
      if (d.kind === 'atualizar') current = { ...current, status: d.set.status, providerRef: d.set.providerRef, providerStatus: d.set.providerStatus }
    }
    expect(results.map((r) => (r.kind === 'atualizar' ? r.aprovou : r.kind))).toEqual([true, 'nada', 'nada'])
  })

  it('um "pendente" atrasado não desfaz a aprovação; um estorno marca "estornado" e avisa', () => {
    const paid = row({ status: 'pago', providerRef: '9001', providerStatus: 'approved' })
    expect(aplicarPagamentoMP(mp({ status: 'pending' }), paid, '2026-11-05')).toMatchObject({ kind: 'atualizar', set: { status: 'pago' }, aprovou: false })
    expect(aplicarPagamentoMP(mp({ status: 'refunded' }), paid, '2026-11-06')).toMatchObject({ kind: 'atualizar', set: { status: 'estornado' }, aprovou: false, estornou: true })
  })

  it('pendente (Pix/boleto) e recusado: atualizam sem liberar', () => {
    expect(aplicarPagamentoMP(mp({ status: 'pending' }), row(), '2026-11-05')).toMatchObject({ kind: 'atualizar', set: { status: 'pendente' }, aprovou: false })
    expect(aplicarPagamentoMP(mp({ status: 'rejected' }), row(), '2026-11-05')).toMatchObject({ kind: 'atualizar', set: { status: 'cancelado' }, aprovou: false })
    // Recusado e depois aprovado na mesma cobrança (o cliente tentou de novo): aprova.
    expect(aplicarPagamentoMP(mp({ id: 9002 }), row({ status: 'cancelado', providerRef: '9001', providerStatus: 'rejected' }), '2026-11-05')).toMatchObject({ aprovou: true })
  })

  it('valor ou moeda divergentes: não libera', () => {
    expect(aplicarPagamentoMP(mp({ transaction_amount: 1 }), row(), '2026-11-05')).toEqual({ kind: 'divergencia', motivo: 'valor 1 (esperado 637.5)' })
    expect(aplicarPagamentoMP(mp({ currency_id: 'USD' }), row(), '2026-11-05')).toMatchObject({ kind: 'divergencia' })
  })
})

describe('período do plano pago (package_start e package_end)', () => {
  it('primeira contratação: começa hoje e termina em início + meses − 1 dia', () => {
    expect(periodoDoPlano('2026-11-05', null, 3)).toEqual({ start: '2026-11-05', end: '2027-02-04' })
    expect(periodoDoPlano('2026-01-31', null, 1)).toEqual({ start: '2026-01-31', end: '2026-02-27' })
    expect(periodoDoPlano('2026-11-05', null, 12)).toEqual({ start: '2026-11-05', end: '2027-11-04' })
  })
  it('renovação antes de vencer: começa no dia seguinte ao término atual', () => {
    expect(periodoDoPlano('2026-11-05', '2026-11-10', 1)).toEqual({ start: '2026-11-11', end: '2026-12-10' })
  })
  it('plano já vencido: começa hoje', () => {
    expect(periodoDoPlano('2026-11-05', '2026-10-01', 6)).toEqual({ start: '2026-11-05', end: '2027-05-04' })
  })
})
