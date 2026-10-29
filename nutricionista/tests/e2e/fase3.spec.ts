import { expect, test, type Page } from '@playwright/test'
import { login, openPatient } from './helpers'

/** Fase 3: agenda, anamnese nativa, receitas, materiais, compras, prescrições, equipe e financeiro. */


test('restrições da ficha geram alerta no editor de planos', async ({ page }) => {
  await login(page, 'admin')
  const id = await openPatient(page, 'Beatriz Exemplo')
  await page.goto(`/admin/pacientes/${id}?aba=planos`)
  await page.getByRole('link', { name: /Plano alimentar — reeducação/ }).first().click()
  const published = page.url()
  await page.getByRole('button', { name: 'Criar nova versão' }).click()
  await page.waitForURL((u) => u.href !== published)
  await expect(page.locator('p', { hasText: 'Restrições do cliente:' })).toContainText('Lactose')
  await expect(page.getByText('⚠ Restrição: Lactose').first()).toBeVisible()
  const meal = page.locator('section[aria-label^="Refeição"]').first()
  const name = (await meal.getAttribute('aria-label'))!.replace('Refeição ', '')
  await meal.getByLabel(`Adicionar alimento em ${name}`).fill('queijo minas')
  await page.keyboard.press('Enter')
  await expect(meal.getByRole('alert')).toContainText('conflita com a restrição do cliente (Lactose)')
})

test('anamnese nativa: consentimento, seções e restrições levadas à ficha', async ({ page }) => {
  await login(page, 'lucas')
  await page.goto('/paciente/formularios')
  await page.getByRole('link', { name: 'Preencher' }).first().click()
  await expect(page.getByRole('heading', { name: 'Saúde' })).toBeVisible()
  await page.getByLabel('Qual é o seu principal objetivo com o acompanhamento?').fill('Melhorar o rendimento na corrida')
  await page.getByLabel('Glúten').check()
  await page.getByLabel('Quantas refeições você faz por dia?').selectOption('4')
  await page.getByLabel('3 a 4 vezes/semana').check()
  await page.getByRole('button', { name: 'Enviar respostas' }).click()
  // Sem autorizar o uso dos dados de saúde, não envia.
  await expect(page.getByText('Revise as respostas destacadas.')).toBeVisible()
  await page.getByLabel(/Autorizo o uso dos meus dados de saúde/).check()
  await page.getByRole('button', { name: 'Enviar respostas' }).click()
  // Enviado: a página passa a mostrar as respostas.
  await expect(page.getByText('Respostas enviadas.', { exact: true })).toBeVisible()
  await expect(page.getByText('Melhorar o rendimento na corrida')).toBeVisible()

  await login(page, 'admin')
  const id = await openPatient(page, 'Lucas Fictício')
  await page.goto(`/admin/pacientes/${id}?aba=resumo`)
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Restrições alimentares' }) }).getByLabel('Glúten')).toBeChecked()
})

test('receita: cadastro com cálculo automático, biblioteca do paciente e no plano', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/receitas/nova')
  await page.getByLabel('Nome da receita').fill('Arroz de teste')
  await page.getByLabel('Adicionar ingrediente').fill('arroz tipo')
  await page.keyboard.press('Enter')
  await page.getByLabel(/Gramas de Arroz/).fill('150')
  await page.getByLabel('Rendimento (porções)').fill('1')
  await expect(page.locator('.calc-result')).toContainText('192')
  await page.getByRole('button', { name: 'Salvar receita' }).click()
  await page.waitForURL(/\/admin\/receitas\/[0-9a-f-]{36}\?criada=1$/)
  await expect(page.getByText(/Receita criada/)).toBeVisible()

  // Disponível no editor de planos como “Receita: …”.
  await page.goto('/admin/planos')
  await page.getByRole('link', { name: 'Modelo — Treino e descanso' }).click()
  const meal = page.locator('section[aria-label^="Refeição"]').first()
  const name = (await meal.getAttribute('aria-label'))!.replace('Refeição ', '')
  await meal.getByLabel(`Adicionar alimento em ${name}`).fill('receita arroz de teste')
  await page.keyboard.press('Enter')
  await expect(meal.getByText('Receita: Arroz de teste')).toBeVisible()

  await login(page, 'beatriz')
  await page.goto('/paciente/receitas')
  await page.getByRole('link', { name: /Arroz de teste/ }).click()
  await expect(page.getByRole('heading', { name: 'Arroz de teste' })).toBeVisible()
  await expect(page.getByText('Arroz, tipo 1, cozido')).toBeVisible()
})

test('lista de compras da semana gerada do plano, com itens marcáveis', async ({ page }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/compras')
  await expect(page.getByRole('heading', { name: 'Lista de compras da semana' })).toBeVisible()
  const rice = page.locator('.shopping li', { hasText: 'Arroz, integral, cozido' })
  await expect(rice).toContainText('(cru)')
  await rice.getByRole('checkbox').check()
  await page.reload()
  await expect(page.locator('.shopping li', { hasText: 'Arroz, integral, cozido' }).getByRole('checkbox')).toBeChecked()
})

test('prescrições: item com dose, texto escrito livremente e edição aparecem no plano do paciente', async ({ page }) => {
  await login(page, 'admin')
  const id = await openPatient(page, 'Beatriz Exemplo')
  await page.goto(`/admin/pacientes/${id}?aba=prescricoes`)
  const form = page.locator('section.card', { hasText: 'Escrever prescrição' })

  // Item com dose e horário.
  await form.getByLabel('Título').fill('Ômega 3')
  await form.getByLabel('Tipo').selectOption('suplemento')
  await form.getByText('Dose, horário e duração (opcional)').click()
  await form.getByLabel('Dose').fill('1 g')
  await form.getByLabel('Horário').fill('No jantar')
  await form.getByRole('button', { name: 'Registrar prescrição' }).click()
  await expect(page.getByText('Prescrição registrada e visível no app do cliente.')).toBeVisible()

  // Prescrição escrita (tipo padrão), com várias linhas; sem texto não registra.
  await page.reload()
  await form.getByLabel('Título').fill('Pré-treino e manipulados')
  await form.getByRole('button', { name: 'Registrar prescrição' }).click()
  await expect(form.getByText('Escreva a prescrição')).toBeVisible()
  await form.getByLabel('Prescrição').fill('Creatina 5 g por dia, com água.\nCafeína 200 mg, 30 min antes do treino.')
  await form.getByRole('button', { name: 'Registrar prescrição' }).click()
  await expect(page.getByText('Prescrição registrada e visível no app do cliente.')).toBeVisible()

  // Edição do texto.
  await page.reload()
  const item = page.locator('li', { hasText: 'Pré-treino e manipulados' })
  await item.getByText('Editar').click()
  await item.getByLabel('Prescrição').fill('Creatina 5 g por dia, com água.\nCafeína 150 mg, 30 min antes do treino.')
  await item.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Prescrição atualizada no app do cliente.')).toBeVisible()

  await login(page, 'beatriz')
  await page.goto('/paciente/plano')
  const box = page.locator('#prescricoes')
  await expect(box.getByRole('heading', { name: 'Prescrições' })).toBeVisible()
  await expect(box).toContainText('Ômega 3')
  await expect(box).toContainText('1 g · No jantar')
  await expect(box).toContainText('Vitamina D3')
  await expect(box).toContainText('Pré-treino e manipulados')
  await expect(box.locator('.prescription-text', { hasText: 'Cafeína 150 mg' })).toHaveText('Creatina 5 g por dia, com água.\nCafeína 150 mg, 30 min antes do treino.')
  const pdf = await page.request.get('/paciente/plano/pdf')
  expect(pdf.headers()['content-type']).toContain('application/pdf')
})

test('agenda: paciente confirma presença, pede remarcação e avalia a consulta', async ({ page }) => {
  await login(page, 'lucas')
  await page.goto('/paciente/consultas')
  await page.getByRole('button', { name: 'Confirmar presença' }).first().click()
  await expect(page.getByText('Presença confirmada').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Entrar na videochamada' }).first()).toHaveAttribute('href', /^https:\/\/meet\.jit\.si\//)
  await page.getByText('Pedir remarcação').first().click()
  await page.getByLabel(/Melhores dias e horários/).first().fill('Terças à noite')
  await page.getByRole('button', { name: 'Enviar pedido' }).first().click()
  await expect(page.getByText('Remarcação pedida — aguarde o contato').first()).toBeVisible()

  await login(page, 'beatriz')
  await page.goto('/paciente/consultas')
  await page.getByRole('radio', { name: '5 estrelas' }).check()
  await page.getByLabel('Comentário (opcional)').fill('Ótimo atendimento')
  await page.getByRole('button', { name: 'Enviar avaliação' }).click()
  await expect(page.getByText('Obrigado pela avaliação!')).toBeVisible()
})

test('feriados nacionais viram bloqueios na agenda (sem duplicar)', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/agenda')
  await page.getByText('Feriados nacionais').click()
  await page.getByLabel('Ano').fill('2027')
  await page.getByRole('button', { name: 'Bloquear feriados' }).click()
  await expect(page.getByText('10 feriados de 2027 bloqueados na agenda.')).toBeVisible()
  await page.getByRole('button', { name: 'Bloquear feriados' }).click()
  await expect(page.getByText('Os feriados de 2027 já estavam bloqueados.')).toBeVisible()
})

test('equipe: nutricionista com pacientes próprios não vê os demais', async ({ page }) => {
  await login(page, 'admin')
  const beatriz = await openPatient(page, 'Beatriz Exemplo')
  await login(page, 'nutri2')
  await page.goto('/admin/pacientes')
  await expect(page.getByRole('link', { name: 'Helena Teste' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Beatriz Exemplo' })).toHaveCount(0)
  expect((await page.goto(`/admin/pacientes/${beatriz}`))?.status()).toBe(404)
  await page.goto('/admin/acompanhamento')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.goto('/admin/mensagens')
  await expect(page.getByText('Beatriz Exemplo')).toHaveCount(0)
})

test('materiais: público geral e lista de pacientes escolhidos', async ({ page }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/materiais')
  await expect(page.getByText('Guia Alimentar para a População Brasileira')).toBeVisible()
  await expect(page.getByText('Como montar o prato do dia a dia')).toBeVisible()
  await login(page, 'lucas')
  await page.goto('/paciente/materiais')
  await expect(page.getByText('Guia Alimentar para a População Brasileira')).toBeVisible()
  await expect(page.getByText('Como montar o prato do dia a dia')).toHaveCount(0)
})

test('financeiro: pagamento vencido aparece como atrasado, com cobrança pelo WhatsApp', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/financeiro?status=pendente')
  const row = page.locator('tr', { hasText: 'Helena Teste' })
  await expect(row.getByText('Atrasado')).toBeVisible()
  await expect(row.getByRole('link', { name: 'Cobrar pelo WhatsApp' })).toHaveAttribute('href', /wa\.me\/.*vencimento/)
})

test('webhook da anamnese externa cria o paciente e leva as restrições à ficha', async ({ request, page }) => {
  const denied = await request.post('/api/webhooks/anamnese', { data: { email: 'x@example.com', respostas: {} } })
  expect(denied.status()).toBe(401)
  const res = await request.post('/api/webhooks/anamnese', {
    headers: { Authorization: 'Bearer webhook-de-teste' },
    data: { email: 'marina.forms@example.com', nome: 'Marina Formulário', respostas: { 'Qual seu objetivo?': 'Ganhar massa', 'Alergias e intolerâncias': ['Lactose', 'Amendoim'] } },
  })
  expect(res.status()).toBe(200)
  expect((await res.json()).pacienteNovo).toBe(true)
  await login(page, 'admin')
  await openPatient(page, 'Marina Formulário')
  const box = page.locator('section', { has: page.getByRole('heading', { name: 'Restrições alimentares' }) })
  await expect(box.getByLabel('Lactose')).toBeChecked()
  await expect(box.getByLabel('Amendoim')).toBeChecked()
})
