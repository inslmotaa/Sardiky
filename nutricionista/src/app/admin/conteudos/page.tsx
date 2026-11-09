import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { todayIn } from '@/lib/time'
import { dataPost, postVisivel } from '@/lib/conteudos'
import { Empty, NoAccess, PageHead } from '@/components/ui'

/** Conteúdos (blog) do site: lista com situação e atalho para o editor. */
export default async function PostsPage() {
  const user = await requireTeam()
  if (!can(user, 'site')) return <NoAccess />
  const [s, posts] = await Promise.all([getSettings(), db.select().from(schema.posts).orderBy(desc(schema.posts.publishedOn), desc(schema.posts.createdAt))])
  const today = todayIn(s.timezone)
  return (
    <div className="stack">
      <PageHead
        title="Conteúdos"
        subtitle="Textos do blog em /conteudos. Cada conteúdo termina com um convite para agendar ou contratar. Só os publicados (com data de hoje ou passada) aparecem no site e no Google."
        actions={
          <Link href="/admin/conteudos/novo" className="btn btn--primary">
            Novo conteúdo
          </Link>
        }
      />
      {posts.length === 0 ? (
        <Empty>Nenhum conteúdo ainda. Comece por uma dúvida que os clientes fazem sempre.</Empty>
      ) : (
        <div className="table-wrap">
          <table aria-label="Conteúdos">
            <thead>
              <tr>
                <th>Título</th>
                <th>Data</th>
                <th>Situação</th>
                <th>No site</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => {
                const live = postVisivel(p, today)
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/conteudos/${p.id}`}>
                        <strong>{p.title}</strong>
                      </Link>
                      {p.summary && <div className="small muted">{p.summary}</div>}
                    </td>
                    <td className="nowrap small">{dataPost(p.publishedOn)}</td>
                    <td>
                      {p.status === 'rascunho' ? (
                        <span className="badge badge--plain">Rascunho</span>
                      ) : live ? (
                        <span className="badge badge--ok">Publicado</span>
                      ) : (
                        <span className="badge badge--info">Agendado</span>
                      )}
                    </td>
                    <td className="small">
                      {live ? (
                        <a href={`/conteudos/${p.slug}`} target="_blank" rel="noopener noreferrer">
                          /conteudos/{p.slug}
                        </a>
                      ) : (
                        <span className="muted">Não aparece</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
