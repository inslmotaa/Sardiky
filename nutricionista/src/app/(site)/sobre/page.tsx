import Link from 'next/link'
import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { bookingLink } from '@/lib/format'
import { BookingLink } from '@/components/BookingLink'
import { FloatingFruit } from '@/components/Fruits'
import { FadeUp, Stagger, StaggerItem } from '@/components/motion'
import { IconCheck } from '@/components/icons'

export const metadata: Metadata = { title: 'Sobre' }

/** Quem é o André: apresentação, especialidades, método e diferenciais (textos editáveis em Configurações). */
export default async function AboutPage() {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()])
  const booking = bookingLink(s, undefined, { loggedIn: Boolean(user) })
  const first = s.professionalName.split(' ')[0]
  return (
    <>
      <section className="page-hero">
        <FloatingFruit name="abacate" size={48} style={{ top: '22%', right: '8%' }} duration={8} desktopOnly />
        <FloatingFruit name="laranja" size={40} style={{ bottom: '12%', left: '6%' }} delay={0.3} duration={7} desktopOnly />
        <FadeUp className="container page-hero__inner">
          <span className="eyebrow">Sobre</span>
          <h1>
            {s.professionalName}
            <span>{s.professionalTitle}</span>
          </h1>
          <p className="page-hero__lead">{s.bio}</p>
        </FadeUp>
      </section>

      <section className="section">
        <div className="container about-grid">
          <FadeUp className="about-card">
            <h2>Como eu trabalho</h2>
            {s.method && <p>{s.method}</p>}
            {s.differentials.length > 0 && (
              <ul className="checklist">
                {s.differentials.map((d) => (
                  <li key={d}>
                    <IconCheck /> {d}
                  </li>
                ))}
              </ul>
            )}
          </FadeUp>
          {s.specialties.length > 0 && (
            <FadeUp delay={0.1} className="about-card about-card--mint">
              <h2>Para quem é</h2>
              <Stagger className="chips-grid">
                {s.specialties.map((sp) => (
                  <StaggerItem key={sp} className="chip-card">
                    <IconCheck width={16} height={16} /> {sp}
                  </StaggerItem>
                ))}
              </Stagger>
              {s.modalityText && <p className="small muted" style={{ margin: '14px 0 0' }}>{s.modalityText}</p>}
            </FadeUp>
          )}
        </div>
      </section>

      <section className="section section--tight">
        <FadeUp className="container">
          <div className="home-book__card">
            <div>
              <h2>Vamos começar?</h2>
              <p>Agende a sua primeira consulta e conte ao {first} onde você quer chegar.</p>
            </div>
            <div className="row">
              <BookingLink to={booking} className="btn btn--light btn--lg btn--fx">
                Agendar consulta
              </BookingLink>
              <Link href="/planos" className="btn btn--lg btn--ghost-light">
                Ver planos
              </Link>
            </div>
          </div>
        </FadeUp>
      </section>
    </>
  )
}
