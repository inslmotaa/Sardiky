import Link from 'next/link'

export default function NotFound() {
  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 480, textAlign: 'center' }}>
        <h1>Página não encontrada</h1>
        <p className="muted">O endereço pode ter mudado ou o conteúdo não está disponível para o seu acesso.</p>
        <Link href="/" className="btn btn--primary">
          Ir para o início
        </Link>
      </div>
    </main>
  )
}
