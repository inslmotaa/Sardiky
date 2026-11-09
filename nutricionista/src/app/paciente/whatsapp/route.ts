import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { getPatient } from '@/lib/patient-context'
import { chatChannels, waClienteText } from '@/lib/chat-mode'
import { waHref } from '@/lib/whatsapp'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * "Chamar no WhatsApp": registra só a data e a hora do toque (aparece na ficha como "Cliente abriu
 * conversa pelo WhatsApp") e leva ao wa.me do coach com o texto pronto. O conteúdo fica no WhatsApp.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'patient' || !user.patientId) return Response.redirect(new URL('/login?next=/paciente/mensagens', req.url), 303)
  const [s, p] = await Promise.all([getSettings(), getPatient(user.patientId)])
  const ch = chatChannels({ globalMode: s.chatMode, patientMode: p.chatMode, chatFeature: p.features.chat, whatsapp: s.whatsapp })
  const href = ch.whatsapp ? waHref(s.whatsapp, waClienteText(s.templates.waClienteCoach, { nome: user.name.split(' ')[0], coach: s.professionalName.split(' ')[0] })) : null
  if (!href) return Response.redirect(new URL('/paciente/mensagens', req.url), 303)
  // Um registro por minuto no máximo (toques repetidos não enchem a ficha).
  if (rateLimit(`wa-toque:${user.patientId}`, 1, 60_000)) await db.insert(schema.contactEvents).values({ patientId: user.patientId, kind: 'whatsapp' })
  return new Response(null, { status: 303, headers: { Location: href, 'Cache-Control': 'no-store' } })
}
