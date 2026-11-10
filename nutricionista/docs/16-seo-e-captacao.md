# SEO e captação (Parte 3)

O que faz o site aparecer bem no Google e nos links compartilhados, o blog (Conteúdos) e como os contatos chegam com a origem registrada.

> **Importante:** o endereço público do site (`APP_URL`, ex.: `https://farion.com.br`) precisa ser o final. Com o Docker de `deploy/`, ele vem de `DOMAIN` no `deploy/.env`. Ele é a base do canonical, do sitemap, do robots.txt, das imagens de compartilhamento e dos dados estruturados.

## 1. robots.txt e sitemap.xml

- **`/robots.txt`** (`src/app/robots.ts`): libera o site público e deixa **fora do índice** o painel (`/admin`, `/painel`), a área do cliente (`/paciente`, `/app`), as rotas de autenticação (`/login`, `/entrar`, `/criar-conta`, `/recuperar-senha`, `/redefinir-senha`, `/nova-senha`, `/confirmar-email`) e a API. Aponta para o sitemap.
- As mesmas páginas também têm `<meta name="robots" content="noindex, nofollow">` (layout do painel, da área do cliente e de autenticação).
- **`/sitemap.xml`** (`src/app/sitemap.ts`): Início (com a seção de planos, `/#planos`), Sobre, Como funciona, Conteúdos, Dúvidas e Privacidade, mais cada **conteúdo publicado** (rascunhos e posts com data futura não entram).
- A lista fica em `src/lib/seo.ts` (`NO_INDEX_PATHS` e `PUBLIC_PAGES`).

Depois de publicar, cadastre o site no Google Search Console e envie `https://SEU-DOMINIO/sitemap.xml`.

## 2. Título, descrição, canonical, Open Graph e Twitter Card

Cada página pública tem título e descrição próprios (até 160 caracteres, sem cortar palavra), `canonical` com o endereço dela e `lang="pt-BR"` no HTML. O mesmo título e a mesma descrição vão para:

- **Open Graph** (WhatsApp, Instagram, Facebook, LinkedIn): `og:title`, `og:description`, `og:url`, `og:locale=pt_BR`, `og:site_name` e a imagem;
- **Twitter Card**: `summary_large_image`.

A **imagem de compartilhamento** é gerada pelo próprio site (`src/app/opengraph-image.tsx` e `twitter-image.tsx`, 1200×630) na identidade verde: nome do site, "Coach · alimentação, rotina e bem-estar", o lema "Mais que dieta, um estilo de vida.", o nome do André e "Atendimento on-line". Ela usa o nome do site e a cor principal das Configurações. Um conteúdo com capa usa a capa no lugar.

Para conferir como o link aparece: [Depurador de compartilhamento da Meta](https://developers.facebook.com/tools/debug/) (use "Extrair novamente" depois de mudar algo; o WhatsApp guarda a prévia em cache por alguns dias).

## 3. Dados estruturados (JSON-LD)

Gerados em `src/lib/jsonld.ts`, só com dados reais (WhatsApp, Instagram e foto vazios ficam de fora):

| Página | Tipo | Conteúdo |
|---|---|---|
| Início | `WebSite` + `Person` + `ProfessionalService` | Nome, título **Coach**, descrição, especialidades, área de atendimento **Brasil, on-line** (videochamada e app, sem endereço físico), WhatsApp, Instagram |
| Sobre | `ProfilePage` com a `Person` | Os mesmos dados da pessoa |
| Dúvidas | `FAQPage` | As perguntas publicadas em Configurações → Depoimentos e dúvidas |
| Cada conteúdo | `BlogPosting` | Título, resumo, datas, capa e autor (André Farion, Coach) |

Para validar: [Teste de pesquisa aprimorada do Google](https://search.google.com/test/rich-results).

## 4. Conteúdos (blog)

- **Público:** `/conteudos` (lista, com data e tempo de leitura) e `/conteudos/[endereço]`. Link "Conteúdos" no menu e no rodapé.
- **Painel → Conteúdos do site** (permissão "Conteúdo do site e interessados"): título, endereço (criado a partir do título se ficar em branco), resumo, capa com descrição, texto em **Markdown simples**, situação (rascunho/publicado) e data.
- **Rascunho** não aparece no site (o endereço responde 404) nem no sitemap; quem tem a permissão vê uma **pré-visualização** marcada, fora do índice. **Data futura** funciona como agendamento: o post aparece a partir dela.
- **Fim de cada post:** convite fixo com **Contratar um plano** (vai para `/#planos`) e **Falar no WhatsApp**, mais o formulário curto "Quero saber mais".
- A capa só é servida publicamente enquanto o post estiver publicado.

Markdown aceito (`src/lib/markdown.ts`, sem biblioteca externa): `## título`, `### subtítulo`, `**negrito**`, `*itálico*`, `` `código` ``, `[link](https://...)` ou `[link](/planos)`, listas com `- ` ou `1. `, citação com `> ` e `---`. HTML digitado aparece como texto (nunca é executado) e links só aceitam `https://`, `http://`, `mailto:` e caminhos do próprio site. Links externos abrem em nova aba com `rel="noopener noreferrer nofollow"`.

O seed traz só um **rascunho de exemplo** (não aparece no site). Nenhum texto é publicado em nome do André sem ele escrever.

## 5. Captação: "Quero saber mais" com origem (UTM)

- Formulário curto (nome, WhatsApp, objetivo opcional e consentimento) na seção Contato do Início e no fim de cada conteúdo.
- A origem da visita é registrada com o contato: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, a **página de entrada** (sem a query) e só o **domínio** de quem indicou (ex.: `l.instagram.com`, nunca o endereço completo). A origem vale para toda a visita: a pessoa pode chegar por um link com UTM, navegar e enviar o formulário em outra página. Tudo é limpo e revalidado no servidor (`src/lib/utm.ts`).
- **Painel → Interessados:** coluna **Origem** ("instagram / bio · campanha novembro", "entrou por /conteudos").
- Links para divulgar: `https://SEU-DOMINIO/?utm_source=instagram&utm_medium=bio&utm_campaign=novembro` (exemplo também em Configurações → Captação e pixels).
- Proteções: campo-isca contra robôs e limite de 5 envios por hora por IP. Os contatos não convertidos são eliminados após o prazo de retenção (padrão 180 dias).

## 6. Pixels (Meta e Google) e consentimento de cookies

**Desligados por padrão.** Em **Configurações → Captação e pixels**:

- chave **Ligar os pixels**;
- **ID do pixel da Meta** (só números) e/ou **ID da tag do Google** (`G-XXXXXXX` do Analytics 4 ou `AW-XXXXXXX` do Google Ads). IDs inválidos são recusados.

Com a chave ligada e um ID válido:

1. O site mostra o aviso **Cookies de medição** com **Aceitar** e **Recusar**. Sem aceite, nada da Meta ou do Google é carregado.
2. A escolha fica no cookie `farion-consent` (6 meses) e pode ser revista em **Preferências de cookies**, no rodapé.
3. Os pixels só rodam nas **páginas públicas**. Um clique para o login, a área do cliente ou o painel recarrega a página inteira, deixando os pixels para trás. A Meta não rastreia mudanças de endereço sozinha (`disablePushState`), e o Google não envia a página automaticamente (`send_page_view: false`): cada página pública é registrada uma a uma.
4. **Política de segurança (CSP):** os domínios da Meta e do Google só são liberados nas páginas públicas e só para quem tem o cookie de aceite (`next.config.ts`). Painel, área do cliente e login nunca os liberam.
5. A **Política de Privacidade** (seção 7, Cookies) passa a citar os pixels automaticamente e volta ao texto "não usamos cookies de publicidade" quando eles são desligados.

Com a chave desligada (ou sem ID válido), não há aviso de cookies nem script de terceiros.

## 7. Banco de dados

Migração `drizzle/0020_conteudos_e_captacao.sql`:

- tabela **`posts`** (endereço único, título, resumo, capa, texto, situação, data, autor);
- em **`leads`**: `form`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `landing_path`, `referrer`;
- em **`settings`**: `pixels_enabled` (falso), `meta_pixel_id` e `google_tag_id` (vazios).

O `deploy/banco-de-dados.sql` foi gerado de novo (`npm run db:sql`).

## 8. Testes

- **Unitários** (`tests/unit/seo-captacao.test.ts`): Markdown (incluindo HTML e links perigosos), endereço e publicação dos posts, UTM, validação e ativação dos pixels, JSON-LD e metadados.
- **Ponta a ponta** (`tests/e2e/seo-captacao.spec.ts`): robots e sitemap, metadados e imagem de compartilhamento, JSON-LD, ciclo do blog (rascunho 404 → publicado no site e no sitemap, com convite final), formulário com UTM até Interessados, e pixels (desligados por padrão; recusar não carrega nada; aceitar carrega com a CSP liberada só nas páginas públicas; saída para o login sem pixels).
