'use client'

import { startTransition, useOptimistic, useState, type ReactNode } from 'react'
import { optionTotals, quantityLabel, sortedMeals, type PlanDay, type PlanMeal } from '@/lib/plan'
import { fmt, sum, times, ZERO } from '@/lib/nutricao'
import { KcalRing, MacroBars, NutriInline } from './MacroBars'

export type MealLog = { status: 'feita' | 'parcial' | 'pulada'; optionId: string | null }

export type TodayData = {
  firstName: string
  dateLabel: string
  nowTime: string
  planTitle: string | null
  mode: 'calculado' | 'livre'
  day: PlanDay | null
  logs: Record<string, MealLog>
  waterMl: number
  waterGoalMl: number
  features: { calorias: boolean; macros: boolean; agua: boolean; peso: boolean; chat: boolean; diario: boolean }
  nextAppointment: { when: string; label: string; meetingUrl: string | null } | null
  guidance: string | null
  lastWeight: { value: number; date: string } | null
}

export type TodayActions = {
  setMeal: (mealKey: string, optionId: string, status: string) => Promise<void>
  water: (delta: number) => Promise<void>
}

const STATUS_LABEL = { feita: 'Feita', parcial: 'Parcial', pulada: 'Pulada' } as const
const STATUS_TONE = { feita: 'badge--ok', parcial: 'badge--warn', pulada: 'badge--plain' } as const
const FACTOR = { feita: 1, parcial: 0.5, pulada: 0 } as const

/**
 * Tela “Hoje”: em até dois toques o paciente sabe o que comer agora.
 * Recebe dados prontos e ações (Server Actions no sistema, funções locais na prévia).
 */
export function TodayView({ data, actions, links, weightForm }: { data: TodayData; actions: TodayActions; links: Record<'plan' | 'chat' | 'diary' | 'progress', string>; weightForm?: ReactNode }) {
  const [logs, setLogOptimistic] = useOptimistic(data.logs, (cur, upd: { key: string; log: MealLog | null }) => {
    const next = { ...cur }
    if (upd.log) next[upd.key] = upd.log
    else delete next[upd.key]
    return next
  })
  const [water, addWaterOptimistic] = useOptimistic(data.waterMl, (cur, delta: number) => Math.max(0, cur + delta))
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const day = data.day
  const calc = data.mode === 'calculado'
  const meals = day ? sortedMeals(day) : []
  const keyOf = (m: PlanMeal) => `${day!.id}:${m.id}`
  const optionOf = (m: PlanMeal) => m.options.find((o) => o.id === (logs[keyOf(m)]?.optionId ?? chosen[m.id])) ?? m.options[0]

  const planned = sum(meals.map((m) => optionTotals(optionOf(m))))
  const consumed = sum(
    meals.map((m) => {
      const log = logs[keyOf(m)]
      return log ? times(optionTotals(optionOf(m)), FACTOR[log.status]) : ZERO
    }),
  )
  const pending = meals.filter((m) => !logs[keyOf(m)])
  const next = pending.find((m) => !m.time || m.time >= minus(data.nowTime, 60)) ?? pending[0] ?? null
  const allDone = meals.length > 0 && pending.length === 0

  const mark = (m: PlanMeal, status: MealLog['status'] | null) => {
    const opt = optionOf(m)
    startTransition(async () => {
      setLogOptimistic({ key: keyOf(m), log: status ? { status, optionId: opt.id } : null })
      await actions.setMeal(keyOf(m), opt.id, status ?? '')
    })
  }
  const addWater = (delta: number) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12)
    startTransition(async () => {
      addWaterOptimistic(delta)
      await actions.water(delta)
    })
  }
  const cups = Math.max(1, Math.ceil(data.waterGoalMl / 250))
  const fullCups = Math.floor(water / 250)

  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>Olá, {data.firstName}!</h1>
        <p className="muted" style={{ margin: 0, textTransform: 'none' }}>
          {data.dateLabel}
        </p>
      </div>

      {!day ? (
        <div className="empty">
          <p style={{ margin: 0 }}>Seu nutricionista ainda está montando seu plano. Assim que ele for ativado, ele aparece aqui.</p>
        </div>
      ) : (
        <div className="today-grid">
          <div className="stack" style={{ ['--gap' as string]: '16px' }}>
            {/* Próxima refeição */}
            {next ? (
              <section className="card next-meal" aria-labelledby="next-meal-title">
                <span className="eyebrow">Agora</span>
                <h2 id="next-meal-title" style={{ margin: '0 0 4px' }}>
                  {next.name}
                  {next.time && <span className="muted" style={{ fontWeight: 500 }}> · {next.time.replace(':00', 'h').replace(':', 'h')}</span>}
                </h2>
                {next.options.length > 1 && (
                  <div className="option-tabs" role="group" aria-label="Escolha a opção" style={{ margin: '8px 0' }}>
                    {next.options.map((o) => (
                      <button key={o.id} type="button" className="btn btn--sm" aria-pressed={o.id === optionOf(next).id} onClick={() => setChosen((c) => ({ ...c, [next.id]: o.id }))}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
                <ul className="list" style={{ margin: '8px 0 12px' }}>
                  {optionOf(next).items.map((it) => (
                    <li key={it.id} className="row row--between" style={{ padding: '8px 0' }}>
                      <span>{it.name}</span>
                      <span className="muted nowrap">{quantityLabel(it)}</span>
                    </li>
                  ))}
                </ul>
                {calc && <NutriInline n={optionTotals(optionOf(next))} showKcal={data.features.calorias} showMacros={data.features.macros} />}
                <div className="meal-status-actions" style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn--primary" onClick={() => mark(next, 'feita')}>
                    Marcar como feita
                  </button>
                  <button type="button" className="btn" onClick={() => mark(next, 'parcial')}>
                    Fiz em parte
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => mark(next, 'pulada')}>
                    Pulei
                  </button>
                </div>
              </section>
            ) : allDone ? (
              <section className="card card--soft celebrate" aria-live="polite">
                <h2 style={{ marginTop: 0 }}>Todas as refeições de hoje registradas!</h2>
                <p style={{ margin: 0 }}>Cada registro ajuda no seu acompanhamento. Amanhã é um novo dia.</p>
                <Confetti />
              </section>
            ) : null}

            {/* Linha do tempo */}
            <section className="card">
              <div className="card__head">
                <h2>Refeições de hoje</h2>
                <a href={links.plan} className="small">
                  Ver plano
                </a>
              </div>
              <ol className="timeline-day">
                {meals.map((m) => {
                  const log = logs[keyOf(m)]
                  return (
                    <li key={m.id}>
                      <time>{m.time || '—'}</time>
                      <span>
                        <strong>{m.name}</strong>
                        {log && log.status !== 'pulada' && m.options.length > 1 && <span className="small muted"> · {optionOf(m).label}</span>}
                      </span>
                      <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        {log ? (
                          <>
                            <span className={`badge ${STATUS_TONE[log.status]}`}>{STATUS_LABEL[log.status]}</span>
                            <button type="button" className="link-btn small" aria-label={`Desfazer registro de ${m.name}`} onClick={() => mark(m, null)}>
                              desfazer
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="badge badge--plain">Pendente</span>
                            <button type="button" className="btn btn--sm" aria-label={`Marcar ${m.name} como feita`} onClick={() => mark(m, 'feita')}>
                              ✓
                            </button>
                          </>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </section>
          </div>

          <div className="stack" style={{ ['--gap' as string]: '16px' }}>
            {calc && (data.features.calorias || data.features.macros) && (
              <section className="card">
                <div className="card__head">
                  <h2>Seu dia</h2>
                  <span className="small muted">consumido × planejado</span>
                </div>
                <div className="row" style={{ gap: 18, alignItems: 'center' }}>
                  {data.features.calorias && <KcalRing value={consumed.kcal} target={planned.kcal} />}
                  {data.features.macros && (
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <MacroBars value={consumed} target={planned} />
                    </div>
                  )}
                </div>
              </section>
            )}

            {data.features.agua && (
              <section className="card">
                <div className="card__head">
                  <h2>Água</h2>
                  <span className="small">
                    <strong>{fmt(water / 1000, 2)} L</strong> de {fmt(data.waterGoalMl / 1000, 1)} L
                  </span>
                </div>
                <div className="water" role="group" aria-label={`Copos de 250 ml: ${fullCups} de ${cups}`}>
                  {Array.from({ length: cups }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className="water__cup"
                      data-full={i < fullCups}
                      aria-label={i < fullCups ? `Copo ${i + 1} registrado (toque para tirar)` : `Registrar copo ${i + 1} (+250 ml)`}
                      onClick={() => addWater(i < fullCups ? -250 : 250)}
                    />
                  ))}
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn--primary" onClick={() => addWater(250)}>
                    + 250 ml
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => addWater(-250)} disabled={water <= 0}>
                    − 250 ml
                  </button>
                </div>
              </section>
            )}

            {data.nextAppointment && (
              <section className="card">
                <div className="card__head">
                  <h2>Próxima consulta</h2>
                </div>
                <p className="stat__value" style={{ fontSize: '1.3rem', margin: 0 }}>
                  {data.nextAppointment.when}
                </p>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {data.nextAppointment.label}
                </p>
                {data.nextAppointment.meetingUrl && (
                  <a href={data.nextAppointment.meetingUrl} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--sm" style={{ marginTop: 10 }}>
                    Entrar na videochamada
                  </a>
                )}
              </section>
            )}

            {data.guidance && (
              <section className="card card--soft">
                <h2 style={{ fontSize: '1.05rem' }}>Orientação do dia</h2>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{data.guidance}</p>
              </section>
            )}

            <section className="card">
              <h2 className="sr-only">Atalhos</h2>
              <div className="grid-2">
                {data.features.diario && (
                  <a href={links.diary} className="btn btn--block">
                    Registrar refeição ou foto
                  </a>
                )}
                {data.features.chat && (
                  <a href={links.chat} className="btn btn--block">
                    Falar com o nutricionista
                  </a>
                )}
                <a href={links.progress} className="btn btn--block">
                  Meu progresso
                </a>
              </div>
              {data.features.peso && weightForm}
              {data.lastWeight && data.features.peso && (
                <p className="small muted" style={{ margin: '8px 0 0' }}>
                  Último peso registrado: {fmt(data.lastWeight.value)} kg em {data.lastWeight.date}
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function minus(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number)
  const t = Math.max(0, h * 60 + m - minutes)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Confete discreto (desligado para quem pede menos movimento). */
function Confetti() {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{ left: `${(i * 7 + 3) % 100}%`, animationDelay: `${(i % 5) * 0.12}s`, background: ['var(--macro-protein)', 'var(--macro-carbs)', 'var(--macro-fat)', 'var(--brand)'][i % 4] }} />
      ))}
    </div>
  )
}
