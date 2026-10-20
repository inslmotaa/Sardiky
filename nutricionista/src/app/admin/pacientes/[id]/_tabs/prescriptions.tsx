import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { addPrescription, setPrescriptionActive } from '@/actions/admin/content'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Empty } from '@/components/ui'
import { PRESCRIPTION_TYPES } from '@/lib/constants'


export async function PrescriptionsTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const s = await getSettings()
  const list = await db.select().from(schema.prescriptions).where(eq(schema.prescriptions.patientId, patient.id)).orderBy(desc(schema.prescriptions.createdAt))
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <section>
        {list.length === 0 ? (
          <Empty>Nenhuma prescrição registrada.</Empty>
        ) : (
          <ul className="card list">
            {list.map((p) => (
              <li key={p.id} className="row row--between" style={{ alignItems: 'flex-start', opacity: p.active ? 1 : 0.55 }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{p.name}</strong> <span className="badge badge--plain">{PRESCRIPTION_TYPES[p.type] ?? p.type}</span>
                  {!p.active && <span className="badge badge--warn">Encerrada</span>}
                  <div className="small">{[p.dose, p.schedule, p.duration].filter(Boolean).join(' · ')}</div>
                  {p.notes && <div className="small muted">{p.notes}</div>}
                  <div className="small muted">{fmtDateTime(p.createdAt, s.timezone)}</div>
                </div>
                <form action={setPrescriptionActive.bind(null, patient.id, p.id, !p.active)}>
                  <button type="submit" className="btn btn--sm">
                    {p.active ? 'Encerrar' : 'Reativar'}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Nova prescrição</h2>
        <ActionForm action={addPrescription.bind(null, patient.id)} className="stack" resetOnSuccess>
          <Field label="Tipo" name="type">
            <select name="type" defaultValue="suplemento">
              {Object.entries(PRESCRIPTION_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nome" name="name" required>
            <input name="name" maxLength={160} placeholder="Ex.: Vitamina D3, Hemograma completo" />
          </Field>
          <div className="form-grid form-grid--3">
            <Field label="Dose" name="dose">
              <input name="dose" maxLength={160} placeholder="Ex.: 2.000 UI" />
            </Field>
            <Field label="Horário" name="schedule">
              <input name="schedule" maxLength={160} placeholder="Ex.: no almoço" />
            </Field>
            <Field label="Duração" name="duration">
              <input name="duration" maxLength={120} placeholder="Ex.: 90 dias" />
            </Field>
          </div>
          <Field label="Observações" name="notes">
            <textarea name="notes" rows={2} maxLength={1000} />
          </Field>
          <p className="small muted" style={{ margin: 0 }}>
            Prescreva apenas o que está dentro das atribuições do nutricionista (Resolução CFN). A prescrição aparece no app e no PDF do plano.
          </p>
          <div>
            <SubmitButton>Registrar</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  )
}
