'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import type { ActionState } from '@/lib/action'
import { compressImage, frameToFile } from '@/lib/image-compress'

const ANGLES = [
  ['frente', 'Frente'],
  ['lado', 'Lado'],
  ['costas', 'Costas'],
] as const
type Angle = (typeof ANGLES)[number][0]

/** Silhueta de referência (contorno simples) para alinhar o corpo inteiro na foto. */
function Silhouette({ angle }: { angle: Angle }) {
  return (
    <svg className="capture__silhouette" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="4 3" aria-hidden>
      {angle === 'lado' ? (
        <path d="M52 8c7 0 11 6 11 13s-4 13-11 13-10-6-10-13 3-13 10-13Zm-2 28c10 0 15 6 16 16l2 30c1 6-2 9-6 10l-2 24 2 40c0 6-2 10-7 10s-7-4-7-10l-2-40-2-24c-5-2-7-6-6-12l2-28c1-10 5-16 12-16Z" />
      ) : (
        <path d="M50 8c7 0 12 6 12 13s-5 13-12 13-12-6-12-13 5-13 12-13Zm-14 28h28c9 0 14 6 15 15l3 34c1 5-2 8-6 8l-3-30-1 34 2 50c0 6-3 9-8 9s-7-3-8-9l-4-46-4 46c-1 6-3 9-8 9s-8-3-8-9l2-50-1-34-3 30c-4 0-7-3-6-8l3-34c1-9 6-15 15-15Z" />
      )}
    </svg>
  )
}

/**
 * Captura guiada das fotos do corpo: câmera do celular com silhueta de referência, dicas curtas e
 * contagem de 5 segundos para quem fotografa sozinho; a galeria também vale. As fotos são
 * comprimidas no próprio celular (sem EXIF) antes do envio. Peso do dia opcional, ligado às fotos.
 */
export function BodyPhotoCapture({
  action,
  today,
  doneHref,
  doneLabel,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>
  today: string
  doneHref: string
  doneLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const [photos, setPhotos] = useState<Partial<Record<Angle, { file: File; url: string }>>>({})
  const [active, setActive] = useState<Angle>('frente')
  const [camera, setCamera] = useState<'off' | 'starting' | 'on' | 'error'>('off')
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [count, setCount] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamera('off')
  }
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])
  useEffect(() => {
    if (state.ok) {
      Object.values(photos).forEach((p) => p && URL.revokeObjectURL(p.url))
      setPhotos({})
      formRef.current?.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const start = async (mode = facing) => {
    if (!navigator.mediaDevices?.getUserMedia) return setCamera('error')
    setCamera('starting')
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 1600 }, height: { ideal: 2000 } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setCamera('on')
    } catch {
      setCamera('error')
    }
  }

  const keep = (angle: Angle, file: File) => {
    setPhotos((cur) => {
      if (cur[angle]) URL.revokeObjectURL(cur[angle]!.url)
      return { ...cur, [angle]: { file, url: URL.createObjectURL(file) } }
    })
    const next = ANGLES.map((a) => a[0]).find((a) => a !== angle && !photos[a])
    if (next) setActive(next)
  }

  const shoot = async () => {
    if (!videoRef.current) return
    const file = await frameToFile(videoRef.current, `corpo-${active}`, facing === 'user')
    if (file) keep(active, file)
  }
  const timer = () => {
    let n = 5
    setCount(n)
    const id = window.setInterval(() => {
      n -= 1
      if (n <= 0) {
        window.clearInterval(id)
        setCount(null)
        void shoot()
      } else setCount(n)
    }, 1000)
  }

  const fromGallery = async (angle: Angle, input: HTMLInputElement) => {
    const f = input.files?.[0]
    if (!f) return
    keep(angle, await compressImage(f))
    input.value = ''
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    for (const [angle] of ANGLES) {
      fd.delete(angle)
      const p = photos[angle]
      if (p) fd.append(angle, p.file)
    }
    startTransition(() => formAction(fd))
  }

  const label = ANGLES.find((a) => a[0] === active)![1]
  const taken = ANGLES.filter(([a]) => photos[a]).length

  return (
    <form ref={formRef} className="capture" onSubmit={submit} noValidate aria-busy={pending}>
      <ul className="capture__tips">
        <li>Mesma luz e mesmo lugar sempre (de frente para uma janela é ótimo).</li>
        <li>Mesma distância: o corpo inteiro na foto, da cabeça aos pés.</li>
        <li>Roupa justa (top e short, ou roupa de banho).</li>
        <li>Fotografando sozinho? Apoie o celular e use a contagem de 5 segundos.</li>
      </ul>

      <div className="segmented" role="radiogroup" aria-label="Ângulo da foto">
        {ANGLES.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={active === k} onClick={() => setActive(k)}>
            {l}
            {photos[k] ? ' (ok)' : ''}
          </button>
        ))}
      </div>

      <div className="capture__stage" hidden={camera === 'off' || camera === 'error'}>
        <video ref={videoRef} playsInline muted style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined} aria-label={`Câmera: foto de ${label.toLowerCase()}`} />
        <Silhouette angle={active} />
        {count != null && (
          <div className="capture__count" aria-live="assertive">
            {count}
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        {camera === 'on' ? (
          <>
            <button type="button" className="btn btn--primary" onClick={shoot} disabled={count != null}>
              Tirar foto ({label.toLowerCase()})
            </button>
            <button type="button" className="btn" onClick={timer} disabled={count != null}>
              Tirar em 5 s
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                const next = facing === 'user' ? 'environment' : 'user'
                setFacing(next)
                void start(next)
              }}
            >
              Trocar câmera
            </button>
            <button type="button" className="btn btn--ghost" onClick={stop}>
              Fechar câmera
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => start()} disabled={camera === 'starting'}>
            {camera === 'starting' ? 'Abrindo a câmera…' : 'Abrir a câmera'}
          </button>
        )}
      </div>
      {camera === 'error' && (
        <p className="alert alert--warn small" role="status">
          Não foi possível abrir a câmera aqui. Use “Escolher da galeria” em cada foto.
        </p>
      )}

      <div className="capture__angles">
        {ANGLES.map(([k, l]) => (
          <div key={k} className="stack" style={{ ['--gap' as string]: '6px' }}>
            <figure data-active={active === k}>
              {photos[k] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photos[k]!.url} alt={`Prévia: ${l.toLowerCase()}`} />
              ) : (
                <span>{l}</span>
              )}
            </figure>
            <label className="btn btn--sm btn--block plate-btn">
              {photos[k] ? `Trocar ${l.toLowerCase()}` : 'Escolher da galeria'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/*" aria-label={`${l}: escolher da galeria`} onChange={(e) => fromGallery(k, e.currentTarget)} />
            </label>
          </div>
        ))}
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="bp-weight">Peso de hoje (kg, opcional)</label>
          <input id="bp-weight" name="weightKg" inputMode="decimal" placeholder="Ex.: 70,5" aria-describedby="bp-weight-hint" />
          <span id="bp-weight-hint" className="field__hint">
            Entra no histórico e fica ligado a estas fotos.
          </span>
        </div>
        <input type="hidden" name="date" value={today} />
      </div>

      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={pending || taken === 0}>
          {pending ? 'Enviando…' : taken > 1 ? `Enviar ${taken} fotos` : 'Enviar foto'}
        </button>
        {state.ok && (
          <a href={doneHref} className="btn">
            {doneLabel}
          </a>
        )}
      </div>
      {state.error && (
        <p className="alert alert--error" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="alert alert--ok" role="status">
          {state.message}
        </p>
      )}
    </form>
  )
}
