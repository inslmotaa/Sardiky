import { readFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { login, openPatient } from './helpers'

/** Parte 4: app do cliente e painel. */

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const OUTBOX = path.join(os.tmpdir(), 'consultorio-nutri-e2e-emails.jsonl')
const PASS = 'Assinatura#2026'

const isoDay = (offset: number) => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test('micronutrientes: quadro fechado no editor (por refeição e dia) e só aparece ao cliente se o coach ligar', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/planos')
  await page.getByRole('link', { name: 'Modelo — Reeducação alimentar (4 refeições)' }).click()
  const box = page.locator('details.micro-box')
  await expect(box).toBeVisible()
  await expect(box).not.toHaveAttribute('open', /.*/)
  await box.locator('summary').click()
  const table = box.getByRole('table', { name: /Vitaminas e minerais/ })
  await expect(table.getByRole('columnheader', { name: 'Dia' })).toBeVisible()
  expect(await table.getByRole('columnheader').count()).toBeGreaterThan(3) // nutriente + refeições + dia
  await expect(table.getByRole('rowheader', { name: /Cálcio/ })).toBeVisible()

  // Cliente: desligado por padrão.
  await login(page, 'beatriz')
  await page.goto('/paciente/plano')
  await expect(page.locator('details.micro-box')).toHaveCount(0)

  await login(page, 'admin')
  await openPatient(page, 'Beatriz Exemplo')
  const form = page.locator('section', { has: page.getByRole('heading', { name: 'Recursos do app do cliente' }) })
  await form.getByLabel('Vitaminas e minerais no plano (quadro para o cliente)').check()
  await form.getByRole('button', { name: 'Salvar recursos' }).click()
  await expect(page.getByText('Recursos do app atualizados.')).toBeVisible()

  await login(page, 'beatriz')
  await page.goto('/paciente/plano')
  await expect(page.locator('details.micro-box')).toBeVisible()
  await expect(page.locator('details.micro-box')).not.toHaveAttribute('open', /.*/)
})

test('código de barras: Open Food Facts sugere, o coach confere com o rótulo e salva; repetido é avisado', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/alimentos')
  await page.getByLabel('Código de barras').fill('7890000000017')
  await page.getByRole('button', { name: 'Buscar produto' }).click()
  await expect(page.getByText(/Produto 7890000000017 não encontrado no Open Food Facts/)).toBeVisible()

  await page.getByLabel('Código de barras').fill('7891000100104')
  await page.getByRole('button', { name: 'Buscar produto' }).click()
  await expect(page.getByText(/Código de barras inválido/)).toBeVisible()

  await page.getByLabel('Código de barras').fill('7891000100103')
  await page.getByRole('button', { name: 'Buscar produto' }).click()
  await expect(page.getByText(/Encontrado: Leite em pó integral · Marca Teste/)).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Leite em pó integral · Marca Teste')
  await expect(page.getByLabel('Calorias (kcal)')).toHaveValue('496')
  await expect(page.getByLabel('Sódio (mg)')).toHaveValue('380')
  await page.getByRole('button', { name: 'Cadastrar alimento' }).click()
  await expect(page.getByText(/Confira os valores com o rótulo do produto/)).toBeVisible()
  await page.getByLabel('Conferi os valores com o rótulo do produto').check()
  await page.getByRole('button', { name: 'Cadastrar alimento' }).click()
  await expect(page.getByText('“Leite em pó integral · Marca Teste” cadastrado como alimento próprio.')).toBeVisible()

  await page.getByLabel('Código de barras').fill('7891000100103')
  await page.getByRole('button', { name: 'Buscar produto' }).click()
  await expect(page.getByText('Este produto já está na base:')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Leite em pó integral · Marca Teste' })).toHaveAttribute('href', /\/admin\/alimentos\/[0-9a-f-]{36}/)
})

test('check-in: atrasado no Acompanhamento com WhatsApp; cliente envia com fotos privadas; coach revisa', async ({ page }) => {
  // Texto do WhatsApp editável em Configurações → Mensagens.
  await login(page, 'admin')
  await page.goto('/admin/configuracoes?secao=mensagens')
  await page.getByLabel('Check-in pendente').fill('Oi {nome}, falta o check-in de {data}: {link}')
  await page.getByRole('button', { name: 'Salvar modelos' }).click()
  await expect(page.getByText('Modelos de mensagem salvos.')).toBeVisible()

  await page.goto('/admin/acompanhamento')
  const late = page.getByRole('list', { name: 'Check-ins atrasados' })
  const row = late.getByRole('listitem').filter({ hasText: 'Helena' })
  await expect(row).toContainText('dias de atraso')
  await expect(row.getByRole('link', { name: 'Lembrar pelo WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/55\d+\?text=Oi%20Helena%2C%20falta%20o%20check-in/)

  await login(page, 'helena')
  await expect(page.getByText(/está atrasado/)).toBeVisible()
  await page.getByRole('link', { name: 'Fazer check-in' }).click()
  await expect(page).toHaveURL(/\/paciente\/checkin$/)
  await page.getByRole('button', { name: 'Enviar check-in' }).click()
  await expect(page.getByText('Diga quanto você seguiu o plano.')).toBeVisible()
  await page.getByRole('radio', { name: 'Quanto você seguiu o plano?: 4 de 5' }).check({ force: true })
  await page.getByRole('radio', { name: 'Qualidade do sono: 3 de 5' }).check({ force: true })
  await page.getByLabel('Peso (kg)').fill('70,5')
  await page.getByLabel('Cintura (cm)').fill('82')
  await page.getByLabel('O que foi mais difícil?').fill('Jantar fora no fim de semana.')
  await page.getByLabel('Fotos (opcional, até 3)').setInputFiles({ name: 'frente.png', mimeType: 'image/png', buffer: PNG })
  await page.getByRole('button', { name: 'Enviar check-in' }).click()
  await expect(page.getByText('Check-in enviado! O coach vai olhar e ajustar o que for preciso.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('list', { name: 'Check-ins enviados' })).toContainText('Seguiu o plano: 4/5 · 70,5 kg · 1 foto(s)')
  await expect(page.getByText(/Próximo check-in: abre em/)).toBeVisible()

  await login(page, 'admin')
  const id = await openPatient(page, 'Helena')
  await page.goto(`/admin/pacientes/${id}?aba=checkins`)
  const received = page.getByRole('list', { name: 'Check-ins recebidos' }).getByRole('listitem').first()
  await expect(received).toContainText('70,5 kg')
  await expect(received).toContainText('Jantar fora no fim de semana.')
  const photo = received.getByRole('img', { name: 'Foto 1 do check-in' })
  await expect(photo).toBeVisible()
  // Foto privada: sem login, não abre.
  const src = (await photo.getAttribute('src'))!
  const anon = await page.context().browser()!.newContext()
  expect((await anon.request.get(new URL(src, page.url()).href)).status()).toBe(404)
  await anon.close()
  await received.getByLabel('Comentário para o cliente (opcional)').fill('Boa! Vamos ajustar o jantar de sábado.')
  await received.getByRole('button', { name: 'Marcar como visto' }).click()
  await expect(page.getByText('Check-in marcado como visto.')).toBeVisible()

  // Frequência: o coach liga para outro cliente.
  const lucas = await openPatient(page, 'Lucas')
  await page.goto(`/admin/pacientes/${lucas}?aba=checkins`)
  await page.getByLabel('A cada').selectOption('14')
  await page.getByLabel('Primeiro prazo').fill(isoDay(14))
  await page.getByRole('button', { name: 'Salvar frequência' }).click()
  await expect(page.getByText(/Check-in a cada 14 dias; o próximo vence em/)).toBeVisible()

  await login(page, 'helena')
  await page.goto('/paciente/checkin')
  await expect(page.getByText('Boa! Vamos ajustar o jantar de sábado.')).toBeVisible()
})

test('diário: registrar e editar um dia de mais de 30 dias atrás; coach vê real × planejado', async ({ page }) => {
  await login(page, 'beatriz')
  const past = isoDay(-45)
  await page.goto(`/paciente/diario?data=${past}`)
  await expect(page.getByText(/Você está registrando/)).toBeVisible()
  await page.getByRole('button', { name: '+ Registrar algo fora do plano' }).click()
  await page.getByLabel('Descreva com suas palavras (opcional)').fill('Bolo de aniversário')
  await page.getByRole('button', { name: 'Salvar no diário' }).click()
  await expect(page.getByText(/Registro salvo no seu diário/)).toBeVisible()
  await page.reload()
  await expect(page.getByText('Bolo de aniversário')).toBeVisible()
  await page.getByRole('button', { name: 'Editar registro' }).first().click()
  await page.getByLabel('Descreva com suas palavras (opcional)').fill('Bolo de aniversário e refrigerante')
  await page.getByRole('button', { name: 'Salvar no diário' }).click()
  await expect(page.getByText(/Registro salvo no seu diário/)).toBeVisible()
  await page.reload()
  await expect(page.getByText('Bolo de aniversário e refrigerante')).toBeVisible()
  await expect(page.getByText('Bolo de aniversário', { exact: true })).toHaveCount(0)

  await login(page, 'admin')
  const id = await openPatient(page, 'Beatriz Exemplo')
  await page.goto(`/admin/pacientes/${id}?aba=diario`)
  const table = page.getByRole('table', { name: 'Consumo real × planejado' })
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'kcal (real / plano)' })).toBeVisible()
  expect(await table.getByRole('row').count()).toBeGreaterThan(5)
  await expect(table).toContainText('%')
})

test('vencimento: semana no painel com WhatsApp; vencido mostra só o histórico e o botão de renovar', async ({ page }) => {
  await login(page, 'admin')
  await expect(page.getByText(/Vencem nesta semana/).first()).toBeVisible()
  const queue = page.locator('.queue__item', { hasText: 'Lucas' })
  await expect(queue.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/55\d+\?text=.*termina%20em/)

  // O coach encerra o período ontem: a área do Lucas passa a mostrar só o histórico.
  const id = await openPatient(page, 'Lucas')
  await page.getByLabel('Término (opcional)').fill(isoDay(-1))
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText(/salv|atualizad/i).first()).toBeVisible()

  try {
    await page.context().clearCookies()
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('lucas@example.com')
    await page.getByLabel('Senha').fill('Paciente#Demo2026')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/paciente\/encerrado$/)
    await expect(page.getByRole('heading', { name: 'Seu histórico' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Renovar meu plano' })).toHaveAttribute('href', /\/paciente\/pagamento/)
    await expect(page.getByRole('list', { name: 'Planos alimentares anteriores' }).or(page.getByText('Nenhum plano publicado.'))).toBeVisible()
    for (const p of ['/paciente', '/paciente/plano', '/paciente/diario', '/paciente/checkin']) {
      await page.goto(p)
      await expect(page).toHaveURL(/\/paciente\/encerrado$/)
    }
    await page.goto('/paciente/meus-dados')
    await expect(page).toHaveURL(/\/paciente\/meus-dados$/)
  } finally {
    await login(page, 'admin')
    await page.goto(`/admin/pacientes/${id}`)
    await page.getByLabel('Término (opcional)').fill(isoDay(5))
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText(/salv|atualizad/i).first()).toBeVisible()
  }
})

test('recibo em PDF: cliente baixa os próprios; equipe no financeiro; outro cliente não', async ({ page, browser }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/meus-dados')
  const link = page.getByRole('list', { name: 'Pagamentos confirmados' }).getByRole('link', { name: 'Recibo (PDF)' }).first()
  const href = (await link.getAttribute('href'))!
  const res = await page.request.get(href)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('application/pdf')
  expect(res.headers()['content-disposition']).toMatch(/recibo-\d{5}\.pdf/)
  const again = await page.request.get(href)
  expect(again.headers()['content-disposition']).toBe(res.headers()['content-disposition']) // mesmo número

  const other = await browser.newContext()
  const p2 = await other.newPage()
  await login(p2, 'helena')
  expect((await p2.request.get(href)).status()).toBe(404)
  await other.close()

  await login(page, 'admin')
  await page.goto('/admin/financeiro')
  await expect(page.getByRole('link', { name: /Recibo \(PDF\) nº \d{5}/ }).first()).toBeVisible()
})

async function readMagicLink(email: string) {
  await expect.poll(() => existsSync(OUTBOX) && readFileSync(OUTBOX, 'utf8').includes(email)).toBe(true)
  const lines = readFileSync(OUTBOX, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { to: string; text: string })
  const mail = lines.reverse().find((m) => m.to === email && m.text.includes('/login/link?token='))!
  return mail.text.match(/https?:\/\/\S+\/login\/link\?token=\S+/)![0]
}

test('login por link mágico: link de uso único, com confirmação de um clique', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByText('Sem senha? Receba um link de acesso por e-mail').click()
  await page.getByLabel('Endereço para receber o link').fill('paciente@example.com')
  await page.getByRole('button', { name: 'Enviar link de acesso' }).click()
  await expect(page.getByText(/Se o e-mail tiver uma conta, enviamos um link de acesso/)).toBeVisible()
  // E-mail sem conta: mesma resposta, nada enviado.
  await page.getByLabel('Endereço para receber o link').fill('ninguem@example.com')
  await page.getByRole('button', { name: 'Enviar link de acesso' }).click()
  await expect(page.getByText(/Se o e-mail tiver uma conta/)).toBeVisible()

  const url = await readMagicLink('paciente@example.com')
  const path = new URL(url).pathname + new URL(url).search
  await page.goto(path)
  await expect(page.getByText(/Você vai entrar como pa•••@example\.com/)).toBeVisible()
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/paciente$/)

  await page.context().clearCookies()
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible()
  const mails = readFileSync(OUTBOX, 'utf8')
  expect(mails).not.toContain('ninguem@example.com')
})

async function signUpMonthly(page: Page, name: string, email: string) {
  await page.context().clearCookies()
  await page.goto('/planos')
  await page.locator('.tl-plan', { hasText: 'Mensal' }).getByRole('link', { name: /Contratar/ }).click()
  await page.getByLabel('Nome completo').fill(name)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('WhatsApp').fill('41966665555')
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(PASS)
  await page.getByLabel('Confirme a senha').fill(PASS)
  await page.getByLabel(/Li e aceito a/).check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/paciente\/pagamento/)
}

test('assinatura mensal (opcional) e exclusão de conta com exportação automática na auditoria', async ({ page }) => {
  await signUpMonthly(page, 'Cliente Assinatura Teste', 'assinatura.teste@example.com')
  await expect(page.getByRole('heading', { name: 'Plano Mensal' })).toBeVisible()
  await page.getByRole('button', { name: 'Assinar: renova todo mês' }).click()
  await expect(page.getByRole('heading', { name: 'Assinatura de teste' })).toBeVisible()
  await page.getByRole('link', { name: 'Autorizar assinatura' }).click()
  await expect(page).toHaveURL(/\/paciente\/pagamento\/retorno\?assinatura=1/)
  await expect(page.getByText(/Assinatura autorizada/)).toBeVisible()
  await expect(page.getByText('O primeiro pagamento já foi confirmado.')).toBeVisible({ timeout: 20_000 })

  await page.goto('/paciente/meus-dados')
  await expect(page.getByText('ativa (renova sozinha todo mês)')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Pagamentos confirmados' })).toContainText('Assinatura · Plano Mensal')
  await page.getByRole('button', { name: 'Cancelar assinatura' }).click()
  await expect(page.getByText(/Assinatura cancelada/)).toBeVisible()

  // Exclusão da conta: antes, a exportação completa é guardada e registrada na auditoria.
  await page.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR')
  await page.locator('#excluir-conta').getByLabel('Sua senha').fill(PASS)
  page.once('dialog', (d) => d.accept())
  await page.locator('#excluir-conta').getByRole('button', { name: 'Excluir minha conta' }).click()
  await expect(page).toHaveURL(/\/\?conta=excluida/)

  await login(page, 'admin')
  await page.goto('/admin/privacidade?acao=lgpd_exportacao_automatica')
  const saved = page.getByRole('list', { name: 'Exportações guardadas' }).getByRole('listitem').first()
  await expect(saved).toContainText('Exportação LGPD')
  const href = (await saved.getByRole('link', { name: 'Baixar' }).getAttribute('href'))!
  const file = await page.request.get(href)
  expect(file.status()).toBe(200)
  const json = await file.json()
  expect(json.motivo).toBe('conta_excluida_pelo_cliente')
  expect(json.cadastro.fullName).toBe('Cliente Assinatura Teste')
  expect(json.pagamentos.length).toBeGreaterThan(0)
  await expect(page.getByRole('cell', { name: 'lgpd exportacao automatica' }).first()).toBeVisible()

  // Equipe sem permissão de configurações não baixa a exportação.
  await login(page, 'staff')
  expect((await page.request.get(href)).status()).toBe(404)
})
