import Link from 'next/link'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { bookingLink, phoneLabel, whatsappLink } from '@/lib/format'
import { planPrices } from '@/lib/planos'
import { BookingLink } from '@/components/BookingLink'
import { Wordmark } from '@/components/Wordmark'
import { Liquid, MonoLabel, PlanGrid } from '@/components/SiteBlocks'
import { ArtClock, ArtPlate, ArtProgress, ArtTries } from '@/components/StoryArt'
import { HeroBotanicals, HeroTicker, PlateCard } from '@/components/HeroArt'

const SERVICES = ['Emagrecimento', 'Performance esportiva', 'Reeducação alimentar']

const WORDS = ['complicado', 'restritivo', 'sem graça', 'uma dieta da moda']

const CHAPTERS = [
  {
    label: 'A rotina',
    title: 'Segunda-feira, 7h. O dia já começou correndo.',
    text: 'Café às pressas, almoço no intervalo possível, lanche esquecido. Sem perceber, a alimentação vai ficando para depois — e a energia também.',
    Art: ArtClock,
  },
  {
    label: 'As tentativas',
    title: 'Você já tentou de tudo.',
    text: 'Dieta da moda, cortar grupos inteiros de alimentos, contar cada caloria. Funciona por alguns dias, mas não cabe na vida real.',
    Art: ArtTries,
  },
  {
    label: 'A virada',
    title: 'Até que o plano passa a ser seu.',
    text: 'Uma avaliação cuidadosa da sua rotina, das suas preferências e do seu objetivo dá origem a um plano individualizado, com substituições para ter flexibilidade.',
    Art: ArtPlate,
  },
  {
    label: 'O caminho',
    title: 'Acompanhamento que enxerga cada passo.',
    text: 'Plano no celular, diário, mensagens e gráficos de evolução. A cada 15 dias a estratégia é revista, no seu ritmo.',
    Art: ArtProgress,
  },
]

const DEFAULT_STEPS = [
  { title: 'Escolha seu plano', text: 'Mensal, trimestral, semestral ou anual.' },
  { title: 'Responda a anamnese', text: 'No próprio site, em etapas curtas.' },
  { title: 'Avaliação e metas', text: 'Conversa, avaliação física e definição de metas.' },
  { title: 'Plano no app', text: 'Ajustado a cada 15 dias.' },
]

const DEFAULT_GOALS = ['Ganho de massa muscular', 'Emagrecimento saudável', 'Mais energia e disposição', 'Melhor qualidade de vida']

const d = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties

/** Página inicial: hero com fundo líquido, storytelling em capítulos, Sobre, Consultoria, Resultados e Contato. */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const [s, user, packages, testimonials] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    db.select().from(schema.packages).where(eq(schema.packages.active, true)).orderBy(asc(schema.packages.sort), asc(schema.packages.months)),
    // Só depoimentos com autorização registrada E marcados para publicação.
    db
      .select()
      .from(schema.testimonials)
      .where(and(eq(schema.testimonials.published, true), isNotNull(schema.testimonials.authorizedAt)))
      .orderBy(asc(schema.testimonials.sort))
      .limit(3),
  ])
  const booking = bookingLink(s, undefined, { loggedIn: Boolean(user) })
  const wa = whatsappLink(s.whatsapp, 'Olá! Vim pelo site e gostaria de mais informações sobre o acompanhamento.')
  const first = s.professionalName.split(' ')[0]
  const plans = planPrices(packages)
  const steps = (s.howItWorks.length ? s.howItWorks : DEFAULT_STEPS).slice(0, 4)
  const goals = s.specialties.length ? s.specialties : DEFAULT_GOALS
  const planHref = (id: string) => (user ? `/agendar?plano=${id}` : `/criar-conta?plano=${id}`)
  const months = plans.map((p) => p.months)
  const numbers = [
    s.statsPatients ? { to: s.statsPatients, prefix: '+', suffix: '', label: 'clientes acompanhados' } : null,
    s.statsYears ? { to: s.statsYears, prefix: '', suffix: '', label: s.statsYears === 1 ? 'ano de experiência' : 'anos de experiência' } : null,
    { to: 15, prefix: '', suffix: ' dias', label: 'entre cada revisão da estratégia' },
    plans.length ? { to: Math.max(...months), prefix: 'até ', suffix: ' meses', label: `de acompanhamento, em ${plans.length} planos` } : null,
    { to: 100, prefix: '', suffix: '%', label: 'individual, sem fórmulas prontas' },
  ]
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 4)
  const instagramHandle = s.instagram?.replace(/^https?:\/\/(www\.)?instagram\.com\/?/, '').replace(/\/$/, '')

  return (
    <>
      {sp.conta === 'excluida' && (
        <p className="alert alert--ok tl-container tl-alert" role="status">
          Sua conta foi excluída e o acesso foi encerrado. Obrigado por ter feito parte do acompanhamento.
        </p>
      )}

      {/* --------------------------------- HERO --------------------------------- */}
      <section className="hero" id="inicio" data-liquid-host="">
        <Liquid />
        <HeroTicker />
        <HeroBotanicals />
        <div className="tl-container hero__inner">
          <PlateCard waterMlPerKg={s.waterMlPerKg} />
          <MonoLabel className="hero__label">
            {s.professionalTitle.toLocaleUpperCase('pt-BR')}
            {s.registry ? ` · ${s.registry.toLocaleUpperCase('pt-BR')}` : ''}
          </MonoLabel>
          <Wordmark as="h1" name={s.professionalName} className="wm--hero" />
          <div className="hero__bottom">
            <p className="hero__lead" data-rv="" style={d(120)}>
              Nutrição baseada em evidência, pensada para a sua rotina. Planos alimentares que você consegue seguir de verdade.
            </p>
            <ul className="mono-list" aria-label="Serviços" data-rv="" style={d(200)}>
              {SERVICES.map((sv) => (
                <li key={sv}>{sv}</li>
              ))}
            </ul>
            <div data-rv="" style={d(280)}>
              <BookingLink to={booking} className="pill">
                Agendar consulta <span aria-hidden>→</span>
              </BookingLink>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------- STORYTELLING ----------------------------- */}
      <section className="story" id="historia" data-story="" aria-labelledby="historia-titulo">
        <div className="tl-container story__open">
          <MonoLabel>UMA HISTÓRIA SOBRE COMER BEM</MonoLabel>
          <h2 id="historia-titulo" className="display story__title" data-rv="" style={d(80)}>
            Comer bem não precisa ser{' '}
            <span className="sr-only">
              {WORDS.slice(0, -1).join(', ')} ou {WORDS.at(-1)}.
            </span>
            <span className="rot-wrap" aria-hidden>
              <span className="rot" data-rotate={WORDS.join('|')}>
                {WORDS[0]}
              </span>
              <span className="rot-dot">.</span>
            </span>
          </h2>
          <p className="tl-lead story__lead" data-rv="" style={d(160)}>
            Esta é a história de muita gente que chega até aqui. Talvez seja a sua também.
          </p>
        </div>

        <div className="tl-container story__body" data-story-body="">
          <aside className="story__rail" aria-hidden>
            <div className="story__rail-inner">
              <span className="story__rail-line">
                <i data-rail-fill="" />
              </span>
              <ol>
                {CHAPTERS.map((c) => (
                  <li key={c.label} data-rail-mark="">
                    {c.label.toLocaleUpperCase('pt-BR')}
                  </li>
                ))}
              </ol>
            </div>
          </aside>
          <ol className="story__chapters">
            {CHAPTERS.map(({ Art, ...c }, i) => (
              <li key={c.label} className="chap" data-chap={i}>
                <div className="chap__art">
                  <Art />
                </div>
                <div className="chap__text">
                  <p className="mono-label" data-rv="">
                    {c.label.toLocaleUpperCase('pt-BR')}
                  </p>
                  <h3 className="display chap__title" data-rv="" style={d(90)}>
                    {c.title}
                  </h3>
                  <p className="chap__p" data-rv="" style={d(180)}>
                    {c.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="story__close" data-liquid-host="">
          <Liquid />
          <div className="tl-container story__close-inner">
            <MonoLabel>PRÓXIMO CAPÍTULO</MonoLabel>
            <h2 className="display story__close-title" data-rv="" style={d(80)}>
              A sua história começa na primeira consulta.
            </h2>
            <div className="tl-actions" data-rv="" style={d(160)}>
              <BookingLink to={booking} className="pill">
                Escrever o próximo capítulo <span aria-hidden>→</span>
              </BookingLink>
              <a href="#sobre" className="ulink">
                Conhecer o {first}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------- SOBRE --------------------------------- */}
      <section className="tl-sec" id="sobre" aria-labelledby="sobre-titulo">
        <div className="tl-container">
          <p className="sec-label" data-rv="">
            / SOBRE
          </p>
          <div className="about">
            {s.photoFileId ? (
              <figure className="about__photo" data-rv="">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/arquivos/${s.photoFileId}`} alt={`Foto de ${s.professionalName}`} />
              </figure>
            ) : (
              <figure className="about__photo about__photo--liquid" data-liquid-host="" data-rv="">
                <Liquid />
                <figcaption className="about__caption">
                  {s.professionalName.toLocaleUpperCase('pt-BR')} · {s.professionalTitle.toLocaleUpperCase('pt-BR')}
                </figcaption>
              </figure>
            )}
            <div className="about__text">
              <h2 id="sobre-titulo" className="display" data-rv="">
                Mais que dieta, um estilo de vida.
              </h2>
              <p className="tl-lead" data-rv="" style={d(80)}>
                {s.bio}
              </p>
              {s.method && (
                <div className="about__block" data-rv="" style={d(140)}>
                  <h3 className="mono-label">MÉTODO</h3>
                  <p>{s.method}</p>
                </div>
              )}
              <div className="about__block" data-rv="" style={d(200)}>
                <h3 className="mono-label">OBJETIVOS</h3>
                <ul className="mono-list mono-list--wrap">
                  {goals.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
              <Link href="/sobre" className="ulink" data-rv="" style={d(240)}>
                Mais sobre o {first} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ CONSULTORIA ------------------------------ */}
      <section className="tl-sec" id="consultoria" aria-labelledby="consultoria-titulo">
        <div className="tl-container">
          <p className="sec-label" data-rv="">
            / CONSULTORIA
          </p>
          <div className="sec-head">
            <h2 id="consultoria-titulo" className="display" data-rv="">
              Como funciona a consultoria
            </h2>
            <p className="tl-lead" data-rv="" style={d(80)}>
              Um acompanhamento individual, do primeiro contato aos ajustes de cada quinzena.
            </p>
          </div>
          <ol className="steps">
            {steps.map((st, i) => (
              <li key={st.title} className="step" data-rv="" style={d(i * 80)}>
                <span className="step__mark" aria-hidden />
                <h3>{st.title}</h3>
                {st.text && <p>{st.text}</p>}
              </li>
            ))}
          </ol>

          {plans.length > 0 && (
            <>
              <h3 className="mono-label tl-subhead" data-rv="">
                PLANOS
              </h3>
              <PlanGrid plans={plans} showPrices={s.showPlanPrices} href={planHref} />
            </>
          )}
          {s.plansIncluded.length > 0 && (
            <div className="included" data-rv="">
              <h3 className="mono-label">INCLUSO EM TODOS</h3>
              <ul className="mono-list mono-list--wrap">
                {s.plansIncluded.map((it) => (
                  <li key={it.title}>
                    {it.title}
                    {it.text ? ` (${it.text.replace(/\.$/, '').toLocaleLowerCase('pt-BR')})` : ''}
                  </li>
                ))}
              </ul>
              <Link href="/planos" className="ulink">
                Comparar os planos →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------ RESULTADOS ------------------------------ */}
      <section className="tl-sec" id="resultados" aria-labelledby="resultados-titulo">
        <div className="tl-container">
          <p className="sec-label" data-rv="">
            / RESULTADOS
          </p>
          <div className="sec-head">
            <h2 id="resultados-titulo" className="display" data-rv="">
              Constância que aparece nos números
            </h2>
          </div>
          <dl className="numbers">
            {numbers.map((n, i) => (
              <div key={n.label} className="numbers__item" data-rv="" style={d(i * 80)}>
                <dt>{n.label}</dt>
                <dd>
                  {n.prefix && <small>{n.prefix.trim()}</small>}
                  <span data-count={n.to}>{n.to.toLocaleString('pt-BR')}</span>
                  {n.suffix && <small>{n.suffix.trim()}</small>}
                </dd>
              </div>
            ))}
          </dl>
          {testimonials.length > 0 && (
            <ul className="quotes">
              {testimonials.map((t, i) => (
                <li key={t.id} className="quote" data-rv="" style={d(i * 90)}>
                  <blockquote>“{t.text}”</blockquote>
                  <p className="quote__by">{t.authorDisplay.toLocaleUpperCase('pt-BR')}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="tl-note" data-rv="">
            Resultados variam de pessoa para pessoa. Depoimentos publicados com autorização.
          </p>
        </div>
      </section>

      {/* -------------------------------- CONTATO -------------------------------- */}
      <section className="tl-sec tl-sec--last" id="contato" aria-labelledby="contato-titulo">
        <div className="tl-container">
          <p className="sec-label" data-rv="">
            / CONTATO
          </p>
          <div className="contact">
            <div>
              <h2 id="contato-titulo" className="display" data-rv="">
                Vamos começar?
              </h2>
              <p className="tl-lead" data-rv="" style={d(80)}>
                Conte onde você quer chegar. A resposta vem direto do {first}.
              </p>
              <div className="tl-actions" data-rv="" style={d(140)}>
                <BookingLink to={booking} className="pill">
                  Agendar consulta <span aria-hidden>→</span>
                </BookingLink>
                <Link href="/duvidas" className="ulink">
                  Dúvidas frequentes
                </Link>
              </div>
            </div>
            <dl className="contact__list" data-rv="" style={d(120)}>
              {wa && (
                <div>
                  <dt>WHATSAPP</dt>
                  <dd>
                    <a href={wa} target="_blank" rel="noopener noreferrer">
                      {phoneLabel(s.whatsapp)}
                    </a>
                  </dd>
                </div>
              )}
              {s.instagram && (
                <div>
                  <dt>INSTAGRAM</dt>
                  <dd>
                    <a href={s.instagram} target="_blank" rel="noopener noreferrer">
                      {instagramHandle ? `@${instagramHandle}` : 'Instagram'}
                    </a>
                  </dd>
                </div>
              )}
              {s.hoursText && (
                <div>
                  <dt>HORÁRIO</dt>
                  <dd>{s.hoursText}</dd>
                </div>
              )}
              {s.modalityText && (
                <div>
                  <dt>MODALIDADE</dt>
                  <dd>{s.modalityText}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </section>
    </>
  )
}
