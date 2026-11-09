import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { login, openPatient } from './helpers'

/** Parte 5: conversa pelo WhatsApp e lembretes de água e refeições (tudo gratuito). */

const OUTBOX = path.join(os.tmpdir(), 'consultorio-nutri-e2e-emails.jsonl')
const CRON = 'segredo-de-teste'

const spDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

async function saveChat(page: Page, fill: (p: Page) => Promise<void>) {
  await page.goto('/admin/configuracoes?secao=chat')
  await fill(page)
  await page.getByRole('button', { name: 'Salvar chat' }).click()
  await expect(page.getByText('Configurações do chat salvas.')).toBeVisible()
}

test('conversa: chat do app e WhatsApp lado a lado; toque registrado na ficha; modo global e por cliente', async ({ page }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/mensagens')
  const options = page.getByRole('group', { name: 'Falar com o coach' })
  await expect(options.getByRole('link', { name: /Conversar pelo app/ })).toBeVisible()
  await expect(options.getByRole('link', { name: /Chamar no WhatsApp/ })).toHaveAttribute('href', '/paciente/whatsapp')
  const res = await page.request.get('/paciente/whatsapp', { maxRedirects: 0 })
  expect(res.status()).toBe(303)
  expect(res.headers()['location']).toBe(`https://wa.me/5541991551789?text=${encodeURIComponent('Oi, André! Aqui é Beatriz, cliente da consultoria. ')}`)
  // Início e Mais também mostram as duas opções.
  await page.goto('/paciente')
  await expect(page.getByRole('group', { name: 'Falar com o coach' }).getByRole('link', { name: /Chamar no WhatsApp/ })).toBeVisible()
  await page.goto('/paciente/mais')
  await expect(page.getByRole('group', { name: 'Falar com o coach' }).getByRole('link', { name: /Conversar pelo app/ })).toBeVisible()

  await login(page, 'admin')
  const id = await openPatient(page, 'Beatriz Exemplo')
  await page.goto(`/admin/pacientes/${id}?aba=mensagens`)
  await expect(page.getByRole('list', { name: 'Aberturas de conversa pelo WhatsApp' })).toContainText('Cliente abriu conversa pelo WhatsApp')

  // Fora do horário: o WhatsApp continua, com a frase da resposta automática embaixo.
  await saveChat(page, async (p) => {
    for (const d of ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo']) await p.getByLabel(d, { exact: true }).check()
    await p.getByLabel('Das', { exact: true }).fill('00:00')
    await p.getByLabel('Até', { exact: true }).fill('00:01')
    await p.getByLabel('Resposta automática fora do horário').fill('Respondo assim que possível, no horário comercial.')
    await p.getByLabel('Mensagem pronta do botão “Chamar no WhatsApp”').fill('Olá, {coach}! Sou {nome}. ')
    await p.getByLabel('Como o cliente fala com você').selectOption('ambos')
  })
  await login(page, 'beatriz')
  await page.goto('/paciente/mensagens')
  await expect(page.locator('.contact-option__note')).toHaveText('Respondo assim que possível, no horário comercial.')
  expect((await page.request.get('/paciente/whatsapp', { maxRedirects: 0 })).headers()['location']).toContain(encodeURIComponent('Olá, André! Sou Beatriz.'))

  // Só pelo app (padrão) e, para a Beatriz, só WhatsApp (ficha).
  await login(page, 'admin')
  await saveChat(page, async (p) => {
    await p.getByLabel('Das', { exact: true }).fill('')
    await p.getByLabel('Até', { exact: true }).fill('')
    await p.getByLabel('Como o cliente fala com você').selectOption('app')
  })
  await login(page, 'beatriz')
  await page.goto('/paciente/mensagens')
  await expect(page.getByRole('link', { name: /Chamar no WhatsApp/ })).toHaveCount(0)
  await expect(page.locator('#conversa')).toBeVisible()

  await login(page, 'admin')
  await page.goto(`/admin/pacientes/${id}`)
  const form = page.locator('section', { has: page.getByRole('heading', { name: 'Recursos do app do cliente' }) })
  await form.getByLabel('Conversa com o coach').selectOption('whatsapp')
  await form.getByRole('button', { name: 'Salvar recursos' }).click()
  await expect(page.getByText('Recursos do app atualizados.')).toBeVisible()
  await login(page, 'beatriz')
  await page.goto('/paciente/mensagens')
  await expect(page.getByRole('link', { name: /Chamar no WhatsApp/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Conversar pelo app/ })).toHaveCount(0)
  await expect(page.locator('#conversa')).toHaveCount(0)

  // Volta ao padrão (os dois) para os outros testes.
  await login(page, 'admin')
  await page.goto(`/admin/pacientes/${id}`)
  await form.getByLabel('Conversa com o coach').selectOption('')
  await form.getByRole('button', { name: 'Salvar recursos' }).click()
  await expect(page.getByText('Recursos do app atualizados.')).toBeVisible()
  await saveChat(page, async (p) => {
    await p.getByLabel('Como o cliente fala com você').selectOption('ambos')
  })
})

test('calendário: .ics válido sem duplicar ao baixar de novo; aviso de horários mudados; link webcal revogável', async ({ page, browser }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/notificacoes')
  await expect(page.getByRole('link', { name: 'Adicionar lembretes ao meu calendário' })).toHaveAttribute('href', '/paciente/lembretes.ics')
  const first = await page.request.get('/paciente/lembretes.ics')
  expect(first.status()).toBe(200)
  expect(first.headers()['content-type']).toContain('text/calendar')
  const ics = await first.text()
  expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/)
  expect(ics).toContain('SUMMARY:Água · ver no app')
  expect(ics).toContain('BEGIN:VALARM')
  const uids = (t: string) => [...t.matchAll(/^UID:(.+)\r$/gm)].map((m) => m[1]).sort()
  const again = await (await page.request.get('/paciente/lembretes.ics')).text()
  expect(uids(again)).toEqual(uids(ics))

  // Muda o intervalo da água: os horários mudam e o app avisa para atualizar.
  await page.getByLabel('A cada (horas)').selectOption('3')
  await page.getByRole('button', { name: 'Salvar preferências' }).click()
  await expect(page.getByText('Preferências salvas.')).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Seus horários mudaram: atualize os lembretes do calendário/)).toBeVisible()
  await page.goto('/paciente')
  await expect(page.getByText('Seus horários mudaram: atualize os lembretes do calendário.')).toBeVisible()
  await page.request.get('/paciente/lembretes.ics')
  await page.goto('/paciente/notificacoes')
  await expect(page.getByText(/Seus horários mudaram/)).toHaveCount(0)

  // Assinatura por link secreto: funciona sem login; um novo link revoga o anterior; cancelar revoga.
  await page.getByText('Assinar por link (atualiza sozinho)').click()
  await page.getByRole('button', { name: 'Criar link de assinatura' }).click()
  const box = page.getByLabel('Link de assinatura do calendário')
  await expect(box).toHaveValue(/\/lembretes\/[\w-]+\.ics$/)
  const link1 = await box.inputValue()
  await expect(page.getByRole('link', { name: 'Assinar no calendário do celular' })).toHaveAttribute('href', /^webcal:\/\//)
  const anon = await browser.newContext()
  const feed = await anon.request.get(new URL(link1).pathname)
  expect(feed.status()).toBe(200)
  expect(await feed.text()).toContain('BEGIN:VCALENDAR')
  await page.getByRole('button', { name: /Gerar um novo link/ }).click()
  await expect(box).not.toHaveValue(link1)
  const link2 = await box.inputValue()
  expect((await anon.request.get(new URL(link1).pathname)).status()).toBe(404)
  expect((await anon.request.get(new URL(link2).pathname)).status()).toBe(200)
  await page.getByRole('button', { name: 'Cancelar o link de assinatura' }).click()
  await expect(page.getByRole('button', { name: 'Criar link de assinatura' })).toBeVisible()
  expect((await anon.request.get(new URL(link2).pathname)).status()).toBe(404)
  await anon.close()

  await page.getByLabel('A cada (horas)').selectOption('2')
  await page.getByRole('button', { name: 'Salvar preferências' }).click()
  await expect(page.getByText('Preferências salvas.')).toBeVisible()
})

test('resumo do dia por e-mail às 7h: consentimento, uma vez por dia, descadastro de um clique', async ({ page }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/notificacoes')
  await page.getByLabel(/Resumo do dia às 7h/).check()
  await page.getByRole('button', { name: 'Salvar preferências' }).click()
  await expect(page.getByText('Preferências salvas. O resumo do dia chega por e-mail às 7h.')).toBeVisible()

  const at7 = `${spDate()}T10:05:00Z` // 7h05 em Brasília
  const cron = () => page.request.get('/api/cron', { headers: { Authorization: `Bearer ${CRON}`, 'x-cron-now': at7 } })
  const before = existsSync(OUTBOX) ? readFileSync(OUTBOX, 'utf8') : ''
  expect((await cron()).ok()).toBe(true)
  expect((await cron()).ok()).toBe(true) // segunda chamada no mesmo dia: não repete
  const added = (existsSync(OUTBOX) ? readFileSync(OUTBOX, 'utf8') : '').slice(before.length).trim().split('\n').filter(Boolean)
  const mails = added.map((l) => JSON.parse(l) as { to: string; subject: string; text: string; category: string; headers: Record<string, string> })
  const resumo = mails.filter((m) => m.to === 'paciente@example.com' && m.category === 'resumo')
  expect(resumo).toHaveLength(1)
  expect(resumo[0].subject).toBe('Seu dia · Farion')
  expect(resumo[0].text).toContain('Meta de água')
  expect(resumo[0].headers['List-Unsubscribe']).toMatch(/\/descadastrar\//)
  const unsub = resumo[0].text.match(/https?:\/\/\S+\/descadastrar\/[\w-]+/)![0]

  await page.goto(new URL(unsub).pathname)
  await expect(page.getByRole('heading', { name: 'Pronto, você não vai mais receber o resumo por e-mail' })).toBeVisible()
  await page.goto('/paciente/notificacoes')
  await expect(page.getByLabel(/Resumo do dia às 7h/)).not.toBeChecked()

  // Com o resumo desligado, a tarefa das 7h não manda nada.
  const mid = readFileSync(OUTBOX, 'utf8')
  await page.request.get('/api/cron', { headers: { Authorization: `Bearer ${CRON}`, 'x-cron-now': at7.replace('10:05', '10:30') } })
  expect(readFileSync(OUTBOX, 'utf8').slice(mid.length)).not.toContain('"category":"resumo"')

  // Painel: sem aviso de limite com poucos e-mails.
  await login(page, 'admin')
  await expect(page.getByText(/Limite gratuito de e-mail quase atingido/)).toHaveCount(0)
})
