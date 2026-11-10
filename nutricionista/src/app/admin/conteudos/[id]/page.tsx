import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { todayIn } from '@/lib/time'
import { uuid } from '@/lib/validation'
import { postVisivel } from '@/lib/conteudos'
import { deletePost, savePost } from '@/actions/admin/posts'
import { ActionForm, ConfirmForm, Field, SubmitButton } from '@/components/form'
import { Markdown } from '@/components/Markdown'
import { NoAccess, PageHead } from '@/components/ui'

/** Editor simples de um conteúdo: título, resumo, capa, texto em Markdown, rascunho/publicado e data. */
export default async function PostEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }> }) {
  const user = await requireTeam()
  if (!can(user, 'site')) return <NoAccess />
  const { id } = await params
  const isNew = id === 'novo'
  if (!isNew && !uuid.safeParse(id).success) notFound()
  const [s, rows] = await Promise.all([getSettings(), isNew ? Promise.resolve([]) : db.select().from(schema.posts).where(eq(schema.posts.id, id))])
  const p = rows[0]
  if (!isNew && !p) notFound()
  const today = todayIn(s.timezone)
  const created = (await searchParams).criado === '1'
  const live = p ? postVisivel(p, today) : false
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 980 }}>
      <PageHead
        crumbs={[{ href: '/admin/conteudos', label: 'Conteúdos' }]}
        title={p ? p.title : 'Novo conteúdo'}
        actions={
          p ? (
            <>
              <a className="btn btn--sm" href={`/conteudos/${p.slug}`} target="_blank" rel="noopener noreferrer">
                {live ? 'Ver no site' : 'Pré-visualizar'}
              </a>
              <ConfirmForm action={deletePost.bind(null, p.id)} confirm="Excluir este conteúdo? Ele sai do site e não pode ser recuperado.">
                <button type="submit" className="btn btn--danger btn--sm">
                  Excluir
                </button>
              </ConfirmForm>
            </>
          ) : null
        }
      />
      {created && (
        <p className="alert alert--ok" role="status">
          Conteúdo criado.
        </p>
      )}
      <ActionForm action={savePost.bind(null, p?.id ?? null)} className="card stack" encType="multipart/form-data">
        <Field label="Título" name="title" required>
          <input name="title" defaultValue={p?.title ?? ''} maxLength={160} required />
        </Field>
        <Field label="Endereço" name="slug" hint="Parte final do link, ex.: cafe-da-manha-pratico. Em branco, é criado a partir do título.">
          <input name="slug" defaultValue={p?.slug ?? ''} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        </Field>
        <Field label="Resumo" name="summary" hint="Aparece na lista, no Google e no link compartilhado (até 300 caracteres).">
          <textarea name="summary" rows={2} maxLength={300} defaultValue={p?.summary ?? ''} />
        </Field>
        <div className="grid-2">
          <Field label="Capa" name="cover" hint="Imagem JPG, PNG ou WebP. Opcional.">
            <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" />
          </Field>
          <Field label="Descrição da capa" name="coverAlt" hint="Para quem usa leitor de tela. Ex.: prato com arroz, feijão e salada.">
            <input name="coverAlt" defaultValue={p?.coverAlt ?? ''} maxLength={200} />
          </Field>
        </div>
        {p?.coverFileId && (
          <div className="row" style={{ alignItems: 'center', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/arquivos/${p.coverFileId}`} alt="" style={{ width: 160, height: 90, objectFit: 'cover', borderRadius: 8 }} />
            <label className="check">
              <input type="checkbox" name="removeCover" /> Remover a capa
            </label>
          </div>
        )}
        <Field
          label="Texto (Markdown)"
          name="body"
          hint="## Título de seção · **negrito** · *itálico* · [link](https://...) · linhas com “- ” viram lista · “> ” vira citação. O convite para ver os planos entra sozinho no fim."
        >
          <textarea name="body" rows={18} defaultValue={p?.body ?? ''} maxLength={40000} style={{ fontFamily: 'var(--font-mono, monospace)' }} />
        </Field>
        <div className="grid-2">
          <Field label="Situação" name="status">
            <select name="status" defaultValue={p?.status ?? 'rascunho'}>
              <option value="rascunho">Rascunho (não aparece no site)</option>
              <option value="publicado">Publicado</option>
            </select>
          </Field>
          <Field label="Data" name="publishedOn" hint="Com data futura, o conteúdo só aparece a partir dela.">
            <input type="date" name="publishedOn" defaultValue={p?.publishedOn ?? today} required />
          </Field>
        </div>
        <div className="row">
          <SubmitButton>{isNew ? 'Criar conteúdo' : 'Salvar conteúdo'}</SubmitButton>
        </div>
      </ActionForm>
      {p?.body && (
        <details className="card">
          <summary>
            <strong>Prévia do texto salvo</strong>
          </summary>
          <Markdown source={p.body} className="post-body" />
        </details>
      )}
    </div>
  )
}
