import type { MetadataRoute } from 'next'
import { getSettings } from '@/lib/settings'

// Lê as configurações do banco a cada pedido (não é pré-gerado no build).
export const dynamic = 'force-dynamic'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings()
  return {
    id: '/paciente',
    name: `${s.professionalName} · Nutrição`,
    short_name: s.professionalName.split(' ').slice(0, 2).join(' '),
    description: 'Seu plano alimentar, diário, água e conversa com o nutricionista.',
    start_url: '/paciente',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f6f1',
    theme_color: s.brandColor,
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcuts: [
      { name: 'Hoje', url: '/paciente' },
      { name: 'Plano alimentar', url: '/paciente/plano' },
      { name: 'Diário', url: '/paciente/diario' },
    ],
  }
}
