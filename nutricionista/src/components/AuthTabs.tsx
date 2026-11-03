import Link from 'next/link'

/** Abas "Entrar | Criar conta" no topo da tela de acesso. */
export function AuthTabs({ current, next }: { current: 'entrar' | 'criar'; next?: string | null }) {
  const q = next ? `?next=${encodeURIComponent(next)}` : ''
  return (
    <nav className="auth-tabs" aria-label="Acesso">
      <Link href={`/login${q}`} className="auth-tabs__tab" aria-current={current === 'entrar' ? 'page' : undefined}>
        Entrar
      </Link>
      <Link href={`/criar-conta${q}`} className="auth-tabs__tab" aria-current={current === 'criar' ? 'page' : undefined}>
        Criar conta
      </Link>
    </nav>
  )
}
