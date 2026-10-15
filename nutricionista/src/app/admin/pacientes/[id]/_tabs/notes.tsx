import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { addClinicalNote } from '@/actions/admin/patients'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Empty } from '@/components/ui'

export async function NotesTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const s = await getSettings()
  const notes = await db
    .select({ n: schema.clinicalNotes, author: schema.users.name })
    .from(schema.clinicalNotes)
    .leftJoin(schema.users, eq(schema.users.id, schema.clinicalNotes.authorId))
    .where(eq(schema.clinicalNotes.patientId, patient.id))
    .orderBy(desc(schema.clinicalNotes.createdAt))
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <p className="alert alert--info small">Notas clínicas são privadas: nunca aparecem na área do paciente nem na exportação automática de dados.</p>
      <section className="card">
        <ActionForm action={addClinicalNote.bind(null, patient.id)} className="stack" resetOnSuccess>
          <Field label="Nova anotação" name="body">
            <textarea name="body" rows={4} maxLength={10000} />
          </Field>
          <div>
            <SubmitButton>Salvar anotação</SubmitButton>
          </div>
        </ActionForm>
      </section>
      {notes.length === 0 ? (
        <Empty>Nenhuma anotação.</Empty>
      ) : (
        <ul className="card list">
          {notes.map(({ n, author }) => (
            <li key={n.id}>
              <div className="muted small">
                {fmtDateTime(n.createdAt, s.timezone)} · {author ?? 'usuário removido'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
