import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, login } from './helpers'

test('nutricionista revisa e publica plano; paciente passa a vê-lo', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/planos')
  await page.getByRole('link', { name: /Lucas Fictício/ }).first().click()
  await expect(page.getByText('Rascunho — o paciente não vê esta versão')).toBeVisible()

  // Paciente ainda não vê o rascunho.
  // Publicar sem confirmar a revisão é bloqueado.
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Ativar no app do paciente' }).click()
  await expect(page.getByText('Confirme que revisou o plano antes de publicar.')).toBeVisible()

  await page.getByLabel('Revisei e aprovo este plano').check()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Ativar no app do paciente' }).click()
  // Após publicar, a página passa a exibir a versão publicada (somente leitura).
  await expect(page.getByRole('button', { name: 'Criar nova versão' })).toBeVisible()
  await expect(page.locator('.page-head .badge').first()).toHaveText('Publicado')

  await login(page, 'lucas')
  await page.goto('/paciente/plano')
  await expect(page.getByRole('heading', { name: 'Plano para treinos de corrida' })).toBeVisible()
  // Plano com dias diferentes (treino × descanso) e botão “Trocar” com as substituições.
  await expect(page.getByRole('tab', { name: 'Dia de descanso' })).toBeVisible()
  await page.getByRole('button', { name: /^Trocar/ }).first().click()
  await expect(page.getByText('Substituições autorizadas').first()).toBeVisible()
})

test('nutricionista confirma pedido pendente do site', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/agenda?status=pendente')
  await page.getByRole('link', { name: 'Abrir' }).first().click()
  await page.getByRole('button', { name: 'Confirmar consulta' }).click()
  await expect(page.locator('.page-head .badge')).toHaveText('Confirmada')
})

test('nutricionista cadastra paciente e libera acesso por link', async ({ page, browser }) => {
  await login(page, 'admin')
  await page.goto('/admin/pacientes/novo')
  await page.getByLabel('Nome completo').fill('Nova Paciente Teste')
  await page.getByLabel('E-mail').fill('nova.teste@example.com')
  await page.getByRole('button', { name: 'Cadastrar paciente' }).click()
  await expect(page.getByRole('heading', { name: 'Nova Paciente Teste' })).toBeVisible()
  await page.getByRole('button', { name: 'Liberar acesso' }).click()
  const msg = await page.getByText(/Link de primeiro acesso/).textContent()
  const link = msg!.match(/https?:\/\/\S+/)![0]

  const ctx = await browser.newContext()
  const p2 = await ctx.newPage()
  await p2.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await p2.getByLabel('Nova senha').fill('MinhaSenha2026')
  await p2.getByLabel('Repita a senha').fill('MinhaSenha2026')
  await p2.getByRole('button', { name: 'Criar senha e continuar' }).click()
  await expect(p2).toHaveURL(/\/login\?senha=1/)
  await p2.getByLabel('E-mail').fill('nova.teste@example.com')
  await p2.getByLabel('Senha').fill('MinhaSenha2026')
  await p2.getByRole('button', { name: 'Entrar' }).click()
  // Sem anamnese ainda: o primeiro acesso começa por ela.
  await expect(p2).toHaveURL(/\/paciente\/anamnese$/)
  // Link é de uso único.
  await p2.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await expect(p2.getByText('Link inválido ou expirado')).toBeVisible()
  await ctx.close()
})

test('paciente registra medida, envia mensagem e responde formulário', async ({ page }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/evolucao')
  await page.getByLabel('Peso (kg)').fill('74,2')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByText('Medida registrada como “informada por você”.')).toBeVisible()
  await expect(page.getByRole('cell', { name: '74,2' }).first()).toBeVisible()

  await page.goto('/paciente/mensagens')
  await page.getByLabel('Mensagem', { exact: true }).fill('Mensagem automática de teste')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.locator('.bubble', { hasText: 'Mensagem automática de teste' })).toBeVisible()

  await page.goto('/paciente/formularios')
  await page.getByRole('link', { name: 'Preencher' }).first().click()
  await page.getByRole('button', { name: 'Enviar respostas' }).click()
  await expect(page.getByText('Revise as respostas destacadas.')).toBeVisible()
  await page.getByLabel('Segui em parte').check()
  await page.getByLabel('Disposição no dia a dia (1 a 5)').selectOption('4')
  await page.getByRole('button', { name: 'Enviar respostas' }).click()
  await expect(page.getByText('Respostas enviadas.', { exact: true })).toBeVisible()
  await expect(page.getByText('Segui em parte')).toBeVisible()
})

test('paciente baixa os próprios dados (portabilidade)', async ({ page }) => {
  await login(page, 'beatriz')
  const res = await page.request.get('/paciente/meus-dados/exportar')
  expect(res.status()).toBe(200)
  const data = await res.json()
  expect(data.cadastro.fullName).toBe('Beatriz Exemplo')
  expect(JSON.stringify(data)).not.toContain('Boa adesão nos dias úteis') // notas clínicas internas não vão no arquivo
})

test('área do paciente e painel sem rolagem horizontal no celular', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await login(page, 'beatriz')
  for (const path of ['/paciente', '/paciente/plano', '/paciente/diario', '/paciente/evolucao', '/paciente/mensagens', '/paciente/mais', '/paciente/calculadoras', '/paciente/notificacoes']) {
    await page.goto(path)
    await expectNoHorizontalScroll(page)
  }
  await login(page, 'admin')
  for (const path of ['/admin', '/admin/agenda', '/admin/pacientes', '/admin/relatorios', '/admin/calculadoras', '/admin/acompanhamento', '/admin/mensagens']) {
    await page.goto(path)
    await expectNoHorizontalScroll(page)
  }
})
