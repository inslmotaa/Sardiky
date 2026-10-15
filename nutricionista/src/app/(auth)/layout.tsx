import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { Brand } from '@/components/Brand'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings()
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }} className="stack">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Brand name={s.professionalName} sub={s.professionalTitle} logoFileId={s.logoFileId} />
        </div>
        {children}
        <p className="muted small" style={{ textAlign: 'center' }}>
          <Link href="/">Voltar ao site</Link> · <Link href="/privacidade">Privacidade</Link>
        </p>
      </div>
    </main>
  )
}
