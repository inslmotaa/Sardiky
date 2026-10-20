/*
 * Demonstração local (sem servidor) da área do cliente e do painel do André.
 * Os dados ficam salvos apenas no navegador (localStorage). A versão publicada
 * do sistema usa banco de dados, login e permissões de verdade.
 */
(function () {
  'use strict'

  var KEY = 'andre-farion-demo-v1'
  var appEl = document.getElementById('view-app')
  var siteEl = document.getElementById('view-site')
  if (!appEl || !siteEl) return

  /* ------------------------------ utilitários ------------------------------ */

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  function uid() {
    return Math.random().toString(36).slice(2, 10)
  }
  function today() {
    var d = new Date()
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  }
  function nowTime() {
    var d = new Date()
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  }
  function fmtDay(s) {
    if (!s) return '—'
    var p = s.slice(0, 10).split('-')
    return p[2] + '/' + p[1] + '/' + p[0]
  }
  function addDays(s, n) {
    var p = s.split('-').map(Number)
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n))
    return d.toISOString().slice(0, 10)
  }
  function clone(o) {
    return JSON.parse(JSON.stringify(o))
  }
  function emptyItem() {
    return { id: uid(), food: '', quantity: '', measure: '', notes: '', subs: [] }
  }

  /* ------------------------------ dados de exemplo ------------------------------ */

  function samplePlan() {
    return {
      title: 'Plano alimentar — reeducação',
      validUntil: addDays(today(), 30),
      guidance:
        'Beba água ao longo do dia (meta combinada: 2 litros). Prefira preparações assadas, cozidas ou grelhadas. Mastigue devagar e faça as refeições sem telas sempre que possível.',
      meals: [
        {
          id: uid(), name: 'Café da manhã', time: '07:00', notes: '',
          items: [
            { id: uid(), food: 'Pão integral', quantity: '50 g', measure: '2 fatias', notes: '', subs: [{ food: 'Tapioca', quantity: '40 g', measure: '2 colheres de sopa de goma' }, { food: 'Cuscuz de milho', quantity: '80 g', measure: '1 xícara' }] },
            { id: uid(), food: 'Ovo mexido', quantity: '100 g', measure: '2 unidades', notes: 'Pouco óleo', subs: [{ food: 'Queijo branco', quantity: '60 g', measure: '2 fatias' }] },
            { id: uid(), food: 'Mamão', quantity: '150 g', measure: '1 fatia média', notes: '', subs: [{ food: 'Banana', quantity: '80 g', measure: '1 unidade' }] },
          ],
        },
        {
          id: uid(), name: 'Almoço', time: '12:30', notes: 'Comece pela salada.',
          items: [
            { id: uid(), food: 'Salada de folhas e legumes', quantity: 'à vontade', measure: 'meio prato', notes: '', subs: [] },
            { id: uid(), food: 'Arroz integral', quantity: '100 g', measure: '4 colheres de sopa', notes: '', subs: [{ food: 'Batata-doce', quantity: '150 g', measure: '1 unidade média' }] },
            { id: uid(), food: 'Feijão', quantity: '80 g', measure: '1 concha pequena', notes: '', subs: [{ food: 'Lentilha', quantity: '80 g', measure: '1 concha pequena' }] },
            { id: uid(), food: 'Frango grelhado', quantity: '120 g', measure: '1 filé médio', notes: '', subs: [{ food: 'Peixe assado', quantity: '130 g', measure: '1 posta média' }] },
          ],
        },
        {
          id: uid(), name: 'Lanche da tarde', time: '16:00', notes: '',
          items: [
            { id: uid(), food: 'Iogurte natural', quantity: '170 g', measure: '1 pote', notes: '', subs: [{ food: 'Kefir', quantity: '170 g', measure: '1 copo pequeno' }] },
            { id: uid(), food: 'Aveia em flocos', quantity: '20 g', measure: '2 colheres de sopa', notes: '', subs: [] },
          ],
        },
        {
          id: uid(), name: 'Jantar', time: '19:30', notes: '',
          items: [
            { id: uid(), food: 'Omelete com legumes', quantity: '2 ovos', measure: '1 unidade', notes: '', subs: [{ food: 'Sopa de legumes com frango', quantity: '400 ml', measure: '1 prato fundo' }] },
            { id: uid(), food: 'Salada crua', quantity: 'à vontade', measure: '1 prato raso', notes: '', subs: [] },
          ],
        },
      ],
    }
  }

  function seed() {
    var p = samplePlan()
    var t = today()
    return {
      currentClient: 'c1',
      clients: [
        {
          id: 'c1',
          name: 'Beatriz Exemplo',
          objective: 'Reeducação alimentar e mais disposição',
          nextAppointment: addDays(t, 5) + ' 09:00',
          goals: [
            { title: 'Reduzir a circunferência da cintura para 80 cm', progress: 83 },
            { title: 'Incluir frutas em 2 refeições por dia', progress: 60 },
          ],
          weights: [
            { date: addDays(t, -120), value: 78.4 },
            { date: addDays(t, -90), value: 77.3 },
            { date: addDays(t, -60), value: 76.6 },
            { date: addDays(t, -30), value: 75.9 },
            { date: addDays(t, -2), value: 75.1 },
          ],
          draft: null,
          published: [{ version: 1, date: addDays(t, -30), plan: p }],
          diary: [
            { id: uid(), date: addDays(t, -1), time: '07:15', meal: 'Café da manhã', foods: 'Pão integral com ovo mexido e mamão', adherence: 'total', notes: '' },
            { id: uid(), date: addDays(t, -1), time: '17:30', meal: 'Lanche da tarde', foods: 'Salgado assado e refrigerante zero', adherence: 'nao', notes: 'Reunião longa, fiquei muito tempo sem comer.' },
          ],
        },
        {
          id: 'c2',
          name: 'Lucas Fictício',
          objective: 'Alimentação para treinos de corrida',
          nextAppointment: addDays(t, 9) + ' 16:00',
          goals: [{ title: 'Ajustar a alimentação pré-treino', progress: 30 }],
          weights: [{ date: addDays(t, -20), value: 71.2 }],
          draft: (function () {
            var d = samplePlan()
            d.title = 'Plano para treinos de corrida'
            d.guidance = 'Nos dias de treino longo, faça o lanche 1 hora antes do exercício e reforce a hidratação.'
            return d
          })(),
          published: [],
          diary: [],
        },
      ],
    }
  }

  var store
  function load() {
    try {
      store = JSON.parse(localStorage.getItem(KEY) || 'null')
    } catch (e) {
      store = null
    }
    if (!store || !store.clients) store = seed()
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(store))
    } catch (e) {
      /* navegação privada: segue funcionando só nesta aba */
    }
  }
  function client(id) {
    for (var i = 0; i < store.clients.length; i++) if (store.clients[i].id === id) return store.clients[i]
    return store.clients[0]
  }
  function currentPlan(c) {
    return c.published.length ? c.published[c.published.length - 1] : null
  }

  /* ------------------------------ peças visuais ------------------------------ */

  var ADH = { total: ['Segui o plano', 'badge--ok'], parcial: ['Segui em parte', 'badge--warn'], nao: ['Não segui', 'badge--danger'] }

  function demoBar(extra) {
    return (
      '<div class="demo-bar no-print"><div class="container row row--between">' +
      '<span><strong>Demonstração.</strong> Os dados ficam salvos só neste navegador. A versão publicada tem login, senha e banco de dados.</span>' +
      '<span class="row" style="gap:8px">' + (extra || '') +
      '<button type="button" class="btn btn--sm" data-action="reset">Restaurar exemplo</button></span>' +
      '</div></div>'
    )
  }

  function planView(entry) {
    var plan = entry.plan
    var meals = plan.meals.slice().sort(function (a, b) {
      return (a.time || '99').localeCompare(b.time || '99')
    })
    var html = '<div class="stack">'
    meals.forEach(function (m) {
      html += '<section class="meal"><header class="meal__head">' + (m.time ? '<span class="meal__time">' + esc(m.time) + '</span>' : '') + '<h3>' + esc(m.name) + '</h3></header><ul class="meal__items">'
      m.items.forEach(function (it) {
        html += '<li><div class="food"><span class="food__name">' + esc(it.food) + '</span><span class="food__qty">' + esc([it.measure, it.quantity].filter(Boolean).join(' · ')) + '</span></div>'
        if (it.notes) html += '<div class="small muted">' + esc(it.notes) + '</div>'
        if (it.subs && it.subs.length) {
          html += '<div class="subs"><strong>Substituições autorizadas:</strong><ul>'
          it.subs.forEach(function (s) {
            var q = [s.measure, s.quantity].filter(Boolean).join(' · ')
            html += '<li>' + esc(s.food) + (q ? ' — ' + esc(q) : '') + '</li>'
          })
          html += '</ul></div>'
        }
        html += '</li>'
      })
      if (!m.items.length) html += '<li class="muted">Sem itens.</li>'
      html += '</ul>' + (m.notes ? '<p class="small meal__note"><strong>Observação:</strong> ' + esc(m.notes) + '</p>' : '') + '</section>'
    })
    if (plan.guidance) html += '<section class="card card--soft"><h3>Orientações do nutricionista</h3><p style="white-space:pre-wrap;margin:0">' + esc(plan.guidance) + '</p></section>'
    return html + '</div>'
  }

  function weightChart(points) {
    if (points.length < 2) return '<p class="muted small">Ainda não há registros suficientes para o gráfico.</p>'
    var W = 600, H = 200, pl = 40, pr = 46, pt = 14, pb = 28
    var vals = points.map(function (p) { return p.value })
    var lo = Math.min.apply(null, vals) - 1, hi = Math.max.apply(null, vals) + 1
    var t0 = Date.parse(points[0].date), t1 = Date.parse(points[points.length - 1].date)
    function x(d) { return pl + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - pl - pr) }
    function y(v) { return pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb) }
    var path = points.map(function (p, i) { return (i ? 'L' : 'M') + x(p.date).toFixed(1) + ',' + y(p.value).toFixed(1) }).join(' ')
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evolução do peso de ' + vals[0] + ' kg para ' + vals[vals.length - 1] + ' kg">'
    ;[lo + 1, (lo + hi) / 2, hi - 1].forEach(function (v) {
      svg += '<line class="grid-line" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v.toFixed(1).replace('.', ',') + '</text>'
    })
    svg += '<path class="series-line" d="' + path + '"/>'
    points.forEach(function (p) {
      svg += '<circle class="pt" cx="' + x(p.date) + '" cy="' + y(p.value) + '" r="5"><title>' + fmtDay(p.date) + ': ' + String(p.value).replace('.', ',') + ' kg</title></circle>'
    })
    var last = points[points.length - 1]
    svg += '<text x="' + (x(last.date) + 9) + '" y="' + (y(last.value) + 4) + '" style="fill:var(--ink);font-weight:600">' + String(last.value).replace('.', ',') + '</text>'
    svg += '<text x="' + pl + '" y="' + (H - 6) + '">' + fmtDay(points[0].date) + '</text><text x="' + (W - pr) + '" y="' + (H - 6) + '" text-anchor="end">' + fmtDay(last.date) + '</text></svg>'
    return svg + '<p class="legend"><span><i class="l-pro"></i> Medição profissional</span></p>'
  }

  /* ------------------------------ área do cliente ------------------------------ */

  var clientTab = 'inicio'

  function renderClient() {
    var c = client(store.currentClient)
    var entry = currentPlan(c)
    var options = store.clients.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'
    }).join('')
    var switcher = '<label class="small row" style="gap:6px">Ver como <select data-action="pick-client" class="demo-select">' + options + '</select></label>'
    var tabs = [['inicio', 'Início'], ['plano', 'Plano alimentar'], ['diario', 'Diário'], ['evolucao', 'Evolução']]
    var html = demoBar(switcher)
    html += '<header class="patient-header no-print"><div class="container patient-header__inner"><a class="brand" href="#"><span class="brand__mark">' + leaf() + '</span><span class="brand__name">André Farion<span class="brand__sub">Área do cliente</span></span></a>' +
      '<a class="btn btn--sm" href="#">Voltar ao site</a></div></header>'
    html += '<main class="patient-main"><div class="container stack" style="--gap:20px">'
    html += '<nav class="tabs no-print" aria-label="Seções">' + tabs.map(function (t) {
      return '<a href="#cliente/' + t[0] + '"' + (clientTab === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'
    }).join('') + '</nav>'

    if (clientTab === 'inicio') {
      html += '<div><h1 style="margin-bottom:4px">Olá, ' + esc(c.name.split(' ')[0]) + '!</h1><p class="muted" style="margin:0">Cada registro ajuda no seu acompanhamento. Pequenos passos contam.</p></div>'
      html += '<div class="grid-2"><section class="card"><div class="card__head"><h2>Próxima consulta</h2></div><p class="stat__value" style="font-size:1.4rem;margin:0">' + esc(fmtDay(c.nextAppointment) + ' às ' + c.nextAppointment.slice(11)) + '</p><p style="margin:4px 0 0">Retorno · <span class="badge badge--ok">Confirmada</span></p></section>'
      html += '<section class="card"><div class="card__head"><h2>Plano alimentar</h2>' + (entry ? '<a class="small" href="#cliente/plano">Abrir plano</a>' : '') + '</div>'
      if (entry) {
        html += '<strong style="display:block">' + esc(entry.plan.title) + '</strong><span class="muted small" style="display:block">Versão ' + entry.version + ' · publicada em ' + fmtDay(entry.date) + (entry.plan.validUntil ? ' · válida até ' + fmtDay(entry.plan.validUntil) : '') + '</span><ul class="list" style="margin-top:10px">'
        entry.plan.meals.slice().sort(function (a, b) { return (a.time || '99').localeCompare(b.time || '99') }).forEach(function (m) {
          html += '<li class="row row--between" style="padding:6px 0"><span>' + esc(m.name) + '</span><span class="muted">' + esc(m.time) + '</span></li>'
        })
        html += '</ul>'
      } else html += '<p class="muted">Seu plano ainda está sendo preparado. Ele aparecerá aqui assim que o André publicar.</p>'
      html += '</section></div>'
      html += '<section class="card"><div class="grid-4"><a class="btn btn--block" href="#cliente/diario">Registrar refeição</a><a class="btn btn--block" href="#cliente/plano">Ver plano</a><a class="btn btn--block" href="#cliente/evolucao">Minha evolução</a><a class="btn btn--block btn--whatsapp" data-action="whats" href="#">Falar com o André</a></div></section>'
      html += '<div class="grid-2"><section class="card"><div class="card__head"><h2>Metas</h2></div>' + (c.goals.length ? '' : '<p class="muted">As metas serão definidas com o André na consulta.</p>') + '<ul class="list">'
      c.goals.forEach(function (g) {
        html += '<li><div class="row row--between"><span>' + esc(g.title) + '</span><span class="small muted">' + g.progress + '%</span></div><div class="progress" style="margin-top:6px"><span style="width:' + g.progress + '%"></span></div></li>'
      })
      html += '</ul></section><section class="card"><div class="card__head"><h2>Orientações do André</h2></div>' + (entry && entry.plan.guidance ? '<p style="white-space:pre-wrap;margin:0">' + esc(entry.plan.guidance) + '</p>' : '<p class="muted">Nenhuma orientação ainda.</p>') + '</section></div>'
    }

    if (clientTab === 'plano') {
      if (!entry) html += '<div class="empty"><p style="margin:0">Seu plano ainda não foi publicado.</p></div>'
      else {
        html += '<div class="page-head"><div><h1>' + esc(entry.plan.title) + '</h1><p>Versão ' + entry.version + ' · publicada em ' + fmtDay(entry.date) + (entry.plan.validUntil ? ' · válida até ' + fmtDay(entry.plan.validUntil) : '') + '</p></div><div class="row no-print"><button type="button" class="btn" data-action="print">Imprimir / salvar PDF</button></div></div>'
        html += '<p class="muted small no-print" style="margin:0">Plano elaborado e revisado pelo nutricionista. Em caso de dúvida, fale com o André — não altere quantidades por conta própria.</p>'
        html += planView(entry)
        if (c.published.length > 1) {
          html += '<section class="card no-print"><h2 style="font-size:1.1rem">Versões anteriores</h2><ul class="list">'
          c.published.slice(0, -1).reverse().forEach(function (v) {
            html += '<li>Versão ' + v.version + ' · ' + fmtDay(v.date) + '</li>'
          })
          html += '</ul></section>'
        }
      }
    }

    if (clientTab === 'diario') {
      html += '<div class="page-head"><div><h1>Diário alimentar</h1><p>Registre o que comeu e como se sentiu. Não existe registro “certo” — o importante é ser sincero.</p></div></div>'
      html += '<section class="card"><form data-form="diary" class="stack"><div class="form-grid form-grid--3">' +
        '<div class="field"><label for="d-meal">Refeição</label><select id="d-meal" name="meal">' + ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'].map(function (m) { return '<option>' + m + '</option>' }).join('') + '</select></div>' +
        '<div class="field"><label for="d-date">Data</label><input id="d-date" type="date" name="date" value="' + today() + '" max="' + today() + '"></div>' +
        '<div class="field"><label for="d-time">Horário</label><input id="d-time" type="time" name="time" value="' + nowTime() + '"></div></div>' +
        '<div class="field"><label for="d-foods">O que você comeu e bebeu?</label><textarea id="d-foods" name="foods" rows="2" maxlength="1000" required></textarea></div>' +
        '<div class="form-grid"><div class="field"><label for="d-adh">Seguiu o plano?</label><select id="d-adh" name="adherence"><option value="total">Sim</option><option value="parcial">Em parte</option><option value="nao">Não</option></select></div>' +
        '<div class="field"><label for="d-notes">Observações</label><input id="d-notes" type="text" name="notes" maxlength="300" placeholder="Fome, rotina, dificuldades…"></div></div>' +
        '<p class="alert alert--error" data-msg hidden></p><div><button class="btn btn--primary" type="submit">Salvar registro</button></div></form></section>'
      html += '<section class="stack"><h2 style="font-size:1.15rem;margin:0">Registros</h2>'
      if (!c.diary.length) html += '<div class="empty"><p style="margin:0">Nenhum registro ainda.</p></div>'
      else {
        html += '<ul class="card list">'
        c.diary.slice().sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time) }).forEach(function (d) {
          var a = ADH[d.adherence] || ADH.total
          html += '<li><div class="row row--between"><strong>' + fmtDay(d.date) + ' · ' + esc(d.time) + ' · ' + esc(d.meal) + '</strong><span class="badge ' + a[1] + '">' + a[0] + '</span></div><div>' + esc(d.foods) + '</div>' + (d.notes ? '<div class="small muted">“' + esc(d.notes) + '”</div>' : '') + '</li>'
        })
        html += '</ul>'
      }
      html += '</section>'
    }

    if (clientTab === 'evolucao') {
      html += '<div class="page-head"><div><h1>Sua evolução</h1><p>Medições registradas nas consultas com o André.</p></div></div>'
      html += '<section class="card"><h3>Peso (kg)</h3>' + weightChart(c.weights) + '</section>'
      html += '<div class="table-wrap"><table><thead><tr><th>Data</th><th class="num">Peso (kg)</th></tr></thead><tbody>' + c.weights.slice().reverse().map(function (w) {
        return '<tr><td>' + fmtDay(w.date) + '</td><td class="num">' + String(w.value).replace('.', ',') + '</td></tr>'
      }).join('') + '</tbody></table></div>'
    }
    html += '</div></main>'
    appEl.innerHTML = html
  }

  /* ------------------------------ painel do André ------------------------------ */

  var editing = null // cópia de trabalho do rascunho
  var editingClient = null

  function renderAdmin(clientId) {
    var html = demoBar()
    html += '<header class="demo-appbar no-print"><div class="container row row--between"><a class="brand" href="#andre"><span class="brand__mark">' + leaf() + '</span><span class="brand__name">André Farion<span class="brand__sub">Painel do nutricionista</span></span></a><a class="btn btn--sm" href="#">Voltar ao site</a></div></header>'
    html += '<main class="patient-main"><div class="container stack" style="--gap:20px">'
    if (!clientId) {
      html += '<div class="page-head"><div><h1>Clientes</h1><p>Escolha um cliente para montar e publicar o plano alimentar.</p></div></div>'
      html += '<div class="grid-2" style="align-items:start"><section class="stack">'
      store.clients.forEach(function (c) {
        var cur = currentPlan(c)
        html += '<div class="card row row--between"><div><strong>' + esc(c.name) + '</strong><div class="small muted">' + esc(c.objective || '') + '</div><div class="small" style="margin-top:4px">' +
          (cur ? '<span class="badge badge--ok">Plano publicado · v' + cur.version + '</span> ' : '<span class="badge badge--plain">Sem plano publicado</span> ') +
          (c.draft ? '<span class="badge badge--warn">Rascunho em edição</span>' : '') + '</div></div>' +
          '<a class="btn btn--primary btn--sm" href="#andre/' + esc(c.id) + '">Montar plano</a></div>'
      })
      html += '</section><section class="card"><h2 style="font-size:1.1rem">Novo cliente</h2><form data-form="new-client" class="stack">' +
        '<div class="field"><label for="n-name">Nome completo</label><input id="n-name" type="text" name="name" maxlength="120" required></div>' +
        '<div class="field"><label for="n-obj">Objetivo</label><input id="n-obj" type="text" name="objective" maxlength="200" placeholder="Ex.: emagrecimento, hipertrofia…"></div>' +
        '<p class="alert alert--error" data-msg hidden></p><div><button class="btn btn--primary" type="submit">Cadastrar cliente</button></div></form></section></div>'
      html += '</div></main>'
      appEl.innerHTML = html
      return
    }

    var c = client(clientId)
    if (editingClient !== c.id) {
      editingClient = c.id
      var cur = currentPlan(c)
      editing = c.draft ? clone(c.draft) : cur ? clone(cur.plan) : { title: 'Plano alimentar', validUntil: '', guidance: '', meals: [] }
    }
    var cur2 = currentPlan(c)
    html += '<div class="page-head"><div><nav class="breadcrumb"><a href="#andre">Clientes</a></nav><h1>' + esc(c.name) + '</h1><p>' + esc(c.objective || '') +
      ' · ' + (cur2 ? 'plano publicado: versão ' + cur2.version + ' (' + fmtDay(cur2.date) + ')' : 'ainda sem plano publicado') + '</p></div>' +
      '<div class="row"><button type="button" class="btn" data-action="view-as" data-id="' + esc(c.id) + '">Ver como o cliente</button></div></div>'
    html += '<p class="alert alert--warn">Você está editando um <strong>rascunho</strong>. O cliente só vê o plano depois que você revisa e clica em “Publicar para o cliente”.</p>'
    html += editorHtml(editing)
    if (c.diary.length) {
      html += '<section class="card"><h2 style="font-size:1.1rem">Diário do cliente</h2><ul class="list">'
      c.diary.slice().sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time) }).slice(0, 8).forEach(function (d) {
        var a = ADH[d.adherence] || ADH.total
        html += '<li><strong>' + fmtDay(d.date) + ' · ' + esc(d.time) + ' · ' + esc(d.meal) + '</strong> <span class="badge ' + a[1] + '">' + a[0] + '</span><div>' + esc(d.foods) + '</div>' + (d.notes ? '<div class="small muted">“' + esc(d.notes) + '”</div>' : '') + '</li>'
      })
      html += '</ul></section>'
    }
    html += '</div></main>'
    appEl.innerHTML = html
  }

  function input(path, value, label, attrs) {
    var id = 'e-' + path.replace(/\./g, '-')
    attrs = attrs || ''
    if (attrs.indexOf('type=') < 0) attrs = 'type="text" ' + attrs
    return '<div class="field"><label for="' + id + '" class="small">' + label + '</label><input id="' + id + '" data-path="' + path + '" value="' + esc(value) + '" ' + attrs + '></div>'
  }

  function editorHtml(plan) {
    var h = '<form data-form="plan" class="stack" style="--gap:16px"><section class="card"><div class="form-grid">' +
      input('title', plan.title, 'Título do plano', 'maxlength="160"') +
      input('validUntil', plan.validUntil, 'Válido até', 'type="date"') + '</div></section>'
    plan.meals.forEach(function (m, mi) {
      var p = 'meals.' + mi
      h += '<section class="editor-meal stack" style="--gap:10px"><div class="editor-row editor-row--meal">' +
        input(p + '.name', m.name, 'Refeição', 'maxlength="80" placeholder="Ex.: Almoço"') +
        input(p + '.time', m.time, 'Horário', 'type="time"') +
        '<button type="button" class="icon-btn" data-action="meal-up" data-mi="' + mi + '" aria-label="Subir refeição"' + (mi === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="icon-btn" data-action="meal-down" data-mi="' + mi + '" aria-label="Descer refeição"' + (mi === plan.meals.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="icon-btn" data-action="meal-del" data-mi="' + mi + '" aria-label="Remover refeição">✕</button></div>'
      m.items.forEach(function (it, ii) {
        var q = p + '.items.' + ii
        h += '<div class="editor-item stack" style="--gap:8px"><div class="editor-row">' +
          input(q + '.food', it.food, 'Alimento', 'maxlength="160" list="foods"') +
          input(q + '.quantity', it.quantity, 'Quantidade', 'maxlength="40" placeholder="100 g"') +
          input(q + '.measure', it.measure, 'Medida caseira', 'maxlength="80" placeholder="4 colheres de sopa"') +
          '<button type="button" class="icon-btn" data-action="item-del" data-mi="' + mi + '" data-ii="' + ii + '" aria-label="Remover alimento">✕</button></div>' +
          input(q + '.notes', it.notes, 'Observação do alimento', 'maxlength="300" placeholder="Opcional"')
        it.subs.forEach(function (s, si) {
          var r = q + '.subs.' + si
          h += '<div class="editor-row editor-row--sub sub-row">' +
            input(r + '.food', s.food, 'Substituição', 'maxlength="160" list="foods"') +
            input(r + '.quantity', s.quantity, 'Quantidade', 'maxlength="40"') +
            input(r + '.measure', s.measure, 'Medida caseira', 'maxlength="80"') +
            '<button type="button" class="icon-btn" data-action="sub-del" data-mi="' + mi + '" data-ii="' + ii + '" data-si="' + si + '" aria-label="Remover substituição">✕</button></div>'
        })
        h += '<div><button type="button" class="btn btn--ghost btn--sm" data-action="sub-add" data-mi="' + mi + '" data-ii="' + ii + '">+ Substituição</button></div></div>'
      })
      h += '<div class="row"><button type="button" class="btn btn--sm" data-action="item-add" data-mi="' + mi + '">+ Alimento</button></div>' +
        '<div class="field"><label for="e-' + p.replace('.', '-') + '-notes" class="small">Observações da refeição</label><textarea id="e-' + p.replace('.', '-') + '-notes" data-path="' + p + '.notes" rows="2" maxlength="600">' + esc(m.notes) + '</textarea></div></section>'
    })
    var used = plan.meals.map(function (m) { return m.name })
    h += '<div class="card row"><strong class="small">Adicionar refeição:</strong>' +
      [['Café da manhã', '07:00'], ['Lanche da manhã', '10:00'], ['Almoço', '12:30'], ['Lanche da tarde', '16:00'], ['Jantar', '19:30'], ['Ceia', '21:30']]
        .filter(function (x) { return used.indexOf(x[0]) < 0 })
        .map(function (x) { return '<button type="button" class="btn btn--sm" data-action="meal-add" data-name="' + x[0] + '" data-time="' + x[1] + '">+ ' + x[0] + '</button>' }).join('') +
      '<button type="button" class="btn btn--sm btn--ghost" data-action="meal-add" data-name="" data-time="">+ Outra</button></div>'
    h += '<section class="card"><div class="field"><label for="e-guidance">Orientações gerais e individualizadas</label><textarea id="e-guidance" data-path="guidance" rows="5" maxlength="5000" placeholder="Hidratação, preparo dos alimentos, comportamento alimentar…">' + esc(plan.guidance) + '</textarea></div></section>'
    h += '<div class="sticky-actions"><div class="row row--between"><span class="small muted" data-status>Rascunho</span><div class="row">' +
      '<label class="check small" style="align-items:center"><input type="checkbox" name="reviewed"> Revisei e aprovo este plano</label>' +
      '<button type="button" class="btn" data-action="save-draft">Salvar rascunho</button>' +
      '<button type="button" class="btn btn--primary" data-action="publish">Publicar para o cliente</button></div></div>' +
      '<p class="alert" data-msg hidden style="margin-top:10px"></p></div></form>'
    return h
  }

  function setPath(obj, path, value) {
    var parts = path.split('.')
    var o = obj
    for (var i = 0; i < parts.length - 1; i++) o = o[isNaN(parts[i]) ? parts[i] : Number(parts[i])]
    o[parts[parts.length - 1]] = value
  }

  function flash(form, text, ok) {
    var m = form.querySelector('[data-msg]')
    if (!m) return
    m.hidden = false
    m.className = 'alert ' + (ok ? 'alert--ok' : 'alert--error')
    m.textContent = text
  }

  function validatePlan(plan) {
    if (!plan.title.trim()) return 'Dê um título ao plano.'
    if (!plan.meals.length) return 'Inclua ao menos uma refeição.'
    for (var i = 0; i < plan.meals.length; i++) {
      var m = plan.meals[i]
      if (!m.name.trim()) return 'Dê um nome a todas as refeições.'
      if (!m.items.length) return 'A refeição “' + m.name + '” está sem alimentos.'
      for (var j = 0; j < m.items.length; j++) if (!m.items[j].food.trim()) return 'Há um alimento sem nome em “' + m.name + '”.'
    }
    return null
  }

  /* ------------------------------ eventos ------------------------------ */

  appEl.addEventListener('input', function (e) {
    var t = e.target
    if (t.dataset && t.dataset.path && editing) {
      setPath(editing, t.dataset.path, t.value)
      var st = appEl.querySelector('[data-status]')
      if (st) st.textContent = 'Alterações não salvas'
    }
  })

  appEl.addEventListener('change', function (e) {
    if (e.target.dataset && e.target.dataset.action === 'pick-client') {
      store.currentClient = e.target.value
      save()
      renderClient()
    }
  })

  appEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]')
    if (!b || b.tagName === 'SELECT') return
    var a = b.dataset.action
    var mi = Number(b.dataset.mi), ii = Number(b.dataset.ii), si = Number(b.dataset.si)
    var structural = true
    switch (a) {
      case 'reset':
        if (!window.confirm('Apagar as alterações e voltar aos dados de exemplo?')) return
        try { localStorage.removeItem(KEY) } catch (err) { /* sem armazenamento */ }
        load(); editingClient = null; route(); return
      case 'print': window.print(); return
      case 'whats': e.preventDefault(); var w = document.querySelector('.whatsapp-float'); if (w) window.open(w.href, '_blank', 'noopener'); return
      case 'view-as': store.currentClient = b.dataset.id; save(); location.hash = '#cliente/plano'; return
      case 'meal-add': editing.meals.push({ id: uid(), name: b.dataset.name, time: b.dataset.time, notes: '', items: [emptyItem()] }); break
      case 'meal-del': if (!window.confirm('Remover esta refeição e seus alimentos?')) return; editing.meals.splice(mi, 1); break
      case 'meal-up': editing.meals.splice(mi - 1, 0, editing.meals.splice(mi, 1)[0]); break
      case 'meal-down': editing.meals.splice(mi + 1, 0, editing.meals.splice(mi, 1)[0]); break
      case 'item-add': editing.meals[mi].items.push(emptyItem()); break
      case 'item-del': editing.meals[mi].items.splice(ii, 1); break
      case 'sub-add': editing.meals[mi].items[ii].subs.push({ food: '', quantity: '', measure: '' }); break
      case 'sub-del': editing.meals[mi].items[ii].subs.splice(si, 1); break
      case 'save-draft':
      case 'publish': {
        structural = false
        var form = b.closest('form')
        var c = client(editingClient)
        if (a === 'save-draft') {
          c.draft = clone(editing); save()
          flash(form, 'Rascunho salvo. O cliente ainda não vê esta versão.', true)
          appEl.querySelector('[data-status]').textContent = 'Rascunho salvo'
          return
        }
        var problem = validatePlan(editing)
        if (problem) { flash(form, problem, false); return }
        if (!form.querySelector('input[name=reviewed]').checked) { flash(form, 'Confirme que revisou o plano antes de publicar.', false); return }
        var version = c.published.length ? c.published[c.published.length - 1].version + 1 : 1
        c.published.push({ version: version, date: today(), plan: clone(editing) })
        c.draft = null; save()
        flash(form, 'Plano publicado (versão ' + version + '). O cliente já pode ver na área dele.', true)
        appEl.querySelector('[data-status]').textContent = 'Publicado'
        return
      }
      default: return
    }
    if (structural && editing) {
      var y = window.scrollY
      renderAdmin(editingClient)
      window.scrollTo(0, y)
    }
  })

  appEl.addEventListener('submit', function (e) {
    var f = e.target
    var el = function (n) { return f.elements.namedItem(n) }
    e.preventDefault()
    if (f.dataset.form === 'diary') {
      var foods = el('foods').value.trim()
      if (!foods) { flash(f, 'Descreva o que você comeu.', false); return }
      if (el('date').value > today()) { flash(f, 'Não é possível registrar datas futuras.', false); return }
      client(store.currentClient).diary.push({ id: uid(), date: el('date').value || today(), time: el('time').value, meal: el('meal').value, foods: foods, adherence: el('adherence').value, notes: el('notes').value.trim() })
      save(); renderClient()
    }
    if (f.dataset.form === 'new-client') {
      var name = el('name').value.trim()
      if (name.length < 3) { flash(f, 'Informe o nome do cliente.', false); return }
      var id = 'c' + uid()
      store.clients.push({ id: id, name: name, objective: el('objective').value.trim(), nextAppointment: addDays(today(), 7) + ' 10:00', goals: [], weights: [], draft: null, published: [], diary: [] })
      save(); location.hash = '#andre/' + id
    }
  })

  /* ------------------------------ navegação ------------------------------ */

  function leaf() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>'
  }

  function route() {
    var h = location.hash
    if (h.indexOf('#cliente') === 0 || h.indexOf('#andre') === 0) {
      siteEl.hidden = true
      appEl.hidden = false
      if (h.indexOf('#cliente') === 0) {
        clientTab = h.split('/')[1] || 'inicio'
        renderClient()
      } else {
        var id = h.split('/')[1]
        if (!id) editingClient = null
        renderAdmin(id)
      }
      window.scrollTo(0, 0)
    } else {
      appEl.hidden = true
      siteEl.hidden = false
    }
  }

  // Lista de alimentos para sugestão no editor.
  var dl = document.createElement('datalist')
  dl.id = 'foods'
  ;['Arroz branco', 'Arroz integral', 'Feijão', 'Lentilha', 'Grão-de-bico', 'Batata-doce', 'Mandioca', 'Macarrão integral', 'Pão integral', 'Tapioca', 'Cuscuz de milho', 'Aveia em flocos', 'Ovo cozido', 'Ovo mexido', 'Frango grelhado', 'Peixe assado', 'Carne magra', 'Queijo branco', 'Iogurte natural', 'Leite desnatado', 'Banana', 'Maçã', 'Mamão', 'Morango', 'Abacate', 'Salada de folhas', 'Legumes cozidos', 'Brócolis', 'Azeite de oliva', 'Castanha-do-pará', 'Pasta de amendoim', 'Whey protein', 'Café sem açúcar']
    .forEach(function (f) { var o = document.createElement('option'); o.value = f; dl.appendChild(o) })
  document.body.appendChild(dl)

  load()
  window.addEventListener('hashchange', route)
  route()
})()
