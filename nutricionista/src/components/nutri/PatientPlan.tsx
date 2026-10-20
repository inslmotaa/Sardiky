'use client'

import { useState } from 'react'
import { dayForWeekday, dayTotals, itemNutrients, optionTotals, quantityLabel, sortedMeals, type PlanContent } from '@/lib/plan'
import { scale } from '@/lib/nutricao'
import { KcalRing, MacroBars, NutriInline } from './MacroBars'

export type ViewFeatures = { calorias: boolean; macros: boolean }

/**
 * Plano alimentar como o paciente vê: dias (ex.: treino × descanso), opções por
 * refeição e o botão “Trocar” com as substituições já com quantidade recalculada.
 */
export function PatientPlan({
  content,
  features = { calorias: true, macros: true },
  weekday,
  recipeBase = '/paciente/receitas/',
}: {
  content: PlanContent
  features?: ViewFeatures
  weekday?: number
  /** Início do link da receita vinculada ao item (o item aponta para “r:<id>”). */
  recipeBase?: string
}) {
  const initialDay = weekday != null ? dayForWeekday(content, weekday) : content.days[0]
  const [dayId, setDayId] = useState(initialDay?.id ?? '')
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [swapOpen, setSwapOpen] = useState<string | null>(null)
  const day = content.days.find((d) => d.id === dayId) ?? content.days[0]
  if (!day) return null
  const calc = content.mode === 'calculado'
  const totals = dayTotals(day, chosen)
  const showNumbers = calc && (features.calorias || features.macros)

  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
      {content.days.length > 1 && (
        <div className="segmented" role="tablist" aria-label="Dia do plano">
          {content.days.map((d) => (
            <a
              key={d.id}
              href="#"
              role="tab"
              aria-selected={d.id === day.id}
              aria-current={d.id === day.id ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                setDayId(d.id)
              }}
            >
              {d.label}
            </a>
          ))}
        </div>
      )}

      {showNumbers && (
        <section className="card row" style={{ gap: 20, alignItems: 'center' }}>
          {features.calorias && <KcalRing value={totals.kcal} target={content.targets.kcal ?? totals.kcal} label="kcal planejadas" />}
          {features.macros && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <p className="small muted" style={{ margin: '0 0 8px' }}>
                Total planejado para {day.label.toLowerCase()}
              </p>
              <MacroBars
                value={totals}
                target={{ protein: content.targets.protein ?? totals.protein, carbs: content.targets.carbs ?? totals.carbs, fat: content.targets.fat ?? totals.fat }}
              />
            </div>
          )}
        </section>
      )}

      {sortedMeals(day).map((m) => {
        const opt = m.options.find((o) => o.id === chosen[m.id]) ?? m.options[0]
        const sub = optionTotals(opt)
        return (
          <section key={m.id} className="meal" aria-labelledby={`meal-${m.id}`}>
            <header className="meal__head" style={{ flexWrap: 'wrap' }}>
              {m.time && <span className="meal__time">{m.time}</span>}
              <h3 id={`meal-${m.id}`}>{m.name}</h3>
              {calc && <span style={{ marginLeft: 'auto' }}><NutriInline n={sub} showKcal={features.calorias} showMacros={false} /></span>}
            </header>
            {m.options.length > 1 && (
              <div className="option-tabs no-print" style={{ padding: '10px 18px 0' }} role="group" aria-label="Opções desta refeição">
                {m.options.map((o) => (
                  <button key={o.id} type="button" className="btn btn--sm" aria-pressed={o.id === opt.id} onClick={() => setChosen((c) => ({ ...c, [m.id]: o.id }))}>
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            <ul className="meal__items">
              {opt.items.map((it) => {
                const n = itemNutrients(it)
                const key = `${m.id}:${it.id}`
                return (
                  <li key={it.id}>
                    <div className="food">
                      <span className="food__name">
                        {it.foodId?.startsWith('r:') ? (
                          <a href={`${recipeBase}${it.foodId.slice(2)}`}>
                            {it.name.replace(/^Receita: /, '')} <span className="small">· ver receita</span>
                          </a>
                        ) : (
                          it.name
                        )}
                      </span>
                      <span className="food__qty">{quantityLabel(it)}</span>
                    </div>
                    {it.notes && <div className="small muted">{it.notes}</div>}
                    {n && <NutriInline n={n} showKcal={features.calorias} showMacros={features.macros} />}
                    {it.subs.length > 0 && !it.locked && (
                      <div className="subs">
                        <button type="button" className="link-btn small no-print" aria-expanded={swapOpen === key} onClick={() => setSwapOpen(swapOpen === key ? null : key)}>
                          Trocar ({it.subs.length} {it.subs.length === 1 ? 'opção' : 'opções'})
                        </button>
                        <div hidden={swapOpen !== key} className="print-block">
                          <strong>Substituições autorizadas:</strong>
                          <ul>
                            {it.subs.map((s, i) => (
                              <li key={i}>
                                {s.name} — {quantityLabel(s) || '—'}
                                {calc && s.per100 && s.grams != null && features.calorias && (
                                  <span className="muted"> · {Math.round(scale(s.per100, s.grams).kcal)} kcal</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
              {opt.items.length === 0 && <li className="muted">Sem itens.</li>}
            </ul>
            {m.notes && (
              <p className="small meal__note">
                <strong>Observação:</strong> {m.notes}
              </p>
            )}
          </section>
        )
      })}

      {content.guidance && (
        <section className="card card--soft">
          <h3>Orientações do nutricionista</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{content.guidance}</p>
        </section>
      )}
    </div>
  )
}
