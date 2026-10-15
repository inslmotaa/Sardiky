import type { FormField } from '@/lib/forms'
import type { ActionState } from '@/lib/action'
import { ActionForm, Field, FieldError, SubmitButton } from './form'

/** Renderiza um formulário configurado pelo profissional. */
export function FormFill({ fields, action }: { fields: FormField[]; action: (s: ActionState, fd: FormData) => Promise<ActionState> }) {
  return (
    <ActionForm action={action} className="stack">
      {fields.map((f) => {
        const name = `f_${f.id}`
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
