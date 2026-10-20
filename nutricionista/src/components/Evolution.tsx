import type { schema } from '@/db'
import { fmtDay } from '@/lib/time'
import { num } from '@/lib/format'
import { bmi, goalProgress, METRICS, series, type MetricKey } from '@/lib/patient-data'
import { SKINFOLDS, type SkinfoldKey } from '@/lib/nutricao'
import { LineChart } from './LineChart'
import { SourceBadge, StatusBadge } from './ui'

type M = typeof schema.measurements.$inferSelect
type G = typeof schema.goals.$inferSelect

/** Gráficos (um por medida), metas, comparação e histórico. Compartilhado entre paciente e painel. */
export function Evolution({
  rows,
  goals,
  compare,
  basePath,
  onToggleGoal,
}: {
  rows: M[]
  goals: G[]
  compare: { a?: string; b?: string }
  basePath: string
  /** Na área do paciente: marcar/desmarcar meta como concluída. */
  onToggleGoal?: (id: string) => Promise<void>
}) {
  const goalFor = (k: MetricKey) => goals.find((g) => g.status === 'ativa' && g.metric === k)?.targetValue ?? null
  const charts = (Object.keys(METRICS) as MetricKey[]).filter((k) => series(rows, k).length > 0)
  const pro = rows.filter((r) => r.source === 'profissional')
  const A = pro.find((r) => r.id === compare.a) ?? pro[0]
  const B = pro.find((r) => r.id === compare.b) ?? pro[pro.length - 1]

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      {charts.length === 0 ? (
        <p className="empty">Ainda não há medidas registradas.</p>
      ) : (
        <div className="grid-2">
          {charts.map((k) => (
            <section key={k} className="card">
              <h3>
                {METRICS[k].label} ({METRICS[k].unit})
              </h3>
              <LineChart title={METRICS[k].label} points={series(rows, k)} unit={METRICS[k].unit} target={goalFor(k)} />
              {k === 'bodyFatPct' && (
                <p className="muted small" style={{ margin: '8px 0 0' }}>
                  Percentual estimado na avaliação profissional; o método de cada medição aparece no histórico.
                </p>
              )}
            </section>
          ))}
        </div>
      )}

      <section className="card" id="metas">
        <h2 style={{ fontSize: '1.15rem' }}>Metas</h2>
        {goals.length === 0 ? (
          <p className="muted">Nenhuma meta definida.</p>
        ) : (
          <ul className="list">
            {goals.map((g) => {
              const p = goalProgress(g, rows)
              return (
                <li key={g.id}>
                  <div className="row row--between">
                    {onToggleGoal && g.status !== 'cancelada' ? (
                      <form action={onToggleGoal.bind(null, g.id)}>
                        <button type="submit" className="goal-check" role="checkbox" aria-checked={g.status === 'concluida'}>
                          <span className="goal-check__box" aria-hidden>
                            {g.status === 'concluida' ? '✓' : ''}
                          </span>
                          <span className="goal-check__text">{g.title}</span>
                        </button>
                      </form>
                    ) : (
                      <strong>{g.title}</strong>
                    )}
                    <StatusBadge status={g.status} label={g.status === 'ativa' ? 'Em andamento' : undefined} />
                  </div>
                  {g.description && <div className="small muted">{g.description}</div>}
                  {g.targetValue != null && (
                    <div className="small">
                      {g.startValue != null && `Início: ${num(g.startValue)} ${g.unit ?? ''} · `}Meta: {num(g.targetValue)} {g.unit ?? ''}
                      {g.dueDate && ` · prazo ${fmtDay(g.dueDate)}`}
                    </div>
                  )}
                  {p != null && (
                    <div className="progress" style={{ marginTop: 6 }} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso da meta ${g.title}`}>
                      <span style={{ width: `${p}%` }} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {pro.length >= 2 && A && B && (
        <section className="card">
          <h2 style={{ fontSize: '1.15rem' }}>Comparar avaliações</h2>
          <form method="get" action={basePath} className="row" style={{ marginBottom: 12 }}>
            <input type="hidden" name="aba" value="evolucao" />
            <label className="field" style={{ flex: 1, minWidth: 150 }}>
              <span className="field__label">De</span>
              <select name="a" defaultValue={A.id}>
                {pro.map((r) => (
                  <option key={r.id} value={r.id}>
                    {fmtDay(r.date)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ flex: 1, minWidth: 150 }}>
              <span className="field__label">Para</span>
              <select name="b" defaultValue={B.id}>
                {pro.map((r) => (
                  <option key={r.id} value={r.id}>
                    {fmtDay(r.date)}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>
              Comparar
            </button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th className="num">{fmtDay(A.date)}</th>
                  <th className="num">{fmtDay(B.date)}</th>
                  <th className="num">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(METRICS) as MetricKey[])
                  .filter((k) => A[k] != null || B[k] != null)
                  .map((k) => {
                    const a = A[k] as number | null
                    const b = B[k] as number | null
                    const diff = a != null && b != null ? b - a : null
                    return (
                      <tr key={k}>
                        <td>
                          {METRICS[k].label} ({METRICS[k].unit})
                        </td>
                        <td className="num">{num(a)}</td>
                        <td className="num">{num(b)}</td>
                        <td className="num">{diff == null ? '—' : `${diff > 0 ? '+' : ''}${num(diff)}`}</td>
                      </tr>
                    )
                  })}
                <tr>
                  <td>Relação cintura-quadril</td>
                  <td className="num">{A.waistCm && A.hipCm ? num(A.waistCm / A.hipCm, 2) : '—'}</td>
                  <td className="num">{B.waistCm && B.hipCm ? num(B.waistCm / B.hipCm, 2) : '—'}</td>
                  <td className="num">—</td>
                </tr>
                <tr>
                  <td>IMC (calculado)</td>
                  <td className="num">{num(bmi(A.weightKg, A.heightCm))}</td>
                  <td className="num">{num(bmi(B.weightKg, B.heightCm))}</td>
                  <td className="num">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Apenas medições profissionais entram na comparação. O IMC é um indicador de triagem e não avalia composição corporal.
          </p>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: '1.15rem' }}>Histórico de registros</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Origem</th>
                <th className="num">Peso</th>
                <th className="num">Cintura</th>
                <th className="num">Quadril</th>
                <th className="num">Gordura</th>
                <th className="num">Massa magra</th>
                <th>Dobras e observações</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{fmtDay(r.date)}</td>
                  <td>
                    <SourceBadge source={r.source} />
                  </td>
                  <td className="num">{num(r.weightKg)}</td>
                  <td className="num">{num(r.waistCm)}</td>
                  <td className="num">{num(r.hipCm)}</td>
                  <td className="num">
                    {r.bodyFatPct != null ? `${num(r.bodyFatPct)}%` : '—'}
                    {r.bodyFatMethod && <div className="small muted">{r.bodyFatMethod}</div>}
                  </td>
                  <td className="num">{r.leanMassKg != null ? `${num(r.leanMassKg)} kg` : '—'}</td>
                  <td className="small">
                    {r.skinfolds && Object.keys(r.skinfolds).length > 0 && (
                      <div>
                        {Object.entries(r.skinfolds)
                          .map(([k, v]) => `${SKINFOLDS[k as SkinfoldKey] ?? k} ${num(v)}`)
                          .join(' · ')}{' '}
                        mm
                      </div>
                    )}
                    {r.bioimpedance && Object.keys(r.bioimpedance).length > 0 && (
                      <div>
                        Bioimpedância:{' '}
                        {[
                          r.bioimpedance.fatPct != null && `gordura ${num(r.bioimpedance.fatPct)}%`,
                          r.bioimpedance.muscleKg != null && `músculo ${num(r.bioimpedance.muscleKg)} kg`,
                          r.bioimpedance.waterPct != null && `água ${num(r.bioimpedance.waterPct)}%`,
                          r.bioimpedance.visceral != null && `visceral ${num(r.bioimpedance.visceral)}`,
                          r.bioimpedance.bmrKcal != null && `TMB ${num(r.bioimpedance.bmrKcal, 0)} kcal`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                    {r.notes}
                    {r.extra.map((x) => (
                      <div key={x.label}>
                        {x.label}: {num(x.value)} {x.unit}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
