import { ActionForm, Field, SubmitButton } from './form'
import { createPlan } from '@/actions/admin/plans'

/** Formulário de criação de plano: em branco, a partir de modelo ou de outro plano. */
export function NewPlanForm({
  patients,
  sources,
  patientId,
  defaultTitle = 'Plano alimentar',
}: {
  patients?: { id: string; name: string }[]
  sources: { id: string; label: string }[]
  patientId?: string
  defaultTitle?: string
}) {
  return (
    <ActionForm action={createPlan} className="stack">
      {patientId ? (
        <input type="hidden" name="patientId" value={patientId} />
      ) : (
        <Field label="Paciente" name="patientId" hint="Ou marque “criar como modelo” abaixo.">
          <select name="patientId" defaultValue="">
            <option value="">Selecione</option>
            {patients?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Título" name="title" required>
        <input name="title" defaultValue={defaultTitle} maxLength={160} />
      </Field>
      <Field label="Começar a partir de" name="sourceId">
        <select name="sourceId" defaultValue="">
          <option value="">Plano em branco</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      {!patientId && (
        <label className="check">
          <input type="checkbox" name="template" /> Criar como modelo reutilizável
        </label>
      )}
      <div>
        <SubmitButton>Criar rascunho</SubmitButton>
      </div>
    </ActionForm>
  )
}
