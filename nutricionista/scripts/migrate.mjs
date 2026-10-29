// Aplica as migrações em produção (PostgreSQL via DATABASE_URL), sem dependências de build,
// e carrega a base de alimentos (TACO + medidas do IBGE) na primeira vez.
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { importarMedidas, importarTaco, precisaImportar } from './tabelas/importar.mjs'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida.')
  process.exit(1)
}
const client = postgres(process.env.DATABASE_URL, { max: 1 })
await migrate(drizzle(client), { migrationsFolder: './drizzle' })
console.log('Migrações aplicadas.')

// Base de alimentos: TACO 4ª ed. completa + medidas caseiras do IBGE (só quando ainda falta).
const query = (text, params = []) => client.unsafe(text, params)
if (await precisaImportar(query)) {
  const taco = await importarTaco(query)
  const medidas = await importarMedidas(query)
  console.log(`Tabelas de alimentos: TACO ${taco.inserted} novo(s) e ${taco.updated} atualizado(s); ${medidas} medidas do IBGE.`)
}
await client.end()
