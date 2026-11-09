import Link from 'next/link'
import type { Metadata } from 'next'
import { noIndex } from '@/lib/seo'
import { findValidToken } from '@/lib/auth/reset'
import { enterWithMagicLink } from '@/actions/auth'
import { SubmitButton } from '@/components/form'

export const metadata: Metadata = { title: 'Entrar pelo link', robots: noIndex, referrer: 'no-referrer' }

/** Página do link mágico: confirma com um clique (o link sozinho não entra, para leitores de e-mail não gastarem o código). */
export default async function MagicLinkPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const row = sp.token ? await findValidToken(sp.token, ['link_magico']) : null
  if (sp.invalido || !row) {
    return (
      <div className="card stack">
        <h1 style={{ fontSize: '1.6rem' }}>Link inválido ou expirado</h1>
        <p className="muted" style={{ margin: 0 }}>
          O link de acesso vale por 15 minutos e só pode ser usado uma vez. Peça um novo na tela de entrada.
        </p>
        <Link href="/login" className="btn btn--primary btn--block">
          Voltar para Entrar
        </Link>
      </div>
    )
  }
  const masked = row.user.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2')
  return (
    <div className="card stack">
      <h1 style={{ fontSize: '1.6rem' }}>Entrar com o link</h1>
      <p className="muted" style={{ margin: 0 }}>
        Você vai entrar como <strong>{masked}</strong>.
      </p>
      <form action={enterWithMagicLink} className="stack">
        <input type="hidden" name="token" value={sp.token} />
        <input type="hidden" name="next" value={sp.next ?? ''} />
        <SubmitButton className="btn btn--primary btn--block" pendingText="Entrando…">
          Entrar
        </SubmitButton>
      </form>
    </div>
  )
}
