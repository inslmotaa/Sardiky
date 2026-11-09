/**
 * Pixels de anúncio (Meta e Google) — regras puras, testadas em tests/unit/pixels.test.ts.
 *
 * Desligados por padrão. Só carregam quando: a chave está ligada no painel, há um ID válido,
 * a página é do site público e o visitante aceitou os cookies de medição. A política de
 * segurança (CSP, em next.config.ts) libera os domínios dos pixels só nessas mesmas páginas e
 * só para quem tem o cookie de consentimento "aceito".
 */

/** Cookie com a escolha do visitante: "aceito" ou "recusado". */
export const CONSENT_COOKIE = 'farion-consent'
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180 // 6 meses

/** ID do pixel da Meta (Facebook/Instagram): só números. */
export const META_PIXEL_ID = /^\d{8,20}$/
/** Tag do Google (gtag.js): Google Analytics 4 (G-...) ou Google Ads (AW-...). */
export const GOOGLE_TAG_ID = /^(G|AW)-[A-Z0-9]{4,20}$/

export type PixelConfig = { meta: string | null; google: string | null }

/** Pixels ativos (ligados e com ID válido); null quando nenhum deve carregar. */
export function activePixels(s: { pixelsEnabled: boolean; metaPixelId: string; googleTagId: string }): PixelConfig | null {
  if (!s.pixelsEnabled) return null
  const meta = META_PIXEL_ID.test(s.metaPixelId.trim()) ? s.metaPixelId.trim() : null
  const google = GOOGLE_TAG_ID.test(s.googleTagId.trim().toUpperCase()) ? s.googleTagId.trim().toUpperCase() : null
  return meta || google ? { meta, google } : null
}

/** Páginas do site público onde os pixels podem rodar (nunca painel, área do cliente ou login). */
export const PUBLIC_SITE_PATHS = ['/', '/sobre', '/como-funciona', '/planos', '/conteudos', '/duvidas', '/agendar', '/privacidade'] as const

export function isPublicSitePath(path: string): boolean {
  const p = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  if ((PUBLIC_SITE_PATHS as readonly string[]).includes(p)) return true
  return /^\/conteudos\/[a-z0-9-]+$/.test(p)
}

/** Domínios que cada pixel usa (para a CSP). */
export const PIXEL_CSP = {
  script: ['https://connect.facebook.net', 'https://www.googletagmanager.com'],
  img: ['https://www.facebook.com', 'https://www.google-analytics.com', 'https://www.googletagmanager.com', 'https://googleads.g.doubleclick.net', 'https://www.google.com'],
  connect: [
    'https://www.facebook.com',
    'https://connect.facebook.net',
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com',
    'https://analytics.google.com',
    'https://www.googletagmanager.com',
    'https://googleads.g.doubleclick.net',
    'https://www.google.com',
  ],
  frame: ['https://www.googletagmanager.com', 'https://td.doubleclick.net'],
} as const
