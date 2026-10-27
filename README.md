# Fonseca Team · Consultoria online com Maicon Fonseca

Site da Fonseca Team em HTML, CSS e JavaScript puros. Não tem etapa de build: publique a pasta como está.

- **Site público** (`index.html`): hero com líquido em WebGL e vídeo vertical, a história do Maicon, como funciona, planos, resultados, Instagram, FAQ e contato.
- **Área do aluno** (`/aluno`): treino do dia, fichas com vídeo, timer de descanso, dieta e evolução. Pode ser instalada na tela inicial do celular (PWA).
- **Painel do treinador** (`/admin`): alunos, biblioteca de exercícios, treinos, nutrição e avaliações.
- **Banco**: Supabase (login, Postgres com Row Level Security e armazenamento de fotos).

Enquanto o Supabase não estiver configurado, `/aluno` e `/admin` abrem em **modo demonstração**: os dados são de exemplo e ficam só no navegador de quem está testando.

---

## Estrutura

```
index.html              Site público
privacidade.html        Política de privacidade (LGPD) — revise antes de publicar
js/config.js            ← contatos, CREF, vídeo da hero, planos, resultados, depoimentos, Instagram, FAQ
js/story.config.js      ← capítulos da história, frases, números e galeria "Bastidores"
js/site.js, story.js    Interações e animações do site
js/liquid.js            Shader do fundo da hero
js/media.js             Detecta foto / vídeo / YouTube / Vimeo
js/vendor/              GSAP + ScrollTrigger (cópia local)
css/site.css            Visual do site público
css/app.css             Visual da área logada
fonts/                  Archivo em instâncias fixas (ver "Tipografia")
media/                  ← suas fotos e vídeos
  hero/                 vídeo e capa da hero
  story/                fotos/vídeos dos capítulos
  bastidores/           galeria em mosaico
  resultados/           antes e depois
  instagram/            6 imagens da faixa do Instagram
admin/                  Painel do treinador
aluno/                  Área do aluno (+ manifest e service worker do PWA)
app/js/env.js           ← URL e chave pública do Supabase
app/js/                 Código da área logada
supabase/schema.sql     Tabelas, policies (RLS) e storage
supabase/functions/     Função que envia o convite por e-mail
```

---

## Antes de publicar: o que trocar

| O quê | Onde |
|---|---|
| Número do CREF e formação | `js/config.js` → `cref`, `formacao` |
| Preços dos planos | `js/config.js` → `plans[].price` (hoje `000`) |
| Números da história (alunos, anos, cidades) | `js/story.config.js` → `stats` (hoje `000`) |
| Textos da história | `js/story.config.js` → `chapters` (hoje são modelos) |
| Depoimentos e antes/depois | `js/config.js` → `testimonials`, `results` (marcados como EXEMPLO) |
| Política de privacidade | `privacidade.html` (modelo, revise com um profissional) |

Nenhum número foi inventado: tudo que aparece como `000`, `XXXXXX` ou "exemplo" é para você preencher.

---

## Como trocar fotos e vídeos

Coloque os arquivos na pasta `media/` e atualize o caminho no arquivo de configuração. O site descobre sozinho se é foto ou vídeo pela extensão (`.jpg .png .webp .svg` = foto, `.mp4 .webm` = vídeo) ou pelo link (YouTube/Vimeo).

### Hero (vídeo vertical ao lado do nome)

Em `js/config.js`, bloco `hero`:

```js
hero: {
  video: "media/hero/hero.mp4",          // ou "https://youtube.com/shorts/XXXX" / link do Vimeo / "" (sem vídeo)
  poster: "media/hero/hero-poster.jpg",  // capa enquanto o vídeo carrega
  photo: "media/hero/hero-poster.jpg",   // usada quando não há vídeo
  label: "Ao vivo no treino"
}
```

1. Salve o vídeo vertical (9:16) como `media/hero/hero.mp4`. Ele toca sem som, em loop; o botão de alto-falante liga o som e o clique abre em tela cheia.
2. Troque `media/hero/hero-poster.jpg` por um frame do vídeo (1080×1920).
3. Sem vídeo? Deixe `video: ""`. Se `hero.mp4` não existir, o site mostra a foto automaticamente.
4. Para a foto **recortada** (sem fundo), salve um PNG transparente, por exemplo `media/hero/maicon-recorte.png`, e use `photo: "media/hero/maicon-recorte.png"`. Com PNG, a moldura some e o Maicon fica "solto" sobre o líquido.

### História do Maicon

Em `js/story.config.js`, cada capítulo é um bloco:

```js
{
  marker: "2015 · O começo",            // texto em vermelho, em mono
  title: "O começo",
  text: "Duas a quatro linhas...",
  media: "media/story/capitulo-1.jpg",  // foto OU vídeo (.mp4) OU link do YouTube/Vimeo
  poster: "media/story/capitulo-1.jpg", // obrigatório para vídeo MP4
  alt: "Descrição da imagem"
}
```

- Para **adicionar** um capítulo, copie um bloco; para **remover**, apague; para **reordenar**, mude a posição na lista.
- Uma frase de destaque entre capítulos: `{ type: "quote", text: "Sua frase aqui." }`.
- Fotos verticais (4:5, ex.: 1200×1500) ficam melhores.
- Vídeos dos capítulos tocam sem som quando aparecem na tela e pausam ao sair; há botão para ativar o som.

### Bastidores (mosaico)

Em `js/story.config.js` → `gallery`. Fotos e vídeos podem ser misturados, em qualquer proporção:

```js
{ media: "media/bastidores/treino-01.jpg", alt: "Treino de pernas com aluno" },
{ media: "media/bastidores/aula-02.mp4", poster: "media/bastidores/aula-02.jpg", alt: "Aula de técnica" }
```

### Resultados, Instagram e planos

- **Antes e depois**: `media/resultados/` + `js/config.js` → `results`. Publique só com **autorização por escrito** do aluno. Remova `example: true` quando for real.
- **Instagram**: troque as 6 imagens em `media/instagram/` (quadradas, 1080×1080) e cole o link de cada post em `instagramPosts[].url`.
- **Planos**: o botão "Assinar" abre o WhatsApp com "Olá Maicon! Quero o plano [nome].". Quando tiver link de pagamento (Mercado Pago, Hotmart, Stripe), cole em `paymentUrl` e o botão passa a abrir o pagamento.

### Vídeos leves

Comprima antes de subir (ideal: até 4 MB para a hero, 6 MB nos capítulos). Com o [ffmpeg](https://ffmpeg.org):

```bash
# vertical, reduzido para 720 px de largura e sem áudio (para a hero); troque -an por -c:a aac -b:a 96k se quiser som
ffmpeg -i original.mp4 -vf "scale=720:-2" -c:v libx264 -crf 28 -preset slow -movflags +faststart -an media/hero/hero.mp4
# capa a partir do primeiro segundo
ffmpeg -ss 1 -i media/hero/hero.mp4 -frames:v 1 -q:v 3 media/hero/hero-poster.jpg
```

Todos os vídeos usam `poster` e só carregam quando chegam perto da tela.

---

## Configurar o Supabase (área do aluno e painel)

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. **Banco**: abra *SQL Editor*, cole todo o `supabase/schema.sql` e rode. Ele cria as tabelas, as policies de segurança e os buckets `exercises` (público) e `progress` (privado).
3. **Treinador**: em *Authentication → Users → Add user*, crie o usuário do Maicon (e-mail e senha). Depois rode no SQL Editor, trocando o e-mail:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Maicon Fonseca'
   where id = (select id from auth.users where email = 'email-do-maicon@exemplo.com');
   ```
4. **URLs**: em *Authentication → URL Configuration*, coloque o endereço do site em *Site URL* e adicione `https://SEU-SITE/aluno/` e `https://SEU-SITE/admin/` em *Redirect URLs*.
5. **Convite por e-mail**: instale a [CLI do Supabase](https://supabase.com/docs/guides/cli) e publique a função:
   ```bash
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   supabase functions deploy invite-student
   ```
   Em *Authentication → Email Templates → Invite user*, traduza o texto (ex.: "Você foi convidado para a Fonseca Team. Clique para criar sua senha."). Para enviar muitos e-mails, configure um SMTP próprio em *Project Settings → Auth*.
6. **Conectar o site**: em *Project Settings → API*, copie a *Project URL* e a chave *anon public* para `app/js/env.js`. Nunca use a chave `service_role` no site.

Pronto: o Maicon entra em `/admin`, cadastra o aluno (com o consentimento LGPD marcado) e o aluno recebe o e-mail para criar a senha. No primeiro acesso, o aluno também aceita a política de privacidade.

### Quem vê o quê (RLS)

- O **treinador** (`role = 'admin'`) vê e edita tudo.
- O **aluno** vê só o próprio cadastro, treinos, dieta, avaliações e fotos. Ele só consegue gravar o "feito" e a carga usada do próprio treino.
- Fotos de evolução ficam no bucket **privado** `progress`, numa pasta com o id do aluno, e abrem por links temporários.
- Todo plano alimentar exige **nome e CRN** do nutricionista responsável, que aparecem para o aluno.

---

## Publicar

**Netlify**: arraste a pasta em [app.netlify.com/drop](https://app.netlify.com/drop) ou conecte este repositório (sem comando de build, diretório de publicação `.`). O `netlify.toml` já configura cabeçalhos de segurança e tira `/aluno` e `/admin` dos buscadores.

Para testar no computador, rode um servidor local na pasta (o PWA e os módulos não funcionam abrindo o arquivo direto):

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

### PWA (Adicionar à tela inicial)

A área do aluno tem `aluno/manifest.webmanifest` e `aluno/sw.js`. No Android aparece o botão "Instalar"; no iPhone, a tela inicial explica o caminho (Compartilhar → Adicionar à Tela de Início). Ao publicar mudanças grandes no app, aumente `CACHE` em `aluno/sw.js` (ex.: `ft-aluno-v2`).

---

## Tipografia

- Títulos: **Archivo** largura 125 / peso 800. O arquivo foi gerado como instância **fixa** (não variável) a partir do Archivo oficial do Google Fonts, com as sobreposições de contorno removidas. É isso que deixa o contorno do "TEAM" limpo com `-webkit-text-stroke`. Arquivos em `fonts/`.
- Texto: Archivo 400 (mesmo processo).
- Rótulos, números e menus: **Geist Mono** (Google Fonts).

## Cores

Definidas no topo de `css/site.css` e `css/app.css`:

| | |
|---|---|
| Preto | `#0A0A0A` |
| Branco | `#F5F5F5` |
| Vermelho Fonseca | `#E10600` |
| Vermelho escuro | `#8F0400` |
| Cinza | `#8A8A8A` |

## Acessibilidade e desempenho

- Foco de teclado visível (contorno vermelho), link "Pular para o conteúdo", menus e modais fecham com Esc.
- Com "reduzir movimento" ativado no sistema, as animações param e o líquido vira um quadro estático.
- O shader renderiza a 55% da resolução e pausa fora da tela ou com a aba oculta. Sem WebGL, fica um gradiente preto.
