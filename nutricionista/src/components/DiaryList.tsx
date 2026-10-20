import type { schema } from '@/db'
import { ADHERENCE_LABEL } from '@/lib/format'
import { fmt, scale } from '@/lib/nutricao'
import { itemsNutrients } from '@/lib/plan'
import { capitalize, fmtDayLong } from '@/lib/time'
import { Feelings } from './nutri/DiaryDay'

type Entry = typeof schema.diaryEntries.$inferSelect
export type DayMealStatus = { name: string; time: string; status: string | null }

const STATUS = { feita: ['Feita', 'badge--ok'], parcial: ['Parcial', 'badge--warn'], pulada: ['Pulada', 'badge--plain'], outra: ['Outra coisa', 'badge--plain'] } as Record<string, [string, string]>

/** Diário agrupado por dia, para o prontuário: refeições do plano marcadas, registros e consumo. */
export function DiaryList({
  days,
  commentAction,
}: {
  days: { date: string; kcal: number | null; plannedKcal: number | null; meals: DayMealStatus[]; entries: Entry[] }[]
  commentAction?: (id: string, fd: FormData) => Promise<void>
}) {
  return (
    <div className="stack">
      {days.map((d) => (
        <section key={d.date} className="card">
          <div className="row row--between">
            <h3 style={{ margin: 0 }}>{capitalize(fmtDayLong(d.date))}</h3>
            {d.kcal != null && (
              <span className="small muted">
                {fmt(d.kcal, 0)} kcal registradas{d.plannedKcal ? ` de ${fmt(d.plannedKcal, 0)} planejadas` : ''}
              </span>
            )}
          </div>
          {d.meals.length > 0 && (
            <div className="row small" style={{ gap: 6, marginTop: 8 }}>
              {d.meals.map((m) => {
                const [label, tone] = m.status ? STATUS[m.status] ?? [m.status, 'badge--plain'] : ['Sem registro', 'badge--plain']
                return (
                  <span key={m.name} className={`badge ${tone}`} title={m.time}>
                    {m.name}: {label}
                  </span>
                )
              })}
            </div>
          )}
          {d.entries.length > 0 && (
            <ul className="list" style={{ marginTop: 8 }}>
              {d.entries.map((e) => {
                const n = e.items?.length ? itemsNutrients(e.items) : null
                return (
                  <li key={e.id}>
                    <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong>
                          {e.time} · {e.meal}
                        </strong>
                        {e.adherence && (
                          <span className={`badge ${e.adherence === 'total' ? 'badge--ok' : e.adherence === 'parcial' ? 'badge--warn' : 'badge--plain'}`} style={{ marginLeft: 8 }}>
                            {ADHERENCE_LABEL[e.adherence]}
                          </span>
                        )}
                        <div>{e.foods}</div>
                        {e.items?.length > 0 && (
                          <div className="small muted">
                            {e.items.map((it) => `${it.name} ${it.grams} g${it.per100 ? ` (${fmt(scale(it.per100, it.grams).kcal, 0)} kcal)` : ''}`).join(' · ')}
                            {n && ` · total ${fmt(n.kcal, 0)} kcal, P ${fmt(n.protein)} g, C ${fmt(n.carbs)} g, G ${fmt(n.fat)} g`}
                          </div>
                        )}
                        {e.quantity && <div className="small muted">Quantidade: {e.quantity}</div>}
                        <Feelings e={e} />
                        {e.notes && <div className="small">“{e.notes}”</div>}
                        {e.professionalComment && (
                          <p className="alert alert--info small" style={{ margin: '8px 0 0' }}>
                            <strong>Seu comentário:</strong> {e.professionalComment}
                          </p>
                        )}
                        {commentAction && (
                          <form action={commentAction.bind(null, e.id)} className="row" style={{ marginTop: 8 }}>
                            <input name="comment" placeholder={e.professionalComment ? 'Responder no chat' : 'Comentar este registro'} maxLength={1000} style={{ flex: 1, minWidth: 180 }} aria-label={`Comentário sobre ${e.meal}`} />
                            {!e.professionalComment && (
                              <button className="btn btn--sm" type="submit" name="intent" value="comment">
                                Comentar
                              </button>
                            )}
                            <button className="btn btn--sm" type="submit" name="intent" value="chat">
                              Responder no chat
                            </button>
                          </form>
                        )}
                      </div>
                      {e.photoFileId && (
                        <a href={`/arquivos/${e.photoFileId}`} target="_blank" rel="noopener noreferrer" className="diary-photo">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/arquivos/${e.photoFileId}`} alt={`Foto: ${e.meal}`} />
                        </a>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
