import Link from 'next/link'
import { SaberMaisForm } from '@/components/Captacao'

/** Fim de cada conteúdo: convite para ver os planos (ou falar no WhatsApp). */
export function PostCta({ whatsapp, firstName }: { whatsapp: string | null; firstName: string }) {
  return (
    <aside className="post-cta" aria-labelledby="post-cta-titulo">
      <p className="sec-label">/ PRÓXIMO PASSO</p>
      <h2 id="post-cta-titulo" className="display">
        Quer levar isso para a sua rotina?
      </h2>
      <p>No acompanhamento, o {firstName} monta um plano para a sua realidade e ajusta junto com você, pelo app.</p>
      <div className="tl-actions">
        <Link href="/#planos" className="pill pill--solid">
          Contratar um plano <span aria-hidden>→</span>
        </Link>
        {whatsapp && (
          <a href={whatsapp} className="pill" target="_blank" rel="noopener noreferrer">
            Falar no WhatsApp
          </a>
        )}
      </div>
      <div className="post-cta__more">
        <p className="post-cta__more-title">Prefere tirar dúvidas antes? Deixe seu WhatsApp.</p>
        <SaberMaisForm id="saber-mais-post" />
      </div>
    </aside>
  )
}
