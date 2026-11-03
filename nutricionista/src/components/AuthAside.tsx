/**
 * Painel verde da tela de acesso (entrar e criar conta): o que o cliente e o coach encontram depois de entrar.
 * Sem dependências do Next: a prévia em arquivo único usa o mesmo painel.
 */
export function AuthAside({ siteName, professional }: { siteName: string; professional: string }) {
  const first = professional.split(' ')[0]
  return (
    <aside className="tl-auth__aside" aria-label={`Sobre a área ${siteName}`}>
      <p className="tl-auth__eyebrow">Área do cliente · Painel do coach</p>
      <h2 className="tl-auth__title">Seu acompanhamento, em um só lugar.</h2>
      <ul className="tl-auth__list">
        <li>Plano alimentar com as refeições do dia, quantidades e substituições</li>
        <li>Diário com foto, progresso, fotos de evolução e exames (opcionais)</li>
        <li>Conversa direta com o {first} e lembretes no celular</li>
        <li>Para o coach: clientes, planos, agenda e acompanhamento no painel</li>
      </ul>
      <p className="tl-auth__note">Seus dados de saúde ficam protegidos (LGPD): cada pessoa só vê o que é seu.</p>
    </aside>
  )
}
