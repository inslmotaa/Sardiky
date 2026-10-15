import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { goalsOf, measurementsOf } from '@/lib/patient-data'
import { todayIn } from '@/lib/time'
import { addSelfMeasurement } from '@/actions/patient'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Evolution } from '@/components/Evolution'
import { PageHead } from '@/components/ui'

export default async function EvolutionPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const sp = await searchParams
  const user = await requirePatient()
  const s = await getSettings()
  const [rows, goals] = await Promise.all([measurementsOf(user.patientId), goalsOf(user.patientId)])
  const today = todayIn(s.timezone)
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead title="Sua evolução" subtitle="Pontos cheios são medições feitas pelo nutricionista; pontos vazados são valores informados por você." />
      <Evolution rows={rows} goals={goals} compare={sp} basePath="/paciente/evolucao" />
      <section className="card" id="registrar">
        <h2 style={{ fontSize: '1.15rem' }}>Registrar uma medida em casa</h2>
        <p className="muted small">
          Esses valores ficam identificados como “informados pelo paciente” e não substituem a avaliação profissional. Para o peso, prefira
          pesar-se pela manhã, em jejum e na mesma balança.
        </p>
        <ActionForm action={addSelfMeasurement} className="stack" resetOnSuccess>
          <div className="form-grid">
            <Field label="Data" name="date" required>
              <input type="date" name="date" defaultValue={today} max={today} />
            </Field>
            <Field label="Peso (kg)" name="weightKg">
              <input name="weightKg" inputMode="decimal" placeholder="Ex.: 72,4" />
            </Field>
            <Field label="Cintura (cm)" name="waistCm">
              <input name="waistCm" inputMode="decimal" />
            </Field>
            <Field label="Quadril (cm)" name="hipCm">
              <input name="hipCm" inputMode="decimal" />
            </Field>
          </div>
          <Field label="Observação" name="notes">
            <input name="notes" maxLength={300} placeholder="Ex.: balança de casa, pela manhã" />
          </Field>
          <div>
            <SubmitButton>Registrar</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  )
}
