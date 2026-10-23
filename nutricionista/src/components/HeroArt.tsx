/**
 * Elementos de nutrição da abertura: faixa com temas que passa devagar, cartão de prato equilibrado
 * (gráfico em rosca e macronutrientes de exemplo) e ilustrações botânicas em linha fina que se desenham.
 * Só CSS: funciona sem JavaScript e fica parado para quem prefere menos movimento.
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

const L = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round', pathLength: 1 } as const

/** Ramo de folhas, rodela de cítrico e espiga em linha fina. */
export function HeroBotanicals() {
  return (
    <div className="botan" aria-hidden>
      <svg className="botan__item botan__item--sprig" viewBox="0 0 160 200" focusable="false">
        <path d="M80 196 C78 150 84 104 104 52 C110 36 118 22 126 10" {...L} />
        <path d="M84 150 C60 146 42 132 34 110 C58 110 76 124 84 150 Z" {...L} />
        <path d="M88 120 C112 118 130 104 138 84 C114 84 96 98 88 120 Z" {...L} />
        <path d="M94 90 C72 84 58 68 54 48 C76 52 90 66 94 90 Z" {...L} />
        <path d="M104 62 C124 56 138 42 142 24 C122 28 108 42 104 62 Z" {...L} />
        <path d="M34 110 C56 120 70 132 84 150 M138 84 C118 96 104 106 88 120 M54 48 C70 62 82 74 94 90" {...L} strokeOpacity={0.5} />
      </svg>
      <svg className="botan__item botan__item--citrus" viewBox="0 0 120 120" focusable="false">
        <circle cx="60" cy="60" r="52" {...L} />
        <circle cx="60" cy="60" r="44" {...L} strokeOpacity={0.6} />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4
          return <line key={i} x1="60" y1="60" x2={60 + Math.cos(a) * 42} y2={60 + Math.sin(a) * 42} {...L} strokeOpacity={0.7} />
        })}
        <circle cx="60" cy="60" r="4" {...L} />
      </svg>
      <svg className="botan__item botan__item--wheat" viewBox="0 0 80 200" focusable="false">
        <path d="M40 198 C40 150 40 100 40 30" {...L} />
        {[40, 62, 84, 106, 128].map((y) => (
          <g key={y}>
            <path d={`M40 ${y + 16} C30 ${y + 10} 24 ${y} 24 ${y - 12} C34 ${y - 6} 40 ${y + 4} 40 ${y + 16} Z`} {...L} />
            <path d={`M40 ${y + 16} C50 ${y + 10} 56 ${y} 56 ${y - 12} C46 ${y - 6} 40 ${y + 4} 40 ${y + 16} Z`} {...L} />
          </g>
        ))}
        <path d="M40 30 C38 20 40 10 44 2" {...L} />
      </svg>
    </div>
  )
}
