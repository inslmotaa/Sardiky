import type { EvolutionData } from '@/lib/evolucao'
import { fmtKgDelta } from '@/lib/corpo'
import { LineChart } from './LineChart'

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const n1 = (v: number) => v.toFixed(1).replace('.', ',')
const TAG = { peso: 'Peso', imc: 'IMC', medidas: 'Medidas', altura: 'Altura', fotos: 'Fotos', checkin: 'Check-in' } as const

/** Resumo ("desde o início", "últimos 30 dias"), gráficos de peso e IMC com a meta e a linha do tempo. */
export function EvolutionOverview({ data, who = 'cliente' }: { data: EvolutionData; who?: 'cliente' | 'coach' }) {
  const s = data.summary
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <section className="card" aria-labelledby="resumo-evolucao">
        <h2 id="resumo-evolucao" style={{ fontSize: '1.15rem' }}>
          Resumo
        </h2>
        <div className="stat-row">
          <div className="stat">
            <strong>{s.sinceStart ? fmtKgDelta(s.sinceStart.kg) : '—'}</strong>
            <span>desde o início{s.sinceStart ? ` (${s.sinceStart.label.split(' em ')[1]})` : ''}</span>
          </div>
          <div className="stat">
            <strong>{s.last30 != null ? fmtKgDelta(s.last30) : '—'}</strong>
            <span>nos últimos 30 dias</span>
          </div>
          <div className="stat">
            <strong>{s.lastWeight ? `${n1(s.lastWeight.value)} kg` : '—'}</strong>
            <span>{s.lastWeight ? `peso em ${dm(s.lastWeight.date)}` : 'sem peso registrado'}</span>
          </div>
          <div className="stat">
            <strong>{s.lastBmi ? n1(s.lastBmi.value) : '—'}</strong>
            <span>IMC atual</span>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <h3>Peso (kg)</h3>
          <LineChart title="Peso" points={data.weights} unit="kg" target={data.weightGoal} />
          {data.weightGoal != null && <p className="small muted" style={{ margin: '6px 0 0' }}>Linha tracejada: meta de {n1(data.weightGoal)} kg.</p>}
        </section>
        <section className="card">
          <h3>IMC</h3>
          <LineChart title="IMC" points={data.bmis} unit="" target={data.bmiGoal} />
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            Cada ponto usa a altura vigente naquela data.{data.bmiGoal != null ? ` Meta: ${n1(data.bmiGoal)}.` : ''}
          </p>
        </section>
      </div>

      <section className="card" aria-labelledby="linha-do-tempo">
        <h2 id="linha-do-tempo" style={{ fontSize: '1.15rem' }}>
          Linha do tempo
        </h2>
        {data.timeline.length === 0 ? (
          <p className="empty">{who === 'cliente' ? 'Assim que você registrar peso, medidas, fotos ou check-ins, eles aparecem aqui.' : 'Nada registrado ainda.'}</p>
        ) : (
          <ol className="evo-timeline" aria-label="Evolução por data">
            {data.timeline.map((d) => (
              <li key={d.date}>
                <time dateTime={d.date}>{dm(d.date)}</time>
                <ul>
                  {d.items.map((it, i) => (
                    <li key={i}>
                      <span className="evo-tag">{TAG[it.kind]}</span> {it.text}
                      {it.kind === 'fotos' && (
                        <>
                          <div className="evo-thumbs">
                            {it.thumbs.map((t) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={t} src={t} alt="" loading="lazy" />
                            ))}
                          </div>
                          {it.comment && <p className="photo-set__comment">Comentário do coach: {it.comment}</p>}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
