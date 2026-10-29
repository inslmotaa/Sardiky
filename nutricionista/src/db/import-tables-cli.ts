/**
 * Importa ou atualiza a TACO 4ª ed. completa e as medidas caseiras do IBGE no banco configurado.
 * Uso: npm run db:tabelas   (em produção isso já acontece sozinho ao subir o sistema)
 */
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleLite } from 'drizzle-orm/pglite'
import { createConnection } from './connection'
import { loadEnv } from './env'
import * as s from './schema'
import { importTables } from './import-tables'

loadEnv()
const conn = createConnection()
const db = (conn.kind === 'postgres' ? drizzlePg(conn.client, { schema: s }) : drizzleLite(conn.client, { schema: s })) as ReturnType<
  typeof drizzlePg<typeof s>
>

const r = await importTables(conn, db)
console.log(`TACO 4ª ed.: ${r.inserted} alimento(s) novo(s), ${r.updated} atualizado(s).`)
console.log(`Medidas caseiras de referência do IBGE: ${r.measures}.`)
if (conn.kind === 'postgres') await conn.client.end()
else await conn.client.close()
