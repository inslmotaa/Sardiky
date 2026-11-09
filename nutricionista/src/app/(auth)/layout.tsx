import type { Metadata } from 'next'
import Link from 'next/link'
import '../(site)/site.css'
import { getSettings } from '@/lib/settings'
import { SiteBrand } from '@/components/SiteChrome'
import { AuthAside } from '@/components/AuthAside'
import { BackToTop } from '@/components/BackToTop'
import { noIndex } from '@/lib/seo'

/**
 * Tela de acesso (entrar, criar conta e senha), separada do site: painel verde com o que há
 * na área do cliente e no painel do coach, e o formulário ao lado. No celular, um embaixo do outro.
 */
/** Entrar, criar conta e recuperar senha: fora do índice dos buscadores. */
export const metadata: Metadata = { robots: noIndex }

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings()
  return (
    <main className="tl tl-auth">
      <div className="tl-auth__shell">
        <div className="tl-auth__side">
          <div className="tl-auth__brand">
            <SiteBrand name={s.siteName} logoFileId={s.logoFileId} />
          </div>
          <AuthAside siteName={s.siteName} professional={s.professionalName} />
        </div>
        <div className="tl-auth__box stack">
          {children}
          <Link href="/" className="pill pill--block tl-auth__back">
            <span aria-hidden>←</span> Voltar para a página principal
          </Link>
          <p className="tl-auth__foot">
            <Link href="/privacidade">Privacidade</Link>
          </p>
        </div>
      </div>
      <BackToTop />
    </main>
  )
}
