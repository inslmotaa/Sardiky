import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('áreas privadas exigem login', async ({ page }) => {
  await page.goto('/paciente')
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
  const res = await page.request.get('/paciente/meus-dados/exportar')
  expect(res.status()).toBe(401)
  const csv = await page.request.get('/admin/relatorios/csv?tipo=atendimentos')
  expect(csv.status()).toBe(403)
})

test('senha errada mostra mensagem genérica', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('paciente@example.com')
  await page.getByLabel('Senha').fill('errada-123456')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
})

test('cookie de sessão é httpOnly', async ({ page }) => {
  await login(page, 'beatriz')
  const cookie = (await page.context().cookies()).find((c) => c.name === 'nutri_session')
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie?.sameSite).toBe('Lax')
})

test('paciente não acessa o painel nem dados de outro paciente', async ({ page }) => {
  // Lucas tem um formulário pendente; guardamos o endereço dele.
  await login(page, 'lucas')
  await page.goto('/paciente/formularios')
  await page.getByRole('link', { name: 'Preencher' }).first().click()
  await expect(page).toHaveURL(/\/paciente\/formularios\/[0-9a-f-]{36}$/)
  const lucasForm = page.url()

  // Lucas envia uma foto no diário (arquivo privado).
  await page.goto('/paciente/diario')
  await page.getByRole('button', { name: '+ Registrar algo fora do plano' }).click()
  await page.getByLabel('Descreva com suas palavras (opcional)').fill('Arroz, feijão e frango')
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex')
  await page.getByLabel('Foto do prato (opcional)').setInputFiles({ name: 'prato.png', mimeType: 'image/png', buffer: png })
  await page.getByRole('button', { name: 'Salvar no diário' }).click()
  await expect(page.getByText('Registro salvo no seu diário.')).toBeVisible()
  const photoUrl = await page.locator('img[alt^="Foto:"]').first().getAttribute('src')
  expect(photoUrl).toMatch(/^\/arquivos\//)
  expect((await page.request.get(photoUrl!)).status()).toBe(200)

  // Beatriz não consegue abrir o formulário nem a foto de Lucas.
  await login(page, 'beatriz')
  const res = await page.goto(lucasForm)
  expect(res?.status()).toBe(404)
  expect((await page.request.get(photoUrl!)).status()).toBe(404)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login\?sem-acesso=painel/)

  // Visitante anônimo também não.
  await page.context().clearCookies()
  expect((await page.request.get(photoUrl!)).status()).toBe(404)
})

test('equipe sem permissão clínica não vê dados de saúde', async ({ page }) => {
  await login(page, 'staff')
  await page.goto('/admin/planos')
  await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible()
  await page.goto('/admin/pacientes')
  await page.getByRole('link', { name: 'Beatriz Exemplo' }).click()
  await expect(page.getByRole('link', { name: 'Notas clínicas' })).toHaveCount(0)
  await page.goto(page.url().split('?')[0] + '?aba=notas')
  await expect(page.getByText('Boa adesão nos dias úteis')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Mensagens' })).toHaveCount(0)
})

test('tarefa agendada exige segredo', async ({ request }) => {
  expect((await request.get('/api/cron')).status()).toBe(401)
  const ok = await request.get('/api/cron', { headers: { Authorization: 'Bearer segredo-de-teste' } })
  expect(ok.status()).toBe(200)
})
