import { money } from '@/lib/format'
import { featuredPlan, monthsLabel, type PlanPrice } from '@/lib/planos'

/** Fundo de natureza, alimentos e bem-estar (canvas, ligado pelo site-fx) com o grão por cima. */
export function NatureBg({ sunX, density }: { sunX?: number; density?: number }) {
  return (
    <>
      <canvas className="nature" data-nature="" data-sun-x={sunX} data-density={density} aria-hidden />
      <div className="grain" aria-hidden />
    </>
  )
}

/** Rótulo pequeno em mono, com o ponto verde. */
export function MonoLabel({ children, dot = true, className }: { children: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <p className={`mono-label${className ? ` ${className}` : ''}`} data-rv="">
      {dot && <span className="mono-label__dot" aria-hidden />}
      {children}
    </p>
  )
}

/** Topo das páginas internas: fundo de natureza, rótulo "/ SOBRE" e título largo. */
export function PageHead({ label, title, lead }: { label: string; title: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <section className="tl-pagehead" data-nature-host="">
      <NatureBg />
      <div className="tl-container tl-pagehead__inner">
        <p className="sec-label" data-rv="">
          / {label}
        </p>
        <h1 className="display" data-rv="" style={{ '--d': '80ms' } as React.CSSProperties}>
          {title}
        </h1>
        {lead && (
          <p className="tl-lead" data-rv="" style={{ '--d': '160ms' } as React.CSSProperties}>
            {lead}
          </p>
        )}
      </div>
    </section>
  )
}

type Plan = PlanPrice & {
  id: string
  name: string
  months: number
  priceCents: number
  highlight?: string | null
  perks: { title: string; text?: string | null }[]
}

/**
 * Cartões dos planos (só na seção #planos da página inicial): bordas finas, valor mensal equivalente e bônus.
 * Com os valores escondidos (Configurações), o botão vira "Falar no WhatsApp".
 */
export function PlanGrid({
  plans,
  showPrices,
  href,
  whatsapp,
}: {
  plans: Plan[]
  showPrices: boolean
  href: (id: string) => string
  /** Sem valores no site: link do WhatsApp com o nome do plano. */
  whatsapp?: (name: string) => string | null
}) {
  const featured = featuredPlan(plans)
  return (
    <ul className="tl-plans">
      {plans.map((pk, i) => {
        const isFeatured = pk.id === featured?.id
        return (
          <li
            key={pk.id}
            className={`tl-plan${isFeatured ? ' tl-plan--featured' : ''}`}
            data-rv=""
            style={{ '--d': `${i * 70}ms` } as React.CSSProperties}
          >
            <div className="tl-plan__top">
              {isFeatured && <span className="tl-plan__badge">{(pk.highlight || 'Mais escolhido').toUpperCase()}</span>}
            </div>
            <h3 className="tl-plan__name">{pk.name}</h3>
            {showPrices ? (
              <>
                <p className="tl-plan__price">{money(pk.priceCents)}</p>
                <p className="tl-plan__monthly">{pk.months > 1 ? `${money(pk.monthlyCents)}/mês` : 'pagamento mensal'}</p>
              </>
            ) : (
              <p className="tl-plan__monthly">{pk.months === 1 ? '1 mês' : `${pk.months} meses`}</p>
            )}
            {pk.perks.length > 0 && (
              <ul className="tl-plan__perks">
                {pk.perks.map((x) => (
                  <li key={x.title}>+ {x.title}</li>
                ))}
              </ul>
            )}
            {!showPrices && whatsapp?.(pk.name) ? (
              <a href={whatsapp(pk.name)!} className="pill pill--sm tl-plan__cta" target="_blank" rel="noopener noreferrer">
                Falar no WhatsApp <span aria-hidden>→</span>
              </a>
            ) : (
              <a href={href(pk.id)} className="pill pill--sm tl-plan__cta">
                Contratar <span aria-hidden>→</span>
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}

type Included = { title: string; text?: string | null }

/**
 * A única seção de planos do site (página inicial, id="planos"): título, cartões, o que vem em todos
 * os planos e a comparação, recolhida no botão "Comparar os planos".
 */
export function PlansSection({
  plans,
  showPrices,
  href,
  whatsapp,
  included,
  payNote,
  nextNote,
}: {
  plans: Plan[]
  showPrices: boolean
  href: (id: string) => string
  whatsapp: (name: string) => string | null
  included: Included[]
  payNote: string
  nextNote: string
}) {
  const featured = featuredPlan(plans)
  const perks = [...new Map(plans.flatMap((p) => p.perks).map((x) => [x.title, x])).values()]
  return (
    <section className="tl-sec" id="planos" aria-labelledby="planos-titulo">
      <div className="tl-container">
        <p className="sec-label" data-rv="">
          / PLANOS
        </p>
        <div className="sec-head">
          <h2 id="planos-titulo" className="display" data-rv="">
            Escolha o seu plano
          </h2>
          <p className="tl-lead" data-rv="" style={{ '--d': '80ms' } as React.CSSProperties}>
            Quanto mais longo, menor o valor por mês.
          </p>
        </div>
        {plans.length === 0 ? (
          <p className="tl-lead">Os planos serão publicados em breve. Fale pelo WhatsApp.</p>
        ) : (
          <>
            <PlanGrid plans={plans} showPrices={showPrices} href={href} whatsapp={whatsapp} />
            <p className="tl-plans__note" data-rv="">
              {payNote}
            </p>
            <p className="tl-plans__note tl-plans__note--next" data-rv="">
              {nextNote}
            </p>
          </>
        )}
        {included.length > 0 && (
          <div className="included" data-rv="">
            <h3 className="mono-label">INCLUSO EM TODOS OS PLANOS</h3>
            <ul className="mono-list mono-list--wrap">
              {included.map((it) => (
                <li key={it.title}>
                  {it.title}
                  {it.text ? ` (${it.text.replace(/\.$/, '').toLocaleLowerCase('pt-BR')})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {plans.length > 0 && (included.length > 0 || perks.length > 0) && (
          <details className="plans-compare" data-rv="">
            <summary className="ulink">Comparar os planos</summary>
            <div className="compare-scroll">
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
                  {included.map((it) => (
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
          </details>
        )}
      </div>
    </section>
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
