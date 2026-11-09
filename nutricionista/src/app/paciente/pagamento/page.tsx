import Link from 'next/link'
import type { Metadata } from 'next'
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { getPatient } from '@/lib/patient-context'
import { getSettings } from '@/lib/settings'
import { mpConfigured } from '@/lib/mercadopago'
import { needsPayment, paymentState } from '@/lib/pagamentos'
import { contractInfo } from '@/lib/contract'
import { monthsLabel, planPrices } from '@/lib/planos'
import { money, whatsappLink } from '@/lib/format'
import { fmtDay, todayIn } from '@/lib/time'
import { iniciarAssinaturaMensal, iniciarPagamento } from '@/actions/pagamento'
import { PageHead } from '@/components/ui'
import { SubmitButton } from '@/components/form'

export const metadata: Metadata = { title: 'Pagamento' }

const ERRORS: Record<string, string> = {
  mp: 'Não foi possível abrir o Mercado Pago agora. Tente de novo em instantes.',
  limite: 'Muitas tentativas seguidas. Aguarde alguns minutos.',
  plano: 'Escolha um plano para continuar.',
}

/** Pagamento do plano (primeira contratação ou renovação) pelo Checkout Pro do Mercado Pago. */
export default async function PaymentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const user = await requirePatient()
  const [s, patient, plans, state, blocked] = await Promise.all([
    getSettings(),
    getPatient(user.patientId),
    db.select().from(schema.packages).where(and(eq(schema.packages.active, true))).orderBy(asc(schema.packages.sort), asc(schema.packages.months)),
    paymentState(user.patientId),
    needsPayment(user.patientId),
  ])
  const priced = planPrices(plans)
  const wanted = sp.plano && /^[0-9a-f-]{36}$/.test(sp.plano) ? sp.plano : null
  const plan = priced.find((p) => p.id === wanted) ?? priced.find((p) => p.id === patient.packageId) ?? priced[0] ?? null
  const online = mpConfigured()
  const today = todayIn(s.timezone)
  const current = patient.packageId ? plans.find((p) => p.id === patient.packageId) : null
  const contract = current ? contractInfo(current, patient.packageStart, patient.packageEnd, today) : null
  const renewal = !blocked && Boolean(state.paid)
  const wa = whatsappLink(s.whatsapp, plan ? `Olá! Quero contratar o Plano ${plan.name}.` : 'Olá! Quero contratar um plano de acompanhamento.')

  return (
    <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 720 }}>
      <PageHead
        title={renewal ? 'Renovar o plano' : 'Pagamento'}
        subtitle={renewal ? 'Escolha o plano e pague pelo Mercado Pago. O novo período começa quando o atual terminar.' : 'Conclua o pagamento para começar o seu acompanhamento.'}
      />
      {sp.erro && ERRORS[sp.erro] && <p className="alert alert--error">{ERRORS[sp.erro]}</p>}
      {renewal && contract?.end && (
        <p className="alert alert--info">
          Seu Plano {contract.name} vai até {fmtDay(contract.end)}.
        </p>
      )}
      {state.open && state.open.providerRef && (
        <p className="alert alert--info">
          Você tem um pagamento aguardando confirmação (Pix ou boleto).{' '}
          <Link href={`/paciente/pagamento/retorno?external_reference=${state.open.id}`}>Ver situação</Link>
        </p>
      )}

      {!plan ? (
        <p className="card">Os planos ainda não foram publicados. Fale com o coach pelo WhatsApp.</p>
      ) : (
        <section className="card stack pay-card" style={{ ['--gap' as string]: '14px' }} aria-labelledby="plano-escolhido">
          <span className="send-card__tag">Plano escolhido</span>
          <h2 id="plano-escolhido" className="pay-card__name">
            Plano {plan.name}
          </h2>
          <p className="pay-card__price">
            {money(plan.priceCents)}
            <span className="muted">
              {' '}
              · {monthsLabel(plan.months)}
              {plan.months > 1 ? ` · ${money(plan.monthlyCents)}/mês` : ''}
            </span>
          </p>
          {plan.perks.length > 0 && (
            <ul className="pay-card__perks">
              {plan.perks.map((x) => (
                <li key={x.title}>+ {x.title}</li>
              ))}
            </ul>
          )}
          {online ? (
            <>
              <form action={iniciarPagamento}>
                <input type="hidden" name="planoId" value={plan.id} />
                <SubmitButton className="btn btn--primary btn--lg btn--block" pendingText="Abrindo o Mercado Pago…">
                  Pagar com Mercado Pago
                </SubmitButton>
              </form>
              <p className="small muted" style={{ margin: 0 }}>
                Pix, cartão em até {s.mpMaxInstallments}x ou boleto · pagamento seguro pelo Mercado Pago. O sistema não guarda dados do seu cartão.
              </p>
              {plan.months === 1 && (
                patient.mpPreapprovalStatus === 'authorized' ? (
                  <p className="alert alert--ok small" style={{ margin: 0 }}>
                    Sua assinatura mensal está ativa: o plano renova sozinho todo mês. Para cancelar, vá em <Link href="/paciente/meus-dados">Meus dados</Link>.
                  </p>
                ) : (
                  <form action={iniciarAssinaturaMensal} className="stack" style={{ ['--gap' as string]: '6px' }}>
                    <input type="hidden" name="planoId" value={plan.id} />
                    <SubmitButton className="btn btn--block" pendingText="Abrindo o Mercado Pago…">
                      Assinar: renova todo mês
                    </SubmitButton>
                    <span className="small muted">Opcional. Cobrança automática no cartão a cada mês, sem taxa extra. Cancele quando quiser.</span>
                  </form>
                )
              )}
            </>
          ) : (
            wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn--whatsapp btn--block">
                Fale pelo WhatsApp para contratar
              </a>
            )
          )}
          {priced.length > 1 && (
            <details className="disclosure">
              <summary>Trocar de plano</summary>
              <ul className="list" aria-label="Planos disponíveis">
                {priced.map((p) => (
                  <li key={p.id} className="row row--between">
                    <span>
                      <strong>{p.name}</strong> · {money(p.priceCents)}
                      {p.months > 1 && <span className="small muted"> · {money(p.monthlyCents)}/mês</span>}
                    </span>
                    {p.id === plan.id ? (
                      <span className="badge badge--ok">Escolhido</span>
                    ) : (
                      <Link href={`/paciente/pagamento?plano=${p.id}`} className="btn btn--sm">
                        Escolher
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      <p className="small muted">Depois do pagamento você responde a anamnese e o {s.professionalName.split(' ')[0]} monta o seu plano.</p>
    </div>
  )
}
