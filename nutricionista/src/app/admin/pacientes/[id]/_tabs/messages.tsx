import { asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { sendTeamMessage } from '@/actions/admin/patients'
import { ActionForm, Field, SubmitButton } from '@/components/form'

export async function MessagesTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const s = await getSettings()
  const msgs = await db
    .select({ m: schema.messages, sender: schema.users.name })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.users.id, schema.messages.senderId))
    .where(eq(schema.messages.patientId, patient.id))
    .orderBy(asc(schema.messages.createdAt))
  return (
    <section className="card">
      {!patient.userId && <p className="alert alert--warn small">O paciente ainda não tem acesso à área exclusiva; ele verá as mensagens quando o acesso for liberado.</p>}
      <div className="thread">
        {msgs.length === 0 && <p className="muted">Nenhuma mensagem.</p>}
        {msgs.map(({ m, sender }) => (
          <div key={m.id} className={`bubble ${m.fromPatient ? '' : 'bubble--mine'} ${m.isGuidance ? 'bubble--guidance' : ''}`}>
            {m.isGuidance && <strong className="small">Orientação · </strong>}
            {m.body}
            <span className="bubble__meta">
              {m.fromPatient ? patient.fullName : sender ?? 'Equipe'} · {fmtDateTime(m.createdAt, s.timezone)}
              {m.fromPatient && !m.readAt && ' · não lida'}
            </span>
          </div>
        ))}
      </div>
      <ActionForm action={sendTeamMessage.bind(null, patient.id)} className="stack" resetOnSuccess>
        <Field label="Responder" name="body">
          <textarea name="body" rows={3} maxLength={5000} />
        </Field>
        <label className="check">
          <input type="checkbox" name="guidance" /> Destacar como orientação no painel do paciente
        </label>
        <div>
          <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
        </div>
      </ActionForm>
    </section>
  )
}
