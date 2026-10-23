import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { whatsappLink } from '@/lib/format'
import { FloatingFruit } from '@/components/Fruits'
import { FadeUp } from '@/components/motion'
import { IconWhatsApp } from '@/components/icons'

export const metadata: Metadata = { title: 'Dúvidas' }

/** Perguntas frequentes (cadastradas no painel) e contato pelo WhatsApp. */
export default async function FaqPage() {
  const [s, faqs] = await Promise.all([getSettings(), db.select().from(schema.faqs).where(eq(schema.faqs.published, true)).orderBy(asc(schema.faqs.sort))])
  const wa = whatsappLink(s.whatsapp, 'Olá! Vim pelo site e tenho uma dúvida.')
  return (
    <>
      <section className="page-hero">
        <FloatingFruit name="limao" size={42} style={{ top: '22%', right: '9%' }} duration={7} desktopOnly />
        <FadeUp className="container page-hero__inner">
          <span className="eyebrow">Dúvidas</span>
          <h1>Perguntas frequentes</h1>
          <p className="page-hero__lead">Não encontrou o que procurava? Mande uma mensagem: a resposta vem direto do {s.professionalName.split(' ')[0]}.</p>
        </FadeUp>
      </section>
      <section className="section">
        <div className="container" style={{ maxWidth: 820 }}>
          {faqs.length === 0 ? (
            <p className="empty">As perguntas frequentes serão publicadas em breve.</p>
          ) : (
            <FadeUp className="faq">
              {faqs.map((f) => (
                <details key={f.id} className="faq__item">
                  <summary>{f.question}</summary>
                  <p>{f.answer}</p>
                </details>
              ))}
            </FadeUp>
          )}
          {wa && (
            <FadeUp className="center-link">
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn--whatsapp btn--lg">
                <IconWhatsApp /> Tirar dúvida pelo WhatsApp
              </a>
            </FadeUp>
          )}
        </div>
      </section>
    </>
  )
}
