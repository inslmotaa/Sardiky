/**
 * Origem da visita (UTM) para os interessados — regras puras, testadas em tests/unit/utm.test.ts.
 * Guarda só o necessário para saber de onde veio o contato: parâmetros utm_*, a página de
 * entrada (sem a query) e o domínio de quem indicou (sem o endereço completo).
 */

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
export type UtmKey = (typeof UTM_KEYS)[number]

export type Origin = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
  landingPath: string | null
  referrer: string | null
}

const FIELD: Record<UtmKey, keyof Origin> = {
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
  utm_term: 'utmTerm',
}

/** Valor curto e limpo (sem caracteres de controle, até 100 caracteres); vazio vira null. */
export function cleanValue(v: unknown, max = 100): string | null {
  if (typeof v !== 'string') return null
  const t = v
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
  return t || null
}

/** Caminho interno sem query nem fragmento ("/conteudos/x?utm=..." → "/conteudos/x"). */
export function cleanPath(v: unknown): string | null {
  const t = cleanValue(v, 300)
  if (!t || !t.startsWith('/') || t.startsWith('//')) return null
  return t.split(/[?#]/)[0] || '/'
}

/** Só o domínio de quem indicou ("https://l.instagram.com/?u=..." → "l.instagram.com"); o próprio site não conta. */
export function cleanReferrer(v: unknown, ownHost?: string): string | null {
  const t = cleanValue(v, 500)
  if (!t) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const host = u.hostname.toLowerCase()
    if (ownHost && host === ownHost.toLowerCase()) return null
    return host.slice(0, 120)
  } catch {
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t) && (!ownHost || t.toLowerCase() !== ownHost.toLowerCase()) ? t.toLowerCase().slice(0, 120) : null
  }
}

/** Lê os utm_* de uma query string ("?utm_source=instagram&..."). */
export function utmFromSearch(search: string): Partial<Record<UtmKey, string>> {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const out: Partial<Record<UtmKey, string>> = {}
  for (const k of UTM_KEYS) {
    const v = cleanValue(q.get(k))
    if (v) out[k] = v
  }
  return out
}

/** Origem a gravar no interessado, a partir dos campos ocultos do formulário (tudo revalidado aqui). */
export function originFromForm(o: Record<string, unknown>, ownHost?: string): Origin {
  const origin: Origin = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, landingPath: null, referrer: null }
  for (const k of UTM_KEYS) origin[FIELD[k]] = cleanValue(o[k])
  origin.landingPath = cleanPath(o.landing_path)
  origin.referrer = cleanReferrer(o.referrer, ownHost)
  return origin
}

/** Resumo legível da origem para o painel ("instagram / stories · campanha verao"). */
export function originLabel(l: Pick<Origin, 'utmSource' | 'utmMedium' | 'utmCampaign' | 'referrer'>): string | null {
  const parts: string[] = []
  if (l.utmSource || l.utmMedium) parts.push([l.utmSource, l.utmMedium].filter(Boolean).join(' / '))
  if (l.utmCampaign) parts.push(`campanha ${l.utmCampaign}`)
  if (!parts.length && l.referrer) parts.push(`via ${l.referrer}`)
  return parts.length ? parts.join(' · ') : null
}
