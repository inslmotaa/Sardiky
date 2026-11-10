import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'
import { startWhatsApp } from '@/lib/format'
import { StartCtas } from '@/components/StartCtas'
import { PageHead } from '@/components/SiteBlocks'
import { PhoneMock } from '@/components/PhoneMock'
import { sitePageMeta } from '@/lib/seo-server'

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  return sitePageMeta({ title: 'Como funciona', description: `Como funciona o acompanhamento on-line com ${s.professionalName}: anamnese, plano individualizado no app, ajustes a cada 15 dias e contato direto com o coach.`, path: '/como-funciona' })
}

const STEPS = [
  { title: 'Escolha o seu plano', text: 'Mensal, trimestral, semestral ou anual, com pagamento pelo Mercado Pago. Quanto mais longo, menor o valor por mês.' },
  {
    title: 'Crie sua conta e responda a anamnese',
    text: 'A conta leva menos de um minuto. A anamnese é no próprio site, em etapas curtas: saúde, rotina, alimentação e objetivo.',
  },
  { title: 'Avaliação e metas', text: 'Por videochamada, combinada pelo WhatsApp: conversa, medidas orientadas e definição das primeiras metas.' },
  {
    title: 'Plano no app, ajustado a cada 15 dias',
    text: 'Refeições por horário, quantidades e substituições no app, com diário, mensagens e evolução. A estratégia é revista a cada 15 dias.',
  },
]

/** Passo a passo do acompanhamento e o que está incluso em todos os planos. */
export default async function HowItWorksPage() {
  const s = await getSettings()
  return (
    <>
      <PageHead
        label="COMO FUNCIONA"
        title="Do primeiro contato ao acompanhamento"
        lead="Um processo simples, com cada etapa clara — e você acompanhando tudo pelo celular."
      />

      <section className="tl-page">
        <div className="tl-container about">
          <div>
            <p className="sec-label" data-rv="">
              / PASSO A PASSO
            </p>
            <h2 className="display" data-rv="">
              Quatro etapas, no seu ritmo
            </h2>
          </div>
          <ol className="timeline-tl">
            {STEPS.map((st, i) => (
              <li key={st.title} data-rv="" style={{ '--d': `${i * 60}ms` } as React.CSSProperties}>
                <span className="step__mark" aria-hidden />
                <div>
                  <h2>{st.title}</h2>
                  <p>{st.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="tl-page">
        <div className="tl-container about">
          <div>
            <div className="tl-actions" data-rv="">
              <StartCtas whatsapp={startWhatsApp(s)} />
            </div>
          </div>
          <div className="phone-wrap" data-rv="">
            <PhoneMock />
          </div>
        </div>
      </section>
    </>
  )
}
