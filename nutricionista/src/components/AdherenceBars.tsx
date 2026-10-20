import { fmtDay } from '@/lib/time'

/**
 * Adesão semana a semana (% de refeições do plano feitas), em barras SVG.
 * Cada barra traz o número escrito; a linha tracejada marca a meta “em dia”.
 */
export function AdherenceBars({ weeks, good }: { weeks: { from: string; to: string; pct: number | null }[]; good: number }) {
  const W = 640
  const H = 180
  const pad = { top: 20, bottom: 34, left: 8, right: 8 }
  const bw = (W - pad.left - pad.right) / weeks.length
  const y = (p: number) => pad.top + (H - pad.top - pad.bottom) * (1 - p / 100)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Adesão semanal: ${weeks.map((w) => `semana até ${fmtDay(w.to)}: ${w.pct == null ? 'sem plano' : `${w.pct}%`}`).join('; ')}`}>
      <line x1={pad.left} x2={W - pad.right} y1={y(good)} y2={y(good)} className="target-line" />
      <text x={W - pad.right} y={y(good) - 4} textAnchor="end" className="chart__label">
        meta {good}%
      </text>
      {weeks.map((w, i) => {
        const x = pad.left + i * bw + bw * 0.18
        const p = w.pct ?? 0
        const tone = w.pct == null ? 'none' : p >= good ? 'ok' : p >= good / 2 ? 'warn' : 'low'
        return (
          <g key={w.to}>
            <rect x={x} y={y(p)} width={bw * 0.64} height={Math.max(0, y(0) - y(p))} rx={6} className={`adh-bar adh-bar--${tone}`} />
            <text x={x + bw * 0.32} y={y(p) - 5} textAnchor="middle" className="chart__value">
              {w.pct == null ? '—' : `${w.pct}%`}
            </text>
            <text x={x + bw * 0.32} y={H - 12} textAnchor="middle" className="chart__label">
              {w.to.slice(8, 10)}/{w.to.slice(5, 7)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
