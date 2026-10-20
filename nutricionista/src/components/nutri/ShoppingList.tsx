'use client'

import { useEffect, useState } from 'react'

export type ShoppingRow = { key: string; name: string; groupLabel: string; quantity: string }

/** Lista de compras com itens marcáveis (guardados só neste aparelho) e impressão. */
export function ShoppingList({ rows, storageKey }: { rows: ShoppingRow[]; storageKey: string }) {
  const [done, setDone] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(storageKey) ?? '{}'))
    } catch {
      /* armazenamento indisponível */
    }
  }, [storageKey])
  const toggle = (k: string) =>
    setDone((cur) => {
      const next = { ...cur, [k]: !cur[k] }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* navegação privada */
      }
      return next
    })
  const groups = [...new Set(rows.map((r) => r.groupLabel))]
  const left = rows.filter((r) => !done[r.key]).length
  return (
    <div className="stack">
      <div className="row row--between no-print">
        <span className="small muted">
          {left} de {rows.length} itens para comprar
        </span>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn--sm" onClick={() => window.print()}>
            Imprimir
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => {
              setDone({})
              try {
                localStorage.removeItem(storageKey)
              } catch {
                /* ignore */
              }
            }}
          >
            Desmarcar tudo
          </button>
        </div>
      </div>
      {groups.map((g) => (
        <section key={g} className="card">
          <h2 style={{ fontSize: '1.05rem' }}>{g}</h2>
          <ul className="shopping">
            {rows
              .filter((r) => r.groupLabel === g)
              .map((r) => (
                <li key={r.key}>
                  <label className={done[r.key] ? 'is-done' : undefined}>
                    <input type="checkbox" checked={!!done[r.key]} onChange={() => toggle(r.key)} />
                    <span className="shopping__name">{r.name}</span>
                    <span className="shopping__qty">{r.quantity}</span>
                  </label>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
