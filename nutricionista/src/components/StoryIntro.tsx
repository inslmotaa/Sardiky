'use client'

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { BookingTarget } from '@/lib/format'
import { BookingLink } from './BookingLink'
import { FloatingFruit, Fruit, type FruitName } from './Fruits'
import { HeroDecor } from './motion'

const WORDS = ['complicado', 'restritivo', 'sem graça', 'uma dieta da moda']

const CHAPTERS: { kicker: string; title: string; text: string; fruits: FruitName[] }[] = [
  {
    kicker: 'Capítulo 1 · A rotina',
    title: 'Segunda-feira, 7h. O dia já começou correndo.',
    text: 'Café às pressas, almoço no intervalo possível, lanche esquecido. Sem perceber, a alimentação vai ficando para depois — e a energia também.',
    fruits: ['banana', 'laranja'],
  },
  {
    kicker: 'Capítulo 2 · As tentativas',
    title: 'Você já tentou de tudo.',
    text: 'Dieta da moda, cortar grupos inteiros de alimentos, contar cada caloria. Funciona por alguns dias, mas não cabe na vida real.',
    fruits: ['limao', 'uva'],
  },
  {
    kicker: 'Capítulo 3 · A virada',
    title: 'Até que o plano passa a ser seu.',
    text: 'Uma avaliação cuidadosa da sua rotina, das suas preferências e do seu objetivo dá origem a um plano individualizado, com substituições para ter flexibilidade — e com as frutas de que você gosta.',
    fruits: ['morango', 'abacate'],
  },
  {
    kicker: 'Capítulo 4 · O caminho',
    title: 'Acompanhamento que enxerga cada passo.',
    text: 'Plano no celular, diário, mensagens e gráficos de evolução. A cada 15 dias a estratégia é revista, no seu ritmo.',
    fruits: ['maca', 'folha'],
  },
]

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Abertura em storytelling: frase que troca de palavra, quatro capítulos com cenas animadas e frutas,
 * e o convite final. Com "reduzir movimento", tudo aparece sem loops.
 */
export function StoryIntro({ name, booking, aboutHref }: { name: string; booking: BookingTarget; aboutHref: string }) {
  const [word, setWord] = useState(0)
  const [active, setActive] = useState(0)
  const reduce = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const open = useRef<HTMLElement>(null)
  // Parallax da abertura: o título sobe um pouco mais devagar que a página.
  const { scrollYProgress } = useScroll({ target: open, offset: ['start start', 'end start'] })
  const titleY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120])
  const titleOpacity = useTransform(scrollYProgress, [0, 0.8], [1, reduce ? 1 : 0.2])
  const first = name.split(' ')[0]

  useEffect(() => {
    if (reduce) return
    const t = window.setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2400)
    return () => window.clearInterval(t)
  }, [reduce])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    el.querySelectorAll('[data-index]').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])

  return (
    <div ref={root} className="story" data-ready="true">
      {/* ------------------------------ abertura ------------------------------ */}
      <section className="story-open" ref={open}>
        <HeroDecor />
        <FloatingFruit name="morango" size={46} style={{ top: '18%', left: '9%' }} delay={0.4} duration={6} desktopOnly />
        <FloatingFruit name="laranja" size={58} style={{ top: '62%', left: '5%' }} delay={0.7} duration={8} />
        <FloatingFruit name="abacate" size={52} style={{ top: '22%', right: '8%' }} delay={0.55} duration={7} desktopOnly />
        <FloatingFruit name="banana" size={56} style={{ bottom: '14%', right: '11%' }} delay={0.85} duration={9} />
        <motion.div className="container story-open__inner" style={{ y: titleY, opacity: titleOpacity }}>
          <motion.span className="eyebrow" data-reveal="" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            Uma história sobre comer bem
          </motion.span>
          <motion.h1
            className="story-open__title"
            data-reveal=""
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          >
            Comer bem não precisa ser{' '}
            <span className="story-word" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={WORDS[word]}
                  className="story-word__item"
                  initial={{ opacity: 0, y: '0.6em', rotateX: -70 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  exit={{ opacity: 0, y: '-0.6em', rotateX: 70 }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  {WORDS[word]}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="story-open__dot">.</span>
          </motion.h1>
          <motion.p
            className="story-open__lead"
            data-reveal=""
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.35 }}
          >
            Esta é a história de muita gente que chega até aqui. Talvez seja a sua também.
          </motion.p>
          <motion.div
            className="row story-open__actions"
            data-reveal=""
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
          >
            <BookingLink to={booking} className="btn btn--primary btn--lg btn--fx btn--pulse">
              Agendar consulta
            </BookingLink>
            <a href="#historia" className="btn btn--lg btn--fx">
              Conhecer a história
            </a>
          </motion.div>
          <a href="#historia" className="story-scroll" aria-label="Rolar para a história">
            <span />
          </a>
        </motion.div>
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
              <StageFruits fruits={CHAPTERS[active].fruits} k={active} />
            </div>
          </div>

          <div className="story-texts">
            {CHAPTERS.map((c, i) => (
              <motion.article
                key={c.kicker}
                className={`story-chapter${active === i ? ' is-active' : ''}`}
                data-index={i}
                data-reveal=""
                initial={{ opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                <div className="story-chapter__mobile-scene" aria-hidden>
                  {i === 0 && <SceneClock on />}
                  {i === 1 && <SceneTries on />}
                  {i === 2 && <ScenePlate on />}
                  {i === 3 && <SceneProgress on />}
                  <span className="story-chapter__fruits">
                    {c.fruits.map((f) => (
                      <Fruit key={f} name={f} size={34} />
                    ))}
                  </span>
                </div>
                <span className="eyebrow">{c.kicker}</span>
                <h2>{c.title}</h2>
                <p>{c.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------- final ------------------------------- */}
      <section className="story-end">
        <FloatingFruit name="maca" size={44} style={{ top: '18%', left: '8%' }} duration={7} desktopOnly />
        <FloatingFruit name="uva" size={40} style={{ bottom: '16%', right: '9%' }} delay={0.3} duration={8} />
        <motion.div
          className="container"
          data-reveal=""
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <span className="eyebrow">Próximo capítulo</span>
          <h2>A sua história começa na primeira consulta.</h2>
          <p>
            Com {first}, você não recebe uma dieta pronta: constrói um jeito de comer que faz sentido para a sua vida. Cada pessoa evolui no seu
            tempo; não prometemos resultados garantidos, prometemos acompanhamento de verdade.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <BookingLink to={booking} className="btn btn--primary btn--lg btn--fx">
              Escrever o próximo capítulo
            </BookingLink>
            <a href={aboutHref} className="btn btn--lg btn--fx">
              Conhecer o {first}
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  )
}

/** Frutas que entram na cena a cada capítulo. */
function StageFruits({ fruits, k }: { fruits: FruitName[]; k: number }) {
  return (
    <AnimatePresence mode="popLayout">
      {fruits.map((f, i) => (
        <motion.span
          key={`${k}-${f}`}
          className={`stage-fruit stage-fruit--${i}`}
          initial={{ opacity: 0, scale: 0.2, rotate: -40, y: 30 }}
          animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.4, y: -20 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.15 + i * 0.15 }}
        >
          <Fruit name={f} size={52} />
        </motion.span>
      ))}
    </AnimatePresence>
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
  // Prato dividido: metade vegetais e frutas, um quarto proteína, um quarto carboidrato.
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
          Vegetais e frutas
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
