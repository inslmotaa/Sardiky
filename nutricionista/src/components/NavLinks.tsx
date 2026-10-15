'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export type NavItem = { href: string; label: string; icon?: ReactNode; count?: number; exact?: boolean }

function isActive(path: string, item: NavItem) {
  return item.exact ? path === item.href : path === item.href || path.startsWith(item.href + '/')
}

/** Links com indicação da página atual (aria-current). */
export function NavLinks({ items, className }: { items: NavItem[]; className?: string }) {
  const path = usePathname()
  return (
    <>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={className} aria-current={isActive(path, it) ? 'page' : undefined}>
          {it.icon}
          <span>{it.label}</span>
          {it.count ? (
            <span className="count" aria-label={`${it.count} pendentes`}>
              {it.count}
            </span>
          ) : null}
        </Link>
      ))}
    </>
  )
}

/** Fecha o menu <details> ao navegar no celular. */
export function CloseOnNavigate({ children }: { children: ReactNode }) {
  const path = usePathname()
  return (
    <details className="mobile-menu" key={path}>
      {children}
    </details>
  )
}
