import Link from 'next/link'
import { requirePatient } from '@/lib/auth/session'
import { getPatient } from '@/lib/patient-context'
import { getSettings } from '@/lib/settings'
import { whatsappLink } from '@/lib/format'
import { PageHead } from '@/components/ui'

export default async function MorePage() {
  const user = await requirePatient()
  const s = await getSettings()
  const p = await getPatient(user.patientId)
  const wa = whatsappLink(s.whatsapp, 'Olá! Sou paciente e tenho uma dúvida.')
  const items: [string, string, string][] = [
    ...(p.features.chat ? ([['/paciente/mensagens', 'Mensagens', 'Converse com o nutricionista']] as [string, string, string][]) : []),
    ['/paciente/consultas', 'Agenda', 'Próximas consultas, cancelamento e histórico'],
    ['/paciente/formularios', 'Anamnese e questionários', 'Formulários enviados pelo nutricionista'],
    ...(p.features.calculadoras ? ([['/paciente/calculadoras', 'Calculadoras', 'Porções, IMC, água e mais']] as [string, string, string][]) : []),
    ['/paciente/meus-dados', 'Perfil e privacidade', 'Dados cadastrais, senha, exportação e LGPD'],
  ]
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 680 }}>
      <PageHead title="Mais" />
      <ul className="card list mais-list" style={{ padding: 0 }}>
        {items.map(([href, label, hint]) => (
          <li key={href} style={{ padding: 0 }}>
            <Link href={href}>
              <span>
                {label}
                <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>
                  {hint}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <section className="card stack" style={{ ['--gap' as string]: '10px' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Anamnese</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {p.anamnesisReceivedAt ? 'Sua anamnese já foi recebida.' : 'Ainda não recebemos a sua anamnese. Ela ajuda a montar um plano que combine com você.'}
        </p>
        {s.anamneseUrl && (
          <a href={s.anamneseUrl} target="_blank" rel="noopener noreferrer" className="btn btn--primary" style={{ justifySelf: 'start' }}>
            {p.anamnesisReceivedAt ? 'Abrir formulário de anamnese' : 'Preencher anamnese'}
          </a>
        )}
      </section>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn--whatsapp">
          Falar pelo WhatsApp
        </a>
      )}
    </div>
  )
}
