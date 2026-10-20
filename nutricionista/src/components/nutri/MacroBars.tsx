import { fmt, targetStatus, type Nutrients } from '@/lib/nutricao'

const ROWS = [
  { key: 'protein', label: 'Proteína', color: 'var(--macro-protein)' },
  { key: 'carbs', label: 'Carboidrato', color: 'var(--macro-carbs)' },
  { key: 'fat', label: 'Gordura', color: 'var(--macro-fat)' },
] as const

const STATUS_TEXT = { ok: 'na meta', warn: 'perto', danger: 'fora', none: '' } as const

/**
 * Barras de macronutrientes (valor × referência). Cada barra mostra o número,
 * para a cor nunca ser a única forma de informação.
 */
export function MacroBars({
  value,
  target,
  showStatus = false,
  includeFiber = false,
}: {
  value: Nutrients
  target: Partial<Record<keyof Nutrients, number | null>>
  showStatus?: boolean
  includeFiber?: boolean
}) {
  const rows = includeFiber ? [...ROWS, { key: 'fiber', label: 'Fibras', color: 'var(--macro-fiber)' } as const] : ROWS
  return (
    <div className="macro-bars">
      {rows.map((r) => {
        const v = value[r.key]
        const t = target[r.key] ?? null
        const pct = t ? Math.min(100, (v / t) * 100) : 0
        const st = targetStatus(v, t)
        return (
          <div key={r.key} style={{ ['--c' as string]: r.color }}>
            <div className="macro-bar__head">
              <span className="macro-bar__label">
                <i aria-hidden /> {r.label}
              </span>
              <span className="macro-bar__value">
                {fmt(v, 0)} g{t ? ` / ${fmt(t, 0)} g` : ''}
                {showStatus && st !== 'none' && <span className={`status-dot status-dot--${st}`}>{STATUS_TEXT[st]}</span>}
              </span>
            </div>
            {t ? (
              <div className="macro-bar__track" role="progressbar" aria-label={r.label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={Math.round(t)}>
                <div className="macro-bar__fill" style={{ width: `${pct}%` }} />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** Anel de calorias: valor dentro do anel, referência embaixo. */
export function KcalRing({ value, target, label = 'kcal' }: { value: number; target: number | null; label?: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  const pct = target ? Math.min(1, value / target) : 0
  return (
    <div className="kcal-ring" role="img" aria-label={`${fmt(value, 0)} de ${target ? fmt(target, 0) : '—'} ${label}`}>
      <svg viewBox="0 0 132 132" aria-hidden>
        <circle className="kcal-ring__track" cx="66" cy="66" r={r} />
        <circle className="kcal-ring__fill" cx="66" cy="66" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="kcal-ring__center">
        <div>
          <strong>{fmt(value, 0)}</strong>
          <br />
          <span>{target ? `de ${fmt(target, 0)} ${label}` : label}</span>
        </div>
      </div>
    </div>
  )
}

/** Linha compacta: 192 kcal · P 4 g · C 42 g · G 0 g */
export function NutriInline({ n, showKcal = true, showMacros = true }: { n: Nutrients; showKcal?: boolean; showMacros?: boolean }) {
  if (!showKcal && !showMacros) return null
  return (
    <span className="nutri-inline">
      {showKcal && (
        <span>
          <b>{fmt(n.kcal, 0)}</b> kcal
        </span>
      )}
      {showMacros && (
        <>
          <span className="p">P {fmt(n.protein, 1)} g</span>
          <span className="c">C {fmt(n.carbs, 1)} g</span>
          <span className="f">G {fmt(n.fat, 1)} g</span>
        </>
      )}
    </span>
  )
}
