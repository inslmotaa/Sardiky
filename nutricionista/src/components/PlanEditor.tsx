'use client'

import { startTransition, useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ActionState } from '@/lib/action'
import {
  equivalentGrams,
  fmt,
  formatMeasure,
  friendlyGrams,
  macrosFromGkg,
  macrosFromPct,
  nearestMeasure,
  parseDecimal,
  scale,
  suggestSubstitutions,
  targetStatus,
  type Nutrients,
} from '@/lib/nutricao'
import {
  dayTotals,
  itemNutrients,
  optionTotals,
  quantityLabel,
  uid,
  type PlanContent,
  type PlanDay,
  type PlanItem,
  type PlanMeal,
  type Substitution,
} from '@/lib/plan'
import { FoodPicker, type FoodPickerHandle } from './nutri/FoodPicker'
import { RESTRICTIONS, restrictionAlerts, type RestrictionKey } from '@/lib/restricoes'
import { KcalRing, MacroBars, NutriInline } from './nutri/MacroBars'
import { NUTRIENT_BY_KEY, PLAN_MICROS, sumNutrients, type NutrientTable } from '@/lib/tabela-nutricional'
import { PatientPlan } from './nutri/PatientPlan'

export type EditorFood = {
  id: string
  name: string
  group: string
  per100: Nutrients
  cookingFactor: number | null
  measures: { name: string; grams: number }[]
  /** Vitaminas e minerais por 100 g (TACO 4ª ed.), para a análise do dia. */
  micros?: NutrientTable
}

type Props = {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>
  initial: PlanContent
  title: string
  validFrom: string | null
  validUntil: string | null
  isTemplate: boolean
  foods: EditorFood[]
  patient?: { name: string; weightKg: number | null; energyTarget: number | null; restrictions?: string[] }
}

const MEAL_PRESETS: [string, string][] = [
  ['Café da manhã', '07:00'],
  ['Lanche da manhã', '10:00'],
  ['Almoço', '12:30'],
  ['Lanche da tarde', '16:00'],
  ['Jantar', '19:30'],
  ['Ceia', '21:30'],
]
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Cria um item do plano a partir de um alimento da base. */
function itemFromFood(f: EditorFood, grams?: number): PlanItem {
  const m = f.measures[0]
  const g = grams ?? (m ? m.grams : 100)
  const near = nearestMeasure(g, f.measures)
  return {
    id: uid(),
    foodId: f.id,
    name: f.name,
    group: f.group,
    per100: f.per100,
    grams: g,
    measure: near && near.error < 0.15 ? { name: near.name, grams: near.grams, qty: near.qty } : null,
    text: '',
    notes: '',
    locked: false,
    subs: [],
  }
}

function subFromFood(f: EditorFood, grams: number): Substitution {
  const near = nearestMeasure(grams, f.measures)
  return { foodId: f.id, name: f.name, per100: f.per100, grams, measure: near && near.error < 0.15 ? { name: near.name, grams: near.grams, qty: near.qty } : null, text: '' }
}

export function PlanEditor({ action, initial, title: initialTitle, validFrom, validUntil, isTemplate, foods, patient }: Props) {
  const [hist, setHist] = useState<{ content: PlanContent; past: PlanContent[]; future: PlanContent[] }>({ content: initial, past: [], future: [] })
  const { content, past, future } = hist
  const [title, setTitle] = useState(initialTitle)
  const [dayIdx, setDayIdx] = useState(0)
  const [optIdx, setOptIdx] = useState<Record<string, number>>({})
  const [suggestFor, setSuggestFor] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [macroMode, setMacroMode] = useState<'pct' | 'gkg'>('pct')
  const [pct, setPct] = useState({ protein: 25, carbs: 50, fat: 25 })
  const [gkg, setGkg] = useState({ protein: 1.6, carbs: 3, fat: 0.8 })
  const [dirty, setDirty] = useState(false)
  const [state, formAction, pending] = useActionState(action, {})
  const pickers = useRef<Record<string, FoodPickerHandle | null>>({})
  const lastPicker = useRef<string | null>(null)
  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])

  const day: PlanDay = content.days[Math.min(dayIdx, content.days.length - 1)]
  const calc = content.mode === 'calculado'
  const totals = dayTotals(day, Object.fromEntries(day.meals.map((m) => [m.id, m.options[optIdx[m.id] ?? 0]?.id ?? ''])))
  // Vitaminas e minerais das opções exibidas de cada refeição (itens sem dado na tabela deixam o total parcial).
  const micros = sumNutrients(
    day.meals.flatMap((m) =>
      (m.options[optIdx[m.id] ?? 0]?.items ?? [])
        .filter((it) => it.grams != null)
        .map((it) => ({ table: it.foodId ? (foodById.get(it.foodId)?.micros ?? null) : null, grams: it.grams! })),
    ),
    PLAN_MICROS,
  )
  const t = content.targets

  /* ------------------------------ estado e histórico ------------------------------ */

  const update = useCallback((fn: (c: PlanContent) => void) => {
    setHist((h) => {
      const next = structuredClone(h.content)
      fn(next)
      return { content: next, past: [...h.past.slice(-80), h.content], future: [] }
    })
    setDirty(true)
  }, [])
  const undo = useCallback(() => {
    setHist((h) => (h.past.length ? { content: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.content, ...h.future] } : h))
    setDirty(true)
  }, [])
  const redo = useCallback(() => {
    setHist((h) => (h.future.length ? { content: h.future[0], past: [...h.past, h.content], future: h.future.slice(1) } : h))
    setDirty(true)
  }, [])

  useEffect(() => {
    if (state.ok) setDirty(false)
  }, [state])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const key = lastPicker.current ?? Object.keys(pickers.current)[0]
        if (key) pickers.current[key]?.focus()
      }
      const inField = (e.target as HTMLElement)?.closest('input, textarea, select')
      if (mod && !inField && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [dirty, undo, redo])

  const dIdx = Math.min(dayIdx, content.days.length - 1)
  const mealAt = (c: PlanContent, mi: number) => c.days[dIdx].meals[mi]
  const optAt = (c: PlanContent, mi: number) => {
    const meal = mealAt(c, mi)
    return meal.options[Math.min(optIdx[meal.id] ?? 0, meal.options.length - 1)]
  }

  /* ------------------------------ metas ------------------------------ */

  const applyMacroTargets = () => {
    const kcal = t.kcal
    if (macroMode === 'pct') {
      if (!kcal) return
      const g = macrosFromPct(kcal, pct)
      update((c) => {
        c.targets = { ...c.targets, protein: Math.round(g.protein), carbs: Math.round(g.carbs), fat: Math.round(g.fat) }
      })
    } else {
      if (!patient?.weightKg) return
      const g = macrosFromGkg(patient.weightKg, gkg)
      update((c) => {
        c.targets = { ...c.targets, kcal: Math.round(g.kcal), protein: Math.round(g.protein), carbs: Math.round(g.carbs), fat: Math.round(g.fat) }
      })
    }
  }

  /* ------------------------------ renderização ------------------------------ */

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter)
        if (fd.get('intent') === 'publish' && !window.confirm('Ativar este plano no app do cliente? A versão atual passará para o histórico.')) return
        startTransition(() => formAction(fd))
      }}
      className="stack"
      style={{ ['--gap' as string]: '16px' }}
    >
      <input type="hidden" name="content" value={JSON.stringify(content)} />

      <section className="card stack" style={{ ['--gap' as string]: '12px' }}>
        <div className="form-grid form-grid--3">
          <div className="field">
            <label htmlFor="plan-title">Título</label>
            <input
              id="plan-title"
              type="text"
              name="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setDirty(true)
              }}
              maxLength={160}
            />
          </div>
          {!isTemplate ? (
            <>
              <div className="field">
                <label htmlFor="plan-from">Válido a partir de</label>
                <input id="plan-from" type="date" name="validFrom" defaultValue={validFrom ?? ''} onChange={() => setDirty(true)} />
              </div>
              <div className="field">
                <label htmlFor="plan-until">Válido até</label>
                <input id="plan-until" type="date" name="validUntil" defaultValue={validUntil ?? ''} onChange={() => setDirty(true)} />
              </div>
            </>
          ) : null}
        </div>
        <div className="row row--between">
          <div className="segmented" role="group" aria-label="Modo do plano">
            {(['calculado', 'livre'] as const).map((m) => (
              <a
                key={m}
                href="#"
                aria-current={content.mode === m ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  update((c) => {
                    c.mode = m
                  })
                }}
              >
                {m === 'calculado' ? 'Calculado (com quantidades)' : 'Livre (orientações em texto)'}
              </a>
            ))}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn--sm" onClick={undo} disabled={!past.length} title="Desfazer (Ctrl+Z)">
              ↶ Desfazer
            </button>
            <button type="button" className="btn btn--sm" onClick={redo} disabled={!future.length} title="Refazer (Ctrl+Shift+Z)">
              ↷ Refazer
            </button>
            <button type="button" className="btn btn--sm" onClick={() => setPreview(true)}>
              Prévia no celular
            </button>
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Dica: <kbd>Ctrl</kbd>+<kbd>K</kbd> busca um alimento na última refeição editada.
        </p>
      </section>

      {/* Dias do plano */}
      <section className="card stack" style={{ ['--gap' as string]: '10px' }}>
        <div className="row">
          <strong className="small">Dias do plano:</strong>
          <div className="option-tabs" role="group" aria-label="Dias do plano">
            {content.days.map((d, i) => (
              <button key={d.id} type="button" className="btn btn--sm" aria-pressed={i === dIdx} onClick={() => setDayIdx(i)}>
                {d.label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                update((c) => {
                  const copy = structuredClone(c.days[dIdx])
                  copy.id = uid()
                  copy.label = `Dia ${c.days.length + 1}`
                  copy.weekdays = []
                  c.days.push(copy)
                })
                setDayIdx(content.days.length)
              }}
              disabled={content.days.length >= 7}
            >
              + Duplicar dia
            </button>
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="day-label">Nome do dia</label>
            <input
              id="day-label"
              type="text"
              value={day.label}
              maxLength={60}
              onChange={(e) =>
                update((c) => {
                  c.days[dIdx].label = e.target.value
                })
              }
            />
          </div>
          <fieldset>
            <legend className="small">Vale para (vazio = qualquer dia)</legend>
            <div className="row" style={{ gap: 10 }}>
              {WEEKDAYS.map((w, i) => (
                <label key={w} className="check small">
                  <input
                    type="checkbox"
                    checked={day.weekdays.includes(i)}
                    onChange={(e) =>
                      update((c) => {
                        const wd = new Set(c.days[dIdx].weekdays)
                        if (e.target.checked) {
                          c.days.forEach((d) => (d.weekdays = d.weekdays.filter((x) => x !== i)))
                          wd.add(i)
                        } else wd.delete(i)
                        c.days[dIdx].weekdays = [...wd].sort()
                      })
                    }
                  />
                  {w}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {content.days.length > 1 && (
          <div>
            <button
              type="button"
              className="link-btn small"
              onClick={() => {
                if (!window.confirm(`Remover o dia “${day.label}”?`)) return
                update((c) => {
                  c.days.splice(dIdx, 1)
                })
                setDayIdx(0)
              }}
            >
              Remover este dia
            </button>
          </div>
        )}
      </section>

      {!!patient?.restrictions?.length && (
        <p className="alert alert--warn small" style={{ margin: 0 }}>
          <strong>Restrições do cliente:</strong> {patient.restrictions.map((r) => RESTRICTIONS[r as RestrictionKey]?.label ?? r).join(', ')}. Alimentos que conflitam aparecem com ⚠.
        </p>
      )}
      <div className="plan-editor">
        {/* -------------------------- refeições -------------------------- */}
        <div className="stack" style={{ ['--gap' as string]: '16px' }}>
          {day.meals.map((meal, mi) => (
            <MealEditor
              key={meal.id}
              meal={meal}
              mi={mi}
              count={day.meals.length}
              calc={calc}
              optIndex={Math.min(optIdx[meal.id] ?? 0, meal.options.length - 1)}
              setOptIndex={(i) => setOptIdx((o) => ({ ...o, [meal.id]: i }))}
              otherDays={content.days.map((d, i) => ({ i, label: d.label })).filter((d) => d.i !== dIdx)}
              foods={foods}
              foodById={foodById}
              suggestFor={suggestFor}
              setSuggestFor={setSuggestFor}
              registerPicker={(h) => (pickers.current[meal.id] = h)}
              onPickerFocus={() => (lastPicker.current = meal.id)}
              update={update}
              mealAt={mealAt}
              optAt={optAt}
              dIdx={dIdx}
              restrictions={patient?.restrictions ?? []}
            />
          ))}

          <div className="card row">
            <strong className="small">Adicionar refeição:</strong>
            {MEAL_PRESETS.filter(([n]) => !day.meals.some((m) => m.name === n)).map(([n, time]) => (
              <button
                key={n}
                type="button"
                className="btn btn--sm"
                onClick={() =>
                  update((c) => {
                    const meals = c.days[dIdx].meals
                    meals.push({ id: uid(), name: n, time, notes: '', options: [{ id: uid(), label: 'Opção 1', items: [] }] })
                    meals.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
                  })
                }
              >
                + {n}
              </button>
            ))}
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() =>
                update((c) => {
                  c.days[dIdx].meals.push({ id: uid(), name: 'Nova refeição', time: '', notes: '', options: [{ id: uid(), label: 'Opção 1', items: [] }] })
                })
              }
            >
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
                maxLength={5000}
                placeholder="Hidratação, preparo dos alimentos, comportamento alimentar…"
                onChange={(e) =>
                  update((c) => {
                    c.guidance = e.target.value
                  })
                }
              />
            </div>
          </section>
        </div>

        {/* -------------------------- metas -------------------------- */}
        <aside className="targets-panel">
          <section className="card stack" style={{ ['--gap' as string]: '12px' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Metas · {day.label}</h2>
            {calc ? (
              <>
                <div className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
                  <KcalRing value={totals.kcal} target={t.kcal} />
                  <div className="small">
                    {t.kcal ? (
                      <>
                        Planejado: <strong>{fmt(totals.kcal, 0)} kcal</strong>
                        <br />
                        Meta: {fmt(t.kcal, 0)} kcal
                        <StatusTag planned={totals.kcal} target={t.kcal} />
                      </>
                    ) : (
                      <>Defina a meta de calorias para comparar.</>
                    )}
                  </div>
                </div>
                <MacroBars value={totals} target={t} showStatus includeFiber />
                <p className="small muted" style={{ margin: 0 }}>
                  Verde: até ±5% da meta · amarelo: até ±10% · vermelho: acima.
                </p>
              </>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                No modo livre, as quantidades são orientações em texto e não há cálculo nutricional.
              </p>
            )}
          </section>

          {calc && micros.count > 0 && (
            <section className="card stack" style={{ ['--gap' as string]: '10px' }} aria-labelledby="micros-titulo">
              <h3 id="micros-titulo" style={{ margin: 0 }}>
                Vitaminas e minerais · {day.label}
              </h3>
              <p className="small muted" style={{ margin: 0 }}>
                Soma das opções exibidas, com valores da TACO 4ª ed. por 100 g.
              </p>
              <dl className="micro-list">
                {PLAN_MICROS.map((k) => {
                  const info = NUTRIENT_BY_KEY[k]
                  return (
                    <div key={k}>
                      <dt>{info.label}</dt>
                      <dd>
                        {fmt(micros.totals[k], info.digits)} {info.unit}
                        {micros.missing[k] > 0 && (
                          <span className="micro-list__partial" title={`${micros.missing[k]} item(ns) sem este dado na tabela`}>
                            *
                          </span>
                        )}
                      </dd>
                    </div>
                  )
                })}
              </dl>
              {PLAN_MICROS.some((k) => micros.missing[k] > 0) && (
                <p className="small muted" style={{ margin: 0 }}>
                  * Total parcial: há itens sem esse dado analisado na tabela (receitas, itens em texto ou valores “não analisados”).
                </p>
              )}
            </section>
          )}

          {calc && (
            <section className="card stack" style={{ ['--gap' as string]: '10px' }}>
              <h3 style={{ margin: 0 }}>Definir metas</h3>
              <div className="field">
                <label htmlFor="t-kcal">Calorias (kcal)</label>
                <input
                  id="t-kcal"
                  type="text"
                  inputMode="decimal"
                  value={t.kcal ?? ''}
                  onChange={(e) =>
                    update((c) => {
                      c.targets.kcal = parseDecimal(e.target.value)
                    })
                  }
                />
              </div>
              {patient?.energyTarget ? (
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() =>
                    update((c) => {
                      c.targets.kcal = Math.round(patient.energyTarget!)
                    })
                  }
                >
                  Usar a meta do cliente ({fmt(patient.energyTarget, 0)} kcal)
                </button>
              ) : (
                <p className="small muted" style={{ margin: 0 }}>
                  Calcule o gasto energético em Calculadoras e salve na ficha para puxar a meta daqui.
                </p>
              )}
              <div className="segmented" role="group" aria-label="Distribuição de macros">
                {(['pct', 'gkg'] as const).map((m) => (
                  <a
                    key={m}
                    href="#"
                    aria-current={macroMode === m ? 'page' : undefined}
                    onClick={(e) => {
                      e.preventDefault()
                      setMacroMode(m)
                    }}
                  >
                    {m === 'pct' ? '% das calorias' : 'g/kg de peso'}
                  </a>
                ))}
              </div>
              <div className="form-grid form-grid--3">
                {(['protein', 'carbs', 'fat'] as const).map((k) => (
                  <div className="field" key={k}>
                    <label htmlFor={`t-${k}`} className="small">
                      {k === 'protein' ? 'Proteína' : k === 'carbs' ? 'Carbo' : 'Gordura'} {macroMode === 'pct' ? '(%)' : '(g/kg)'}
                    </label>
                    <input
                      id={`t-${k}`}
                      type="text"
                      inputMode="decimal"
                      value={macroMode === 'pct' ? pct[k] : gkg[k]}
                      onChange={(e) => {
                        const v = parseDecimal(e.target.value) ?? 0
                        if (macroMode === 'pct') setPct((p) => ({ ...p, [k]: v }))
                        else setGkg((g) => ({ ...g, [k]: v }))
                      }}
                    />
                  </div>
                ))}
              </div>
              {macroMode === 'pct' && pct.protein + pct.carbs + pct.fat !== 100 && (
                <p className="small" style={{ color: 'var(--warn)', margin: 0 }}>
                  A soma está em {fmt(pct.protein + pct.carbs + pct.fat, 0)}% (o ideal é 100%).
                </p>
              )}
              {macroMode === 'gkg' && !patient?.weightKg && (
                <p className="small muted" style={{ margin: 0 }}>
                  Sem peso registrado para este plano: use % das calorias.
                </p>
              )}
              <button type="button" className="btn btn--sm btn--primary" onClick={applyMacroTargets} disabled={macroMode === 'pct' ? !t.kcal : !patient?.weightKg}>
                Aplicar distribuição
              </button>
            </section>
          )}
        </aside>
      </div>

      <div className="sticky-actions">
        <div className="row row--between sticky-actions__bar">
          <span className="small muted sticky-actions__status" aria-live="polite">
            {pending ? 'Salvando…' : dirty ? 'Alterações não salvas' : 'Tudo salvo'}
          </span>
          <div className="row sticky-actions__buttons">
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
                Ativar no app do cliente
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

      {preview && (
        <div className="phone-preview" role="dialog" aria-modal="true" aria-label="Prévia no celular" onClick={() => setPreview(false)}>
          <div className="phone-preview__frame" onClick={(e) => e.stopPropagation()}>
            <div className="row row--between" style={{ marginBottom: 12 }}>
              <strong>Como {patient?.name.split(' ')[0] ?? 'o cliente'} vai ver</strong>
              <button type="button" className="btn btn--sm" onClick={() => setPreview(false)} autoFocus>
                Fechar
              </button>
            </div>
            <PatientPlan content={content} />
          </div>
        </div>
      )}
    </form>
  )
}

function StatusTag({ planned, target }: { planned: number; target: number | null }) {
  const st = targetStatus(planned, target)
  if (st === 'none') return null
  return <span className={`status-dot status-dot--${st}`}>{st === 'ok' ? 'na meta' : st === 'warn' ? 'perto' : 'fora'}</span>
}

/* ============================== refeição ============================== */

type MealEditorProps = {
  meal: PlanMeal
  mi: number
  count: number
  calc: boolean
  optIndex: number
  setOptIndex: (i: number) => void
  otherDays: { i: number; label: string }[]
  foods: EditorFood[]
  foodById: Map<string, EditorFood>
  suggestFor: string | null
  setSuggestFor: (k: string | null) => void
  registerPicker: (h: FoodPickerHandle | null) => void
  onPickerFocus: () => void
  update: (fn: (c: PlanContent) => void) => void
  mealAt: (c: PlanContent, mi: number) => PlanMeal
  optAt: (c: PlanContent, mi: number) => PlanMeal['options'][number]
  dIdx: number
  restrictions: string[]
}

function MealEditor(p: MealEditorProps) {
  const { meal, mi, calc, update, mealAt, optAt } = p
  const [pickAlert, setPickAlert] = useState<string | null>(null)
  const opt = meal.options[p.optIndex]
  const sub = optionTotals(opt)
  const editItem = (ii: number, fn: (it: PlanItem) => void) =>
    update((c) => {
      fn(optAt(c, mi).items[ii])
    })

  return (
    <section className="editor-meal stack" style={{ ['--gap' as string]: '10px' }} aria-label={`Refeição ${meal.name}`}>
      <div className="editor-row editor-row--meal">
        <div className="field">
          <label htmlFor={`m-${meal.id}-name`}>Refeição</label>
          <input
            id={`m-${meal.id}-name`}
            type="text"
            value={meal.name}
            maxLength={80}
            onChange={(e) =>
              update((c) => {
                mealAt(c, mi).name = e.target.value
              })
            }
          />
        </div>
        <div className="field">
          <label htmlFor={`m-${meal.id}-time`}>Horário</label>
          <input
            id={`m-${meal.id}-time`}
            type="time"
            value={meal.time}
            onChange={(e) =>
              update((c) => {
                mealAt(c, mi).time = e.target.value
              })
            }
          />
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Subir refeição"
          disabled={mi === 0}
          onClick={() =>
            update((c) => {
              const ms = c.days[p.dIdx].meals
              ms.splice(mi - 1, 0, ms.splice(mi, 1)[0])
            })
          }
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Descer refeição"
          disabled={mi === p.count - 1}
          onClick={() =>
            update((c) => {
              const ms = c.days[p.dIdx].meals
              ms.splice(mi + 1, 0, ms.splice(mi, 1)[0])
            })
          }
        >
          ↓
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Remover refeição"
          onClick={() =>
            window.confirm(`Remover “${meal.name}” e seus alimentos?`) &&
            update((c) => {
              c.days[p.dIdx].meals.splice(mi, 1)
            })
          }
        >
          ✕
        </button>
      </div>

      <div className="row row--between">
        <div className="option-tabs" role="group" aria-label="Opções da refeição">
          {meal.options.map((o, oi) => (
            <button key={o.id} type="button" className="btn btn--sm" aria-pressed={oi === p.optIndex} onClick={() => p.setOptIndex(oi)}>
              {o.label}
            </button>
          ))}
          {meal.options.length < 5 && (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                update((c) => {
                  const m = mealAt(c, mi)
                  m.options.push({ id: uid(), label: `Opção ${m.options.length + 1}`, items: [] })
                })
                p.setOptIndex(meal.options.length)
              }}
            >
              + Opção
            </button>
          )}
          {meal.options.length > 1 && (
            <button
              type="button"
              className="link-btn small"
              onClick={() => {
                if (!window.confirm(`Remover a ${opt.label}?`)) return
                update((c) => {
                  const m = mealAt(c, mi)
                  m.options.splice(p.optIndex, 1)
                  m.options.forEach((o, i) => (o.label = `Opção ${i + 1}`))
                })
                p.setOptIndex(0)
              }}
            >
              remover opção
            </button>
          )}
        </div>
        {calc && (
          <span className="small">
            Subtotal: <NutriInline n={sub} />
          </span>
        )}
      </div>

      {opt.items.map((it, ii) => {
        const n = itemNutrients(it)
        const food = it.foodId ? p.foodById.get(it.foodId) : undefined
        const measures = food?.measures ?? (it.measure ? [{ name: it.measure.name, grams: it.measure.grams }] : [])
        const key = `${meal.id}:${opt.id}:${it.id}`
        const calcItem = calc && it.per100 != null
        return (
          <div key={it.id} className="editor-item stack" style={{ ['--gap' as string]: '8px' }}>
            <div className="item-row">
              {calcItem ? (
                <div className="item-name">
                  {it.name}
                  <div>{n && <NutriInline n={n} />}</div>
                  <RestrictionBadges name={it.name} group={it.group} restrictions={p.restrictions} />
                </div>
              ) : (
                <div className="field">
                  <label htmlFor={`i-${it.id}-name`} className="small">
                    Alimento
                  </label>
                  <input
                    id={`i-${it.id}-name`}
                    type="text"
                    value={it.name}
                    maxLength={160}
                    onChange={(e) => editItem(ii, (x) => void (x.name = e.target.value))}
                  />
                </div>
              )}
              {calcItem ? (
                <>
                  <div className="field">
                    <label htmlFor={`i-${it.id}-g`} className="small">
                      Gramas
                    </label>
                    <input
                      id={`i-${it.id}-g`}
                      type="text"
                      inputMode="decimal"
                      value={it.grams ?? ''}
                      onChange={(e) =>
                        editItem(ii, (x) => {
                          const g = parseDecimal(e.target.value)
                          x.grams = g
                          if (x.measure && g != null) x.measure.qty = Math.round((g / x.measure.grams) * 100) / 100
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`i-${it.id}-m`} className="small">
                      Medida caseira
                    </label>
                    <select
                      id={`i-${it.id}-m`}
                      value={it.measure?.name ?? ''}
                      onChange={(e) =>
                        editItem(ii, (x) => {
                          const m = measures.find((mm) => mm.name === e.target.value)
                          x.measure = m ? { name: m.name, grams: m.grams, qty: x.grams != null ? Math.max(0.5, Math.round((x.grams / m.grams) * 2) / 2) : 1 } : null
                          if (x.measure) x.grams = x.measure.qty * x.measure.grams
                        })
                      }
                    >
                      <option value="">— só gramas —</option>
                      {measures.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} ({fmt(m.grams, 0)} g)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`i-${it.id}-q`} className="small">
                      Qtd.
                    </label>
                    <input
                      id={`i-${it.id}-q`}
                      type="text"
                      inputMode="decimal"
                      value={it.measure?.qty ?? ''}
                      disabled={!it.measure}
                      onChange={(e) =>
                        editItem(ii, (x) => {
                          const q = parseDecimal(e.target.value)
                          if (!x.measure || q == null) return
                          x.measure.qty = q
                          x.grams = Math.round(q * x.measure.grams * 10) / 10
                        })
                      }
                    />
                  </div>
                </>
              ) : (
                <div className="field" style={{ gridColumn: 'span 3' }}>
                  <label htmlFor={`i-${it.id}-t`} className="small">
                    Quantidade
                  </label>
                  <input
                    id={`i-${it.id}-t`}
                    type="text"
                    value={it.text}
                    maxLength={80}
                    placeholder="Ex.: 2 fatias"
                    onChange={(e) => editItem(ii, (x) => void (x.text = e.target.value))}
                  />
                </div>
              )}
              <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Subir alimento"
                  disabled={ii === 0}
                  onClick={() =>
                    update((c) => {
                      const items = optAt(c, mi).items
                      items.splice(ii - 1, 0, items.splice(ii, 1)[0])
                    })
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remover ${it.name}`}
                  onClick={() =>
                    update((c) => {
                      optAt(c, mi).items.splice(ii, 1)
                    })
                  }
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="row">
              <input
                type="text"
                aria-label={`Observação sobre ${it.name}`}
                placeholder="Observação (ex.: cozido, sem casca)"
                value={it.notes}
                maxLength={300}
                style={{ flex: 1, minWidth: 180 }}
                onChange={(e) => editItem(ii, (x) => void (x.notes = e.target.value))}
              />
              <label className="check small" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={it.locked} onChange={(e) => editItem(ii, (x) => void (x.locked = e.target.checked))} /> Sem substituição
              </label>
            </div>

            {!it.locked && (
              <div className="subs-box">
                {it.subs.map((s, si) => (
                  <div key={si} className="row row--between small">
                    <span>
                      ↔ <strong>{s.name}</strong> — {quantityLabel(s) || '—'}
                      {s.per100 && s.grams != null && <span className="muted"> · {fmt(scale(s.per100, s.grams).kcal, 0)} kcal</span>}
                    </span>
                    <button
                      type="button"
                      className="link-btn"
                      aria-label={`Remover substituição ${s.name}`}
                      onClick={() =>
                        update((c) => {
                          optAt(c, mi).items[ii].subs.splice(si, 1)
                        })
                      }
                    >
                      remover
                    </button>
                  </div>
                ))}
                <div className="row" style={{ gap: 8 }}>
                  {calcItem && food && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => p.setSuggestFor(p.suggestFor === key ? null : key)} aria-expanded={p.suggestFor === key}>
                      Sugerir equivalentes
                    </button>
                  )}
                  {calcItem && (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <FoodPicker
                        foods={p.foods}
                        label={`Adicionar substituição para ${it.name}`}
                        placeholder="+ Substituição (busca)"
                        onPick={(f) => {
                          const full = p.foodById.get(f.id)!
                          const raw = equivalentGrams(it.per100!, it.grams ?? 0, full.per100, 'kcal')
                          update((c) => {
                            optAt(c, mi).items[ii].subs.push(subFromFood(full, raw ? friendlyGrams(raw) : 100))
                          })
                        }}
                      />
                    </div>
                  )}
                  {!calcItem && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() =>
                        update((c) => {
                          optAt(c, mi).items[ii].subs.push({ foodId: null, name: 'Substituição', per100: null, grams: null, measure: null, text: '' })
                        })
                      }
                    >
                      + Substituição em texto
                    </button>
                  )}
                </div>
                {!calcItem &&
                  it.subs.map((s, si) => (
                    <div key={`t${si}`} className="row" style={{ gap: 6 }}>
                      <input
                        type="text"
                        aria-label="Substituição"
                        value={s.name}
                        onChange={(e) =>
                          update((c) => {
                            optAt(c, mi).items[ii].subs[si].name = e.target.value
                          })
                        }
                        style={{ flex: 2 }}
                      />
                      <input
                        type="text"
                        aria-label="Quantidade da substituição"
                        value={s.text}
                        placeholder="Quantidade"
                        onChange={(e) =>
                          update((c) => {
                            optAt(c, mi).items[ii].subs[si].text = e.target.value
                          })
                        }
                        style={{ flex: 1 }}
                      />
                    </div>
                  ))}
                {p.suggestFor === key && food && (
                  <Suggestions
                    food={food}
                    grams={it.grams ?? 0}
                    foods={p.foods}
                    existing={it.subs.map((s) => s.foodId)}
                    onAdd={(f, g) =>
                      update((c) => {
                        optAt(c, mi).items[ii].subs.push(subFromFood(f, g))
                      })
                    }
                  />
                )}
              </div>
            )}
          </div>
        )
      })}

      <div onFocus={p.onPickerFocus}>
        <FoodPicker
          ref={p.registerPicker}
          foods={p.foods}
          label={`Adicionar alimento em ${meal.name}`}
          placeholder={calc ? '+ Adicionar alimento (busca)' : '+ Adicionar alimento'}
          onPick={(f) => {
            const food = p.foodById.get(f.id)!
            const alerts = restrictionAlerts(food, p.restrictions)
            setPickAlert(alerts.length ? `Atenção: “${food.name}” conflita com a restrição do cliente (${alerts.join(', ')}). Confirme se é isso mesmo.` : null)
            update((c) => {
              optAt(c, mi).items.push(itemFromFood(food))
            })
          }}
          onFreeText={(text) =>
            update((c) => {
              optAt(c, mi).items.push({ id: uid(), foodId: null, name: text, group: '', per100: null, grams: null, measure: null, text: '', notes: '', locked: false, subs: [] })
            })
          }
        />
        {pickAlert && (
          <p className="alert alert--warn small" role="alert" style={{ margin: '8px 0 0' }}>
            {pickAlert}
          </p>
        )}
      </div>

      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor={`m-${meal.id}-notes`} className="small">
            Observações da refeição
          </label>
          <input
            id={`m-${meal.id}-notes`}
            type="text"
            value={meal.notes}
            maxLength={600}
            onChange={(e) =>
              update((c) => {
                mealAt(c, mi).notes = e.target.value
              })
            }
          />
        </div>
        {p.otherDays.length > 0 && (
          <label className="field" style={{ minWidth: 180 }}>
            <span className="field__label small">Copiar refeição para</span>
            <select
              value=""
              onChange={(e) => {
                const target = Number(e.target.value)
                if (Number.isNaN(target)) return
                update((c) => {
                  const copy = structuredClone(mealAt(c, mi))
                  copy.id = uid()
                  copy.options.forEach((o) => {
                    o.id = uid()
                    o.items.forEach((x) => (x.id = uid()))
                  })
                  const list = c.days[target].meals
                  const same = list.findIndex((m) => m.name === copy.name)
                  if (same >= 0) list[same] = copy
                  else list.push(copy)
                  list.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
                })
              }}
            >
              <option value="">Escolher dia…</option>
              {p.otherDays.map((d) => (
                <option key={d.i} value={d.i}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </section>
  )
}

/** Sugestões de substitutos do mesmo grupo com calorias equivalentes (±10%), para aprovação. */
function Suggestions({
  food,
  grams,
  foods,
  existing,
  onAdd,
}: {
  food: EditorFood
  grams: number
  foods: EditorFood[]
  existing: (string | null)[]
  onAdd: (f: EditorFood, grams: number) => void
}) {
  const list = suggestSubstitutions(food, grams, foods).filter((s) => !existing.includes(s.food.id))
  const base = scale(food.per100, grams).kcal
  return (
    <div className="suggestions" role="region" aria-label="Sugestões de substituição">
      <span className="small muted">
        Equivalentes a {fmt(grams, 0)} g de {food.name} ({fmt(base, 0)} kcal), mesmo grupo, até ±10%:
      </span>
      {list.length === 0 && <span className="small">Nenhuma sugestão nova no mesmo grupo.</span>}
      {list.map((s) => {
        const near = nearestMeasure(s.grams, s.food.measures)
        return (
          <div key={s.food.id} className="row row--between small">
            <span>
              {s.food.name} — {fmt(s.grams, 0)} g{near && near.error < 0.15 ? ` (${formatMeasure(near.qty, near.name)})` : ''} · {fmt(s.kcal, 0)} kcal ({s.diff >= 0 ? '+' : ''}
              {fmt(s.diff * 100, 0)}%)
            </span>
            <button type="button" className="btn btn--sm" onClick={() => onAdd(s.food, s.grams)}>
              Aprovar
            </button>
          </div>
        )
      })}
    </div>
  )
}

/** Selo de alerta quando o alimento fere uma restrição do paciente (vinda da anamnese ou da ficha). */
function RestrictionBadges({ name, group, restrictions }: { name: string; group: string; restrictions: string[] }) {
  const alerts = restrictions.length ? restrictionAlerts({ name, group }, restrictions) : []
  if (!alerts.length) return null
  return (
    <div>
      <span className="badge badge--danger" title="Restrição registrada na ficha do cliente">
        ⚠ Restrição: {alerts.join(', ')}
      </span>
    </div>
  )
}
