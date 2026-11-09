import type { Metadata } from 'next'
import Link from 'next/link'
import { noIndex } from '@/lib/seo'

export const metadata: Metadata = { title: 'Descadastro', robots: noIndex }

export default function UnsubscribedPage() {
  return (
    <main className="container" style={{ maxWidth: 560, padding: '64px 16px' }}>
      <div className="card stack">
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Pronto, você não vai mais receber o resumo por e-mail</h1>
        <p className="muted" style={{ margin: 0 }}>
          Os lembretes pelo app (notificações) continuam como estão. Se mudar de ideia, ligue de novo em Mais → Notificações.
        </p>
        <Link href="/paciente/notificacoes" className="btn btn--primary">
          Abrir minhas notificações
        </Link>
      </div>
    </main>
  )
}
