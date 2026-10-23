import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, login } from './helpers'
import type { Page } from '@playwright/test'

const WA = 'https://wa.me/5541991551789'

test('página principal enxuta: quem é o André, agendar consulta e rodapé', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('André Farion')
  // Sem foto real: monograma "AF" (nada de pedir a foto no site).
  await expect(page.locator('.monogram')).toHaveText('AF')
  await expect(page.getByText('A foto profissional é enviada em Configurações')).toHaveCount(0)
  // Só o que foi pedido: nada de serviços, depoimentos, FAQ, planos ou formulário externo na página principal.
  for (const gone of ['Formas de atendimento', 'Dúvidas comuns', 'O que dizem os pacientes', 'Nutrição é investimento em você']) {
    await expect(page.getByRole('heading', { name: gone })).toHaveCount(0)
  }
  await expect(page.locator('a[href*="forms.gle"]')).toHaveCount(0)
  // Agendar: visitante passa pelo cadastro; "Ver planos" leva a /planos.
  const hero = page.locator('.home-hero')
  await expect(hero.getByRole('link', { name: 'Agendar consulta' })).toHaveAttribute('href', '/criar-conta?next=/agendar')
  await expect(hero.getByRole('link', { name: 'Ver planos' })).toHaveAttribute('href', '/planos')
  await expect(page.locator('#agendar').getByRole('link', { name: 'Começar agora' })).toHaveAttribute('href', '/criar-conta?next=/agendar')
  // Rodapé: privacidade, planos, área do cliente, WhatsApp e CRN.
  const footer = page.locator('.site-footer')
  await expect(footer.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade')
  await expect(footer.getByRole('link', { name: 'Planos' })).toHaveAttribute('href', '/planos')
  await expect(footer.getByRole('link', { name: 'Área do cliente' })).toHaveAttribute('href', '/entrar')
  await expect(footer.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', new RegExp(`^${WA}`))
  await expect(footer).toContainText('CRN')
  // Menu do cabeçalho com "Planos" e "Entrar".
  await expect(page.locator('.site-header').getByRole('link', { name: 'Planos' })).toHaveAttribute('href', '/planos')
  await expect(page.locator('.site-header').getByRole('link', { name: 'Entrar' })).toBeVisible()
})

test('página principal cabe em até 3 rolagens no celular', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 })
  await page.goto('/')
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  expect(h).toBeLessThanOrEqual(760 * 3)
})

test('logo e nome levam à página principal em todas as áreas', async ({ page }) => {
  const logo = page.getByRole('link', { name: 'Ir para a página inicial' }).first()
  for (const path of ['/planos', '/privacidade', '/login', '/criar-conta']) {
    await page.goto(path)
    await expect(logo).toHaveAttribute('href', '/')
  }
  await page.goto('/planos')
  await logo.click()
  await expect(page).toHaveURL(/\/$/)
  // Na própria página principal, volta ao topo.
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await logo.click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await login(page, 'beatriz')
  await expect(logo).toHaveAttribute('href', '/')
  await login(page, 'admin')
  await expect(logo).toHaveAttribute('href', '/')
})

test('/planos: cards com valores, selo "Mais escolhido", comparação e botão para o cadastro', async ({ page }) => {
  await page.goto('/planos')
  await expect(page.getByRole('heading', { name: 'Escolha o seu plano' })).toBeVisible()
  await expect(page.locator('.plan__name')).toHaveText(['Mensal', 'Trimestral', 'Semestral', 'Anual'])
  const tri = page.locator('.plan', { hasText: 'Trimestral' })
  await expect(tri).toContainText('15% de desconto')
  await expect(tri).toContainText(/R\$\s212,50\/mês/)
  await expect(tri).toContainText(/de R\$\s750,00/)
  await expect(tri.locator('.plan__price')).toHaveAttribute('aria-label', /^R\$\s637,50$/)
  const anual = page.locator('.plan', { hasText: 'Anual' })
  await expect(anual.locator('.plan__ribbon')).toHaveText('Mais escolhido')
  await expect(page.locator('.plan__ribbon')).toHaveCount(1)
  await expect(anual.locator('.plan__price')).toHaveAttribute('aria-label', /^R\$\s2\.250,00$/)
  await expect(page.locator('.plan', { hasText: 'Semestral' }).locator('.plan__price')).toHaveAttribute('aria-label', /^R\$\s1\.200,00$/)
  await expect(page.locator('.plan', { hasText: 'Mensal' }).locator('.plan__price')).toHaveAttribute('aria-label', /^R\$\s250,00$/)
  await expect(anual.getByRole('link', { name: 'Quero este plano' })).toHaveAttribute('href', /^\/criar-conta\?plano=[0-9a-f-]{36}$/)
  // Comparação: itens comuns com check em todos; benefícios exclusivos só no Semestral e no Anual.
  const table = page.locator('.compare__table')
  await expect(table.locator('tr', { hasText: 'Dieta personalizada' }).locator('.compare__yes')).toHaveCount(4)
  await expect(table.locator('tr', { hasText: 'Vale avaliação física' }).locator('.compare__yes')).toHaveCount(2)
  // Os valores das consultas continuam fora do site.
  await page.goto('/')
  await expect(page.locator('main')).not.toContainText('R$')
})

test('agendamento pelo site e bloqueio de conflito no mesmo horário', async ({ page }) => {
  await page.goto('/agendar')
  await page.getByRole('link', { name: /Retorno/ }).click()
  await page.getByRole('link', { name: /Presencial/ }).first().click()
  const day = page.locator('.day-btn:not([aria-disabled="true"])').first()
  await day.click()
  const slot = page.locator('.slot').first()
  const time = (await slot.textContent())!.trim()
  await slot.click()
  const url = page.url()

  await page.getByLabel('Nome completo').fill('Pessoa Agendamento Teste')
  await page.getByLabel('E-mail').fill('agenda-teste@example.com')
  await page.getByLabel('Telefone / WhatsApp').fill('11912345678')
  await page.getByLabel(/Li e concordo/).check()
  await page.getByRole('button', { name: 'Solicitar agendamento' }).click()
  await expect(page).toHaveURL(/\/agendar\/confirmado\?codigo=/)
  await expect(page.getByRole('heading', { name: 'Seu pedido de agendamento foi registrado' })).toBeVisible()
  await expect(page.getByText('Pendente')).toBeVisible()

  // O mesmo horário não pode ser reservado de novo.
  await page.goto(url)
  await expect(page.locator('.slot', { hasText: time })).toHaveCount(0)
})

/** Troca, pelo painel, para onde o "Agendar consulta" leva. */
async function bookingChannel(page: Page, channel: 'whatsapp' | 'site') {
  await login(page, 'admin')
  await page.goto('/admin/configuracoes')
  await page.getByLabel('Botão “Agendar consulta” do site').selectOption(channel)
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByText('Perfil e identidade visual atualizados.')).toBeVisible()
  await page.context().clearCookies()
}

test('opção do painel: agendamento pelo WhatsApp', async ({ page }) => {
  await bookingChannel(page, 'whatsapp')
  try {
    await page.goto('/')
    await expect(page.locator('.home-hero').getByRole('link', { name: 'Agendar consulta' })).toHaveAttribute('href', new RegExp(`^${WA}\\?text=`))
    const res = await page.request.get('/agendar', { maxRedirects: 0 })
    expect(res.status()).toBe(307)
    expect(res.headers().location).toMatch(new RegExp(`^${WA}\\?text=`))
  } finally {
    await bookingChannel(page, 'site')
  }
})

test('layout responsivo no celular (site)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  for (const path of ['/', '/planos', '/agendar', '/login', '/privacidade', '/criar-conta']) {
    await page.goto(path)
    await expectNoHorizontalScroll(page)
  }
})

test('política de privacidade (LGPD) com contato e responsável', async ({ page }) => {
  await page.goto('/privacidade')
  await expect(page.getByRole('heading', { name: 'Política de privacidade', level: 1 })).toBeVisible()
  for (const h of ['Quais dados coletamos e para quê', 'Quem acessa', 'Onde ficam guardados', 'Por quanto tempo', 'Seus direitos']) {
    await expect(page.getByRole('heading', { name: new RegExp(h) })).toBeVisible()
  }
  await expect(page.getByText('dados pessoais sensíveis')).toBeVisible()
  await expect(page.getByText('[CPF/CNPJ DO RESPONSÁVEL]').first()).toBeVisible()
})
