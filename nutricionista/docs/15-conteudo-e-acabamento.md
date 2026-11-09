# Conteúdo e acabamento do site (Parte 2)

## 1. Textos de exemplo: o que falta antes de publicar

O site não vai ao ar com textos de exemplo. A mesma regra (`scripts/pendencias.mjs`) aparece em dois lugares:

- **Painel → Início:** quadro **Antes de publicar o site**, com um botão **Ajustar** em cada item;
- **Linha de comando:** `DATABASE_URL=... node scripts/aplicar-perfil.mjs --pendencias`. Lista o que falta e sai com código 1 enquanto houver pendência. O `aplicar-perfil.mjs` também mostra essa lista no fim de cada aplicação.

O que conta como pendência:

| Pendência | Onde corrigir |
|---|---|
| Biografia com "PREENCHER" (ou vazia) | Configurações → Perfil → Apresentação |
| E-mail `example.com` no contato ou na privacidade | Configurações → Perfil |
| Instagram vazio | Configurações → Perfil (`@usuario` ou endereço do perfil) |
| Foto profissional não enviada | Configurações → Perfil → Foto profissional |
| Texto "(Texto de exemplo — …)" no Sobre (apresentação, método, especialidades ou diferenciais) | Configurações → Perfil |

No arquivo `perfil.json`, o `aplicar-perfil.mjs` recusa "PREENCHER", e-mails `example.com`, "(Texto de exemplo" e Instagram vazio antes de gravar qualquer coisa.

## 2. Números da seção Resultados

O valor final ("15 dias", "até 12 meses", "100%") já vem no HTML do servidor. A animação só roda por cima, quando o número entra na tela, e sempre termina no valor final. Sem animação, o valor final aparece direto:

- movimento reduzido (`prefers-reduced-motion`);
- impressão (o evento `beforeprint` mostra o valor final);
- prévia em arquivo único;
- navegador sem `IntersectionObserver`.

Leitores de tela leem o texto completo ("15 dias"), não os números da animação.

## 3. Página Sobre: formações e foto vertical

- **Configurações → Perfil → Formações e certificações:** uma por linha, no formato `Curso | Instituição | Ano`. Aparecem na página Sobre, das mais recentes para as mais antigas. Linha incompleta ou ano inválido é recusado com a linha indicada.
- **Foto vertical (retrato 4:5) ao lado de "Como eu trabalho":** sem foto, o texto ocupa a largura toda, sem espaço vazio.
- O seed não traz formações: o André preenche as reais.

## 4. Depoimentos com autorização

Tabela `testimonials`: nome ou iniciais, texto, nota, data, data e forma da autorização, publicado sim/não, quem aprovou e as fotos de antes e depois com a autorização específica.

- **O cliente** (Consultas → avaliação da consulta) pode marcar **"Autorizo publicar esta avaliação como depoimento no site"** e escolher assinar só com as iniciais (padrão) ou com o primeiro nome. A autorização fica registrada com data e forma ("pelo app") e entra nos consentimentos da LGPD.
- **O coach** aprova em **Configurações → Depoimentos e dúvidas**. Sem autorização registrada, o botão de aprovar não aparece e o servidor recusa. Ali também cadastra depoimentos recebidos fora do app, com a data e a forma da autorização (por escrito, e-mail ou WhatsApp).
- **Fotos de antes e depois:**
  - só com uma **autorização específica** para as fotos (data, forma e a confirmação marcada); nunca por padrão;
  - os arquivos só ficam públicos enquanto o depoimento estiver publicado e com essa autorização;
  - ao ocultar, excluir ou retirar a autorização, deixam de ser públicos na hora.
- **O cliente retira a autorização** quando quiser, no histórico de Consultas: o depoimento sai do site. Excluir a conta ou anonimizar o cadastro também remove os depoimentos.
- **Site:** até 3 depoimentos aprovados na seção Resultados, com "Depoimentos publicados com autorização." no rodapé da seção.

## 5. Modo escuro

- **Automático:** segue o aparelho (`prefers-color-scheme`) no site, no app do cliente e no painel. As cores ficam em `src/app/dark-theme.css`.
- **Chave manual no app do cliente:** Meu perfil → **Aparência** (Automático, Claro ou Escuro), também acessível por Mais → Aparência. Fica guardada neste aparelho num cookie (`tema`), lido pelo servidor, então a página já abre no tema certo, sem piscar.
- **Contraste AA:** `tests/unit/contraste.test.ts` lê as cores dos próprios CSS e confere, no claro e no escuro, texto ≥ 4,5:1 nos pares usados (texto, texto secundário, verde da marca, botões, avisos).
