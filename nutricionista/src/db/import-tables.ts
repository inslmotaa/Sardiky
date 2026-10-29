/**
 * Ponte entre o banco (postgres-js ou PGlite) e o importador das tabelas de alimentos
 * (scripts/tabelas/importar.mjs: TACO 4ª ed. completa + medidas caseiras do IBGE).
 */
import { eq, inArray, or } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/postgres-js'
import type { Connection } from './connection'
import * as s from './schema'
import { TACO_FOODS } from './foods-taco'
import tacoData from './data/taco-4ed.json'
import { importarMedidas, importarTaco, type Query } from '../../scripts/tabelas/importar.mjs'

type DB = ReturnType<typeof drizzle<typeof s>>

export function queryFor(conn: Connection): Query {
  return conn.kind === 'postgres'
    ? (text, params = []) => conn.client.unsafe(text, params as never[]) as unknown as Promise<Record<string, unknown>[]>
    : async (text, params = []) => (await conn.client.query<Record<string, unknown>>(text, params)).rows
}

/** Importa as duas tabelas e devolve os alimentos iniciais pelo nome curto (usado no seed). */
export async function importTables(conn: Connection, db: DB) {
  const query = queryFor(conn)
  const taco = await importarTaco(query)
  const measures = await importarMedidas(query)
  const codes = new Map((tacoData as { code: number; name: string }[]).map((t) => [t.name, t.code]))
  const tacoCodes = TACO_FOODS.filter((f) => f.taco).map((f) => codes.get(f.taco!)!)
  const rows = await db
    .select()
    .from(s.foods)
    .where(or(inArray(s.foods.code, tacoCodes), eq(s.foods.source, 'Complementar')))
  const byCuratedName = new Map<string, typeof s.foods.$inferSelect>()
  for (const f of TACO_FOODS) {
    const row = f.taco ? rows.find((r) => r.code === codes.get(f.taco!)) : rows.find((r) => r.name === f.name && r.source === 'Complementar')
    if (row) byCuratedName.set(f.name, row)
  }
  return { ...taco, measures, byCuratedName }
}
