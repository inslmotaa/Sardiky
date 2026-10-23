import Link from 'next/link'
import type { Metadata } from 'next'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { getPatient } from '@/lib/patient-context'
import { anamnesisVersions, currentDraft, startFirstDraft } from '@/lib/anamnese-store'
import { ANAMNESIS_STEPS, answerText } from '@/lib/anamnese-form'
import { bookingLink } from '@/lib/format'
import { fmtDateTime } from '@/lib/time'
import { BookingLink } from '@/components/BookingLink'
import { AnamnesisWizard } from '@/components/AnamnesisWizard'
import { PageHead } from '@/components/ui'

export const metadata: Metadata = { title: 'Anamnese' }

type SP = Promise<Record<string, string | undefined>>

/** Anamnese no site: rascunho em etapas, envio, agradecimento e respostas enviadas. */
export default async function AnamnesisPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const user = await requirePatient()
  const s = await getSettings()
  const next = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : null
  const booking = next === '/agendar' ? { href: '/agendar', external: false } : bookingLink(s, 'Olá! Enviei minha anamnese e gostaria de agendar a consulta.')

  if (sp.enviada) {
    return (
      <div className="card anam-thanks">
        <div className="anam-thanks__icon" aria-hidden>
          ✓
        </div>
        <h1>Obrigado! Sua anamnese foi enviada.</h1>
        <p className="muted">
          {s.professionalName.split(' ')[0]} já recebeu as suas respostas e vai usá-las para preparar o seu acompanhamento. O próximo passo é a consulta.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <BookingLink to={booking} className="btn btn--primary btn--lg btn--fx btn--pulse">
            Agendar consulta
          </BookingLink>
          <Link href="/paciente" className="btn btn--lg">
            Ir para minha área
          </Link>
        </div>
      </div>
    )
  }

  const patient = await getPatient(user.patientId)
  let draft = await currentDraft(user.patientId)
  const versions = await anamnesisVersions(user.patientId)
  const sent = versions.find((v) => v.status === 'enviada')

  // Primeira anamnese: começa o rascunho. Anamnese recebida por outro meio (antes do site) não cria rascunho.
  if (!draft && !sent && !patient.anamnesisReceivedAt) draft = await startFirstDraft(user.patientId)

  if (draft) {
    return (
      <div className="stack" style={{ ['--gap' as string]: '16px' }}>
        <PageHead
          title={draft.version > 1 ? 'Reavaliação: atualize sua anamnese' : 'Sua anamnese'}
          subtitle="Leva cerca de 10 minutos. Cada etapa é salva quando você avança: pode sair e continuar depois."
        />
        <AnamnesisWizard answers={draft.answers} startAt={draft.step} next={next} version={draft.version} />
        <p className="small muted">Suas respostas são dados de saúde: ficam protegidas e só o nutricionista tem acesso.</p>
      </div>
    )
  }

  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }}>
      <PageHead title="Sua anamnese" subtitle={sent?.submittedAt ? `Enviada em ${fmtDateTime(sent.submittedAt, s.timezone)}.` : 'Recebida pelo consultório.'} />
      {sent ? (
        ANAMNESIS_STEPS.map((st) => (
          <section key={st.key} className="card anam__review">
            <h2 style={{ fontSize: '1.05rem' }}>{st.title}</h2>
            <dl>
              {st.fields.map((f) => (
                <div key={f.id}>
                  <dt>{f.label}</dt>
                  <dd>{answerText(f, sent.answers[st.key]?.[f.id]) || <span className="muted">—</span>}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))
      ) : (
        <p className="card">Sua anamnese já foi recebida pelo consultório. Quando for a hora de uma reavaliação, ela aparece aqui para você atualizar.</p>
      )}
      <p className="small muted">Precisa corrigir algo? Fale com o nutricionista pelas mensagens: na reavaliação você atualiza as respostas.</p>
    </div>
  )
}
