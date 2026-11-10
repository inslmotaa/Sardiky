import type { Metadata } from 'next'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireActivePatient } from '@/lib/auth/patient-gate'
import { fmtDay } from '@/lib/time'
import { submitTestimonial, withdrawTestimonial } from '@/actions/patient'
import { ActionForm, SubmitButton } from '@/components/form'
import { PageHead } from '@/components/ui'

export const metadata: Metadata = { title: 'Seu depoimento' }

/** Avaliação do acompanhamento e, se o cliente autorizar, depoimento no site (só depois da aprovação do coach). */
export default async function TestimonialPage({ searchParams }: { searchParams: Promise<{ avaliada?: string }> }) {
  const sp = await searchParams
  const user = await requireActivePatient()
  const mine = await db
    .select({ id: schema.testimonials.id, text: schema.testimonials.text, rating: schema.testimonials.rating, published: schema.testimonials.published, date: schema.testimonials.date })
    .from(schema.testimonials)
    .where(eq(schema.testimonials.patientId, user.patientId))
    .orderBy(desc(schema.testimonials.date))
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead title="Seu depoimento" subtitle="Conte como está sendo o acompanhamento. Só vai para o site se você autorizar e o coach aprovar." />
      {sp.avaliada && (
        <p className="alert alert--ok" role="status">
          {sp.avaliada === 'depoimento' ? 'Obrigado! Sua avaliação vai para o site depois que o coach aprovar.' : 'Obrigado pela avaliação!'}
        </p>
      )}
      <section className="card" aria-labelledby="avaliar-titulo">
        <h2 id="avaliar-titulo" style={{ fontSize: '1.15rem' }}>
          Como está sendo o acompanhamento?
        </h2>
        <ActionForm action={submitTestimonial} className="stack">
          <fieldset>
            <legend>Sua nota</legend>
            <div className="scale-input stars" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} title={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}>
                  <input type="radio" name="rating" value={n} aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`} />
                  <span aria-hidden>★</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span className="field__label">Comentário (opcional)</span>
            <textarea name="comment" rows={3} maxLength={1000} />
          </label>
          <fieldset className="stack" style={{ ['--gap' as string]: '8px' }}>
            <legend className="small">Depoimento no site (opcional)</legend>
            <label className="check">
              <input type="checkbox" name="publicar" /> Autorizo publicar esta avaliação como depoimento no site
            </label>
            <label className="field">
              <span className="field__label small">Como assinar</span>
              <select name="assinatura" defaultValue="iniciais">
                <option value="iniciais">Só as iniciais</option>
                <option value="nome">Primeiro nome e inicial do sobrenome</option>
              </select>
            </label>
            <p className="small muted" style={{ margin: 0 }}>
              Só o texto e a nota vão para o site, depois da aprovação do coach. Fotos nunca são publicadas sem uma autorização específica. Você pode retirar a
              autorização quando quiser, aqui mesmo.
            </p>
          </fieldset>
          <div>
            <SubmitButton>Enviar avaliação</SubmitButton>
          </div>
        </ActionForm>
      </section>
      {mine.length > 0 && (
        <section className="card" aria-labelledby="meus-depoimentos">
          <h2 id="meus-depoimentos" style={{ fontSize: '1.15rem' }}>
            Seus depoimentos autorizados
          </h2>
          <ul className="list" aria-label="Seus depoimentos">
            {mine.map((t) => (
              <li key={t.id}>
                <div>
                  <span aria-label={`${t.rating ?? 0} de 5 estrelas`}>{'★'.repeat(t.rating ?? 0)}</span> · {fmtDay(t.date)}
                </div>
                <p style={{ margin: '4px 0' }}>“{t.text}”</p>
                <div className="small muted">
                  {t.published ? 'Publicada no site' : 'Autorizada · aguardando o coach'} ·{' '}
                  <form action={withdrawTestimonial.bind(null, t.id)} style={{ display: 'inline' }}>
                    <button type="submit" className="link-btn small">
                      Retirar autorização
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
