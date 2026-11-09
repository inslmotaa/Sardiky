/**
 * Como o cliente conversa com o coach (regras puras, testadas em tests/unit/parte5.test.ts):
 * pelo chat do app, pelo WhatsApp (wa.me, sem API paga) ou pelos dois.
 */
import { waPhone } from './whatsapp'

export type ChatMode = 'app' | 'whatsapp' | 'ambos'
export const CHAT_MODES: Record<ChatMode, string> = {
  ambos: 'Os dois: chat do app e WhatsApp',
  app: 'Só pelo chat do app',
  whatsapp: 'Só pelo WhatsApp',
}
export const isChatMode = (v: unknown): v is ChatMode => v === 'app' || v === 'whatsapp' || v === 'ambos'

/** Texto padrão do botão "Chamar no WhatsApp" (editável em Configurações → Chat). */
export const WA_CLIENTE_PADRAO = 'Oi, {coach}! Aqui é {nome}, cliente da consultoria. '

/**
 * Canais disponíveis para um cliente: o modo da ficha (se houver) vale sobre o padrão das
 * Configurações; o chat do app ainda depende do recurso "Mensagens" ligado; o WhatsApp depende
 * de um número válido cadastrado.
 */
export function chatChannels(o: { globalMode: string; patientMode: string | null | undefined; chatFeature: boolean; whatsapp: string | null | undefined }) {
  const mode: ChatMode = isChatMode(o.patientMode) ? o.patientMode : isChatMode(o.globalMode) ? o.globalMode : 'ambos'
  const app = o.chatFeature && mode !== 'whatsapp'
  const whatsapp = mode !== 'app' && waPhone(o.whatsapp) != null
  return { mode, app, whatsapp, any: app || whatsapp }
}

/** Mensagem pronta do cliente para o coach: {nome} (cliente) e {coach} (primeiro nome do coach). */
export function waClienteText(template: string | null | undefined, vars: { nome: string; coach: string }) {
  const tpl = template?.trim() ? template : WA_CLIENTE_PADRAO
  return tpl.replace(/\{nome\}/g, vars.nome).replace(/\{coach\}/g, vars.coach)
}
