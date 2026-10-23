import Link from 'next/link'
import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { bookingLink } from '@/lib/format'
import { BookingLink } from '@/components/BookingLink'
import { PageHead } from '@/components/SiteBlocks'

export const metadata: Metadata = { title: 'Sobre' }

/** Quem é o André: apresentação, método, diferenciais e objetivos (textos editáveis em Configurações). */
export default async function AboutPage() {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()])
  const booking = bookingLink(s, undefined, { loggedIn: Boolean(user) })
  const first = s.professionalName.split(' ')[0]
  return (
    <>
      <PageHead label={`SOBRE · ${s.professionalTitle.toLocaleUpperCase('pt-BR')}`} title={s.professionalName} lead={s.bio} />

      <section className="tl-page">
        <div className="tl-container about">
          <div>
            <p className="sec-label" data-rv="">
              / COMO EU TRABALHO
            </p>
            <h2 className="display" data-rv="">
              Mais que dieta, um estilo de vida.
            </h2>
          </div>
          <div className="about__text">
            {s.method && (
              <p className="tl-lead" data-rv="">
                {s.method}
              </p>
            )}
            {s.differentials.length > 0 && (
              <div className="about__block" data-rv="">
                <h3 className="mono-label">DIFERENCIAIS</h3>
                <ul className="mono-list mono-list--wrap">
                  {s.differentials.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {s.specialties.length > 0 && (
        <section className="tl-page">
          <div className="tl-container about">
            <div>
              <p className="sec-label" data-rv="">
                / PARA QUEM É
              </p>
              <h2 className="display" data-rv="">
                Objetivos que acompanhamos
              </h2>
            </div>
            <div className="about__text">
              <ol className="timeline-tl">
                {s.specialties.map((sp, i) => (
                  <li key={sp} data-rv="" style={{ '--d': `${i * 70}ms` } as React.CSSProperties}>
                    <span className="step__mark" aria-hidden />
                    <h3 className="step__title">{sp}</h3>
                  </li>
                ))}
              </ol>
              {s.modalityText && <p className="tl-note">{s.modalityText}</p>}
            </div>
          </div>
        </section>
      )}

      <section className="tl-page">
        <div className="tl-container">
          <p className="sec-label" data-rv="">
            / VAMOS COMEÇAR?
          </p>
          <h2 className="display" data-rv="">
            Conte ao {first} onde você quer chegar.
          </h2>
          <div className="tl-actions" data-rv="">
            <BookingLink to={booking} className="pill">
              Agendar consulta <span aria-hidden>→</span>
            </BookingLink>
            <Link href="/planos" className="ulink">
              Ver planos
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
