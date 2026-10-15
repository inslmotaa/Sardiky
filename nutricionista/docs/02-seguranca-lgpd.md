# Segurança, privacidade e LGPD

Este documento descreve as proteções implementadas e o que ainda depende de configuração ou de decisões do consultório. **Não substitui orientação jurídica**: revise a política de privacidade, os termos e os prazos de guarda com um profissional da área antes de usar dados reais.

## Autenticação

- Senhas com **scrypt** (N=2¹⁷, r=8, p=1 — parâmetros recomendados pela OWASP) e sal aleatório; nunca em texto puro.
- Sessão por cookie `httpOnly`, `SameSite=Lax` e `Secure` em produção; no banco fica só o **hash** do token. Validade de 7 dias com renovação enquanto o usuário usa o sistema.
- Bloqueio de 15 minutos após 5 senhas erradas; limite de tentativas por IP; mensagem de erro genérica (não revela se o e-mail existe).
- Recuperação de senha e primeiro acesso por **links de uso único**, guardados como hash, com validade (1 h para redefinição, 7 dias para convites). Redefinir a senha encerra as sessões abertas.
- A equipe nunca define nem vê a senha do paciente.

## Autorização

| Perfil | Acesso |
|---|---|
| Nutricionista (admin) | Tudo |
| Equipe (staff) | Somente as áreas liberadas: agenda, cadastro, dados clínicos, financeiro, relatórios, conteúdo do site. Configurações e LGPD ficam restritas ao administrador. |
| Paciente | Apenas os próprios dados. O identificador do paciente vem **sempre da sessão**, nunca de um parâmetro da URL. |

- Cada Server Action e rota verifica permissão no servidor (não basta esconder botões).
- Arquivos ficam fora da pasta pública e só são entregues por `/arquivos/[id]` após checagem; recursos de outro paciente respondem 404 (não revelam existência).
- Notas clínicas são privadas da equipe clínica e não entram na exportação automática do paciente.

## Proteções da aplicação

- Validação de todas as entradas com Zod no servidor; limites de tamanho em todos os campos.
- Server Actions do Next.js recusam chamadas de outra origem (proteção contra CSRF).
- Cabeçalhos: Content-Security-Policy, HSTS (produção), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Uploads: até 5 MB, tipo verificado pelo **conteúdo** (JPG, PNG, WebP, PDF), nome aleatório, servidos com `Content-Security-Policy: sandbox`.
- Exportações CSV protegidas contra injeção de fórmulas.
- Campo-isca e limite de envios nos formulários públicos contra robôs.
- Nenhuma chave secreta é enviada ao navegador; segredos ficam em variáveis de ambiente (`.env` não é versionado).

## Registro de atividades (auditoria)

Ficam registrados com data, usuário e IP: logins (inclusive falhos), visualização de prontuário e de planos, criação/edição de pacientes (campos alterados, sem o conteúdo), avaliações, notas, documentos, publicação de planos, mudanças de agenda, permissões, exportações e solicitações LGPD. Consulte em **Painel → Privacidade e auditoria**.

## LGPD na prática

| Princípio / direito | Como o sistema atende |
|---|---|
| Base legal e consentimento | Consentimento registrado (tipo, versão da política e data) no agendamento, no formulário de contato, no primeiro acesso e nos termos assinados pelo paciente. |
| Minimização | Formulários públicos pedem só nome e contato; os formulários clínicos são configuráveis e o construtor lembra de pedir só o necessário. |
| Acesso e portabilidade | Paciente baixa os próprios dados em JSON (“Meus dados”). |
| Correção, eliminação, revogação | Solicitação pela área do paciente → fila em “Privacidade e auditoria” com resposta registrada. |
| Eliminação segura | Anonimização irreversível do paciente (remove identificação, conta, conteúdo clínico e arquivos), mantendo só registros sem identificação para estatística e obrigações fiscais. |
| Retenção | Interessados não convertidos são eliminados após o prazo configurado (padrão 180 dias); sessões e links expirados são apagados pela tarefa diária. |
| Segurança | Itens acima + HTTPS + backups criptografados (ver publicação). |
| Encarregado | Contato configurável e exibido na política de privacidade. |

### Decisões que cabem ao consultório

1. **Prazo de guarda do prontuário nutricional**: confirme a exigência do CFN/CRN e da legislação aplicável antes de eliminar dados clínicos a pedido do paciente (a LGPD permite a guarda para cumprimento de obrigação legal).
2. **Texto final** da Política de Privacidade e dos termos de consentimento.
3. **Contratos com operadores** (hospedagem, banco, e-mail) com cláusulas de proteção de dados; prefira provedores com servidores no Brasil ou com garantias para transferência internacional.
4. **Plano de resposta a incidentes**: quem avalia, como comunicar pacientes e a ANPD em caso de vazamento.
5. Liberar dados clínicos à equipe apenas para quem participa do atendimento e tem dever de sigilo.

## Backups e recuperação

Ver `03-publicacao.md` (cópia diária do banco e dos arquivos, retenção de 14 dias, cópia fora do servidor e teste de restauração mensal).
