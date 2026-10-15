import type { PlanContent } from '@/lib/plan'

/** Plano alimentar organizado por refeições — mesma apresentação para paciente, painel e impressão. */
export function PlanView({ content }: { content: PlanContent }) {
  const meals = [...content.meals].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
  return (
    <div className="stack">
      {meals.map((m) => (
        <section key={m.id} className="meal" aria-labelledby={`meal-${m.id}`}>
          <header className="meal__head">
            {m.time && <span className="meal__time">{m.time}</span>}
            <h3 id={`meal-${m.id}`}>{m.name}</h3>
          </header>
          <ul className="meal__items">
            {m.items.map((it) => (
              <li key={it.id}>
                <div className="food">
                  <span className="food__name">{it.food}</span>
                  <span className="food__qty">{[it.householdMeasure, it.quantity].filter(Boolean).join(' · ')}</span>
                </div>
                {it.notes && <div className="small muted">{it.notes}</div>}
                {it.substitutions.length > 0 && (
                  <div className="subs">
                    <strong>Substituições autorizadas:</strong>
                    <ul>
                      {it.substitutions.map((sub, i) => (
                        <li key={i}>
                          {sub.food}
                          {(sub.householdMeasure || sub.quantity) && ` — ${[sub.householdMeasure, sub.quantity].filter(Boolean).join(' · ')}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
            {m.items.length === 0 && <li className="muted">Sem itens.</li>}
          </ul>
          {m.notes && (
            <p className="small" style={{ margin: 0, padding: '10px 18px', borderTop: '1px solid var(--line)' }}>
              <strong>Observação:</strong> {m.notes}
            </p>
          )}
        </section>
      ))}
      {content.guidance && (
        <section className="card card--soft">
          <h3>Orientações do nutricionista</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{content.guidance}</p>
        </section>
      )}
    </div>
  )
}
