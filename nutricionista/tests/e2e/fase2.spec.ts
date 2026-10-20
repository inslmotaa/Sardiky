import { expect, test, type Browser } from '@playwright/test'
import { login, USERS } from './helpers'

/** Fase 2: diário, acompanhamento, avaliações, fotos, chat ao vivo, plano sem internet e PDF. */

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex')

async function patientId(page: import('@playwright/test').Page, name: string) {
  await page.goto('/admin/pacientes')
  await page.getByRole('link', { name }).first().click()
  await page.waitForURL(/\/admin\/pacientes\/[0-9a-f-]{36}/)
  return page.url().match(/pacientes\/([0-9a-f-]{36})/)![1]
}

async function newSession(browser: Browser, who: keyof typeof USERS) {
  const ctx = await browser.newContext({ baseURL: 'http://localhost:3200', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  const page = await ctx.newPage()
  await login(page, who)
  return { ctx, page }
}

test('acompanhamento classifica por adesão dos últimos 7 dias completos', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/acompanhamento')
  const row = (name: string) => page.locator('tbody tr', { hasText: name })
  await expect(row('Beatriz Exemplo').getByText('Em dia')).toBeVisible()
  await expect(row('Helena Teste').getByText('Com dificuldade')).toBeVisible()
  await expect(row('Lucas Fictício').getByText('Sem progresso')).toBeVisible()
  // Limites configuráveis: com "em dia" a partir de 40%, Helena passa a estar em dia.
  await page.getByText('Ajustar limites de adesão').click()
  await page.getByLabel('Em dia a partir de (%)').fill('40')
  await page.getByLabel('Com dificuldade a partir de (%)').fill('20')
  await page.getByRole('button', { name: 'Salvar limites' }).click()
  await expect(page.getByText('Limites atualizados.')).toBeVisible()
  await page.reload()
  await expect(row('Helena Teste').getByText('Em dia')).toBeVisible()
  await page.getByText('Ajustar limites de adesão').click()
  await page.getByLabel('Em dia a partir de (%)').fill('80')
  await page.getByLabel('Com dificuldade a partir de (%)').fill('40')
  await page.getByRole('button', { name: 'Salvar limites' }).click()
  await expect(page.getByText('Limites atualizados.')).toBeVisible()
})

test('diário: comi outra coisa com alimento da base, humor e resposta do nutricionista no chat', async ({ page, browser }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/diario')
  // Jantar: o teste da tela Hoje (Fase 1) marca o almoço, a próxima refeição pendente.
  const lunch = page.locator('section[aria-label="Refeição Jantar"]')
  await lunch.getByRole('button', { name: 'Comi outra coisa' }).click()
  await lunch.getByLabel(/Buscar alimento/).fill('arroz tipo')
  await page.keyboard.press('Enter')
  await lunch.getByLabel(/Gramas de Arroz/).fill('150')
  await expect(lunch.getByText('192 kcal').first()).toBeVisible()
  await lunch.getByRole('button', { name: '+ Fome, saciedade, humor e observação' }).click()
  await lunch.getByText('Bem', { exact: true }).click()
  await lunch.getByRole('button', { name: 'Salvar no diário' }).click()
  await expect(page.getByText('Obrigado por contar. Amanhã é um novo dia. Registro salvo no seu diário.')).toBeVisible()
  await expect(lunch.getByText('Comi outra coisa').first()).toBeVisible()
  await expect(lunch.getByText(/Arroz, tipo 1, cozido · 150 g/)).toBeVisible()
  await expect(lunch.getByText(/Humor: 🙂 bem/)).toBeVisible()

  // O nutricionista vê o registro no prontuário e responde no chat, citando o registro.
  const admin = await newSession(browser, 'admin')
  const id = await patientId(admin.page, 'Beatriz Exemplo')
  await admin.page.goto(`/admin/pacientes/${id}?aba=diario`)
  const entry = admin.page.locator('li', { hasText: 'Arroz, tipo 1, cozido 150 g' })
  await entry.getByLabel(/Comentário sobre Jantar/).fill('Boa troca! Lembre da salada.')
  await entry.getByRole('button', { name: 'Responder no chat' }).click()
  await admin.page.waitForLoadState('networkidle')
  await admin.ctx.close()

  await page.goto('/paciente/mensagens')
  const last = page.locator('.bubble').last()
  await expect(last).toContainText('Boa troca! Lembre da salada.')
  await expect(last.locator('.bubble__quote')).toContainText('Diário · Jantar')
})

test('avaliação com dobras (Jackson-Pollock 3) calcula o percentual de gordura no servidor', async ({ page }) => {
  await login(page, 'admin')
  const id = await patientId(page, 'Beatriz Exemplo')
  await page.goto(`/admin/pacientes/${id}?aba=evolucao`)
  await page.getByText('Registrar nova avaliação').click()
  await page.getByLabel('Peso (kg)').fill('74,5')
  await page.getByLabel('Protocolo').selectOption('jp3')
  await page.getByLabel('Tríceps •').fill('20')
  await page.getByLabel('Suprailíaca •').fill('18')
  await page.getByLabel('Coxa •').fill('25')
  // Prévia ao vivo e confirmação do servidor: mulher, 35 anos, soma 63 mm → 25,4%.
  await expect(page.locator('.calc-result')).toContainText('25,4%')
  await page.getByRole('button', { name: 'Salvar avaliação' }).click()
  await expect(page.getByText('Gordura corporal calculada: 25,4%.')).toBeVisible()
})

test('fotos de evolução são privadas: o paciente envia, o nutricionista vê, outro paciente não', async ({ page }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/evolucao')
  await page.getByText('Adicionar fotos').click()
  await page.getByLabel('Frente').setInputFiles({ name: 'frente.png', mimeType: 'image/png', buffer: PNG })
  await page.getByRole('button', { name: 'Enviar fotos' }).click()
  await expect(page.getByText('Foto salva.')).toBeVisible()
  const url = await page.locator('.photo-grid img').first().getAttribute('src')
  expect(url).toMatch(/^\/arquivos\//)
  expect((await page.request.get(url!)).status()).toBe(200)

  await login(page, 'lucas')
  expect((await page.request.get(url!)).status()).toBe(404)
  await login(page, 'admin')
  expect((await page.request.get(url!)).status()).toBe(200)
})

test('chat ao vivo: a mensagem do nutricionista aparece sem recarregar e fica marcada como lida', async ({ page, browser }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/mensagens')
  const admin = await newSession(browser, 'admin')
  const id = await patientId(admin.page, 'Beatriz Exemplo')
  await admin.page.goto(`/admin/pacientes/${id}?aba=mensagens`)
  await admin.page.getByLabel('Mensagem').fill('Mensagem ao vivo de teste')
  await admin.page.getByRole('button', { name: 'Enviar' }).click()
  // Sem recarregar a página do paciente: chega em poucos segundos.
  await expect(page.getByText('Mensagem ao vivo de teste')).toBeVisible({ timeout: 10_000 })
  // E o nutricionista vê que foi lida.
  await expect(admin.page.locator('.bubble', { hasText: 'Mensagem ao vivo de teste' })).toContainText('lida', { timeout: 15_000 })
  await admin.ctx.close()
})

test('plano ativado aparece no app do paciente em até 5 segundos, sem recarregar', async ({ page, browser }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/plano')
  const admin = await newSession(browser, 'admin')
  const id = await patientId(admin.page, 'Beatriz Exemplo')
  await admin.page.goto(`/admin/pacientes/${id}?aba=planos`)
  await admin.page.getByRole('link', { name: /Plano alimentar — reeducação/ }).first().click()
  const published = admin.page.url()
  await admin.page.getByRole('button', { name: 'Criar nova versão' }).click()
  await admin.page.waitForURL((u) => u.href !== published)
  await expect(admin.page.getByLabel('Revisei e aprovo este plano')).toBeVisible()
  await admin.page.getByLabel('Título').first().fill('Plano alimentar — ajuste de outubro')
  await admin.page.getByLabel('Revisei e aprovo este plano').check()
  admin.page.once('dialog', (d) => d.accept())
  await admin.page.getByRole('button', { name: 'Ativar no app do paciente' }).click()
  // Ativado: o painel passa a mostrar a versão publicada.
  await expect(admin.page.locator('h1')).toHaveText('Plano alimentar — ajuste de outubro')
  await expect(admin.page.getByText('Publicado', { exact: true }).first()).toBeVisible()
  const t0 = Date.now()
  await expect(page.getByRole('heading', { name: 'Plano alimentar — ajuste de outubro' })).toBeVisible({ timeout: 5_000 })
  expect(Date.now() - t0).toBeLessThan(5_000)
  await expect(page.getByText('Seu plano alimentar foi atualizado.')).toBeVisible()
  await admin.ctx.close()
})

test('plano do dia abre sem internet depois do primeiro acesso', async ({ page, context }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/plano')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // Segundo acesso já controlado pelo service worker: a tela fica guardada no aparelho.
  await page.reload()
  await expect(page.locator('h1').first()).toBeVisible()
  const title = await page.locator('h1').first().textContent()
  await context.setOffline(true)
  await page.goto('/paciente/plano')
  await expect(page.locator('h1').first()).toHaveText(title!)
  await expect(page.getByText('Você está sem internet.')).toBeVisible()
  await context.setOffline(false)
})

test('PDF do plano e metas marcadas pelo paciente', async ({ page }) => {
  await login(page, 'beatriz')
  const pdf = await page.request.get('/paciente/plano/pdf')
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toBe('application/pdf')
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')

  await page.goto('/paciente/evolucao')
  const goal = page.getByRole('checkbox', { name: 'Reduzir a circunferência da cintura' })
  await expect(goal).toHaveAttribute('aria-checked', 'false')
  await goal.click()
  await expect(goal).toHaveAttribute('aria-checked', 'true')

  // Outro paciente não baixa o plano de ninguém além do próprio.
  await login(page, 'lucas')
  expect((await page.request.get('/paciente/plano/pdf')).status()).toBe(404)
})

test('tarefa agendada roda os lembretes com o segredo', async ({ request }) => {
  const res = await request.get('/api/cron', { headers: { Authorization: 'Bearer segredo-de-teste' } })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.push).toMatchObject({ refeicoes: expect.any(Number), agua: expect.any(Number) })
})
