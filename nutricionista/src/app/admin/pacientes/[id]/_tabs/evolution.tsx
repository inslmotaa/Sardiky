import { schema } from '@/db'
import { goalsOf, measurementsOf } from '@/lib/patient-data'
import { getSettings } from '@/lib/settings'
import { fmtDay, todayIn } from '@/lib/time'
import { addMeasurement, deleteMeasurement } from '@/actions/admin/patients'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Evolution } from '@/components/Evolution'

export async function EvolutionTab({ patient, compare }: { patient: typeof schema.patients.$inferSelect; compare: { a?: string; b?: string } }) {
  const s = await getSettings()
  const [rows, goals] = await Promise.all([measurementsOf(patient.id), goalsOf(patient.id)])
  const lastHeight = [...rows].reverse().find((r) => r.heightCm != null)?.heightCm
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <details className="disclosure" open={rows.length === 0}>
        <summary>Registrar nova avaliação</summary>
        <div>
          <ActionForm action={addMeasurement.bind(null, patient.id)} className="stack" resetOnSuccess>
            <div className="form-grid form-grid--3">
              <Field label="Data" name="date" required>
                <input type="date" name="date" defaultValue={todayIn(s.timezone)} />
              </Field>
              <Field label="Peso (kg)" name="weightKg">
                <input name="weightKg" inputMode="decimal" />
              </Field>
              <Field label="Altura (cm)" name="heightCm">
                <input name="heightCm" inputMode="decimal" defaultValue={lastHeight ?? ''} />
              </Field>
              <Field label="Cintura (cm)" name="waistCm">
                <input name="waistCm" inputMode="decimal" />
              </Field>
              <Field label="Quadril (cm)" name="hipCm">
                <input name="hipCm" inputMode="decimal" />
              </Field>
              <Field label="Braço (cm)" name="armCm">
                <input name="armCm" inputMode="decimal" />
              </Field>
              <Field label="Coxa (cm)" name="thighCm">
                <input name="thighCm" inputMode="decimal" />
              </Field>
              <Field label="Tórax (cm)" name="chestCm">
                <input name="chestCm" inputMode="decimal" />
              </Field>
              <Field label="Gordura corporal (%)" name="bodyFatPct">
                <input name="bodyFatPct" inputMode="decimal" />
              </Field>
            </div>
            <Field label="Método do percentual de gordura" name="bodyFatMethod" hint="Obrigatório quando o percentual for informado (ex.: dobras cutâneas, bioimpedância).">
              <input name="bodyFatMethod" list="fat-methods" maxLength={80} />
            </Field>
            <datalist id="fat-methods">
              <option value="Dobras cutâneas (Pollock 7)" />
              <option value="Dobras cutâneas (Pollock 3)" />
              <option value="Bioimpedância" />
              <option value="DEXA" />
            </datalist>
            <fieldset>
              <legend>Outros indicadores (opcional)</legend>
              <div className="stack" style={{ ['--gap' as string]: '8px' }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="form-grid form-grid--3">
                    <input name={`extraLabel_${i}`} placeholder="Indicador (ex.: circ. pescoço)" aria-label={`Nome do indicador ${i + 1}`} />
                    <input name={`extraValue_${i}`} placeholder="Valor" inputMode="decimal" aria-label={`Valor do indicador ${i + 1}`} />
                    <input name={`extraUnit_${i}`} placeholder="Unidade" aria-label={`Unidade do indicador ${i + 1}`} />
                  </div>
                ))}
              </div>
            </fieldset>
            <Field label="Observações" name="notes">
              <textarea name="notes" rows={2} />
            </Field>
            <div>
              <SubmitButton>Salvar avaliação</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </details>

      <Evolution rows={rows} goals={goals} compare={compare} basePath={`/admin/pacientes/${patient.id}`} />

      {rows.length > 0 && (
        <details className="disclosure">
          <summary>Corrigir registros (excluir lançamentos incorretos)</summary>
          <div>
            <ul className="list">
              {[...rows].reverse().map((r) => (
                <li key={r.id} className="row row--between">
                  <span>
                    {fmtDay(r.date)} · {r.source === 'profissional' ? 'profissional' : 'paciente'} · {r.weightKg != null ? `${r.weightKg} kg` : ''}
                  </span>
                  <form action={deleteMeasurement.bind(null, patient.id, r.id)}>
                    <button className="btn btn--danger btn--sm" type="submit">
                      Excluir
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  )
}
