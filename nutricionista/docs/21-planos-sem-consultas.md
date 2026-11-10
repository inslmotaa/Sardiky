# Uma seção de planos e sem consultas avulsas

O André trabalha com **planos de consultoria**, não com consultas avulsas. O site tem uma única seção de planos, e o agendamento saiu do sistema.

## Fluxo do cliente

**Ver planos → Contratar (Mercado Pago) → Criar conta → Anamnese → Plano no app.**

1. **Ver planos.** O cliente abre a seção **Planos** da página inicial (`/#planos`).
2. **Contratar.** O botão leva ao checkout do Mercado Pago (Pix, cartão ou boleto).
   - Sem conta, o cliente cria a conta antes de pagar.
   - Com conta, vai direto ao pagamento.
3. **Anamnese.** Depois do pagamento aprovado, o cliente responde a anamnese no site (ou pelo formulário do coach).
4. **Avaliação por videochamada.** Está incluída nos planos e é combinada pelo **WhatsApp**. O coach registra o resultado em **Ficha → Avaliações e evolução**, como antes.
5. **Plano no app.** O coach monta o plano e ativa; ele aparece na tela **Hoje** e em **Plano**.

## Uma única seção de planos (`/#planos`)

- **Onde fica:** só na página inicial, com `id="planos"`, logo depois de "Como funciona a consultoria".
- **O que traz, nesta ordem:**
  - o título "Escolha o seu plano" e a frase "Quanto mais longo, menor o valor por mês";
  - os cards Mensal, Trimestral, Semestral e Anual, com "Mais escolhido" e o botão **Contratar**;
  - o bloco **Incluso em todos os planos**;
  - a comparação dos planos, recolhida no botão **Comparar os planos**.
- **Componente:** um só (`PlansSection`, em `src/components/SiteBlocks.tsx`), que usa o `PlanGrid` e os dados que já existiam (`planPrices` e `plansIncluded`).
- **"Como funciona a consultoria":** fica só com as 4 etapas e um botão **Ver planos**, que rola até `#planos`. A página `/como-funciona` não repete planos, preços nem o "Incluso".
- **Valores desligados** (Configurações → Perfil → "Mostrar os valores dos planos"): os cards ficam sem preço e o botão vira **Falar no WhatsApp**, com o nome do plano no texto.
- **Redirecionamentos permanentes (301) para `/#planos`:**
  - `/planos`;
  - `/agendar` e `/agendar/...`.
- **Links:** "Ver planos", "Planos" e "Contratar" apontam para `/#planos` em todo lugar:
  - menu, hero, rodapé, Sobre, Como funciona e contato;
  - posts do blog;
  - e-mail de vencimento (link "Ver todos os planos").

  No menu, o link **Planos** fica ativo enquanto a seção está na tela.
- **SEO:**
  - `/planos` saiu do sitemap;
  - o título e a descrição da página inicial citam os planos;
  - o JSON-LD do serviço traz o catálogo de planos (`OfferCatalog`), com preço só quando os valores estão ligados.

## O que saiu (Parte 8)

### Site público

- **Páginas:** `/agendar` e `/agendar/confirmado` saíram (com redirecionamento).
- **Botões:** "Agendar consulta", "Escrever o próximo capítulo" e afins viraram **Ver planos** (principal) e **Falar no WhatsApp** (secundário).
- **Como funciona:** 4 etapas, sem consulta: Escolha seu plano → Crie sua conta e responda a anamnese → Avaliação e metas (pelo WhatsApp) → Plano no app, ajustado a cada 15 dias.
- **Dúvidas:** as perguntas sobre consulta viraram "Como começa o acompanhamento?" e "Como é a avaliação por videochamada?".
- **Formulário de contato (interessados):** continua. A ação de pedido de agendamento saiu de `src/actions/public.ts`.
- **Perfil:** a opção `site.agendamento` (`booking_channel`) saiu de `perfil.json`, de `scripts/aplicar-perfil.mjs` e das Configurações. No `perfil.json` também saíram os serviços e os horários de atendimento; o bloco `agenda` guarda só o fuso horário.

### App do cliente

- **Início e Hoje:** sem o card "Próxima consulta". A etapa atual do acompanhamento passa a ser Plano contratado → Anamnese → Avaliação e metas → Plano no app → Acompanhamento.
- **Rotas:** `/paciente/consultas` e o `.ics` da consulta saíram. O gerador de iCalendar ficou em `src/lib/ics.ts` (usado pelos lembretes no calendário da Parte 5).
- **Menu Mais:** sem Agenda, confirmar presença, pedir remarcação e avaliar a consulta.
- **Seu depoimento** (`/paciente/depoimento`): entra no lugar da avaliação da consulta. O cliente avalia o acompanhamento e, se quiser, autoriza o depoimento no site. Continua com a aprovação do coach e com a retirada da autorização a qualquer momento.
- **Notificações:** sem os lembretes de consulta (24 h e 2 h).
- **Anamnese e criar conta:** não falam mais em consulta. A anamnese aparece logo depois da contratação.

### Painel do coach

- **Menu e rotas:** saíram a Agenda (`/admin/agenda`, `/nova`, `/[id]`), a aba Consultas da ficha e o atalho de feriados nacionais.
- **Início:**
  - saem "Consultas hoje", os retornos vencidos e as confirmações pendentes;
  - entram **Check-ins pendentes**, **Sem registro há 3+ dias** e a lista de check-ins atrasados;
  - **Vencem nesta semana** continua.
- **Configurações:**
  - saem serviços, horários de atendimento, bloqueios, regras de agenda e os modelos de mensagem de consulta;
  - o módulo financeiro e a retenção de interessados ficam em **Módulos e retenção**;
  - os horários do chat continuam.
- **Equipe:** a permissão "Agenda e agendamentos" saiu.
- **Relatórios e CSV:**
  - saem atendimentos, faltas e cancelamentos;
  - ficam clientes, adesão, evolução e receitas;
  - entram os **vencimentos**, com CSV.
- **Lista de clientes:** mostra "Término do plano" e "Próximo check-in".
- **Financeiro:** todo lançamento é de um **plano contratado** (o campo "Plano contratado" é obrigatório e a descrição sai do nome do plano). Não há mais cobrança por consulta.
- **Tarefa periódica:** sem os lembretes de consulta (24 h e 2 h), sem a sala do Jitsi e sem a limpeza de pedidos pendentes. Continuam os lembretes de refeição, água, pesagem, check-in e vencimento.
- **Código apagado:** `src/lib/booking.ts`, `src/lib/scheduling.ts`, `src/lib/feriados.ts`, `src/actions/admin/appointments.ts` e os testes de unidade deles.

## Banco de dados

**Sem migração destrutiva:** as tabelas `appointments`, `services`, `working_hours` e `time_blocks` continuam no banco, mas o código não as usa mais.

- O seed não grava mais dados nelas.
- Os pagamentos de exemplo são de planos.
- Na exportação de dados do cliente (LGPD), as consultas antigas continuam saindo, se existirem.

## Testes

`tests/e2e/planos-sem-consultas.spec.ts`:

- só existe um elemento com os cards de planos em todo o site, na seção `#planos` logo depois de "Como funciona", com a comparação recolhida;
- o link "Planos" do menu fica ativo com a seção na tela;
- `/planos`, `/agendar` e `/agendar/confirmado` respondem 301 para `/#planos`;
- nenhum link interno do site ou do app aponta para `/planos` ou `/agendar`;
- nenhuma página do site nem do app mostra "Agendar", "Próxima consulta" ou a palavra "consulta" sozinha (`\bconsulta\b`, para não pegar "consultoria");
- o fluxo completo Ver planos → Contratar → checkout (`tests/e2e/mp-falso.mjs`) → Criar conta → Anamnese → coach ativa o plano → plano no app funciona de ponta a ponta;
- com os valores desligados, os cards ficam sem preço e o botão vira "Falar no WhatsApp".

Os testes antigos de agendamento (unidade de `scheduling` e feriados; e2e de agenda, remarcação e confirmação de pedido) saíram. Os outros foram ajustados ao fluxo novo.
