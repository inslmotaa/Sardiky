'use client'

import { useMemo, useState } from 'react'
import type { ActionState } from '@/lib/action'
import { ActionForm, Field, SubmitButton } from '@/components/form'

export type ProgressPhoto = { id: string; date: string; angle: 'frente' | 'lado' | 'costas'; url: string; canDelete: boolean }

const ANGLES = [
  ['frente', 'Frente'],
  ['lado', 'Lado'],
  ['costas', 'Costas'],
] as const

const day = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/**
 * Fotos de evolução (frente, lado, costas) com comparação lado a lado entre duas datas.
 * As imagens são servidas por rota protegida: só o próprio paciente e a equipe clínica.
 */
export function ProgressPhotos({
  photos,
  upload,
  onDelete,
  today,
  privacyNote,
}: {
  photos: ProgressPhoto[]
  upload?: (state: ActionState, fd: FormData) => Promise<ActionState>
  onDelete?: (id: string) => Promise<void>
  today: string
  privacyNote: string
}) {
  const dates = useMemo(() => [...new Set(photos.map((p) => p.date))].sort(), [photos])
  const [a, setA] = useState(dates[0] ?? '')
  const [b, setB] = useState(dates[dates.length - 1] ?? '')
  const [angle, setAngle] = useState<ProgressPhoto['angle']>('frente')
  const pick = (d: string) => photos.find((p) => p.date === d && p.angle === angle)

  return (
    <div className="stack" style={{ ['--gap' as string]: '14px' }}>
      <p className="small muted" style={{ margin: 0 }}>
        🔒 {privacyNote}
      </p>
      {dates.length >= 2 && (
        <div className="photo-compare">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: '1 1 120px' }}>
              <span className="field__label">Antes</span>
              <select value={a} onChange={(e) => setA(e.target.value)}>
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {day(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ flex: '1 1 120px' }}>
              <span className="field__label">Depois</span>
              <select value={b} onChange={(e) => setB(e.target.value)}>
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {day(d)}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented" role="radiogroup" aria-label="Ângulo">
              {ANGLES.map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={angle === k} onClick={() => setAngle(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="photo-compare__pair">
            {[a, b].map((d, i) => {
              const p = pick(d)
              return (
                <figure key={i}>
                  {p ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt={`${ANGLES.find((x) => x[0] === angle)![1]} em ${day(d)}`} />
                  ) : (
                    <div className="photo-compare__empty">Sem foto de {angle} nesta data</div>
                  )}
                  <figcaption>{d ? day(d) : '—'}</figcaption>
                </figure>
              )
            })}
          </div>
        </div>
      )}

      {dates.length === 0 && <p className="empty">Nenhuma foto de evolução ainda.</p>}
      {[...dates].reverse().map((d) => (
        <section key={d} aria-label={`Fotos de ${day(d)}`}>
          <h3 className="small" style={{ margin: '0 0 6px' }}>
            {day(d)}
          </h3>
          <div className="photo-grid">
            {photos
              .filter((p) => p.date === d)
              .map((p) => (
                <figure key={p.id}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`${p.angle} em ${day(d)}`} loading="lazy" />
                  </a>
                  <figcaption>
                    {ANGLES.find((x) => x[0] === p.angle)?.[1]}
                    {onDelete && p.canDelete && (
                      <button
                        type="button"
                        className="link-btn small"
                        onClick={async () => {
                          if (window.confirm('Excluir esta foto?')) await onDelete(p.id)
                        }}
                      >
                        excluir
                      </button>
                    )}
                  </figcaption>
                </figure>
              ))}
          </div>
        </section>
      ))}

      {upload && (
        <details className="disclosure">
          <summary>Adicionar fotos</summary>
          <div>
            <ActionForm action={upload} className="stack" resetOnSuccess>
              <Field label="Data" name="date" required>
                <input type="date" name="date" defaultValue={today} max={today} />
              </Field>
              <div className="form-grid form-grid--3">
                {ANGLES.map(([k, label]) => (
                  <Field key={k} label={label} name={k}>
                    <input type="file" name={k} accept="image/jpeg,image/png,image/webp" />
                  </Field>
                ))}
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                Dica: mesma luz, mesma roupa e mesma distância em todas as fotos ajudam a comparar.
              </p>
              <div>
                <SubmitButton>Enviar fotos</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </details>
      )}
    </div>
  )
}
