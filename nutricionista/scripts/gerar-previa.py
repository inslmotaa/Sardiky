# Gera previa/index.html: arquivo único que abre direto no navegador, com o site público
# e a demonstração local da área do cliente e do painel do André (previa/src/app.tsx, que reaproveita
# os componentes reais do sistema: editor de planos, tela Hoje, plano do paciente e calculadoras).
# Uso: npm run build && ALLOW_PGLITE=1 npx next start -p 3100   (em outro terminal)
#      python3 scripts/gerar-previa.py
import base64, os, re, subprocess, tempfile, urllib.request
from bs4 import BeautifulSoup, Comment

BASE = 'http://localhost:3100'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
get = lambda u: urllib.request.urlopen(BASE + u).read()

home = BeautifulSoup(get('/').decode(), 'html.parser')
priv = BeautifulSoup(get('/privacidade').decode(), 'html.parser')
demo_css = open(os.path.join(ROOT, 'previa/src/demo.css'), encoding='utf-8').read()
with tempfile.TemporaryDirectory() as tmp:
    bundle = os.path.join(tmp, 'app.js')
    subprocess.run(['node', os.path.join(ROOT, 'scripts/build-previa.mjs'), bundle], check=True)
    demo_js = open(bundle, encoding='utf-8').read().replace('</script', '<\\/script')

# ---- CSS com fontes embutidas ----
css_href = home.find('link', rel='stylesheet')['href']
css = get(css_href).decode()
def embed(m):
    rel = m.group(1)
    path = '/_next/static/' + rel.replace('../', '')
    data = base64.b64encode(get(path)).decode()
    return f'url(data:font/woff2;base64,{data})'
# Mantém só os subconjuntos latinos das fontes (os demais alfabetos não são usados no site).
def keep_face(m):
    block = m.group(0)
    src = re.search(r'url\(([^)]+)\)', block)
    return block if not src or re.search(r'-latin-', src.group(1)) else ''
css = re.sub(r'@font-face\{[^}]*\}', keep_face, css)
css = re.sub(r'url\((\.\./media/[^)]+\.woff2)\)', embed, css)

# ---- limpeza do documento ----
for t in home.find_all(['script', 'noscript']): t.decompose()
for t in home.find_all('link'): t.decompose()
for c in home.find_all(string=lambda s: isinstance(s, Comment)): c.extract()
for t in home.select('div[hidden]'): t.decompose()
for t in home.select('meta[name=robots]'): t.decompose()
html_tag = home.find('html')
if html_tag.get('id') == '__next_error__': del html_tag['id']

head = home.head
style = home.new_tag('style'); style.string = css + '\n' + demo_css; head.append(style)
icon = home.new_tag('link', rel='icon', type='image/svg+xml',
    href='data:image/svg+xml;base64,' + base64.b64encode(get('/icon.svg')).decode())
head.append(icon)

# Faixa de aviso
banner = home.select_one('.demo-banner')
if banner:
    banner.clear()
    banner.append(BeautifulSoup('Prévia em arquivo único. Veja também a <a href="#cliente">área do cliente</a> e o <a href="#andre">painel do André</a> (demonstração local). Registro, endereço, contatos e depoimentos são fictícios.', 'html.parser'))

# Links internos
for a in home.find_all('a', href=True):
    h = a['href']
    if h.startswith('/#'): a['href'] = h[1:]
    elif h == '/': a['href'] = '#'
    elif h.startswith('/agendar'): a['href'] = '#'; a['data-agendar'] = '1'
    elif h.startswith('/login'): a['href'] = '#cliente'
    elif h.startswith('/privacidade'): a['href'] = '#privacidade'; a.attrs.pop('target', None)

# Formulário de contato -> WhatsApp
form = home.find('form')
for k in ['action', 'method', 'enctype', 'encType']: form.attrs.pop(k, None)
form['id'] = 'form-contato'
for inp in form.select('input[type=hidden]'): inp.decompose()

# Seções extras: área do paciente (explicação) + política de privacidade
main = home.find('main')
area = BeautifulSoup('''
<section class="section section--alt" id="area-do-paciente">
  <div class="container" style="max-width:860px">
    <span class="eyebrow">Área do paciente</span>
    <h2>Acompanhamento também entre as consultas</h2>
    <p>Pacientes em acompanhamento recebem acesso exclusivo ao app: a tela <strong>Hoje</strong> mostra a próxima refeição e permite marcar
    o que foi feito, o <strong>Plano</strong> traz as opções e substituições aprovadas pelo André, e há contador de água, registro de peso,
    gráficos de progresso, calculadoras e mensagens.</p>
    <p>No painel, o André monta o plano com cálculo automático de calorias e macros (base de alimentos com medidas caseiras),
    recebe sugestões de substituições equivalentes e só então ativa o plano no app do paciente. O painel de
    <strong>Acompanhamento</strong> mostra quem está em dia, com dificuldade ou sem progresso, e o chat permite responder a cada registro do diário.
    O paciente também tem lista de compras gerada do plano, receitas, materiais e a agenda com confirmação de presença e videochamada.</p>
    <div class="demo-links"><a class="btn btn--primary" href="#cliente">Ver a área do cliente</a><a class="btn" href="#andre">Ver o painel do André</a><a class="btn" href="#andre/acompanhamento">Ver o Acompanhamento</a></div>
    <p class="muted small" style="margin-top:12px">Nesta prévia, as duas telas funcionam como demonstração e guardam os dados só no seu navegador. Na versão publicada, cada cliente entra com login e senha e só vê os próprios dados.</p>
  </div>
</section>''', 'html.parser')
main.append(area)
psec = priv.find('main').find('section')
psec['id'] = 'privacidade'
psec['class'] = ['section', 'section--alt']
for a in psec.find_all('a', href=True):
    if a['href'].startswith('/'): a['href'] = '#'
main.append(psec)

# ---- separa o site das telas de demonstração ----
site = home.new_tag('div', id='view-site')
for child in list(home.body.contents):
    site.append(child.extract())
home.body.append(site)
home.body.append(home.new_tag('div', id='view-app', hidden=''))

# ---- script próprio (sem servidor) ----
wa = home.select_one('.whatsapp-float')
wa_base = wa['href'].split('?')[0] if wa else ''
script = home.new_tag('script')
script.string = r'''
(function () {
  var WA = %s;
  function waLink(text) { return WA ? WA + '?text=' + encodeURIComponent(text) : '#contato'; }

  // Botões de agendamento: abrem o WhatsApp com o serviço escolhido.
  document.querySelectorAll('a[data-agendar]').forEach(function (a) {
    var card = a.closest('article');
    var svc = card && card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : '';
    a.href = waLink('Olá! Vim pelo site e gostaria de agendar ' + (svc ? 'o serviço "' + svc + '"' : 'uma consulta') + '.');
    a.target = '_blank'; a.rel = 'noopener noreferrer';
  });

  // Menu do celular fecha ao escolher um item.
  document.querySelectorAll('.mobile-menu a').forEach(function (a) {
    a.addEventListener('click', function () { a.closest('details').removeAttribute('open'); });
  });

  // Storytelling: troca de palavras, revelação ao rolar e capítulos ativos.
  var story = document.querySelector('.story');
  if (story) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    story.setAttribute('data-ready', 'true');
    var words = ['complicado', 'restritivo', 'uma dieta da moda'], i = 0;
    var w = story.querySelector('.story-word__item');
    if (!reduce && w) setInterval(function () {
      i = (i + 1) %% words.length;
      var n = w.cloneNode(false); n.textContent = words[i]; w.parentNode.replaceChild(n, w); w = n;
    }, 2400);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('is-visible'); });
      }, { threshold: 0.15 });
      story.querySelectorAll('.reveal').forEach(function (n) { io.observe(n); });
      var scenes = story.querySelectorAll('.story-stage .scene');
      var prog = story.querySelectorAll('.story-progress li');
      var chapters = story.querySelectorAll('[data-index]');
      var setActive = function (k) {
        chapters.forEach(function (c, j) { c.classList.toggle('is-active', j === k); });
        scenes.forEach(function (s, j) { s.classList.toggle('is-on', j === k); });
        prog.forEach(function (p, j) { p.classList.toggle('on', j <= k); });
      };
      var co = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) setActive(Number(e.target.getAttribute('data-index'))); });
      }, { rootMargin: '-45%% 0px -45%% 0px' });
      chapters.forEach(function (c) { co.observe(c); });
    } else {
      story.querySelectorAll('.reveal').forEach(function (n) { n.classList.add('is-visible'); });
    }
  }

  // Formulário de contato: valida e envia pelo WhatsApp.
  var form = document.getElementById('form-contato');
  if (form) {
    var msg = document.createElement('p'); msg.setAttribute('role', 'alert'); msg.style.marginTop = '12px'; msg.hidden = true;
    form.appendChild(msg);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; };
      var err = '';
      if (!v('name')) err = 'Informe seu nome.';
      else if (v('phone').replace(/\D/g, '').length < 10) err = 'Informe um telefone com DDD.';
      else if (!form.elements.consent.checked) err = 'É preciso concordar com a Política de Privacidade.';
      msg.hidden = false;
      if (err) { msg.className = 'alert alert--error'; msg.textContent = err; return; }
      var text = 'Olá! Meu nome é ' + v('name') + '. Telefone: ' + v('phone') +
        (v('email') ? '. E-mail: ' + v('email') : '') + (v('interest') ? '. Interesse: ' + v('interest') : '') +
        (v('message') ? '. ' + v('message') : '');
      msg.className = 'alert alert--ok';
      msg.textContent = 'Abrindo o WhatsApp com a sua mensagem…';
      window.open(waLink(text), '_blank', 'noopener');
    });
  }
})();
''' % (repr(wa_base).replace("'", '"'))
home.body.append(script)
demo = home.new_tag('script'); demo.string = demo_js
home.body.append(demo)

out = '<!doctype html>\n' + str(home).replace('<!DOCTYPE html>', '')
open(os.path.join(ROOT, 'previa/index.html'), 'w', encoding='utf-8').write(out)
print(len(out))
