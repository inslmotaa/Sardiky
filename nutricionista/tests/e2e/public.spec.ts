import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, login } from './helpers'
import type { Page } from '@playwright/test'

const WA = 'https://wa.me/5541991551789'

test('página principal: hero com a plataforma, storytelling em capítulos, Sobre, Consultoria, Resultados e Contato', async ({ page }) => {
  await page.goto('/')
  // Hero: título profissional (sem o nome gigante), rótulo "Coach", texto, botões, destaques e serviços.
  const hero = page.locator('#inicio')
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Nutrição estratégica, acompanhada de perto.')
  await expect(hero).not.toContainText('ANDRÉ FARION')
  await expect(hero.locator('.hero__label')).toHaveText('COACH · ALIMENTAÇÃO, ROTINA E BEM-ESTAR')
  await expect(hero).toContainText('Avaliação completa, plano individual e ajustes a cada 15 dias')
  await expect(hero.getByRole('link', { name: 'Agendar consulta' })).toHaveAttribute('href', '/criar-conta?next=/agendar')
  await expect(hero.getByRole('link', { name: 'Conhecer a plataforma' })).toHaveAttribute('href', '/como-funciona')
  await expect(hero.getByRole('list', { name: 'Destaques' }).getByRole('listitem')).toHaveText(['Anamnese on-line', 'Plano no app', 'Ajustes a cada 15 dias', 'Dados protegidos (LGPD)'])
  await expect(hero.getByRole('list', { name: 'Serviços' }).getByRole('listitem')).toHaveText(['Emagrecimento', 'Performance esportiva', 'Reeducação alimentar'])
  // Vitrine da plataforma (painel do coach e app do cliente) sobre o fundo de natureza e alimentos.
  await expect(hero.getByRole('img', { name: /Prévia da plataforma/ })).toBeVisible()
  await expect(hero.locator('.mock-win')).toContainText('Acompanhamento')
  await expect(hero.locator('.mock-phone')).toContainText('Marcar como feita')
  await expect(hero.locator('.ticker')).toContainText('HIDRATAÇÃO')
  await expect(hero).toHaveClass(/nature--on/)
  await expect(hero.locator('.plate-card, .wm, [data-action]')).toHaveCount(0)
  // Sem "Nutricionista", CRN, monograma nem frutas.
  await expect(page.locator('body')).not.toContainText(/nutricionista|CRN/i)
  // Atendimento 100% on-line: sem endereço, horário de atendimento ou presencial.
  await expect(page.locator('body')).not.toContainText(/presencial|consultório|segunda a sexta|endereço/i)
  await expect(page.locator('#contato')).toContainText('On-line, por videochamada e pelo app')
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
  // Os números já vêm com o valor final no HTML (sem "0 dias" quando a animação não roda).
  const raw = await (await page.request.get('/')).text()
  expect(raw).toMatch(/data-count="15">15</)
  expect(raw).not.toMatch(/data-count="\d+">0</)
  await expect(page.locator('#resultados')).toContainText('Resultados variam de pessoa para pessoa.')
  await expect(page.locator('#contato').getByRole('link', { name: '(41) 99155-1789' })).toHaveAttribute('href', new RegExp(`^${WA}`))
  await expect(page.locator('a[href*="forms.gle"]')).toHaveCount(0)
  // Rodapé: nome de novo, páginas, área do cliente, privacidade e o crédito da TIMELESS por último.
  const footer = page.locator('.tl-footer')
  await expect(footer.getByRole('link', { name: '/ Política de privacidade' })).toHaveAttribute('href', '/privacidade')
  await expect(footer.getByRole('link', { name: '/ Planos' })).toHaveAttribute('href', '/#planos')
  await expect(footer.getByRole('link', { name: '/ Entrar' })).toHaveAttribute('href', '/entrar')
  await expect(footer.getByRole('link', { name: /^WhatsApp \(/ })).toHaveAttribute('href', new RegExp(`^${WA}`))
  await expect(footer).toContainText('André Farion · Coach')
  await expect(footer.locator('p').last()).toHaveText(/Site por\s*TIMELESS/i)
  await expect(footer.locator('.wm')).toHaveCount(0)
  // Instagram vazio na demonstração: nenhum ícone nem link para instagram.com.
  await expect(page.locator('a[href*="instagram.com"]')).toHaveCount(0)
  // Nome do site no cabeçalho: "Farion" (o conteúdo continua sendo do André).
  await expect(page.locator('.tl-header .tl-brand')).toHaveText('Farion')
  await expect(page).toHaveTitle(/^Farion · André Farion/)
  // Menu do cabeçalho: seções da página e o botão verde "Entrar", que abre entrar ou criar conta.
  const nav = page.locator('.tl-nav')
  for (const [name, href] of [['Sobre', '/#sobre'], ['Consultoria', '/#consultoria'], ['Planos', '/#planos'], ['Resultados', '/#resultados'], ['Contato', '/#contato']])
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href)
  const entrar = nav.locator('.login-menu')
  await expect(entrar.locator('summary')).toHaveText('Entrar')
  expect(await entrar.locator('summary').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(31, 94, 59)')
  await entrar.locator('summary').click()
  await expect(entrar.getByRole('link', { name: /^Entrar/ })).toHaveAttribute('href', '/entrar')
  await entrar.getByRole('link', { name: /^Criar conta/ }).click()
  await expect(page).toHaveURL(/\/criar-conta$/)
  // Tela de acesso de verdade: painel verde e abas Entrar | Criar conta.
  await expect(page.locator('.tl-auth__aside')).toContainText('Seu acompanhamento, em um só lugar.')
  const tabs = page.getByRole('navigation', { name: 'Acesso' })
  await expect(tabs.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('aria-current', 'page')
  await tabs.getByRole('link', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible()
  await expect(tabs.getByRole('link', { name: 'Entrar' })).toHaveAttribute('aria-current', 'page')
  // Fim da tela de acesso: botão para voltar à página principal.
  await page.getByRole('link', { name: /Voltar para a página principal/ }).click()
  await expect(page).toHaveURL(/\/$/)
  // Voltar ao topo: aparece depois de rolar e sobe a página.
  const toTop = page.getByRole('button', { name: 'Voltar ao topo' })
  await expect(toTop).toBeHidden()
  // Descendo, fica escondido (não cobre o texto); subindo, depois de 1,5 tela, aparece.
  await page.evaluate(() => window.scrollTo({ top: 3000, behavior: 'instant' }))
  await page.waitForTimeout(150)
  await expect(toTop).toBeHidden()
  await page.evaluate(() => window.scrollTo({ top: 2600, behavior: 'instant' }))
  await expect(toTop).toBeVisible()
  await toTop.click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5)
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
  await page.goto('/sobre')
  await expect(page.locator('.tl-nav')).toBeHidden()
  await page.getByText('Menu', { exact: true }).click()
  const panel = page.locator('.site-menu__panel')
  await expect(panel.getByRole('link', { name: 'Entrar', exact: true })).toHaveAttribute('href', '/entrar')
  await expect(panel.getByRole('link', { name: 'Criar conta', exact: true })).toHaveAttribute('href', '/criar-conta')
  await panel.getByRole('link', { name: 'Consultoria', exact: true }).click()
  await expect(page).toHaveURL(/\/#consultoria$/)
  await expect(page.locator('.site-menu')).not.toHaveAttribute('open', '')
})

test('logo e nome levam à página principal em todas as áreas', async ({ page }) => {
  const logo = page.getByRole('link', { name: 'Ir para a página inicial' }).first()
  for (const path of ['/sobre', '/como-funciona', '/duvidas', '/privacidade', '/login', '/criar-conta']) {
    await page.goto(path)
    await expect(logo).toHaveAttribute('href', '/')
  }
  await page.goto('/sobre')
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

test('seção #planos: cards com valores, selo "Mais escolhido", sem desconto, comparação e botão Contratar', async ({ page }) => {
  await page.goto('/#planos')
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
  await expect(anual.getByRole('link', { name: /Contratar/ })).toHaveAttribute('href', /^\/criar-conta\?plano=[0-9a-f-]{36}$/)
  // Sem desconto, preço riscado nem "de R$ …": só o preço e o valor por mês.
  await expect(page.locator('#planos .tl-plans')).not.toContainText(/desconto|de R\$/i)
  await expect(page.locator('#planos s, #planos del')).toHaveCount(0)
  // Formas de pagamento e o que acontece depois.
  await expect(page.getByText(/Pix, cartão em até 12x ou boleto · pagamento seguro pelo Mercado Pago/)).toBeVisible()
  await expect(page.getByText(/Depois do pagamento você responde a anamnese/)).toBeVisible()
  // Botões alinhados na base: todos os cartões com a mesma altura.
  const heights = await page.locator('.tl-plan').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  expect(new Set(heights).size).toBe(1)
  // Bônus só no Semestral e no Anual; sem desconto de parceiro.
  await expect(page.locator('.tl-plan', { hasText: 'Semestral' })).toContainText('Vale avaliação física')
  await expect(tri).not.toContainText('Vale avaliação física')
  await expect(page.locator('main')).not.toContainText('Desconto em produtos')
  // Comparação: itens comuns com check em todos; benefícios exclusivos só no Semestral e no Anual.
  // Comparação recolhida por padrão no botão "Comparar os planos".
  const table = page.locator('.compare-tl')
  await expect(table).toBeHidden()
  await page.getByText('Comparar os planos', { exact: true }).click()
  await expect(table).toBeVisible()
  await expect(table.locator('tr', { hasText: 'Dieta personalizada' }).getByRole('img', { name: 'Incluso' })).toHaveCount(4)
  await expect(table.locator('tr', { hasText: 'Vale avaliação física' }).getByRole('img', { name: 'Incluso', exact: true })).toHaveCount(2)
})

test('agendamento pelo site e bloqueio de conflito no mesmo horário', async ({ page }) => {
  await page.goto('/agendar')
  await page.getByRole('link', { name: /Retorno/ }).click()
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
  for (const path of ['/', '/sobre', '/como-funciona', '/duvidas', '/login', '/privacidade', '/criar-conta']) {
    await page.goto(path)
    await expectNoHorizontalScroll(page)
  }
  // Botões flutuantes: numa coluna no canto inferior direito, sem um cobrir o outro.
  await page.goto('/')
  await page.evaluate(() => window.scrollTo({ top: 4000, behavior: 'instant' }))
  await page.waitForTimeout(150)
  await page.evaluate(() => window.scrollTo({ top: 3600, behavior: 'instant' }))
  const top = page.getByRole('button', { name: 'Voltar ao topo' })
  await expect(top).toBeVisible()
  const a = (await top.boundingBox())!
  const b = (await page.locator('.whatsapp-float').boundingBox())!
  expect(a.y + a.height).toBeLessThanOrEqual(b.y)
  expect(Math.abs(a.x + a.width - (b.x + b.width))).toBeLessThan(2)
  // O fim da página fica acima dos botões.
  const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main#conteudo')!).paddingBottom))
  expect(pad).toBeGreaterThanOrEqual(80)
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

test('números de Resultados: valor final sem animação (movimento reduzido, impressão e leitor de tela)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const item = page.locator('#resultados .numbers__item', { hasText: 'entre cada revisão' })
  await expect(item.locator('[data-count]')).toHaveText('15')
  await expect(item.locator('.sr-only')).toHaveText('15 dias')
  // Com animação, mas sem rolar até a seção (como numa impressão ou captura): nada fica em 0.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  for (const t of await page.locator('#resultados [data-count]').allTextContents()) expect(t).not.toBe('0')
  await expect(item.locator('[data-count]')).toHaveText('15')
})
