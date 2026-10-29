import Link from 'next/link'
import { asc, count } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { FOOD_GROUPS, fmt, searchFoods } from '@/lib/nutricao'
import { createFood } from '@/actions/admin/nutrition'
import { IBGE_CITATION, SOURCE_LABEL, TACO_CITATION } from '@/lib/tabela-nutricional'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { NoAccess, PageHead, Empty } from '@/components/ui'

const SOURCES = ['TACO', 'Complementar', 'proprio'] as const
const LIMIT = 80

/** Base de alimentos: TACO 4ª ed. completa, itens complementares e alimentos próprios (rótulos). */
export default async function FoodsPage({ searchParams }: { searchParams: Promise<{ q?: string; grupo?: string; fonte?: string }> }) {
  const sp = await searchParams
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  const q = (sp.q ?? '').slice(0, 80)
  const group = sp.grupo && sp.grupo in FOOD_GROUPS ? sp.grupo : ''
  const source = (SOURCES as readonly string[]).includes(sp.fonte ?? '') ? sp.fonte! : ''
  const all = await db.select().from(schema.foods).orderBy(asc(schema.foods.name))
  const filtered = (q ? searchFoods(all, q, 400) : all).filter((f) => (!group || f.group === group) && (!source || f.source === source))
  const shown = filtered.slice(0, LIMIT)
  const counts = await db
    .select({ foodId: schema.householdMeasures.foodId, n: count() })
    .from(schema.householdMeasures)
    .groupBy(schema.householdMeasures.foodId)
  const measureCount = new Map(counts.map((c) => [c.foodId, c.n]))
  const bySource = (k: string) => all.filter((f) => f.source === k).length

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead
        title="Alimentos"
        subtitle={`${all.length} alimentos · ${bySource('TACO')} da TACO 4ª ed., ${bySource('Complementar')} complementares e ${bySource('proprio')} próprios. Valores por 100 g.`}
      />
      <form className="card row" method="get" role="search">
        <label className="field" style={{ flex: '2 1 220px' }}>
          <span className="field__label">Buscar</span>
          <input type="search" name="q" defaultValue={q} placeholder="Ex.: pao frances, feijao, banana" />
        </label>
        <label className="field" style={{ flex: '1 1 170px' }}>
          <span className="field__label">Grupo</span>
          <select name="grupo" defaultValue={group}>
            <option value="">Todos</option>
            {Object.entries(FOOD_GROUPS)
              .filter(([k]) => k !== 'receitas')
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </label>
        <label className="field" style={{ flex: '1 1 150px' }}>
          <span className="field__label">Fonte</span>
          <select name="fonte" defaultValue={source}>
            <option value="">Todas</option>
            {SOURCES.map((k) => (
              <option key={k} value={k}>
                {SOURCE_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>
          Filtrar
        </button>
      </form>

      {shown.length === 0 ? (
        <Empty>Nenhum alimento encontrado.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Alimentos</caption>
            <thead>
              <tr>
                <th>Alimento</th>
                <th>Grupo</th>
                <th className="num">kcal</th>
                <th className="num">Prot.</th>
                <th className="num">Carb.</th>
                <th className="num">Gord.</th>
                <th className="num">Fibra</th>
                <th className="num">Medidas</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => (
                <tr key={f.id} style={f.active ? undefined : { opacity: 0.6 }}>
                  <td>
                    <Link href={`/admin/alimentos/${f.id}`}>
                      <strong>{f.name}</strong>
                    </Link>
                    <div className="small row" style={{ gap: 6 }}>
                      <span className={`badge ${f.source === 'proprio' ? 'badge--brand' : 'badge--plain'}`}>
                        {SOURCE_LABEL[f.source] ?? f.source}
                        {f.code ? ` · nº ${f.code}` : ''}
                      </span>
                      {!f.active && (
                        <span className="badge badge--warn">
                          {f.source === 'TACO' && f.nutrients.kcal == null ? 'Sem energia na TACO' : 'Inativo'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="small">{FOOD_GROUPS[f.group] ?? f.group}</td>
                  <td className="num">{fmt(f.kcal, 0)}</td>
                  <td className="num">{fmt(f.protein)}</td>
                  <td className="num">{fmt(f.carbs)}</td>
                  <td className="num">{fmt(f.fat)}</td>
                  <td className="num">{fmt(f.fiber)}</td>
                  <td className="num">{measureCount.get(f.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > LIMIT && (
        <p className="small muted" style={{ margin: 0 }}>
          Mostrando {LIMIT} de {filtered.length}. Use a busca ou os filtros para encontrar outros alimentos.
        </p>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        Fontes: {TACO_CITATION} Medidas caseiras de referência: {IBGE_CITATION}
      </p>

      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Cadastrar alimento próprio (rótulo nutricional)</h2>
        <ActionForm action={createFood} className="stack" resetOnSuccess>
          <div className="form-grid">
            <Field label="Nome" name="name" required>
              <input type="text" name="name" maxLength={160} placeholder="Ex.: Pão de queijo da marca X" />
            </Field>
            <Field label="Grupo" name="group">
              <select name="group" defaultValue="outros">
                {Object.entries(FOOD_GROUPS)
                  .filter(([k]) => k !== 'receitas')
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Valores por 100 g (se o rótulo informa por porção, divida pelo peso da porção e multiplique por 100).
          </p>
          <div className="form-grid form-grid--3">
            {[
              ['kcal', 'Calorias (kcal)'],
              ['protein', 'Proteína (g)'],
              ['carbs', 'Carboidrato (g)'],
              ['fat', 'Gordura (g)'],
              ['fiber', 'Fibra (g)'],
              ['sodium', 'Sódio (mg)'],
            ].map(([k, label]) => (
              <Field key={k} label={label} name={k}>
                <input type="text" name={k} inputMode="decimal" />
              </Field>
            ))}
          </div>
          <div className="form-grid form-grid--3">
            <Field label="Medida caseira (opcional)" name="measureName">
              <input type="text" name="measureName" placeholder="Ex.: unidade" />
            </Field>
            <Field label="Gramas da medida" name="measureGrams">
              <input type="text" name="measureGrams" inputMode="decimal" />
            </Field>
            <Field label="Fator de cocção (opcional)" name="cookingFactor" hint="Peso cozido ÷ peso cru">
              <input type="text" name="cookingFactor" inputMode="decimal" />
            </Field>
          </div>
          <div>
            <SubmitButton>Cadastrar alimento</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  )
}
