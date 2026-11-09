import Link from 'next/link'
import { BookingLink } from '@/components/BookingLink'
import type { BookingTarget } from '@/lib/format'
import { SaberMaisForm } from '@/components/Captacao'

/** Fim de cada conteúdo: convite para agendar a consulta ou contratar um plano. */
export function PostCta({ booking, firstName }: { booking: BookingTarget; firstName: string }) {
  return (
    <aside className="post-cta" aria-labelledby="post-cta-titulo">
      <p className="sec-label">/ PRÓXIMO PASSO</p>
      <h2 id="post-cta-titulo" className="display">
        Quer levar isso para a sua rotina?
      </h2>
      <p>No acompanhamento, o {firstName} monta um plano para a sua realidade e ajusta junto com você, pelo app.</p>
      <div className="tl-actions">
        <BookingLink to={booking} className="pill pill--solid">
          Agendar consulta <span aria-hidden>→</span>
        </BookingLink>
        <Link href="/planos" className="pill">
          Contratar um plano <span aria-hidden>→</span>
        </Link>
      </div>
      <div className="post-cta__more">
        <p className="post-cta__more-title">Prefere tirar dúvidas antes? Deixe seu WhatsApp.</p>
        <SaberMaisForm id="saber-mais-post" />
      </div>
    </aside>
  )
}
