'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { ANAMNESIS_STEPS, ANAMNESIS_TOTAL_STEPS, answerText, type AnamField, type AnamFile } from '@/lib/anamnese-form'
import { saveAnamnesisStep, submitAnamnesis, uploadAnamnesisFile } from '@/actions/anamnese'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import type { ActionState } from '@/lib/action'

type Answers = Record<string, Record<string, unknown>>

/**
 * Anamnese em etapas, com barra de progresso. Cada "Próxima" salva a etapa no servidor (validação zod),
 * então dá para sair e continuar depois. Todas as etapas ficam montadas (só a atual visível) para não perder o que foi digitado.
 */
export function AnamnesisWizard({ answers, startAt, next, version }: { answers: Answers; startAt: number; next: string | null; version: number }) {
  const router = useRouter()
  const [step, setStep] = useState(Math.min(startAt, ANAMNESIS_STEPS.length))
  const top = useRef<HTMLDivElement>(null)
  const go = (i: number) => {
    setStep(i)
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const pct = Math.round((step / (ANAMNESIS_TOTAL_STEPS - 1)) * 100)
  const isReview = step === ANAMNESIS_STEPS.length

  return (
    <div className="anam" ref={top}>
      <div className="anam__progress" aria-label={`Etapa ${step + 1} de ${ANAMNESIS_TOTAL_STEPS}`}>
        <div className="row row--between small">
          <strong>
            Etapa {step + 1} de {ANAMNESIS_TOTAL_STEPS} · {isReview ? 'Revisão e envio' : ANAMNESIS_STEPS[step].title}
          </strong>
          <span className="muted">{pct}%</span>
        </div>
        <div className="anam__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <ol className="anam__dots">
          {[...ANAMNESIS_STEPS.map((s) => s.title), 'Revisão'].map((t, i) => (
            <li key={t} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}>
              <span className="sr-only">{t}</span>
            </li>
          ))}
        </ol>
      </div>

      {ANAMNESIS_STEPS.map((s, i) => (
        <section key={s.key} hidden={i !== step} className="card anam__step" aria-labelledby={`anam-${s.key}`}>
          <h2 id={`anam-${s.key}`}>{s.title}</h2>
          {s.intro && <p className="muted small">{s.intro}</p>}
          <ActionForm
            className="stack"
            action={async (prev: ActionState, fd: FormData) => {
              const r = await saveAnamnesisStep(i, prev, fd)
              if (r.ok) {
                router.refresh()
                go(i + 1)
              }
              return r
            }}
          >
            <div className="form-grid">
              {s.fields.map((f) => (
                <AnamInput key={f.id} f={f} value={answers[s.key]?.[f.id]} />
              ))}
            </div>
            <div className="anam__nav">
              {i > 0 && (
                <button type="button" className="btn btn--ghost" onClick={() => go(i - 1)}>
                  Voltar
                </button>
              )}
              <SubmitButton className="btn btn--primary btn--fx" pendingText="Salvando…">
                Salvar e continuar
              </SubmitButton>
              <SubmitButton className="btn" name="sair" value="1" pendingText="Salvando…">
                Salvar e sair
              </SubmitButton>
            </div>
          </ActionForm>
        </section>
      ))}

      <section hidden={!isReview} className="card anam__step" aria-labelledby="anam-revisao">
        <h2 id="anam-revisao">Revisão e envio</h2>
        <p className="muted small">Confira as respostas. Se algo estiver errado, toque em “Editar” na etapa.</p>
        {ANAMNESIS_STEPS.map((s, i) => (
          <div key={s.key} className="anam__review">
            <div className="row row--between">
              <h3>{s.title}</h3>
              <button type="button" className="link-btn small" onClick={() => go(i)}>
                Editar
              </button>
            </div>
            <dl>
              {s.fields.map((f) => {
                const t = answerText(f, answers[s.key]?.[f.id])
                return (
                  <div key={f.id}>
                    <dt>{f.label}</dt>
                    <dd>{t || <span className="muted">—</span>}</dd>
                  </div>
                )
              })}
            </dl>
          </div>
        ))}
        <ActionForm action={submitAnamnesis} className="stack">
          {next && <input type="hidden" name="next" value={next} />}
          <div className="anam__nav">
            <button type="button" className="btn btn--ghost" onClick={() => go(ANAMNESIS_STEPS.length - 1)}>
              Voltar
            </button>
            <SubmitButton className="btn btn--primary btn--fx" pendingText="Enviando…">
              {version > 1 ? 'Enviar reavaliação' : 'Enviar anamnese'}
            </SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  )
}

function AnamInput({ f, value }: { f: AnamField; value: unknown }) {
  const v = value === undefined || value === null ? '' : String(value)
  const wide = f.type === 'textarea' || f.type === 'files'
  const label = f.unit ? `${f.label} (${f.unit})` : f.label
  if (f.type === 'files') return <FilesInput f={f} initial={(value as AnamFile[]) ?? []} />
  return (
    <Field label={label} name={f.id} required={f.required} hint={f.hint} className={wide ? 'span-2' : undefined}>
      {f.type === 'textarea' ? (
        <textarea name={f.id} rows={3} maxLength={3000} defaultValue={v} placeholder={f.placeholder} />
      ) : f.type === 'select' ? (
        <select name={f.id} defaultValue={v}>
          <option value="">Selecione</option>
          {f.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          name={f.id}
          type={f.type === 'number' ? 'text' : f.type}
          inputMode={f.type === 'number' ? 'decimal' : undefined}
          defaultValue={f.type === 'number' ? v.replace('.', ',') : v}
          placeholder={f.placeholder}
          maxLength={200}
        />
      )}
    </Field>
  )
}

/** Anexos de exames: cada arquivo vai na hora para a área privada; a etapa guarda a lista. */
function FilesInput({ f, initial }: { f: AnamField; initial: AnamFile[] }) {
  const [files, setFiles] = useState<AnamFile[]>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="field span-2">
      <label htmlFor="anam-file">{f.label}</label>
      <input type="hidden" name={f.id} value={JSON.stringify(files)} />
      {files.length > 0 && (
        <ul className="anam__files">
          {files.map((x) => (
            <li key={x.id}>
              <a href={`/arquivos/${x.id}`} target="_blank" rel="noopener noreferrer">
                {x.title}
              </a>
              <button type="button" className="link-btn small" onClick={() => setFiles((l) => l.filter((y) => y.id !== x.id))}>
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        <input
          id="anam-file"
          ref={input}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="file-input"
          disabled={pending || files.length >= 10}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setError(null)
            const fd = new FormData()
            fd.set('file', file)
            start(async () => {
              const r = await uploadAnamnesisFile(fd)
              if (r.file) setFiles((l) => [...l, r.file!])
              else setError(r.error ?? 'Não foi possível enviar.')
              if (input.current) input.current.value = ''
            })
          }}
        />
        {pending && <span className="small muted">Enviando arquivo…</span>}
      </div>
      {f.hint && <span className="field__hint">{f.hint} PDF, JPG ou PNG até 5 MB.</span>}
      {error && <span className="field__error">{error}</span>}
    </div>
  )
}
