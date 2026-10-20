import { schema } from '@/db'
import { goalsOf, measurementsOf } from '@/lib/patient-data'
import { getSettings } from '@/lib/settings'
import { ageFrom, fmtDay, todayIn } from '@/lib/time'
import { addMeasurement, addProgressPhotos, deleteMeasurement, deleteProgressPhoto } from '@/actions/admin/patients'
import { photosOf } from '@/lib/photos'
import { ProgressPhotos } from '@/components/nutri/ProgressPhotos'
import { AssessmentForm } from '@/components/nutri/AssessmentForm'
import { Evolution } from '@/components/Evolution'

export async function EvolutionTab({ patient, compare, viewerId }: { patient: typeof schema.patients.$inferSelect; compare: { a?: string; b?: string }; viewerId: string }) {
  const s = await getSettings()
  const [rows, goals, photos] = await Promise.all([measurementsOf(patient.id), goalsOf(patient.id), photosOf(patient.id, viewerId, true)])
  const lastHeight = [...rows].reverse().find((r) => r.heightCm != null)?.heightCm
  const today = todayIn(s.timezone)
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

      <Evolution rows={rows} goals={goals} compare={compare} basePath={`/admin/pacientes/${patient.id}`} />

      <section className="card" id="fotos">
        <h2 style={{ fontSize: '1.15rem' }}>Fotos de evolução</h2>
        <ProgressPhotos
          photos={photos}
          upload={addProgressPhotos.bind(null, patient.id)}
          onDelete={deleteProgressPhoto.bind(null, patient.id)}
          today={today}
          privacyNote="Fotos privadas: visíveis apenas ao paciente e à equipe com permissão clínica."
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
