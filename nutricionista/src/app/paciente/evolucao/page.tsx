import { requirePatient } from '@/lib/auth/session'
import { featuresOf } from '@/lib/patient-context'
import { getSettings } from '@/lib/settings'
import { goalsOf, measurementsOf } from '@/lib/patient-data'
import { todayIn } from '@/lib/time'
import { addOwnProgressPhotos, addSelfMeasurement, deleteOwnProgressPhoto, toggleOwnGoal } from '@/actions/patient'
import { adherenceSummary } from '@/lib/diary'
import { photosOf } from '@/lib/photos'
import { AdherenceBars } from '@/components/AdherenceBars'
import { ProgressPhotos } from '@/components/nutri/ProgressPhotos'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Evolution } from '@/components/Evolution'
import { PageHead } from '@/components/ui'

export default async function EvolutionPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const sp = await searchParams
  const user = await requirePatient()
  const features = await featuresOf(user.patientId)
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const [rows, goals, summary, photos] = await Promise.all([
    measurementsOf(user.patientId),
    goalsOf(user.patientId),
    adherenceSummary(user.patientId, today, s.timezone, { good: s.adherenceGood, low: s.adherenceLow }),
    photosOf(user.patientId, user.id, false),
  ])
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead title="Seu progresso" subtitle="Pontos cheios são medições feitas pelo nutricionista; pontos vazados são valores informados por você." />
      {summary.hasPlan && (
        <section className="card" aria-labelledby="adesao">
          <h2 id="adesao" style={{ fontSize: '1.15rem' }}>
            Constância
          </h2>
          <div className="stat-row" style={{ marginBottom: 12 }}>
            <div className="stat">
              <strong>{summary.pct7 != null ? `${summary.pct7}%` : '—'}</strong>
              <span>das refeições do plano feitas nos últimos 7 dias (até ontem)</span>
            </div>
            <div className="stat">
              <strong>
                {summary.streak} {summary.streak === 1 ? 'dia' : 'dias'}
              </strong>
              <span>seguidos registrando</span>
            </div>
          </div>
          <AdherenceBars weeks={summary.weekly} good={s.adherenceGood} />
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            {summary.pct7 != null && summary.pct7 >= s.adherenceGood
              ? 'Você está mantendo uma ótima constância. Continue assim!'
              : 'Cada refeição registrada conta. Se a semana foi difícil, tudo bem — amanhã é um novo dia.'}
          </p>
        </section>
      )}
      <Evolution rows={rows} goals={goals} compare={sp} basePath="/paciente/evolucao" onToggleGoal={toggleOwnGoal} />
      <section className="card" id="fotos">
        <h2 style={{ fontSize: '1.15rem' }}>Fotos de evolução</h2>
        <ProgressPhotos
          photos={photos}
          upload={addOwnProgressPhotos}
          onDelete={deleteOwnProgressPhoto}
          today={today}
          privacyNote="Suas fotos são privadas: só você e o seu nutricionista podem vê-las."
        />
      </section>
      {features.peso && (
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
      )}
    </div>
  )
}
