import type { MetadataRoute } from 'next'
import { NO_INDEX_PATHS, siteUrl } from '@/lib/seo'

// O endereço vem de APP_URL na hora do pedido (o mesmo build serve prévia e produção).
export const dynamic = 'force-dynamic'

/** robots.txt: site público liberado; painel, área do cliente, autenticação e API fora do índice. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: { userAgent: '*', allow: '/', disallow: [...NO_INDEX_PATHS] },
    sitemap: `${base}/sitemap.xml`,
  }
}
