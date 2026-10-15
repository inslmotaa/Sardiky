import { fmtDay } from '@/lib/time'
import { num } from '@/lib/format'

export type ChartPoint = { date: string; value: number; source: 'profissional' | 'paciente' }

/**
 * Gráfico de linha em SVG gerado no servidor (sem bibliotecas no navegador).
 * - Pontos cheios: medição profissional. Pontos vazados: informado pelo paciente.
 * - Cada ponto traz a data e a origem no tooltip nativo e no rótulo acessível.
 * - Uma série por gráfico: medidas diferentes ficam em gráficos separados (sem eixo duplo).
 */
export function LineChart({
  title,
  points,
  unit,
  target,
  height = 220,
}: {
  title: string
  points: ChartPoint[]
  unit: string
  target?: number | null
  height?: number
}) {
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date))
  if (data.length === 0) return <p className="muted small">Ainda não há registros de {title.toLowerCase()}.</p>

  const W = 640
  const H = height
  const pad = { top: 16, right: 56, bottom: 30, left: 44 }
  const t = (d: string) => Date.parse(d + 'T12:00:00Z')
  const t0 = t(data[0].date)
  const t1 = Math.max(t(data[data.length - 1].date), t0 + 86_400_000)

  const values = data.map((p) => p.value).concat(target != null ? [target] : [])
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.05)
  lo -= span * 0.15
  hi += span * 0.15
  const ticks = niceTicks(lo, hi, 4)
  lo = Math.min(lo, ticks[0])
  hi = Math.max(hi, ticks[ticks.length - 1])

  const x = (d: string) => pad.left + ((t(d) - t0) / (t1 - t0)) * (W - pad.left - pad.right)
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * (H - pad.top - pad.bottom)
  const path = data.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = data[data.length - 1]
  const first = data[0]
  const hasPatient = data.some((p) => p.source === 'paciente')
  const hasPro = data.some((p) => p.source === 'profissional')

  const xLabels = data.length === 1 ? [first] : [first, last]

  return (
    <figure style={{ margin: 0 }}>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}: de ${num(first.value)} ${unit} em ${fmtDay(first.date)} para ${num(last.value)} ${unit} em ${fmtDay(last.date)}, ${data.length} registros.`}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid-line" x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} />
            <text x={pad.left - 8} y={y(v) + 4} textAnchor="end">
              {num(v)}
            </text>
          </g>
        ))}
        {target != null && (
          <g>
            <line className="target-line" x1={pad.left} x2={W - pad.right} y1={y(target)} y2={y(target)} />
            <text x={W - pad.right + 6} y={y(target) + 4}>
              meta
            </text>
          </g>
        )}
        <path className="series-line" d={path} />
        {data.map((p, i) => (
          <g key={i}>
            <circle className="hit" cx={x(p.date)} cy={y(p.value)} r={12}>
              <title>
                {fmtDay(p.date)}: {num(p.value)} {unit} — {p.source === 'profissional' ? 'medição profissional' : 'informado pelo paciente'}
              </title>
            </circle>
            <circle className={`pt ${p.source === 'paciente' ? 'pt--patient' : ''}`} cx={x(p.date)} cy={y(p.value)} r={p.source === 'paciente' ? 4.5 : 5} pointerEvents="none" />
          </g>
        ))}
        <text x={x(last.date) + 9} y={y(last.value) + 4} style={{ fill: 'var(--ink)', fontWeight: 600 }}>
          {num(last.value)}
        </text>
        {xLabels.map((p, i) => (
          <text key={p.date + i} x={x(p.date)} y={H - 8} textAnchor={i === 0 ? 'start' : 'end'}>
            {fmtDay(p.date)}
          </text>
        ))}
      </svg>
      <figcaption className="legend">
        {hasPro && (
          <span>
            <i className="l-pro" /> Medição profissional
          </span>
        )}
        {hasPatient && (
          <span>
            <i className="l-pat" /> Informado pelo paciente
          </span>
        )}
        {target != null && (
          <span>
            <i className="l-target" /> Meta ({num(target)} {unit})
          </span>
        )}
      </figcaption>
    </figure>
  )
}

function niceTicks(lo: number, hi: number, count: number) {
  const raw = (hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const start = Math.floor(lo / step) * step
  const out: number[] = []
  for (let v = start; v <= hi + step * 0.01; v += step) out.push(Number(v.toFixed(6)))
  return out
}
