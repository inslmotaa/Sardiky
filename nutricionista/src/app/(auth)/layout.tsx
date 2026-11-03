import Link from 'next/link'
import '../(site)/site.css'
import { getSettings } from '@/lib/settings'
import { SiteBrand } from '@/components/SiteChrome'

/** Entrar, criar conta e senha: mesmo visual do site (branco e verde, nome com o traço). */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings()
  return (
    <main className="tl tl-auth">
      <div className="tl-auth__box stack">
        <div className="tl-auth__brand">
          <SiteBrand name={s.siteName} logoFileId={s.logoFileId} />
        </div>
        {children}
        <Link href="/" className="pill pill--block tl-auth__back">
          <span aria-hidden>←</span> Voltar para a página principal
        </Link>
        <p className="tl-auth__foot">
          <Link href="/privacidade">Privacidade</Link>
        </p>
      </div>
    </main>
  )
}
