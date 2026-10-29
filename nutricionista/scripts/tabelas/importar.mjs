/**
 * Importador das tabelas de alimentos, em JavaScript puro (roda em produção sem build):
 *  - TACO 4ª ed. completa (597 alimentos, NEPA/Unicamp), com a tabela nutricional inteira;
 *  - medidas caseiras de referência do IBGE (POF 2008-2009).
 *
 * Usado ao subir o sistema (scripts/migrate.mjs, só quando a base ainda não está completa),
 * por `npm run db:tabelas` e pelo seed de demonstração. É seguro rodar de novo: alimentos da
 * TACO são atualizados pelo número oficial, sem perder medidas caseiras, fator de cocção nem
 * a situação (ativo/inativo) ajustados no painel.
 *
 * `query(texto, parametros)` executa SQL e devolve as linhas (postgres-js ou PGlite).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/db/data')
const read = (file) => JSON.parse(readFileSync(path.join(DATA, file), 'utf8'))

/** Igual a normalize() de src/lib/nutricao: sem acentos, minúsculas, só letras e números. */
export function normalizar(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const num = (v) => (typeof v === 'number' ? v : 0)
const sodio = (v) => (typeof v === 'number' ? v : v === 'Tr' || v === 'NA' ? 0 : null)

async function insertMeasures(query, foodId, measures) {
  for (const [name, grams] of measures) {
    await query('INSERT INTO household_measures (food_id, name, grams) VALUES ($1, $2, $3)', [foodId, name, grams])
  }
}

export async function importarTaco(query) {
  const taco = read('taco-4ed.json')
  const iniciais = read('alimentos-iniciais.json')
  const inicialPorTaco = new Map(iniciais.filter((f) => f.taco).map((f) => [f.taco, f]))
  let inserted = 0
  let updated = 0

  // Bases antigas: os alimentos iniciais tinham nome simplificado e nenhum número da TACO.
  for (const f of iniciais.filter((x) => x.taco)) {
    const row = taco.find((t) => t.name === f.taco)
    if (row) await query("UPDATE foods SET code = $1 WHERE code IS NULL AND source = 'TACO' AND name = $2", [row.code, f.name])
  }

  const existing = await query("SELECT id, code FROM foods WHERE source = 'TACO' AND code IS NOT NULL")
  const byCode = new Map(existing.map((r) => [Number(r.code), r.id]))
  for (const t of taco) {
    const n = t.n
    const values = [
      t.name,
      normalizar(t.name),
      t.category,
      JSON.stringify(n),
      num(n.kcal),
      num(n.proteina),
      num(n.carboidrato),
      num(n.lipideos),
      num(n.fibra),
      sodio(n.sodio),
    ]
    const id = byCode.get(t.code)
    if (id) {
      await query(
        'UPDATE foods SET name = $1, search = $2, category = $3, nutrients = $4::jsonb, kcal = $5, protein = $6, carbs = $7, fat = $8, fiber = $9, sodium = $10 WHERE id = $11',
        [...values, id],
      )
      updated++
      continue
    }
    const inicial = inicialPorTaco.get(t.name)
    const [row] = await query(
      `INSERT INTO foods (name, search, category, nutrients, kcal, protein, carbs, fat, fiber, sodium, source, code, "group", cooking_factor, active)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, 'TACO', $11, $12, $13, $14) RETURNING id`,
      // Sem energia analisada na TACO (ex.: leite líquido): fica inativo, fora dos cálculos.
      [...values, t.code, inicial?.group ?? t.group, inicial?.cookingFactor ?? null, n.kcal != null],
    )
    if (inicial) await insertMeasures(query, row.id, inicial.measures)
    inserted++
  }

  // Itens comuns que a TACO não analisa (ex.: leite líquido): valores de referência, a conferir.
  for (const f of iniciais.filter((x) => !x.taco)) {
    const [found] = await query("SELECT id FROM foods WHERE name = $1 AND (source = 'Complementar' OR code IS NULL) LIMIT 1", [f.name])
    if (found) {
      await query("UPDATE foods SET source = 'Complementar' WHERE id = $1", [found.id])
      continue
    }
    const nutrients = { kcal: f.kcal, proteina: f.protein, carboidrato: f.carbs, lipideos: f.fat, fibra: f.fiber, sodio: f.sodium ?? null }
    const [row] = await query(
      `INSERT INTO foods (name, search, "group", source, kcal, protein, carbs, fat, fiber, sodium, cooking_factor, nutrients)
       VALUES ($1, $2, $3, 'Complementar', $4, $5, $6, $7, $8, $9, $10, $11::jsonb) RETURNING id`,
      [
        f.name,
        normalizar(f.name),
        f.group,
        f.kcal,
        f.protein,
        f.carbs,
        f.fat,
        f.fiber,
        f.sodium ?? null,
        f.cookingFactor ?? null,
        JSON.stringify(nutrients),
      ],
    )
    await insertMeasures(query, row.id, f.measures)
    inserted++
  }
  return { inserted, updated }
}

/** Recarrega as medidas caseiras de referência do IBGE (substitui a lista anterior). */
export async function importarMedidas(query) {
  const medidas = read('ibge-medidas.json')
  await query('DELETE FROM measure_refs')
  for (let i = 0; i < medidas.length; i += 500) {
    const chunk = medidas.slice(i, i + 500)
    const params = []
    const rows = chunk.map(([food, preparation, measure, grams], j) => {
      params.push(food, preparation, measure, grams, normalizar(`${food} ${preparation}`))
      const b = j * 5
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`
    })
    await query(`INSERT INTO measure_refs (food, preparation, measure, grams, search) VALUES ${rows.join(', ')}`, params)
  }
  return medidas.length
}

/** A base precisa ser (re)importada? Compara com o tamanho das tabelas incluídas no sistema. */
export async function precisaImportar(query) {
  const taco = read('taco-4ed.json').length
  const medidas = read('ibge-medidas.json').length
  const [{ n: foods }] = await query("SELECT count(*)::int AS n FROM foods WHERE source = 'TACO' AND code IS NOT NULL")
  const [{ n: refs }] = await query('SELECT count(*)::int AS n FROM measure_refs')
  return Number(foods) < taco || Number(refs) !== medidas
}
