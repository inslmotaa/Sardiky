import type { MetadataRoute } from 'next'
import { getSettings } from '@/lib/settings'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings()
  return {
    name: `${s.professionalName} · Área do paciente`,
    short_name: 'Área do paciente',
    start_url: '/paciente',
    display: 'standalone',
    background_color: '#f8f6f1',
    theme_color: s.brandColor,
    lang: 'pt-BR',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}
