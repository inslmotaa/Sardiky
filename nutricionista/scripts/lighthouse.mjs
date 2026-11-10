// Lighthouse no build de produção: desempenho e acessibilidade das páginas públicas e do app do cliente.
// Uso: npm run build && ALLOW_PGLITE=1 npx next start -p 3100   (com o banco de demonstração: npm run setup)
//      node scripts/lighthouse.mjs [http://localhost:3100]
// Sai com código 1 se alguma página ficar abaixo de 90 em desempenho ou acessibilidade.
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import lighthouse from 'lighthouse'
import { chromium } from '@playwright/test'

const BASE = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '')
const MIN = Number(process.env.LH_MIN ?? 90)
const PORT = 9333
const PUBLIC = ['/', '/sobre', '/como-funciona', '/planos', '/conteudos', '/duvidas', '/login']
const APP = ['/paciente', '/paciente/plano', '/paciente/diario']
const OUT = path.join(process.cwd(), 'lighthouse')
mkdirSync(OUT, { recursive: true })

const ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(os.tmpdir(), 'lh-')), {
  headless: true,
  args: [`--remote-debugging-port=${PORT}`],
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
})

async function run(url) {
  const r = await lighthouse(`${BASE}${url}`, { port: PORT, output: 'html', logLevel: 'error', onlyCategories: ['performance', 'accessibility'] })
  const name = url === '/' ? 'inicio' : url.replace(/^\//, '').replace(/\//g, '-')
  writeFileSync(path.join(OUT, `${name}.html`), r.report)
  const perf = Math.round(r.lhr.categories.performance.score * 100)
  const a11y = Math.round(r.lhr.categories.accessibility.score * 100)
  const fails = Object.values(r.lhr.audits)
    .filter((a) => a.score !== null && a.score < 0.9 && (a.scoreDisplayMode === 'binary' || a.scoreDisplayMode === 'numeric') && (r.lhr.categories.accessibility.auditRefs.some((x) => x.id === a.id && x.weight > 0) || r.lhr.categories.performance.auditRefs.some((x) => x.id === a.id && x.weight > 0)))
    .map((a) => `${a.id}${a.displayValue ? ` (${a.displayValue})` : ''}`)
  return { url, perf, a11y, fails }
}

const results = []
for (const u of PUBLIC) results.push(await run(u))

// App do cliente: entra como a cliente de demonstração e mede Hoje, Plano e Diário.
const page = await ctx.newPage()
await page.goto(`${BASE}/login`)
await page.getByLabel('E-mail').fill(process.env.LH_EMAIL ?? 'paciente@example.com')
await page.getByLabel('Senha').fill(process.env.LH_PASSWORD ?? 'Paciente#Demo2026')
await page.getByRole('button', { name: 'Entrar' }).click()
await page.waitForURL(/\/paciente/)
await page.close()
for (const u of APP) results.push(await run(u))
await ctx.close()

let ok = true
for (const r of results) {
  const pass = r.perf >= MIN && r.a11y >= MIN
  ok &&= pass
  console.log(`${pass ? 'OK ' : 'BAIXO'}  ${r.url.padEnd(18)} desempenho ${String(r.perf).padStart(3)}  acessibilidade ${String(r.a11y).padStart(3)}${r.fails.length ? `  · ${r.fails.join(', ')}` : ''}`)
}
console.log(`\nRelatórios em ${OUT}/`)
process.exit(ok ? 0 : 1)
