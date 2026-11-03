// Gera o banco de dados em SQL puro (PostgreSQL), a partir do esquema do sistema (src/db/schema.ts):
//   deploy/banco-de-dados.sql  — todas as tabelas, tipos, índices e chaves, mais o registro das migrações
//                                (assim o sistema reconhece o banco e não tenta recriar nada ao subir);
//   deploy/alimentos.sql       — TACO 4ª ed. completa (597 alimentos) + medidas caseiras do IBGE (POF).
// Uso: node scripts/gerar-banco-sql.mjs   (rode de novo sempre que o esquema ou as tabelas mudarem)
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { importarMedidas, importarTaco } from './tabelas/importar.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const out = (f) => path.join(root, 'deploy', f)

// 1. Esquema completo, direto do código (o mesmo que as migrações produzem).
const ddl = execFileSync('npx', ['drizzle-kit', 'export', '--sql'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  .replace(/\r\n/g, '\n')
  .trim()

// 2. Registro das migrações já incluídas (mesmo cálculo do drizzle-orm: sha256 do arquivo + data do journal).
const journal = JSON.parse(readFileSync(path.join(root, 'drizzle/meta/_journal.json'), 'utf8'))
const migrations = journal.entries.map((e) => {
  const sql = readFileSync(path.join(root, 'drizzle', `${e.tag}.sql`)).toString()
  return { tag: e.tag, hash: createHash('sha256').update(sql).digest('hex'), when: e.when }
})

const header = `-- =====================================================================
-- Banco de dados do sistema (site, área do cliente e painel do coach)
-- PostgreSQL 14 ou mais novo. Arquivo gerado por scripts/gerar-banco-sql.mjs
-- a partir de src/db/schema.ts. Não edite à mão: gere de novo.
--
-- Como criar o banco do zero:
--   createdb nutri
--   psql "postgresql://USUARIO:SENHA@HOST:5432/nutri" -f deploy/banco-de-dados.sql
--   psql "postgresql://USUARIO:SENHA@HOST:5432/nutri" -f deploy/alimentos.sql
--   psql "postgresql://USUARIO:SENHA@HOST:5432/nutri" -f deploy/criar-admin.sql
--
-- Com Docker (deploy/docker-compose.yml) nada disso é necessário: ao subir,
-- o sistema cria as mesmas tabelas sozinho (migrações) e carrega os alimentos.
--
-- Tabelas principais:
--   users, sessions, auth_tokens ......... contas (cliente, coach, equipe) e login
--   patients ............................. ficha do cliente (plano contratado, recursos do app)
--   anamneses ............................ anamnese no app (versões e rascunho)
--   appointments, services, working_hours  agenda e consultas on-line
--   meal_plans ........................... planos alimentares (rascunho, publicado, histórico)
--   meal_logs, water_logs, diary_entries . o que o cliente marca e registra no dia
--   measurements, progress_photos, goals . avaliações, fotos de evolução e metas
--   files ................................ arquivos privados (exames, fotos, documentos)
--   foods, household_measures, measure_refs  TACO 4ª ed. e medidas caseiras do IBGE
--   messages, notifications, push_subscriptions  chat e avisos
--   packages, payments ................... planos de acompanhamento e financeiro
--   consents, data_requests, audit_logs .. LGPD e trilha de auditoria
--   settings ............................. configurações (nome do site, contato, textos)
-- =====================================================================
`

const tracking = `
-- Migrações já contidas neste arquivo: o sistema só aplicará as que vierem depois.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
	id SERIAL PRIMARY KEY,
	hash text NOT NULL,
	created_at bigint
);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES
${migrations.map((m, i) => `\t('${m.hash}', ${m.when})${i === migrations.length - 1 ? ';' : ','} -- ${m.tag}`).join('\n')}
`

const schemaSql = `${header}\nBEGIN;\n\n${ddl}\n${tracking}\nCOMMIT;\n`
writeFileSync(out('banco-de-dados.sql'), schemaSql)

// 3. Alimentos: aplica o esquema num banco temporário, importa as tabelas e exporta em INSERTs.
const db = new PGlite()
await db.exec(ddl)
const query = async (text, params = []) => (await db.query(text, params)).rows
await importarTaco(query)
await importarMedidas(query)

const lit = (v) => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (v instanceof Date) return `'${v.toISOString()}'`
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}
async function dump(table, order) {
  const rows = await query(`SELECT * FROM ${table} ORDER BY ${order}`)
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const parts = []
  for (let i = 0; i < rows.length; i += 250) {
    const chunk = rows.slice(i, i + 250).map((r) => `(${cols.map((c) => lit(r[c])).join(', ')})`)
    parts.push(`INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES\n${chunk.join(',\n')}\nON CONFLICT DO NOTHING;`)
  }
  return `-- ${table}: ${rows.length} linha(s)\n${parts.join('\n')}\n`
}
const foods = `-- =====================================================================
-- Base de alimentos: TACO 4ª ed. (NEPA/Unicamp, 2011) completa, itens
-- complementares e medidas caseiras de referência do IBGE (POF 2008-2009).
-- Rode depois de deploy/banco-de-dados.sql. Pode rodar de novo: o que já
-- existe é mantido (ON CONFLICT DO NOTHING).
-- Arquivo gerado por scripts/gerar-banco-sql.mjs.
-- =====================================================================

BEGIN;

${await dump('foods', 'code NULLS LAST, name')}
${await dump('household_measures', 'food_id, grams, name')}
${await dump('measure_refs', 'search, measure')}
COMMIT;
`
writeFileSync(out('alimentos.sql'), foods)
await db.close()
console.log(`deploy/banco-de-dados.sql: ${schemaSql.split('\n').length} linhas; deploy/alimentos.sql: ${(foods.length / 1024).toFixed(0)} KB`)
