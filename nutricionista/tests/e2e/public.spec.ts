import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, login } from './helpers'
import type { Page } from '@playwright/test'

const WA = 'https://wa.me/5541991551789'

test('página principal: storytelling animado, quem é o André, método, app, como funciona, dúvidas e agendar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Comer bem não precisa ser')
  await expect(page.getByRole('heading', { name: 'Segunda-feira, 7h. O dia já começou correndo.' })).toBeAttached()
  // Quem é: "Coach", sem foto/monograma e sem "Nutricionista" ou CRN em lugar nenhum.
  const about = page.locator('#apresentacao')
  await expect(about.getByRole('heading', { level: 2 })).toHaveAccessibleName('André Farion')
  await expect(about.locator('.eyebrow')).toHaveText('Coach')
  await expect(page.locator('.monogram, .home-photo')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(/nutricionista|CRN/i)
  // Frutas animadas no site e na história.
  expect(await page.locator('.story svg, .hero-decor svg').count()).toBeGreaterThan(6)
  // Seções curtas, cada uma levando à sua página.
  for (const id of ['#metodo', '#app', '#como-funciona', '#duvidas']) await expect(page.locator(id)).toBeAttached()
  await expect(page.getByRole('link', { name: 'Ver o passo a passo completo →' })).toHaveAttribute('href', '/como-funciona')
  await expect(page.getByRole('link', { name: 'Ver todas as dúvidas →' })).toHaveAttribute('href', '/duvidas')
  await expect(page.locator('a[href*="forms.gle"]')).toHaveCount(0)
  // Agendar: visitante passa pelo cadastro; "Ver planos" leva a /planos.
  await expect(page.locator('.story-open').getByRole('link', { name: 'Agendar consulta' })).toHaveAttribute('href', '/criar-conta?next=/agendar')
  await expect(about.getByRole('link', { name: 'Agendar consulta' })).toHaveAttribute('href', '/criar-conta?next=/agendar')
  await expect(about.getByRole('link', { name: 'Ver planos' })).toHaveAttribute('href', '/planos')
  await expect(page.locator('#agendar').getByRole('link', { name: 'Começar agora' })).toHaveAttribute('href', '/criar-conta?next=/agendar')
  // Rodapé: páginas, área do cliente, privacidade e WhatsApp.
  const footer = page.locator('.site-footer')
  await expect(footer.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade')
  await expect(footer.getByRole('link', { name: 'Planos' })).toHaveAttribute('href', '/planos')
  await expect(footer.getByRole('link', { name: 'Área do cliente' })).toHaveAttribute('href', '/entrar')
  await expect(footer.getByRole('link', { name: 'WhatsApp' }).first()).toHaveAttribute('href', new RegExp(`^${WA}`))
  await expect(footer).toContainText('André Farion · Coach')
  // Menu do cabeçalho com as páginas e "Entrar".
  const nav = page.locator('.site-nav')
  for (const [name, href] of [['Sobre', '/sobre'], ['Como funciona', '/como-funciona'], ['Planos', '/planos'], ['Dúvidas', '/duvidas'], ['Entrar', '/entrar']])
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href)
})

test('páginas Sobre, Como funciona e Dúvidas', async ({ page }) => {
  await page.goto('/sobre')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('André Farion')
  await expect(page.getByRole('heading', { name: 'Como eu trabalho' })).toBeVisible()
  await expect(page.locator('.site-nav').getByRole('link', { name: 'Sobre' })).toHaveAttribute('aria-current', 'page')
  await page.goto('/como-funciona')
  await expect(page.locator('.timeline__item')).toHaveCount(6)
  await expect(page.getByText('Dieta personalizada')).toBeVisible()
  await page.goto('/duvidas')
  await expect(page.locator('.faq__item').first()).toBeVisible()
  await page.locator('.faq__item summary').first().click()
  await expect(page.locator('.faq__item').first().locator('p')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tirar dúvida pelo WhatsApp' })).toHaveAttribute('href', new RegExp(`^${WA}`))
})

test('menu do celular abre com as páginas e fecha ao navegar', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 })
  await page.goto('/')
  await expect(page.locator('.site-nav')).toBeHidden()
  await page.locator('.site-menu summary').click()
  const panel = page.locator('.site-menu__panel')
  await expect(panel.getByRole('link', { name: 'Entrar na área do cliente' })).toHaveAttribute('href', '/entrar')
  await panel.getByRole('link', { name: 'Como funciona' }).click()
  await expect(page).toHaveURL(/\/como-funciona$/)
  await expect(page.locator('.site-menu')).not.toHaveAttribute('open', '')
})

test('logo e nome levam à página principal em todas as áreas', async ({ page }) => {
  const logo = page.getByRole('link', { name: 'Ir para a página inicial' }).first()
  for (const path of ['/planos', '/sobre', '/como-funciona', '/duvidas', '/privacidade', '/login', '/criar-conta']) {
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
  // Na página principal, só o "a partir de" dos planos (valores das consultas continuam fora do site).
  await page.goto('/')
  await expect(page.locator('.home-plans')).toContainText(/a partir de R\$\s187,50\/mês/)
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
    await expect(page.locator('#apresentacao').getByRole('link', { name: 'Agendar consulta' })).toHaveAttribute('href', new RegExp(`^${WA}\\?text=`))
    const res = await page.request.get('/agendar', { maxRedirects: 0 })
    expect(res.status()).toBe(307)
    expect(res.headers().location).toMatch(new RegExp(`^${WA}\\?text=`))
  } finally {
    await bookingChannel(page, 'site')
  }
})

test('layout responsivo no celular (site)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  for (const path of ['/', '/sobre', '/como-funciona', '/planos', '/duvidas', '/agendar', '/login', '/privacidade', '/criar-conta']) {
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
