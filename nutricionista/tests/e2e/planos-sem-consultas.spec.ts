import { expect, test, type Page } from '@playwright/test'
import { login, openPatient, payWithCard } from './helpers'

/**
 * Uma única seção de planos (página inicial, #planos) e o fluxo sem consultas avulsas:
 * Ver planos → Contratar (Mercado Pago) → Criar conta → Anamnese → Plano no app.
 */

const PASS = 'SemConsulta#2026'
const CONSULTA = /\bconsulta\b|Agendar|Próxima consulta/i

/** Páginas públicas: todas do sitemap, mais as de entrada. */
async function publicPaths(page: Page) {
  const xml = await (await page.request.get('/sitemap.xml')).text()
  return [...new Set([...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname), '/login', '/criar-conta', '/recuperar-senha'])]
}

const screenText = (page: Page) => page.evaluate(() => [document.title, document.body.innerText].join('\n'))

test('só existe uma seção com os cards de planos em todo o site: #planos, logo depois de "Como funciona"', async ({ page }) => {
  await page.context().clearCookies()
  let total = 0
  for (const path of await publicPaths(page)) {
    await page.goto(path)
    const n = await page.locator('.tl-plans').count()
    if (path === '/') expect(n, path).toBe(1)
    else expect(n, path).toBe(0)
    total += n
    // Nem cards, nem "Incluso em todos os planos", nem a comparação fora da seção.
    expect(await page.locator('.tl-plan, .compare-tl, .included').count(), path).toBe(path === '/' ? await page.locator('#planos .tl-plan, #planos .compare-tl, #planos .included').count() : 0)
  }
  expect(total).toBe(1)

  await page.goto('/')
  const section = page.locator('#consultoria + #planos')
  await expect(section.getByRole('heading', { name: 'Escolha o seu plano' })).toBeVisible()
  await expect(section).toContainText('Quanto mais longo, menor o valor por mês')
  await expect(section.locator('.tl-plan__name')).toHaveText(['Mensal', 'Trimestral', 'Semestral', 'Anual'])
  await expect(section.locator('.tl-plan__badge')).toHaveText(['MAIS ESCOLHIDO'])
  await expect(section.getByRole('heading', { name: 'INCLUSO EM TODOS OS PLANOS' })).toBeVisible()
  // Comparação recolhida por padrão.
  await expect(section.locator('.compare-tl')).toBeHidden()
  await section.getByText('Comparar os planos', { exact: true }).click()
  await expect(section.locator('.compare-tl')).toBeVisible()
  // "Como funciona a consultoria": só as 4 etapas e o botão que rola até #planos.
  await expect(page.locator('#consultoria .step')).toHaveCount(4)
  await expect(page.locator('#consultoria').getByRole('link', { name: /Ver planos/ })).toHaveAttribute('href', '#planos')
  // Menu: "Planos" fica ativo com a seção na tela.
  const navPlanos = page.locator('.tl-nav').getByRole('link', { name: 'Planos', exact: true })
  await expect(navPlanos).toHaveAttribute('href', '/#planos')
  await section.scrollIntoViewIfNeeded()
  await expect(navPlanos).toHaveAttribute('aria-current', 'location')
})

test('/planos e /agendar redirecionam (301) para /#planos; nenhum link interno aponta para /planos', async ({ page, browser }) => {
  for (const path of ['/planos', '/agendar', '/agendar/confirmado']) {
    const res = await page.request.get(path, { maxRedirects: 0 })
    expect(res.status(), path).toBe(301)
    expect(res.headers().location, path).toBe('/#planos')
  }
  const old = /^\/(planos|agendar)(\/|\?|#|$)/
  await page.context().clearCookies()
  for (const path of await publicPaths(page)) {
    await page.goto(path)
    const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))
    expect(hrefs.filter((h) => old.test(h)), path).toEqual([])
  }
  // Área do cliente também.
  const ctx = await browser.newContext()
  const app = await ctx.newPage()
  await login(app, 'beatriz')
  for (const path of ['/paciente', '/paciente/mais', '/paciente/meus-dados', '/paciente/plano', '/paciente/evolucao', '/paciente/meu-corpo']) {
    await app.goto(path)
    const hrefs = await app.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))
    expect(hrefs.filter((h) => old.test(h)), path).toEqual([])
  }
  await ctx.close()
})

test('nenhuma página do site nem do app mostra "Agendar", "Próxima consulta" ou a palavra consulta', async ({ page }) => {
  await page.context().clearCookies()
  for (const path of await publicPaths(page)) {
    await page.goto(path)
    expect(await screenText(page), path).not.toMatch(CONSULTA)
  }
  await login(page, 'beatriz')
  const seen = new Set<string>()
  const queue = ['/paciente', '/paciente/mais']
  while (queue.length && seen.size < 40) {
    const path = queue.shift()!
    if (seen.has(path)) continue
    seen.add(path)
    const res = await page.goto(path)
    expect(res?.status(), path).toBeLessThan(400)
    expect(await screenText(page), path).not.toMatch(CONSULTA)
    const links = await page.locator('a[href^="/paciente"]').evaluateAll((as) => as.map((a) => (a.getAttribute('href') ?? '').split('#')[0]))
    for (const h of links) if (!/\/pdf\b|\.ics$|\/whatsapp$|exportar/.test(h) && !seen.has(h)) queue.push(h)
  }
  expect(seen.size).toBeGreaterThan(10)
})

test('fluxo completo sem consulta: Ver planos → Contratar (Mercado Pago) → Criar conta → Anamnese → Plano no app', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto('/')
  await page.locator('#inicio').getByRole('link', { name: /Ver planos/ }).click()
  await expect(page).toHaveURL(/#planos$/)
  await page.locator('#planos .tl-plan', { hasText: 'Mensal' }).getByRole('link', { name: /Contratar/ }).click()
  await expect(page).toHaveURL(/\/criar-conta\?plano=[0-9a-f-]{36}$/)
  await page.getByLabel('Nome completo').fill('Cliente Sem Consulta')
  await page.getByLabel('E-mail').fill('sem.consulta@example.com')
  await page.getByLabel('WhatsApp').fill('41955550000')
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(PASS)
  await page.getByLabel('Confirme a senha').fill(PASS)
  await page.getByLabel(/Li e aceito a/).check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/paciente\/pagamento/)

  // Checkout do Mercado Pago (servidor falso tests/e2e/mp-falso.mjs): aprovado, segue para a anamnese.
  await payWithCard(page)
  await expect(page).toHaveURL(/\/paciente\/anamnese\?pago=1$/)
  await expect(page.getByRole('heading', { name: 'Como você prefere responder a anamnese?' })).toBeVisible()
  await page.getByRole('button', { name: 'Já enviei o formulário' }).click()
  await expect(page.getByRole('heading', { name: 'Obrigado! Sua anamnese foi enviada.' })).toBeVisible()
  await expect(page.getByText(/avaliação por videochamada, combinada pelo WhatsApp/)).toBeVisible()
  await page.getByRole('link', { name: 'Ir para minha área' }).click()
  await expect(page.locator('.hub-steps li[aria-current="step"]')).toContainText('Avaliação e metas')

  // Coach monta e ativa o plano; a avaliação é registrada em Avaliações e evolução (sem agenda).
  await login(page, 'admin')
  await expect(page.getByRole('link', { name: 'Agenda' })).toHaveCount(0)
  const id = await openPatient(page, 'Cliente Sem Consulta')
  await expect(page.getByRole('link', { name: 'Consultas', exact: true })).toHaveCount(0)
  await page.goto(`/admin/pacientes/${id}?aba=planos`)
  await page.getByLabel('Título').fill('Plano inicial')
  await page.getByRole('button', { name: 'Criar rascunho' }).click()
  await page.waitForURL(/\/admin\/planos\/[0-9a-f-]{36}/)
  const cafe = page.locator('section[aria-label="Refeição Café da manhã"]')
  await cafe.getByLabel('Adicionar alimento em Café da manhã').fill('pão francês')
  await expect(cafe.locator('[role="option"]:visible').first()).toBeVisible()
  await page.keyboard.press('Enter')
  await page.getByLabel('Revisei e aprovo este plano').check()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Ativar no app do cliente' }).click()
  await expect(page.locator('.page-head .badge').first()).toHaveText('Publicado')

  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('sem.consulta@example.com')
  await page.getByLabel('Senha').fill(PASS)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/paciente$/)
  await expect(page.locator('.next-meal')).toContainText('Pão, trigo, francês')
  await page.goto('/paciente/plano')
  await expect(page.getByRole('heading', { name: 'Plano inicial' })).toBeVisible()
})

test('com os valores dos planos desligados, os cards ficam sem preço e o botão vira "Falar no WhatsApp"', async ({ page }) => {
  const toggle = async (on: boolean) => {
    await login(page, 'admin')
    await page.goto('/admin/configuracoes')
    const box = page.getByLabel(/Mostrar os valores dos planos de acompanhamento no site/)
    if (on) await box.check()
    else await box.uncheck()
    await page.getByRole('button', { name: 'Salvar perfil' }).click()
    await expect(page.getByText('Perfil e identidade visual atualizados.')).toBeVisible()
    await page.context().clearCookies()
  }
  await toggle(false)
  try {
    await page.goto('/')
    const plans = page.locator('#planos')
    await expect(plans.locator('.tl-plan__price')).toHaveCount(0)
    await expect(plans.getByRole('link', { name: /Contratar/ })).toHaveCount(0)
    const wa = plans.locator('.tl-plan', { hasText: 'Anual' }).getByRole('link', { name: /Falar no WhatsApp/ })
    await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/5541991551789\?text=.*Plano%20Anual/)
  } finally {
    await toggle(true)
  }
  await page.goto('/')
  await expect(page.locator('#planos .tl-plan__price')).toHaveCount(4)
})
