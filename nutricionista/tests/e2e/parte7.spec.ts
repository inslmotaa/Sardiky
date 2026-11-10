import { expect, test, type Page } from '@playwright/test'
import { login, openPatient, pdfText } from './helpers'

/** Parte 7: fotos do corpo, fotos das refeições e perfil físico sempre atualizado. */

const spDay = (offset = 0) => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ageOn = (birth: string, today: string) => {
  const [by, bm, bd] = birth.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/** JPEG de verdade (desenhado no navegador) com um bloco EXIF com localização inserido à mão. */
async function jpegWithExif(page: Page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 900
    c.height = 1200
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#d9c7a3'
    ctx.fillRect(0, 0, 900, 1200)
    ctx.fillStyle = '#1f5e3b'
    ctx.beginPath()
    ctx.arc(450, 600, 300, 0, Math.PI * 2)
    ctx.fill()
    return c.toDataURL('image/jpeg', 0.95).split(',')[1]
  })
  const jpg = Buffer.from(b64, 'base64')
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from('MM\0*GPSLatitude -25.4284 GPSLongitude -49.2733 Curitiba', 'latin1')])
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]), body])
  return Buffer.concat([jpg.subarray(0, 2), app1, jpg.subarray(2)])
}

test('Meu corpo: idade pela data de nascimento, IMC com faixa, variação, altura com histórico e dados que faltam', async ({ page }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente')
  const card = page.locator('section.body-card')
  await expect(card.getByRole('heading', { name: 'Meu corpo' })).toBeVisible()
  await expect(card).toContainText(`${ageOn('1991-04-12', spDay())} anos`)
  await expect(card).toContainText(/IMC\s*\d+,\d/)
  await expect(card).toContainText(/Peso adequado|Sobrepeso|Obesidade|Abaixo do peso/)
  await expect(card).toContainText(/Desde o início\s*[−+]\d+,\d kg/)
  await expect(card.getByRole('link', { name: 'Registrar peso' })).toHaveAttribute('href', '/paciente/meu-corpo#peso')

  // Altura nova entra no histórico.
  await page.goto('/paciente/meu-corpo')
  await page.getByLabel('Altura (cm)').first().fill('166')
  await page.getByRole('button', { name: 'Atualizar altura' }).click()
  await expect(page.getByText('Altura atualizada.')).toBeVisible()
  await page.reload()
  await expect(page.locator('section.body-card')).toContainText('1,66 m')
  await expect(page.locator('#altura')).toContainText(`${dm(spDay())} 166 cm`)
  // Peso registrado aqui entra como "informado por você".
  await page.locator('#peso').getByLabel('Peso de hoje (kg)').fill('74,6')
  await page.locator('#peso').getByRole('button', { name: 'Salvar peso' }).click()
  await expect(page.getByText('Peso registrado. Obrigado por acompanhar!')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('list', { name: 'Últimos pesos' })).toContainText(/74,6 kg\s*· informado por você/)

  // Cadastro sem data de nascimento e sexo: o card pede "Complete seus dados" e o formulário curto resolve.
  await login(page, 'admin')
  await openPatient(page, 'Lucas')
  await page.getByLabel('Data de nascimento').fill('')
  await page.getByLabel('Sexo (para cálculos de gasto energético)').selectOption('')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Cadastro atualizado.')).toBeVisible()
  await expect(page.locator('section.body-card')).toContainText('Falta no cadastro: data de nascimento, sexo.')
  await login(page, 'lucas')
  await page.goto('/paciente')
  const missing = page.locator('section.body-card')
  await expect(missing).toContainText('Complete seus dados: falta data de nascimento, sexo.')
  await missing.getByRole('link', { name: 'Complete seus dados' }).click()
  await expect(page).toHaveURL(/\/paciente\/meu-corpo#dados$/)
  const form = page.locator('#dados')
  await form.getByLabel('Data de nascimento').fill('1996-09-30')
  await form.getByLabel('Sexo').selectOption('M')
  await form.getByLabel('Altura (cm)').fill('178')
  await form.getByRole('button', { name: 'Salvar dados' }).click()
  await expect(page.getByText('Dados salvos. Seu card "Meu corpo" já está completo.')).toBeVisible()
  await page.goto('/paciente')
  await expect(page.locator('section.body-card')).not.toContainText('Complete seus dados')
  await expect(page.locator('section.body-card')).toContainText(`${ageOn('1996-09-30', spDay())} anos`)
  await expect(page.locator('section.body-card')).toContainText('1,78 m')

  // Painel: o mesmo card no topo da ficha; 14 dias sem peso no Acompanhamento.
  await login(page, 'admin')
  await openPatient(page, 'Beatriz Exemplo')
  const top = page.locator('section.body-card')
  await expect(top.getByRole('heading', { name: 'Corpo' })).toBeVisible()
  await expect(top).toContainText('74,6 kg')
  await expect(top).toContainText('informado pelo cliente')
  await page.goto('/admin/acompanhamento')
  const noWeight = page.getByRole('list', { name: 'Sem registrar peso há 14 dias' })
  await expect(noWeight).toBeVisible()
  await expect(noWeight).not.toContainText('Beatriz')
})

test('fotos do corpo: só com consentimento, peso do dia, primeira × última, sobreposição, comentário do coach e privacidade', async ({ page, browser }) => {
  await login(page, 'beatriz')
  // Garante a autorização (dada em outro teste, ou aqui) antes de abrir o formulário em outra aba.
  await page.goto('/paciente/meu-corpo/fotos')
  if (await page.getByRole('button', { name: 'Autorizar e continuar' }).isVisible()) {
    await page.getByLabel(/Autorizo o envio e o armazenamento/).check()
    await page.getByRole('button', { name: 'Autorizar e continuar' }).click()
  }
  await expect(page.getByRole('button', { name: 'Abrir a câmera' })).toBeVisible()
  // Formulário aberto antes de retirar a autorização: o servidor recusa o envio depois.
  const other = await page.context().newPage()
  await other.goto('/paciente/meu-corpo/fotos')
  await expect(other.getByRole('button', { name: 'Abrir a câmera' })).toBeVisible()
  await page.goto('/paciente/meu-corpo/fotos')
  await page.getByRole('button', { name: 'Retirar autorização' }).click()
  await expect(page.getByRole('button', { name: 'Autorizar e continuar' })).toBeVisible()
  await other.getByLabel('Frente: escolher da galeria').setInputFiles({ name: 'frente.jpg', mimeType: 'image/jpeg', buffer: await jpegWithExif(other) })
  await other.getByRole('button', { name: 'Enviar foto' }).click()
  await expect(other.getByText('Para enviar fotos do corpo, autorize primeiro (é só uma vez).')).toBeVisible()
  await other.close()

  // O coach também não consegue enviar sem a autorização do cliente.
  const admin = await browser.newContext()
  const ap = await admin.newPage()
  await login(ap, 'admin')
  const id = await openPatient(ap, 'Beatriz Exemplo')
  await ap.goto(`/admin/pacientes/${id}?aba=evolucao`)
  await expect(ap.getByText('O cliente ainda não autorizou fotos do corpo.')).toBeVisible()
  await expect(ap.getByText('Adicionar fotos')).toHaveCount(0)

  // Autoriza de novo e envia frente e lado com o peso do dia.
  await page.reload()
  await page.getByLabel(/Autorizo o envio e o armazenamento/).check()
  await page.getByRole('button', { name: 'Autorizar e continuar' }).click()
  await expect(page.getByRole('button', { name: 'Abrir a câmera' })).toBeVisible()
  await expect(page.getByText('Mesma distância: o corpo inteiro na foto, da cabeça aos pés.')).toBeVisible()
  await page.getByLabel('Frente: escolher da galeria').setInputFiles({ name: 'frente.jpg', mimeType: 'image/jpeg', buffer: await jpegWithExif(page) })
  await page.getByLabel('Lado: escolher da galeria').setInputFiles({ name: 'lado.jpg', mimeType: 'image/jpeg', buffer: await jpegWithExif(page) })
  await page.getByLabel('Peso de hoje (kg, opcional)').fill('74,1')
  await page.getByRole('button', { name: 'Enviar 2 fotos' }).click()
  await expect(page.getByText('2 fotos salvas com o peso do dia. Só você e o seu coach podem ver.')).toBeVisible()

  // Coach envia um conjunto antigo (para comparar) e comenta o de hoje.
  await ap.reload()
  const fotos = ap.locator('#fotos')
  await fotos.getByText('Adicionar fotos').click()
  await fotos.locator('input[name="date"]').fill(spDay(-60))
  await fotos.getByLabel('Peso do dia (kg, opcional)').fill('77,8')
  await fotos.getByLabel('Frente', { exact: true }).setInputFiles({ name: 'antes.jpg', mimeType: 'image/jpeg', buffer: await jpegWithExif(ap) })
  await fotos.getByRole('button', { name: 'Enviar fotos' }).click()
  await expect(fotos.getByText('Foto salva.')).toBeVisible()
  await ap.reload()
  await ap.getByLabel(`Comentário para o cliente (${dm(spDay())})`).fill('Cintura bem mais fina! Continue assim.')
  await ap.getByRole('button', { name: 'Salvar comentário' }).first().click()
  await expect(ap.getByText('Comentário enviado ao cliente.')).toBeVisible()

  // Cliente: linha do tempo com o peso de cada data, primeira × última, sobreposição e comentário.
  await page.goto('/paciente/evolucao')
  const timeline = page.getByRole('list', { name: 'Datas com fotos do corpo' })
  await expect(timeline).toContainText(`${dm(spDay(-60))} · 77,8 kg`)
  await expect(timeline).toContainText(`${dm(spDay())} · 74,1 kg`)
  await page.getByRole('button', { name: 'Primeira × última' }).click()
  await page.getByRole('radio', { name: 'Sobrepor' }).click()
  const slider = page.getByRole('slider', { name: 'Sobreposição entre antes e depois' })
  await slider.fill('80')
  await expect(page.locator('.photo-overlay img').nth(1)).toHaveCSS('opacity', '0.8')
  await expect(page.getByText('Comentário do coach: Cintura bem mais fina! Continue assim.').first()).toBeVisible()
  await expect(page.getByRole('list', { name: 'Evolução por data' })).toContainText('Cintura bem mais fina!')

  // Foto sem EXIF (comprimida no celular) e abaixo do limite; outro cliente e coach de outra carteira não abrem.
  const src = (await page.locator('.photo-grid img').first().getAttribute('src'))!
  const res = await page.request.get(src)
  expect(res.status()).toBe(200)
  const body = await res.body()
  expect(body.length).toBeLessThan(8 * 1024 * 1024)
  expect(body.includes(Buffer.from('Exif\0\0', 'latin1'))).toBe(false)
  expect(body.includes(Buffer.from('GPSLatitude', 'latin1'))).toBe(false)
  for (const who of ['lucas', 'nutri2'] as const) {
    const ctx = await browser.newContext()
    const p2 = await ctx.newPage()
    await login(p2, who)
    expect((await p2.request.get(src)).status()).toBe(404)
    await ctx.close()
  }

  // O cliente apaga qualquer foto dele, inclusive a enviada pelo coach.
  const before = await page.locator('.photo-grid img').count()
  page.once('dialog', (d) => d.accept())
  await page.locator(`section[aria-label="Fotos de ${dm(spDay(-60))}"]`).getByRole('button', { name: 'apagar' }).click()
  await expect(page.locator('.photo-grid img')).toHaveCount(before - 1)
  await admin.close()
})

test('relatório de evolução em PDF: sem fotos sem autorização; com a autorização, inclui as fotos', async ({ page }) => {
  await login(page, 'beatriz')
  await page.goto('/paciente/evolucao')
  await expect(page.getByRole('heading', { name: 'Resumo' })).toBeVisible()
  await expect(page.getByText('nos últimos 30 dias')).toBeVisible()
  const pdf1 = await page.request.get('/paciente/evolucao/pdf')
  expect(pdf1.status()).toBe(200)
  expect(pdf1.headers()['content-type']).toBe('application/pdf')
  const t1 = pdfText(await pdf1.body())
  expect(t1).toContain('Relatório de evolução')
  expect(t1).toContain('Beatriz Exemplo')
  expect(t1).toContain('Fotos não incluídas: o cliente não autorizou fotos no relatório.')
  expect(t1).not.toMatch(/nutricionista|\bCRN\b/i)

  await page.getByLabel(/Incluir minhas fotos do corpo no relatório/).check()
  await page.getByRole('button', { name: 'Salvar preferência' }).click()
  await expect(page.getByLabel(/Incluir minhas fotos do corpo no relatório/)).toBeChecked()
  await login(page, 'admin')
  const id = await openPatient(page, 'Beatriz Exemplo')
  const pdf2 = await page.request.get(`/admin/pacientes/${id}/evolucao/pdf`)
  expect(pdf2.status()).toBe(200)
  const raw = (await pdf2.body()).toString('latin1')
  const t2 = pdfText(await pdf2.body())
  expect(t2).toContain('Fotos do corpo:')
  expect(t2).not.toContain('não autorizou')
  expect(raw).toContain('/Subtype /Image')

  // Volta a tirar a autorização (outros testes contam com o relatório sem fotos).
  await login(page, 'beatriz')
  await page.goto('/paciente/evolucao')
  await page.getByLabel(/Incluir minhas fotos do corpo no relatório/).uncheck()
  await page.getByRole('button', { name: 'Salvar preferência' }).click()
  await expect(page.getByLabel(/Incluir minhas fotos do corpo no relatório/)).not.toBeChecked()
})

test('foto do prato: cria o registro da refeição certa, não duplica ao reenviar; foto avulsa; coach comenta e reage', async ({ page }) => {
  await login(page, 'helena')
  await page.goto('/paciente')
  const input = page.locator('.timeline-day input[aria-label^="Foto do prato:"]').first()
  const meal = (await input.getAttribute('aria-label'))!.replace('Foto do prato: ', '')
  await input.setInputFiles({ name: 'prato.jpg', mimeType: 'image/jpeg', buffer: await jpegWithExif(page) })
  await expect(page.getByText(`Foto salva no diário: ${meal} (segui o plano).`)).toBeVisible()
  await expect(page.getByRole('img', { name: `Foto do prato: ${meal}` })).toBeVisible()
  // Reenviar troca a foto do mesmo registro.
  await page.reload()
  await page.locator('.timeline-day input[aria-label^="Foto do prato:"]').first().setInputFiles({ name: 'prato2.jpg', mimeType: 'image/jpeg', buffer: await jpegWithExif(page) })
  await expect(page.getByText(`Foto do ${meal.toLowerCase()} atualizada.`)).toBeVisible()

  const data = await (await page.request.get('/paciente/meus-dados/exportar')).json()
  const today = spDay()
  const entries = (data.diarioAlimentar as { date: string; meal: string; mealKey: string | null; photoFileId: string | null; adherence: string }[]).filter((e) => e.date === today && e.meal === meal && e.mealKey)
  expect(entries).toHaveLength(1)
  expect(entries[0].adherence).toBe('total')
  expect(entries[0].photoFileId).toBeTruthy()
  const photo = await page.request.get(`/arquivos/${entries[0].photoFileId}`)
  expect((await photo.body()).includes(Buffer.from('GPSLatitude', 'latin1'))).toBe(false)
  // A foto antiga foi apagada ao trocar: só uma foto de prato desta refeição hoje.
  const plateFiles = (data.arquivos as { kind: string; title: string }[]).filter((f) => f.kind === 'foto_refeicao' && f.title === `Prato ${meal} ${today}`)
  expect(plateFiles).toHaveLength(1)

  // Foto avulsa ("comi outra coisa") com texto; arquivo que não é imagem é recusado.
  await page.getByText('Foto avulsa: comi outra coisa').click()
  const loose = page.locator('#foto-avulsa')
  await loose.getByLabel('Foto do prato').setInputFiles({ name: 'texto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('isto não é uma foto') })
  await loose.getByRole('button', { name: 'Enviar foto' }).click()
  await expect(loose.getByText('Formato não permitido.').first()).toBeVisible()
  await loose.getByLabel('Foto do prato').setInputFiles({ name: 'pizza.jpg', mimeType: 'image/jpeg', buffer: await jpegWithExif(page) })
  await loose.getByLabel('O que foi (opcional)').fill('Pizza com salada no aniversário')
  await loose.getByRole('button', { name: 'Enviar foto' }).click()
  await expect(loose.getByText('Foto salva no seu diário.')).toBeVisible()

  // Painel: Pratos da semana com o plano ao lado; reação e comentário chegam ao cliente.
  await login(page, 'admin')
  const id = await openPatient(page, 'Helena')
  await page.goto(`/admin/pacientes/${id}?aba=diario&vista=pratos`)
  const grid = page.getByRole('region', { name: `Pratos de ${dm(today)}` })
  await expect(grid.getByRole('img', { name: `Prato: ${meal} em ${dm(today)}` })).toBeVisible()
  await expect(grid.getByRole('list', { name: `No plano: ${meal}` })).toBeVisible()
  await expect(grid).toContainText('Pizza com salada no aniversário')
  await grid.getByRole('group', { name: `Reagir ao prato: ${meal}` }).getByRole('button', { name: 'Ótimo' }).click()
  await expect(grid.getByRole('group', { name: `Reagir ao prato: ${meal}` }).getByRole('button', { name: 'Ótimo' })).toHaveAttribute('aria-pressed', 'true')
  await grid.getByLabel(`Comentário sobre o prato: ${meal}`).fill('Prato lindo e bem montado!')
  await grid.getByLabel(`Comentário sobre o prato: ${meal}`).press('Enter')
  await expect(grid.getByText('Seu comentário: Prato lindo e bem montado!')).toBeVisible()

  await login(page, 'helena')
  await page.goto('/paciente/diario')
  await expect(page.getByText('Coach: Ótimo').first()).toBeVisible()
  await expect(page.getByText('Prato lindo e bem montado!')).toBeVisible()
})

test('exportação (LGPD) com histórico de peso e altura e todas as fotos; espaço das fotos em Configurações', async ({ page }) => {
  await login(page, 'beatriz')
  const json = await (await page.request.get('/paciente/meus-dados/exportar')).json()
  expect(json.historicoDePeso.length).toBeGreaterThan(0)
  expect(json.historicoDeAltura.some((h: { alturaCm: number }) => Number(h.alturaCm) === 166)).toBe(true)
  const zipRes = await page.request.get('/paciente/meus-dados/exportar?formato=zip')
  expect(zipRes.status()).toBe(200)
  expect(zipRes.headers()['content-type']).toBe('application/zip')
  const zip = await zipRes.body()
  expect(zip.readUInt32LE(0)).toBe(0x04034b50)
  expect(zip.includes(Buffer.from('meus-dados.json'))).toBe(true)
  expect(zip.includes(Buffer.from('fotos-do-corpo/'))).toBe(true)
  // Volta a altura de cadastro (outros testes usam o IMC da Beatriz com 1,65 m).
  await page.goto('/paciente/meu-corpo')
  await page.getByLabel('Altura (cm)').first().fill('165')
  await page.getByRole('button', { name: 'Atualizar altura' }).click()
  await expect(page.getByText('Altura atualizada.')).toBeVisible()

  await login(page, 'admin')
  await page.goto('/admin/configuracoes?secao=armazenamento')
  await expect(page.getByRole('heading', { name: 'Armazenamento' })).toBeVisible()
  const table = page.getByRole('table', { name: 'Espaço por tipo de arquivo' })
  await expect(table).toContainText('Fotos do corpo')
  await expect(table).toContainText('Fotos dos pratos')
  await expect(page.getByText(/em fotos \(\d+ arquivos\)/)).toBeVisible()
})
