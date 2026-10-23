'use client'

import { motion, MotionConfig, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

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

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}
const item: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
}

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
