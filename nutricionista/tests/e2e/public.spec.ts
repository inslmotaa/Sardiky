import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, login } from './helpers'
import type { Page } from '@playwright/test'

const WA = 'https://wa.me/5541991551789'

test('página inicial apresenta o profissional, serviços e storytelling', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Comer bem não precisa ser')
  await expect(page.getByText('André Farion').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Formas de atendimento' })).toBeVisible()
  await expect(page.getByText('Depoimento sem autorização')).toHaveCount(0) // não autorizado nunca aparece
  await expect(page.getByRole('link', { name: 'Política de Privacidade' }).first()).toBeVisible()
  // Abertura: "Agendar consulta" é o botão principal, leva ao WhatsApp, e "solitário" não aparece mais.
  await expect(page.locator('.story-open .row a').first()).toHaveText('Agendar consulta')
  await expect(page.locator('.story-open .row a').first()).toHaveAttribute('href', new RegExp(`^${WA}\\?text=`))
  // Valores não aparecem no site.
  await expect(page.locator('main')).not.toContainText('R$')
  await expect(page.locator('#servicos a', { hasText: 'Agendar este serviço' }).first()).toHaveAttribute('href', /^https:\/\/wa\.me\/5541991551789\?text=.*Primeira%20consulta/)
  await expect(page.getByText('solitário')).toHaveCount(0)
  // Anamnese externa e planos de acompanhamento.
  await expect(page.getByRole('link', { name: 'Preencher anamnese' }).first()).toHaveAttribute('href', 'https://forms.gle/8EkK8XcNE35ydHYKA')
  await expect(page.getByRole('heading', { name: 'Acompanhamento contínuo, não uma consulta isolada' })).toBeVisible()
})

test('endereços curtos levam às áreas certas', async ({ page }) => {
  await page.goto('/entrar')
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/painel')
  await expect(page).toHaveURL(/\/login/)
})

test('contato e agenda on-line levam ao WhatsApp, sem guardar dados no site', async ({ page }) => {
  await page.goto('/#contato')
  await page.getByLabel('Seu nome').fill('Teste Automatizado')
  await page.getByLabel('Interesse').selectOption('Retorno')
  await page.getByLabel('Mensagem').fill('Qual o próximo horário?')
  const link = page.getByRole('link', { name: 'Continuar no WhatsApp' })
  await expect(link).toHaveAttribute('href', `${WA}?text=${encodeURIComponent('Olá! Vim pelo site e meu nome é Teste Automatizado. Tenho interesse em: Retorno. Qual o próximo horário?')}`)
  await expect(link).toHaveAttribute('target', '_blank')

  // A agenda on-line fica desligada: o endereço antigo redireciona para a conversa.
  const res = await page.request.get('/agendar', { maxRedirects: 0 })
  expect(res.status()).toBe(307)
  expect(res.headers().location).toMatch(new RegExp(`^${WA}\\?text=`))
})

/** Troca, pelo painel, para onde o "Agendar consulta" leva e se os valores aparecem. */
async function siteSettings(page: Page, booking: 'whatsapp' | 'site', prices: boolean) {
  await login(page, 'admin')
  await page.goto('/admin/configuracoes')
  await page.getByLabel('Botão “Agendar consulta” do site').selectOption(booking)
  await page.getByLabel('Mostrar os valores dos serviços e planos no site').setChecked(prices)
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByText('Perfil e identidade visual atualizados.')).toBeVisible()
  await page.context().clearCookies()
}

test('com a agenda on-line ligada: valores, formulário de interessados e agendamento completo', async ({ page }) => {
  await siteSettings(page, 'site', true)
  try {
    await page.goto('/')
    await expect(page.locator('.story-open .row a').first()).toHaveAttribute('href', '/agendar')
    await expect(page.locator('#servicos')).toContainText('R$')

    await page.goto('/#contato')
    await page.getByLabel('Nome').fill('Teste Automatizado')
    await page.getByLabel('Telefone / WhatsApp').fill('(11) 91234-5678')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText('É preciso concordar com a Política de Privacidade')).toBeVisible()
    await expect(page.getByLabel('Nome')).toHaveValue('Teste Automatizado') // não perde o que foi digitado
    await page.getByLabel(/Concordo com o uso destes dados/).check()
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByText('Recebemos seu contato')).toBeVisible()

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
    await page.setViewportSize({ width: 360, height: 800 })
    await expectNoHorizontalScroll(page)
  } finally {
    await siteSettings(page, 'whatsapp', false)
  }
})

test('layout responsivo no celular (site)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  for (const path of ['/', '/login', '/privacidade', '/criar-conta']) {
    await page.goto(path)
    await expectNoHorizontalScroll(page)
  }
})
