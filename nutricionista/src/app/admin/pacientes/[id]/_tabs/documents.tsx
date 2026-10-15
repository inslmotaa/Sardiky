import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { deleteDocument, toggleDocumentShare, uploadDocument } from '@/actions/admin/patients'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Empty } from '@/components/ui'

export async function DocumentsTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const s = await getSettings()
  const docs = await db
    .select()
    .from(schema.files)
    .where(and(eq(schema.files.patientId, patient.id), eq(schema.files.kind, 'documento')))
    .orderBy(desc(schema.files.createdAt))
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Anexar documento</h2>
        <ActionForm action={uploadDocument.bind(null, patient.id)} className="stack" resetOnSuccess encType="multipart/form-data">
          <div className="form-grid">
            <Field label="Nome do documento" name="title" required>
              <input name="title" maxLength={160} placeholder="Ex.: Exames laboratoriais (mar/2026)" />
            </Field>
            <Field label="Arquivo" name="file" required hint="PDF, JPG, PNG ou WebP, até 5 MB.">
              <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
            </Field>
          </div>
          <label className="check">
            <input type="checkbox" name="share" /> Disponibilizar para o paciente em “Meus dados”
          </label>
          <div>
            <SubmitButton pendingText="Enviando…">Anexar</SubmitButton>
          </div>
        </ActionForm>
      </section>
      {docs.length === 0 ? (
        <Empty>Nenhum documento anexado.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Enviado em</th>
                <th>Paciente vê?</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a href={`/arquivos/${d.id}`} target="_blank" rel="noopener noreferrer">
                      {d.title}
                    </a>
                    <div className="small muted">{Math.round(d.size / 1024)} KB</div>
                  </td>
                  <td className="nowrap">{fmtDateTime(d.createdAt, s.timezone)}</td>
                  <td>
                    <form action={toggleDocumentShare.bind(null, patient.id, d.id)}>
                      <button className="link-btn" type="submit">
                        {d.visibleToPatient ? 'Sim (ocultar)' : 'Não (compartilhar)'}
                      </button>
                    </form>
                  </td>
                  <td>
                    <form action={deleteDocument.bind(null, patient.id, d.id)}>
                      <button className="btn btn--danger btn--sm" type="submit">
                        Excluir
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
