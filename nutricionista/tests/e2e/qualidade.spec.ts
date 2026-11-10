import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHmac } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { login, openPatient, pdfText, USERS } from './helpers'

/**
 * Parte 6: qualidade antes de publicar. Os itens já cobertos em outros arquivos estão listados em
 * docs/09-lancamento.md (sitemap e robots, depoimento aprovado, vencimento, WhatsApp e .ics).
 */

const PROIBIDO = /nutricionista|\bCRN\b|registro profissional/i
const OUTBOX = path.join(os.tmpdir(), 'consultorio-nutri-e2e-emails.jsonl')
const LIMITES = `${OUTBOX}.limites.json`
const CRON = { Authorization: 'Bearer segredo-de-teste' }
const MP = 'http://localhost:3299'
const PASS = 'Qualidade#2026'

const spDay = (offset = 0) => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Título, descrição, Open Graph e texto visível da página. */
const screenText = (page: Page) =>
  page.evaluate(() =>
    [document.title, ...[...document.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')].map((m) => m.getAttribute('content') ?? ''), document.body.innerText].join('\n'),
  )

/** Links internos da página que abrem uma tela (sem arquivos, saída ou WhatsApp). */
const SKIP = /\/pdf\b|\.ics$|\/whatsapp$|exportar|\/csv\b|\/recibos\/|\/sair\b|logout/
const linksOf = async (page: Page, prefix: string) =>
  (await page.evaluate((p) => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '').filter((h) => h.startsWith(p)), prefix)).map((h) => h.split('#')[0]).filter((h) => !SKIP.test(h))

async function crawl(page: Page, start: string[], prefix: string, max: number) {
  const seen = new Set<string>()
  const queue = [...start]
  while (queue.length && seen.size < max) {
    const url = queue.shift()!
    if (seen.has(url)) continue
    seen.add(url)
    const res = await page.goto(url)
    expect(res?.status(), url).toBeLessThan(400)
    expect(await screenText(page), url).not.toMatch(PROIBIDO)
    for (const h of await linksOf(page, prefix)) if (!seen.has(h)) queue.push(h)
  }
  return seen
}

const outboxLen = () => (existsSync(OUTBOX) ? readFileSync(OUTBOX, 'utf8').length : 0)
const mailsSince = (mark: number) =>
  (existsSync(OUTBOX) ? readFileSync(OUTBOX, 'utf8') : '')
    .slice(mark)
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { to: string; subject: string; text: string; category: string })

test('nenhuma tela (site, login, app do cliente, painel) mostra "nutricionista", CRN ou registro profissional', async ({ page, request }) => {
  test.setTimeout(240_000)
  // Site público: todas as páginas do sitemap, mais as de entrada.
  const sitemap = await (await request.get('/sitemap.xml')).text()
  const pub = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)
  expect(pub.length).toBeGreaterThanOrEqual(8)
  await page.context().clearCookies()
  const site = await crawl(page, [...pub, '/login', '/criar-conta', '/recuperar-senha'], '/no-follow', 200)
  expect(site.size).toBeGreaterThanOrEqual(pub.length)

  // App do cliente: tudo o que se alcança a partir do Início e do Mais.
  await login(page, 'beatriz')
  const app = await crawl(page, ['/paciente', '/paciente/mais'], '/paciente', 60)
  expect(app.size).toBeGreaterThanOrEqual(10)

  // Painel do coach: menus, seções das Configurações e abas da ficha.
  await login(page, 'admin')
  const id = await openPatient(page, 'Beatriz Exemplo')
  const admin = await crawl(page, ['/admin', '/admin/configuracoes', `/admin/pacientes/${id}`], '/admin', 90)
  expect(admin.size).toBeGreaterThanOrEqual(20)
})

test('nenhum PDF (plano, anamnese, recibo) nem o calendário mostra "nutricionista", CRN ou registro profissional', async ({ page }) => {
  await login(page, 'admin')
  const pdfs: string[] = []
  for (const name of ['Beatriz Exemplo', 'Helena', 'Lucas']) {
    const id = await openPatient(page, name)
    await page.goto(`/admin/pacientes/${id}?aba=planos`)
    const plans = [...new Set(await page.locator('a[href^="/admin/planos/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!.replace(/\/(editar|pdf)$/, ''))))]
    pdfs.push(...plans.slice(0, 2).map((h) => `${h}/pdf`))
    if (name === 'Beatriz Exemplo') pdfs.push(`/admin/pacientes/${id}/anamnese/pdf?versao=1`)
  }
  expect(pdfs.length).toBeGreaterThanOrEqual(3)
  for (const href of pdfs) {
    const res = await page.request.get(href)
    expect(res.status(), href).toBe(200)
    expect(res.headers()['content-type']).toBe('application/pdf')
    const text = pdfText(await res.body())
    expect(text, href).toContain('André Farion')
    expect(text, href).not.toMatch(PROIBIDO)
  }

  await login(page, 'beatriz')
  const own = await page.request.get('/paciente/plano/pdf')
  if (own.status() === 200) expect(pdfText(await own.body())).not.toMatch(PROIBIDO)
  await page.goto('/paciente/meus-dados')
  const recibo = page.getByRole('link', { name: 'Recibo (PDF)' }).first()
  const r = await page.request.get((await recibo.getAttribute('href'))!)
  expect(r.status()).toBe(200)
  const reciboText = pdfText(await r.body())
  expect(reciboText).toContain('RECIBO')
  expect(reciboText).not.toMatch(PROIBIDO)
  expect(await (await page.request.get('/paciente/lembretes.ics')).text()).not.toMatch(PROIBIDO)
})

test('check-in com lembrete: abre 3 dias antes, a tarefa periódica avisa o cliente uma única vez', async ({ page }) => {
  await login(page, 'admin')
  const id = await openPatient(page, 'Lucas')
  await page.goto(`/admin/pacientes/${id}?aba=checkins`)
  await page.getByLabel('A cada').selectOption('14')
  await page.getByLabel('Primeiro prazo').fill(spDay(3))
  await page.getByRole('button', { name: 'Salvar frequência' }).click()
  await expect(page.getByText(/Check-in a cada 14 dias; o próximo vence em/)).toBeVisible()

  const now = `${spDay()}T15:00:00Z` // meio-dia em Brasília
  const first = await page.request.get('/api/cron', { headers: { ...CRON, 'x-cron-now': now } })
  expect(first.ok()).toBe(true)
  expect((await first.json()).checkins).toBeGreaterThanOrEqual(1)
  // Segunda execução no mesmo dia: o mesmo lembrete não sai de novo.
  await page.request.get('/api/cron', { headers: { ...CRON, 'x-cron-now': now.replace('15:00', '15:30') } })

  await login(page, 'lucas')
  await page.goto('/paciente')
  const avisos = page.locator('.card', { has: page.getByRole('heading', { name: 'Avisos' }) })
  await expect(avisos.getByRole('link', { name: 'Check-in' })).toHaveAttribute('href', '/paciente/checkin')
  await expect(avisos.getByText(/Seu check-in está aberto/)).toHaveCount(1)
  await page.goto('/paciente/checkin')
  await expect(page.getByRole('button', { name: 'Enviar check-in' })).toBeVisible()
})

test('recibo: só existe depois que o webhook do Mercado Pago confirma o pagamento', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto('/planos')
  await page.locator('.tl-plan', { hasText: 'Mensal' }).getByRole('link', { name: /Contratar/ }).click()
  await page.getByLabel('Nome completo').fill('Cliente Recibo Teste')
  await page.getByLabel('E-mail').fill('recibo.teste@example.com')
  await page.getByLabel('WhatsApp').fill('41955553333')
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(PASS)
  await page.getByLabel('Confirme a senha').fill(PASS)
  await page.getByLabel(/Li e aceito a/).check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/paciente\/pagamento/)

  // Pix pendente no Mercado Pago (servidor falso tests/e2e/mp-falso.mjs): ainda sem recibo.
  await page.getByRole('button', { name: 'Pagar com Mercado Pago' }).click()
  await page.getByRole('link', { name: 'Pagar com Pix (pendente)' }).click()
  await expect(page.getByRole('heading', { name: 'Aguardando pagamento' })).toBeVisible()
  const paymentId = new URL(page.url()).searchParams.get('payment_id')!
  await page.goto('/paciente/meus-dados')
  await expect(page.getByRole('link', { name: 'Recibo (PDF)' })).toHaveCount(0)

  // O Pix é pago e o Mercado Pago avisa pelo webhook assinado.
  expect((await page.request.post(`${MP}/__test/aprovar/${paymentId}`)).ok()).toBe(true)
  const ts = Date.now()
  const rid = `recibo-${ts}`
  const v1 = createHmac('sha256', 'segredo-webhook-teste').update(`id:${paymentId};request-id:${rid};ts:${ts};`).digest('hex')
  const hook = await page.request.post(`/api/webhooks/mercadopago?data.id=${paymentId}&type=payment`, {
    headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': rid },
    data: { type: 'payment', action: 'payment.updated', data: { id: paymentId } },
  })
  expect(hook.status()).toBe(200)

  await page.goto('/paciente/meus-dados')
  const link = page.getByRole('list', { name: 'Pagamentos confirmados' }).getByRole('link', { name: 'Recibo (PDF)' })
  await expect(link).toHaveCount(1)
  const pdf = await page.request.get((await link.getAttribute('href'))!)
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toBe('application/pdf')
  const text = pdfText(await pdf.body())
  expect(text).toContain('RECIBO')
  expect(text).toContain('Cliente Recibo Teste')
  expect(text).toMatch(/R\$\s?\d/)
  expect(text).toMatch(/Mensal/)
  expect(text).not.toMatch(PROIBIDO)
})

test('limite de e-mail: resumo pausa antes dos essenciais, o painel avisa e nada quebra', async ({ page }) => {
  const helena = USERS.helena.email
  const at7 = `${spDay()}T10:05:00Z` // 7h05 em Brasília
  const cron = (t: string) => page.request.get('/api/cron', { headers: { ...CRON, 'x-cron-now': t } })
  const forgot = async () => {
    await page.context().clearCookies()
    await page.goto('/recuperar-senha')
    await page.getByLabel('E-mail').fill(helena)
    await page.getByRole('button', { name: 'Enviar link' }).click()
    await expect(page.getByText(/Se o e-mail estiver cadastrado, enviaremos um link/)).toBeVisible()
  }
  await login(page, 'helena')
  await page.goto('/paciente/notificacoes')
  await page.getByLabel(/Resumo do dia às 7h/).check()
  await page.getByRole('button', { name: 'Salvar preferências' }).click()
  await expect(page.getByText('Preferências salvas. O resumo do dia chega por e-mail às 7h.')).toBeVisible()

  try {
    // 1. Só sobra a reserva dos essenciais: o resumo não sai, a recuperação de senha sai.
    writeFileSync(LIMITES, JSON.stringify({ day: 1000, month: 100000, reserve: 1000 }))
    let mark = outboxLen()
    expect((await cron(at7)).ok()).toBe(true)
    expect(mailsSince(mark).filter((m) => m.to === helena && m.category === 'resumo')).toHaveLength(0)
    await forgot()
    await expect.poll(() => mailsSince(mark).filter((m) => m.to === helena && m.text.includes('/redefinir-senha?token=')).length).toBe(1)

    // Painel: aviso de limite quase atingido.
    await login(page, 'admin')
    await expect(page.getByText(/Limite gratuito de e-mail quase atingido/)).toBeVisible()

    // 2. Limite do dia esgotado: nem o essencial sai, e a tela responde normalmente.
    writeFileSync(LIMITES, JSON.stringify({ day: 0 }))
    mark = outboxLen()
    await forgot()
    await page.waitForTimeout(500)
    expect(mailsSince(mark).filter((m) => m.to === helena)).toHaveLength(0)

    // 3. Com cota de novo, o resumo sai na execução seguinte (2ª tentativa) e não repete no dia.
    rmSync(LIMITES, { force: true })
    mark = outboxLen()
    expect((await cron(at7.replace('10:05', '10:20'))).ok()).toBe(true)
    expect((await cron(at7.replace('10:05', '10:35'))).ok()).toBe(true)
    const resumo = mailsSince(mark).filter((m) => m.to === helena && m.category === 'resumo')
    expect(resumo).toHaveLength(1)
    expect(resumo[0].text).toContain('/descadastrar/')
    await login(page, 'admin')
    await expect(page.getByText(/Limite gratuito de e-mail quase atingido/)).toHaveCount(0)
  } finally {
    rmSync(LIMITES, { force: true })
    await login(page, 'helena')
    await page.goto('/paciente/notificacoes')
    await page.getByLabel(/Resumo do dia às 7h/).uncheck()
    await page.getByRole('button', { name: 'Salvar preferências' }).click()
    await expect(page.getByText('Preferências salvas.', { exact: false })).toBeVisible()
  }
})
