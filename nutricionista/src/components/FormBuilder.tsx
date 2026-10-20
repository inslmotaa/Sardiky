'use client'

import { startTransition, useActionState, useState } from 'react'
import type { ActionState } from '@/lib/action'
import { FIELD_MAPS, FIELD_TYPES, FORM_KINDS, type FieldMap, type FieldType, type FormField } from '@/lib/forms'

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30) || 'campo'

/** Editor de modelos de formulário (anamnese, questionários, termos). */
export function FormBuilder({
  action,
  initial,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>
  initial: { title: string; description: string; kind: string; fields: FormField[] }
}) {
  const [fields, setFields] = useState<FormField[]>(initial.fields)
  const [state, formAction, pending] = useActionState(action, {})

  const set = (i: number, patch: Partial<FormField>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const add = () =>
    setFields((fs) => {
      let id = `pergunta_${fs.length + 1}`
      while (fs.some((f) => f.id === id)) id += '_'
      return [...fs, { id, label: '', type: 'text', required: false, options: [], help: '' }]
    })
  const move = (i: number, d: number) =>
    setFields((fs) => {
      const j = i + d
      if (j < 0 || j >= fs.length) return fs
      const c = [...fs]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(() => formAction(fd))
      }}
      className="stack"
    >
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
      <section className="card stack">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="fb-title">Título</label>
            <input id="fb-title" name="title" defaultValue={initial.title} maxLength={160} />
          </div>
          <div className="field">
            <label htmlFor="fb-kind">Tipo</label>
            <select id="fb-kind" name="kind" defaultValue={initial.kind}>
              {Object.entries(FORM_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="fb-desc">Descrição para o paciente</label>
          <input id="fb-desc" name="description" defaultValue={initial.description} maxLength={500} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          LGPD: inclua apenas perguntas necessárias para o atendimento.
        </p>
      </section>

      {fields.map((f, i) => (
        <section key={i} className="editor-meal stack" style={{ ['--gap' as string]: '10px' }}>
          <div className="editor-row editor-row--meal">
            <div className="field">
              <label htmlFor={`fb-${i}-label`}>Pergunta {i + 1}</label>
              <input
                id={`fb-${i}-label`}
                value={f.label}
                onChange={(e) => set(i, { label: e.target.value, id: initial.fields.some((x) => x.id === f.id) ? f.id : slug(e.target.value) })}
                maxLength={300}
              />
            </div>
            <div className="field">
              <label htmlFor={`fb-${i}-type`}>Tipo</label>
              <select id={`fb-${i}-type`} value={f.type} onChange={(e) => set(i, { type: e.target.value as FieldType })}>
                {Object.entries(FIELD_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="icon-btn" aria-label="Subir pergunta" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" className="icon-btn" aria-label="Descer pergunta" disabled={i === fields.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button type="button" className="icon-btn" aria-label="Remover pergunta" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
          {f.type === 'scale' && (
            <div className="form-grid">
              <input aria-label="Rótulo do 1" placeholder="Rótulo do 1 (ex.: pouca fome)" value={f.options[0] ?? ''} onChange={(e) => set(i, { options: [e.target.value, f.options[1] ?? ''] })} maxLength={60} />
              <input aria-label="Rótulo do 5" placeholder="Rótulo do 5 (ex.: muita fome)" value={f.options[1] ?? ''} onChange={(e) => set(i, { options: [f.options[0] ?? '', e.target.value] })} maxLength={60} />
            </div>
          )}
          {['checkbox', 'text', 'textarea', 'radio', 'select'].includes(f.type) && (
            <div className="field">
              <label htmlFor={`fb-${i}-map`}>Levar a resposta para a ficha</label>
              <select id={`fb-${i}-map`} value={f.mapsTo ?? ''} onChange={(e) => set(i, { mapsTo: (e.target.value || null) as FieldMap | null })}>
                <option value="">Não</option>
                {Object.entries(FIELD_MAPS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}
          {['select', 'radio', 'checkbox'].includes(f.type) && (
            <div className="field">
              <label htmlFor={`fb-${i}-opts`}>Opções (uma por linha)</label>
              <textarea
                id={`fb-${i}-opts`}
                rows={3}
                value={f.options.join('\n')}
                onChange={(e) => set(i, { options: e.target.value.split('\n').map((o) => o.trim()).filter(Boolean) })}
              />
            </div>
          )}
          <div className="row">
            <input aria-label="Texto de ajuda" placeholder="Texto de ajuda (opcional)" value={f.help} onChange={(e) => set(i, { help: e.target.value })} style={{ flex: 1, minWidth: 200 }} maxLength={500} />
            <label className="check">
              <input type="checkbox" checked={f.required} onChange={(e) => set(i, { required: e.target.checked })} /> Obrigatória
            </label>
          </div>
        </section>
      ))}

      <div className="row">
        <button type="button" className="btn" onClick={add}>
          + Pergunta
        </button>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar modelo'}
        </button>
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
