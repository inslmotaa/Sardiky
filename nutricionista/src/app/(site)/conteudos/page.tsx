import type { Metadata } from 'next'
import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { sitePageMeta } from '@/lib/seo-server'
import { visiblePosts } from '@/lib/posts'
import { dataPost } from '@/lib/conteudos'
import { plainText, readingMinutes } from '@/lib/markdown'
import { clip } from '@/lib/seo'
import { PageHead } from '@/components/SiteBlocks'

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  return sitePageMeta({
    title: 'Conteúdos',
    description: `Textos de ${s.professionalName}, ${s.professionalTitle}, sobre alimentação, rotina e bem-estar: dicas práticas para aplicar no dia a dia.`,
    path: '/conteudos',
  })
}

/** Lista pública dos Conteúdos (blog). */
export default async function PostsIndexPage() {
  const [s, posts] = await Promise.all([getSettings(), visiblePosts()])
  return (
    <>
      <PageHead label="CONTEÚDOS" title="Alimentação e rotina, sem complicar" lead={`Textos curtos do ${s.professionalName.split(' ')[0]} para aplicar no dia a dia.`} />
      <section className="tl-page">
        <div className="tl-container">
          {posts.length === 0 ? (
            <p className="tl-lead">Os conteúdos serão publicados em breve.</p>
          ) : (
            <ul className="post-grid" aria-label="Conteúdos">
              {posts.map((p) => (
                <li key={p.id} className="post-card" data-rv="">
                  {p.coverFileId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/arquivos/${p.coverFileId}`} alt={p.coverAlt} loading="lazy" className="post-card__cover" />
                  )}
                  <p className="post-card__meta">
                    <time dateTime={p.publishedOn}>{dataPost(p.publishedOn)}</time> · {readingMinutes(p.body)} min de leitura
                  </p>
                  <h2 className="post-card__title">
                    <Link href={`/conteudos/${p.slug}`}>{p.title}</Link>
                  </h2>
                  <p className="post-card__summary">{p.summary || clip(plainText(p.body), 180)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
