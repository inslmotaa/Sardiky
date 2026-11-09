import { defineConfig, devices } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'

/**
 * Testes de ponta a ponta contra o build de produção (next build + next start).
 * Usam um banco PGlite separado (pasta temporária), recriado com dados fictícios a cada execução.
 */
const PORT = 3200
const DATA = path.join(os.tmpdir(), 'consultorio-nutri-e2e')
const MP_PORT = 3299
// Mercado Pago simulado por um servidor falso local (tests/e2e/mp-falso.mjs): nada sai para a internet.
const mp = { MERCADOPAGO_ACCESS_TOKEN: 'TEST-token-falso', MERCADOPAGO_WEBHOOK_SECRET: 'segredo-webhook-teste', MERCADOPAGO_API_BASE: `http://localhost:${MP_PORT}` }
const env = {
  NUTRI_DATA_DIR: DATA,
  ALLOW_PGLITE: '1',
  APP_URL: `http://localhost:${PORT}`,
  CRON_SECRET: 'segredo-de-teste',
  ANAMNESE_WEBHOOK_SECRET: 'webhook-de-teste',
  // Open Food Facts simulado pelo mesmo servidor falso.
  OPENFOODFACTS_API_BASE: `http://localhost:${MP_PORT}/off`,
  // E-mails dos testes (link mágico) vão para um arquivo local, nunca para a internet.
  // Relógio simulado só para os testes chamarem a tarefa periódica "às 7h" (resumo por e-mail).
  CRON_TEST_CLOCK: '1',
  EMAIL_TEST_OUTBOX: path.join(os.tmpdir(), 'consultorio-nutri-e2e-emails.jsonl'),
  ...mp,
}

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node tests/e2e/mp-falso.mjs',
      url: `http://localhost:${MP_PORT}/__health`,
      reuseExistingServer: false,
      env: { ...mp, MP_FAKE_PORT: String(MP_PORT) },
    },
    {
    command: `node -e "require('fs').rmSync(process.env.NUTRI_DATA_DIR,{recursive:true,force:true})" && npm run setup && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 400_000,
    reuseExistingServer: false,
    env,
    },
  ],
})
