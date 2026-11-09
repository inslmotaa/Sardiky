import Link from 'next/link'
import { IconChat, IconWhatsApp } from './icons'

/**
 * "Falar com o coach": as duas formas lado a lado, conforme o modo escolhido pelo coach.
 * O WhatsApp passa por /paciente/whatsapp, que registra só a data e a hora do toque.
 */
export function ContactOptions({
  app,
  whatsapp,
  offHoursText,
  appHref = '/paciente/mensagens#conversa',
  compact = false,
}: {
  app: boolean
  whatsapp: boolean
  offHoursText: string | null
  appHref?: string
  compact?: boolean
}) {
  if (!app && !whatsapp) return null
  return (
    <div className={`contact-options${compact ? ' contact-options--compact' : ''}`} role="group" aria-label="Falar com o coach">
      {app && (
        <Link href={appHref} className="contact-option">
          <IconChat width={22} height={22} aria-hidden />
          <span>
            <strong>Conversar pelo app</strong>
            {!compact && <small>Mensagens, fotos e áudio, tudo junto do seu plano.</small>}
          </span>
        </Link>
      )}
      {whatsapp && (
        <div className="contact-option-wrap">
          <a href="/paciente/whatsapp" target="_blank" rel="noopener noreferrer" className="contact-option contact-option--wa">
            <IconWhatsApp width={22} height={22} aria-hidden />
            <span>
              <strong>Chamar no WhatsApp</strong>
              {!compact && <small>Abre a conversa com o coach, com a mensagem pronta.</small>}
            </span>
          </a>
          {offHoursText && <p className="contact-option__note small muted">{offHoursText}</p>}
        </div>
      )}
    </div>
  )
}
