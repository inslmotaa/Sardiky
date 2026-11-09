import 'server-only'
import { getSettings } from './settings'
import { getPatient } from './patient-context'
import { chatChannels } from './chat-mode'
import { withinChatHours } from './chat'
import { zonedParts } from './time'

const AUTO_PADRAO = 'Respondo assim que possível, no próximo horário de atendimento.'

/** Canais de conversa do cliente logado e, fora do horário de atendimento, a frase da resposta automática. */
export async function contactOptionsFor(patientId: string) {
  const [s, p] = await Promise.all([getSettings(), getPatient(patientId)])
  const ch = chatChannels({ globalMode: s.chatMode, patientMode: p.chatMode, chatFeature: p.features.chat, whatsapp: s.whatsapp })
  const now = zonedParts(new Date(), s.timezone)
  const outside = s.chatHours ? !withinChatHours(s.chatHours, now.weekday, now.time) : false
  return { ...ch, offHoursText: outside ? s.chatAutoReply?.trim() || AUTO_PADRAO : null }
}
