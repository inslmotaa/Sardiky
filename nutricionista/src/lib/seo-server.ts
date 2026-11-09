import 'server-only'
import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'
import { pageMeta } from '@/lib/seo'

/** pageMeta com o nome do site das configurações (Open Graph site_name). */
export async function sitePageMeta(o: Omit<Parameters<typeof pageMeta>[0], 'siteName'>): Promise<Metadata> {
  const s = await getSettings()
  return pageMeta({ ...o, siteName: s.siteName })
}
