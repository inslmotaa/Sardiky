import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, login } from './helpers'
import type { Page } from '@playwright/test'

const WA = 'https://wa.me/5541991551789'

test('página principal: hero com fundo líquido, storytelling em capítulos, Sobre, Consultoria, Resultados e Contato', async ({ page }) => {
  await page.goto('/')
  // Hero: nome gigante (preenchido + contorno), rótulo "Coach", frase, serviços e "Agendar consulta".
  const hero = page.locator('#inicio')
  await expect(hero.getByRole('heading', { level: 1 })).toHaveAccessibleName('André Farion')
  await expect(hero.locator('.wm__solid')).toHaveText('ANDRÉ')
  await expect(hero.locator('.wm__out')).toHaveText('FARION')
  await expect(hero.locator('.hero__label')).toHaveText('COACH')
  // Toques de nutrição: faixa de temas, cartão do prato equilibrado e ilustrações em linha.
  await expect(hero.locator('.ticker')).toContainText('HIDRATAÇÃO')
  await expect(hero.getByRole('complementary', { name: 'Exemplo de prato equilibrado' })).toContainText('Vegetais')
  await expect(hero.locator('.botan svg')).toHaveCount(3)
  await expect(hero).toContainText('Nutrição baseada em evidência, pensada para a sua rotina.')
  await expect(hero.getByRole('list', { name: 'Serviços' }).getByRole('listitem')).toHaveText(['Emagrecimento', 'Performance esportiva', 'Reeducação alimentar'])
  await expect(hero.getByRole('link', { name: 'Agendar consulta' })).toHaveAttribute('href', '/criar-conta?next=/agendar')
  // O fundo líquido (WebGL) fica ligado, e o nome ocupa a largura disponível.
  await expect(hero).toHaveClass(/liquid--(on|fallback)/)
  const [wmWidth, boxWidth] = await hero.locator('.wm').evaluate((el) => [el.querySelector('.wm__inner')!.getBoundingClientRect().width, el.clientWidth])
  expect(Math.abs(boxWidth - wmWidth)).toBeLessThan(boxWidth * 0.03)
  // Sem "Nutricionista", CRN, monograma nem frutas.
  await expect(page.locator('body')).not.toContainText(/nutricionista|CRN/i)
  await expect(page.locator('.monogram, .fruit-float, .floaty')).toHaveCount(0)
  // Storytelling: abertura, quatro capítulos com ilustração e o fecho.
  const story = page.locator('#historia')
  await expect(story.getByRole('heading', { level: 2 }).first()).toContainText('Comer bem não precisa ser')
  await expect(story.locator('.chap')).toHaveCount(4)
  await expect(story.locator('.chap svg.art')).toHaveCount(4)
  await expect(story.getByRole('heading', { name: 'Segunda-feira, 7h. O dia já começou correndo.' })).toBeAttached()
  await expect(story.locator('.chap .mono-label')).toHaveText(['A ROTINA', 'AS TENTATIVAS', 'A VIRADA', 'O CAMINHO'])
  // Sem numeração (01, 02…) nos capítulos, seções, passos e planos.
  await expect(page.locator('.chap__num, .step__n, .tl-plan__n')).toHaveCount(0)
  await expect(story.getByRole('link', { name: 'Escrever o próximo capítulo' })).toHaveAttribute('href', '/criar-conta?next=/agendar')
  await expect(story.getByRole('link', { name: 'Conhecer o André' })).toHaveAttribute('href', '#sobre')
  // Seções numeradas.
  for (const [id, label] of [['#sobre', '/ SOBRE'], ['#consultoria', '/ CONSULTORIA'], ['#resultados', '/ RESULTADOS'], ['#contato', '/ CONTATO']])
    await expect(page.locator(`${id} .sec-label`)).toHaveText(label)
  await expect(page.locator('#consultoria .step')).toHaveCount(4)
  await expect(page.locator('#consultoria .tl-plan__name')).toHaveText(['Mensal', 'Trimestral', 'Semestral', 'Anual'])
  await expect(page.locator('#resultados .numbers__item').first()).toBeAttached()
  await expect(page.locator('#resultados')).toContainText('Resultados variam de pessoa para pessoa.')
  await expect(page.locator('#contato').getByRole('link', { name: '(41) 99155-1789' })).toHaveAttribute('href', new RegExp(`^${WA}`))
  await expect(page.locator('a[href*="forms.gle"]')).toHaveCount(0)
  // Rodapé: nome de novo, páginas, área do cliente, privacidade e o crédito da TIMELESS por último.
  const footer = page.locator('.tl-footer')
  await expect(footer.getByRole('link', { name: '/ Política de privacidade' })).toHaveAttribute('href', '/privacidade')
  await expect(footer.getByRole('link', { name: '/ Planos' })).toHaveAttribute('href', '/planos')
  await expect(footer.getByRole('link', { name: '/ Entrar' })).toHaveAttribute('href', '/entrar')
  await expect(footer.getByRole('link', { name: /^WhatsApp \(/ })).toHaveAttribute('href', new RegExp(`^${WA}`))
  await expect(footer).toContainText('André Farion · Coach')
  await expect(footer.locator('p').last()).toHaveText(/Site por\s*TIMELESS/i)
  // Menu do cabeçalho: seções da página e "Entrar".
  const nav = page.locator('.tl-nav')
  for (const [name, href] of [['Sobre', '/#sobre'], ['Consultoria', '/#consultoria'], ['Resultados', '/#resultados'], ['Contato', '/#contato'], ['Entrar', '/entrar']])
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href)
})

test('páginas Sobre, Como funciona e Dúvidas', async ({ page }) => {
  await page.goto('/sobre')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('André Farion')
  await expect(page.getByRole('heading', { name: 'Mais que dieta, um estilo de vida.' })).toBeVisible()
  await page.goto('/como-funciona')
  await expect(page.locator('.timeline-tl').first().locator('li')).toHaveCount(6)
  await expect(page.getByText('Dieta personalizada')).toBeVisible()
  await page.goto('/duvidas')
  await expect(page.locator('.faq__item').first()).toBeVisible()
  await page.locator('.faq__item summary').first().click()
  await expect(page.locator('.faq__item').first().locator('p')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tirar dúvida pelo WhatsApp' })).toHaveAttribute('href', new RegExp(`^${WA}`))
})

test('menu do celular abre com as seções e fecha ao navegar', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 })
  await page.goto('/planos')
  await expect(page.locator('.tl-nav')).toBeHidden()
  await page.getByText('Menu', { exact: true }).click()
  const panel = page.locator('.site-menu__panel')
  await expect(panel.getByRole('link', { name: 'Entrar na área do cliente' })).toHaveAttribute('href', '/entrar')
  await panel.getByRole('link', { name: 'Consultoria', exact: true }).click()
  await expect(page).toHaveURL(/\/#consultoria$/)
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
  await expect(page.locator('.tl-plan__name')).toHaveText(['Mensal', 'Trimestral', 'Semestral', 'Anual'])
  const tri = page.locator('.tl-plan', { hasText: 'Trimestral' })
  await expect(tri.locator('.tl-plan__price')).toHaveText(/^R\$\s637,50$/)
  await expect(tri).toContainText(/R\$\s212,50\/mês/)
  const anual = page.locator('.tl-plan', { hasText: 'Anual' })
  await expect(anual.locator('.tl-plan__badge')).toHaveText('MAIS ESCOLHIDO')
  await expect(page.locator('.tl-plan__badge')).toHaveCount(1)
  await expect(anual.locator('.tl-plan__price')).toHaveText(/^R\$\s2\.250,00$/)
  await expect(anual).toContainText(/R\$\s187,50\/mês/)
  await expect(page.locator('.tl-plan', { hasText: 'Semestral' }).locator('.tl-plan__price')).toHaveText(/^R\$\s1\.200,00$/)
  await expect(page.locator('.tl-plan', { hasText: 'Mensal' }).locator('.tl-plan__price')).toHaveText(/^R\$\s250,00$/)
  await expect(anual.getByRole('link', { name: 'Escolher plano' })).toHaveAttribute('href', /^\/criar-conta\?plano=[0-9a-f-]{36}$/)
  // Bônus só no Semestral e no Anual.
  await expect(page.locator('.tl-plan', { hasText: 'Semestral' })).toContainText('Vale avaliação física')
  await expect(tri).not.toContainText('Vale avaliação física')
  // Comparação: itens comuns com check em todos; benefícios exclusivos só no Semestral e no Anual.
  const table = page.locator('.compare-tl')
  await expect(table.locator('tr', { hasText: 'Dieta personalizada' }).getByRole('img', { name: 'Incluso' })).toHaveCount(4)
  await expect(table.locator('tr', { hasText: 'Vale avaliação física' }).getByRole('img', { name: 'Incluso', exact: true })).toHaveCount(2)
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
    await expect(page.locator('#inicio').getByRole('link', { name: 'Agendar consulta' })).toHaveAttribute('href', new RegExp(`^${WA}\\?text=`))
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
