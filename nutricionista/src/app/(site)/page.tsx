import Link from 'next/link'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { bookingLink, money } from '@/lib/format'
import { planPrices } from '@/lib/planos'
import { BookingLink } from '@/components/BookingLink'
import { StoryIntro } from '@/components/StoryIntro'
import { PhoneMock } from '@/components/PhoneMock'
import { FloatingFruit } from '@/components/Fruits'
import { CountUp, FadeUp, HeroDecor, Stagger, StaggerItem, WordsTitle } from '@/components/motion'
import { IconCalendar, IconChart, IconChat, IconCheck, IconForm, IconPlate, IconWhatsApp } from '@/components/icons'

/** Objetivos atendidos (os mesmos do material de divulgação). */
const GOALS = ['Ganho de massa muscular', 'Emagrecimento saudável', 'Mais energia e disposição', 'Melhor qualidade de vida']

const PILLARS = [
  { icon: <IconForm />, title: 'Avaliação completa', text: 'Anamnese detalhada e avaliação física, presencial ou on-line, para entender de onde você parte.' },
  { icon: <IconPlate />, title: 'Estratégia individual', text: 'Um plano montado para a sua rotina, seus gostos e o seu objetivo, sem fórmulas prontas.' },
  { icon: <IconChat />, title: 'Acompanhamento próximo', text: 'Diário, mensagens e lembretes no app: você não fica sozinho entre um retorno e outro.' },
  { icon: <IconChart />, title: 'Ajustes constantes', text: 'A estratégia evolui com você: dieta revista a cada 15 dias, conforme o seu progresso.' },
]

const DEFAULT_STEPS = [
  { title: 'Escolha seu plano', text: 'Mensal, trimestral, semestral ou anual.' },
  { title: 'Crie sua conta', text: 'E responda a anamnese no próprio site.' },
  { title: 'Avaliação', text: 'Conversa, avaliação física e definição de metas.' },
  { title: 'Plano no app', text: 'Com ajustes a cada 15 dias.' },
]

/** Página principal: storytelling animado, quem é o André, método, app, como funciona, planos, dúvidas e agendamento. */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const [s, user, packages, faqs, testimonials] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    db.select().from(schema.packages).where(eq(schema.packages.active, true)),
    db.select().from(schema.faqs).where(eq(schema.faqs.published, true)).orderBy(asc(schema.faqs.sort)).limit(3),
    // Só depoimentos com autorização registrada E marcados para publicação.
    db
      .select()
      .from(schema.testimonials)
      .where(and(eq(schema.testimonials.published, true), isNotNull(schema.testimonials.authorizedAt)))
      .orderBy(asc(schema.testimonials.sort))
      .limit(3),
  ])
  const booking = bookingLink(s, undefined, { loggedIn: Boolean(user) })
  const first = s.professionalName.split(' ')[0]
  const plans = planPrices(packages)
  const fromMonthly = plans.length ? Math.min(...plans.map((p) => p.monthlyCents)) : null
  const months = plans.map((p) => p.months)
  const steps = (s.howItWorks.length ? s.howItWorks : DEFAULT_STEPS).slice(0, 4)
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

      {/* ---------------------- ABERTURA EM STORYTELLING ---------------------- */}
      <StoryIntro name={s.professionalName} booking={booking} aboutHref="#apresentacao" />

      {/* --------------------------- QUEM É O ANDRÉ --------------------------- */}
      <section className="home-hero home-hero--about" id="apresentacao">
        <HeroDecor />
        <div className={`container home-hero__grid${s.photoFileId ? '' : ' home-hero__grid--solo'}`}>
          <div className="home-hero__text">
            <FadeUp>
              <span className="eyebrow">
                {s.professionalTitle}
                {s.registry ? ` · ${s.registry}` : ''}
              </span>
            </FadeUp>
            <WordsTitle as="h2" text={s.professionalName} className="home-hero__title" />
            <FadeUp delay={0.3}>
              <p className="home-hero__lead">
                Nutrição é investimento em você. Planos individualizados, construídos a partir da sua rotina e ajustados de perto, para mais
                saúde, performance e resultados.
              </p>
              <div className="home-hero__actions">
                <BookingLink to={booking} className="btn btn--primary btn--lg btn--fx">
                  {booking.external ? <IconWhatsApp /> : <IconCalendar />} Agendar consulta
                </BookingLink>
                <Link href="/planos" className="btn btn--lg btn--fx">
                  Ver planos
                </Link>
              </div>
              <ul className="goal-chips" aria-label="Objetivos">
                {GOALS.map((g) => (
                  <li key={g}>
                    <IconCheck width={14} height={14} /> {g}
                  </li>
                ))}
              </ul>
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
          {/* Foto só quando houver uma enviada em Configurações. */}
          {s.photoFileId && (
            <FadeUp delay={0.25} className="home-hero__portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/arquivos/${s.photoFileId}`} alt={`Foto de ${s.professionalName}`} className="home-photo" />
            </FadeUp>
          )}
        </div>
      </section>

      {/* ------------------------------- MÉTODO ------------------------------- */}
      <section className="section home-section" id="metodo">
        <div className="container">
          <FadeUp className="section__head section__head--center">
            <span className="eyebrow">O método</span>
            <h2>Um acompanhamento feito para durar</h2>
            <p className="muted">Resultado vem de constância. Por isso o trabalho une estratégia, presença e ajustes no tempo certo.</p>
          </FadeUp>
          <Stagger className="pillars">
            {PILLARS.map((p) => (
              <StaggerItem key={p.title} className="pillar">
                <span className="pillar__icon" aria-hidden>
                  {p.icon}
                </span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
          <FadeUp className="center-link">
            <Link href="/sobre" className="link-arrow">
              Conheça o {first} →
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* -------------------------------- APP -------------------------------- */}
      <section className="section home-section home-section--mint" id="app">
        <FloatingFruit name="limao" size={40} style={{ top: '12%', left: '4%' }} duration={8} desktopOnly />
        <FloatingFruit name="morango" size={36} style={{ bottom: '10%', right: '5%' }} delay={0.4} duration={7} />
        <div className="container home-app">
          <FadeUp>
            <span className="eyebrow">Tudo no seu celular</span>
            <h2>Seu plano sempre à mão, não preso na geladeira</h2>
            <p className="muted">Na área do cliente você abre o app e, em dois toques, sabe o que comer agora.</p>
            <ul className="checklist">
              <li>
                <IconCheck /> Refeições do dia por horário, com quantidades e substituições
              </li>
              <li>
                <IconCheck /> Diário com foto, contador de água e registro de peso
              </li>
              <li>
                <IconCheck /> Gráficos de evolução, metas e lembretes no horário certo
              </li>
              <li>
                <IconCheck /> Mensagens diretas com o {first}
              </li>
            </ul>
          </FadeUp>
          <FadeUp delay={0.15} className="home-app__phone">
            <PhoneMock />
          </FadeUp>
        </div>
      </section>

      {/* ---------------------------- COMO FUNCIONA ---------------------------- */}
      <section className="section home-section" id="como-funciona">
        <div className="container">
          <FadeUp className="section__head section__head--center">
            <span className="eyebrow">Como funciona</span>
            <h2>Do primeiro contato ao acompanhamento</h2>
          </FadeUp>
          <Stagger className="flow">
            {steps.map((st, i) => (
              <StaggerItem key={st.title} className="flow__step">
                <span className="flow__n">{i + 1}</span>
                <h3>{st.title}</h3>
                <p>{st.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
          <FadeUp className="center-link">
            <Link href="/como-funciona" className="link-arrow">
              Ver o passo a passo completo →
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ------------------------------- PLANOS ------------------------------- */}
      {plans.length > 0 && (
        <section className="home-section home-plans">
          <FadeUp className="container">
            <div className="home-plans__card">
              <div>
                <span className="eyebrow">Planos de acompanhamento</span>
                <h2>
                  De {Math.min(...months)} a {Math.max(...months)} meses
                  {s.showPlanPrices && fromMonthly ? <>, a partir de {money(fromMonthly)}/mês</> : null}
                </h2>
                <p>Quanto mais longo o plano, menor o valor por mês. Todos incluem avaliação física, anamnese completa e dieta personalizada.</p>
              </div>
              <Link href="/planos" className="btn btn--light btn--lg btn--fx">
                Ver planos
              </Link>
            </div>
          </FadeUp>
        </section>
      )}

      {/* ----------------------------- DEPOIMENTOS ----------------------------- */}
      {testimonials.length > 0 && (
        <section className="section home-section" id="depoimentos">
          <div className="container">
            <FadeUp className="section__head section__head--center">
              <span className="eyebrow">Depoimentos</span>
              <h2>Quem já está no caminho</h2>
              <p className="muted small">Publicados com autorização. Experiências individuais não garantem resultados iguais.</p>
            </FadeUp>
            <Stagger className="quotes">
              {testimonials.map((t) => (
                <StaggerItem key={t.id} className="quote-card">
                  <blockquote>“{t.text}”</blockquote>
                  <span>{t.authorDisplay}</span>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* ------------------------------- DÚVIDAS ------------------------------- */}
      {faqs.length > 0 && (
        <section className="section home-section home-section--mint" id="duvidas">
          <div className="container" style={{ maxWidth: 820 }}>
            <FadeUp className="section__head section__head--center">
              <span className="eyebrow">Dúvidas</span>
              <h2>Perguntas frequentes</h2>
            </FadeUp>
            <FadeUp className="faq">
              {faqs.map((f) => (
                <details key={f.id} className="faq__item">
                  <summary>{f.question}</summary>
                  <p>{f.answer}</p>
                </details>
              ))}
            </FadeUp>
            <FadeUp className="center-link">
              <Link href="/duvidas" className="link-arrow">
                Ver todas as dúvidas →
              </Link>
            </FadeUp>
          </div>
        </section>
      )}

      {/* ------------------------------ AGENDAR ------------------------------ */}
      <section className="home-book" id="agendar">
        <FadeUp className="container">
          <div className="home-book__card">
            <div>
              <h2>Agendar consulta</h2>
              <p>
                {booking.external
                  ? `Fale com o ${first} pelo WhatsApp e escolha o melhor horário para a sua primeira consulta.`
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
