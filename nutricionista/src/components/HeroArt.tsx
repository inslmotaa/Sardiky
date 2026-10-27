/**
 * Elementos da abertura: faixa com temas que passa devagar e a vitrine da plataforma
 * (painel do coach e app do cliente, com dados de exemplo), no estilo dos softwares de nutrição.
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

const SIDE = ['Início', 'Clientes', 'Planos', 'Agenda', 'Mensagens', 'Financeiro']

const KPIS = [
  { label: 'Clientes ativos', to: 48, suffix: '' },
  { label: 'Adesão média', to: 86, suffix: '%' },
  { label: 'Consultas hoje', to: 6, suffix: '' },
]

const MEALS = [
  { name: 'Café da manhã', time: '07:00', kcal: 420 },
  { name: 'Almoço', time: '12:30', kcal: 640 },
  { name: 'Lanche', time: '16:00', kcal: 230 },
  { name: 'Jantar', time: '19:30', kcal: 510 },
]

const WEIGHT = [82.4, 81.6, 81.9, 80.7, 80.1, 79.2, 78.6]

/** Janela do painel do coach: menu, indicadores, gráfico de evolução e plano alimentar (exemplo). */
export function PanelMock() {
  const min = 78
  const max = 83
  const pts = WEIGHT.map((v, i) => [10 + i * (280 / (WEIGHT.length - 1)), 10 + ((max - v) / (max - min)) * 90] as const)
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <div className="mock-win">
      <div className="mock-win__bar">
        <i />
        <i />
        <i />
        <span>Painel do coach</span>
      </div>
      <div className="mock-win__body">
        <aside className="mock-side">
          <span className="mock-side__brand" />
          {SIDE.map((item, i) => (
            <span key={item} className={i === 0 ? 'is-on' : undefined}>
              <b />
              {item}
            </span>
          ))}
        </aside>
        <div className="mock-main">
          <div className="mock-head">
            <strong>Acompanhamento</strong>
            <span>Semana 6 · dados de exemplo</span>
          </div>
          <div className="mock-kpis">
            {KPIS.map((k) => (
              <div key={k.label}>
                <span>{k.label}</span>
                <strong>
                  <span data-count={k.to}>{k.to}</span>
                  {k.suffix}
                </strong>
              </div>
            ))}
          </div>
          <div className="mock-grid">
            <div className="mock-card">
              <p className="mock-card__title">Evolução · peso (kg)</p>
              <svg viewBox="0 0 300 110" className="mock-chart" focusable="false">
                {[30, 60, 90].map((y) => (
                  <line key={y} x1="0" x2="300" y1={y} y2={y} className="mock-chart__grid" />
                ))}
                <polygon points={`10,110 ${line} 290,110`} className="mock-chart__area" />
                <polyline points={line} pathLength={1} className="mock-chart__line" />
                {pts.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="3.2" className="mock-chart__dot" style={{ '--i': i } as React.CSSProperties} />
                ))}
              </svg>
            </div>
            <div className="mock-card">
              <p className="mock-card__title">Plano alimentar · exemplo</p>
              <ul className="mock-plan">
                {MEALS.map((m) => (
                  <li key={m.name}>
                    <span>{m.time}</span>
                    <b>{m.name}</b>
                    <em>{m.kcal} kcal</em>
                  </li>
                ))}
              </ul>
              <div className="mock-macros" title="Proteínas, carboidratos e gorduras">
                <i style={{ flex: 30 }} />
                <i style={{ flex: 45 }} />
                <i style={{ flex: 25 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const LUNCH = [
  { food: 'Arroz integral', qty: '4 col. sopa', done: true },
  { food: 'Frango grelhado', qty: '120 g', done: true },
  { food: 'Salada de folhas', qty: 'à vontade', done: true },
  { food: 'Azeite de oliva', qty: '1 col. chá', done: false },
]

/** Celular com o app do cliente: próxima refeição, água e meta da semana (exemplo). */
export function AppMock() {
  return (
    <div className="mock-phone">
      <div className="mock-phone__notch" />
      <div className="mock-phone__screen">
        <p className="mp-hi">Olá! Bom almoço</p>
        <p className="mp-sub">Hoje · plano da semana 6</p>
        <div className="mp-card">
          <span className="mp-now">AGORA · 12H30</span>
          <strong>Almoço</strong>
          <ul>
            {LUNCH.map((l, i) => (
              <li key={l.food} className={l.done ? 'is-done' : undefined} style={{ '--i': i } as React.CSSProperties}>
                <i />
                <span>{l.food}</span>
                <em>{l.qty}</em>
              </li>
            ))}
          </ul>
          <span className="mp-btn">Marcar como feita</span>
        </div>
        <div className="mp-row">
          <div className="mp-water">
            <span>Água</span>
            <div>
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} className={i < 6 ? 'is-full' : undefined} />
              ))}
            </div>
          </div>
          <div className="mp-goal">
            <svg viewBox="0 0 40 40" focusable="false">
              <circle cx="20" cy="20" r="16" className="mp-goal__track" />
              <circle cx="20" cy="20" r="16" pathLength={100} className="mp-goal__bar" />
            </svg>
            <span>Meta</span>
          </div>
        </div>
        <nav className="mp-tabs">
          <span className="is-on">Hoje</span>
          <span>Plano</span>
          <span>Diário</span>
          <span>Evolução</span>
        </nav>
      </div>
    </div>
  )
}
