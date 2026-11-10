import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { todayIn } from '@/lib/time'
import { startWhatsApp } from '@/lib/format'
import { postBySlug } from '@/lib/posts'
import { dataPost, postVisivel, SLUG } from '@/lib/conteudos'
import { plainText, readingMinutes } from '@/lib/markdown'
import { postLd } from '@/lib/jsonld'
import { noIndex, siteUrl } from '@/lib/seo'
import { sitePageMeta } from '@/lib/seo-server'
import { Markdown } from '@/components/Markdown'
import { JsonLd } from '@/components/JsonLd'
import { PostCta } from '@/components/PostCta'

type Props = { params: Promise<{ slug: string }> }

/**
 * Post visível para o público (publicado e com data até hoje). A equipe com permissão "site"
 * também vê rascunhos e agendados, como pré-visualização fora do índice.
 */
async function load(slug: string) {
  if (!SLUG.test(slug)) return null
  const [p, s, user] = await Promise.all([postBySlug(slug), getSettings(), getCurrentUser()])
  if (!p) return null
  const visible = postVisivel(p, todayIn(s.timezone))
  if (visible) return { p, s, user, preview: false }
  if (user && user.role !== 'patient' && can(user, 'site')) return { p, s, user, preview: true }
  return null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load((await params).slug)
  if (!r) return { title: 'Conteúdo não encontrado', robots: noIndex }
  const { p } = r
  const meta = await sitePageMeta({
    title: p.title,
    description: p.summary || plainText(p.body),
    path: `/conteudos/${p.slug}`,
    type: 'article',
    publishedTime: p.publishedOn,
    ...(p.coverFileId ? { image: { url: `/arquivos/${p.coverFileId}`, alt: p.coverAlt || p.title } } : {}),
  })
  return r.preview ? { ...meta, robots: noIndex } : meta
}

export default async function PostPage({ params }: Props) {
  const r = await load((await params).slug)
  if (!r) notFound()
  const { p, s, user, preview } = r
  return (
    <>
      {!preview && <JsonLd data={postLd(p, s, siteUrl())} />}
      <article className="post">
        <header className="tl-pagehead post__head">
          <div className="tl-container post__narrow">
            {preview && (
              <p className="alert alert--warn" role="note">
                Pré-visualização: {p.status === 'rascunho' ? 'este conteúdo é um rascunho' : `publicação agendada para ${dataPost(p.publishedOn)}`} e não aparece para o público.
              </p>
            )}
            <p className="sec-label">
              <Link href="/conteudos">/ CONTEÚDOS</Link>
            </p>
            <h1 className="display">{p.title}</h1>
            {p.summary && <p className="tl-lead">{p.summary}</p>}
            <p className="post__meta">
              {s.professionalName} · {s.professionalTitle} · <time dateTime={p.publishedOn}>{dataPost(p.publishedOn)}</time> · {readingMinutes(p.body)} min de leitura
            </p>
          </div>
        </header>
        <div className="tl-container post__narrow">
          {p.coverFileId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/arquivos/${p.coverFileId}`} alt={p.coverAlt} className="post__cover" />
          )}
          <Markdown source={p.body} className="post-body" />
          <PostCta whatsapp={startWhatsApp(s)} firstName={s.professionalName.split(' ')[0]} />
          <p className="post__back">
            <Link href="/conteudos" className="ulink">
              ← Todos os conteúdos
            </Link>
          </p>
        </div>
      </article>
    </>
  )
}
