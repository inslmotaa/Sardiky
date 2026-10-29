import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'
import { PRIVACY_VERSION } from '@/lib/constants'

export const metadata: Metadata = { title: 'Política de privacidade' }

/** Política de privacidade (LGPD). Campos ainda não preenchidos em Configurações aparecem entre colchetes. */
export default async function PrivacyPage() {
  const s = await getSettings()
  const contact = s.privacyContact || s.contactEmail || '[E-MAIL DE CONTATO]'
  const doc = s.responsibleDocument || '[CPF/CNPJ DO RESPONSÁVEL]'
  return (
    <section className="section">
      <div className="container prose">
        <span className="eyebrow">LGPD · Lei 13.709/2018</span>
        <h1>Política de privacidade</h1>
        <p className="muted">Versão {PRIVACY_VERSION}.</p>
        <p className="alert alert--warn small">
          Modelo inicial para orientar a implantação. Antes de divulgar o site, revise o texto com um profissional jurídico e ajuste-o à realidade do
          atendimento.
        </p>

        <h2>1. Quem cuida dos seus dados</h2>
        <p>
          O responsável (controlador) pelos seus dados é {s.professionalName}, {s.professionalTitle}
          {s.registry ? ` (${s.registry})` : ''}, CPF/CNPJ {doc}. Para qualquer assunto sobre seus dados pessoais, fale pelo e-mail{' '}
          <strong>{contact}</strong>.
        </p>

        <h2>2. Quais dados coletamos e para quê</h2>
        <p>
          Dados de saúde são <strong>dados pessoais sensíveis</strong> (art. 5º, II, da LGPD) e recebem proteção reforçada. Coletamos apenas o necessário
          para o seu acompanhamento nutricional:
        </p>
        <ul>
          <li>
            <strong>Cadastro e conta</strong> (nome, e-mail, WhatsApp, senha protegida por hash e, se você escolher, os dados básicos da sua conta Google):
            para criar o seu acesso, falar com você e manter a conta segura.
          </li>
          <li>
            <strong>Anamnese e saúde</strong> (data de nascimento, objetivo, doenças, medicamentos, suplementos, alergias, cirurgias, exames enviados,
            medidas, rotina e hábitos alimentares): para avaliar, montar e ajustar o seu plano. Base legal: tutela da saúde por profissional da área e o seu
            consentimento específico (art. 11 da LGPD).
          </li>
          <li>
            <strong>Acompanhamento</strong> (plano alimentar, diário, fotos de refeições e de evolução, água, peso, mensagens, consultas e prescrições): para
            acompanhar a sua evolução entre as consultas.
          </li>
          <li>
            <strong>Pagamentos</strong> (plano escolhido, valores e recibos): para cumprir obrigações legais e contratuais.
          </li>
          <li>
            <strong>Registros de acesso</strong> (data, hora e endereço IP de ações relevantes): para segurança e cumprimento do Marco Civil da Internet.
          </li>
        </ul>
        <p>Não vendemos dados e não usamos seus dados para publicidade.</p>

        <h2>3. Quem acessa</h2>
        <p>
          Seus dados de saúde são acessados <strong>somente pelo {s.professionalName}</strong>, responsável pelo seu atendimento. Cada cliente entra com
          login próprio e vê apenas os próprios dados. Empresas que prestam serviços essenciais ao funcionamento do site (hospedagem, banco de dados, envio
          de e-mails) só tratam os dados para isso, com obrigação de confidencialidade e segurança, e nunca para fins próprios. Compartilhamos dados com
          autoridades apenas quando a lei exigir.
        </p>
        <p>
          Conversas pelo WhatsApp ficam no aplicativo WhatsApp (Meta), fora deste site. Por isso, prefira enviar exames e dados de saúde pela área do
          cliente.
        </p>

        <h2>4. Onde ficam guardados</h2>
        <ul>
          <li>Em servidor contratado pelo responsável pelo atendimento, num banco de dados protegido por senha e acessível apenas pelo próprio sistema.</li>
          <li>Exames e fotos ficam em área privada: só abrem para você e para o coach, depois de conferido o login.</li>
          <li>Toda a comunicação usa conexão criptografada (HTTPS). Senhas nunca são guardadas em texto: só um resumo criptográfico.</li>
          <li>Há cópia de segurança diária, guardada de forma protegida, e registro das ações sensíveis no painel.</li>
        </ul>

        <h2>5. Por quanto tempo</h2>
        <p>
          Enquanto você estiver em acompanhamento. Depois, a ficha de acompanhamento é mantida pelo prazo exigido pelas normas profissionais e pela
          legislação aplicável e, ao fim desse prazo, é eliminado ou anonimizado. Contatos de quem não se tornou cliente são eliminados em até{' '}
          {s.leadRetentionDays} dias.
        </p>

        <h2>6. Seus direitos</h2>
        <p>Você pode, a qualquer momento:</p>
        <ul>
          <li>
            <strong>Acessar</strong> seus dados: na área do cliente, em Perfil, use “Baixar meus dados”.
          </li>
          <li>
            <strong>Corrigir</strong> dados incompletos ou desatualizados: pela área do cliente ou pelo e-mail abaixo.
          </li>
          <li>
            <strong>Excluir</strong> sua conta: em Perfil, “Excluir minha conta”. O acesso é encerrado na hora; os registros da ficha que a lei manda
            guardar ficam protegidos até o fim do prazo e depois são anonimizados.
          </li>
          <li>Pedir portabilidade, informações sobre o compartilhamento e revogar o consentimento.</li>
        </ul>
        <p>
          Pedidos e dúvidas: <strong>{contact}</strong>. Respondemos no prazo da LGPD. Você também pode procurar a Autoridade Nacional de Proteção de Dados
          (ANPD).
        </p>

        <h2>7. Cookies</h2>
        <p>
          Usamos apenas cookies essenciais: um mantém você conectado e outro, temporário, protege o login com o Google. Não usamos cookies de publicidade
          nem rastreamento de terceiros.
        </p>

        <h2>8. Alterações</h2>
        <p>Quando esta política mudar, a nova versão será publicada nesta página com a data de atualização.</p>
      </div>
    </section>
  )
}
