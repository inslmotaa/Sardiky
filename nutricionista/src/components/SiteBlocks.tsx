import { money } from '@/lib/format'
import type { PlanPrice } from '@/lib/planos'

/** Fundo líquido (WebGL, ligado pelo site-fx) com o grão por cima. */
export function Liquid() {
  return (
    <>
      <canvas className="liquid" data-liquid="" aria-hidden />
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

/** Topo das páginas internas: fundo líquido, rótulo "/ SOBRE" e título largo. */
export function PageHead({ label, title, lead }: { label: string; title: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <section className="tl-pagehead" data-liquid-host="">
      <Liquid />
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

/** Cartões dos planos (início e /planos): bordas finas, valor mensal equivalente e bônus. */
export function PlanGrid({ plans, showPrices, href }: { plans: Plan[]; showPrices: boolean; href: (id: string) => string }) {
  const featured = plans.find((p) => p.highlight) ?? [...plans].sort((a, b) => b.discountPct - a.discountPct)[0]
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
            <a href={href(pk.id)} className="pill pill--sm">
              Escolher plano <span aria-hidden>→</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
