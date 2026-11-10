import { schema } from '@/db'
import { goalsOf, measurementsOf } from '@/lib/patient-data'
import { getSettings } from '@/lib/settings'
import { ageFrom, fmtDay, todayIn } from '@/lib/time'
import { addMeasurement, addProgressPhotos, deleteMeasurement, deleteProgressPhoto } from '@/actions/admin/patients'
import { commentPhotoSet } from '@/actions/admin/corpo'
import { photosOf } from '@/lib/photos'
import { evolutionData } from '@/lib/evolucao'
import { FOTOS_CORPO, FOTOS_RELATORIO, hasConsent } from '@/lib/corpo-server'
import { EvolutionOverview } from '@/components/EvolutionOverview'
import { ProgressPhotos } from '@/components/nutri/ProgressPhotos'
import { AssessmentForm } from '@/components/nutri/AssessmentForm'
import { Evolution } from '@/components/Evolution'

export async function EvolutionTab({ patient, compare }: { patient: typeof schema.patients.$inferSelect; compare: { a?: string; b?: string } }) {
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const [rows, goals, photos, evo, bodyConsent, reportPhotos] = await Promise.all([
    measurementsOf(patient.id),
    goalsOf(patient.id),
    photosOf(patient.id),
    evolutionData(patient.id, today),
    hasConsent(patient.id, FOTOS_CORPO),
    hasConsent(patient.id, FOTOS_RELATORIO),
  ])
  const lastHeight = [...rows].reverse().find((r) => r.heightCm != null)?.heightCm
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <details className="disclosure" open={rows.length === 0}>
        <summary>Registrar nova avaliação</summary>
        <div>
          <AssessmentForm
            action={addMeasurement.bind(null, patient.id)}
            sex={patient.sex === 'F' || patient.sex === 'M' ? patient.sex : null}
            age={ageFrom(patient.birthDate, today)}
            lastHeight={lastHeight ?? patient.heightCm ?? null}
            today={today}
          />
        </div>
      </details>

      <div className="row">
        <a href={`/admin/pacientes/${patient.id}/evolucao/pdf`} className="btn btn--sm btn--primary">
          Relatório de evolução (PDF)
        </a>
        <span className="small muted">{reportPhotos ? 'O cliente autorizou as fotos no relatório.' : 'Sem autorização do cliente: o relatório sai sem fotos.'}</span>
      </div>
      <EvolutionOverview data={evo} who="coach" />
      <Evolution rows={rows} goals={goals} compare={compare} basePath={`/admin/pacientes/${patient.id}`} skip={['weightKg']} />

      <section className="card" id="fotos">
        <h2 style={{ fontSize: '1.15rem' }}>Fotos do corpo</h2>
        {!bodyConsent && <p className="alert alert--warn small">O cliente ainda não autorizou fotos do corpo. Novas fotos só depois da autorização dele (Meu corpo → Fotos do corpo).</p>}
        <ProgressPhotos
          photos={photos}
          sets={evo.sets}
          upload={bodyConsent ? addProgressPhotos.bind(null, patient.id) : undefined}
          onDelete={deleteProgressPhoto.bind(null, patient.id)}
          comment={commentPhotoSet.bind(null, patient.id)}
          today={today}
          privacyNote="Fotos privadas: só o cliente e o coach responsável. Nunca aparecem no site, em depoimentos ou no relatório sem autorização."
        />
      </section>

      {rows.length > 0 && (
        <details className="disclosure">
          <summary>Corrigir registros (excluir lançamentos incorretos)</summary>
          <div>
            <ul className="list">
              {[...rows].reverse().map((r) => (
                <li key={r.id} className="row row--between">
                  <span>
                    {fmtDay(r.date)} · {r.source === 'profissional' ? 'coach' : 'cliente'} · {r.weightKg != null ? `${r.weightKg} kg` : ''}
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
