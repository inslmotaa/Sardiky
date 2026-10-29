import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { importarMedidas, importarTaco, precisaImportar, type Query } from '../../scripts/tabelas/importar.mjs'

describe('importador das tabelas de alimentos (instalação nova)', () => {
  it('carrega a TACO e as medidas do IBGE num banco vazio e pode rodar de novo sem duplicar', async () => {
    const pg = new PGlite()
    await migrate(drizzle(pg), { migrationsFolder: './drizzle' })
    const query: Query = async (text, params = []) => (await pg.query<Record<string, unknown>>(text, params)).rows

    expect(await precisaImportar(query)).toBe(true)
    expect(await importarTaco(query)).toEqual({ inserted: 600, updated: 0 })
    expect(await importarMedidas(query)).toBeGreaterThan(7000)
    expect(await precisaImportar(query)).toBe(false)

    // Ajustes do painel sobrevivem à reimportação.
    await query("UPDATE foods SET cooking_factor = 3 WHERE name = 'Arroz, tipo 1, cozido'")
    expect(await importarTaco(query)).toEqual({ inserted: 0, updated: 597 })
    const [arroz] = await query("SELECT kcal, cooking_factor, active FROM foods WHERE name = 'Arroz, tipo 1, cozido'")
    expect(Number(arroz.kcal)).toBe(128)
    expect(Number(arroz.cooking_factor)).toBe(3)
    const [{ n }] = await query('SELECT count(*)::int AS n FROM foods')
    expect(n).toBe(600)
    const [leite] = await query("SELECT active FROM foods WHERE name = 'Leite, de vaca, integral'")
    expect(leite.active).toBe(false)
    await pg.close()
  }, 120_000)
})
