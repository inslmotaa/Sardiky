import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'
import { PRIVACY_VERSION } from '@/lib/constants'

export const metadata: Metadata = { title: 'Política de Privacidade' }

export default async function PrivacyPage() {
  const s = await getSettings()
  const contact = s.privacyContact ?? s.contactEmail ?? 'o contato informado no site'
  return (
    <section className="section">
      <div className="container prose">
        <span className="eyebrow">LGPD · Lei 13.709/2018</span>
        <h1>Política de Privacidade</h1>
        <p className="muted">Versão {PRIVACY_VERSION}.</p>
        <p className="alert alert--warn small">
          Modelo inicial para orientar a implantação. Antes de publicar, revise o texto com um profissional jurídico e
          ajuste-o à realidade do consultório.
        </p>

        <h2>1. Quem é responsável pelos seus dados</h2>
        <p>
          O controlador dos dados é {s.professionalName} ({s.professionalTitle}
          {s.registry ? `, ${s.registry}` : ''}). Para qualquer assunto relacionado aos seus dados pessoais, fale com o
          encarregado pelo canal: <strong>{contact}</strong>.
        </p>

        <h2>2. Quais dados coletamos e para quê</h2>
        <ul>
          <li>
            <strong>Contato e agendamento</strong> (nome, e-mail, telefone, serviço e horário escolhidos): para responder ao
            seu contato e organizar a agenda. Base legal: procedimentos preliminares a pedido do titular e consentimento.
          </li>
          <li>
            <strong>Dados de saúde e acompanhamento</strong> (anamnese, avaliações, medidas, diário alimentar, fotos de
            refeições enviadas por você, plano alimentar e mensagens): exclusivamente para a prestação do serviço de
            nutrição. Base legal: tutela da saúde por profissional da área e consentimento específico (art. 11 da LGPD).
          </li>
          <li>
            <strong>Dados financeiros</strong> (valores, pagamentos e recibos): para cumprir obrigações legais e
            contratuais.
          </li>
          <li>
            <strong>Registros de acesso</strong> (data, hora e endereço IP de ações relevantes): para segurança e
            cumprimento do Marco Civil da Internet.
          </li>
        </ul>
        <p>Pedimos apenas os dados necessários para o atendimento. Não vendemos nem compartilhamos dados para publicidade.</p>

        <h2>3. Com quem compartilhamos</h2>
        <p>
          Somente com operadores necessários ao funcionamento do serviço (hospedagem, banco de dados, envio de e-mails),
          contratados com cláusulas de confidencialidade e segurança, ou quando exigido por lei ou autoridade competente.
        </p>

        <h2>4. Como protegemos</h2>
        <ul>
          <li>Conexão criptografada (HTTPS) em todas as páginas.</li>
          <li>Senhas armazenadas com algoritmo de hash resistente; nunca em texto puro.</li>
          <li>Acesso por perfil: cada paciente vê apenas os próprios dados; a equipe só acessa o que precisa.</li>
          <li>Registro de atividades relevantes e de alterações em informações sensíveis.</li>
          <li>Cópias de segurança periódicas e procedimento de recuperação.</li>
        </ul>

        <h2>5. Por quanto tempo guardamos</h2>
        <p>
          Os dados de contato de quem não se tornou paciente são eliminados em até {s.leadRetentionDays} dias. Os
          registros do prontuário nutricional são mantidos pelo prazo exigido pelas normas profissionais e pela legislação
          aplicável; depois disso, são eliminados ou anonimizados de forma segura.
        </p>

        <h2>6. Seus direitos</h2>
        <p>
          Você pode solicitar confirmação de tratamento, acesso, correção, portabilidade, anonimização ou eliminação dos
          dados, informações sobre compartilhamento e revogação do consentimento. Pacientes podem fazer os pedidos pela
          área do paciente (Meus dados) ou pelo canal {contact}. Alguns dados podem ser mantidos quando a lei exigir.
        </p>

        <h2>7. Cookies</h2>
        <p>
          Usamos apenas um cookie essencial, que mantém você conectado à área do paciente. Não usamos cookies de
          publicidade nem ferramentas de rastreamento de terceiros.
        </p>

        <h2>8. Alterações</h2>
        <p>Quando esta política mudar, a nova versão será publicada nesta página com a data de atualização.</p>
      </div>
    </section>
  )
}
