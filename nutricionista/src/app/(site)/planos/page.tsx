import type { Metadata } from 'next'
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { money } from '@/lib/format'
import { monthsLabel, planPrices } from '@/lib/planos'
import { FadeUp, Stagger, StaggerItem } from '@/components/motion'
import { PlanCardLink } from '@/components/PlanCard'
import { IconCalendar, IconCheck } from '@/components/icons'

export const metadata: Metadata = { title: 'Planos', description: 'Planos de acompanhamento nutricional: mensal, trimestral, semestral e anual.' }

/** Planos de acompanhamento: cards e comparação do que cada um inclui. */
export default async function PlansPage() {
  const [s, user, packages] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    db.select().from(schema.packages).where(and(eq(schema.packages.active, true))).orderBy(asc(schema.packages.sort), asc(schema.packages.months)),
  ])
  const plans = planPrices(packages)
  // Selo "Mais escolhido": o plano marcado com destaque em Financeiro (ou, sem marcação, o de maior desconto).
  const featured = plans.find((p) => p.highlight) ?? [...plans].sort((a, b) => b.discountPct - a.discountPct)[0]
  const target = (id: string) => (user ? `/agendar?plano=${id}` : `/criar-conta?plano=${id}`)
  const perks = [...new Map(plans.flatMap((p) => p.perks).map((x) => [x.title, x])).values()]

  return (
    <>
      <section className="plans-hero">
        <FadeUp className="container">
          <span className="eyebrow">Planos de acompanhamento nutricional</span>
          <h1>Escolha o seu plano</h1>
          <p className="muted">Mais saúde, performance e resultados com um plano que cabe na sua rotina. Quanto mais longo, menor o valor por mês.</p>
        </FadeUp>
      </section>

      <section className="section section--tight plans-section">
        <div className="container">
          {plans.length === 0 ? (
            <p className="empty">Os planos serão publicados em breve. Fale com o consultório pelo WhatsApp.</p>
          ) : (
            <Stagger className="plans">
              {plans.map((pk) => {
                const isFeatured = pk.id === featured?.id
                return (
                  <StaggerItem key={pk.id} className="plan-wrap">
                    <PlanCardLink featured={isFeatured}>
                      {isFeatured && <span className="plan__ribbon">Mais escolhido</span>}
                      {s.showPlanPrices && pk.discountPct > 0 && <span className="plan__off">{pk.discountPct}% de desconto</span>}
                      <span className="plan__kicker">Plano</span>
                      <h2 className="plan__name">{pk.name}</h2>
                      {pk.description && <p className="plan__desc">{pk.description}</p>}
                      {s.showPlanPrices && (
                        <>
                          <div className="plan__monthly">{money(pk.monthlyCents)}/mês</div>
                          {pk.fullCents && <div className="plan__from">de {money(pk.fullCents)}</div>}
                          <div className="plan__price" aria-label={money(pk.priceCents)}>
                            <span className="plan__cur">R$</span>
                            <span className="plan__int">{Math.floor(pk.priceCents / 100).toLocaleString('pt-BR')}</span>
                            <span className="plan__cents">,{String(pk.priceCents % 100).padStart(2, '0')}</span>
                          </div>
                        </>
                      )}
                      <div className="plan__months">
                        <IconCalendar width={16} height={16} /> {monthsLabel(pk.months)}
                      </div>
                      <a href={target(pk.id)} className={`btn btn--block btn--fx ${isFeatured ? 'btn--light' : 'btn--primary'}`}>
                        Quero este plano
                      </a>
                    </PlanCardLink>
                  </StaggerItem>
                )
              })}
            </Stagger>
          )}

          {plans.length > 0 && (s.plansIncluded.length > 0 || perks.length > 0) && (
            <FadeUp className="compare">
              <h2>O que cada plano inclui</h2>
              <div className="compare__scroll">
                <table className="compare__table">
                  <caption className="sr-only">Comparação dos planos</caption>
                  <thead>
                    <tr>
                      <th scope="col">Incluso</th>
                      {plans.map((p) => (
                        <th key={p.id} scope="col" className={p.id === featured?.id ? 'is-featured' : undefined}>
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Duração</th>
                      {plans.map((p) => (
                        <td key={p.id}>{monthsLabel(p.months)}</td>
                      ))}
                    </tr>
                    {s.plansIncluded.map((it) => (
                      <tr key={it.title}>
                        <th scope="row">
                          {it.title}
                          {it.text && <span>{it.text}</span>}
                        </th>
                        {plans.map((p) => (
                          <td key={p.id}>
                            <Check yes />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {perks.map((it) => (
                      <tr key={it.title}>
                        <th scope="row">
                          {it.title}
                          {it.text && <span>{it.text}</span>}
                        </th>
                        {plans.map((p) => (
                          <td key={p.id}>
                            <Check yes={p.perks.some((x) => x.title === it.title)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FadeUp>
          )}
        </div>
      </section>
    </>
  )
}

function Check({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="compare__yes" aria-label="Incluso">
      <IconCheck width={18} height={18} aria-hidden />
    </span>
  ) : (
    <span className="compare__no" aria-label="Não incluso">
      —
    </span>
  )
}
