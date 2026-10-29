import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq, like } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { FOOD_GROUPS, fmt, normalize } from '@/lib/nutricao'
import { fmtNutrient, IBGE_CITATION, NUTRIENT_SECTIONS, nutrientIn, SOURCE_LABEL, TACO_CITATION, TACO_NUTRIENTS } from '@/lib/tabela-nutricional'
import { addMeasure, deleteMeasure, updateCookingFactor } from '@/actions/admin/nutrition'
import { ActionForm, SubmitButton } from '@/components/form'
import { Empty, NoAccess, PageHead } from '@/components/ui'

type SP = Promise<{ g?: string; ibge?: string }>

/** Ficha de um alimento: tabela nutricional completa, porção, medidas caseiras e sugestões do IBGE. */
export default async function FoodPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  if (!z.uuid().safeParse(id).success) notFound()
  const [food] = await db.select().from(schema.foods).where(eq(schema.foods.id, id))
  if (!food) notFound()
  const measures = await db
    .select()
    .from(schema.householdMeasures)
    .where(eq(schema.householdMeasures.foodId, id))
    .orderBy(asc(schema.householdMeasures.grams))

  const grams = Math.min(2000, Math.max(1, Number(String(sp.g ?? '').replace(',', '.')) || 100))
  const table =
    food.source === 'TACO'
      ? food.nutrients
      : { ...food.nutrients, kcal: food.kcal, proteina: food.protein, carboidrato: food.carbs, lipideos: food.fat, fibra: food.fiber }
  const keys = TACO_NUTRIENTS.filter((n) => food.source === 'TACO' || table[n.key] !== undefined)

  // Sugestões do IBGE: pelo começo do nome (ex.: "Arroz, tipo 1, cozido" → "arroz") ou pela busca digitada.
  const term = normalize((sp.ibge ?? food.name.split(/[,(]/)[0]).slice(0, 60)).trim()
  const refs = term
    ? await db
        .select()
        .from(schema.measureRefs)
        .where(like(schema.measureRefs.search, `${term}%`))
        .orderBy(asc(schema.measureRefs.food), asc(schema.measureRefs.preparation), asc(schema.measureRefs.grams))
        .limit(80)
    : []
  const incomplete = food.source === 'TACO' && food.nutrients.kcal == null

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead
        title={food.name}
        crumbs={[{ href: '/admin/alimentos', label: 'Alimentos' }]}
        subtitle={[SOURCE_LABEL[food.source] ?? food.source, food.code ? `nº ${food.code}` : null, food.category ?? FOOD_GROUPS[food.group]]
          .filter(Boolean)
          .join(' · ')}
      />
      {incomplete && (
        <p className="alert alert--warn">
          A TACO não traz energia nem macronutrientes analisados para este alimento. Ele fica inativo e fora dos cálculos; use um item complementar ou
          cadastre um alimento próprio pelo rótulo.
        </p>
      )}
      {food.source === 'Complementar' && (
        <p className="alert alert--info">Item comum que a TACO não analisa: valores de referência a conferir antes do uso.</p>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card stack" aria-labelledby="tabela-titulo">
          <div className="card__head">
            <h2 id="tabela-titulo">Tabela nutricional</h2>
            <form method="get" className="row" style={{ gap: 6 }}>
              <label className="sr-only" htmlFor="porcao">
                Porção em gramas
              </label>
              <select id="porcao" name="g" defaultValue={String(grams)} style={{ width: 'auto' }}>
                <option value="100">100 g</option>
                {measures.map((m) => (
                  <option key={m.id} value={String(m.grams)}>
                    {m.name} ({fmt(m.grams, 1)} g)
                  </option>
                ))}
                {![100, ...measures.map((m) => m.grams)].includes(grams) && <option value={String(grams)}>{fmt(grams, 1)} g</option>}
              </select>
              <button className="btn btn--sm" type="submit">
                Ver
              </button>
            </form>
          </div>
          <div className="table-wrap">
            <table className="nutri-table">
              <thead>
                <tr>
                  <th>Nutriente</th>
                  <th className="num">100 g</th>
                  {grams !== 100 && <th className="num">{fmt(grams, 1)} g</th>}
                </tr>
              </thead>
              {(Object.keys(NUTRIENT_SECTIONS) as (keyof typeof NUTRIENT_SECTIONS)[]).map((sec) => {
                const rows = keys.filter((n) => n.section === sec)
                if (!rows.length) return null
                return (
                  <tbody key={sec}>
                    <tr className="nutri-table__section">
                      <th colSpan={grams !== 100 ? 3 : 2} scope="colgroup">
                        {NUTRIENT_SECTIONS[sec]}
                      </th>
                    </tr>
                    {rows.map((n) => {
                      const portion = nutrientIn(table, n.key, grams)
                      return (
                        <tr key={n.key}>
                          <th scope="row">
                            {n.label} <span className="muted">({n.unit})</span>
                          </th>
                          <td className="num">{fmtNutrient(table[n.key], n.digits)}</td>
                          {grams !== 100 && (
                            <td className="num">
                              {table[n.key] === 'Tr' || table[n.key] === 'NA' ? table[n.key] : portion == null ? '—' : fmt(portion, n.digits)}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                )
              })}
            </table>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Tr = traços (quantidade muito pequena) · NA = não se aplica · — = não analisado.{' '}
            {food.source === 'TACO' ? `Fonte: ${TACO_CITATION}` : food.source === 'proprio' ? 'Fonte: rótulo cadastrado pela equipe.' : ''}
          </p>
        </section>

        <div className="stack">
          <section className="card stack" aria-labelledby="medidas-titulo">
            <h2 id="medidas-titulo" style={{ margin: 0, fontSize: '1.2rem' }}>
              Medidas caseiras
            </h2>
            {measures.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                Nenhuma medida cadastrada. Adicione abaixo ou use uma sugestão do IBGE.
              </p>
            ) : (
              <ul className="list">
                {measures.map((m) => (
                  <li key={m.id} className="row row--between">
                    <span>
                      {m.name} · <strong>{fmt(m.grams, 1)} g</strong>
                    </span>
                    <form action={deleteMeasure.bind(null, food.id, m.id)}>
                      <button className="link-btn small" type="submit" aria-label={`Remover medida ${m.name}`}>
                        remover
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addMeasure.bind(null, food.id)} className="row" resetOnSuccess>
              <input type="text" name="name" placeholder="Medida (ex.: concha)" aria-label="Nome da medida" style={{ flex: '2 1 140px' }} />
              <input type="text" name="grams" inputMode="decimal" placeholder="g" aria-label="Gramas" style={{ flex: '0 1 80px' }} />
              <SubmitButton className="btn btn--sm">Adicionar</SubmitButton>
            </ActionForm>
            <ActionForm action={updateCookingFactor.bind(null, food.id)} className="row">
              <input
                type="text"
                name="cookingFactor"
                inputMode="decimal"
                defaultValue={food.cookingFactor != null ? String(food.cookingFactor).replace('.', ',') : ''}
                placeholder="Fator de cocção"
                aria-label="Fator de cocção (peso cozido ÷ peso cru)"
                style={{ flex: '1 1 140px' }}
              />
              <label className="check">
                <input type="checkbox" name="active" defaultChecked={food.active} disabled={incomplete} /> Ativo nos planos
              </label>
              <SubmitButton className="btn btn--sm">Salvar</SubmitButton>
            </ActionForm>
          </section>

          <section className="card stack" aria-labelledby="ibge-titulo">
            <div className="card__head">
              <h2 id="ibge-titulo">Sugestões do IBGE</h2>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              Medidas caseiras referidas na POF 2008-2009. Confira se o alimento e o preparo correspondem antes de adicionar.
            </p>
            <form method="get" className="row" role="search">
              {grams !== 100 && <input type="hidden" name="g" value={String(grams)} />}
              <input type="search" name="ibge" defaultValue={term} aria-label="Buscar na tabela de medidas do IBGE" style={{ flex: '1 1 160px' }} />
              <button className="btn btn--sm" type="submit">
                Buscar
              </button>
            </form>
            {refs.length === 0 ? (
              <Empty>Nada encontrado para “{term}”. Tente outra palavra (ex.: o nome do alimento sem o preparo).</Empty>
            ) : (
              <ul className="list ibge-list">
                {refs.map((r) => (
                  <li key={r.id} className="row row--between">
                    <span className="small">
                      <strong>{r.measure.toLocaleLowerCase('pt-BR')}</strong> · {fmt(r.grams, 1)} g
                      <span className="muted">
                        {' '}
                        — {r.food.toLocaleLowerCase('pt-BR')}
                        {r.preparation ? `, ${r.preparation.toLocaleLowerCase('pt-BR')}` : ''}
                      </span>
                    </span>
                    <ActionForm action={addMeasure.bind(null, food.id)} className="row">
                      <input type="hidden" name="name" value={r.measure.toLocaleLowerCase('pt-BR')} />
                      <input type="hidden" name="grams" value={String(r.grams).replace('.', ',')} />
                      <SubmitButton className="btn btn--sm">Usar</SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted" style={{ margin: 0 }}>
              Fonte: {IBGE_CITATION}
            </p>
          </section>
        </div>
      </div>
      <p className="small">
        <Link href="/admin/alimentos">← Voltar para Alimentos</Link>
      </p>
    </div>
  )
}
