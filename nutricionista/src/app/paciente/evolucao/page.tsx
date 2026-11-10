import Link from 'next/link'
import { requireActivePatient } from '@/lib/auth/patient-gate'
import { featuresOf } from '@/lib/patient-context'
import { getSettings } from '@/lib/settings'
import { goalsOf } from '@/lib/patient-data'
import { todayIn } from '@/lib/time'
import { addSelfMeasurement, toggleOwnGoal } from '@/actions/patient'
import { deleteOwnBodyPhoto, setReportPhotos } from '@/actions/corpo'
import { adherenceSummary } from '@/lib/diary'
import { photosOf } from '@/lib/photos'
import { evolutionData } from '@/lib/evolucao'
import { FOTOS_CORPO, FOTOS_RELATORIO, hasConsent } from '@/lib/corpo-server'
import { AdherenceBars } from '@/components/AdherenceBars'
import { ProgressPhotos } from '@/components/nutri/ProgressPhotos'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Evolution } from '@/components/Evolution'
import { EvolutionOverview } from '@/components/EvolutionOverview'
import { PageHead } from '@/components/ui'

export default async function EvolutionPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const sp = await searchParams
  const user = await requireActivePatient()
  const features = await featuresOf(user.patientId)
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const [evo, goals, summary, photos, bodyConsent, reportPhotos] = await Promise.all([
    evolutionData(user.patientId, today),
    goalsOf(user.patientId),
    adherenceSummary(user.patientId, today, s.timezone, { good: s.adherenceGood, low: s.adherenceLow }),
    photosOf(user.patientId),
    hasConsent(user.patientId, FOTOS_CORPO),
    hasConsent(user.patientId, FOTOS_RELATORIO),
  ])
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead
        title="Seu progresso"
        subtitle="Peso, IMC, medidas, fotos e check-ins num só lugar. Pontos cheios são medições do coach; vazados, valores informados por você."
        actions={
          <a href="/paciente/evolucao/pdf" className="btn btn--sm">
            Relatório de evolução (PDF)
          </a>
        }
      />
      <EvolutionOverview data={evo} />
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
              : 'Cada refeição registrada conta. Se a semana foi difícil, tudo bem: amanhã é um novo dia.'}
          </p>
        </section>
      )}
      <Evolution rows={evo.rows} goals={goals} compare={sp} basePath="/paciente/evolucao" onToggleGoal={toggleOwnGoal} skip={['weightKg']} />
      {features.fotosCorpo && (
        <section className="card" id="fotos" aria-labelledby="fotos-titulo">
          <div className="card__head">
            <h2 id="fotos-titulo" style={{ fontSize: '1.15rem' }}>
              Fotos do corpo <span className="send-card__tag">Opcional</span>
            </h2>
            <Link href="/paciente/meu-corpo/fotos" className="btn btn--sm btn--primary">
              Enviar fotos do corpo
            </Link>
          </div>
          {!bodyConsent && photos.length === 0 ? (
            <p className="muted small">Para enviar fotos do corpo, é preciso autorizar uma vez. Toque em “Enviar fotos do corpo”.</p>
          ) : (
            <ProgressPhotos photos={photos} sets={evo.sets} onDelete={deleteOwnBodyPhoto} today={today} privacyNote="Suas fotos são privadas: só você e o seu coach podem vê-las. Você pode apagar qualquer uma." />
          )}
          <form action={setReportPhotos} className="row" style={{ marginTop: 14, alignItems: 'center' }}>
            <label className="check" style={{ flex: '1 1 260px' }}>
              <input type="checkbox" name="fotos" defaultChecked={reportPhotos} />
              <span>Incluir minhas fotos do corpo no relatório de evolução (PDF). Sem esta autorização, o relatório sai só com os números.</span>
            </label>
            <button type="submit" className="btn btn--sm">
              Salvar preferência
            </button>
          </form>
        </section>
      )}
      {features.peso && (
        <section className="card" id="registrar">
          <h2 style={{ fontSize: '1.15rem' }}>Registrar uma medida em casa</h2>
          <p className="muted small">
            Esses valores ficam identificados como “informados pelo cliente” e não substituem a avaliação profissional. Para o peso, prefira pesar-se pela manhã, em jejum e na mesma balança.
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
