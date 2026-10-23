import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { bookingLink, whatsappLink } from '@/lib/format'
import { logout } from '@/actions/auth'
import { BookingLink } from '@/components/BookingLink'
import { Brand } from '@/components/Brand'
import { HeaderScrollWatcher, MobileMenu, SiteNavLinks, UserMenu } from '@/components/SiteChrome'
import { SITE_NAV } from '@/lib/constants'
import { MotionRoot } from '@/components/motion'
import { IconInstagram, IconWhatsApp } from '@/components/icons'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()])
  const booking = bookingLink(s, undefined, { loggedIn: Boolean(user) })
  const wa = whatsappLink(s.whatsapp, 'Olá! Vim pelo site e gostaria de mais informações sobre o acompanhamento.')
  const area = user ? (user.role === 'patient' ? '/paciente' : '/admin') : '/entrar'
  return (
    <MotionRoot>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      {s.demoBanner && (
        <div className="demo-banner" role="note">
          Versão de demonstração: endereço, e-mail e pacientes são fictícios.
        </div>
      )}
      <header className="site-header" id="site-header">
        <HeaderScrollWatcher target="site-header" />
        <div className="container site-header__inner">
          <Brand name={s.professionalName} sub={s.professionalTitle} logoFileId={s.logoFileId} />
          <nav className="site-nav" aria-label="Principal">
            <SiteNavLinks className="site-nav__link" />
            {user ? (
              <UserMenu name={user.name} area={area} logout={logout} />
            ) : (
              <Link href="/entrar" className="site-nav__link">
                Entrar
              </Link>
            )}
            <BookingLink to={booking} className="btn btn--primary btn--sm btn--fx">
              Agendar consulta
            </BookingLink>
          </nav>
          <div className="site-header__mobile">
            {user && <UserMenu name={user.name} area={area} logout={logout} />}
            <MobileMenu>
              <SiteNavLinks className="site-menu__link" />
              {!user && (
                <Link href="/entrar" className="site-menu__link">
                  Entrar na área do cliente
                </Link>
              )}
              <BookingLink to={booking} className="btn btn--primary btn--block">
                Agendar consulta
              </BookingLink>
            </MobileMenu>
          </div>
        </div>
      </header>

      <main id="conteudo">{children}</main>

      <footer className="site-footer">
        <div className="container">
          <div className="site-footer__cols">
            <div className="site-footer__brand">
              <strong>
                {s.professionalName} · {s.professionalTitle}
              </strong>
              {s.registry && <span className="site-footer__crn">{s.registry}</span>}
              <p>Acompanhamento individual, com estratégia, constância e ajustes de perto. Mais que dieta, um estilo de vida.</p>
              <div className="row" style={{ gap: 10 }}>
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="site-footer__social" aria-label="WhatsApp">
                    <IconWhatsApp width={18} height={18} />
                  </a>
                )}
                {s.instagram && (
                  <a href={s.instagram} target="_blank" rel="noopener noreferrer" className="site-footer__social" aria-label="Instagram">
                    <IconInstagram width={18} height={18} />
                  </a>
                )}
              </div>
            </div>
            <nav aria-label="Páginas">
              <h3>Páginas</h3>
              <Link href="/">Início</Link>
              {SITE_NAV.map((n) => (
                <Link key={n.href} href={n.href}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <nav aria-label="Área do cliente">
              <h3>Área do cliente</h3>
              <Link href="/entrar">Área do cliente</Link>
              <Link href="/criar-conta">Criar conta</Link>
              <Link href="/privacidade">Política de privacidade</Link>
            </nav>
            <div>
              <h3>Contato</h3>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="row" style={{ gap: 6 }}>
                  <IconWhatsApp width={18} height={18} /> WhatsApp
                </a>
              )}
              {s.hoursText && <p>{s.hoursText}</p>}
              {s.modalityText && <p>{s.modalityText}</p>}
            </div>
          </div>
          <p className="site-footer__note">
            © {new Date().getFullYear()} {s.professionalName}. As informações deste site são educativas e não substituem o acompanhamento individual.
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
