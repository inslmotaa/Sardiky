import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { getSettings } from '@/lib/settings'
import { THEME_COOKIE, themeAttr } from '@/lib/tema'
import { clip, siteUrl } from '@/lib/seo'
// Fontes empacotadas no projeto (não dependem de download do Google no build).
import '@fontsource-variable/inter'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/geist-mono'
import './globals.css'
import './app-theme.css'
import './dark-theme.css'

// Todo o conteúdo vem do banco (configurações, serviços, agenda): sem pré-renderização estática.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  const title = `${s.siteName} · ${s.professionalName}, ${s.professionalTitle}`
  const description = clip(s.bio)
  return {
    // Endereço público (APP_URL): base de canonical, Open Graph e imagens.
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s · ${s.siteName}` },
    description,
    applicationName: s.siteName,
    // Padrões de compartilhamento; cada página pública troca título, descrição e endereço.
    openGraph: { type: 'website', locale: 'pt_BR', siteName: s.siteName, title, description },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
    // App instalável: ícone na tela inicial do iPhone e barra de status integrada.
    appleWebApp: { capable: true, title: s.siteName, statusBarStyle: 'default' },
    icons: { icon: '/icon.svg', apple: '/icons/apple-touch-icon.png' },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1f5e3b' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1512' },
  ],
  width: 'device-width',
  initialScale: 1,
}

const HEX = /^#[0-9a-fA-F]{6}$/

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings()
  const brand = HEX.test(s.brandColor) ? s.brandColor : '#1f5e3b'
  // Aparência escolhida no app (cookie); sem escolha, segue o modo do aparelho (prefers-color-scheme).
  const theme = themeAttr((await cookies()).get(THEME_COOKIE)?.value)
  return (
    <html lang="pt-BR" data-theme={theme}>
      <body style={{ ['--brand-custom' as string]: brand }}>{children}</body>
    </html>
  )
}
