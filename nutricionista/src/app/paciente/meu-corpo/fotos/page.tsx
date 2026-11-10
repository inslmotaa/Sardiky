import Link from 'next/link'
import { requireActivePatient } from '@/lib/auth/patient-gate'
import { getSettings } from '@/lib/settings'
import { featuresOf } from '@/lib/patient-context'
import { FOTOS_CORPO, hasConsent } from '@/lib/corpo-server'
import { todayIn } from '@/lib/time'
import { sendBodyPhotos, setBodyPhotoConsent } from '@/actions/corpo'
import { BodyPhotoCapture } from '@/components/BodyPhotoCapture'
import { ActionForm, SubmitButton } from '@/components/form'
import { PageHead } from '@/components/ui'

/** Fotos do corpo: autorização específica (uma vez) e captura guiada (frente, lado, costas). */
export default async function BodyPhotosPage({ searchParams }: { searchParams: Promise<{ origem?: string }> }) {
  const sp = await searchParams
  const user = await requireActivePatient()
  const s = await getSettings()
  const [f, consent] = await Promise.all([featuresOf(user.patientId), hasConsent(user.patientId, FOTOS_CORPO)])
  const fromCheckin = sp.origem === 'checkin'
  const back = fromCheckin ? { href: '/paciente/checkin', label: 'Voltar ao check-in' } : { href: '/paciente/evolucao#fotos', label: 'Ver e comparar minhas fotos' }
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead
        title="Fotos do corpo"
        subtitle="Frente, lado e costas. Ficam em área privada: só você e o seu coach veem."
        crumbs={[fromCheckin ? { href: '/paciente/checkin', label: 'Check-in' } : { href: '/paciente/meu-corpo', label: 'Meu corpo' }]}
      />
      {!f.fotosCorpo ? (
        <p className="empty">O envio de fotos do corpo não está liberado para a sua conta. Fale com o seu coach.</p>
      ) : !consent ? (
        <section className="card" aria-labelledby="autorizar-titulo">
          <h2 id="autorizar-titulo" style={{ fontSize: '1.15rem' }}>
            Antes de enviar: sua autorização
          </h2>
          <ul className="small" style={{ paddingLeft: 18 }}>
            <li>As fotos ficam numa pasta privada do servidor e só abrem para você e para o seu coach responsável.</li>
            <li>Nunca aparecem no site, em depoimentos ou no relatório de evolução sem uma autorização separada sua.</li>
            <li>Você pode apagar qualquer foto quando quiser e retirar esta autorização a qualquer momento.</li>
            <li>Antes do envio, o celular reduz a foto e tira os dados escondidos (como a localização).</li>
          </ul>
          <ActionForm action={setBodyPhotoConsent} className="stack">
            <label className="check">
              <input type="checkbox" name="aceite" />
              <span>Autorizo o envio e o armazenamento das minhas fotos do corpo para o acompanhamento.</span>
            </label>
            <div>
              <SubmitButton>Autorizar e continuar</SubmitButton>
            </div>
          </ActionForm>
        </section>
      ) : (
        <>
          <section className="card" aria-labelledby="enviar-titulo">
            <h2 id="enviar-titulo" style={{ fontSize: '1.15rem' }}>
              Tirar ou escolher as fotos
            </h2>
            <BodyPhotoCapture action={sendBodyPhotos} today={todayIn(s.timezone)} doneHref={back.href} doneLabel={back.label} />
          </section>
          <section className="card card--soft">
            <ActionForm action={setBodyPhotoConsent} className="row row--between">
              <span className="small">Você autorizou o envio de fotos do corpo. Pode retirar quando quiser (as fotos já enviadas continuam até você apagá-las).</span>
              <input type="hidden" name="intent" value="revogar" />
              <SubmitButton className="btn btn--sm btn--ghost">Retirar autorização</SubmitButton>
            </ActionForm>
            <p className="small" style={{ margin: '8px 0 0' }}>
              <Link href={back.href}>{back.label}</Link>
            </p>
          </section>
        </>
      )}
    </div>
  )
}
