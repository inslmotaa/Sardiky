'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { createFood, lookupBarcode } from '@/actions/admin/nutrition'
import { ActionForm, Field, FieldError, SubmitButton } from '@/components/form'
import type { OffSuggestion } from '@/lib/openfoodfacts'

type Groups = [string, string][]

/** Leitor de código de barras nativo do navegador (Chrome/Android); nos demais, o código é digitado. */
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorCtor = new (o: { formats: string[] }) => Detector

function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let stream: MediaStream | null = null
    let stop = false
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador não lê código de barras pela câmera. Digite os números abaixo do código.')
      return
    }
    const detector = new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (s) => {
        stream = s
        if (!video.current) return
        video.current.srcObject = s
        await video.current.play()
        const tick = async () => {
          if (stop || !video.current) return
          try {
            const found = await detector.detect(video.current)
            if (found[0]?.rawValue) {
              onCode(found[0].rawValue)
              return
            }
          } catch {
            /* quadro ainda sem imagem */
          }
          setTimeout(tick, 250)
        }
        tick()
      })
      .catch(() => setError('Não foi possível abrir a câmera. Permita o acesso ou digite o código.'))
    return () => {
      stop = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onCode])
  return (
    <div className="barcode-scan stack" style={{ ['--gap' as string]: '8px' }}>
      {error ? (
        <p className="alert alert--info small" role="status" style={{ margin: 0 }}>
          {error}
        </p>
      ) : (
        <video ref={video} className="barcode-scan__video" muted playsInline aria-label="Câmera apontada para o código de barras" />
      )}
      <button type="button" className="btn btn--sm" onClick={onClose}>
        Fechar câmera
      </button>
    </div>
  )
}

/**
 * Cadastro de alimento próprio: pelo rótulo ou pelo código de barras (câmera ou digitado), com sugestão
 * do Open Food Facts. A sugestão só preenche o formulário; o coach confere com o rótulo e confirma.
 */
export function FoodCreateForm({ groups }: { groups: Groups }) {
  const [code, setCode] = useState('')
  const [scan, setScan] = useState(false)
  const [pending, start] = useTransition()
  const [result, setResult] = useState<Awaited<ReturnType<typeof lookupBarcode>> | null>(null)
  const [fill, setFill] = useState<OffSuggestion | null>(null)
  const [formKey, setFormKey] = useState(0)

  const search = (raw: string) => {
    setCode(raw)
    setScan(false)
    start(async () => {
      const r = await lookupBarcode(raw)
      setResult(r)
      if (r.suggestion) {
        setFill(r.suggestion)
        setFormKey((k) => k + 1)
      }
    })
  }

  const v = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))
  const barcode = fill?.barcode ?? (result?.notFound ? result.notFound : '')

  return (
    <div className="stack">
      <div className="card card--inset stack" style={{ ['--gap' as string]: '10px' }} aria-labelledby="barcode-titulo">
        <h3 id="barcode-titulo" style={{ margin: 0, fontSize: '1rem' }}>
          Produto industrializado: código de barras
        </h3>
        <p className="small muted" style={{ margin: 0 }}>
          Aponte a câmera do celular para o código ou digite os números. Buscamos no Open Food Facts (base aberta) e você confere com o rótulo antes de salvar.
        </p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            search(code)
          }}
        >
          <label className="field" style={{ flex: '1 1 200px' }}>
            <span className="field__label">Código de barras</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="Ex.: 7891000100103" />
          </label>
          <button type="submit" className="btn" disabled={pending} style={{ alignSelf: 'flex-end' }}>
            {pending ? 'Buscando…' : 'Buscar produto'}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setScan(true)} style={{ alignSelf: 'flex-end' }}>
            Ler com a câmera
          </button>
        </form>
        {scan && <Scanner onCode={search} onClose={() => setScan(false)} />}
        {result?.error && (
          <p className="alert alert--error small" role="alert" style={{ margin: 0 }}>
            {result.error}
          </p>
        )}
        {result?.existing && (
          <p className="alert alert--info small" role="status" style={{ margin: 0 }}>
            Este produto já está na base: <Link href={`/admin/alimentos/${result.existing.id}`}>{result.existing.name}</Link>.
          </p>
        )}
        {result?.notFound && (
          <p className="alert alert--info small" role="status" style={{ margin: 0 }}>
            Produto {result.notFound} não encontrado no Open Food Facts. Preencha abaixo pelo rótulo: o código fica salvo junto.
          </p>
        )}
        {result?.suggestion && (
          <p className="alert alert--warn small" role="status" style={{ margin: 0 }}>
            Encontrado: <strong>{result.suggestion.name}</strong>
            {result.suggestion.serving ? ` (porção: ${result.suggestion.serving})` : ''}. Os valores abaixo vieram do Open Food Facts:{' '}
            {result.suggestion.incomplete ? 'faltam dados, complete pelo rótulo' : 'confira cada um com o rótulo'} antes de salvar.
          </p>
        )}
      </div>

      <ActionForm key={formKey} action={createFood} className="stack" resetOnSuccess>
        {barcode && <input type="hidden" name="barcode" value={barcode} />}
        {fill && <input type="hidden" name="fromOff" value="1" />}
        <div className="form-grid">
          <Field label="Nome" name="name" required>
            <input type="text" name="name" maxLength={160} placeholder="Ex.: Pão de queijo da marca X" defaultValue={fill?.name ?? ''} />
          </Field>
          <Field label="Grupo" name="group">
            <select name="group" defaultValue="outros">
              {groups.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Valores por 100 g (se o rótulo informa por porção, divida pelo peso da porção e multiplique por 100).
        </p>
        <div className="form-grid form-grid--3">
          {(
            [
              ['kcal', 'Calorias (kcal)', fill?.kcal],
              ['protein', 'Proteína (g)', fill?.protein],
              ['carbs', 'Carboidrato (g)', fill?.carbs],
              ['fat', 'Gordura (g)', fill?.fat],
              ['fiber', 'Fibra (g)', fill?.fiber],
              ['sodium', 'Sódio (mg)', fill?.sodiumMg],
            ] as const
          ).map(([k, label, val]) => (
            <Field key={k} label={label} name={k}>
              <input type="text" name={k} inputMode="decimal" defaultValue={v(val)} />
            </Field>
          ))}
        </div>
        <div className="form-grid form-grid--3">
          <Field label="Medida caseira (opcional)" name="measureName">
            <input type="text" name="measureName" placeholder="Ex.: unidade" />
          </Field>
          <Field label="Gramas da medida" name="measureGrams">
            <input type="text" name="measureGrams" inputMode="decimal" />
          </Field>
          <Field label="Fator de cocção (opcional)" name="cookingFactor" hint="Peso cozido ÷ peso cru">
            <input type="text" name="cookingFactor" inputMode="decimal" />
          </Field>
        </div>
        {barcode && <p className="small muted" style={{ margin: 0 }}>Código de barras: {barcode}</p>}
        {fill && (
          <div>
            <label className="check">
              <input type="checkbox" name="offConfirm" /> Conferi os valores com o rótulo do produto
            </label>
            <FieldError name="offConfirm" />
          </div>
        )}
        <div>
          <SubmitButton>Cadastrar alimento</SubmitButton>
        </div>
      </ActionForm>
    </div>
  )
}
