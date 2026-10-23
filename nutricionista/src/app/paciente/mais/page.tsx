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
    ...(p.features.chat ? ([['/paciente/mensagens', 'Mensagens', 'Converse com o coach']] as [string, string, string][]) : []),
    ['/paciente/consultas', 'Agenda', 'Próximas consultas, confirmar presença, remarcar e avaliar'],
    ['/paciente/compras', 'Lista de compras', 'Gerada do seu plano da semana'],
    ['/paciente/receitas', 'Receitas', 'Receitas do seu plano e sugestões'],
    ['/paciente/materiais', 'Materiais', 'E-books, vídeos e guias'],
    ['/paciente/formularios', 'Anamnese e questionários', 'Formulários enviados pelo coach'],
    ...(p.features.calculadoras ? ([['/paciente/calculadoras', 'Calculadoras', 'Porções, IMC, água e mais']] as [string, string, string][]) : []),
    ['/paciente/notificacoes', 'Notificações', 'Lembretes de refeição e água, horário de silêncio'],
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
        <Link href="/paciente/anamnese" className="btn btn--primary" style={{ justifySelf: 'start' }}>
          {p.anamnesisReceivedAt ? 'Ver minha anamnese' : 'Preencher anamnese'}
        </Link>
      </section>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn--whatsapp">
          Falar pelo WhatsApp
        </a>
      )}
    </div>
  )
}
