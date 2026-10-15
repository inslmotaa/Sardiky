// Aplica as migrações em produção (PostgreSQL via DATABASE_URL), sem dependências de build.
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida.')
  process.exit(1)
}
const client = postgres(process.env.DATABASE_URL, { max: 1 })
await migrate(drizzle(client), { migrationsFolder: './drizzle' })
await client.end()
console.log('Migrações aplicadas.')
