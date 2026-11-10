/**
 * WhatsApp sem custo: só links wa.me com o texto pronto (nada de API paga). Um único lugar para os
 * textos dos botões do painel, editáveis em Configurações → Mensagens. Regras puras (testadas).
 */
import { onlyDigits } from './format'

export const WA_TEMPLATES = {
  waPlanoNovo: {
    label: 'Plano novo publicado',
    vars: '{nome} {link}',
    text: 'Olá, {nome}! Seu plano alimentar novo já está no app: {link}. Qualquer dúvida, me chama por aqui.',
  },
  waCheckin: {
    label: 'Check-in pendente',
    vars: '{nome} {data} {link}',
    text: 'Olá, {nome}! Seu check-in de {data} ainda está pendente. Leva poucos minutos e me ajuda a ajustar o seu plano: {link}',
  },
  waVencimento: {
    label: 'Plano vencendo',
    vars: '{nome} {plano} {data} {link}',
    text: 'Olá, {nome}! Seu Plano {plano} termina em {data}. Para renovar e seguir com o acompanhamento, é só acessar: {link}',
  },
  waCobranca: {
    label: 'Cobrança em aberto',
    vars: '{nome} {descricao} {valor} {data}',
    text: 'Olá, {nome}! Passando para lembrar do pagamento de “{descricao}” ({valor}), com vencimento em {data}. Qualquer dúvida, estou à disposição.',
  },
  waLinkPagamento: {
    label: 'Link de pagamento do plano',
    vars: '{nome} {link}',
    text: 'Olá, {nome}! Segue o link para o pagamento do seu plano (Pix, cartão ou boleto): {link}',
  },
  waContato: {
    label: 'Contato com o cliente',
    vars: '{nome}',
    text: 'Olá, {nome}! Tudo bem? Passando para saber como está indo com o plano.',
  },
  waInteressado: {
    label: 'Resposta a interessado do site',
    vars: '{nome} {coach}',
    text: 'Olá, {nome}! Recebemos seu contato pelo site de {coach}. Posso te explicar como funciona o acompanhamento?',
  },
} as const
export type WaTemplateKey = keyof typeof WA_TEMPLATES

/** Telefone para o wa.me: só dígitos; número nacional (até 11 dígitos) ganha o 55 do Brasil. */
export function waPhone(raw: string | null | undefined): string | null {
  const d = onlyDigits(raw ?? '')
  if (d.length < 10) return null
  return d.length <= 11 ? `55${d}` : d
}

/** Texto do modelo (o salvo em Configurações ou o padrão) com as variáveis preenchidas; sem valor, a variável some. */
export function waText(templates: Partial<Record<string, string>> | null | undefined, key: WaTemplateKey, vars: Record<string, string | null | undefined>): string {
  const tpl = templates?.[key]?.trim() || WA_TEMPLATES[key].text
  return tpl
    .replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
    .replace(/:\s*([.,]|$)/g, '$1')
    .replace(/ {2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim()
}

/** Link wa.me com o texto; null sem telefone válido. */
export function waHref(phone: string | null | undefined, text: string): string | null {
  const p = waPhone(phone)
  return p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : null
}
