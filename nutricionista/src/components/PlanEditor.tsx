'use client'

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from 'react'
import type { ActionState } from '@/lib/action'
import type { PlanContent, PlanItem, PlanMeal } from '@/lib/plan'

const uid = () => Math.random().toString(36).slice(2, 10)

const COMMON_FOODS = [
  'Arroz branco', 'Arroz integral', 'Feijão carioca', 'Feijão preto', 'Lentilha', 'Grão-de-bico', 'Batata-doce', 'Batata inglesa',
  'Mandioca', 'Macarrão integral', 'Pão integral', 'Pão francês', 'Tapioca', 'Cuscuz de milho', 'Aveia em flocos', 'Granola sem açúcar',
  'Ovo cozido', 'Ovo mexido', 'Frango grelhado', 'Peixe assado', 'Carne magra', 'Carne moída magra', 'Queijo branco', 'Queijo cottage',
  'Iogurte natural', 'Leite desnatado', 'Banana', 'Maçã', 'Mamão', 'Laranja', 'Morango', 'Melancia', 'Abacate', 'Salada de folhas',
  'Legumes cozidos', 'Brócolis', 'Cenoura', 'Tomate', 'Azeite de oliva', 'Castanha-do-pará', 'Pasta de amendoim', 'Chia', 'Café sem açúcar',
]

const MEAL_PRESETS: [string, string][] = [
  ['Café da manhã', '07:00'],
  ['Lanche da manhã', '10:00'],
  ['Almoço', '12:30'],
  ['Lanche da tarde', '16:00'],
  ['Jantar', '19:30'],
  ['Ceia', '21:30'],
]

type Props = {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>
  initial: PlanContent
  title: string
  validFrom: string | null
  validUntil: string | null
  isTemplate: boolean
}

/** Editor do plano alimentar (somente rascunhos). O conteúdo é validado novamente no servidor. */
export function PlanEditor({ action, initial, title: initialTitle, validFrom, validUntil, isTemplate }: Props) {
  const [content, setContent] = useState<PlanContent>(initial)
  const [title, setTitle] = useState(initialTitle)
  const [dirty, setDirty] = useState(false)
  const [state, formAction, pending] = useActionState(action, {})
  const formRef = useRef<HTMLFormElement>(null)
  const json = useMemo(() => JSON.stringify(content), [content])

  useEffect(() => {
    if (state.ok) setDirty(false)
  }, [state])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const update = (fn: (c: PlanContent) => PlanContent) => {
    setContent((c) => fn(structuredClone(c)))
    setDirty(true)
  }
  const updateMeal = (mi: number, patch: Partial<PlanMeal>) => update((c) => ((c.meals[mi] = { ...c.meals[mi], ...patch }), c))
  const updateItem = (mi: number, ii: number, patch: Partial<PlanItem>) =>
    update((c) => ((c.meals[mi].items[ii] = { ...c.meals[mi].items[ii], ...patch }), c))
  const move = <T,>(arr: T[], from: number, to: number) => {
    if (to < 0 || to >= arr.length) return arr
    const [x] = arr.splice(from, 1)
    arr.splice(to, 0, x)
    return arr
  }
  const addMeal = (name = '', time = '') =>
    update((c) => (c.meals.push({ id: uid(), name, time, notes: '', items: [{ id: uid(), food: '', quantity: '', householdMeasure: '', notes: '', substitutions: [] }] }), c))
  const usedPresets = new Set(content.meals.map((m) => m.name))

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter)
        if (fd.get('intent') === 'publish' && !window.confirm('Publicar este plano na área do paciente? A versão atual passará para o histórico.')) return
        startTransition(() => formAction(fd))
      }}
      className="stack"
      style={{ ['--gap' as string]: '16px' }}
      onChange={() => setDirty(true)}
    >
      <input type="hidden" name="content" value={json} />
      <datalist id="foods">
        {COMMON_FOODS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <section className="card">
        <div className="form-grid form-grid--3">
          <div className="field">
            <label htmlFor="plan-title">Título</label>
            <input id="plan-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
          </div>
          {!isTemplate && (
            <>
              <div className="field">
                <label htmlFor="plan-from">Válido a partir de</label>
                <input id="plan-from" type="date" name="validFrom" defaultValue={validFrom ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="plan-until">Válido até</label>
                <input id="plan-until" type="date" name="validUntil" defaultValue={validUntil ?? ''} />
              </div>
            </>
          )}
        </div>
      </section>

      {content.meals.map((meal, mi) => (
        <section key={meal.id} className="editor-meal stack" style={{ ['--gap' as string]: '10px' }} aria-label={`Refeição ${meal.name || mi + 1}`}>
          <div className="editor-row editor-row--meal">
            <div className="field">
              <label htmlFor={`m-${meal.id}-name`}>Refeição</label>
              <input id={`m-${meal.id}-name`} value={meal.name} onChange={(e) => updateMeal(mi, { name: e.target.value })} placeholder="Ex.: Almoço" maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor={`m-${meal.id}-time`}>Horário</label>
              <input id={`m-${meal.id}-time`} type="time" value={meal.time} onChange={(e) => updateMeal(mi, { time: e.target.value })} />
            </div>
            <button type="button" className="icon-btn" title="Subir refeição" aria-label="Subir refeição" disabled={mi === 0} onClick={() => update((c) => (move(c.meals, mi, mi - 1), c))}>
              ↑
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Descer refeição"
              aria-label="Descer refeição"
              disabled={mi === content.meals.length - 1}
              onClick={() => update((c) => (move(c.meals, mi, mi + 1), c))}
            >
              ↓
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Remover refeição"
              aria-label="Remover refeição"
              onClick={() => window.confirm('Remover esta refeição e seus alimentos?') && update((c) => (c.meals.splice(mi, 1), c))}
            >
              ✕
            </button>
          </div>

          {meal.items.map((item, ii) => (
            <div key={item.id} className="editor-item stack" style={{ ['--gap' as string]: '8px' }}>
              <div className="editor-row">
                <div className="field">
                  <label htmlFor={`i-${item.id}-food`}>Alimento</label>
                  <input id={`i-${item.id}-food`} list="foods" value={item.food} onChange={(e) => updateItem(mi, ii, { food: e.target.value })} maxLength={160} />
                </div>
                <div className="field">
                  <label htmlFor={`i-${item.id}-qty`}>Quantidade</label>
                  <input id={`i-${item.id}-qty`} value={item.quantity} onChange={(e) => updateItem(mi, ii, { quantity: e.target.value })} placeholder="100 g" maxLength={40} />
                </div>
                <div className="field">
                  <label htmlFor={`i-${item.id}-hm`}>Medida caseira</label>
                  <input id={`i-${item.id}-hm`} value={item.householdMeasure} onChange={(e) => updateItem(mi, ii, { householdMeasure: e.target.value })} placeholder="4 colheres de sopa" maxLength={80} />
                </div>
                <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                  <button type="button" className="icon-btn" aria-label="Subir alimento" disabled={ii === 0} onClick={() => update((c) => (move(c.meals[mi].items, ii, ii - 1), c))}>
                    ↑
                  </button>
                  <button type="button" className="icon-btn" aria-label="Remover alimento" onClick={() => update((c) => (c.meals[mi].items.splice(ii, 1), c))}>
                    ✕
                  </button>
                </div>
              </div>
              <div className="field">
                <label htmlFor={`i-${item.id}-notes`} className="small">
                  Observação do alimento
                </label>
                <input id={`i-${item.id}-notes`} value={item.notes} onChange={(e) => updateItem(mi, ii, { notes: e.target.value })} maxLength={300} placeholder="Opcional" />
              </div>
              {item.substitutions.map((sub, si) => (
                <div key={si} className="editor-row editor-row--sub" style={{ paddingLeft: 14, borderLeft: '3px solid var(--line-strong)' }}>
                  <input
                    aria-label="Substituição: alimento"
                    list="foods"
                    value={sub.food}
                    placeholder="Substituição"
                    onChange={(e) => update((c) => ((c.meals[mi].items[ii].substitutions[si].food = e.target.value), c))}
                    maxLength={160}
                  />
                  <input
                    aria-label="Substituição: quantidade"
                    value={sub.quantity}
                    placeholder="Quantidade"
                    onChange={(e) => update((c) => ((c.meals[mi].items[ii].substitutions[si].quantity = e.target.value), c))}
                    maxLength={40}
                  />
                  <input
                    aria-label="Substituição: medida caseira"
                    value={sub.householdMeasure}
                    placeholder="Medida caseira"
                    onChange={(e) => update((c) => ((c.meals[mi].items[ii].substitutions[si].householdMeasure = e.target.value), c))}
                    maxLength={80}
                  />
                  <button type="button" className="icon-btn" aria-label="Remover substituição" onClick={() => update((c) => (c.meals[mi].items[ii].substitutions.splice(si, 1), c))}>
                    ✕
                  </button>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => update((c) => (c.meals[mi].items[ii].substitutions.push({ food: '', quantity: '', householdMeasure: '' }), c))}
                >
                  + Substituição
                </button>
              </div>
            </div>
          ))}

          <div className="row">
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => update((c) => (c.meals[mi].items.push({ id: uid(), food: '', quantity: '', householdMeasure: '', notes: '', substitutions: [] }), c))}
            >
              + Alimento
            </button>
          </div>
          <div className="field">
            <label htmlFor={`m-${meal.id}-notes`} className="small">
              Observações da refeição
            </label>
            <textarea id={`m-${meal.id}-notes`} rows={2} value={meal.notes} onChange={(e) => updateMeal(mi, { notes: e.target.value })} maxLength={600} />
          </div>
        </section>
      ))}

      <div className="card row">
        <strong className="small">Adicionar refeição:</strong>
        {MEAL_PRESETS.filter(([n]) => !usedPresets.has(n)).map(([n, t]) => (
          <button key={n} type="button" className="btn btn--sm" onClick={() => addMeal(n, t)}>
            + {n}
          </button>
        ))}
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => addMeal()}>
          + Outra
        </button>
      </div>

      <section className="card">
        <div className="field">
          <label htmlFor="plan-guidance">Orientações gerais e individualizadas</label>
          <textarea
            id="plan-guidance"
            rows={5}
            value={content.guidance}
            onChange={(e) => update((c) => ((c.guidance = e.target.value), c))}
            maxLength={5000}
            placeholder="Hidratação, preparo dos alimentos, comportamento alimentar…"
          />
        </div>
      </section>

      <div className="sticky-actions">
        <div className="row row--between">
          <span className="small muted" aria-live="polite">
            {pending ? 'Salvando…' : dirty ? 'Alterações não salvas' : 'Tudo salvo'}
          </span>
          <div className="row">
            {!isTemplate && (
              <label className="check small" style={{ alignItems: 'center' }}>
                <input type="checkbox" name="reviewed" /> Revisei e aprovo este plano
              </label>
            )}
            <button type="submit" name="intent" value="save" className="btn" disabled={pending}>
              Salvar rascunho
            </button>
            {!isTemplate && (
              <button type="submit" name="intent" value="publish" className="btn btn--primary" disabled={pending}>
                Publicar para o paciente
              </button>
            )}
          </div>
        </div>
        {state.error && (
          <p className="alert alert--error" role="alert" style={{ marginTop: 10 }}>
            {state.error}
          </p>
        )}
        {state.ok && state.message && (
          <p className="alert alert--ok" role="status" style={{ marginTop: 10 }}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
