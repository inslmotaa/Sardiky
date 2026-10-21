# Fase 3 — Gestão: entregue e pendente

Construída sobre as fases anteriores. Dados fictícios. Novo acesso de demonstração: **nutri2@example.com / Equipe#Demo2026** (nutricionista que vê só a paciente Helena).

## Entregue

| Item da especificação | Onde está |
|---|---|
| Agenda: tipos de consulta com duração e preço, horários, bloqueios, link público de agendamento | Já existia; agora o agendamento termina com o botão **Preencher anamnese** |
| Feriados nacionais (fixos e móveis) bloqueados com um clique, sem duplicar | Painel → Agenda → Feriados nacionais |
| Lembretes 24 h e 2 h: push (paciente e equipe), e-mail (24 h e 2 h) e link de WhatsApp na consulta | Tarefa agendada `/api/cron` |
| Videochamada: sala do **Jitsi Meet** gerada ao confirmar consulta on-line (ou por botão); aceita link do Meet/Zoom | Painel → consulta · App → Consultas |
| Paciente confirma presença, pede remarcação e **avalia a consulta** (1 a 5 estrelas + comentário) | App → Mais → Agenda · Painel → consulta |
| **Anamnese nativa**: construtor com seções, texto, múltipla escolha, caixas, **escala**, número, data e **envio de exame**; modelo completo (objetivo, saúde, alergias, exames, rotina, sono, atividade, água e álcool, intestino, preferências, recordatório 24 h, frequência, orçamento, quem cozinha) | Painel → Formulários |
| Consentimento para dados de saúde antes da anamnese (versão e data registradas) | App → Formulários |
| Respostas alimentam a ficha: **restrições** (geram alerta no editor de planos) e objetivo | Ficha → Resumo → Restrições alimentares |
| Anamnese enviada automaticamente a cada paciente novo | Configurações → Planos, anamnese e PDF |
| **Webhook** para Google Forms/Tally/Typeform: cria ou atualiza o paciente | `/api/webhooks/anamnese` (abaixo) |
| **Receitas**: ingredientes da base, cálculo por porção e por 100 g, peso final, rendimento, tempo, etiquetas, foto; adicionadas às refeições do plano; biblioteca do paciente | Painel → Receitas · App → Receitas |
| **Materiais educativos** (PDF, vídeo, guia, link) para todos ou pacientes escolhidos | Painel → Materiais · App → Materiais |
| **Lista de compras** da semana gerada do plano (receitas viram ingredientes, cozidos em peso cru), itens marcáveis, disponível sem internet | App → Plano / Mais |
| **Prescrições**: suplementos, fitoterápicos e exames (dose, horário, duração), no app e no PDF | Ficha → Prescrições |
| Financeiro: pagamentos **atrasados**, link de cobrança pelo WhatsApp, indicador no Início | Painel → Financeiro |
| **Equipe**: nutricionistas que veem só os próprios pacientes; nutricionista responsável na ficha | Configurações → Equipe · Ficha → Dados cadastrais |
| **Marca**: logo e assinatura no PDF, refeições padrão dos planos novos | Configurações → Perfil / Planos, anamnese e PDF |

## Webhook da anamnese (Google Forms)

1. Defina `ANAMNESE_WEBHOOK_SECRET` no servidor (`openssl rand -base64 32`).
2. No Google Forms: **⋮ → Editor de scripts** e cole (troque o endereço e o segredo):

```js
const URL = 'https://SEU-DOMINIO/api/webhooks/anamnese'
const SEGREDO = 'COLE_AQUI_O_ANAMNESE_WEBHOOK_SECRET'

function aoEnviar(e) {
  const respostas = {}
  let email = e.response.getRespondentEmail()
  for (const r of e.response.getItemResponses()) {
    const pergunta = r.getItem().getTitle()
    respostas[pergunta] = r.getResponse()
    if (!email && /e-?mail/i.test(pergunta)) email = String(r.getResponse())
  }
  UrlFetchApp.fetch(URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + SEGREDO },
    payload: JSON.stringify({ email: email, respostas: respostas }),
    muteHttpExceptions: true,
  })
}
```

3. Em **Acionadores**, adicione `aoEnviar` no evento **Ao enviar formulário**.
4. Perguntas cujo título fala em “restrição”, “alergia” ou “intolerância” viram restrições na ficha; “objetivo” vira o objetivo do paciente. O paciente é encontrado pelo e-mail (ou criado).

## Decisões e diferenças em relação à especificação

- **Videochamada pelo Jitsi Meet** (gratuito, sem conta e sem chave de API). Google Meet automático exigiria conta Google Workspace e integração OAuth; o campo aceita colar um link do Meet a qualquer momento.
- **Isolamento entre nutricionistas** feito no servidor (mesma regra do isolamento entre pacientes), com testes; não usa RLS do banco.
- **Feriados estaduais e municipais** não são automáticos: bloqueie um a um na agenda.

## Ainda não feito

- **CRN do André** e conferência dos valores da TACO (pendentes desde a Fase 1); base completa da TACO/TBCA.
- Cobrança automática por **Pix/cartão** (Mercado Pago ou Asaas) — a especificação deixa para “fases futuras”; hoje o financeiro registra e lembra pelo WhatsApp.
- **API oficial do WhatsApp Business** (hoje: links com mensagem pronta).
- Login com Google e link mágico; modo escuro.
- Notificações push e instalação do app ainda precisam ser conferidas em um Android e um iPhone reais.
- Lighthouse e testes no ambiente publicado (HTTPS, servidor real).
