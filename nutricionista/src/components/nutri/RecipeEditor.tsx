'use client'

import { startTransition, useActionState, useState } from 'react'
import type { ActionState } from '@/lib/action'
import { fmt, formatMeasure, recipeNutrients, type Nutrients } from '@/lib/nutricao'
import { FoodPicker } from './FoodPicker'
import { NutriInline } from './MacroBars'

export type RecipeFood = { id: string; name: string; group: string; per100: Nutrients; measures: { name: string; grams: number }[] }
type Row = { foodId: string | null; name: string; per100: Nutrients | null; grams: string; measures: { name: string; grams: number }[] }

export const RECIPE_TAGS = ['sem glúten', 'sem lactose', 'vegana', 'vegetariana', 'low carb', 'pré-treino', 'pós-treino', 'lanche', 'café da manhã', 'congelável']

/** Editor de receita: ingredientes da base com cálculo automático por porção e por 100 g. */
export function RecipeEditor({
  action,
  foods,
  initial,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>
  foods: RecipeFood[]
  initial: {
    title: string
    ingredients: { foodId: string | null; name: string; grams: number; per100: Nutrients | null }[]
    finalWeightG: number | null
    portions: number
    prepMinutes: number | null
    instructions: string
    tags: string[]
    visibleToAll: boolean
    photoUrl: string | null
  }
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const [rows, setRows] = useState<Row[]>(() =>
    initial.ingredients.map((i) => ({ ...i, grams: String(i.grams).replace('.', ','), measures: foods.find((f) => f.id === i.foodId)?.measures ?? [] })),
  )
  const [finalWeight, setFinalWeight] = useState(initial.finalWeightG ? String(initial.finalWeightG).replace('.', ',') : '')
  const [portions, setPortions] = useState(String(initial.portions || 1))
  const [tags, setTags] = useState<string[]>(initial.tags)

  const num = (v: string) => Number(v.replace(',', '.'))
  const valid = rows.filter((r) => num(r.grams) > 0)
  const rawWeight = valid.reduce((n, r) => n + num(r.grams), 0)
  const fw = num(finalWeight) > 0 ? num(finalWeight) : rawWeight
  const pz = Math.max(1, Math.round(num(portions) || 1))
  const n = recipeNutrients(
    valid.filter((r) => r.per100).map((r) => ({ per100: r.per100!, grams: num(r.grams) })),
    fw,
    pz,
  )

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(() => formAction(fd))
      }}
    >
      <input type="hidden" name="ingredients" value={JSON.stringify(valid.map((r) => ({ foodId: r.foodId, name: r.name, grams: num(r.grams) })))} />
      <input type="hidden" name="tags" value={tags.join(',')} />
      <section className="card stack">
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Nome da receita</span>
            <input name="title" defaultValue={initial.title} maxLength={160} required />
          </label>
          <label className="field">
            <span className="field__label">Foto (opcional)</span>
            <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" />
          </label>
        </div>
        {initial.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={initial.photoUrl} alt={`Foto de ${initial.title}`} className="recipe-photo" />
        )}
        <fieldset>
          <legend>Etiquetas</legend>
          <div className="row" style={{ gap: 6 }}>
            {RECIPE_TAGS.map((t) => (
              <button key={t} type="button" className={`chip ${tags.includes(t) ? 'chip--on' : ''}`} aria-pressed={tags.includes(t)} onClick={() => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}>
                {t}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Ingredientes</h2>
        {rows.length > 0 && (
          <ul className="diary-items diary-items--edit">
            {rows.map((r, i) => (
              <li key={i}>
                <span className="diary-items__name">{r.name}</span>
                <label className="sr-only" htmlFor={`ing-${i}`}>
                  Gramas de {r.name}
                </label>
                <input id={`ing-${i}`} inputMode="decimal" value={r.grams} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))} style={{ width: 80 }} />
                <span>g</span>
                {r.measures.length > 0 && (
                  <select
                    aria-label={`Medida caseira de ${r.name}`}
                    value=""
                    onChange={(e) => {
                      const m = r.measures[Number(e.target.value)]
                      if (m) setRows((cur) => cur.map((x, j) => (j === i ? { ...x, grams: String(Math.round(m.grams)) } : x)))
                    }}
                  >
                    <option value="">medida…</option>
                    {r.measures.map((m, k) => (
                      <option key={k} value={k}>
                        {formatMeasure(1, m.name)} ({fmt(m.grams, 0)} g)
                      </option>
                    ))}
                  </select>
                )}
                {!r.per100 && <span className="small muted">sem cálculo</span>}
                <button type="button" className="link-btn small" aria-label={`Remover ${r.name}`} onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}>
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
        <FoodPicker
          foods={foods}
          label="Adicionar ingrediente"
          placeholder="Buscar ingrediente na base…"
          onPick={(f) => {
            const full = foods.find((x) => x.id === f.id)!
            setRows((cur) => [...cur, { foodId: full.id, name: full.name, per100: full.per100, grams: String(full.measures[0]?.grams ?? 100), measures: full.measures }])
          }}
          onFreeText={(text) => setRows((cur) => [...cur, { foodId: null, name: text, per100: null, grams: '10', measures: [] }])}
        />
        <div className="form-grid form-grid--3">
          <label className="field">
            <span className="field__label">Peso final pronto (g)</span>
            <input name="finalWeightG" inputMode="decimal" value={finalWeight} onChange={(e) => setFinalWeight(e.target.value)} placeholder={rawWeight ? `${fmt(rawWeight, 0)} (soma cru)` : ''} />
            <span className="field__hint">Pese depois de pronto: a água que evapora muda as calorias por 100 g.</span>
          </label>
          <label className="field">
            <span className="field__label">Rendimento (porções)</span>
            <input name="portions" inputMode="numeric" value={portions} onChange={(e) => setPortions(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Tempo de preparo (min)</span>
            <input name="prepMinutes" inputMode="numeric" defaultValue={initial.prepMinutes ?? ''} />
          </label>
        </div>
        <div className="calc-result" aria-live="polite">
          <div>
            <strong>Por porção</strong> ({fmt(fw / pz, 0)} g): {n.perPortion && <NutriInline n={n.perPortion} />}
          </div>
          <div>
            <strong>Por 100 g</strong>: {n.per100 && <NutriInline n={n.per100} />}
          </div>
          <div className="small muted">Total da receita: {fmt(n.total.kcal, 0)} kcal</div>
        </div>
      </section>

      <section className="card stack">
        <label className="field">
          <span className="field__label">Modo de preparo</span>
          <textarea name="instructions" rows={6} defaultValue={initial.instructions} maxLength={8000} placeholder={'1. …\n2. …'} />
        </label>
        <label className="check">
          <input type="checkbox" name="visibleToAll" defaultChecked={initial.visibleToAll} /> Mostrar na biblioteca de receitas de todos os pacientes
        </label>
        <p className="small muted" style={{ margin: 0 }}>
          Mesmo desmarcada, a receita aparece para o paciente quando ela está no plano alimentar dele.
        </p>
      </section>

      {state.error && (
        <p className="alert alert--error" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="alert alert--ok" role="status">
          {state.message}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar receita'}
        </button>
      </div>
    </form>
  )
}
