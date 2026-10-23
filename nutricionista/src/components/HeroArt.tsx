/**
 * Elementos da abertura: faixa com temas que passa devagar, cartão de prato equilibrado
 * (gráfico em rosca e macronutrientes de exemplo) e o fundo "em ação" com os outros pilares.
 * Ficam parados para quem prefere menos movimento.
 */

const TOPICS = ['Proteínas', 'Fibras', 'Hidratação', 'Vegetais', 'Frutas da estação', 'Grãos integrais', 'Gorduras boas', 'Rotina e sono']

/** Faixa com temas de nutrição, em mono, passando devagar. */
export function HeroTicker() {
  const items = [...TOPICS, ...TOPICS]
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker__track">
        {items.map((t, i) => (
          <span key={i}>
            {t.toLocaleUpperCase('pt-BR')}
            <i>●</i>
          </span>
        ))}
      </div>
    </div>
  )
}

const PLATE = [
  { label: 'Vegetais', part: '½', value: 50, cls: 'a' },
  { label: 'Proteína', part: '¼', value: 25, cls: 'b' },
  { label: 'Carboidrato', part: '¼', value: 25, cls: 'c' },
]

const MACROS = [
  { label: 'Proteínas', value: 30 },
  { label: 'Carboidratos', value: 45 },
  { label: 'Gorduras', value: 25 },
]

/** Cartão "prato equilibrado": rosca do prato, macros e água por dia. */
export function PlateCard({ waterMlPerKg }: { waterMlPerKg?: number | null }) {
  let offset = 0
  return (
    <aside className="plate-card" aria-label="Exemplo de prato equilibrado">
      <p className="plate-card__label">
        <span className="mono-label__dot" aria-hidden />
        PRATO EQUILIBRADO · EXEMPLO
      </p>
      <div className="plate-card__body">
        <svg className="plate-card__donut" viewBox="0 0 120 120" aria-hidden focusable="false">
          <circle cx="60" cy="60" r="44" className="plate-card__track" />
          {PLATE.map((p) => {
            const seg = (
              <circle
                key={p.cls}
                cx="60"
                cy="60"
                r="44"
                pathLength={100}
                className={`plate-card__seg plate-card__seg--${p.cls}`}
                style={{ '--len': p.value - 1.5, '--off': -offset } as React.CSSProperties}
              />
            )
            offset += p.value
            return seg
          })}
          <circle cx="60" cy="60" r="30" className="plate-card__inner" />
        </svg>
        <ul className="plate-card__legend">
          {PLATE.map((p) => (
            <li key={p.cls}>
              <i className={`plate-card__sw plate-card__sw--${p.cls}`} aria-hidden />
              {p.label} <b>{p.part}</b>
            </li>
          ))}
        </ul>
      </div>
      <dl className="plate-card__macros">
        {MACROS.map((m) => (
          <div key={m.label}>
            <dt>{m.label}</dt>
            <dd>
              <span className="plate-card__bar" style={{ '--v': m.value / 100 } as React.CSSProperties} aria-hidden />
              {m.value}%
            </dd>
          </div>
        ))}
      </dl>
      {waterMlPerKg ? <p className="plate-card__water">ÁGUA · {waterMlPerKg} ML POR KG/DIA</p> : null}
    </aside>
  )
}

const I = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const RINGS = [
  { label: 'Movimento', value: 0.82, r: 74 },
  { label: 'Treino', value: 0.64, r: 58 },
  { label: 'Sono', value: 0.9, r: 42 },
]

const CHIPS: { key: string; label: string; to: number; unit: string; icon: React.ReactNode }[] = [
  {
    key: 'treino',
    label: 'Treino',
    to: 45,
    unit: 'min',
    icon: <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" {...I} />,
  },
  {
    key: 'sono',
    label: 'Sono',
    to: 8,
    unit: 'h',
    icon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...I} />,
  },
  {
    key: 'agua',
    label: 'Água',
    to: 2400,
    unit: 'ml',
    icon: <path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" {...I} />,
  },
  {
    key: 'passos',
    label: 'Passos',
    to: 10000,
    unit: '',
    icon: <path d="M7 4c1.7 0 2.5 2 2.5 4.5S8.7 13 7 13s-2.5-2-2.5-4.5S5.3 4 7 4zM5 15.5h4M16 9c1.7 0 2.5 2 2.5 4.5S17.7 18 16 18s-2.5-2-2.5-4.5S14.3 9 16 9zM14 20.5h4" {...I} />,
  },
  {
    key: 'energia',
    label: 'Batimentos',
    to: 72,
    unit: 'bpm',
    icon: <path d="M3 12h4l2-5 4 10 2-5h6" {...I} />,
  },
]

/**
 * Fundo "em ação" da abertura: além da alimentação, os outros pilares do acompanhamento.
 * Um monitor de batimentos que varre a tela sobre uma grade de pontos (canvas, ligado pelo site-fx),
 * anéis de atividade (movimento, treino e sono) e indicadores de treino, sono, água, passos e batimentos.
 */
export function HeroAction() {
  return (
    <div className="action" aria-hidden>
      <canvas className="action__canvas" data-action="" />
      <div className="action__rings">
        <svg viewBox="0 0 180 180" focusable="false">
          {RINGS.map((ring) => (
            <g key={ring.label}>
              <circle cx="90" cy="90" r={ring.r} className="action__ring-track" />
              <circle
                cx="90"
                cy="90"
                r={ring.r}
                pathLength={100}
                className="action__ring"
                style={{ '--v': ring.value * 100 } as React.CSSProperties}
              />
            </g>
          ))}
        </svg>
        <ul>
          {RINGS.map((ring) => (
            <li key={ring.label}>
              <i />
              {ring.label.toLocaleUpperCase('pt-BR')} <b>{Math.round(ring.value * 100)}%</b>
            </li>
          ))}
        </ul>
      </div>
      <ul className="action__chips">
        {CHIPS.map((c) => (
          <li key={c.key} className={`act-chip act-chip--${c.key}`}>
            <svg viewBox="0 0 24 24" focusable="false">
              {c.icon}
            </svg>
            <span>{c.label.toLocaleUpperCase('pt-BR')}</span>
            <b>
              <span data-count={c.to}>{c.to.toLocaleString('pt-BR')}</span>
              {c.unit && ` ${c.unit}`}
            </b>
          </li>
        ))}
      </ul>
    </div>
  )
}
