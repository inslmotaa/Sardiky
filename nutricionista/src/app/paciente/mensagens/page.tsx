import { and, eq, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { featuresOf } from '@/lib/patient-context'
import { getSettings } from '@/lib/settings'
import { threadView, withinChatHours } from '@/lib/chat'
import { whatsappLink } from '@/lib/format'
import { integrationStatus } from '@/lib/integrations'
import { weekdayShort, zonedParts } from '@/lib/time'
import { sendPatientMessage } from '@/actions/patient'
import { ChatThread } from '@/components/nutri/ChatThread'
import { PageHead } from '@/components/ui'

export default async function PatientMessages() {
  const user = await requirePatient()
  if (!(await featuresOf(user.patientId)).chat) redirect('/paciente')
  const s = await getSettings()
  // Abrir a conversa marca como lidas as mensagens do nutricionista.
  await db
    .update(schema.messages)
    .set({ readAt: new Date() })
    .where(and(eq(schema.messages.patientId, user.patientId), eq(schema.messages.fromPatient, false), isNull(schema.messages.readAt)))
  const msgs = await threadView(user.patientId, 'patient', { professional: s.professionalName, patient: user.name })
  const wa = whatsappLink(s.whatsapp)
  const now = zonedParts(new Date(), s.timezone)
  const h = s.chatHours
  const hoursText = h ? `Atendimento pelo chat: ${h.weekdays.map(weekdayShort).join(', ')}, das ${h.start} às ${h.end}.` : 'As respostas acontecem em horário de atendimento.'

  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
      <PageHead title="Mensagens" subtitle={`Tire dúvidas sobre o seu plano. ${hoursText}`} />
      {h && !withinChatHours(h, now.weekday, now.time) && <p className="alert alert--info small">Fora do horário de atendimento agora. Sua mensagem fica registrada e é respondida no próximo horário.</p>}
      <section className="card">
        <ChatThread messages={msgs} action={sendPatientMessage} emptyText="Nenhuma mensagem ainda. Envie sua primeira dúvida abaixo." />
      </section>
      <p className="muted small">
        Em caso de urgência ou mal-estar, procure atendimento médico.{' '}
        {wa && (
          <>
            Para assuntos de agenda, você também pode usar o{' '}
            <a href={wa} target="_blank" rel="noopener noreferrer">
              WhatsApp do consultório
            </a>
            .
          </>
        )}{' '}
        {!integrationStatus().whatsappApi && 'As mensagens deste canal não são enviadas automaticamente para o WhatsApp.'}
      </p>
    </div>
  )
}
