import { expect, type Page } from '@playwright/test'

export const USERS = {
  admin: { email: 'nutri@example.com', password: 'Nutri#Demo2026' },
  staff: { email: 'recepcao@example.com', password: 'Equipe#Demo2026' },
  beatriz: { email: 'paciente@example.com', password: 'Paciente#Demo2026' },
  lucas: { email: 'lucas@example.com', password: 'Paciente#Demo2026' },
  helena: { email: 'helena@example.com', password: 'Paciente#Demo2026' },
  nutri2: { email: 'nutri2@example.com', password: 'Equipe#Demo2026' },
}

export async function login(page: Page, who: keyof typeof USERS) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(USERS[who].email)
  await page.getByLabel('Senha').fill(USERS[who].password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(who === 'beatriz' || who === 'lucas' || who === 'helena' ? /\/paciente$/ : /\/admin$/)
}

/** Garante que a página não tem rolagem horizontal (layout responsivo). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

/** Abre o prontuário de um paciente pelo nome e devolve o id. */
export async function openPatient(page: Page, name: string) {
  await page.goto('/admin/pacientes')
  await page.getByRole('link', { name }).first().click()
  await page.waitForURL(/\/admin\/pacientes\/[0-9a-f-]{36}/)
  return page.url().match(/pacientes\/([0-9a-f-]{36})/)![1]
}

/** Cadastro pelo site leva ao pagamento: paga com o cartão aprovado do Mercado Pago falso e volta ao site. */
export async function payWithCard(page: Page) {
  await expect(page).toHaveURL(/\/paciente\/pagamento/)
  await page.getByRole('button', { name: 'Pagar com Mercado Pago' }).click()
  await page.getByRole('link', { name: 'Pagar com cartão (aprovado)' }).click()
  await expect(page).toHaveURL(/\/paciente(\/anamnese)?\?pago=1$/)
}
