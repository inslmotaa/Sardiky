import { and, asc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { whatsappLink } from '@/lib/format'
import { integrationStatus } from '@/lib/integrations'
import { sendPatientMessage } from '@/actions/patient'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { PageHead } from '@/components/ui'

export default async function PatientMessages() {
  const user = await requirePatient()
  const s = await getSettings()
  const msgs = await db.select().from(schema.messages).where(eq(schema.messages.patientId, user.patientId)).orderBy(asc(schema.messages.createdAt))
  // Abrir a conversa marca como lidas as mensagens do nutricionista.
  await db
    .update(schema.messages)
    .set({ readAt: new Date() })
    .where(and(eq(schema.messages.patientId, user.patientId), eq(schema.messages.fromPatient, false), isNull(schema.messages.readAt)))
  const wa = whatsappLink(s.whatsapp)
  const guidance = msgs.filter((m) => m.isGuidance)

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead title="Mensagens" subtitle="Tire dúvidas sobre o seu plano. As respostas acontecem em horário de atendimento." />
      {guidance.length > 0 && (
        <section className="card card--soft">
          <h2 style={{ fontSize: '1.05rem' }}>Orientações do nutricionista</h2>
          <ul className="list">
            {guidance.map((g) => (
              <li key={g.id}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{g.body}</span>
                <div className="muted small">{fmtDateTime(g.createdAt, s.timezone)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card">
        <div className="thread" aria-live="polite">
          {msgs.length === 0 && <p className="muted">Nenhuma mensagem ainda. Envie sua primeira dúvida abaixo.</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`bubble ${m.fromPatient ? 'bubble--mine' : ''} ${m.isGuidance ? 'bubble--guidance' : ''}`}>
              {m.body}
              <span className="bubble__meta">
                {m.fromPatient ? 'Você' : s.professionalName} · {fmtDateTime(m.createdAt, s.timezone)}
              </span>
            </div>
          ))}
        </div>
        <ActionForm action={sendPatientMessage} className="stack" resetOnSuccess>
          <Field label="Sua mensagem" name="body">
            <textarea name="body" rows={3} maxLength={3000} />
          </Field>
          <div className="row">
            <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
          </div>
        </ActionForm>
      </section>
      <p className="muted small">
        Em caso de urgência ou mal-estar, procure atendimento médico. {wa && <>Para assuntos de agenda, você também pode usar o <a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp do consultório</a>.</>}{' '}
        {!integrationStatus().whatsappApi && 'As mensagens deste canal não são enviadas automaticamente para o WhatsApp.'}
      </p>
    </div>
  )
}
