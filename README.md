# Fonseca Team · site-app

Site e app da consultoria online de **Maicon Fonseca** (Fonseca Team).

- **Página pública** (`index.html`): conta uma história em 7 capítulos enquanto o visitante rola a tela, com vídeos sem som ao fundo. Depois vêm os planos, a calculadora, as dúvidas e os botões para o WhatsApp e o Instagram.
- **Site-app** (`/app`): instalável no celular. O aluno responde a anamnese, tira as 4 fotos de avaliação pela câmera e acompanha a evolução. O profissional gera, com IA, um rascunho de avaliação, revisa e libera.

## Tecnologia

- HTML, CSS e JavaScript puro, sem etapa de build.
- **GSAP 3.12.5 + ScrollTrigger** (animações) e **Lenis 1.1.13** (rolagem suave), dentro do site em `js/vendor/`.
- **Supabase** (login por e-mail, banco Postgres com regras de acesso por linha e fotos em armazenamento privado). A biblioteca fica em `app/js/vendor/`.
- **Netlify Functions** (Node) para a IA e para apagar contas.
- **Claude (`claude-opus-5-5`)**, da Anthropic, para analisar as fotos e a anamnese.

Quem pede menos movimento no aparelho, ou usa economia de dados, vê o site sem animações e sem vídeos, com tudo funcionando.

## Estrutura

```
index.html            Página pública
privacidade.html      Política de privacidade (modelo para revisão jurídica)
css/style.css         Estilos da página pública
js/config.js          TODOS os dados editáveis: contatos, planos, vídeos, dúvidas, Supabase
js/main.js            Menu, planos, comparativo, calculadora, dúvidas, contato
js/story.js           Capítulos e vídeos da história
js/motion.js          Animações (GSAP, ScrollTrigger e Lenis)
app/                  Site-app (área do aluno e do profissional)
manifest.webmanifest  Instalação como app (PWA)
sw.js                 Service worker (cache das telas, nunca dos dados)
netlify/functions/    avaliacao-background.mjs (IA) e excluir-conta.mjs (LGPD)
netlify/lib/          Esquema da resposta da IA e instruções do sistema
supabase/schema.sql   Banco de dados, regras de acesso e armazenamento
assets/               Logo, ícones, foto e vídeos
```

## Modo demonstração

Enquanto `supabase.url` estiver vazio em `js/config.js`, o app roda em **modo demonstração**: você entra como aluno ou como profissional, e tudo fica salvo só naquele aparelho. A "avaliação com IA" gera um **exemplo fixo**, claramente marcado, sem analisar as fotos. Serve para conhecer o app antes de configurar o servidor.

## Colocar no ar com o app funcionando de verdade

### 1. Supabase (banco, login e fotos)
1. Crie uma conta em **supabase.com** e um projeto (plano grátis serve para começar).
2. Em **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Authentication → URL Configuration**, coloque o endereço do site em **Site URL** (ex.: `https://seudominio.com.br`) e adicione `https://seudominio.com.br/app/` em **Redirect URLs**.
4. Em **Authentication → Email Templates → Magic Link**, inclua o código `{{ .Token }}` no texto do e-mail, para o aluno poder digitar o código no app em vez de tocar no link (útil quando o e-mail abre em outro aparelho).
5. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public** para `js/config.js`, em `supabase.url` e `supabase.anonKey`. Essa chave pode ficar no site, porque é pública e quem protege os dados são as regras do `schema.sql`.

### 2. Anthropic (IA)
1. Crie uma conta em **console.anthropic.com**, adicione créditos e gere uma **API key**.
2. O custo é por uso: cada avaliação (4 fotos + anamnese) deve custar algo entre **US$ 0,20 e 0,60**. Confira nas primeiras avaliações, no próprio painel da Anthropic.

### 3. Netlify (site + funções)
1. Na Netlify, use **Add new site → Import an existing project → GitHub** e escolha este repositório. Deixe o comando de build vazio, com o diretório de publicação `.`. Arrastar a pasta **não** instala as funções.
2. Em **Site configuration → Environment variables**, crie:
   - `ANTHROPIC_API_KEY`: a chave da Anthropic.
   - `SUPABASE_URL`: a Project URL do Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: a chave **service_role** do Supabase. É secreta: só aqui, nunca no site.
3. A análise roda como **Background Function** (até 15 minutos). Confira se o seu plano da Netlify inclui esse recurso.

### 4. Tornar o Maicon profissional
1. O Maicon entra no app (`/app`) com o e-mail dele uma vez.
2. No Supabase, em **SQL Editor**, rode a linha do fim do `schema.sql` com o e-mail dele:
   `update public.profiles set role = 'profissional' where id = (select id from auth.users where email = 'email-do-maicon@exemplo.com');`
3. Pronto: no próximo acesso ele vê o painel de alunos.

## Vídeos da história

São 8 vídeos sem som: `story-00` (fundo da abertura) e `story-01` a `story-07` (capítulos). Coloque em `assets/videos/` e preencha a lista `story` em `js/config.js`:

```js
{ video: "assets/videos/story-01.mp4", mobile: "assets/videos/story-01-m.mp4", poster: "assets/videos/story-01.jpg" }
```

- Use MP4 (H.264) **sem áudio**, de 6 a 12 segundos.
- Para computador: 1920×1080, de 3 a 6 MB. Para celular (opcional): 1080×1920, de 2 a 4 MB.
- O `poster` é a capa mostrada antes do vídeo começar e para quem pede menos movimento.
- Sem vídeo, cada foto aparece uma vez só: o retrato do Maicon (`assets/coach.jpg`) na abertura e as fotos de treino de `assets/fotos/` nos capítulos 3 a 6. Os capítulos 1, 2 e 7 e a chamada final usam o fundo da marca.
- Para trocar uma foto, substitua o arquivo mantendo o mesmo nome. O arquivo `-fundo.jpg` é uma versão pequena e desfocada usada atrás da foto no computador.

## Outros ajustes em `js/config.js`

- **Dúvidas:** as perguntas sem resposta confirmada estão comentadas. É só descomentar e preencher a resposta.
- **Alimentação:** prescrever dieta é exclusivo de nutricionista (Lei 8.234/91). Sem `app.nutricionista`, o aluno recebe só orientações gerais (calorias, macros e água). Com um nutricionista parceiro, preencha `nome` e `crn`: as refeições revisadas passam a aparecer, com o nome dele.
- **Planos, WhatsApp e Instagram:** também ficam no `config.js`.
