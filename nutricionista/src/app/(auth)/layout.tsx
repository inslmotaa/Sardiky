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
          <SiteBrand name={s.professionalName} logoFileId={s.logoFileId} />
        </div>
        {children}
        <p className="tl-auth__foot">
          <Link href="/">Voltar ao site</Link> · <Link href="/privacidade">Privacidade</Link>
        </p>
      </div>
    </main>
  )
}
