import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator'
import { drizzle as drizzleLite } from 'drizzle-orm/pglite'
import { migrate as migrateLite } from 'drizzle-orm/pglite/migrator'
import { createConnection } from './connection'
import { loadEnv } from './env'
import { queryFor } from './import-tables'
import { importarMedidas, importarTaco, precisaImportar } from '../../scripts/tabelas/importar.mjs'

loadEnv()
const conn = createConnection()
const migrationsFolder = './drizzle'

if (conn.kind === 'postgres') await migratePg(drizzlePg(conn.client), { migrationsFolder })
else await migrateLite(drizzleLite(conn.client), { migrationsFolder })
console.log('Migrações aplicadas.')

// Base de alimentos completa por padrão (TACO 4ª ed., 597 itens + medidas do IBGE), como em produção
// (scripts/migrate.mjs): só importa quando ainda falta.
const query = queryFor(conn)
if (await precisaImportar(query)) {
  const taco = await importarTaco(query)
  const medidas = await importarMedidas(query)
  console.log(`Tabelas de alimentos: TACO ${taco.inserted} novo(s) e ${taco.updated} atualizado(s); ${medidas} medidas do IBGE.`)
}

if (conn.kind === 'postgres') await conn.client.end()
else await conn.client.close()
