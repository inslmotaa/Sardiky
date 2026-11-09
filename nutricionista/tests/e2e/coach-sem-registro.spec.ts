import { expect, test } from '@playwright/test'
import { login, openPatient, pdfText } from './helpers'

/**
 * O André é coach: nenhuma tela, configuração ou PDF mostra "nutricionista", CRN ou registro profissional.
 * (O site público é conferido em public.spec.ts.)
 */
const PROIBIDO = /nutricionista|\bCRN\b|registro profissional/i

test('área do cliente e painel não mostram "nutricionista", CRN nem registro profissional', async ({ page }) => {
  await login(page, 'beatriz')
  for (const path of ['/paciente', '/paciente/meus-dados', '/paciente/plano']) {
    await page.goto(path)
    await expect(page.locator('body')).not.toContainText(PROIBIDO)
  }
  // Meu perfil: o coach aparece só com o título.
  await page.goto('/paciente/meus-dados')
  await expect(page.locator('section[aria-labelledby="meu-acompanhamento"]')).toContainText(/André Farion\s*Coach/)

  await login(page, 'admin')
  for (const secao of ['perfil', 'planos', 'equipe', 'integracoes']) {
    await page.goto(`/admin/configuracoes?secao=${secao}`)
    await expect(page.locator('body')).not.toContainText(PROIBIDO)
  }
  await page.goto('/admin/configuracoes?secao=perfil')
  await expect(page.getByLabel(/Registro/)).toHaveCount(0)
  await expect(page.locator('input[name="registry"]')).toHaveCount(0)
})

test('PDFs do plano e da anamnese sem "nutricionista", CRN nem registro profissional', async ({ page }) => {
  await login(page, 'beatriz')
  const plan = await page.request.get('/paciente/plano/pdf')
  expect(plan.status()).toBe(200)
  const planText = pdfText(await plan.body())
  expect(planText).toContain('André Farion')
  expect(planText).toContain('Coach')
  expect(planText).not.toMatch(PROIBIDO)

  await login(page, 'admin')
  const id = await openPatient(page, 'Beatriz Exemplo')
  const anam = await page.request.get(`/admin/pacientes/${id}/anamnese/pdf?versao=1`)
  expect(anam.status()).toBe(200)
  const anamText = pdfText(await anam.body())
  expect(anamText).toContain('André Farion')
  expect(anamText).toContain('Anamnese')
  expect(anamText).not.toMatch(PROIBIDO)

  // PDF do plano gerado pelo painel (versão do coach).
  await page.goto(`/admin/pacientes/${id}?aba=planos`)
  const href = await page.locator('li', { hasText: 'Publicado' }).getByRole('link').first().getAttribute('href')
  const adminPdf = await page.request.get(`${href}/pdf`)
  expect(adminPdf.status()).toBe(200)
  expect(pdfText(await adminPdf.body())).not.toMatch(PROIBIDO)
})
