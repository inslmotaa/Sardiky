import type { FormField } from '@/lib/forms'
import type { ActionState } from '@/lib/action'
import { ActionForm, Field, FieldError, SubmitButton } from './form'

/** Renderiza um formulário configurado pelo profissional. */
export function FormFill({
  fields,
  action,
  consentText,
}: {
  fields: FormField[]
  action: (s: ActionState, fd: FormData) => Promise<ActionState>
  /** Consentimento LGPD exigido antes de enviar (anamnese: dados de saúde). */
  consentText?: string
}) {
  return (
    <ActionForm action={action} className="stack">
      {consentText && (
        <div className="card card--soft card--flat">
          <label className="check">
            <input type="checkbox" name="lgpd_consent" />
            <span>
              {consentText}
              <span className="req">*</span>
            </span>
          </label>
          <FieldError name="lgpd_consent" />
        </div>
      )}
      {fields.map((f) => {
        const name = `f_${f.id}`
        if (f.type === 'section') {
          return (
            <div key={f.id} className="form-section">
              <h2>{f.label}</h2>
              {f.help && <p className="muted small">{f.help}</p>}
            </div>
          )
        }
        if (f.type === 'scale') {
          const [low, high] = [f.options[0] ?? 'Pouco', f.options[1] ?? 'Muito']
          return (
            <fieldset key={f.id}>
              <legend>
                {f.label}
                {f.required && <span className="req">*</span>}
              </legend>
              {f.help && <p className="field__hint">{f.help}</p>}
              <div className="scale-input" role="radiogroup" aria-label={f.label}>
                <span className="small muted">{low}</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n}>
                    <input type="radio" name={name} value={n} />
                    <span>{n}</span>
                  </label>
                ))}
                <span className="small muted">{high}</span>
              </div>
              <FieldError name={name} />
            </fieldset>
          )
        }
        if (f.type === 'file') {
          return (
            <Field key={f.id} label={f.label} name={name} required={f.required} hint={f.help || 'PDF, JPG ou PNG até 5 MB. Visível só para você e para o coach.'}>
              <input type="file" name={name} accept="application/pdf,image/jpeg,image/png,image/webp" />
            </Field>
          )
        }
        if (f.type === 'checkbox' || f.type === 'radio') {
          return (
            <fieldset key={f.id}>
              <legend>
                {f.label}
                {f.required && <span className="req">*</span>}
              </legend>
              {f.help && <p className="field__hint">{f.help}</p>}
              <div className="choice-grid">
                {f.options.map((o) => (
                  <label key={o} className="check">
                    <input type={f.type} name={name} value={o} /> {o}
                  </label>
                ))}
              </div>
              <FieldError name={name} />
            </fieldset>
          )
        }
        if (f.type === 'consent') {
          return (
            <div key={f.id} className="card card--soft card--flat">
              <label className="check">
                <input type="checkbox" name={name} />
                <span>
                  {f.label}
                  {f.required && <span className="req">*</span>}
                </span>
              </label>
              <FieldError name={name} />
            </div>
          )
        }
        return (
          <Field key={f.id} label={f.label} name={name} required={f.required} hint={f.help || undefined}>
            {f.type === 'textarea' ? (
              <textarea name={name} rows={3} maxLength={5000} />
            ) : f.type === 'select' ? (
              <select name={name} defaultValue="">
                <option value="">Selecione</option>
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input name={name} type={f.type === 'number' ? 'text' : f.type === 'date' ? 'date' : 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} maxLength={500} />
            )}
          </Field>
        )
      })}
      <div>
        <SubmitButton pendingText="Enviando…">Enviar respostas</SubmitButton>
      </div>
    </ActionForm>
  )
}
