import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('Alimentos: TACO 4ª ed. completa, tabela nutricional e medidas caseiras do IBGE', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/alimentos')
  await expect(page.getByText(/597 da TACO 4ª ed\./)).toBeVisible()
  await expect(page.getByText(/Tabela Brasileira de Composição de Alimentos – TACO/)).toBeVisible()

  // Busca e filtro pela fonte.
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('banana')
  await page.getByLabel('Fonte').selectOption('TACO')
  await page.getByRole('button', { name: 'Filtrar' }).click()
  const row = page.locator('tr', { hasText: 'Banana, prata, crua' })
  await expect(row).toContainText('TACO 4ª ed. · nº 182')
  await row.getByRole('link', { name: 'Banana, prata, crua' }).click()

  // Tabela nutricional completa por 100 g e por medida caseira.
  await expect(page.getByRole('heading', { level: 1, name: 'Banana, prata, crua' })).toBeVisible()
  const table = page.locator('.nutri-table')
  await expect(table.locator('tr', { hasText: 'Vitamina C' })).toContainText('21,6')
  await expect(table.locator('tr', { hasText: 'Potássio' })).toContainText('358')
  await expect(table.locator('tr', { hasText: 'Sódio' })).toContainText('Tr')
  await page.getByLabel('Porção em gramas').selectOption({ label: 'unidade média (60 g)' })
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await expect(table.locator('tr', { hasText: 'Vitamina C' })).toContainText('13')

  // Sugestão do IBGE vira medida caseira com um clique.
  const ibge = page.getByRole('region', { name: 'Sugestões do IBGE' })
  await expect(ibge.getByText(/banana \(ouro, prata/).first()).toBeVisible()
  const first = ibge.locator('li').first()
  const label = (await first.locator('strong').innerText()).trim()
  await first.getByRole('button', { name: 'Usar' }).click()
  await expect(page.getByText('Medida adicionada.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Medidas caseiras' })).toContainText(label)
})

test('editor de plano mostra vitaminas e minerais do dia (TACO)', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/planos')
  await page.locator('tr', { hasText: 'Rascunho' }).first().getByRole('link').first().click()
  const card = page.getByRole('region', { name: /Vitaminas e minerais/ })
  await expect(card).toBeVisible()
  for (const n of ['Cálcio', 'Ferro', 'Potássio', 'Vitamina C', 'Colesterol']) await expect(card).toContainText(n)
})
