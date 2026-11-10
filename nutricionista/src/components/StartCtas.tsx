/**
 * Botões de início do site: "Ver planos" (principal, rola até #planos) e "Falar no WhatsApp" (secundário).
 * O fluxo do cliente é Ver planos → Contratar (Mercado Pago) → Criar conta → Anamnese → Plano no app.
 */
export function StartCtas({
  whatsapp,
  solid = true,
  plansHref = '/#planos',
  children,
}: {
  whatsapp: string | null
  solid?: boolean
  plansHref?: string
  /** Link extra no fim (ex.: "Dúvidas frequentes"). */
  children?: React.ReactNode
}) {
  return (
    <>
      <a href={plansHref} className={`pill${solid ? ' pill--solid' : ''}`}>
        Ver planos <span aria-hidden>→</span>
      </a>
      {whatsapp && (
        <a href={whatsapp} className={solid ? 'pill' : 'ulink'} target="_blank" rel="noopener noreferrer">
          Falar no WhatsApp
        </a>
      )}
      {children}
    </>
  )
}
