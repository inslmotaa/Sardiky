import { expect, test, type Page } from '@playwright/test'
import { login, openPatient } from './helpers'

/**
 * Pagamento dos planos pelo Mercado Pago (Checkout Pro), com a API simulada por tests/e2e/mp-falso.mjs.
 * A notificação (webhook) do servidor falso vem assinada como a do Mercado Pago.
 */
const PASS = 'Pagamento#2026'
const MP = 'http://localhost:3299'

async function signUp(page: Page, name: string, email: string, plan?: string) {
  if (plan) {
    await page.goto('/#planos')
    await page.locator('.tl-plan', { hasText: plan }).getByRole('link', { name: /Contratar/ }).click()
    await expect(page).toHaveURL(/\/criar-conta\?plano=[0-9a-f-]{36}$/)
  } else await page.goto('/criar-conta')
  await page.getByLabel('Nome completo').fill(name)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('WhatsApp').fill('41955554444')
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(PASS)
  await page.getByLabel('Confirme a senha').fill(PASS)
  await page.getByLabel(/Li e aceito a/).check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/paciente\/pagamento/)
}

test('escolher plano → criar conta → pagar → webhook aprovado → anamnese liberada', async ({ page }) => {
  await page.context().clearCookies()
  await signUp(page, 'Cliente Cartão Teste', 'cartao.teste@example.com', 'Trimestral')
  await expect(page.getByRole('heading', { name: 'Plano Trimestral' })).toBeVisible()
  await expect(page.locator('.pay-card__price')).toContainText('R$ 637,50')
  await expect(page.getByText(/Pix, cartão em até 12x ou boleto/)).toBeVisible()
  await expect(page.getByText('Conclua o pagamento para começar.')).toBeVisible()

  // Sem pagamento: anamnese, plano, Hoje e PDF ficam fechados; Mensagens e Meus dados abrem.
  for (const path of ['/paciente/anamnese', '/paciente/plano', '/paciente', '/paciente/diario']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/paciente\/pagamento$/)
  }
  expect((await page.request.get('/paciente/plano/pdf')).status()).toBe(403)
  await page.goto('/paciente/meus-dados')
  await expect(page.getByRole('heading', { name: 'Meu perfil', level: 1 })).toBeVisible()
  await page.goto('/paciente/pagamento')

  // Trocar de plano mostra os ativos.
  await page.getByText('Trocar de plano').click()
  await expect(page.getByRole('list', { name: 'Planos disponíveis' }).getByText('Anual')).toBeVisible()

  // Checkout Pro (falso): o retorno ao site é bloqueado de propósito, para provar que o webhook sozinho libera.
  await page.route('**/paciente/pagamento/retorno**', (r) => r.abort())
  await page.getByRole('button', { name: 'Pagar com Mercado Pago' }).click()
  await expect(page).toHaveURL(new RegExp(`^${MP}/checkout/pref-`))
  await expect(page.getByText('Acompanhamento Trimestral — Farion · R$ 637.5')).toBeVisible()
  await expect(page.getByText('Parcelas: até 12x · Fatura: FARION')).toBeVisible()
  await page.getByRole('link', { name: 'Pagar com cartão (aprovado)' }).click().catch(() => undefined)
  await page.unroute('**/paciente/pagamento/retorno**')

  await page.goto('/paciente/anamnese')
  await expect(page.getByRole('heading', { name: 'Como você prefere responder a anamnese?' })).toBeVisible()
  await expect(page.getByText('Conclua o pagamento para começar.')).toHaveCount(0)

  // Coach: aviso, lançamento confirmado pelo Mercado Pago, plano e período na ficha.
  await login(page, 'admin')
  await expect(page.getByRole('region', { name: 'Avisos' }).getByRole('link', { name: 'Cliente Cartão Teste pagou o plano Trimestral' })).toBeVisible()
  await expect(page.locator('section[aria-labelledby="pagamentos-titulo"]')).toContainText('Cliente Cartão Teste')
  const id = await openPatient(page, 'Cliente Cartão Teste')
  await expect(page.locator('.page-head')).toContainText('Plano Trimestral até')
  await page.goto(`/admin/pacientes/${id}?aba=financeiro`)
  const row = page.getByRole('row', { name: /Plano Trimestral/ })
  await expect(row).toContainText('Confirmado por mercadopago')
  await expect(row).toContainText('Cartão de crédito (visa)')
  await expect(row.getByRole('link', { name: /Ver no Mercado Pago/ })).toBeVisible()
})

test('Pix pendente → tela de espera → conciliação no cron → liberado', async ({ page }) => {
  await page.context().clearCookies()
  await signUp(page, 'Cliente Pix Teste', 'pix.teste@example.com')
  await page.getByRole('button', { name: 'Pagar com Mercado Pago' }).click()
  await page.getByRole('link', { name: 'Pagar com Pix (pendente)' }).click()
  await expect(page).toHaveURL(/\/paciente\/pagamento\/retorno\?/)
  await expect(page.getByRole('heading', { name: 'Aguardando pagamento' })).toBeVisible()
  const paymentId = new URL(page.url()).searchParams.get('payment_id')!

  // Sai da tela de espera (que também confere sozinha) e deixa a confirmação para o cron.
  await page.goto('/paciente/mensagens')
  await page.goto('/paciente/anamnese')
  await expect(page).toHaveURL(/\/paciente\/pagamento$/)
  await expect(page.getByText('Você tem um pagamento aguardando confirmação')).toBeVisible()

  // O Pix é pago no banco; o Mercado Pago não avisa (teste) e o cron concilia pela referência.
  expect((await page.request.post(`${MP}/__test/aprovar/${paymentId}`)).ok()).toBe(true)
  const cron = await page.request.get('/api/cron', { headers: { Authorization: 'Bearer segredo-de-teste' } })
  expect(cron.ok()).toBe(true)
  expect((await cron.json()).pagamentos.consultadas).toBeGreaterThanOrEqual(1)

  await page.goto('/paciente/anamnese')
  await expect(page.getByRole('heading', { name: 'Como você prefere responder a anamnese?' })).toBeVisible()
})

test('webhook: recusa assinatura inválida e processa a mesma notificação várias vezes sem duplicar', async ({ page, request }) => {
  const bad = await request.post('/api/webhooks/mercadopago?data.id=123&type=payment', {
    headers: { 'x-signature': `ts=${Date.now()},v1=${'0'.repeat(64)}`, 'x-request-id': 'r1' },
    data: { type: 'payment', data: { id: '123' } },
  })
  expect(bad.status()).toBe(401)
  const unsigned = await request.post('/api/webhooks/mercadopago?data.id=123&type=payment', { data: { type: 'payment' } })
  expect(unsigned.status()).toBe(401)

  // O pagamento aprovado do primeiro teste, notificado de novo 3 vezes com assinatura válida: continua um só "pago".
  await login(page, 'admin')
  const id = await openPatient(page, 'Cliente Cartão Teste')
  await page.goto(`/admin/pacientes/${id}?aba=financeiro`)
  const ref = (await page.getByRole('link', { name: /Ver no Mercado Pago/ }).textContent())!.match(/\d+/)![0]
  const { createHmac } = await import('node:crypto')
  for (let i = 0; i < 3; i++) {
    const ts = Date.now()
    const rid = `dup-${i}`
    const v1 = createHmac('sha256', 'segredo-webhook-teste').update(`id:${ref};request-id:${rid};ts:${ts};`).digest('hex')
    const r = await request.post(`/api/webhooks/mercadopago?data.id=${ref}&type=payment`, {
      headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': rid },
      data: { type: 'payment', data: { id: ref } },
    })
    expect(r.status()).toBe(200)
  }
  await page.reload()
  await expect(page.getByRole('row', { name: /Plano Trimestral/ })).toHaveCount(1)
  await expect(page.locator('.badge--ok', { hasText: /^Pago:/ })).toHaveText(/^Pago: R\$\s637,50$/)
})

test('o cliente A não consegue pagar nem ver a cobrança do cliente B; coach libera sem pagamento on-line', async ({ page }) => {
  // B: cobrança pendente (Pix).
  await page.context().clearCookies()
  await signUp(page, 'Cliente B Teste', 'clienteb.teste@example.com', 'Mensal')
  await page.getByRole('button', { name: 'Pagar com Mercado Pago' }).click()
  await page.getByRole('link', { name: 'Pagar com Pix (pendente)' }).click()
  await expect(page.getByRole('heading', { name: 'Aguardando pagamento' })).toBeVisible()
  const bUrl = new URL(page.url())
  const bRef = bUrl.searchParams.get('external_reference')!
  const bPay = bUrl.searchParams.get('payment_id')!

  // A tenta abrir o retorno com a cobrança de B: não vê nada de B e nada de B é aplicado.
  await page.context().clearCookies()
  await signUp(page, 'Cliente A Teste', 'clientea.teste@example.com', 'Anual')
  await page.goto(`/paciente/pagamento/retorno?external_reference=${bRef}&payment_id=${bPay}`)
  await expect(page).toHaveURL(/\/paciente\/pagamento$/)
  await expect(page.getByText('Plano Mensal')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Plano Anual' })).toBeVisible()
  await expect(page.getByText('Você tem um pagamento aguardando confirmação')).toHaveCount(0)

  // O coach libera A sem pagamento on-line (pagou por fora).
  await login(page, 'admin')
  const id = await openPatient(page, 'Cliente A Teste')
  await page.goto(`/admin/pacientes/${id}?aba=financeiro`)
  await expect(page.getByText('Aguardando o primeiro pagamento')).toBeVisible()
  await page.getByRole('button', { name: 'Gerar link de pagamento' }).click()
  await expect(page.getByLabel('Link de pagamento')).toHaveValue(new RegExp(`^${MP}/checkout/pref-`))
  await expect(page.getByRole('link', { name: 'Enviar pelo WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/55/)
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Liberar acesso' }).click()
  await expect(page.getByText(/Acesso liberado: Plano Anual até/)).toBeVisible()

  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('clientea.teste@example.com')
  await page.getByLabel('Senha').fill(PASS)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/paciente\/anamnese/)
})
