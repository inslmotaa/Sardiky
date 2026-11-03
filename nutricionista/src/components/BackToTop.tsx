'use client'

import { useEffect, useState } from 'react'

/**
 * Botão "Voltar ao topo": aparece depois de rolar um pouco e sobe a página suavemente
 * (instantâneo para quem prefere menos movimento). `place` ajusta a altura para não cobrir
 * o botão do WhatsApp (site) nem a barra de abas (área do cliente).
 */
export function BackToTop({ place = 'base' }: { place?: 'base' | 'site' | 'app' }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const on = () => setShow(window.scrollY > 480)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <button
      type="button"
      className={`back-to-top back-to-top--${place} no-print`}
      data-show={show ? 'true' : undefined}
      aria-hidden={show ? undefined : true}
      tabIndex={show ? 0 : -1}
      onClick={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
        document.querySelector<HTMLElement>('#conteudo, main')?.focus({ preventScroll: true })
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <span>Voltar ao topo</span>
    </button>
  )
}
