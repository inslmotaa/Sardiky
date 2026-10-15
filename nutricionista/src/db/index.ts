import 'server-only'
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleLite } from 'drizzle-orm/pglite'
import * as schema from './schema'
import { createConnection } from './connection'

type Db = ReturnType<typeof drizzlePg<typeof schema>>

const globalForDb = globalThis as unknown as { __db?: Db }

function create(): Db {
  const conn = createConnection()
  if (conn.kind === 'postgres') return drizzlePg(conn.client, { schema })
  // O PGlite tem a mesma API de consultas; o cast unifica os tipos.
  return drizzleLite(conn.client, { schema }) as unknown as Db
}

/** Conexão única por processo (evita abrir várias durante o hot reload). */
export const db: Db = globalForDb.__db ?? (globalForDb.__db = create())
export { schema }
