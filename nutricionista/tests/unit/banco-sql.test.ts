import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { precisaImportar, type Query } from '../../scripts/tabelas/importar.mjs'

/** Colunas de todas as tabelas do esquema public (nome, tipo, nulo e padrão), para comparar dois bancos. */
async function shape(pg: PGlite) {
  const { rows } = await pg.query<Record<string, unknown>>(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, column_name`,
  )
  return rows
}

describe('banco de dados em SQL (deploy/banco-de-dados.sql e deploy/alimentos.sql)', () => {
  it('cria o mesmo banco que as migrações, com a base de alimentos, e o sistema reconhece as migrações', async () => {
    const fromSql = new PGlite()
    await fromSql.exec(readFileSync('deploy/banco-de-dados.sql', 'utf8'))
    await fromSql.exec(readFileSync('deploy/alimentos.sql', 'utf8'))

    const fromMigrations = new PGlite()
    await migrate(drizzle(fromMigrations), { migrationsFolder: './drizzle' })
    expect(await shape(fromSql)).toEqual(await shape(fromMigrations))

    // Ao subir, o sistema não tenta recriar nada (as migrações já estão registradas)…
    await migrate(drizzle(fromSql), { migrationsFolder: './drizzle' })
    const { rows } = await fromSql.query<{ n: number }>('SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations')
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as { entries: unknown[] }
    expect(rows[0].n).toBe(journal.entries.length)

    // …e a base de alimentos já está completa (TACO 4ª ed. + medidas do IBGE).
    const query: Query = async (text, params = []) => (await fromSql.query<Record<string, unknown>>(text, params)).rows
    expect(await precisaImportar(query)).toBe(false)
    const [{ n: foods }] = await query("SELECT count(*)::int AS n FROM foods WHERE source = 'TACO'")
    expect(foods).toBe(597)
    const [arroz] = await query("SELECT kcal FROM foods WHERE name = 'Arroz, tipo 1, cozido'")
    expect(Number(arroz.kcal)).toBe(128)

    // Rodar alimentos.sql de novo não duplica nada.
    await fromSql.exec(readFileSync('deploy/alimentos.sql', 'utf8'))
    const [{ n: again }] = await query("SELECT count(*)::int AS n FROM foods WHERE source = 'TACO'")
    expect(again).toBe(597)
    await fromSql.close()
    await fromMigrations.close()
  }, 180_000)
})
