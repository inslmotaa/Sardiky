import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { bookingLink, initials } from '@/lib/format'
import { BookingLink } from '@/components/BookingLink'
import { CountUp, FadeUp, HeroDecor, WordsTitle } from '@/components/motion'
import { IconCalendar, IconWhatsApp } from '@/components/icons'

/** Página principal enxuta: quem é o André, agendar consulta e rodapé (no layout). */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()])
  const booking = bookingLink(s, undefined, { loggedIn: Boolean(user) })
  const stats = [
    s.statsPatients ? { to: s.statsPatients, prefix: '+', label: 'pacientes atendidos' } : null,
    s.statsYears ? { to: s.statsYears, prefix: '', label: s.statsYears === 1 ? 'ano de experiência' : 'anos de experiência' } : null,
  ].filter((x): x is { to: number; prefix: string; label: string } => x !== null)

  return (
    <>
      {sp.conta === 'excluida' && (
        <p className="alert alert--ok container" role="status" style={{ marginTop: 12 }}>
          Sua conta foi excluída e o acesso foi encerrado. Obrigado por ter feito parte do acompanhamento.
        </p>
      )}
      {/* ------------------------- HERO: QUEM É O ANDRÉ ------------------------- */}
      <section className="home-hero" id="inicio">
        <HeroDecor />
        <div className="container home-hero__grid">
          <div className="home-hero__text">
            <FadeUp>
              <span className="eyebrow">
                {s.professionalTitle}
                {s.registry ? ` · ${s.registry}` : ''}
              </span>
            </FadeUp>
            <WordsTitle text={s.professionalName} className="home-hero__title" />
            <FadeUp delay={0.35}>
              <p className="home-hero__lead">
                Nutrição é investimento em você. Planos individualizados, construídos a partir da sua rotina e ajustados de perto, para
                mais saúde, performance e resultados. Mais que dieta, um estilo de vida.
              </p>
              <div className="home-hero__actions">
                <BookingLink to={booking} className="btn btn--primary btn--lg btn--fx btn--pulse">
                  {booking.external ? <IconWhatsApp /> : <IconCalendar />} Agendar consulta
                </BookingLink>
                <Link href="/planos" className="btn btn--lg btn--fx">
                  Ver planos
                </Link>
              </div>
              {stats.length > 0 && (
                <dl className="home-stats">
                  {stats.map((st) => (
                    <div key={st.label}>
                      <dt>{st.label}</dt>
                      <dd>
                        <CountUp to={st.to} prefix={st.prefix} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </FadeUp>
          </div>
          <FadeUp delay={0.25} className="home-hero__portrait">
            {s.photoFileId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/arquivos/${s.photoFileId}`} alt={`Foto de ${s.professionalName}`} className="home-photo" />
            ) : (
              <div className="monogram" role="img" aria-label={`${s.professionalName}, ${s.professionalTitle}`}>
                {initials(s.professionalName)}
              </div>
            )}
          </FadeUp>
        </div>
      </section>

      {/* ---------------------------- AGENDAR CONSULTA ---------------------------- */}
      <section className="home-book" id="agendar">
        <FadeUp className="container">
          <div className="home-book__card">
            <div>
              <h2>Agendar consulta</h2>
              <p>
                {booking.external
                  ? 'Fale com o André pelo WhatsApp e escolha o melhor horário para a sua primeira consulta.'
                  : user
                    ? 'Escolha o tipo de consulta, a data e o horário. Leva menos de um minuto.'
                    : 'Crie sua conta, preencha a anamnese e escolha o melhor horário para a sua primeira consulta.'}
              </p>
            </div>
            <BookingLink to={booking} className="btn btn--light btn--lg btn--fx">
              {booking.external ? 'Chamar no WhatsApp' : user ? 'Ver horários' : 'Começar agora'}
            </BookingLink>
          </div>
        </FadeUp>
      </section>
    </>
  )
}
