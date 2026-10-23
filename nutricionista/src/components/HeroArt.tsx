/**
 * Elementos da abertura: faixa com temas que passa devagar, cartão de prato equilibrado
 * (gráfico em rosca e macronutrientes de exemplo).
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
