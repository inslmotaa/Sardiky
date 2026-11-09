import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { threadView } from '@/lib/chat'
import { fmtDateTime } from '@/lib/time'
import { sendTeamMessage } from '@/actions/admin/patients'
import { ChatThread } from '@/components/nutri/ChatThread'
import { LiveUpdates } from '@/components/pwa'

export async function MessagesTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const s = await getSettings()
  // Abrir a conversa marca como lidas as mensagens do paciente.
  await db
    .update(schema.messages)
    .set({ readAt: new Date() })
    .where(and(eq(schema.messages.patientId, patient.id), eq(schema.messages.fromPatient, true), isNull(schema.messages.readAt)))
  const msgs = await threadView(patient.id, 'team', { professional: s.professionalName, patient: patient.fullName })
  // Toques em "Chamar no WhatsApp" (só data e hora; o conteúdo fica no WhatsApp).
  const waOpens = await db
    .select({ at: schema.contactEvents.createdAt })
    .from(schema.contactEvents)
    .where(and(eq(schema.contactEvents.patientId, patient.id), eq(schema.contactEvents.kind, 'whatsapp')))
    .orderBy(desc(schema.contactEvents.createdAt))
    .limit(20)
  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
    {waOpens.length > 0 && (
      <section className="card" aria-labelledby="wa-aberturas">
        <h2 id="wa-aberturas" style={{ fontSize: '1rem', margin: '0 0 8px' }}>
          Conversas pelo WhatsApp
        </h2>
        <ul className="list small" aria-label="Aberturas de conversa pelo WhatsApp">
          {waOpens.map((e, i) => (
            <li key={i}>
              Cliente abriu conversa pelo WhatsApp · <span className="muted">{fmtDateTime(e.at, s.timezone)}</span>
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          O app registra só quando o cliente toca em “Chamar no WhatsApp”. As mensagens ficam no seu WhatsApp.
        </p>
      </section>
    )}
    <section className="card">
      <LiveUpdates scope={`p=${patient.id}`} />
      {!patient.userId && <p className="alert alert--warn small">O cliente ainda não tem acesso à área exclusiva; ele verá as mensagens quando o acesso for liberado.</p>}
      <ChatThread
        messages={msgs}
        action={sendTeamMessage.bind(null, patient.id)}
        quickReplies={s.quickReplies}
        allowGuidance
        placeholder="Responder"
        emptyText="Nenhuma mensagem."
      />
    </section>
    </div>
  )
}
