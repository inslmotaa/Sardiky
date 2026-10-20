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

function instance(): Db {
  return globalForDb.__db ?? (globalForDb.__db = create())
}

/**
 * Conexão única por processo, aberta só no primeiro uso. Assim o `next build`
 * funciona sem banco configurado, e o hot reload não abre conexões repetidas.
 */
export const db = new Proxy({} as Db, {
  get(_, prop) {
    const target = instance()
    const value = Reflect.get(target, prop, target)
    return typeof value === 'function' ? value.bind(target) : value
  },
})
export { schema }
