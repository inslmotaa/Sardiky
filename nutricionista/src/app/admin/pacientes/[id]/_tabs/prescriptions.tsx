import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { savePrescription, setPrescriptionActive } from '@/actions/admin/content'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Empty } from '@/components/ui'
import { PRESCRIPTION_TYPES } from '@/lib/constants'

type Prescription = typeof schema.prescriptions.$inferSelect

/** Formulário completo de prescrição: título, tipo, dose/horário/duração (opcionais) e o texto escrito. */
function PrescriptionForm({ patientId, p }: { patientId: string; p?: Prescription }) {
  return (
    <ActionForm action={savePrescription.bind(null, patientId)} className="stack" resetOnSuccess={!p}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="form-grid">
        <Field label="Título" name="name" required>
          <input name="name" maxLength={160} defaultValue={p?.name} placeholder="Ex.: Suplementação, Pré-treino, Orientações" />
        </Field>
        <Field label="Tipo" name="type">
          <select name="type" defaultValue={p?.type ?? 'livre'}>
            {Object.entries(PRESCRIPTION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Prescrição" name="notes" hint="Escreva livremente: suplementos, manipulados, ergogênicos, alimentos, quantidades, horários e orientações. As quebras de linha são mantidas no app e no PDF.">
        <textarea name="notes" rows={p ? 6 : 9} maxLength={8000} defaultValue={p?.notes ?? ''} />
      </Field>
      <details className="disclosure">
        <summary>Dose, horário e duração (opcional)</summary>
        <div className="form-grid form-grid--3">
          <Field label="Dose" name="dose">
            <input name="dose" maxLength={160} defaultValue={p?.dose ?? ''} placeholder="Ex.: 2.000 UI" />
          </Field>
          <Field label="Horário" name="schedule">
            <input name="schedule" maxLength={160} defaultValue={p?.schedule ?? ''} placeholder="Ex.: no almoço" />
          </Field>
          <Field label="Duração" name="duration">
            <input name="duration" maxLength={120} defaultValue={p?.duration ?? ''} placeholder="Ex.: 90 dias" />
          </Field>
        </div>
      </details>
      <div>
        <SubmitButton>{p ? 'Salvar alterações' : 'Registrar prescrição'}</SubmitButton>
      </div>
    </ActionForm>
  )
}

export async function PrescriptionsTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const s = await getSettings()
  const list = await db.select().from(schema.prescriptions).where(eq(schema.prescriptions.patientId, patient.id)).orderBy(desc(schema.prescriptions.createdAt))
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Escrever prescrição</h2>
        <PrescriptionForm patientId={patient.id} />
        <p className="small muted" style={{ margin: '12px 0 0' }}>
          Prescreva apenas o que está dentro das atribuições do nutricionista (Resolução CFN). A prescrição aparece no app e no PDF do plano.
        </p>
      </section>
      <section>
        {list.length === 0 ? (
          <Empty>Nenhuma prescrição registrada.</Empty>
        ) : (
          <ul className="card list">
            {list.map((p) => (
              <li key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{p.name}</strong> <span className="badge badge--plain">{PRESCRIPTION_TYPES[p.type] ?? p.type}</span>
                    {!p.active && <span className="badge badge--warn">Encerrada</span>}
                    <div className="small">{[p.dose, p.schedule, p.duration].filter(Boolean).join(' · ')}</div>
                    {p.notes && <div className="small prescription-text">{p.notes}</div>}
                    <div className="small muted">{fmtDateTime(p.createdAt, s.timezone)}</div>
                  </div>
                  <form action={setPrescriptionActive.bind(null, patient.id, p.id, !p.active)}>
                    <button type="submit" className="btn btn--sm">
                      {p.active ? 'Encerrar' : 'Reativar'}
                    </button>
                  </form>
                </div>
                <details className="disclosure" style={{ marginTop: 6 }}>
                  <summary>Editar</summary>
                  <div>
                    <PrescriptionForm patientId={patient.id} p={p} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
