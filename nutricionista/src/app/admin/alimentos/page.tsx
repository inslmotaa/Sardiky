import { asc, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { FOOD_GROUPS, fmt, searchFoods } from '@/lib/nutricao'
import { addMeasure, createFood, deleteMeasure, updateCookingFactor } from '@/actions/admin/nutrition'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { NoAccess, PageHead, Empty } from '@/components/ui'

export default async function FoodsPage({ searchParams }: { searchParams: Promise<{ q?: string; grupo?: string }> }) {
  const sp = await searchParams
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  const q = (sp.q ?? '').slice(0, 80)
  const group = sp.grupo && sp.grupo in FOOD_GROUPS ? sp.grupo : ''
  const all = await db.select().from(schema.foods).orderBy(asc(schema.foods.name))
  const filtered = (q ? searchFoods(all, q, 200) : all).filter((f) => !group || f.group === group)
  const measures = filtered.length
    ? await db.select().from(schema.householdMeasures).where(inArray(schema.householdMeasures.foodId, filtered.map((f) => f.id)))
    : []

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead title="Alimentos" subtitle={`${all.length} alimentos na base · valores por 100 g. Base inicial com referência na TACO; confira com a tabela oficial antes do uso clínico.`} />
      <form className="card row" method="get" role="search">
        <label className="field" style={{ flex: '2 1 220px' }}>
          <span className="field__label">Buscar</span>
          <input type="search" name="q" defaultValue={q} placeholder="Ex.: pao frances, feijao" />
        </label>
        <label className="field" style={{ flex: '1 1 180px' }}>
          <span className="field__label">Grupo</span>
          <select name="grupo" defaultValue={group}>
            <option value="">Todos</option>
            {Object.entries(FOOD_GROUPS).filter(([k]) => k !== 'receitas').map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>
          Filtrar
        </button>
      </form>

      {filtered.length === 0 ? (
        <Empty>Nenhum alimento encontrado.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Alimento</th>
                <th>Grupo</th>
                <th className="num">kcal</th>
                <th className="num">Prot.</th>
                <th className="num">Carb.</th>
                <th className="num">Gord.</th>
                <th className="num">Fibra</th>
                <th>Medidas caseiras e fator de cocção</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} style={f.active ? undefined : { opacity: 0.55 }}>
                  <td>
                    <strong>{f.name}</strong>
                    <div className="small">
                      <span className={`badge ${f.source === 'proprio' ? 'badge--brand' : 'badge--plain'}`}>{f.source === 'proprio' ? 'Próprio' : f.source}</span>
                      {!f.active && <span className="badge badge--warn">Inativo</span>}
                    </div>
                  </td>
                  <td className="small">{FOOD_GROUPS[f.group] ?? f.group}</td>
                  <td className="num">{fmt(f.kcal, 0)}</td>
                  <td className="num">{fmt(f.protein)}</td>
                  <td className="num">{fmt(f.carbs)}</td>
                  <td className="num">{fmt(f.fat)}</td>
                  <td className="num">{fmt(f.fiber)}</td>
                  <td className="small">
                    {measures
                      .filter((m) => m.foodId === f.id)
                      .map((m) => (
                        <div key={m.id} className="row" style={{ gap: 6 }}>
                          {m.name}: {fmt(m.grams, 0)} g
                          <form action={deleteMeasure.bind(null, f.id, m.id)}>
                            <button className="link-btn" type="submit" aria-label={`Remover medida ${m.name}`}>
                              remover
                            </button>
                          </form>
                        </div>
                      ))}
                    <details style={{ marginTop: 4 }}>
                      <summary className="link-btn">Editar</summary>
                      <ActionForm action={addMeasure.bind(null, f.id)} className="row" resetOnSuccess>
                        <input type="text" name="name" placeholder="Medida (ex.: concha)" aria-label="Nome da medida" style={{ width: 150 }} />
                        <input type="text" name="grams" inputMode="decimal" placeholder="g" aria-label="Gramas" style={{ width: 70 }} />
                        <SubmitButton className="btn btn--sm">Adicionar</SubmitButton>
                      </ActionForm>
                      <ActionForm action={updateCookingFactor.bind(null, f.id)} className="row">
                        <input
                          type="text"
                          name="cookingFactor"
                          inputMode="decimal"
                          defaultValue={f.cookingFactor != null ? String(f.cookingFactor).replace('.', ',') : ''}
                          placeholder="Fator de cocção"
                          aria-label="Fator de cocção (cozido ÷ cru)"
                          style={{ width: 130 }}
                        />
                        <label className="check">
                          <input type="checkbox" name="active" defaultChecked={f.active} /> Ativo
                        </label>
                        <SubmitButton className="btn btn--sm">Salvar</SubmitButton>
                      </ActionForm>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Cadastrar alimento próprio (rótulo nutricional)</h2>
        <ActionForm action={createFood} className="stack" resetOnSuccess>
          <div className="form-grid">
            <Field label="Nome" name="name" required>
              <input type="text" name="name" maxLength={160} placeholder="Ex.: Pão de queijo da marca X" />
            </Field>
            <Field label="Grupo" name="group">
              <select name="group" defaultValue="outros">
                {Object.entries(FOOD_GROUPS).filter(([k]) => k !== 'receitas').map(([k, v]) => (
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
