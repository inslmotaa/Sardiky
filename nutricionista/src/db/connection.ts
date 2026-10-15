import postgres from 'postgres'
import { PGlite } from '@electric-sql/pglite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { localDataDir } from '../lib/data-dir'

export type Connection =
  | { kind: 'postgres'; client: ReturnType<typeof postgres> }
  | { kind: 'pglite'; client: PGlite }

/**
 * Com DATABASE_URL usa PostgreSQL de verdade (produção).
 * Sem ela, usa PGlite (PostgreSQL embutido) em ~/.consultorio-nutri/pglite para desenvolvimento.
 */
export function createConnection(): Connection {
  const url = process.env.DATABASE_URL
  if (url) {
    return { kind: 'postgres', client: postgres(url, { max: 10, prepare: false }) }
  }
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PGLITE) {
    throw new Error('DATABASE_URL não definida. Em produção, configure um PostgreSQL.')
  }
  const dir = path.resolve(process.env.PGLITE_DIR ?? localDataDir('pglite'))
  mkdirSync(dir, { recursive: true })
  return { kind: 'pglite', client: new PGlite(dir) }
}
