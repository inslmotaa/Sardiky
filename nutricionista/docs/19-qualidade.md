# Qualidade antes de publicar (Parte 6)

Três camadas: medição de desempenho e acessibilidade, testes automáticos e uma lista manual para aparelhos e contas reais (em [09-lancamento.md](09-lancamento.md#qualidade-antes-de-publicar-parte-6)).

## 1. Lighthouse ≥ 90 (desempenho e acessibilidade)

Medido sempre no **build de produção**, com a simulação de celular padrão do Lighthouse (4G lento, CPU 4× mais lenta):

```bash
npm run build
NUTRI_DATA_DIR=/tmp/lh-db ALLOW_PGLITE=1 APP_URL=http://localhost:3100 npx next start -p 3100 &
npm run setup            # só na primeira vez, para criar o banco de demonstração em /tmp/lh-db
npm run lighthouse       # mede e grava os relatórios em lighthouse/
```

- **Páginas medidas:**
  - site: `/`, `/sobre`, `/como-funciona`, `/planos`, `/conteudos`, `/duvidas`, `/login`;
  - app do cliente, já logado com a conta de demonstração: `/paciente` (Hoje), `/paciente/plano` e `/paciente/diario`.
- **Regra:** o script termina com erro se alguma nota ficar abaixo de 90. Para mudar, use `LH_MIN=95 npm run lighthouse`; para outro endereço, `npm run lighthouse -- https://homologacao.DOMINIO`.
- **Relatórios:** um HTML por página na pasta `lighthouse/` (fora do git), com o motivo de cada ponto perdido.

### Última medição (build de produção, após a Parte 8; `/planos` virou a seção `/#planos` da página inicial)

| Página | Desempenho | Acessibilidade |
|---|---|---|
| `/` | 92 | 100 |
| `/sobre` | 94 | 100 |
| `/como-funciona` | 94 | 100 |
| `/conteudos` | 94 | 100 |
| `/duvidas` | 94 | 100 |
| `/login` | 93 | 100 |
| `/paciente` (Hoje) | 92 | 100 |
| `/paciente/plano` | 93 | 100 |
| `/paciente/diario` | 95 | 100 |

A nota de desempenho varia 1 a 3 pontos entre medições na mesma máquina (é uma simulação). Por isso a meta tem folga.

### O que foi ajustado para chegar lá

- **Fontes:** Inter, Archivo e Geist Mono pelo `next/font/local`.
  - Só o subconjunto latino, com pré-carregamento e métricas de reserva (sem "pulo" do texto).
  - Antes, as fontes eram descobertas tarde, só depois do CSS.
  - A Archivo foi cortada para as faixas que o CSS usa (peso 400 a 800, largura 100% a 125%): 59 KB em vez de 90 KB, com o mesmo visual. O arquivo fica em `src/app/fonts/` e é gerado por `scripts/fonte-archivo.py`.
- **Animações:** a biblioteca `framer-motion` saiu (cerca de 70 KB de JavaScript a menos em todas as telas). As entradas suaves continuam em CSS.
- **Revelação ao rolar:** o que já está na tela ao abrir aparece direto, sem esconder e mostrar de novo. Isso atrasava a maior imagem ou texto da página (LCP).
- **Acessibilidade (100 em todas):**
  - títulos em ordem (h1 → h2) em Planos, Plano do cliente e Diário, com títulos só para leitor de tela onde o visual não tem um;
  - área de toque mínima (24 px) no link de Privacidade do login.
- **O que não dá para tirar:** o JavaScript que sobra é o núcleo do React/Next.js. O Lighthouse ainda aponta parte dele como "não usado" na primeira tela.

## 2. Testes de ponta a ponta da Parte 6

`tests/e2e/qualidade.spec.ts`, com os outros arquivos que já cobriam parte da lista:

| Item | Onde |
|---|---|
| Sem "nutricionista", CRN ou "registro profissional" em **todas as telas**: todas as páginas do sitemap, login e cadastro; tudo o que se alcança no app do cliente a partir do Início e do Mais; menus, Configurações e abas da ficha no painel (título, descrição, Open Graph e texto visível) | `qualidade.spec.ts` |
| O mesmo nos **PDFs** (planos de três clientes, anamnese, plano do cliente, recibo) e no arquivo do calendário | `qualidade.spec.ts`, `coach-sem-registro.spec.ts` |
| `sitemap.xml` e `robots.txt` (áreas privadas fora, páginas públicas e posts no mapa) | `seo-captacao.spec.ts` |
| Depoimento só aparece no site **depois de aprovado** (e some quando o cliente retira a autorização) | `conteudo-site.spec.ts` |
| **Check-in com lembrete:** abre 3 dias antes, a tarefa periódica avisa o cliente (aviso no app e push) uma única vez | `qualidade.spec.ts`; atraso e envio em `parte4.spec.ts` |
| **Renovação bloqueando o acesso no vencimento:** vencido, só o histórico e "Renovar meu plano" | `parte4.spec.ts` |
| **Recibo gerado após o webhook** do Mercado Pago: Pix pendente sem recibo; webhook assinado aprova; recibo em PDF com nome, valor e plano | `qualidade.spec.ts` (servidor falso `tests/e2e/mp-falso.mjs`) |
| Botão **"Chamar no WhatsApp"** respeitando o modo (os dois, só app, só WhatsApp; global e por cliente) | `parte5.spec.ts` |
| **Lembretes do calendário (.ics):** arquivo válido, sem duplicar, aviso de horários mudados, link webcal revogável | `parte5.spec.ts` |
| **Limite de e-mail:** com só a reserva sobrando, o resumo pausa e a recuperação de senha sai; o painel avisa; com o dia esgotado, nem o essencial sai e a tela responde normalmente; com cota de novo, o resumo sai na 2ª tentativa, uma vez só | `qualidade.spec.ts`; contas da cota em `tests/unit/parte5.test.ts` |

### Como o teste chega ao limite de e-mail

Nos testes, os e-mails vão para um arquivo (`EMAIL_TEST_OUTBOX`) e nunca para a internet. Só nesse modo, sem `RESEND_API_KEY`, o arquivo `<EMAIL_TEST_OUTBOX>.limites.json` pode baixar os limites. O teste cria esse arquivo e o apaga no fim. Em produção, com o provedor configurado, o arquivo é ignorado: valem `EMAIL_DAILY_LIMIT` e `EMAIL_MONTHLY_LIMIT`.

### Ajuste junto

A tarefa periódica passa a usar o mesmo relógio para os check-ins e para o resto (antes, o "hoje" dos check-ins vinha sempre do relógio do servidor).

## 3. Manual

A lista de aparelhos reais está em [09-lancamento.md](09-lancamento.md#qualidade-antes-de-publicar-parte-6):

- push e instalação num Android e num iPhone (iOS 16.4 ou mais novo, com o app instalado);
- .ics no Google Agenda e no Calendário do iPhone, com o alarme tocando;
- prévia do link no WhatsApp;
- compra com o Mercado Pago em modo de teste.
