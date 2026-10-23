import type { Metadata } from 'next'
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { getCurrentUser } from '@/lib/auth/session'
import { monthsLabel, planPrices } from '@/lib/planos'
import { PageHead, PlanGrid } from '@/components/SiteBlocks'

export const metadata: Metadata = { title: 'Planos', description: 'Planos de acompanhamento: mensal, trimestral, semestral e anual.' }

/** Planos de acompanhamento: cartões e comparação do que cada um inclui. */
export default async function PlansPage() {
  const [s, user, packages] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    db
      .select()
      .from(schema.packages)
      .where(and(eq(schema.packages.active, true)))
      .orderBy(asc(schema.packages.sort), asc(schema.packages.months)),
  ])
  const plans = planPrices(packages)
  const featured = plans.find((p) => p.highlight) ?? [...plans].sort((a, b) => b.discountPct - a.discountPct)[0]
  const target = (id: string) => (user ? `/agendar?plano=${id}` : `/criar-conta?plano=${id}`)
  const perks = [...new Map(plans.flatMap((p) => p.perks).map((x) => [x.title, x])).values()]

  return (
    <>
      <PageHead
        label="PLANOS DE ACOMPANHAMENTO"
        title="Escolha o seu plano"
        lead="Mais saúde, performance e resultados com um plano que cabe na sua rotina. Quanto mais longo, menor o valor por mês."
      />

      <section className="tl-page" id="planos-lista">
        <div className="tl-container">
          {plans.length === 0 ? (
            <p className="tl-lead">Os planos serão publicados em breve. Fale pelo WhatsApp.</p>
          ) : (
            <PlanGrid plans={plans} showPrices={s.showPlanPrices} href={target} />
          )}
        </div>
      </section>

      {plans.length > 0 && (s.plansIncluded.length > 0 || perks.length > 0) && (
        <section className="tl-page">
          <div className="tl-container">
            <p className="sec-label" data-rv="">
              / COMPARAÇÃO
            </p>
            <h2 className="display" data-rv="">
              O que cada plano inclui
            </h2>
            <div className="compare-scroll" data-rv="">
              <table className="compare-tl">
                <caption className="sr-only">Comparação dos planos</caption>
                <thead>
                  <tr>
                    <th scope="col">Incluso</th>
                    {plans.map((p) => (
                      <th key={p.id} scope="col">
                        {p.name}
                        {p.id === featured?.id ? ' ●' : ''}
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
          </div>
        </section>
      )}
    </>
  )
}

function Check({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="yes" role="img" aria-label="Incluso">
      ✓
    </span>
  ) : (
    <span className="no" role="img" aria-label="Não incluso">
      —
    </span>
  )
}
