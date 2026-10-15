import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll } from './helpers'

test('página inicial apresenta o profissional, serviços e storytelling', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Comer bem não precisa ser')
  await expect(page.getByText('André Farion').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Formas de atendimento' })).toBeVisible()
  await expect(page.getByText('Depoimento sem autorização')).toHaveCount(0) // não autorizado nunca aparece
  await expect(page.getByRole('link', { name: 'Política de Privacidade' }).first()).toBeVisible()
})

test('formulário de interessados exige consentimento e salva o contato', async ({ page }) => {
  await page.goto('/#contato')
  await page.getByLabel('Nome').fill('Teste Automatizado')
  await page.getByLabel('Telefone / WhatsApp').fill('(11) 91234-5678')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText('É preciso concordar com a Política de Privacidade')).toBeVisible()
  await expect(page.getByLabel('Nome')).toHaveValue('Teste Automatizado') // não perde o que foi digitado
  await page.getByLabel(/Concordo com o uso destes dados/).check()
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText('Recebemos seu contato')).toBeVisible()
})

test('agendamento completo e bloqueio de conflito no mesmo horário', async ({ page }) => {
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

test('layout responsivo no celular (site)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  for (const path of ['/', '/agendar', '/login', '/privacidade']) {
    await page.goto(path)
    await expectNoHorizontalScroll(page)
  }
})
