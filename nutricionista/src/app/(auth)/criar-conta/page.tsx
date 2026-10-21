import Link from 'next/link'
import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'
import { bookingLink, whatsappLink } from '@/lib/format'
import { BookingLink } from '@/components/BookingLink'

export const metadata: Metadata = { title: 'Criar conta', robots: { index: false } }

/** Contas de paciente são criadas por convite: o nutricionista cadastra e envia o link. */
export default async function CreateAccountPage() {
  const s = await getSettings()
  const wa = whatsappLink(s.whatsapp, 'Olá! Quero começar o acompanhamento e acessar o app.')
  return (
    <div className="card stack">
      <h1 style={{ fontSize: '1.6rem' }}>Criar conta</h1>
      <p className="muted" style={{ margin: 0 }}>
        O acesso ao app é liberado por convite. Depois do seu cadastro, {s.professionalName} envia um link por e-mail ou WhatsApp para você criar a sua senha.
      </p>
      <div className="stack" style={{ ['--gap' as string]: '10px' }}>
        <BookingLink to={bookingLink(s, 'Olá! Gostaria de agendar minha primeira consulta.')} className="btn btn--primary btn--block">
          Agendar primeira consulta
        </BookingLink>
        {s.anamneseUrl && (
          <a href={s.anamneseUrl} target="_blank" rel="noopener noreferrer" className="btn btn--block">
            Preencher anamnese
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn--whatsapp btn--block">
            Falar pelo WhatsApp
          </a>
        )}
      </div>
      <p className="small" style={{ margin: 0 }}>
        Já recebeu o convite? <Link href="/login">Entrar</Link>
      </p>
    </div>
  )
}
