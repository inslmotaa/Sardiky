'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Nome no estilo do site (largo, com o traço verde) e o logo, quando houver: um único link para a página principal.
 * Já na página principal, rola suavemente até o topo (instantâneo para quem prefere menos movimento).
 */
export function Brand({ name, sub, logoFileId }: { name: string; sub?: string | null; logoFileId?: string | null }) {
  const pathname = usePathname()
  return (
    <Link
      href="/"
      className="brand"
      aria-label="Ir para a página inicial"
      onClick={(e) => {
        if (pathname !== '/') return
        e.preventDefault()
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
        if (window.location.hash) history.replaceState(null, '', '/')
      }}
    >
      {logoFileId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="brand__logo" src={`/arquivos/${logoFileId}`} alt="" />
      )}
      <span className="brand__name">
        <span className="brand__title">
          {name}
          <span className="brand__dash" aria-hidden />
        </span>
        {sub && <span className="brand__sub">{sub}</span>}
      </span>
    </Link>
  )
}
