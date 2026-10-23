import Link from 'next/link'
import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { bookingLink } from '@/lib/format'
import { BookingLink } from '@/components/BookingLink'
import { FloatingFruit } from '@/components/Fruits'
import { PhoneMock } from '@/components/PhoneMock'
import { FadeUp, Stagger, StaggerItem } from '@/components/motion'
import { IconCheck } from '@/components/icons'

export const metadata: Metadata = { title: 'Como funciona' }

const STEPS = [
  { title: 'Escolha o seu plano', text: 'Mensal, trimestral, semestral ou anual. Quanto mais longo, menor o valor por mês.' },
  { title: 'Crie sua conta', text: 'Em menos de um minuto, com e-mail e WhatsApp. Seus dados ficam protegidos.' },
  { title: 'Responda a anamnese', text: 'No próprio site, em etapas curtas: saúde, rotina, alimentação e objetivo. Dá para parar e continuar depois.' },
  { title: 'Avaliação', text: 'Presencial ou on-line: conversa, avaliação física e definição das primeiras metas.' },
  { title: 'Plano no app', text: 'Seu plano aparece na área do cliente, com refeições por horário, quantidades e substituições.' },
  { title: 'Acompanhamento e ajustes', text: 'Diário, mensagens e evolução no app. A dieta é revista a cada 15 dias, conforme o seu progresso.' },
]

/** Passo a passo do acompanhamento e o que está incluso em todos os planos. */
export default async function HowItWorksPage() {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()])
  const booking = bookingLink(s, undefined, { loggedIn: Boolean(user) })
  return (
    <>
      <section className="page-hero">
        <FloatingFruit name="morango" size={42} style={{ top: '20%', left: '7%' }} duration={7} desktopOnly />
        <FloatingFruit name="uva" size={44} style={{ bottom: '14%', right: '8%' }} delay={0.3} duration={8} desktopOnly />
        <FadeUp className="container page-hero__inner">
          <span className="eyebrow">Como funciona</span>
          <h1>Do primeiro contato ao acompanhamento</h1>
          <p className="page-hero__lead">Um processo simples, com cada etapa clara — e você acompanhando tudo pelo celular.</p>
        </FadeUp>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          <Stagger className="timeline">
            {STEPS.map((st, i) => (
              <StaggerItem key={st.title} className="timeline__item">
                <span className="timeline__n">{i + 1}</span>
                <div>
                  <h2>{st.title}</h2>
                  <p>{st.text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="section home-section home-section--mint">
        <div className="container home-app">
          <FadeUp>
            <span className="eyebrow">Incluso em todos os planos</span>
            <h2>O que você recebe</h2>
            {s.plansIncluded.length > 0 ? (
              <ul className="included-list">
                {s.plansIncluded.map((it) => (
                  <li key={it.title}>
                    <IconCheck />
                    <div>
                      <strong>{it.title}</strong>
                      {it.text && <span>{it.text}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Avaliação, plano individual e acompanhamento pelo app.</p>
            )}
            <div className="row" style={{ marginTop: 18 }}>
              <BookingLink to={booking} className="btn btn--primary btn--lg btn--fx">
                Agendar consulta
              </BookingLink>
              <Link href="/planos" className="btn btn--lg btn--fx">
                Ver planos
              </Link>
            </div>
          </FadeUp>
          <FadeUp delay={0.15} className="home-app__phone">
            <PhoneMock />
          </FadeUp>
        </div>
      </section>
    </>
  )
}
