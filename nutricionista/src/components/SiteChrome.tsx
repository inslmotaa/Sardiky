'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

/** Cabeçalho fixo: ganha fundo com desfoque e sombra depois que a página rola. */
export function HeaderScrollWatcher({ target }: { target: string }) {
  useEffect(() => {
    const el = document.getElementById(target)
    if (!el) return
    const onScroll = () => el.toggleAttribute('data-scrolled', window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [target])
  return null
}

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
          <button type="submit">
            Sair
          </button>
        </form>
      </div>
    </details>
  )
}
