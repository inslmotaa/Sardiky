import Link from 'next/link'
import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { bookingLink } from '@/lib/format'
import { BookingLink } from '@/components/BookingLink'
import { PageHead } from '@/components/SiteBlocks'
import { PhoneMock } from '@/components/PhoneMock'

export const metadata: Metadata = { title: 'Como funciona' }

const STEPS = [
  { title: 'Escolha o seu plano', text: 'Mensal, trimestral, semestral ou anual. Quanto mais longo, menor o valor por mês.' },
  { title: 'Crie sua conta', text: 'Em menos de um minuto, com e-mail e WhatsApp. Seus dados ficam protegidos.' },
  {
    title: 'Responda a anamnese',
    text: 'No próprio site, em etapas curtas: saúde, rotina, alimentação e objetivo. Dá para parar e continuar depois.',
  },
  { title: 'Avaliação', text: 'Presencial ou on-line: conversa, avaliação física e definição das primeiras metas.' },
  { title: 'Plano no app', text: 'Seu plano aparece na área do cliente, com refeições por horário, quantidades e substituições.' },
  {
    title: 'Acompanhamento e ajustes',
    text: 'Diário, mensagens e evolução no app. A estratégia é revista a cada 15 dias, conforme o seu progresso.',
  },
]

/** Passo a passo do acompanhamento e o que está incluso em todos os planos. */
export default async function HowItWorksPage() {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()])
  const booking = bookingLink(s, undefined, { loggedIn: Boolean(user) })
  return (
    <>
      <PageHead
        label="COMO FUNCIONA"
        title="Do primeiro contato ao acompanhamento"
        lead="Um processo simples, com cada etapa clara — e você acompanhando tudo pelo celular."
      />

      <section className="tl-page">
        <div className="tl-container about">
          <div>
            <p className="sec-label" data-rv="">
              / PASSO A PASSO
            </p>
            <h2 className="display" data-rv="">
              Seis etapas, no seu ritmo
            </h2>
          </div>
          <ol className="timeline-tl">
            {STEPS.map((st, i) => (
              <li key={st.title} data-rv="" style={{ '--d': `${i * 60}ms` } as React.CSSProperties}>
                <span className="step__n">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h2>{st.title}</h2>
                  <p>{st.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="tl-page">
        <div className="tl-container about">
          <div>
            <p className="sec-label" data-rv="">
              / INCLUSO EM TODOS OS PLANOS
            </p>
            <h2 className="display" data-rv="">
              O que você recebe
            </h2>
            {s.plansIncluded.length > 0 ? (
              <ol className="timeline-tl tl-gap">
                {s.plansIncluded.map((it, i) => (
                  <li key={it.title} data-rv="">
                    <span className="step__n">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h3 className="step__title">{it.title}</h3>
                      {it.text && <p>{it.text}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="tl-lead">Avaliação, plano individual e acompanhamento pelo app.</p>
            )}
            <div className="tl-actions" data-rv="">
              <BookingLink to={booking} className="pill">
                Agendar consulta <span aria-hidden>→</span>
              </BookingLink>
              <Link href="/planos" className="ulink">
                Ver planos
              </Link>
            </div>
          </div>
          <div className="phone-wrap" data-rv="">
            <PhoneMock />
          </div>
        </div>
      </section>
    </>
  )
}
