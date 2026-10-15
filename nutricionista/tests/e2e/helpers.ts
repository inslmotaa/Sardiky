import { expect, type Page } from '@playwright/test'

export const USERS = {
  admin: { email: 'nutri@example.com', password: 'Nutri#Demo2026' },
  staff: { email: 'recepcao@example.com', password: 'Equipe#Demo2026' },
  beatriz: { email: 'paciente@example.com', password: 'Paciente#Demo2026' },
  lucas: { email: 'lucas@example.com', password: 'Paciente#Demo2026' },
}

export async function login(page: Page, who: keyof typeof USERS) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(USERS[who].email)
  await page.getByLabel('Senha').fill(USERS[who].password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(who === 'beatriz' || who === 'lucas' ? /\/paciente$/ : /\/admin$/)
}

/** Garante que a página não tem rolagem horizontal (layout responsivo). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}
