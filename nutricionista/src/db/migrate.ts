import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator'
import { drizzle as drizzleLite } from 'drizzle-orm/pglite'
import { migrate as migrateLite } from 'drizzle-orm/pglite/migrator'
import { createConnection } from './connection'
import { loadEnv } from './env'

loadEnv()
const conn = createConnection()
const migrationsFolder = './drizzle'

if (conn.kind === 'postgres') {
  await migratePg(drizzlePg(conn.client), { migrationsFolder })
  await conn.client.end()
} else {
  await migrateLite(drizzleLite(conn.client), { migrationsFolder })
  await conn.client.close()
}
console.log('Migrações aplicadas.')
