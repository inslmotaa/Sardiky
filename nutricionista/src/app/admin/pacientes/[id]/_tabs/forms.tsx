import Link from 'next/link'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { fmtDateTime, fmtDay } from '@/lib/time'
import { assignForm } from '@/actions/admin/patients'
import { setAnamnesis } from '@/actions/admin/nutrition'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { FormAnswersView } from '@/components/FormAnswers'
import { Empty } from '@/components/ui'

export async function FormsTab({ patient, view }: { patient: typeof schema.patients.$inferSelect; view?: string }) {
  const s = await getSettings()
  const [list, templates] = await Promise.all([
    db.select().from(schema.formAssignments).where(eq(schema.formAssignments.patientId, patient.id)).orderBy(desc(schema.formAssignments.createdAt)),
    db.select().from(schema.formTemplates).where(and(eq(schema.formTemplates.active, true))).orderBy(asc(schema.formTemplates.title)),
  ])
  const open = list.find((a) => a.id === view)
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Anamnese recebida por outro meio</h2>
        <p className="small muted">
          A anamnese do site fica na aba Anamnese. Se receber respostas por outro meio (papel, mensagem), marque aqui e cole o conteúdo para ficar no
          prontuário.
        </p>
        <ActionForm action={setAnamnesis.bind(null, patient.id)} className="stack">
          <label className="check">
            <input type="checkbox" name="received" defaultChecked={Boolean(patient.anamnesisReceivedAt)} /> Anamnese recebida
            {patient.anamnesisReceivedAt && <span className="muted small"> em {fmtDateTime(patient.anamnesisReceivedAt, s.timezone)}</span>}
          </label>
          <Field label="Respostas (cole aqui)" name="notes">
            <textarea name="notes" rows={5} defaultValue={patient.anamnesisNotes ?? ''} />
          </Field>
          <div>
            <SubmitButton className="btn btn--sm btn--primary">Salvar anamnese</SubmitButton>
          </div>
        </ActionForm>
      </section>
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Enviar formulário</h2>
        <ActionForm action={assignForm.bind(null, patient.id)} className="row" resetOnSuccess>
          <Field label="Modelo" name="templateId" className="span-2">
            <select name="templateId">
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prazo (opcional)" name="dueDate">
            <input type="date" name="dueDate" />
          </Field>
          <div style={{ alignSelf: 'flex-end' }}>
            <SubmitButton>Enviar</SubmitButton>
          </div>
        </ActionForm>
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          Modelos são editados em <Link href="/admin/formularios">Formulários</Link>.
        </p>
      </section>
      {open && open.answeredAt && (
        <section className="card">
          <div className="card__head">
            <h2 style={{ fontSize: '1.1rem' }}>{open.title}</h2>
            <span className="muted small">respondido em {fmtDateTime(open.answeredAt, s.timezone)}</span>
          </div>
          <FormAnswersView assignment={open} />
        </section>
      )}
      {list.length === 0 ? (
        <Empty>Nenhum formulário enviado.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Formulário</th>
                <th>Enviado</th>
                <th>Prazo</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td className="nowrap">{fmtDateTime(a.createdAt, s.timezone)}</td>
                  <td>{fmtDay(a.dueDate)}</td>
                  <td>{a.answeredAt ? <span className="badge badge--ok">Respondido</span> : <span className="badge badge--warn">Pendente</span>}</td>
                  <td>{a.answeredAt && <Link href={`/admin/pacientes/${patient.id}?aba=formularios&ver=${a.id}`}>Ver respostas</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
