import Link from 'next/link'
import type { ReactNode } from 'react'

export type BodyCardData = {
  weight: { value: number; date: string; source?: string } | null
  heightCm: number | null
  age: number | null
  bmi: number | null
  band: string | null
  change: { label: string } | null
  lastPhotoDate: string | null
  missing: string[]
}

const num = (v: number, d = 1) => v.toFixed(d).replace('.', ',')
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/**
 * Card "Meu corpo": peso atual (com a data e quem registrou), altura, idade, IMC com a faixa,
 * variação desde o início e a data da última foto do corpo. Usado no Início do app e no topo da
 * ficha do cliente. Idade e IMC chegam calculados na hora, nunca gravados.
 */
export function BodyCard({
  data,
  who = 'cliente',
  completeHref,
  actions,
  id = 'meu-corpo',
}: {
  data: BodyCardData
  who?: 'cliente' | 'coach'
  /** Link do formulário curto quando faltam dados (só no app do cliente). */
  completeHref?: string
  actions?: ReactNode
  id?: string
}) {
  const w = data.weight
  const origin = w?.source === 'profissional' ? 'medido pelo coach' : who === 'cliente' ? 'informado por você' : 'informado pelo cliente'
  return (
    <section className="card body-card" aria-labelledby={`${id}-titulo`}>
      <div className="card__head">
        <h2 id={`${id}-titulo`}>{who === 'cliente' ? 'Meu corpo' : 'Corpo'}</h2>
        {data.lastPhotoDate ? <span className="small muted">Última foto do corpo: {dm(data.lastPhotoDate)}</span> : <span className="small muted">Sem fotos do corpo</span>}
      </div>
      <dl className="body-card__grid">
        <div>
          <dt>Peso atual</dt>
          <dd>
            <strong>{w ? `${num(w.value)} kg` : '—'}</strong>
            {w && (
              <span>
                {dm(w.date)} · {origin}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Altura</dt>
          <dd>
            <strong>{data.heightCm ? `${num(data.heightCm / 100, 2)} m` : '—'}</strong>
          </dd>
        </div>
        <div>
          <dt>Idade</dt>
          <dd>
            <strong>{data.age != null ? `${data.age} anos` : '—'}</strong>
          </dd>
        </div>
        <div>
          <dt>IMC</dt>
          <dd>
            <strong>{data.bmi != null ? num(data.bmi) : '—'}</strong>
            {data.band && <span>{data.band}</span>}
          </dd>
        </div>
        <div>
          <dt>Desde o início</dt>
          <dd>
            <strong>{data.change ? data.change.label.split(' em ')[0] : '—'}</strong>
            {data.change && <span>em {data.change.label.split(' em ')[1]}</span>}
          </dd>
        </div>
      </dl>
      {data.missing.length > 0 && (
        <p className="body-card__missing" role="status">
          {who === 'cliente' ? (
            <>
              <span>Complete seus dados: falta {data.missing.join(', ')}.</span>{' '}
              {completeHref && (
                <Link href={completeHref} className="btn btn--sm">
                  Complete seus dados
                </Link>
              )}
            </>
          ) : (
            <span>Falta no cadastro: {data.missing.join(', ')}.</span>
          )}
        </p>
      )}
      {actions && <div className="row body-card__actions">{actions}</div>}
    </section>
  )
}
