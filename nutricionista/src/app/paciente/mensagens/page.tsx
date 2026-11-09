import { and, eq, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { threadView } from '@/lib/chat'
import { contactOptionsFor } from '@/lib/contact-options'
import { sendPatientMessage } from '@/actions/patient'
import { ChatThread } from '@/components/nutri/ChatThread'
import { ContactOptions } from '@/components/ContactOptions'
import { PageHead } from '@/components/ui'

/** Falar com o coach: chat do app e/ou WhatsApp, conforme o modo escolhido nas Configurações (ou na ficha). */
export default async function PatientMessages() {
  const user = await requirePatient()
  const [s, opts] = await Promise.all([getSettings(), contactOptionsFor(user.patientId)])
  if (!opts.any) redirect('/paciente')
  const msgs = opts.app ? await threadView(user.patientId, 'patient', { professional: s.professionalName, patient: user.name }) : []
  // Abrir a conversa marca como lidas as mensagens do coach.
  if (opts.app)
    await db
      .update(schema.messages)
      .set({ readAt: new Date() })
      .where(and(eq(schema.messages.patientId, user.patientId), eq(schema.messages.fromPatient, false), isNull(schema.messages.readAt)))

  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
      <PageHead title="Mensagens" subtitle="Tire dúvidas sobre o seu plano. A resposta vem direto do seu coach." />
      <ContactOptions app={opts.app} whatsapp={opts.whatsapp} offHoursText={opts.offHoursText} />
      {opts.app && opts.offHoursText && (
        <p className="alert alert--info small" style={{ margin: 0 }}>
          Fora do horário de atendimento: sua mensagem fica registrada e é respondida assim que possível.
        </p>
      )}
      {opts.app && (
        <section className="card" id="conversa" aria-label="Conversa pelo app">
          <ChatThread messages={msgs} action={sendPatientMessage} emptyText="Nenhuma mensagem ainda. Envie sua primeira dúvida abaixo." />
        </section>
      )}
      <p className="muted small">
        Em caso de urgência ou mal-estar, procure atendimento médico.
        {opts.whatsapp && ' A conversa pelo WhatsApp acontece no seu WhatsApp: o app registra só que você abriu a conversa, não o conteúdo.'}
      </p>
    </div>
  )
}
