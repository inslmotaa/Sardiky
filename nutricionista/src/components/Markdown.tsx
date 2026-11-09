import Link from 'next/link'
import { parseMarkdown, type Inline } from '@/lib/markdown'

/** Renderiza o Markdown dos Conteúdos como elementos React (nunca HTML cru). */
function Inlines({ c }: { c: Inline[] }) {
  return (
    <>
      {c.map((x, i) => {
        switch (x.t) {
          case 'text':
            return <span key={i}>{x.v}</span>
          case 'code':
            return <code key={i}>{x.v}</code>
          case 'strong':
            return (
              <strong key={i}>
                <Inlines c={x.c} />
              </strong>
            )
          case 'em':
            return (
              <em key={i}>
                <Inlines c={x.c} />
              </em>
            )
          case 'link':
            return x.external ? (
              <a key={i} href={x.href} target="_blank" rel="noopener noreferrer nofollow">
                <Inlines c={x.c} />
              </a>
            ) : x.href.startsWith('/') ? (
              <Link key={i} href={x.href}>
                <Inlines c={x.c} />
              </Link>
            ) : (
              <a key={i} href={x.href}>
                <Inlines c={x.c} />
              </a>
            )
        }
      })}
    </>
  )
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source)
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h2':
            return (
              <h2 key={i}>
                <Inlines c={b.c} />
              </h2>
            )
          case 'h3':
            return (
              <h3 key={i}>
                <Inlines c={b.c} />
              </h3>
            )
          case 'p':
            return (
              <p key={i}>
                <Inlines c={b.c} />
              </p>
            )
          case 'quote':
            return (
              <blockquote key={i}>
                <p>
                  <Inlines c={b.c} />
                </p>
              </blockquote>
            )
          case 'hr':
            return <hr key={i} />
          case 'ul':
          case 'ol': {
            const Tag = b.t
            return (
              <Tag key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines c={it} />
                  </li>
                ))}
              </Tag>
            )
          }
        }
      })}
    </div>
  )
}
