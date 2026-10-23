'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { SITE_NAV } from '@/lib/constants'
import { initSiteFx } from '@/lib/site-fx'

/** Avatar com menu (Minha área / Sair) no lugar de "Entrar" quando há sessão. */
export function UserMenu({ name, area, logout }: { name: string; area: string; logout: () => Promise<void> }) {
  const ref = useRef<HTMLDetailsElement>(null)
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  useEffect(() => {
    // Fecha ao clicar fora.
    const onDoc = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])
  return (
    <details className="user-menu" ref={ref}>
      <summary aria-label={`Conta de ${name}`}>
        <span className="avatar" aria-hidden>
          {initials}
        </span>
      </summary>
      <div className="user-menu__panel">
        <p className="user-menu__name">{name}</p>
        <Link href={area} onClick={() => ref.current?.removeAttribute('open')}>
          Minha área
        </Link>
        <form action={logout}>
          <button type="submit">Sair</button>
        </form>
      </div>
    </details>
  )
}

/** Links do menu principal (seções da página inicial), no estilo "/ Sobre". */
export function SiteNavLinks({ className }: { className?: string }) {
  return (
    <>
      {SITE_NAV.map((n) => (
        <Link key={n.href} href={n.href} className={className}>
          <span aria-hidden>/ </span>
          {n.label}
        </Link>
      ))}
    </>
  )
}

/** Nome pequeno com o traço verde: leva ao início (já no início, rola suavemente até o topo). */
export function SiteBrand({ name, logoFileId }: { name: string; logoFileId?: string | null }) {
  const pathname = usePathname()
  return (
    <Link
      href="/"
      className="tl-brand"
      aria-label={`${name}: ir para a página inicial`}
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
        <img className="tl-brand__logo" src={`/arquivos/${logoFileId}`} alt="" />
      )}
      <span>{name}</span>
      <span className="tl-brand__dash" aria-hidden />
    </Link>
  )
}

/** Liga os efeitos do site (fundo líquido, nome, storytelling, entradas) a cada página. */
export function SiteFx() {
  const pathname = usePathname()
  useEffect(() => initSiteFx(document), [pathname])
  return null
}

/** Menu do celular: abre por cima da página e fecha ao escolher um item. */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  const pathname = usePathname()
  useEffect(() => {
    ref.current?.removeAttribute('open')
  }, [pathname])
  return (
    <details className="site-menu" ref={ref}>
      <summary aria-label="Abrir menu">Menu</summary>
      <div className="site-menu__panel" onClick={(e) => (e.target as HTMLElement).closest('a') && ref.current?.removeAttribute('open')}>
        {children}
      </div>
    </details>
  )
}
