import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { threadView } from '@/lib/chat'
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
  return (
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
  )
}
