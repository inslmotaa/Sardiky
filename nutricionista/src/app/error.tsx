'use client'

import Link from 'next/link'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const forbidden = error.message === 'Acesso não autorizado'
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 520 }}>
        <h1>{forbidden ? 'Acesso não autorizado' : 'Algo deu errado'}</h1>
        <p className="muted">
          {forbidden
            ? 'Você não tem permissão para ver este conteúdo.'
            : 'Não foi possível carregar esta página. Tente novamente; se o problema continuar, avise o consultório.'}
          {error.digest && <span className="small"> Código: {error.digest}</span>}
        </p>
        <div className="row">
          <button className="btn btn--primary" onClick={reset} type="button">
            Tentar novamente
          </button>
          <Link href="/" className="btn">
            Início
          </Link>
        </div>
      </div>
    </main>
  )
}
