import { expect, test } from '@playwright/test'
import { login } from './helpers'

/** Parte 2: pendências de conteúdo, Sobre com formações, depoimentos autorizados e modo escuro. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

test('Início do painel lista o que falta antes de publicar o site', async ({ page }) => {
  await login(page, 'admin')
  const card = page.locator('section[aria-labelledby="pendencias-titulo"]')
  await expect(card.getByRole('heading', { name: 'Antes de publicar o site' })).toBeVisible()
  const list = card.getByRole('list', { name: 'Pendências do site' })
  for (const t of ['E-mail de exemplo (example.com)', 'Instagram vazio', 'Foto profissional não enviada', 'Texto “(Texto de exemplo — …)” na página Sobre'])
    await expect(list).toContainText(t)
  await expect(list.getByRole('link', { name: 'Ajustar' }).first()).toHaveAttribute('href', '/admin/configuracoes?secao=perfil')
})

test('Sobre: formações editáveis em Configurações e layout sem foto, sem buraco', async ({ page }) => {
  await page.goto('/sobre')
  await expect(page.getByRole('heading', { name: 'Formações e certificações' })).toHaveCount(0)
  await expect(page.locator('.about--nophoto')).toBeVisible()
  await expect(page.locator('.about__portrait')).toHaveCount(0)

  await login(page, 'admin')
  await page.goto('/admin/configuracoes?secao=perfil')
  await page.getByLabel('Formações e certificações').fill('Coaching em saúde | Instituto Exemplo de Teste | 2019\nCurso sem ano | Escola')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByText('Linha 2: use “Curso | Instituição | Ano”.').first()).toBeVisible()
  await page.getByLabel('Formações e certificações').fill('Coaching em saúde | Instituto Exemplo de Teste | 2019\nAlimentação e performance | Escola Teste | 2023')
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(page.getByText('Perfil e identidade visual atualizados.')).toBeVisible()

  await page.goto('/sobre')
  const creds = page.getByRole('list', { name: 'Formações e certificações' })
  await expect(creds.locator('.creds__item')).toHaveCount(2)
  await expect(creds.locator('.creds__item').first()).toContainText('2023')
  await expect(creds.locator('.creds__item').first()).toContainText('Alimentação e performance')
  await expect(creds.locator('.creds__item').last()).toContainText('Instituto Exemplo de Teste')
})

test('depoimento: cliente autoriza, coach aprova; fotos só com autorização específica; cliente retira', async ({ page, request }) => {
  await login(page, 'helena')
  await page.goto('/paciente/consultas')
  await page.getByRole('radio', { name: '5 estrelas' }).check()
  await page.getByLabel('Autorizo publicar esta avaliação como depoimento no site').check()
  await page.getByRole('button', { name: 'Enviar avaliação' }).click()
  await expect(page.getByText('Para publicar como depoimento, escreva um comentário.')).toBeVisible()
  await page.getByLabel('Comentário (opcional)').fill('O acompanhamento organizou minha rotina sem dieta da moda.')
  await page.getByRole('button', { name: 'Enviar avaliação' }).click()
  await expect(page.getByText('Obrigado! Sua avaliação vai para o site depois que o coach aprovar.')).toBeVisible()
  await expect(page.getByText('Autorizada · aguardando o coach')).toBeVisible()

  // Antes da aprovação, nada no site.
  await page.goto('/')
  await expect(page.getByRole('list', { name: 'Depoimentos' })).toHaveCount(0)

  await login(page, 'admin')
  await page.goto('/admin/configuracoes?secao=site')
  const item = page.getByRole('list', { name: 'Depoimentos' }).getByRole('listitem').filter({ hasText: 'O acompanhamento organizou' })
  await expect(item).toContainText('Aguardando aprovação')
  await expect(item).toContainText('H. T.')
  await expect(item).toContainText('Pelo app')

  // Fotos de antes e depois: sem marcar a autorização específica, nada é gravado.
  await item.getByText('Adicionar fotos de antes e depois').click()
  await item.getByLabel('Foto de antes').setInputFiles({ name: 'antes.png', mimeType: 'image/png', buffer: PNG })
  await item.getByLabel('Foto de depois').setInputFiles({ name: 'depois.png', mimeType: 'image/png', buffer: PNG })
  await item.getByLabel('Data da autorização das fotos').fill('2026-11-01')
  await item.getByLabel('Forma da autorização das fotos').selectOption('escrita')
  await item.getByRole('button', { name: 'Salvar fotos' }).click()
  await expect(item.getByText('Confirme a autorização específica para as fotos').first()).toBeVisible()
  await item.getByLabel('O cliente autorizou especificamente a publicação destas fotos').check()
  await item.getByLabel('Foto de antes').setInputFiles({ name: 'antes.png', mimeType: 'image/png', buffer: PNG })
  await item.getByLabel('Foto de depois').setInputFiles({ name: 'depois.png', mimeType: 'image/png', buffer: PNG })
  await item.getByRole('button', { name: 'Salvar fotos' }).click()
  // Gravadas com a autorização registrada (o formulário das fotos sai e aparece "Remover fotos").
  await expect(item).toContainText(/Fotos autorizadas em 01\/11\/2026/)
  await expect(item.getByRole('button', { name: 'Remover fotos' })).toBeVisible()
  // Ainda não aprovado: as fotos não ficam públicas.
  expect((await page.context().request.get('/')).ok()).toBe(true)

  await page.reload()
  const approved = page.getByRole('list', { name: 'Depoimentos' }).getByRole('listitem').filter({ hasText: 'O acompanhamento organizou' })
  await approved.getByRole('button', { name: 'Aprovar e publicar' }).click()
  await expect(approved).toContainText('Publicado')

  // No site: texto, assinatura, nota e as fotos (só agora públicas).
  await page.context().clearCookies()
  await page.goto('/')
  const quotes = page.getByRole('list', { name: 'Depoimentos' })
  await expect(quotes).toContainText('O acompanhamento organizou minha rotina')
  await expect(quotes).toContainText('H. T. · NOTA 5 DE 5')
  await expect(page.locator('#resultados')).toContainText('Depoimentos publicados com autorização.')
  const photo = quotes.locator('.quote__photos img').first()
  await expect(photo).toBeVisible()
  const src = (await photo.getAttribute('src'))!
  expect((await request.get(src)).status()).toBe(200)

  // A cliente retira a autorização: sai do site e a foto deixa de ser pública.
  await login(page, 'helena')
  await page.goto('/paciente/consultas')
  await expect(page.getByText('Publicada no site')).toBeVisible()
  await page.getByRole('button', { name: 'Retirar autorização' }).click()
  await expect(page.getByText('Publicada no site')).toHaveCount(0)
  await page.context().clearCookies()
  await page.goto('/')
  await expect(page.getByRole('list', { name: 'Depoimentos' })).toHaveCount(0)
  expect((await page.request.get(src)).status()).toBe(404)
})

test('modo escuro: segue o aparelho e o cliente pode fixar claro ou escuro', async ({ page }) => {
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const isDark = (rgb: string) => {
    const [r, g, b] = rgb.match(/\d+/g)!.map(Number)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 60
  }
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/login')
  expect(isDark(await bg())).toBe(true)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/login')
  expect(isDark(await bg())).toBe(false)

  await login(page, 'beatriz')
  await page.goto('/paciente/meus-dados')
  const form = page.locator('section[aria-labelledby="aparencia-titulo"]')
  await form.getByLabel('Escuro').check()
  await form.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('/paciente')
  expect(isDark(await bg())).toBe(true)

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/paciente/meus-dados')
  await form.getByLabel('Claro').check()
  await form.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(isDark(await bg())).toBe(false)

  await form.getByLabel('Automático (como o aparelho)').check()
  await form.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
  expect(isDark(await bg())).toBe(true)
})
