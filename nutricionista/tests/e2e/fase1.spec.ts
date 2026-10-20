import { expect, test } from '@playwright/test'
import { login } from './helpers'

/** Critérios de aceite da Fase 1 (cálculos, app do paciente e recursos por paciente). */

test('editor: 150 g de arroz = 192 kcal; 3 colheres de sopa recalcula; substituição dentro de ±10%', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/planos')
  await page.getByRole('link', { name: 'Modelo — Treino e descanso' }).click()
  await page.getByRole('button', { name: '+ Lanche da manhã' }).click()
  const meal = page.locator('section[aria-label="Refeição Lanche da manhã"]')
  await meal.getByLabel('Adicionar alimento em Lanche da manhã').fill('arroz tipo')
  await page.keyboard.press('Enter')
  await meal.getByLabel('Gramas').fill('150')
  await expect(meal.locator('.item-name .nutri-inline').first()).toContainText('192 kcal')
  await meal.getByLabel('Medida caseira').selectOption({ label: 'colher de sopa cheia (25 g)' })
  await meal.getByLabel('Qtd.').fill('3')
  await expect(meal.getByLabel('Gramas')).toHaveValue('75')
  await expect(meal.locator('.item-name .nutri-inline').first()).toContainText('96 kcal')

  await meal.getByRole('button', { name: 'Sugerir equivalentes' }).click()
  const pcts = await meal.locator('.suggestions .row').allTextContents()
  expect(pcts.length).toBeGreaterThan(0)
  for (const t of pcts) {
    const m = t.match(/\(([+-]?\d+)%\)/)
    expect(Math.abs(Number(m![1]))).toBeLessThanOrEqual(10)
  }
  await meal.locator('.suggestions button').first().click()
  await expect(meal.locator('.subs-box').first()).toContainText('↔')
  await page.getByRole('button', { name: 'Salvar rascunho' }).click()
  await expect(page.getByText('Rascunho salvo. O paciente ainda não vê esta versão.')).toBeVisible()
})

test('app do paciente: marcar refeição, água e peso na tela Hoje', async ({ page }) => {
  await login(page, 'beatriz')
  await expect(page.getByRole('heading', { name: 'Olá, Beatriz!' })).toBeVisible()
  const water = page.locator('section', { has: page.getByRole('heading', { name: 'Água' }) })
  const before = await water.locator('.card__head strong').textContent()
  await water.getByRole('button', { name: '+ 250 ml' }).click()
  await expect(water.locator('.card__head strong')).not.toHaveText(before!)
  await page.reload()
  await expect(water.locator('.card__head strong')).toHaveText('1 L')

  const timeline = page.locator('.timeline-day')
  const pending = timeline.getByRole('button', { name: /^Marcar .* como feita$/ }).first()
  const label = await pending.getAttribute('aria-label')
  await pending.click()
  const mealName = label!.replace('Marcar ', '').replace(' como feita', '')
  await expect(timeline.locator('li', { hasText: mealName }).getByText('Feita')).toBeVisible()
  await page.reload()
  await expect(timeline.locator('li', { hasText: mealName }).getByText('Feita')).toBeVisible()

  await page.getByLabel('Registrar peso de hoje (kg)').fill('74,6')
  await page.getByRole('button', { name: 'Salvar peso' }).click()
  await expect(page.getByText('Peso registrado.')).toBeVisible()
})

test('calculadoras: IMC 70 kg/1,65 m = 25,7 e Mifflin = 1.420,25 kcal (×1,55 = 2.201,4)', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/calculadoras')
  await page.getByRole('link', { name: 'IMC e peso' }).click()
  await page.getByLabel('Peso (kg)').fill('70')
  await page.getByLabel('Altura (cm)').fill('165')
  await page.getByLabel('Idade (anos)').fill('30')
  await expect(page.locator('.calc-result')).toContainText('25,7')
  await expect(page.locator('.calc-result')).toContainText('Sobrepeso')

  await page.getByRole('link', { name: 'Gasto energético' }).click()
  await page.getByLabel('Sexo').selectOption('F')
  await page.getByLabel('Nível de atividade').selectOption('1.55')
  await expect(page.locator('.calc-result')).toContainText('1.420,25 kcal')
  await expect(page.locator('.calc-result')).toContainText('2.201,4 kcal')
})

test('recursos por paciente: ocultar calorias some com os números no app', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/pacientes')
  await page.getByRole('link', { name: 'Beatriz Exemplo' }).click()
  const form = page.locator('section', { has: page.getByRole('heading', { name: 'Recursos do app do paciente' }) })
  await form.getByLabel('Calorias visíveis').uncheck()
  await form.getByLabel('Macros visíveis').uncheck()
  await form.getByRole('button', { name: 'Salvar recursos' }).click()
  await expect(page.getByText('Recursos do app atualizados.')).toBeVisible()

  await login(page, 'beatriz')
  await page.goto('/paciente/plano')
  await expect(page.getByRole('heading', { name: 'Plano alimentar — reeducação' })).toBeVisible()
  await expect(page.getByText(/\d+ kcal/)).toHaveCount(0)

  await login(page, 'admin')
  await page.goto('/admin/pacientes')
  await page.getByRole('link', { name: 'Beatriz Exemplo' }).click()
  await form.getByLabel('Calorias visíveis').check()
  await form.getByLabel('Macros visíveis').check()
  await form.getByRole('button', { name: 'Salvar recursos' }).click()
  await expect(page.getByText('Recursos do app atualizados.')).toBeVisible()
})
