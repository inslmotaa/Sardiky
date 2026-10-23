import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { bookingLink, whatsappLink } from '@/lib/format'
import { logout } from '@/actions/auth'
import { BookingLink } from '@/components/BookingLink'
import { Brand } from '@/components/Brand'
import { HeaderScrollWatcher, UserMenu } from '@/components/SiteChrome'
import { MotionRoot } from '@/components/motion'
import { IconWhatsApp } from '@/components/icons'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()])
  const booking = bookingLink(s, undefined, { loggedIn: Boolean(user) })
  const wa = whatsappLink(s.whatsapp, 'Olá! Vim pelo site e gostaria de mais informações sobre as consultas.')
  const area = user ? (user.role === 'patient' ? '/paciente' : '/admin') : '/entrar'
  return (
    <MotionRoot>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      {s.demoBanner && (
        <div className="demo-banner" role="note">
          Versão de demonstração: registro, endereço, e-mail, depoimentos e pacientes são fictícios.
        </div>
      )}
      <header className="site-header" id="site-header">
        <HeaderScrollWatcher target="site-header" />
        <div className="container site-header__inner">
          <Brand name={s.professionalName} sub={s.professionalTitle} logoFileId={s.logoFileId} />
          <nav className="site-nav" aria-label="Principal">
            <Link href="/planos" className="site-nav__link">
              Planos
            </Link>
            <BookingLink to={booking} className="btn btn--primary btn--sm btn--fx">
              Agendar consulta
            </BookingLink>
            {user ? (
              <UserMenu name={user.name} area={area} logout={logout} />
            ) : (
              <Link href="/entrar" className="btn btn--ghost btn--sm">
                Entrar
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main id="conteudo">{children}</main>

      <footer className="site-footer">
        <div className="container site-footer__simple">
          <div>
            <strong>
              {s.professionalName} · {s.professionalTitle}
            </strong>
            {s.registry && <span className="site-footer__crn">{s.registry}</span>}
          </div>
          <nav className="site-footer__links" aria-label="Rodapé">
            <Link href="/planos">Planos</Link>
            <Link href="/entrar">Área do cliente</Link>
            <Link href="/privacidade">Política de privacidade</Link>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="row" style={{ gap: 6 }}>
                <IconWhatsApp width={18} height={18} /> WhatsApp
              </a>
            )}
          </nav>
          <p className="site-footer__note">
            © {new Date().getFullYear()} {s.professionalName}. As informações deste site são educativas e não substituem a consulta com um profissional.
          </p>
        </div>
      </footer>

      {wa && (
        <a className="whatsapp-float" href={wa} target="_blank" rel="noopener noreferrer" aria-label="Conversar pelo WhatsApp">
          <IconWhatsApp />
        </a>
      )}
    </MotionRoot>
  )
}
