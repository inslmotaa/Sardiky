'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import type { ActionState } from '@/lib/action'
import { fmt, formatMeasure, scale, sum, ZERO, type Nutrients } from '@/lib/nutricao'
import { itemsNutrients, type DiaryItem } from '@/lib/plan'
import { FoodPicker } from './FoodPicker'
import { NutriInline } from './MacroBars'

type Action = (state: ActionState, data: FormData) => Promise<ActionState>
type Choice = 'total' | 'parcial' | 'nao_seguiu'

export type DiaryFood = { id: string; name: string; group: string; per100: Nutrients; measures: { name: string; grams: number }[] }

export type DiaryEntryView = {
  id: string
  time: string
  meal: string
  foods: string
  choice: Choice | null
  items: DiaryItem[]
  hunger: number | null
  satiety: number | null
  mood: number | null
  notes: string | null
  photoUrl: string | null
  comment: string | null
}

export type DiaryMeal = {
  key: string
  name: string
  time: string
  optionId: string | null
  /** Resumo do que o plano prevê (ex.: "Pão francês · Ovo · Café"). */
  summary: string
  planned: Nutrients | null
  entry: DiaryEntryView | null
}

const CHOICES: { value: Choice; label: string; tone: string }[] = [
  { value: 'total', label: 'Segui o plano', tone: 'badge--ok' },
  { value: 'parcial', label: 'Segui em parte', tone: 'badge--warn' },
  { value: 'nao_seguiu', label: 'Comi outra coisa', tone: 'badge--plain' },
]

export const MOOD = [
  ['😞', 'Muito mal'],
  ['🙁', 'Mal'],
  ['😐', 'Neutro'],
  ['🙂', 'Bem'],
  ['😄', 'Muito bem'],
] as const
export const HUNGER = [
  ['😌', 'Sem fome'],
  ['🙂', 'Pouca fome'],
  ['😐', 'Fome moderada'],
  ['😋', 'Bastante fome'],
  ['😫', 'Muita fome'],
] as const
export const SATIETY = [
  ['😕', 'Ainda com fome'],
  ['😐', 'Pouco satisfeito'],
  ['🙂', 'Satisfeito'],
  ['😊', 'Bem satisfeito'],
  ['😮‍💨', 'Cheio demais'],
] as const

/**
 * Diário de um dia: para cada refeição do plano, o paciente conta como foi em um toque
 * e, se quiser, acrescenta alimentos da base, foto, fome, saciedade e humor.
 */
export function DiaryDay({
  date,
  nowTime,
  meals,
  extras,
  foods,
  action,
  onDelete,
  show,
  photoNote,
}: {
  date: string
  nowTime: string
  meals: DiaryMeal[]
  extras: DiaryEntryView[]
  foods: DiaryFood[]
  action: Action
  onDelete?: (id: string) => Promise<void>
  show: { kcal: boolean; macros: boolean }
  photoNote?: string
}) {
  const [open, setOpen] = useState<{ key: string; choice: Choice | null } | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const saved = (msg?: string) => {
    setOpen(null)
    if (msg) setFlash(msg)
  }
  return (
    <div className="stack">
      {flash && (
        <p className="alert alert--ok diary-flash" role="status">
          {flash}
          <button type="button" className="link-btn small" onClick={() => setFlash(null)} style={{ marginLeft: 8 }}>
            fechar
          </button>
        </p>
      )}
      {meals.map((m) => (
        <section key={m.key} className="card diary-meal" aria-label={`Refeição ${m.name}`}>
          <div className="row row--between">
            <h3 style={{ margin: 0 }}>
              {m.name}
              {m.time && <span className="muted"> · {m.time.replace(':', 'h')}</span>}
            </h3>
            {m.entry?.choice && <ChoiceBadge choice={m.entry.choice} />}
          </div>
          {m.summary && (
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              No plano: {m.summary}
              {show.kcal && m.planned && <> · {fmt(m.planned.kcal, 0)} kcal</>}
            </p>
          )}
          {m.entry && open?.key !== m.key && <EntrySummary e={m.entry} show={show} onDelete={onDelete} />}
          {open?.key === m.key ? (
            <EntryForm
              key={`${m.key}-${open.choice}`}
              date={date}
              time={m.time || nowTime}
              meal={m}
              initial={m.entry}
              choice={open.choice}
              foods={foods}
              action={action}
              show={show}
              photoNote={photoNote}
              onClose={saved}
            />
          ) : (
            <div className="choice-buttons" role="group" aria-label={`Como foi ${m.name}?`}>
              {m.entry ? (
                <button type="button" className="btn btn--sm" onClick={() => setOpen({ key: m.key, choice: m.entry!.choice })}>
                  Alterar registro
                </button>
              ) : (
                CHOICES.map((c) => (
                  <button key={c.value} type="button" className={`btn btn--sm ${c.value === 'total' ? 'btn--primary' : ''}`} onClick={() => setOpen({ key: m.key, choice: c.value })}>
                    {c.label}
                  </button>
                ))
              )}
            </div>
          )}
        </section>
      ))}

      <section className="card diary-meal" aria-label="Registros fora do plano">
        <h3 style={{ margin: 0 }}>Fora do plano</h3>
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          Um lanche extra, uma bebida, um evento. Registrar ajuda o nutricionista a ajustar o plano à sua rotina.
        </p>
        {extras.map((e) => (
          <EntrySummary key={e.id} e={e} show={show} onDelete={onDelete} title={`${e.time} · ${e.meal}`} />
        ))}
        {open?.key === 'extra' ? (
          <EntryForm date={date} time={nowTime} meal={null} initial={null} choice={null} foods={foods} action={action} show={show} photoNote={photoNote} onClose={saved} />
        ) : (
          <div className="choice-buttons">
            <button type="button" className="btn btn--sm" onClick={() => setOpen({ key: 'extra', choice: null })}>
              + Registrar algo fora do plano
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function ChoiceBadge({ choice }: { choice: Choice }) {
  const c = CHOICES.find((x) => x.value === choice)!
  return <span className={`badge ${c.tone}`}>{c.label}</span>
}

function EntrySummary({ e, show, onDelete, title }: { e: DiaryEntryView; show: { kcal: boolean; macros: boolean }; onDelete?: (id: string) => Promise<void>; title?: string }) {
  const n = e.items.length ? itemsNutrients(e.items) : null
  return (
    <div className="diary-entry">
      <div style={{ minWidth: 0, flex: 1 }}>
        {title && <strong>{title}</strong>}
        <div>{e.foods}</div>
        {e.items.length > 0 && (
          <ul className="diary-items">
            {e.items.map((it, i) => (
              <li key={i}>
                {it.name} · {it.grams} g{show.kcal && it.per100 && <span className="muted"> · {fmt(scale(it.per100, it.grams).kcal, 0)} kcal</span>}
              </li>
            ))}
          </ul>
        )}
        {n && (show.kcal || show.macros) && <NutriInline n={n} showKcal={show.kcal} showMacros={show.macros} />}
        <Feelings e={e} />
        {e.notes && <div className="small">“{e.notes}”</div>}
        {e.comment && (
          <p className="alert alert--info small" style={{ margin: '8px 0 0' }}>
            <strong>Nutricionista:</strong> {e.comment}
          </p>
        )}
        {onDelete && !e.comment && !e.id.startsWith('log-') && (
          <form
            action={async () => {
              if (window.confirm('Excluir este registro do diário?')) await onDelete(e.id)
            }}
          >
            <button className="link-btn small" type="submit" style={{ color: 'var(--muted)' }}>
              Excluir registro
            </button>
          </form>
        )}
      </div>
      {e.photoUrl && (
        <a href={e.photoUrl} target="_blank" rel="noopener noreferrer" className="diary-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.photoUrl} alt={`Foto: ${e.meal}`} />
        </a>
      )}
    </div>
  )
}

export function Feelings({ e }: { e: { hunger: number | null; satiety: number | null; mood: number | null } }) {
  const parts = [
    e.hunger ? `Fome: ${HUNGER[e.hunger - 1][0]} ${HUNGER[e.hunger - 1][1].toLowerCase()}` : null,
    e.satiety ? `Saciedade: ${SATIETY[e.satiety - 1][0]} ${SATIETY[e.satiety - 1][1].toLowerCase()}` : null,
    e.mood ? `Humor: ${MOOD[e.mood - 1][0]} ${MOOD[e.mood - 1][1].toLowerCase()}` : null,
  ].filter(Boolean)
  return parts.length ? <div className="small muted">{parts.join(' · ')}</div> : null
}

type Row = { foodId: string; name: string; per100: Nutrients; grams: string; measures: { name: string; grams: number }[] }

function EntryForm({
  date,
  time,
  meal,
  initial,
  choice: initialChoice,
  foods,
  action,
  show,
  photoNote,
  onClose,
}: {
  date: string
  time: string
  meal: DiaryMeal | null
  initial: DiaryEntryView | null
  choice: Choice | null
  foods: DiaryFood[]
  action: Action
  show: { kcal: boolean; macros: boolean }
  photoNote?: string
  onClose: (message?: string) => void
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const [choice, setChoice] = useState<Choice | null>(initialChoice)
  const [rows, setRows] = useState<Row[]>(
    () =>
      initial?.items
        .filter((i) => i.foodId && i.per100)
        .map((i) => ({ foodId: i.foodId!, name: i.name, per100: i.per100!, grams: String(i.grams), measures: foods.find((f) => f.id === i.foodId)?.measures ?? [] })) ?? [],
  )
  const [details, setDetails] = useState(!!initial && (initial.hunger || initial.satiety || initial.mood || initial.notes) ? true : false)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.ok) onClose(state.message)
  }, [state, onClose])

  const other = !meal || choice === 'nao_seguiu'
  const valid = rows.map((r) => ({ ...r, g: Number(r.grams.replace(',', '.')) })).filter((r) => r.g > 0)
  const total = valid.length ? sum(valid.map((r) => scale(r.per100, r.g))) : ZERO
  const idPrefix = meal?.key.replace(':', '-') ?? 'extra'

  return (
    <form
      ref={ref}
      className="stack diary-form"
      style={{ ['--gap' as string]: '12px', marginTop: 12 }}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(() => formAction(fd))
      }}
    >
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="mealKey" value={meal?.key ?? ''} />
      <input type="hidden" name="optionId" value={meal?.optionId ?? ''} />
      <input type="hidden" name="choice" value={meal ? (choice ?? '') : ''} />
      <input type="hidden" name="items" value={JSON.stringify(valid.map((r) => ({ foodId: r.foodId, name: r.name, grams: r.g })))} />
      {meal ? (
        <>
          <input type="hidden" name="meal" value={meal.name} />
          <div className="segmented" role="radiogroup" aria-label="Como foi?">
            {CHOICES.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={choice === c.value} className={choice === c.value ? 'is-on' : ''} onClick={() => setChoice(c.value)}>
                {c.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <label className="field">
          <span className="field__label">O que foi?</span>
          <select name="meal" defaultValue="Lanche extra">
            {['Lanche extra', 'Bebida', 'Doce', 'Evento ou refeição fora', 'Outro'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      )}

      {other && (
        <>
          <FoodPicker
            foods={foods}
            label={`Buscar alimento (${meal?.name ?? 'fora do plano'})`}
            placeholder="Ex.: pão de queijo, banana…"
            onPick={(f) => {
              const full = foods.find((x) => x.id === f.id)!
              const g = full.measures[0]?.grams ?? 100
              setRows((cur) => [...cur, { foodId: full.id, name: full.name, per100: full.per100, grams: String(g), measures: full.measures }])
            }}
          />
          {rows.length > 0 && (
            <ul className="diary-items diary-items--edit">
              {rows.map((r, i) => {
                const g = Number(r.grams.replace(',', '.'))
                return (
                  <li key={i}>
                    <span className="diary-items__name">{r.name}</span>
                    <label className="sr-only" htmlFor={`${idPrefix}-g-${i}`}>
                      Gramas de {r.name}
                    </label>
                    <input
                      id={`${idPrefix}-g-${i}`}
                      inputMode="decimal"
                      value={r.grams}
                      onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))}
                      style={{ width: 72 }}
                    />
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
                    {show.kcal && g > 0 && <span className="small muted">{fmt(scale(r.per100, g).kcal, 0)} kcal</span>}
                    <button type="button" className="link-btn small" aria-label={`Remover ${r.name}`} onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}>
                      remover
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {valid.length > 0 && (show.kcal || show.macros) && <NutriInline n={total} showKcal={show.kcal} showMacros={show.macros} />}
          <label className="field">
            <span className="field__label">Descreva com suas palavras (opcional)</span>
            <textarea name="foods" rows={2} maxLength={1000} defaultValue={initial && !initial.items.length ? initial.foods : ''} placeholder="Ex.: 2 fatias de pizza de muçarela e refrigerante" />
          </label>
        </>
      )}

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ width: 130 }}>
          <span className="field__label">Horário</span>
          <input type="time" name="time" defaultValue={initial?.time ?? time} required />
        </label>
        <label className="field" style={{ flex: '1 1 200px' }}>
          <span className="field__label">Foto do prato (opcional)</span>
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" capture="environment" />
        </label>
      </div>
      {photoNote && <p className="small muted" style={{ margin: 0 }}>{photoNote}</p>}

      {details ? (
        <>
          <EmojiScale name="hunger" legend="Fome antes de comer" options={HUNGER} initial={initial?.hunger ?? null} />
          <EmojiScale name="satiety" legend="Saciedade depois" options={SATIETY} initial={initial?.satiety ?? null} />
          <EmojiScale name="mood" legend="Como você está se sentindo?" options={MOOD} initial={initial?.mood ?? null} />
          <label className="field">
            <span className="field__label">Observação (opcional)</span>
            <textarea name="notes" rows={2} maxLength={1000} defaultValue={initial?.notes ?? ''} />
          </label>
        </>
      ) : (
        <button type="button" className="link-btn small" onClick={() => setDetails(true)} style={{ alignSelf: 'flex-start' }}>
          + Fome, saciedade, humor e observação
        </button>
      )}

      {state.error && (
        <p className="alert alert--error" role="alert" style={{ margin: 0 }}>
          {state.error}
        </p>
      )}
      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={pending || (!!meal && !choice)}>
          {pending ? 'Salvando…' : 'Salvar no diário'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => onClose()}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function EmojiScale({ name, legend, options, initial }: { name: string; legend: string; options: readonly (readonly [string, string])[]; initial: number | null }) {
  return (
    <fieldset className="emoji-scale">
      <legend>{legend}</legend>
      <div>
        {options.map(([emoji, label], i) => (
          <label key={i} title={label}>
            <input type="radio" name={name} value={i + 1} defaultChecked={initial === i + 1} />
            <span aria-hidden>{emoji}</span>
            <span className="emoji-scale__label">{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
