import { expect, test, type Page } from '@playwright/test'
import { login, openPatient } from './helpers'

/** Fase 4: cadastro do cliente, anamnese no site, hub do cliente, permissões e LGPD. */

const EMAIL = 'cliente.novo@example.com'
const PASS = 'Cliente2026'

async function fillAnamnesisUntilReview(page: Page) {
  const next = () => page.getByRole('button', { name: 'Salvar e continuar' }).click()
  // 1. Dados pessoais (com validação).
  await next()
  await expect(page.getByText('Confira os campos destacados.')).toBeVisible()
  await page.getByLabel('Data de nascimento').fill('1990-05-20')
  await page.getByLabel('Sexo').selectOption('Feminino')
  await page.getByLabel('Profissão').fill('Professora')
  await page.getByLabel('Cidade').fill('Curitiba/PR')
  await next()
  // 2. Objetivo.
  await expect(page.getByText('Etapa 2 de 7')).toBeVisible()
  await page.getByLabel('Objetivo principal').selectOption('Emagrecimento')
  await page.getByLabel('Em quanto tempo você gostaria de chegar lá?').selectOption('3 a 6 meses')
  await next()
  // 3. Saúde (anexo de exame em PDF).
  await expect(page.getByText('Etapa 3 de 7')).toBeVisible()
  await page.getByLabel('Alergias e intolerâncias alimentares').fill('Intolerância à lactose')
  await page.getByLabel('Anexar exames (PDF ou foto)').setInputFiles({ name: 'hemograma.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF') })
  await expect(page.getByRole('link', { name: 'hemograma.pdf' })).toBeVisible()
  await next()
  // Sai no meio e continua depois de onde parou.
  await expect(page.getByText('Etapa 4 de 7')).toBeVisible()
  await page.getByLabel('Peso (kg)').fill('68,4')
  await page.getByLabel('Altura (cm)').fill('163')
  await page.getByRole('button', { name: 'Salvar e sair' }).click()
  await expect(page).toHaveURL(/\/paciente\?anamnese=salva/)
  await expect(page.locator('.hub-banner')).toContainText('Falta só sua anamnese para começarmos')
  await page.locator('.hub-banner').getByRole('link', { name: 'Continuar anamnese' }).click()
  await expect(page.getByText('Etapa 5 de 7')).toBeVisible()
  // 5. Rotina.
  await page.getByLabel('Horário em que acorda').fill('06:30')
  await page.getByLabel('Horário em que dorme').fill('23:00')
  await page.getByLabel('Nível de atividade física').selectOption('Moderadamente ativo')
  await page.getByLabel('Treinos por semana').fill('3')
  await next()
  // 6. Alimentação.
  await page.getByLabel('Refeições por dia').fill('4')
  await page.getByLabel('O que você costuma comer em um dia normal?').fill('Café com pão, almoço caseiro, lanche e jantar leve.')
  await page.getByLabel('Consumo de água por dia').selectOption('1 a 2 L')
  await next()
  await expect(page.getByText('Etapa 7 de 7')).toBeVisible()
}

test('cliente: plano → cadastro → anamnese em etapas → hub; André recebe, vê, exporta e pede reavaliação', async ({ page }) => {
  // Escolhe o plano e cria a conta.
  await page.goto('/planos')
  await page.locator('.tl-plan', { hasText: 'Trimestral' }).getByRole('link', { name: 'Escolher plano' }).click()
  await expect(page).toHaveURL(/\/criar-conta\?plano=/)
  await expect(page.getByText('Plano escolhido:')).toContainText('Trimestral')
  await page.getByLabel('Nome completo').fill('Cliente Novo Teste')
  await page.getByLabel('E-mail').fill(EMAIL)
  await page.getByLabel('WhatsApp').fill('41999998888')
  await expect(page.getByLabel('WhatsApp')).toHaveValue('(41) 99999-8888')
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(PASS)
  await page.getByLabel('Confirme a senha').fill('Outra2026x')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByText('As senhas não conferem')).toBeVisible()
  await expect(page.getByText('É preciso aceitar a Política de privacidade')).toBeVisible()
  await page.getByLabel('Confirme a senha').fill(PASS)
  await page.getByLabel(/Li e aceito a/).check()
  await page.getByRole('button', { name: 'Criar conta' }).click()

  // Primeiro acesso: começa pela anamnese.
  await expect(page).toHaveURL(/\/paciente\/anamnese$/)
  await fillAnamnesisUntilReview(page)
  await expect(page.locator('.anam__review', { hasText: 'Dados pessoais' })).toContainText('20/05/1990')
  await page.getByRole('button', { name: 'Enviar anamnese' }).click()
  await expect(page.getByRole('heading', { name: 'Obrigado! Sua anamnese foi enviada.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Agendar consulta' })).toHaveAttribute('href', '/agendar')
  await page.getByRole('link', { name: 'Ir para minha área' }).click()

  // Hub: sem banner, plano escolhido e etapa atual "Consulta".
  await expect(page.getByRole('heading', { name: 'Olá, Cliente!' })).toBeVisible()
  await expect(page.locator('.hub-banner')).toHaveCount(0)
  await expect(page.locator('.hub-status')).toContainText('Plano Trimestral')
  await expect(page.locator('.hub-steps li[aria-current="step"]')).toContainText('Consulta')
  await expect(page.getByText('Seu plano está sendo preparado pelo André')).toBeVisible()
  await expect(page.getByText('Você ainda não tem consulta marcada.')).toBeVisible()
  for (const sc of ['Anamnese', 'Meu plano', 'Progresso', 'Materiais']) await expect(page.locator('.hub-shortcuts').getByRole('link', { name: sc })).toBeVisible()

  // André: aviso, aba Anamnese, PDF e reavaliação.
  await login(page, 'admin')
  const avisos = page.getByRole('region', { name: 'Avisos' })
  await expect(avisos.getByRole('link', { name: 'Nova anamnese recebida' }).first()).toBeVisible()
  await expect(avisos.getByRole('link', { name: 'Novo cadastro pelo site' }).first()).toBeVisible()
  const id = await openPatient(page, 'Cliente Novo Teste')
  await page.goto(`/admin/pacientes/${id}?aba=anamnese`)
  await expect(page.getByRole('heading', { name: /Anamnese · versão 1/ })).toBeVisible()
  await expect(page.locator('.anam__review', { hasText: 'Saúde' })).toContainText('Intolerância à lactose')
  await expect(page.getByRole('link', { name: 'hemograma.pdf' })).toBeVisible()
  const pdf = await page.request.get(`/admin/pacientes/${id}/anamnese/pdf?versao=1`)
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toContain('application/pdf')
  await page.getByRole('button', { name: 'Pedir reavaliação' }).click()
  await expect(page.getByText('Reavaliação pedida: a versão 2 está com o paciente')).toBeVisible()
  await expect(page.getByRole('link', { name: /^v2 · rascunho/ })).toBeVisible()

  // Cliente vê o pedido de reavaliação, com as respostas anteriores já preenchidas.
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(EMAIL)
  await page.getByLabel('Senha').fill(PASS)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/paciente$/)
  await expect(page.locator('.hub-banner')).toContainText('reavaliação')
  await page.goto('/paciente/anamnese')
  await expect(page.getByRole('heading', { name: 'Reavaliação: atualize sua anamnese' })).toBeVisible()
  await expect(page.getByLabel('Cidade')).toHaveValue('Curitiba/PR')
})

test('permissões: paciente sem acesso ao painel e equipe fora da área do cliente', async ({ page }) => {
  await login(page, 'beatriz')
  await page.goto('/painel')
  await expect(page).toHaveURL(/\/login\?sem-acesso=painel/)
  await expect(page.getByRole('heading', { name: 'Sem acesso a esta área' })).toBeVisible()
  await page.getByRole('link', { name: 'Ir para a minha área' }).click()
  await expect(page).toHaveURL(/\/paciente$/)
  // Logado no site: avatar com menu no lugar de "Entrar".
  await page.goto('/')
  await expect(page.locator('.site-header').getByRole('link', { name: 'Entrar' })).toHaveCount(0)
  await page.locator('.tl-nav .user-menu summary').click()
  await expect(page.locator('.tl-nav .user-menu').getByRole('link', { name: 'Minha área' })).toHaveAttribute('href', '/paciente')
  // Logado, "Agendar consulta" vai direto para a agenda.
  await expect(page.locator('#inicio').getByRole('link', { name: 'Agendar consulta' })).toHaveAttribute('href', '/agendar')

  await login(page, 'admin')
  await page.goto('/app')
  await expect(page).toHaveURL(/\/login\?sem-acesso=paciente/)
})

test('hub do cliente: saudação, frase do dia, consulta com .ics, peso e dica da semana', async ({ page }) => {
  await login(page, 'beatriz')
  await expect(page.getByRole('heading', { name: 'Olá, Beatriz!' })).toBeVisible()
  await expect(page.locator('.hub-quote')).toContainText('Constância')
  await expect(page.locator('.hub-status')).toContainText('Plano Trimestral')
  await expect(page.locator('.hub-tip')).toContainText('frutas lavadas')
  const ics = page.getByRole('link', { name: 'Adicionar à agenda' })
  const href = await ics.getAttribute('href')
  const res = await page.request.get(href!)
  expect(res.headers()['content-type']).toContain('text/calendar')
  expect(await res.text()).toContain('BEGIN:VEVENT')
  await expect(page.locator('.water-ring')).toBeVisible()
  // Outro paciente não baixa o .ics da Beatriz.
  await login(page, 'lucas')
  expect((await page.request.get(href!)).status()).toBe(404)
})

test('Perfil: baixar meus dados e excluir minha conta', async ({ page }) => {
  // Conta descartável para o teste de exclusão.
  await page.goto('/criar-conta')
  await page.getByLabel('Nome completo').fill('Conta Para Excluir')
  await page.getByLabel('E-mail').fill('excluir.teste@example.com')
  await page.getByLabel('WhatsApp').fill('41988887777')
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(PASS)
  await page.getByLabel('Confirme a senha').fill(PASS)
  await page.getByLabel(/Li e aceito a/).check()
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/paciente\/anamnese$/)

  await page.goto('/paciente/meus-dados')
  await expect(page.getByRole('heading', { name: 'Perfil', level: 1 })).toBeVisible()
  const data = await page.request.get('/paciente/meus-dados/exportar')
  expect(data.status()).toBe(200)
  expect(Object.keys(await data.json())).toContain('anamneses')

  const box = page.locator('#excluir-conta')
  await box.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR')
  await box.getByLabel('Sua senha').fill(PASS)
  page.once('dialog', (d) => d.accept())
  await box.getByRole('button', { name: 'Excluir minha conta' }).click()
  await expect(page).toHaveURL(/\/\?conta=excluida/)
  await expect(page.getByText('Sua conta foi excluída')).toBeVisible()

  await page.goto('/login')
  await page.getByLabel('E-mail').fill('excluir.teste@example.com')
  await page.getByLabel('Senha').fill(PASS)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
})
