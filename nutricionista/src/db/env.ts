import { existsSync } from 'node:fs'

/** Carrega .env/.env.local para os scripts executados fora do Next.js. */
export function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) process.loadEnvFile(file)
  }
}
