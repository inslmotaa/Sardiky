import { fmt } from '@/lib/nutricao'
import { NUTRIENT_BY_KEY, PLAN_MICROS, type planMicros } from '@/lib/tabela-nutricional'

/**
 * Quadro recolhível de vitaminas e minerais: uma coluna por refeição e o total do dia.
 * Começa fechado. No editor, é só do coach; no app, aparece apenas se o coach ligar o recurso.
 */
export function MicrosPanel({ data, dayLabel, note }: { data: ReturnType<typeof planMicros>; dayLabel: string; note?: string }) {
  if (data.day.count === 0) return null
  const partial = PLAN_MICROS.some((k) => data.day.missing[k] > 0)
  const meals = data.meals.filter((m) => m.count > 0)
  return (
    <details className="card micro-box">
      <summary>
        <strong>Vitaminas e minerais</strong> <span className="muted small">· {dayLabel}</span>
      </summary>
      <p className="small muted" style={{ margin: '8px 0' }}>
        {note ?? 'Soma por refeição (opção exibida) e do dia, com valores da TACO 4ª ed. por 100 g.'}
      </p>
      <div className="table-wrap">
        <table className="micro-table" aria-label={`Vitaminas e minerais · ${dayLabel}`}>
          <thead>
            <tr>
              <th scope="col">Nutriente</th>
              {meals.map((m) => (
                <th key={m.id} scope="col">
                  {m.name}
                </th>
              ))}
              <th scope="col">Dia</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_MICROS.map((k) => {
              const info = NUTRIENT_BY_KEY[k]
              return (
                <tr key={k}>
                  <th scope="row">
                    {info.label} <span className="muted small">({info.unit})</span>
                  </th>
                  {meals.map((m) => (
                    <td key={m.id}>
                      {fmt(m.totals[k], info.digits)}
                      {m.missing[k] > 0 && <span className="micro-list__partial">*</span>}
                    </td>
                  ))}
                  <td>
                    <strong>{fmt(data.day.totals[k], info.digits)}</strong>
                    {data.day.missing[k] > 0 && (
                      <span className="micro-list__partial" title={`${data.day.missing[k]} item(ns) sem este dado na tabela`}>
                        *
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {partial && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          * Total parcial: há itens sem esse dado na tabela (receitas, itens em texto ou valores “não analisados”).
        </p>
      )}
    </details>
  )
}
