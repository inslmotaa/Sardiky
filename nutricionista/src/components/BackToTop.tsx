'use client'

import { useEffect, useState } from 'react'

/**
 * Botão "Voltar ao topo": aparece depois de 1,5 tela de rolagem, só enquanto a pessoa sobe a página
 * (some ao rolar para baixo, para não cobrir o texto que está sendo lido), e sobe suavemente
 * (instantâneo para quem prefere menos movimento). `place` ajusta a posição: no site ele fica numa
 * coluna com o botão do WhatsApp; na área do cliente, acima da barra de abas.
 */
export function BackToTop({ place = 'base' }: { place?: 'base' | 'site' | 'app' }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const on = () => {
      const y = window.scrollY
      const far = y > window.innerHeight * 1.5
      // Descendo: esconde. Subindo (ou parado longe do topo, ao abrir a página): mostra.
      if (!far) setShow(false)
      else if (y < last - 2) setShow(true)
      else if (y > last + 2) setShow(false)
      last = y
    }
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
