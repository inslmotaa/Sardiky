'use client'

import { animate, motion, MotionConfig, useInView, useMotionValue, useReducedMotion, useSpring, useTransform, type Variants } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Animações do site (framer-motion). Tudo respeita "reduzir movimento" do sistema:
 * com ele ativo, só o fade permanece e os loops/parallax ficam desligados.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

const EASE = [0.22, 1, 0.36, 1] as const

/** Seção que aparece com fade + subida ao entrar na tela (uma vez). */
export function FadeUp({ children, className, delay = 0, id }: { children: ReactNode; className?: string; delay?: number; id?: string }) {
  return (
    <motion.div
      id={id}
      className={className}
      data-reveal=""
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }
const item: Variants = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }

/** Grupo de cards com entrada em sequência (0,1 s entre cada um). */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
      {children}
    </motion.div>
  )
}
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={item} data-reveal="">
      {children}
    </motion.div>
  )
}

/** Título que entra palavra por palavra. */
export function WordsTitle({ text, className }: { text: string; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean)
  return (
    <h1 className={className} aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          aria-hidden
          className="word"
          data-reveal=""
          initial={{ opacity: 0, y: '0.55em' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 + i * 0.09 }}
        >
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </h1>
  )
}

/** Contador que sobe até o número ao aparecer na tela. */
export function CountUp({ to, prefix = '', suffix = '' }: { to: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!inView) return
    if (reduce) {
      setValue(to)
      return
    }
    const c = animate(0, to, { duration: 1.6, ease: EASE, onUpdate: (v) => setValue(Math.round(v)) })
    return () => c.stop()
  }, [inView, reduce, to])
  return (
    <span ref={ref} aria-label={`${prefix}${to.toLocaleString('pt-BR')}${suffix}`}>
      <span aria-hidden>
        {prefix}
        {value.toLocaleString('pt-BR')}
        {suffix}
      </span>
    </span>
  )
}

/** Fundo do hero: formas verdes desfocadas (CSS, loop lento) e folhas/alimentos com parallax leve do mouse. */
export function HeroDecor() {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 40, damping: 18 })
  const sy = useSpring(y, { stiffness: 40, damping: 18 })
  const far = { x: useTransform(sx, (v) => v * 10), y: useTransform(sy, (v) => v * 10) }
  const near = { x: useTransform(sx, (v) => v * -22), y: useTransform(sy, (v) => v * -22) }
  useEffect(() => {
    // Só no computador (mouse) e sem "reduzir movimento".
    if (reduce || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const onMove = (e: MouseEvent) => {
      x.set(e.clientX / window.innerWidth - 0.5)
      y.set(e.clientY / window.innerHeight - 0.5)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [reduce, x, y])
  return (
    <div className="hero-decor" aria-hidden>
      <span className="blob blob--1" />
      <span className="blob blob--2" />
      <span className="blob blob--3" />
      <motion.div className="float-layer" style={far}>
        <Leaf className="floaty floaty--1" />
        <Citrus className="floaty floaty--2" />
      </motion.div>
      <motion.div className="float-layer" style={near}>
        <Leaf className="floaty floaty--3" />
        <Leaf className="floaty floaty--4" />
        <Berry className="floaty floaty--5" />
      </motion.div>
    </div>
  )
}

function Leaf({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" width="64" height="64">
      <path d="M8 56C8 28 26 8 58 6c-2 30-20 50-50 50z" fill="var(--verde-claro)" opacity=".85" />
      <path d="M10 54C24 40 36 26 54 10" stroke="var(--verde-escuro)" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".55" />
    </svg>
  )
}
function Citrus({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" width="56" height="56">
      <circle cx="32" cy="32" r="26" fill="#f4e7a1" stroke="var(--verde-claro)" strokeWidth="4" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M32 32 L32 10" stroke="#e7d26b" strokeWidth="3" transform={`rotate(${i * 45} 32 32)`} strokeLinecap="round" />
      ))}
    </svg>
  )
}
function Berry({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" width="44" height="44">
      <circle cx="26" cy="38" r="14" fill="var(--verde-principal)" opacity=".8" />
      <circle cx="40" cy="34" r="12" fill="var(--verde-claro)" opacity=".9" />
      <path d="M33 22c2-8 8-12 14-12" stroke="var(--verde-escuro)" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}
