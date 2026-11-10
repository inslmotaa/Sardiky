import { expect, test } from '@playwright/test'
import { login } from './helpers'

/** Parte 3: SEO (robots, sitemap, metadados, JSON-LD), Conteúdos (blog) e captação (UTM e pixels com consentimento). */

const meta = (page: import('@playwright/test').Page, sel: string) => page.locator(sel).first().getAttribute('content')

test('robots.txt e sitemap.xml: áreas privadas fora do índice, páginas públicas no mapa', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text()
  for (const p of ['/admin', '/painel', '/paciente', '/app', '/login', '/entrar', '/criar-conta', '/recuperar-senha', '/redefinir-senha', '/api/'])
    expect(robots).toContain(`Disallow: ${p}`)
  expect(robots).toMatch(/Sitemap: http:\/\/localhost:\d+\/sitemap\.xml/)

  const res = await request.get('/sitemap.xml')
  expect(res.ok()).toBe(true)
  const xml = await res.text()
  for (const p of ['/sobre', '/como-funciona', '/conteudos', '/duvidas']) expect(xml).toContain(`${p}</loc>`)
  // Planos só na página inicial (#planos): /planos e /agendar não existem mais no mapa.
  expect(xml).not.toMatch(/\/(planos|agendar)<\/loc>/)
  expect(xml).not.toMatch(/\/(admin|paciente|login)/)
  // O rascunho de exemplo do seed não entra.
  expect(xml).not.toContain('exemplo-de-conteudo')
})

test('título, descrição, canonical, Open Graph, Twitter Card e lang em cada página pública', async ({ page, request }) => {
  await page.goto('/sobre')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await expect(page).toHaveTitle('Sobre · Farion')
  expect(await meta(page, 'meta[name="description"]')).toContain('André Farion, Coach')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/sobre$/)
  expect(await meta(page, 'meta[property="og:title"]')).toBe('Sobre')
  expect(await meta(page, 'meta[property="og:locale"]')).toBe('pt_BR')
  expect(await meta(page, 'meta[property="og:url"]')).toMatch(/\/sobre$/)
  expect(await meta(page, 'meta[property="og:image"]')).toMatch(/\/opengraph-image/)
  expect(await meta(page, 'meta[name="twitter:card"]')).toBe('summary_large_image')
  expect(await meta(page, 'meta[name="twitter:image"]')).toMatch(/\/twitter-image/)

  // Títulos próprios e sem duplicar canonical entre páginas.
  const seen = new Set<string>()
  for (const [path, title] of [
    ['/', 'Farion · André Farion, Coach · Planos de acompanhamento'],
    ['/como-funciona', 'Como funciona · Farion'],
    ['/duvidas', 'Dúvidas · Farion'],
    ['/conteudos', 'Conteúdos · Farion'],
  ]) {
    await page.goto(path)
    await expect(page).toHaveTitle(title)
    const canonical = (await page.locator('link[rel="canonical"]').getAttribute('href'))!
    expect(seen.has(canonical)).toBe(false)
    seen.add(canonical)
    expect(await meta(page, 'meta[name="robots"]')).toBe('index, follow')
  }

  // Login e área do cliente: noindex.
  await page.goto('/login')
  expect(await meta(page, 'meta[name="robots"]')).toMatch(/noindex/)
  await page.goto('/criar-conta')
  expect(await meta(page, 'meta[name="robots"]')).toMatch(/noindex/)

  // Imagem de compartilhamento gerada (PNG 1200×630).
  const og = await request.get('/opengraph-image')
  expect(og.ok()).toBe(true)
  expect(og.headers()['content-type']).toBe('image/png')
  const png = await og.body()
  expect(png.readUInt32BE(16)).toBe(1200)
  expect(png.readUInt32BE(20)).toBe(630)
})

test('JSON-LD: Person + ProfessionalService (Coach, on-line) e FAQPage das dúvidas cadastradas', async ({ page }) => {
  const ld = async () =>
    Promise.all((await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t) as Record<string, unknown>))
  await page.goto('/')
  const [home] = await ld()
  const graph = home['@graph'] as Record<string, unknown>[]
  const person = graph.find((g) => g['@type'] === 'Person')!
  const service = graph.find((g) => g['@type'] === 'ProfessionalService')!
  expect(person).toMatchObject({ name: 'André Farion', jobTitle: 'Coach' })
  expect(service).toMatchObject({ areaServed: { name: 'Brasil' }, availableChannel: { name: 'Atendimento on-line (videochamada e app)' } })
  expect(service.telephone).toMatch(/^\+\d{12,13}$/)
  expect(JSON.stringify(home)).not.toMatch(/nutricionista|\bc\s*r\s*n\b|registro\s+profissional/i)

  await page.goto('/duvidas')
  const [faq] = await ld()
  expect(faq['@type']).toBe('FAQPage')
  const items = faq.mainEntity as { name: string; acceptedAnswer: { text: string } }[]
  await expect(page.locator('.faq__item')).toHaveCount(items.length)
  expect(items[0].name).toBe('Como funciona a primeira consulta?')
})

test('Conteúdos: coach escreve, rascunho fica fora do site, publica com convite final e entra no sitemap', async ({ page, request }) => {
  await login(page, 'admin')
  await page.goto('/admin/conteudos')
  await expect(page.getByRole('table', { name: 'Conteúdos' })).toContainText('Exemplo de conteúdo (rascunho)')
  await page.getByRole('link', { name: 'Novo conteúdo' }).click()
  await page.getByLabel('Título').fill('Café da manhã prático: 3 ideias')
  await page.getByLabel('Resumo').fill('Três combinações simples para a manhã corrida.')
  await page.getByLabel('Texto (Markdown)').fill(
    '## Por que planejar\n\nUma manhã **organizada** começa na noite anterior.\n\n- Iogurte com fruta\n- Ovos mexidos\n- Pão com queijo\n\nVeja os [planos](/#planos).\n\n<script>alert(1)</script>',
  )
  await page.getByRole('button', { name: 'Criar conteúdo' }).click()
  await expect(page).toHaveURL(/\/admin\/conteudos\/[0-9a-f-]{36}\?criado=1/)
  await expect(page.getByText('Conteúdo criado.')).toBeVisible()
  await expect(page.getByLabel('Endereço')).toHaveValue('cafe-da-manha-pratico-3-ideias')

  // Rascunho: 404 para o público, pré-visualização para o coach.
  expect((await request.get('/conteudos/cafe-da-manha-pratico-3-ideias')).status()).toBe(404)
  await page.goto('/conteudos/cafe-da-manha-pratico-3-ideias')
  await expect(page.getByText(/Pré-visualização: este conteúdo é um rascunho/)).toBeVisible()

  await page.goBack()
  await page.getByLabel('Situação').selectOption('publicado')
  await page.getByRole('button', { name: 'Salvar conteúdo' }).click()
  await expect(page.getByText('Conteúdo salvo e publicado.')).toBeVisible()

  await page.context().clearCookies()
  await page.goto('/conteudos')
  await page.getByRole('link', { name: 'Café da manhã prático: 3 ideias' }).click()
  await expect(page).toHaveURL(/\/conteudos\/cafe-da-manha-pratico-3-ideias$/)
  await expect(page).toHaveTitle('Café da manhã prático: 3 ideias · Farion')
  const body = page.locator('.post-body')
  await expect(body.getByRole('heading', { level: 2, name: 'Por que planejar' })).toBeVisible()
  await expect(body.locator('strong')).toHaveText('organizada')
  await expect(body.getByRole('listitem')).toHaveCount(3)
  await expect(body.getByRole('link', { name: 'planos' })).toHaveAttribute('href', '/#planos')
  // HTML digitado aparece como texto, nunca como elemento.
  await expect(body).toContainText('<script>alert(1)</script>')
  expect(await body.locator('script').count()).toBe(0)
  // Convite final para agendar ou contratar.
  const cta = page.getByRole('complementary', { name: 'Quer levar isso para a sua rotina?' })
  await expect(cta.getByRole('link', { name: /Agendar consulta/ })).toBeVisible()
  await expect(cta.getByRole('link', { name: /Contratar um plano/ })).toHaveAttribute('href', '/#planos')
  expect(await page.locator('meta[property="og:type"]').getAttribute('content')).toBe('article')
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!)
  expect(ld).toMatchObject({ '@type': 'BlogPosting', headline: 'Café da manhã prático: 3 ideias', author: { name: 'André Farion', jobTitle: 'Coach' } })

  expect(await (await request.get('/sitemap.xml')).text()).toContain('/conteudos/cafe-da-manha-pratico-3-ideias</loc>')
})

test('"Quero saber mais": formulário curto grava a origem (UTM) e aparece em Interessados', async ({ page }) => {
  await page.goto('/conteudos?utm_source=instagram&utm_medium=bio&utm_campaign=novembro')
  await page.waitForFunction(() => sessionStorage.getItem('farion-origem')?.includes('instagram'))
  // Navega pelo site antes de enviar: a origem da visita continua guardada.
  await page.goto('/')
  const form = page.locator('form#saber-mais')
  await form.getByLabel('Seu nome').fill('Marina Teste')
  await form.getByLabel('WhatsApp com DDD').fill('(11) 98888-7777')
  await form.getByLabel('Objetivo').selectOption('Emagrecimento')
  await form.getByRole('button', { name: /Quero saber mais/ }).click()
  await expect(form.getByText('É preciso concordar com a Política de Privacidade')).toBeVisible()
  await form.getByLabel(/Concordo em ser contatado/).check()
  await form.getByRole('button', { name: /Quero saber mais/ }).click()
  await expect(form.getByText('Obrigado! Recebemos seu contato e vamos chamar você no WhatsApp informado.')).toBeVisible()

  await login(page, 'admin')
  await page.goto('/admin/interessados')
  const row = page.getByRole('table', { name: 'Interessados' }).getByRole('row').filter({ hasText: 'Marina Teste' })
  await expect(row).toContainText('Quero saber mais')
  await expect(row).toContainText('instagram / bio · campanha novembro')
  await expect(row).toContainText('entrou por /conteudos')
  await expect(row).toContainText('Emagrecimento')
})

test('pixels: desligados por padrão; ligados, só carregam com aceite e só nas páginas públicas', async ({ page, request }) => {
  // Nada sai para a internet: os scripts de terceiros são simulados.
  await page.route(/connect\.facebook\.net|googletagmanager\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }))
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: 'Cookies de medição' })).toHaveCount(0)
  expect(await page.locator('script[src*="facebook"], script[src*="googletagmanager"]').count()).toBe(0)

  await login(page, 'admin')
  await page.goto('/admin/configuracoes?secao=captacao')
  await expect(page.getByText('Desligados: nenhum script de terceiros é carregado')).toBeVisible()
  await page.getByLabel('Ligar os pixels (com consentimento de cookies)').check()
  await page.getByLabel('ID do pixel da Meta').fill('abc')
  await page.getByRole('button', { name: 'Salvar pixels' }).click()
  await expect(page.getByText('O ID do pixel da Meta tem só números').first()).toBeVisible()
  await page.getByLabel('ID do pixel da Meta').fill('123456789012345')
  await page.getByLabel('ID da tag do Google').fill('g-test12345')
  await page.getByRole('button', { name: 'Salvar pixels' }).click()
  await expect(page.getByText(/Pixels ligados/)).toBeVisible()

  try {
    // Visitante: aviso de cookies; recusar não carrega nada.
    await page.context().clearCookies()
    await page.goto('/sobre')
    const banner = page.getByRole('dialog', { name: 'Cookies de medição' })
    await expect(banner).toContainText('Meta (Facebook e Instagram) e Google')
    await banner.getByRole('button', { name: 'Recusar' }).click()
    await expect(banner).toHaveCount(0)
    await page.reload()
    await expect(banner).toHaveCount(0)
    expect(await page.locator('script[src*="facebook"], script[src*="googletagmanager"]').count()).toBe(0)
    expect((await page.request.get('/sobre')).headers()['content-security-policy']).not.toContain('facebook')

    // Rever a escolha pelo rodapé e aceitar: carrega os dois, com a CSP liberando só aqui.
    await page.getByRole('button', { name: '/ Preferências de cookies' }).click()
    await banner.getByRole('button', { name: 'Aceitar' }).click()
    await expect(page.locator('script[src*="connect.facebook.net"]')).toHaveCount(1)
    await expect(page.locator('script[src*="googletagmanager.com/gtag/js?id=G-TEST12345"]')).toHaveCount(1)
    expect((await page.request.get('/sobre')).headers()['content-security-policy']).toContain('https://connect.facebook.net')
    expect((await page.request.get('/login')).headers()['content-security-policy']).not.toContain('facebook')
    await page.goto('/privacidade')
    await expect(page.locator('#cookies + p + p')).toContainText('cookies de medição de Meta (Facebook e Instagram) e Google')

    // Indo para o login, a página recarrega inteira: os pixels ficam para trás.
    const nav = page.getByRole('navigation', { name: 'Principal' })
    await nav.locator('summary', { hasText: 'Entrar' }).click()
    await nav.getByRole('link', { name: /Já tenho conta/ }).click()
    await expect(page).toHaveURL(/\/login/)
    expect(await page.evaluate(() => 'fbq' in window || 'gtag' in window)).toBe(false)
  } finally {
    await login(page, 'admin')
    await page.goto('/admin/configuracoes?secao=captacao')
    await page.getByLabel('Ligar os pixels (com consentimento de cookies)').uncheck()
    await page.getByRole('button', { name: 'Salvar pixels' }).click()
    await expect(page.getByText(/Pixels desligados/)).toBeVisible()
  }
  await page.context().clearCookies()
  expect((await request.get('/')).ok()).toBe(true)
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: 'Cookies de medição' })).toHaveCount(0)
})
