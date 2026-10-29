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
plans = BeautifulSoup(get('/planos').decode(), 'html.parser')
faqp = BeautifulSoup(get('/duvidas').decode(), 'html.parser')
demo_css = open(os.path.join(ROOT, 'previa/src/demo.css'), encoding='utf-8').read()
with tempfile.TemporaryDirectory() as tmp:
    bundle = os.path.join(tmp, 'app.js')
    subprocess.run(['node', os.path.join(ROOT, 'scripts/build-previa.mjs'), bundle], check=True)
    demo_js = open(bundle, encoding='utf-8').read().replace('</script', '<\\/script')
    fx_js = subprocess.run(['npx', 'esbuild', os.path.join(ROOT, 'previa/src/site-fx.ts'), '--bundle', '--format=iife', '--minify', '--target=es2020'],
                           check=True, capture_output=True, text=True, cwd=ROOT).stdout.replace('</script', '<\\/script')

# ---- CSS com fontes embutidas ----
css = '\n'.join(get(l['href']).decode() for l in home.find_all('link', rel='stylesheet'))
def embed(m):
    rel = m.group(1)
    path = '/_next/static/' + rel.replace('../', '')
    data = base64.b64encode(get(path)).decode()
    return f'url(data:font/woff2;base64,{data})'
# Mantém só os subconjuntos latinos das fontes (os demais alfabetos não são usados no site).
def keep_face(m):
    block = m.group(0)
    src = re.search(r'url\(([^)]+)\)', block)
    return block if not src or re.search(r'-latin-(?!ext)', src.group(1)) else ''
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
    banner.append(BeautifulSoup('Prévia em arquivo único. Veja também a <a href="#cliente">área do cliente</a> e o <a href="#andre">painel do André</a> (demonstração local). Clientes e depoimentos são fictícios; o WhatsApp é o real.', 'html.parser'))

# Links internos
for a in home.find_all('a', href=True):
    h = a['href']
    if h.startswith('/#'): a['href'] = h[1:]
    elif h == '/': a['href'] = '#'
    elif h.startswith('/agendar') or h.startswith('/criar-conta'): a['href'] = '#'; a['data-agendar'] = '1'
    elif h == '/planos': a['href'] = '#planos'
    elif h == '/sobre': a['href'] = '#sobre'
    elif h == '/como-funciona': a['href'] = '#consultoria'
    elif h == '/duvidas': a['href'] = '#duvidas'
    elif h.startswith('/entrar'): a['href'] = '#cliente'
    elif h.startswith('/login'): a['href'] = '#cliente'
    elif h.startswith('/privacidade'): a['href'] = '#privacidade'; a.attrs.pop('target', None)

# Formulário de contato -> WhatsApp (só existe com a agenda on-line ligada; no modo WhatsApp o contato já monta a mensagem)
form = home.find('form')
if form:
    for k in ['action', 'method', 'enctype', 'encType']: form.attrs.pop(k, None)
    form['id'] = 'form-contato'
    for inp in form.select('input[type=hidden]'): inp.decompose()

# Seções extras: área do paciente (explicação) + política de privacidade
main = home.find('main')
area = BeautifulSoup('''
<section class="tl-sec" id="area-do-paciente">
  <div class="tl-container" style="max-width:980px">
    <p class="sec-label">/ ÁREA DO CLIENTE</p>
    <h2 class="display">Acompanhamento também entre as consultas</h2>
    <p class="tl-lead">Clientes em acompanhamento recebem acesso exclusivo ao app: a tela <strong>Hoje</strong> mostra a próxima refeição e permite marcar
    o que foi feito, o <strong>Plano</strong> traz as opções e substituições, e há contador de água, registro de peso,
    gráficos de evolução, calculadoras e mensagens.</p>
    <p class="tl-lead">No painel, o André monta o plano com cálculo automático de calorias e macros, acompanha quem está em dia
    e responde a cada registro do diário. O cliente também tem lista de compras, receitas, materiais e a agenda com confirmação de presença.</p>
    <div class="tl-actions"><a class="pill" href="#cliente">Ver a área do cliente <span aria-hidden="true">→</span></a><a class="ulink" href="#andre">Ver o painel do André</a><a class="ulink" href="#andre/acompanhamento">Ver o Acompanhamento</a></div>
    <p class="tl-note">Nesta prévia, as duas telas funcionam como demonstração e guardam os dados só no seu navegador. Na versão publicada, cada cliente entra com login e senha e só vê os próprios dados.</p>
  </div>
</section>''', 'html.parser')
main.append(area)
def bring(doc, first_id):
    # Seções de outra página do site, com os links trocados para dentro do arquivo.
    for i, sec in enumerate(doc.find('main').find_all('section', recursive=False)):
        if i == 0: sec['id'] = first_id
        for a in sec.find_all('a', href=True):
            if a['href'].startswith('/criar-conta') or a['href'].startswith('/agendar'):
                a['href'] = '#'; a['data-agendar'] = '1'
            elif a['href'] == '/planos': a['href'] = '#planos'
        main.append(sec.extract())
# Páginas de planos e dúvidas (no site publicado ficam em /planos e /duvidas).
bring(plans, 'planos')
bring(faqp, 'duvidas')
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
    var card = a.closest('li, article');
    var name = card && card.querySelector('.tl-plan__name');
    var svc = name ? name.textContent.trim() : '';
    a.href = waLink(svc ? 'Olá! Vim pelo site e tenho interesse no plano ' + svc + '.' : 'Olá! Vim pelo site e gostaria de agendar uma consulta.');
    a.target = '_blank'; a.rel = 'noopener noreferrer';
  });

  // Menu do celular fecha ao escolher um item.
  document.querySelectorAll('.mobile-menu a, .site-menu a').forEach(function (a) {
    a.addEventListener('click', function () { a.closest('details').removeAttribute('open'); });
  });

  // Contato pelo WhatsApp: a mensagem é montada enquanto a pessoa digita.
  var waName = document.getElementById('wa-name');
  if (waName) {
    var box = waName.closest('.stack');
    var waGo = box.querySelector('a[href*="wa.me"]');
    var val = function (id) { return document.getElementById(id).value.trim(); };
    var upd = function () {
      var n = val('wa-name'), i = val('wa-interest'), m = val('wa-message');
      waGo.href = waLink(['Olá! Vim pelo site' + (n ? ' e meu nome é ' + n : '') + '.',
        i ? 'Tenho interesse em: ' + i + '.' : 'Gostaria de mais informações sobre o acompanhamento.', m].filter(Boolean).join(' '));
    };
    box.addEventListener('input', upd); box.addEventListener('change', upd);
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
fx = home.new_tag('script'); fx.string = fx_js
home.body.append(fx)
demo = home.new_tag('script'); demo.string = demo_js
home.body.append(demo)

out = '<!doctype html>\n' + str(home).replace('<!DOCTYPE html>', '')
open(os.path.join(ROOT, 'previa/index.html'), 'w', encoding='utf-8').write(out)
print(len(out))
