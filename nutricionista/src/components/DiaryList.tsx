import type { schema } from '@/db'
import { ADHERENCE_LABEL } from '@/lib/format'
import { fmtDayLong } from '@/lib/time'

type Entry = typeof schema.diaryEntries.$inferSelect

/** Lista do diário agrupada por dia. Usada na área do paciente e no prontuário. */
export function DiaryList({
  entries,
  onDelete,
  commentAction,
}: {
  entries: Entry[]
  onDelete?: (id: string) => Promise<void>
  commentAction?: (id: string, fd: FormData) => Promise<void>
}) {
  const byDay = new Map<string, Entry[]>()
  for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e])
  return (
    <div className="stack">
      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} className="card">
          <h3 style={{ textTransform: 'capitalize' }}>{fmtDayLong(day)}</h3>
          <ul className="list">
            {list.map((e) => (
              <li key={e.id}>
                <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong>
                      {e.time} · {e.meal}
                    </strong>
                    {e.adherence && (
                      <span className={`badge ${e.adherence === 'total' ? 'badge--ok' : e.adherence === 'parcial' ? 'badge--warn' : 'badge--danger'}`} style={{ marginLeft: 8 }}>
                        {ADHERENCE_LABEL[e.adherence]}
                      </span>
                    )}
                    <div>{e.foods}</div>
                    {e.quantity && <div className="small muted">Quantidade: {e.quantity}</div>}
                    {(e.hunger || e.satiety) && (
                      <div className="small muted">
                        {e.hunger ? `Fome ${e.hunger}/5` : ''}
                        {e.hunger && e.satiety ? ' · ' : ''}
                        {e.satiety ? `Saciedade ${e.satiety}/5` : ''}
                      </div>
                    )}
                    {e.notes && <div className="small">“{e.notes}”</div>}
                    {e.professionalComment && (
                      <p className="alert alert--info small" style={{ margin: '8px 0 0' }}>
                        <strong>Nutricionista:</strong> {e.professionalComment}
                      </p>
                    )}
                    {commentAction && !e.professionalComment && (
                      <form action={commentAction.bind(null, e.id)} className="row" style={{ marginTop: 8 }}>
                        <input name="comment" placeholder="Comentar este registro" maxLength={500} style={{ flex: 1, minWidth: 180 }} aria-label="Comentário" />
                        <button className="btn btn--sm" type="submit">
                          Comentar
                        </button>
                      </form>
                    )}
                  </div>
                  {e.photoFileId && (
                    <a href={`/arquivos/${e.photoFileId}`} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/arquivos/${e.photoFileId}`} alt={`Foto: ${e.meal}`} style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10 }} />
                    </a>
                  )}
                </div>
                {onDelete && !e.professionalComment && (
                  <form action={onDelete.bind(null, e.id)}>
                    <button className="link-btn small" type="submit" style={{ color: 'var(--muted)' }}>
                      Excluir
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
