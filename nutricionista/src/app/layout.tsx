import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import { getSettings } from '@/lib/settings'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap', weight: ['500', '600'] })

// Todo o conteúdo vem do banco (configurações, serviços, agenda): sem pré-renderização estática.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  const title = `${s.professionalName} · ${s.professionalTitle}`
  return {
    title: { default: title, template: `%s · ${s.professionalName}` },
    description: s.bio.slice(0, 160),
    applicationName: s.professionalName,
    robots: { index: true, follow: true },
  }
}

export const viewport: Viewport = { themeColor: '#2f5d50', width: 'device-width', initialScale: 1 }

const HEX = /^#[0-9a-fA-F]{6}$/

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings()
  const brand = HEX.test(s.brandColor) ? s.brandColor : '#2f5d50'
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable}`}>
      <body style={{ ['--brand' as string]: brand }}>{children}</body>
    </html>
  )
}
