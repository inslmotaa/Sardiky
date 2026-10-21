'use client'

import { useEffect, useRef, useState } from 'react'
import type { BookingTarget } from '@/lib/format'
import { BookingLink } from './BookingLink'

const WORDS = ['complicado', 'restritivo', 'uma dieta da moda']

const CHAPTERS = [
  {
    kicker: 'Capítulo 1 · A rotina',
    title: 'Segunda-feira, 7h. O dia já começou correndo.',
    text: 'Café às pressas, almoço no intervalo possível, lanche esquecido. Sem perceber, a alimentação vai ficando para depois — e a energia também.',
  },
  {
    kicker: 'Capítulo 2 · As tentativas',
    title: 'Você já tentou de tudo.',
    text: 'Dieta da moda, cortar grupos inteiros de alimentos, contar cada caloria. Funciona por alguns dias, mas não cabe na vida real.',
  },
  {
    kicker: 'Capítulo 3 · A virada',
    title: 'Até que o plano passa a ser seu.',
    text: 'Uma avaliação cuidadosa da sua rotina, das suas preferências e dos seus objetivos dá origem a um plano individualizado, com substituições para ter flexibilidade.',
  },
  {
    kicker: 'Capítulo 4 · O caminho',
    title: 'Acompanhamento que enxerga cada passo.',
    text: 'Plano no celular, diário alimentar, mensagens e gráficos de evolução. A cada consulta, ajustamos a estratégia juntos, no seu ritmo.',
  },
]

/**
 * Abertura em storytelling. Animações leves (CSS), acionadas pela rolagem.
 * Sem JavaScript ou com "reduzir movimento" ativo, todo o conteúdo aparece estático.
 */
export function StoryIntro({ name, booking }: { name: string; booking: BookingTarget }) {
  const [word, setWord] = useState(0)
  const [active, setActive] = useState(0)
  const [ready, setReady] = useState(false)
  const [seen, setSeen] = useState<number[]>([])
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setReady(true)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = reduce ? undefined : window.setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2400)

    const el = root.current
    if (!el) return () => window.clearInterval(timer)
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.classList.add('is-visible')
      },
      { threshold: 0.2 },
    )
    el.querySelectorAll('.reveal:not([data-index])').forEach((n) => reveal.observe(n))

    const chapters = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    // Visibilidade dos capítulos fica no estado do React (a classe muda junto com o capítulo ativo).
    const seenObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.index)
          if (e.isIntersecting) setSeen((prev) => (prev.includes(i) ? prev : [...prev, i]))
        }
      },
      { threshold: 0.15 },
    )
    el.querySelectorAll('[data-index]').forEach((n) => {
      chapters.observe(n)
      seenObs.observe(n)
    })
    return () => {
      window.clearInterval(timer)
      reveal.disconnect()
      chapters.disconnect()
      seenObs.disconnect()
    }
  }, [])

  return (
    <div ref={root} className="story" data-ready={ready ? 'true' : undefined}>
      {/* ------------------------------ abertura ------------------------------ */}
      <section className="story-open">
        <div className="story-open__blob story-open__blob--1" aria-hidden />
        <div className="story-open__blob story-open__blob--2" aria-hidden />
        <div className="container story-open__inner">
          <span className="eyebrow reveal">Uma história sobre comer bem</span>
          <h1 className="story-open__title reveal">
            Comer bem não precisa ser{' '}
            <span className="story-word" aria-live="polite">
              <span key={word} className="story-word__item">
                {WORDS[word]}
              </span>
            </span>
            <span className="story-open__dot">.</span>
          </h1>
          <p className="story-open__lead reveal">
            Esta é a história de muita gente que chega ao consultório. Talvez seja a sua também.
          </p>
          <div className="row reveal" style={{ justifyContent: 'center' }}>
            <BookingLink to={booking} className="btn btn--primary btn--lg">
              Agendar consulta
            </BookingLink>
            <a href="#historia" className="btn btn--lg">
              Conhecer a história
            </a>
          </div>
          <a href="#historia" className="story-scroll" aria-label="Rolar para a história">
            <span />
          </a>
        </div>
      </section>

      {/* ------------------------------ capítulos ----------------------------- */}
      <section className="story-chapters" id="historia" aria-label="A história em quatro capítulos">
        <div className="container story-chapters__grid">
          <div className="story-stage" aria-hidden>
            <div className="story-stage__frame">
              <ol className="story-progress">
                {CHAPTERS.map((c, i) => (
                  <li key={c.kicker} className={i <= active ? 'on' : undefined} />
                ))}
              </ol>
              <SceneClock on={active === 0} />
              <SceneTries on={active === 1} />
              <ScenePlate on={active === 2} />
              <SceneProgress on={active === 3} />
            </div>
          </div>

          <div className="story-texts">
            {CHAPTERS.map((c, i) => (
              <article key={c.kicker} className={`story-chapter reveal${seen.includes(i) ? ' is-visible' : ''}${active === i ? ' is-active' : ''}`} data-index={i}>
                <div className="story-chapter__mobile-scene" aria-hidden>
                  {i === 0 && <SceneClock on />}
                  {i === 1 && <SceneTries on />}
                  {i === 2 && <ScenePlate on />}
                  {i === 3 && <SceneProgress on />}
                </div>
                <span className="eyebrow">{c.kicker}</span>
                <h2>{c.title}</h2>
                <p>{c.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------- final ------------------------------- */}
      <section className="story-end">
        <div className="container reveal">
          <span className="eyebrow">Próximo capítulo</span>
          <h2>A sua história começa na primeira consulta.</h2>
          <p>
            Com {name}, você não recebe uma dieta pronta: constrói um jeito de comer que faz sentido para a sua vida. Cada
            pessoa evolui no seu tempo; não prometemos resultados garantidos, prometemos acompanhamento de verdade.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <BookingLink to={booking} className="btn btn--primary btn--lg">
              Escrever o próximo capítulo
            </BookingLink>
            <a href="#apresentacao" className="btn btn--lg">
              Conhecer o nutricionista
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ------------------------------- cenas (SVG) ------------------------------- */

function SceneClock({ on }: { on: boolean }) {
  return (
    <div className={`scene scene--clock ${on ? 'is-on' : ''}`}>
      <svg viewBox="0 0 240 240">
        <circle cx="120" cy="120" r="86" className="sc-face" />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="120" y1="44" x2="120" y2={i % 3 === 0 ? 56 : 51} className="sc-tick" transform={`rotate(${i * 30} 120 120)`} />
        ))}
        <line x1="120" y1="120" x2="120" y2="78" className="sc-hand sc-hand--hour" />
        <line x1="120" y1="120" x2="120" y2="58" className="sc-hand sc-hand--min" />
        <circle cx="120" cy="120" r="5" className="sc-pin" />
      </svg>
      <div className="scene__tags">
        <span style={{ ['--d' as string]: '0ms' }}>Café às pressas</span>
        <span style={{ ['--d' as string]: '180ms' }}>Almoço em 15 minutos</span>
        <span style={{ ['--d' as string]: '360ms' }}>Lanche esquecido</span>
      </div>
    </div>
  )
}

function SceneTries({ on }: { on: boolean }) {
  const items = ['Dieta da moda', 'Cortar tudo', 'Contar cada caloria', 'Jejum sem orientação']
  return (
    <div className={`scene scene--tries ${on ? 'is-on' : ''}`}>
      {items.map((t, i) => (
        <div key={t} className="try-card" style={{ ['--d' as string]: `${i * 160}ms`, ['--r' as string]: `${(i % 2 ? 1 : -1) * (2 + i)}deg` }}>
          <span>{t}</span>
          <svg viewBox="0 0 100 20" preserveAspectRatio="none">
            <path d="M2 12 C 30 4, 60 18, 98 8" />
          </svg>
        </div>
      ))}
    </div>
  )
}

function ScenePlate({ on }: { on: boolean }) {
  // Prato dividido: metade vegetais, um quarto proteína, um quarto carboidrato.
  const C = 2 * Math.PI * 60
  return (
    <div className={`scene scene--plate ${on ? 'is-on' : ''}`}>
      <svg viewBox="0 0 240 240">
        <circle cx="120" cy="120" r="96" className="pl-rim" />
        <circle cx="120" cy="120" r="84" className="pl-base" />
        <circle cx="120" cy="120" r="60" className="pl-seg pl-seg--veg" strokeDasharray={`${C / 2 - 4} ${C}`} style={{ ['--len' as string]: C, ['--d' as string]: '0ms' }} transform="rotate(-90 120 120)" />
        <circle cx="120" cy="120" r="60" className="pl-seg pl-seg--prot" strokeDasharray={`${C / 4 - 4} ${C}`} style={{ ['--len' as string]: C, ['--d' as string]: '350ms' }} transform="rotate(90 120 120)" />
        <circle cx="120" cy="120" r="60" className="pl-seg pl-seg--carb" strokeDasharray={`${C / 4 - 4} ${C}`} style={{ ['--len' as string]: C, ['--d' as string]: '650ms' }} transform="rotate(180 120 120)" />
      </svg>
      <div className="scene__tags">
        <span className="tag-veg" style={{ ['--d' as string]: '200ms' }}>
          Vegetais
        </span>
        <span className="tag-prot" style={{ ['--d' as string]: '500ms' }}>
          Proteína
        </span>
        <span className="tag-carb" style={{ ['--d' as string]: '800ms' }}>
          Carboidrato
        </span>
      </div>
    </div>
  )
}

function SceneProgress({ on }: { on: boolean }) {
  return (
    <div className={`scene scene--progress ${on ? 'is-on' : ''}`}>
      <div className="phone">
        <div className="phone__notif">
          <strong>Plano atualizado</strong>
          <span>Seu novo plano já está disponível.</span>
        </div>
        <svg viewBox="0 0 200 110" className="phone__chart">
          <line x1="10" y1="100" x2="190" y2="100" className="ph-axis" />
          <path d="M12 30 L52 42 L92 52 L132 66 L172 74" className="ph-line" pathLength={1} />
          {[
            [12, 30],
            [52, 42],
            [92, 52],
            [132, 66],
            [172, 74],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4.5" className="ph-pt" style={{ ['--d' as string]: `${300 + i * 220}ms` }} />
          ))}
        </svg>
        <div className="phone__row">
          <span>Diário de hoje</span>
          <span className="phone__check">✓ 3 refeições</span>
        </div>
        <div className="phone__row">
          <span>Próxima consulta</span>
          <span>em 5 dias</span>
        </div>
      </div>
    </div>
  )
}
