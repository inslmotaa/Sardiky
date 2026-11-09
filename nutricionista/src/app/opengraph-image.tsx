import { OG_ALT, OG_SIZE, ogImage } from '@/lib/og'

// Lê nome e cor do site nas configurações.
export const dynamic = 'force-dynamic'
export const alt = OG_ALT
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return ogImage()
}
