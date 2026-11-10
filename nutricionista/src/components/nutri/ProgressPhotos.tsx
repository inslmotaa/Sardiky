'use client'

import { useMemo, useState } from 'react'
import type { ActionState } from '@/lib/action'
import { ActionForm, Field, SubmitButton } from '@/components/form'

export type ProgressPhoto = { id: string; date: string; angle: 'frente' | 'lado' | 'costas'; url: string; canDelete: boolean }
export type PhotoSetInfo = { date: string; weightKg: number | null; comment: string | null }

const ANGLES = [
  ['frente', 'Frente'],
  ['lado', 'Lado'],
  ['costas', 'Costas'],
] as const

const day = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const kg = (v: number) => `${v.toFixed(1).replace('.', ',')} kg`

/**
 * Fotos do corpo (frente, lado, costas): linha do tempo das datas com o peso de cada uma, atalho
 * "Primeira × última", comparação lado a lado ou sobreposta (controle deslizante) e o comentário do
 * coach em cada conjunto. As imagens vêm de rota protegida: só o próprio cliente e o coach dele.
 */
export function ProgressPhotos({
  photos,
  sets = [],
  upload,
  onDelete,
  comment,
  today,
  privacyNote,
}: {
  photos: ProgressPhoto[]
  sets?: PhotoSetInfo[]
  upload?: (state: ActionState, fd: FormData) => Promise<ActionState>
  onDelete?: (id: string) => Promise<void>
  /** Painel: comentário do coach em cada data (o cliente vê no app). */
  comment?: (date: string, state: ActionState, fd: FormData) => Promise<ActionState>
  today: string
  privacyNote: string
}) {
  const dates = useMemo(() => [...new Set(photos.map((p) => p.date))].sort(), [photos])
  const [a, setA] = useState(dates[0] ?? '')
  const [b, setB] = useState(dates[dates.length - 1] ?? '')
  const [angle, setAngle] = useState<ProgressPhoto['angle']>('frente')
  const [mode, setMode] = useState<'lado' | 'sobrepor'>('lado')
  const [mix, setMix] = useState(50)
  const pick = (d: string) => photos.find((p) => p.date === d && p.angle === angle)
  const setOf = (d: string) => sets.find((s) => s.date === d)
  const angleLabel = ANGLES.find((x) => x[0] === angle)![1]

  return (
    <div className="stack" style={{ ['--gap' as string]: '14px' }}>
      <p className="small muted" style={{ margin: 0 }}>
        {privacyNote}
      </p>

      {dates.length > 0 && (
        <div>
          <h3 className="small" style={{ margin: '0 0 6px' }}>
            Linha do tempo
          </h3>
          <ol className="photo-timeline" aria-label="Datas com fotos do corpo">
            {dates.map((d) => {
              const w = setOf(d)?.weightKg
              return (
                <li key={d}>
                  <button
                    type="button"
                    aria-pressed={d === b}
                    onClick={() => {
                      if (d !== a) setB(d)
                    }}
                    title="Mostrar como “depois”"
                  >
                    {day(d)}
                    {w != null ? ` · ${kg(w)}` : ''}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      )}

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
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                setA(dates[0])
                setB(dates[dates.length - 1])
              }}
            >
              Primeira × última
            </button>
          </div>
          <div className="row" style={{ alignItems: 'center' }}>
            <div className="segmented" role="radiogroup" aria-label="Ângulo">
              {ANGLES.map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={angle === k} onClick={() => setAngle(k)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="segmented" role="radiogroup" aria-label="Modo de comparação">
              <button type="button" role="radio" aria-checked={mode === 'lado'} onClick={() => setMode('lado')}>
                Lado a lado
              </button>
              <button type="button" role="radio" aria-checked={mode === 'sobrepor'} onClick={() => setMode('sobrepor')}>
                Sobrepor
              </button>
            </div>
          </div>

          {mode === 'lado' ? (
            <div className="photo-compare__pair">
              {[a, b].map((d, i) => {
                const p = pick(d)
                const w = setOf(d)?.weightKg
                return (
                  <figure key={i}>
                    {p ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt={`${angleLabel} em ${day(d)}`} />
                    ) : (
                      <div className="photo-compare__empty">Sem foto de {angle} nesta data</div>
                    )}
                    <figcaption>
                      <span>{d ? day(d) : '—'}</span>
                      {w != null && <span>{kg(w)}</span>}
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          ) : (
            <div className="stack" style={{ ['--gap' as string]: '8px' }}>
              <div className="photo-overlay">
                {pick(a) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pick(a)!.url} alt={`${angleLabel} em ${day(a)} (antes)`} />
                )}
                {pick(b) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pick(b)!.url} alt={`${angleLabel} em ${day(b)} (depois)`} style={{ opacity: mix / 100 }} />
                )}
                {(!pick(a) || !pick(b)) && <div className="photo-compare__empty">Falta a foto de {angle} em uma das datas</div>}
              </div>
              <label className="field" style={{ maxWidth: 420, margin: '0 auto', width: '100%' }}>
                <span className="field__label">
                  Sobreposição: {day(a)} ← → {day(b)}
                </span>
                <input type="range" min={0} max={100} value={mix} onChange={(e) => setMix(Number(e.target.value))} aria-label="Sobreposição entre antes e depois" aria-valuetext={`${mix}% depois`} />
              </label>
            </div>
          )}
        </div>
      )}

      {dates.length === 0 && <p className="empty">Nenhuma foto do corpo ainda.</p>}
      {[...dates].reverse().map((d) => {
        const info = setOf(d)
        return (
          <section key={d} aria-label={`Fotos de ${day(d)}`}>
            <h3 className="small" style={{ margin: '0 0 6px' }}>
              {day(d)}
              {info?.weightKg != null && <span className="muted"> · {kg(info.weightKg)}</span>}
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
                            if (window.confirm('Apagar esta foto? Não dá para desfazer.')) await onDelete(p.id)
                          }}
                        >
                          apagar
                        </button>
                      )}
                    </figcaption>
                  </figure>
                ))}
            </div>
            {comment ? (
              <ActionForm action={comment.bind(null, d)} className="row" >
                <Field label={`Comentário para o cliente (${day(d)})`} name="comment" className="span-2">
                  <textarea name="comment" rows={2} maxLength={1000} defaultValue={info?.comment ?? ''} placeholder="Ex.: Ótima evolução na cintura! Continue assim." />
                </Field>
                <div style={{ alignSelf: 'flex-end' }}>
                  <SubmitButton className="btn btn--sm">Salvar comentário</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              info?.comment && (
                <p className="photo-set__comment">
                  <strong>Comentário do coach:</strong> {info.comment}
                </p>
              )
            )}
          </section>
        )
      })}

      {upload && (
        <details className="disclosure">
          <summary>Adicionar fotos</summary>
          <div>
            <ActionForm action={upload} className="stack" resetOnSuccess compressImages={['frente', 'lado', 'costas']}>
              <div className="form-grid">
                <Field label="Data" name="date" required>
                  <input type="date" name="date" defaultValue={today} max={today} />
                </Field>
                <Field label="Peso do dia (kg, opcional)" name="weightKg">
                  <input name="weightKg" inputMode="decimal" placeholder="Ex.: 70,5" />
                </Field>
              </div>
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
