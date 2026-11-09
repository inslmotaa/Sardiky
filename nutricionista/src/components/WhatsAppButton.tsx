import { getSettings } from '@/lib/settings'
import { waHref, waText, type WaTemplateKey } from '@/lib/whatsapp'
import { IconWhatsApp } from './icons'

/**
 * Botão único de WhatsApp do painel: abre o wa.me com o texto do modelo escolhido (editável em
 * Configurações → Mensagens). Sem telefone válido, não aparece.
 */
export async function WhatsAppButton({
  phone,
  template,
  vars,
  label = 'WhatsApp',
  className = 'btn btn--whatsapp btn--sm',
}: {
  phone: string | null | undefined
  template: WaTemplateKey
  vars: Record<string, string | null | undefined>
  label?: string
  className?: string
}) {
  const s = await getSettings()
  const href = waHref(phone, waText(s.templates, template, { coach: s.professionalName, ...vars }))
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} data-wa={template}>
      <IconWhatsApp width={14} height={14} aria-hidden /> {label}
    </a>
  )
}
