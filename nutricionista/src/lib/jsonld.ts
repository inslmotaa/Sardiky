/**
 * Dados estruturados (schema.org em JSON-LD) do site público, puros e testados em
 * tests/unit/jsonld.test.ts. Só entram dados reais: WhatsApp, Instagram e foto vazios
 * (ou de exemplo) ficam de fora.
 */
import { onlyDigits, whatsappLink } from '@/lib/format'
import { instagramLink } from '@/lib/social'
import { clip } from '@/lib/seo'

type SiteData = {
  siteName: string
  professionalName: string
  professionalTitle: string
  bio: string
  specialties: string[]
  whatsapp: string | null
  instagram: string | null
  photoFileId: string | null
}

type Json = Record<string, unknown>

const ids = (base: string) => ({ person: `${base}/#coach`, service: `${base}/#consultoria`, site: `${base}/#site` })

/** Pessoa: o André, com o título Coach. */
export function personLd(s: SiteData, base: string): Json {
  const ig = instagramLink(s.instagram)
  return {
    '@type': 'Person',
    '@id': ids(base).person,
    name: s.professionalName,
    jobTitle: s.professionalTitle,
    ...(s.bio.trim() ? { description: clip(s.bio, 300) } : {}),
    url: `${base}/sobre`,
    ...(s.photoFileId ? { image: `${base}/arquivos/${s.photoFileId}` } : {}),
    ...(s.specialties.length ? { knowsAbout: s.specialties } : {}),
    ...(ig ? { sameAs: [ig.url] } : {}),
    worksFor: { '@id': ids(base).service },
  }
}

/** Serviço profissional: consultoria on-line, com WhatsApp e Instagram quando preenchidos. */
export function serviceLd(s: SiteData, base: string): Json {
  const ig = instagramLink(s.instagram)
  const digits = onlyDigits(s.whatsapp ?? '')
  const wa = whatsappLink(s.whatsapp)
  return {
    '@type': 'ProfessionalService',
    '@id': ids(base).service,
    name: `${s.siteName} · ${s.professionalName}, ${s.professionalTitle}`,
    description: `Acompanhamento on-line de alimentação, rotina e bem-estar com ${s.professionalName}, ${s.professionalTitle}.`,
    url: `${base}/`,
    image: `${base}/opengraph-image`,
    founder: { '@id': ids(base).person },
    employee: { '@id': ids(base).person },
    // Atendimento 100% on-line, sem endereço físico.
    areaServed: { '@type': 'Country', name: 'Brasil' },
    availableChannel: {
      '@type': 'ServiceChannel',
      name: 'Atendimento on-line (videochamada e app)',
      serviceUrl: `${base}/agendar`,
      ...(digits ? { servicePhone: { '@type': 'ContactPoint', telephone: `+${digits}` } } : {}),
    },
    ...(s.specialties.length ? { serviceType: s.specialties } : {}),
    ...(digits && wa ? { telephone: `+${digits}`, contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', telephone: `+${digits}`, url: wa, availableLanguage: 'pt-BR' } } : {}),
    ...(ig ? { sameAs: [ig.url] } : {}),
    knowsLanguage: 'pt-BR',
  }
}

/** Grafo da página inicial: site, pessoa e serviço. */
export function homeLd(s: SiteData, base: string): Json {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': ids(base).site, url: `${base}/`, name: s.siteName, inLanguage: 'pt-BR', publisher: { '@id': ids(base).person } },
      personLd(s, base),
      serviceLd(s, base),
    ],
  }
}

/** Página Sobre: perfil da pessoa. */
export function aboutLd(s: SiteData, base: string): Json {
  return { '@context': 'https://schema.org', '@type': 'ProfilePage', url: `${base}/sobre`, inLanguage: 'pt-BR', mainEntity: personLd(s, base) }
}

/** Perguntas frequentes (FAQPage) a partir das dúvidas publicadas no painel; null se não houver nenhuma. */
export function faqLd(faqs: { question: string; answer: string }[], base: string): Json | null {
  const items = faqs.filter((f) => f.question.trim() && f.answer.trim())
  if (!items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: `${base}/duvidas`,
    inLanguage: 'pt-BR',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.question.trim(), acceptedAnswer: { '@type': 'Answer', text: f.answer.trim() } })),
  }
}

/** Post dos Conteúdos (BlogPosting). */
export function postLd(
  p: { slug: string; title: string; summary: string; publishedOn: string; updatedAt: Date; coverFileId: string | null },
  s: SiteData,
  base: string,
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.title,
    ...(p.summary ? { description: clip(p.summary, 300) } : {}),
    url: `${base}/conteudos/${p.slug}`,
    mainEntityOfPage: `${base}/conteudos/${p.slug}`,
    datePublished: p.publishedOn,
    dateModified: p.updatedAt.toISOString(),
    inLanguage: 'pt-BR',
    image: p.coverFileId ? `${base}/arquivos/${p.coverFileId}` : `${base}/opengraph-image`,
    author: { '@type': 'Person', name: s.professionalName, jobTitle: s.professionalTitle, url: `${base}/sobre` },
    publisher: { '@type': 'Person', name: s.professionalName, url: `${base}/` },
  }
}

/** JSON seguro dentro de <script>: "<" vira < (nada fecha a tag nem abre comentário). */
export function ldJson(data: Json): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
