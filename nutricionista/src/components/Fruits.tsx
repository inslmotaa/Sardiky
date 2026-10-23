'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { CSSProperties } from 'react'

/** Frutas em SVG (desenho próprio, leve) usadas no storytelling e no fundo do site. */
export type FruitName = 'maca' | 'laranja' | 'morango' | 'abacate' | 'banana' | 'uva' | 'limao' | 'folha'

export function Fruit({ name, size = 56, className, style }: { name: FruitName; size?: number; className?: string; style?: CSSProperties }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64', className, style, 'aria-hidden': true } as const
  switch (name) {
    case 'maca':
      return (
        <svg {...common}>
          <path d="M32 18c-6-6-20-4-22 10-2 13 7 28 15 28 3 0 5-2 7-2s4 2 7 2c8 0 17-15 15-28-2-14-16-16-22-10z" fill="#e5484d" />
          <path d="M22 26c-3 3-4 8-3 12" stroke="#fff" strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M32 18c0-5 2-9 6-11" stroke="#6b4a2b" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M35 12c5-5 11-4 13-2-3 5-9 6-13 2z" fill="#4caf6e" />
        </svg>
      )
    case 'laranja':
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="24" fill="#f7a53b" />
          <circle cx="32" cy="32" r="19" fill="#ffd27a" />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d="M32 32 L32 14" stroke="#f7a53b" strokeWidth="2.5" transform={`rotate(${i * 45} 32 32)`} />
          ))}
          <circle cx="32" cy="32" r="3" fill="#fff4d6" />
        </svg>
      )
    case 'morango':
      return (
        <svg {...common}>
          <path d="M32 58C18 48 10 34 14 24c3-7 11-8 18-5 7-3 15-2 18 5 4 10-4 24-18 34z" fill="#e8394d" />
          {[
            [24, 30],
            [32, 28],
            [40, 30],
            [27, 39],
            [37, 39],
            [32, 47],
          ].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="1.4" ry="2" fill="#ffe08a" />
          ))}
          <path d="M20 20c4-2 8-2 12 1 4-3 8-3 12-1-3 4-7 5-12 4-5 1-9 0-12-4z" fill="#3fa05d" />
          <path d="M32 21v-8" stroke="#3fa05d" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )
    case 'abacate':
      return (
        <svg {...common}>
          <path d="M32 6c-10 0-14 14-18 24-5 13 4 28 18 28s23-15 18-28C46 20 42 6 32 6z" fill="#3e7d3a" />
          <path d="M32 11c-7 0-11 12-14 20-4 10 3 22 14 22s18-12 14-22c-3-8-7-20-14-20z" fill="#cfe58a" />
          <circle cx="32" cy="38" r="9" fill="#8a5a33" />
          <circle cx="29" cy="35" r="2.5" fill="#b07a4c" />
        </svg>
      )
    case 'banana':
      return (
        <svg {...common}>
          <path d="M10 18c2 22 18 36 42 34 3 0 4-3 1-4-18-2-30-14-34-32-1-3-9-2-9 2z" fill="#ffd84d" />
          <path d="M14 22c4 16 16 26 34 28" stroke="#e8b923" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M10 18l-2-6 5-1 2 6z" fill="#6b4a2b" />
        </svg>
      )
    case 'uva':
      return (
        <svg {...common}>
          {[
            [24, 22],
            [34, 22],
            [44, 22],
            [29, 31],
            [39, 31],
            [24, 40],
            [34, 40],
            [29, 49],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="6" fill={i % 2 ? '#7b3fa0' : '#9455bd'} />
          ))}
          <path d="M34 16v-8" stroke="#6b4a2b" strokeWidth="3" strokeLinecap="round" />
          <path d="M35 10c6-4 12-2 14 1-5 4-10 3-14-1z" fill="#4caf6e" />
        </svg>
      )
    case 'limao':
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="24" fill="#9bd36a" />
          <circle cx="32" cy="32" r="19" fill="#e6f7b8" />
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d="M32 32 L32 14" stroke="#9bd36a" strokeWidth="2.5" transform={`rotate(${i * 60} 32 32)`} />
          ))}
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path d="M8 56C8 28 26 8 58 6c-2 30-20 50-50 50z" fill="var(--verde-claro)" />
          <path d="M10 54C24 40 36 26 54 10" stroke="var(--verde-escuro)" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".55" />
        </svg>
      )
  }
}

/** Fruta que flutua devagar (parada para quem prefere menos movimento). */
export function FloatingFruit({
  name,
  size = 56,
  style,
  delay = 0,
  duration = 7,
  className = 'fruit-float',
  desktopOnly = false,
}: {
  name: FruitName
  size?: number
  style?: CSSProperties
  delay?: number
  duration?: number
  className?: string
  /** Escondida no celular, onde ficaria por cima do texto. */
  desktopOnly?: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      className={desktopOnly ? `${className} fruit-float--desktop` : className}
      style={style}
      aria-hidden
      data-reveal=""
      initial={{ opacity: 0, scale: 0.4, rotate: -20 }}
      animate={reduce ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 1, scale: 1, rotate: [0, 8, -6, 0], y: [0, -14, 6, 0] }}
      transition={
        reduce
          ? { duration: 0.4 }
          : {
              opacity: { duration: 0.6, delay },
              scale: { duration: 0.6, delay, type: 'spring', stiffness: 160, damping: 12 },
              rotate: { duration, delay, repeat: Infinity, ease: 'easeInOut' },
              y: { duration, delay, repeat: Infinity, ease: 'easeInOut' },
            }
      }
    >
      <Fruit name={name} size={size} />
    </motion.span>
  )
}
