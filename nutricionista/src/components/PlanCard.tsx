'use client'

import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import type { ReactNode } from 'react'

/** Card de plano com leve inclinação (até 4°) seguindo o mouse e borda verde que acende. */
export function PlanCardLink({ children, featured }: { children: ReactNode; featured?: boolean }) {
  const reduce = useReducedMotion()
  const rx = useSpring(useMotionValue(0), { stiffness: 160, damping: 16 })
  const ry = useSpring(useMotionValue(0), { stiffness: 160, damping: 16 })
  return (
    <motion.article
      className={`plan plan--tilt${featured ? ' plan--featured' : ''}`}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== 'mouse') return
        const r = e.currentTarget.getBoundingClientRect()
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 8)
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
    >
      {children}
    </motion.article>
  )
}
