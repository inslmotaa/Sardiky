import { defineConfig, devices } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'

/**
 * Testes de ponta a ponta contra o build de produção (next build + next start).
 * Usam um banco PGlite separado (pasta temporária), recriado com dados fictícios a cada execução.
 */
const PORT = 3200
const DATA = path.join(os.tmpdir(), 'consultorio-nutri-e2e')
const env = { NUTRI_DATA_DIR: DATA, ALLOW_PGLITE: '1', APP_URL: `http://localhost:${PORT}`, CRON_SECRET: 'segredo-de-teste' }

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
  webServer: {
    command: `node -e "require('fs').rmSync(process.env.NUTRI_DATA_DIR,{recursive:true,force:true})" && npm run setup && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 400_000,
    reuseExistingServer: false,
    env,
  },
})
