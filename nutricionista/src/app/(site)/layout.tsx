import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { bookingLink, whatsappLink } from '@/lib/format'
import { BookingLink } from '@/components/BookingLink'
import { Brand } from '@/components/Brand'
import { IconInstagram, IconMail, IconWhatsApp } from '@/components/icons'

const NAV = [
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#servicos', label: 'Serviços' },
  { href: '/#planos', label: 'Planos' },
  { href: '/#como-funciona', label: 'Como funciona' },
  { href: '/#duvidas', label: 'Dúvidas' },
  { href: '/#contato', label: 'Contato' },
]

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings()
  const booking = bookingLink(s)
  const wa = whatsappLink(s.whatsapp, 'Olá! Vim pelo site e gostaria de mais informações sobre as consultas.')
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      {s.demoBanner && (
        <div className="demo-banner" role="note">
          Versão de demonstração: registro, endereço, e-mail, depoimentos e pacientes são fictícios.
        </div>
      )}
      <header className="site-header">
        <div className="container site-header__inner" style={{ position: 'relative' }}>
          <Brand name={s.professionalName} sub={s.professionalTitle} logoFileId={s.logoFileId} />
          <nav className="site-nav" aria-label="Principal">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
            <Link href="/login" className="btn btn--ghost btn--sm">
              Área do paciente
            </Link>
            <BookingLink to={booking} className="btn btn--primary btn--sm">
              Agendar consulta
            </BookingLink>
          </nav>
          <details className="mobile-menu">
            <summary aria-label="Abrir menu">Menu</summary>
            <div className="mobile-menu__panel">
              {NAV.map((n) => (
                <a key={n.href} href={n.href}>
                  {n.label}
                </a>
              ))}
              <Link href="/login">Área do paciente</Link>
              <BookingLink to={booking} className="btn btn--primary btn--block">
                Agendar consulta
              </BookingLink>
            </div>
          </details>
        </div>
      </header>

      <main id="conteudo">{children}</main>

      <footer className="site-footer">
        <div className="container">
          <div className="site-footer__grid">
            <div>
              <h3>
                {s.professionalName} · {s.professionalTitle}
              </h3>
              {s.registry && <p style={{ margin: 0 }}>{s.registry}</p>}
              <p style={{ marginTop: 12, maxWidth: 420 }}>
                Atendimento nutricional individualizado. As informações deste site são educativas e não substituem a
                consulta com um profissional.
              </p>
            </div>
            <div>
              <h3>Atendimento</h3>
              {s.address && <p style={{ margin: '0 0 6px' }}>{s.address}</p>}
              {s.hoursText && <p style={{ margin: '0 0 6px' }}>{s.hoursText}</p>}
              {s.modalityText && <p style={{ margin: 0 }}>{s.modalityText}</p>}
            </div>
            <div>
              <h3>Contato</h3>
              <ul className="list" style={{ display: 'grid', gap: 8 }}>
                {wa && (
                  <li style={{ border: 0, padding: 0 }}>
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="row" style={{ gap: 8 }}>
                      <IconWhatsApp width={18} height={18} /> WhatsApp
                    </a>
                  </li>
                )}
                {s.instagram && (
                  <li style={{ border: 0, padding: 0 }}>
                    <a href={s.instagram} target="_blank" rel="noopener noreferrer" className="row" style={{ gap: 8 }}>
                      <IconInstagram width={18} height={18} /> Instagram
                    </a>
                  </li>
                )}
                {s.contactEmail && (
                  <li style={{ border: 0, padding: 0 }}>
                    <a href={`mailto:${s.contactEmail}`} className="row" style={{ gap: 8 }}>
                      <IconMail width={18} height={18} /> {s.contactEmail}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="site-footer__bottom">
            <span>
              © {new Date().getFullYear()} {s.professionalName}
            </span>
            <span className="row" style={{ gap: 16 }}>
              <Link href="/privacidade">Política de Privacidade</Link>
              <Link href="/login">Área do paciente</Link>
            </span>
          </div>
        </div>
      </footer>

      {wa && (
        <a className="whatsapp-float" href={wa} target="_blank" rel="noopener noreferrer" aria-label="Conversar pelo WhatsApp">
          <IconWhatsApp />
        </a>
      )}
    </>
  )
}
