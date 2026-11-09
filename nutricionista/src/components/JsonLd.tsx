import { ldJson } from '@/lib/jsonld'

/** Dados estruturados (schema.org). O conteúdo é JSON escapado, nunca HTML de usuário. */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />
}
