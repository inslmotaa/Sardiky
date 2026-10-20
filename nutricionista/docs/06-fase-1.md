# Fase 1 da plataforma — entregue e pendente

Construída sobre o site e o sistema que já existiam (nada foi refeito do zero). Dados fictícios.

## Entregue

| Item da especificação | Onde está |
|---|---|
| Landing com planos de acompanhamento, app do paciente e anamnese | `/` (seções `#planos`, `#app`, botões “Preencher anamnese”) |
| Login, perfis (nutricionista, equipe, paciente) e isolamento entre pacientes | `/login`; `patientId` sempre vem da sessão; testes em `tests/e2e/security.spec.ts` |
| Atalhos `/entrar`, `/app`, `/painel` e página “criar conta” (acesso por convite) | `next.config.ts`, `/criar-conta` |
| Cadastro de paciente com sexo e altura, convite com botão de WhatsApp | Painel → Pacientes |
| Anamnese por link externo (Google Forms) e marcação de recebida | Configurações (link) · ficha do paciente → Formulários |
| Base de alimentos (60 itens com referência TACO), medidas caseiras, fator de cocção, alimento próprio por rótulo | Painel → Alimentos |
| Editor de plano: modo calculado ou livre, dias (treino/descanso), opções por refeição, gramas ↔ medida caseira, totais e metas de kcal/macros com cores, sugestões de substituição dentro de ±10%, “sem substituição”, modelos, desfazer/refazer, prévia no celular, revisão obrigatória antes de ativar | Painel → Planos |
| App do paciente: Hoje (próxima refeição, feita/parcial/pulada, consumido × planejado), Plano, água, peso, Progresso, Mais, primeiro acesso guiado | `/paciente` |
| Recursos por paciente (mostrar ou ocultar calorias, macros, diário, chat, calculadoras, água, peso) | Ficha do paciente → Resumo |
| Calculadoras: porções (g/kg), medida ↔ gramas, cru ↔ cozido, equivalência, receita, IMC (OMS e Lipschitz), peso saudável, cintura/quadril, TMB/GET (Mifflin, Harris-Benedict, Katch-McArdle, Cunningham), macros, água, projeção | Painel → Calculadoras · app do paciente → Mais |
| Critérios de aceite (Mifflin 1.420,25 / 2.201,4; IMC 25,7; 150 g = 192 kcal; 3 colheres recalcula; ±10%; 360 px; isolamento) | Testes de unidade e ponta a ponta |

## Ainda não feito (fica para as próximas fases ou depende do André)

- **CRN do André:** não foi informado; o site ainda mostra um registro fictício.
- **Tabela de alimentos:** os valores da base inicial precisam ser conferidos com a TACO oficial; a base completa (≈600 itens) e IBGE/USDA ainda não foram importadas.
- **Supabase e RLS no banco:** mantivemos PostgreSQL + Next.js; o isolamento é feito no servidor e testado. RLS no banco pode ser adicionado como segunda camada.
- **Login com Google e link mágico por e-mail.**
- **PWA instalável com plano disponível sem internet e notificações push** (lembretes de refeição e água) — previsto para a Fase 2.
- **Modo escuro.**
- **Plano aparecer “em até 5 s” sem recarregar:** hoje aparece ao abrir ou atualizar a tela; atualização em tempo real fica para a Fase 2.
- **Vários nutricionistas, cada um vendo só os próprios pacientes** (hoje há um nutricionista e a equipe).
- **Lighthouse:** pontuação de desempenho e acessibilidade ainda não medida em ambiente publicado.
