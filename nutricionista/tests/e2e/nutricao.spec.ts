import { expect, test } from '@playwright/test'
import { login, openPatient, payWithCard } from './helpers'

/**
 * Fluxo nutricional de ponta a ponta: o coach define o plano contratado, monta só o café da manhã,
 * ativa no app e a cliente vê o café na tela Hoje, no Plano e no Meu perfil (com o plano contratado).
 */
test('coach envia o café da manhã; cliente vê no Hoje, no Plano e no Meu perfil', async ({ page }) => {
  await login(page, 'admin')
  // Início do coach: quem está com o plano contratado perto de vencer.
  // Fila de trabalho: plano vencendo (Lucas termina em 5 dias), com o botão para renovar.
  const fila = page.locator('section[aria-labelledby="fila-titulo"]')
  await expect(page.getByRole('heading', { name: /^O que precisa de você/ })).toBeVisible()
  const lucas = fila.locator('.queue__item', { hasText: 'Plano vencendo' }).filter({ hasText: 'Lucas Fictício' })
  await expect(lucas).toContainText(/Plano Mensal termina em/)
  await expect(lucas.getByRole('link', { name: 'Renovar' })).toHaveAttribute('href', /aba=financeiro$/)
  // A ordem da fila: "Montar plano" vem antes de "Plano vencendo".
  const kinds = await fila.locator('.queue__kind').allTextContents()
  expect(kinds.indexOf('Montar plano')).toBeLessThan(kinds.indexOf('Plano vencendo'))

  // Plano contratado na ficha: Trimestral a partir de hoje.
  await openPatient(page, 'Helena Teste')
  await page.getByLabel('Plano contratado').selectOption({ label: 'Trimestral · 3 meses' })
  const start = await page.evaluate(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }))
  await page.getByLabel('Início do acompanhamento').fill(start)
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Cadastro atualizado.')).toBeVisible()
  await page.reload()
  // Sem término marcado: o acompanhamento não tem prazo (o coach decide quando encerrar).
  await expect(page.locator('.page-head')).toContainText('Plano Trimestral (sem prazo definido)')

  // Novo plano em branco: continua a numeração e só o café da manhã é preenchido.
  await page.getByRole('link', { name: 'Planos alimentares', exact: true }).last().click()
  await page.getByLabel('Título').fill('Café da manhã reforçado')
  await page.getByRole('button', { name: 'Criar rascunho' }).click()
  await page.waitForURL(/\/admin\/planos\/[0-9a-f-]{36}/)
  await expect(page.locator('.page-head')).toContainText('versão 2')
  const cafe = page.locator('section[aria-label="Refeição Café da manhã"]')
  for (const q of ['pão francês', 'mamão papaia']) {
    await cafe.getByLabel('Adicionar alimento em Café da manhã').fill(q)
    await expect(cafe.locator('[role="option"]:visible').first()).toBeVisible()
    await page.keyboard.press('Enter')
  }
  await expect(cafe.getByText('Pão, trigo, francês')).toBeVisible()
  await expect(cafe.getByText('Mamão, Papaia, cru')).toBeVisible()

  await page.getByLabel('Revisei e aprovo este plano').check()
  let dialog = ''
  page.once('dialog', (d) => {
    dialog = d.message()
    void d.accept()
  })
  await page.getByRole('button', { name: 'Ativar no app do cliente' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Plano ativado no app do cliente' })).toContainText('não foram enviadas: Almoço')
  expect(dialog).toContain('Ainda sem alimentos (não serão enviadas agora): Almoço')
  await expect(page.locator('.page-head .badge').first()).toHaveText('Publicado')

  // Cliente: café no Hoje, no Plano e no Meu perfil, com o plano contratado e a vigência.
  await login(page, 'helena')
  const next = page.locator('.next-meal')
  await expect(next.getByRole('heading', { name: /Café da manhã/ })).toBeVisible()
  await expect(next).toContainText('Pão, trigo, francês')
  await page.goto('/paciente/plano')
  await expect(page.getByRole('heading', { name: 'Café da manhã reforçado' })).toBeVisible()
  await expect(page.locator('main').getByRole('heading', { name: 'Almoço' })).toHaveCount(0)

  await page
    .getByRole('link', { name: /Meu perfil/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/paciente\/meus-dados$/)
  const acomp = page.locator('section[aria-labelledby="meu-acompanhamento"]')
  await expect(acomp).toContainText('Plano Trimestral')
  await expect(acomp).toContainText('Sem prazo definido')
  await expect(acomp).toContainText('André Farion')
  const plano = page.locator('section[aria-labelledby="meu-plano-alimentar"]')
  await expect(plano).toContainText('Café da manhã reforçado')
  await expect(plano.locator('.profile-meals li')).toHaveCount(1)
  await expect(plano.getByRole('link', { name: 'Ver plano completo' })).toHaveAttribute('href', '/paciente/plano')
})

test('login único com "Mostrar senha" leva cada perfil à sua área', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Um só acesso para clientes e para o coach')).toBeVisible()
  const pass = page.getByLabel('Senha', { exact: true })
  await pass.fill('Paciente#Demo2026')
  await expect(pass).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Mostrar' }).click()
  await expect(pass).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('E-mail').fill('paciente@example.com')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/paciente$/)

  await login(page, 'admin')
  await expect(page.locator('.sidebar .brand__title')).toHaveText('Farion')
})

test('coach encerra o plano alimentar quando quiser; cliente vê o histórico', async ({ page }) => {
  await login(page, 'admin')
  const id = await openPatient(page, 'Beatriz Exemplo')
  await page.goto(`/admin/pacientes/${id}?aba=planos`)
  await page.locator('li', { hasText: 'Publicado' }).getByRole('link').first().click()
  await expect(page.locator('.page-head .badge').first()).toHaveText('Publicado')
  await expect(page.locator('.page-head')).not.toContainText('válid')
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Encerrar plano' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Plano encerrado' })).toBeVisible()

  await login(page, 'beatriz')
  await page.goto('/paciente/plano')
  await expect(page.getByText('Nenhum plano ativo no momento')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver' }).first()).toBeVisible()
})

test('cliente envia exame (opcional) e o coach vê na ficha; fotos do corpo podem ser desligadas', async ({ page }) => {
  await login(page, 'lucas')
  await page.goto('/paciente/mais')
  await page.getByRole('link', { name: /Fotos e exames/ }).click()
  await expect(page.getByRole('heading', { name: 'Fotos e exames', level: 1 })).toBeVisible()
  for (const h of ['Foto da refeição', 'Foto do corpo', 'Exames']) await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible()
  await page.getByLabel('Nome do exame').fill('Hemograma completo')
  await page.getByLabel('Arquivo').setInputFiles({
    name: 'hemograma.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
  })
  await page.getByRole('button', { name: 'Enviar exame' }).click()
  await expect(page.getByText('Exame enviado. O coach já pode ver.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Exames enviados' })).toContainText('Hemograma completo')

  await login(page, 'admin')
  const id = await openPatient(page, 'Lucas Fictício')
  await page.goto(`/admin/pacientes/${id}?aba=documentos`)
  await expect(page.getByRole('row', { name: /Hemograma completo/ })).toContainText('Exame enviado pelo cliente')
  // Recurso opcional: o coach desliga as fotos do corpo e elas somem do app.
  await page.goto(`/admin/pacientes/${id}`)
  await page.getByLabel('Envio de fotos do corpo (opcional)').uncheck()
  await page.getByRole('button', { name: 'Salvar recursos' }).click()
  await expect(page.getByText('Recursos do app atualizados.')).toBeVisible()
  await login(page, 'lucas')
  await page.goto('/paciente/enviar')
  await expect(page.getByRole('heading', { name: 'Foto do corpo' })).toHaveCount(0)
  await page.goto('/paciente/evolucao')
  await expect(page.getByRole('heading', { name: /Fotos do corpo/ })).toHaveCount(0)
  await page.goto('/paciente/meu-corpo')
  await expect(page.getByRole('link', { name: 'Enviar fotos do corpo' })).toHaveCount(0)
})

test('depois de fechar o plano, a anamnese pode ser respondida pelo formulário do coach', async ({ page }) => {
  await page.goto('/criar-conta')
  await page.getByLabel('Nome completo').fill('Cliente Formulário')
  await page.getByLabel('E-mail').fill('formulario.teste@example.com')
  await page.getByLabel('WhatsApp').fill('41977776666')
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill('Formulario#2026')
  await page.getByLabel('Confirme a senha').fill('Formulario#2026')
  await page.getByLabel(/Li e aceito a/).check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await payWithCard(page)
  await expect(page).toHaveURL(/\/paciente\/anamnese\?pago=1$/)
  await expect(page.getByRole('heading', { name: 'Como você prefere responder a anamnese?' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Responder no app' })).toBeVisible()
  await page.getByRole('button', { name: 'Já enviei o formulário' }).click()
  await expect(page.getByRole('heading', { name: 'Obrigado! Sua anamnese foi enviada.' })).toBeVisible()
  await expect(page.getByText(/respondeu pelo formulário/)).toBeVisible()
  await page.getByRole('link', { name: 'Ir para minha área' }).click()
  await expect(page).toHaveURL(/\/paciente$/)
  await expect(page.locator('.hub-banner')).toHaveCount(0)
  // Fim da área do cliente: botão para voltar ao site.
  await expect(page.getByRole('link', { name: /Voltar para a página principal/ })).toHaveAttribute('href', '/')

  await login(page, 'admin')
  await expect(page.getByRole('region', { name: 'Avisos' }).getByRole('link', { name: 'Anamnese respondida pelo formulário' }).first()).toBeVisible()
  const id = await openPatient(page, 'Cliente Formulário')
  await page.goto(`/admin/pacientes/${id}?aba=anamnese`)
  await expect(page.getByRole('heading', { name: 'Anamnese respondida pelo formulário' })).toBeVisible()
})
