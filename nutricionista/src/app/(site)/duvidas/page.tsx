import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { whatsappLink } from '@/lib/format'
import { PageHead } from '@/components/SiteBlocks'

export const metadata: Metadata = { title: 'Dúvidas' }

/** Perguntas frequentes (cadastradas no painel) e contato pelo WhatsApp. */
export default async function FaqPage() {
  const [s, faqs] = await Promise.all([
    getSettings(),
    db.select().from(schema.faqs).where(eq(schema.faqs.published, true)).orderBy(asc(schema.faqs.sort)),
  ])
  const wa = whatsappLink(s.whatsapp, 'Olá! Vim pelo site e tenho uma dúvida.')
  return (
    <>
      <PageHead
        label="DÚVIDAS"
        title="Perguntas frequentes"
        lead={`Não encontrou o que procurava? Mande uma mensagem: a resposta vem direto do ${s.professionalName.split(' ')[0]}.`}
      />
      <section className="tl-page">
        <div className="tl-container" style={{ maxWidth: 980 }}>
          {faqs.length === 0 ? (
            <p className="tl-lead">As perguntas frequentes serão publicadas em breve.</p>
          ) : (
            <div className="faq-tl" data-rv="">
              {faqs.map((f) => (
                <details key={f.id} className="faq__item">
                  <summary>{f.question}</summary>
                  <p>{f.answer}</p>
                </details>
              ))}
            </div>
          )}
          {wa && (
            <div className="tl-actions" data-rv="">
              <a href={wa} target="_blank" rel="noopener noreferrer" className="pill">
                Tirar dúvida pelo WhatsApp <span aria-hidden>→</span>
              </a>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
