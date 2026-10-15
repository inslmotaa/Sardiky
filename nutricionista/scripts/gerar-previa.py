# Gera previa/index.html (site público em arquivo único) a partir do servidor rodando em localhost:3100.
# Uso: npm run build && ALLOW_PGLITE=1 npx next start -p 3100; salve / e /privacidade em D (home.html, priv.html); python3 scripts/gerar-previa.py
import base64, re, subprocess, urllib.request
from bs4 import BeautifulSoup, Comment

BASE = 'http://localhost:3100'
D = '/tmp/claude-0/static'
get = lambda u: urllib.request.urlopen(BASE + u).read()

home = BeautifulSoup(open(f'{D}/home.html', encoding='utf-8').read(), 'html.parser')
priv = BeautifulSoup(open(f'{D}/priv.html', encoding='utf-8').read(), 'html.parser')

# ---- CSS com fontes embutidas ----
css_href = home.find('link', rel='stylesheet')['href']
css = get(css_href).decode()
def embed(m):
    rel = m.group(1)
    path = '/_next/static/' + rel.replace('../', '')
    data = base64.b64encode(get(path)).decode()
    return f'url(data:font/woff2;base64,{data})'
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
style = home.new_tag('style'); style.string = css; head.append(style)
icon = home.new_tag('link', rel='icon', type='image/svg+xml',
    href='data:image/svg+xml;base64,' + base64.b64encode(get('/icon.svg')).decode())
head.append(icon)

# Faixa de aviso
banner = home.select_one('.demo-banner')
if banner:
    banner.string = 'Prévia do site (arquivo estático). Agendamento on-line, área do paciente e painel funcionam na versão publicada com servidor. Registro, endereço, contatos e depoimentos são fictícios.'

# Links internos
for a in home.find_all('a', href=True):
    h = a['href']
    if h.startswith('/#'): a['href'] = h[1:]
    elif h == '/': a['href'] = '#'
    elif h.startswith('/agendar'): a['href'] = '#'; a['data-agendar'] = '1'
    elif h.startswith('/login'): a['href'] = '#area-do-paciente'
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
    <p>Pacientes em acompanhamento recebem acesso exclusivo, com login e senha, para consultar o plano alimentar com substituições,
    registrar o diário alimentar, acompanhar a evolução em gráficos, responder questionários e enviar mensagens ao nutricionista.</p>
    <p class="muted small">Nesta prévia estática, o acesso não está disponível: ele funciona na versão publicada do sistema.</p>
  </div>
</section>''', 'html.parser')
main.append(area)
psec = priv.find('main').find('section')
psec['id'] = 'privacidade'
psec['class'] = ['section', 'section--alt']
for a in psec.find_all('a', href=True):
    if a['href'].startswith('/'): a['href'] = '#'
main.append(psec)

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
    var words = ['complicado', 'restritivo', 'solitário', 'uma dieta da moda'], i = 0;
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

out = '<!doctype html>\n' + str(home).replace('<!DOCTYPE html>', '')
open(f'{D}/index.html', 'w', encoding='utf-8').write(out)
print(len(out))
