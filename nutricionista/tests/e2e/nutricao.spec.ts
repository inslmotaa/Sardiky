import { expect, test } from '@playwright/test'
import { login, openPatient } from './helpers'

/**
 * Fluxo nutricional de ponta a ponta: o coach define o plano contratado, monta só o café da manhã,
 * ativa no app e a cliente vê o café na tela Hoje, no Plano e no Meu perfil (com o plano contratado).
 */
test('coach envia o café da manhã; cliente vê no Hoje, no Plano e no Meu perfil', async ({ page }) => {
  await login(page, 'admin')
  // Início do coach: quem está com o plano contratado perto de vencer.
  await expect(page.getByRole('heading', { name: 'Planos para enviar ou renovar' })).toBeVisible()
  await expect(page.locator('section[aria-labelledby="planos-pendentes"]')).toContainText(/Lucas Fictício · Plano Mensal vence em/)

  // Plano contratado na ficha: Trimestral a partir de hoje.
  await openPatient(page, 'Helena Teste')
  await page.getByLabel('Plano contratado').selectOption({ label: 'Trimestral · 3 meses' })
  const start = await page.evaluate(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }))
  await page.getByLabel('Início do plano').fill(start)
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Cadastro atualizado.')).toBeVisible()
  await page.reload()
  await expect(page.locator('.page-head')).toContainText('Plano Trimestral até')

  // Novo plano em branco: continua a numeração e só o café da manhã é preenchido.
  await page.getByRole('link', { name: 'Planos alimentares', exact: true }).last().click()
  await page.getByLabel('Título').fill('Café da manhã reforçado')
  await page.getByRole('button', { name: 'Criar rascunho' }).click()
  await page.waitForURL(/\/admin\/planos\/[0-9a-f-]{36}/)
  await expect(page.locator('.page-head')).toContainText('versão 2')
  const cafe = page.locator('section[aria-label="Refeição Café da manhã"]')
  for (const q of ['pão francês', 'mamão papaia']) {
    await cafe.getByLabel('Adicionar alimento em Café da manhã').fill(q)
    await expect(cafe.locator('[role="option"]:visible').first()).toBeVisible()
    await page.keyboard.press('Enter')
  }
  await expect(cafe.getByText('Pão, trigo, francês')).toBeVisible()
  await expect(cafe.getByText('Mamão, Papaia, cru')).toBeVisible()

  await page.getByLabel('Revisei e aprovo este plano').check()
  let dialog = ''
  page.once('dialog', (d) => {
    dialog = d.message()
    void d.accept()
  })
  await page.getByRole('button', { name: 'Ativar no app do cliente' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Plano ativado no app do cliente' })).toContainText('não foram enviadas: Almoço')
  expect(dialog).toContain('Ainda sem alimentos (não serão enviadas agora): Almoço')
  await expect(page.locator('.page-head .badge').first()).toHaveText('Publicado')

  // Cliente: café no Hoje, no Plano e no Meu perfil, com o plano contratado e a vigência.
  await login(page, 'helena')
  const next = page.locator('.next-meal')
  await expect(next.getByRole('heading', { name: /Café da manhã/ })).toBeVisible()
  await expect(next).toContainText('Pão, trigo, francês')
  await page.goto('/paciente/plano')
  await expect(page.getByRole('heading', { name: 'Café da manhã reforçado' })).toBeVisible()
  await expect(page.locator('main').getByRole('heading', { name: 'Almoço' })).toHaveCount(0)

  await page
    .getByRole('link', { name: /Meu perfil/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/paciente\/meus-dados$/)
  const acomp = page.locator('section[aria-labelledby="meu-acompanhamento"]')
  await expect(acomp).toContainText('Plano Trimestral')
  await expect(acomp).toContainText('faltam')
  await expect(acomp).toContainText('André Farion')
  const plano = page.locator('section[aria-labelledby="meu-plano-alimentar"]')
  await expect(plano).toContainText('Café da manhã reforçado')
  await expect(plano.locator('.profile-meals li')).toHaveCount(1)
  await expect(plano.getByRole('link', { name: 'Ver plano completo' })).toHaveAttribute('href', '/paciente/plano')
})

test('login único com "Mostrar senha" leva cada perfil à sua área', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Um só acesso para clientes e para o coach')).toBeVisible()
  const pass = page.getByLabel('Senha', { exact: true })
  await pass.fill('Paciente#Demo2026')
  await expect(pass).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Mostrar' }).click()
  await expect(pass).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('E-mail').fill('paciente@example.com')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/paciente$/)

  await login(page, 'admin')
  await expect(page.locator('.sidebar .brand__title')).toHaveText('Farion')
})
