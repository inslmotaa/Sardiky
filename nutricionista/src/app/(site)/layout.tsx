import Link from 'next/link'
import './site.css'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { bookingLink, phoneLabel, whatsappLink } from '@/lib/format'
import { logout } from '@/actions/auth'
import { BookingLink } from '@/components/BookingLink'
import { BackToTop } from '@/components/BackToTop'
import { emailLink, instagramLink } from '@/lib/social'
import { LoginMenu, MobileMenu, SiteBrand, SiteFx, SiteNavLinks, UserMenu } from '@/components/SiteChrome'
import { SITE_NAV, SITE_PAGES, TIMELESS_URL } from '@/lib/constants'
import { MotionRoot } from '@/components/motion'
import { IconInstagram, IconMail, IconWhatsApp } from '@/components/icons'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()])
  // Redes e e-mail só aparecem com valores reais.
  const ig = instagramLink(s.instagram)
  const mail = emailLink(s.contactEmail)
  const booking = bookingLink(s, undefined, { loggedIn: Boolean(user) })
  const wa = whatsappLink(s.whatsapp, 'Olá! Vim pelo site e gostaria de mais informações sobre o acompanhamento.')
  const area = user ? (user.role === 'patient' ? '/paciente' : '/admin') : '/entrar'
  return (
    <MotionRoot>
      <div className="tl">
        <SiteFx />
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        {s.demoBanner && (
          <div className="demo-banner" role="note">
            Versão de demonstração: e-mail e clientes são fictícios.
          </div>
        )}
        <header className="tl-header" id="site-header">
          <div className="tl-container tl-header__inner">
            <SiteBrand name={s.siteName} logoFileId={s.logoFileId} />
            <nav className="tl-nav" aria-label="Principal">
              <SiteNavLinks className="tl-nav__link" />
              {user ? (
                <UserMenu name={user.name} area={area} logout={logout} />
              ) : (
                <LoginMenu />
              )}
            </nav>
            <div className="tl-header__mobile">
              {user ? <UserMenu name={user.name} area={area} logout={logout} /> : <LoginMenu compact />}
              <MobileMenu>
                <SiteNavLinks className="site-menu__link" />
                {!user && (
                  <div className="site-menu__auth">
                    <Link href="/entrar" className="pill pill--solid pill--block">
                      Entrar
                    </Link>
                    <Link href="/criar-conta" className="pill pill--block">
                      Criar conta
                    </Link>
                  </div>
                )}
                <BookingLink to={booking} className="pill pill--block">
                  Agendar consulta <span aria-hidden>→</span>
                </BookingLink>
              </MobileMenu>
            </div>
          </div>
        </header>

        <main id="conteudo">{children}</main>

        <footer className="tl-footer">
          <div className="tl-container">
            <div className="tl-footer__cols">
              <div className="tl-footer__brand">
                <p className="tl-footer__motto">Mais que dieta, um estilo de vida.</p>
                <p>
                  {s.professionalName} · {s.professionalTitle}
                  {s.registry ? ` · ${s.registry}` : ''}
                </p>
                <div className="tl-footer__social">
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                      <IconWhatsApp width={18} height={18} />
                    </a>
                  )}
                  {ig && (
                    <a href={ig.url} target="_blank" rel="noopener noreferrer" aria-label={`Instagram @${ig.handle}`}>
                      <IconInstagram width={18} height={18} />
                    </a>
                  )}
                  {mail && (
                    <a href={mail.url} aria-label={`Escrever para ${mail.email}`} title={mail.email}>
                      <IconMail width={18} height={18} />
                    </a>
                  )}
                </div>
              </div>
              <nav aria-label="Seções">
                <h2>Seções</h2>
                {SITE_NAV.map((n) => (
                  <Link key={n.href} href={n.href}>
                    / {n.label}
                  </Link>
                ))}
                <Link href="/privacidade">/ Política de privacidade</Link>
              </nav>
              <nav aria-label="Páginas">
                <h2>Páginas</h2>
                {SITE_PAGES.map((n) => (
                  <Link key={n.href} href={n.href}>
                    / {n.label}
                  </Link>
                ))}
              </nav>
              <nav aria-label="Área do cliente">
                <h2>Área do cliente</h2>
                <Link href="/entrar">/ Entrar</Link>
                <Link href="/criar-conta">/ Criar conta</Link>
                <Link href="/privacidade">/ Privacidade</Link>
              </nav>
              <div>
                <h2>Contato</h2>
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    WhatsApp {phoneLabel(s.whatsapp)}
                  </a>
                )}
                <p>Atendimento on-line, por videochamada e pelo app</p>
              </div>
            </div>
            <p className="tl-footer__copy">
              © {new Date().getFullYear()} {s.siteName} · {s.professionalName}. As informações deste site são educativas e não substituem o acompanhamento
              individual.
            </p>
            <p className="tl-credit">
              <a href={TIMELESS_URL} className="tl-credit__link">
                Site por <span className="sr-only">TIMELESS</span>
                <span className="tl-credit__name" aria-hidden>
                  {'TIMELESS'.split('').map((ch, i) => (
                    <span key={i} className={i % 2 ? 'is-out' : undefined}>
                      {ch}
                    </span>
                  ))}
                </span>{' '}
                <span className="tl-credit__dot" aria-hidden>
                  ●
                </span>
              </a>
            </p>
          </div>
        </footer>

        {/* Botões flutuantes numa coluna no canto inferior direito: "Voltar ao topo" em cima, WhatsApp embaixo. */}
        <div className="site-floats">
          <BackToTop place="site" />
          {wa && (
            <a className="whatsapp-float" href={wa} target="_blank" rel="noopener noreferrer" aria-label="Conversar pelo WhatsApp">
              <IconWhatsApp />
            </a>
          )}
        </div>
      </div>
    </MotionRoot>
  )
}
