/* Área do aluno (/aluno): treino do dia, fichas, dieta e evolução. Feita para o celular. */
import { loadApi, today } from "./api.js";
import {
  $, $$, esc, ICONS, fmtDate, daysUntil, planStatus, chip, waLink, fmtNum, fmtRest, WEEKDAYS,
  toast, fail, renderAuth, demoBar, bindDemoBar, lineChart, beforeAfter, reduced
} from "./ui.js";

const root = document.getElementById("app");
const SITE = window.SITE || {};
let api, me, workouts = [], logs = {};

/* ---------- PWA: instalar na tela inicial ---------- */
let installEvent = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; const b = $("#installCard"); if (b) b.hidden = false; });
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

async function boot() {
  try { api = await loadApi(); }
  catch { root.innerHTML = `<main class="auth"><div class="auth__box card"><p>Sem conexão com o servidor. Verifique a internet e tente de novo.</p><button class="btn btn--red" onclick="location.reload()">Tentar de novo</button></div></main>`; return; }
  start();
}

async function start() {
  const session = await api.session();
  if (!session || api.authIntent) {
    renderAuth(root, {
      api, title: "Área do aluno", subtitle: "Seus treinos, sua dieta e sua evolução.",
      demoRoles: [{ role: "student", label: "Entrar como aluno" }], onDone: start
    });
    return;
  }
  root.innerHTML = '<div class="spinner" role="status" aria-label="Carregando"></div>';
  try {
    me = await api.myStudent();
  } catch (e) { fail(e); return; }
  if (!me) {
    root.innerHTML = `<main class="auth"><div class="auth__box card stack">
      <h1 class="h2">Quase lá</h1>
      <p class="muted">${session.role === "admin" ? "Você entrou como treinador. Use o painel para gerenciar os alunos." : "Seu acesso ainda não foi ligado a um cadastro de aluno. Fale com o Maicon pelo WhatsApp."}</p>
      ${session.role === "admin" ? '<a class="btn btn--red" href="../admin/">Abrir o painel</a>' : `<a class="btn btn--red" href="${waLink(SITE.whatsapp, "Olá Maicon! Não consigo ver meus treinos na área do aluno.")}" target="_blank" rel="noopener">Falar no WhatsApp</a>`}
      <button class="btn btn--ghost" id="out">Sair</button></div></main>`;
    $("#out").onclick = async () => { await api.signOut(); start(); };
    return;
  }
  if (!me.terms_accepted_at) return consentScreen();
  shell();
}

// LGPD: aceite no primeiro acesso
function consentScreen() {
  root.innerHTML = `<main class="auth"><div class="auth__box">
    <img class="auth__logo" src="../assets/logo-fonseca.png" alt="Fonseca Team" width="315" height="240">
    <form class="card stack" id="cf">
      <h1 class="h2">Seus dados, sua privacidade</h1>
      <p class="muted" style="font-size:14px">Aqui ficam informações de saúde: medidas, fotos de evolução e plano alimentar. Elas são visíveis apenas para você e para o treinador.</p>
      <label class="check"><input type="checkbox" name="ok" required><span>Li a <a class="link" href="../privacidade.html" target="_blank">política de privacidade</a> e autorizo o uso dos meus dados para a consultoria.</span></label>
      <p class="form-error" role="alert"></p>
      <button class="btn btn--red btn--block" type="submit">Continuar</button>
    </form></div></main>`;
  $("#cf").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!e.target.ok.checked) { $(".form-error").textContent = "Marque a autorização para continuar."; return; }
    try { await api.acceptTerms(); me.terms_accepted_at = new Date().toISOString(); shell(); } catch (ex) { fail(ex); }
  });
}

function shell() {
  root.innerHTML = `
    ${demoBar(api)}
    <header class="topbar">
      <a class="topbar__brand" href="#/inicio"><img src="../assets/logo-fonseca.png" alt="Fonseca Team" width="315" height="240"><span>Área do aluno</span></a>
      <button class="icon-btn" id="logout" aria-label="Sair">${ICONS.logout}</button>
    </header>
    <main class="student-main" id="view" tabindex="-1"></main>
    <nav class="tabbar" aria-label="Área do aluno">
      <a href="#/inicio" data-nav="inicio">${ICONS.home}<span>Início</span></a>
      <a href="#/treinos" data-nav="treinos">${ICONS.dumbbell}<span>Treinos</span></a>
      <a href="#/dieta" data-nav="dieta">${ICONS.food}<span>Dieta</span></a>
      <a href="#/evolucao" data-nav="evolucao">${ICONS.chart}<span>Evolução</span></a>
    </nav>`;
  bindDemoBar(api);
  $("#logout").onclick = async () => { await api.signOut(); location.hash = ""; start(); };
  window.onhashchange = route;
  route();
}

async function route() {
  const [, page = "inicio", id] = location.hash.split("/");
  $$("[data-nav]").forEach((a) => (a.dataset.nav === page ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  const view = $("#view");
  view.innerHTML = '<div class="spinner" role="status" aria-label="Carregando"></div>';
  try {
    if (page === "treinos") await viewWorkouts(view, id);
    else if (page === "dieta") await viewDiet(view);
    else if (page === "evolucao") await viewProgress(view);
    else await viewHome(view);
  } catch (e) { fail(e); view.innerHTML = '<div class="empty"><p>Não foi possível carregar. Puxe para atualizar ou tente de novo.</p></div>'; }
  window.scrollTo(0, 0);
}

async function loadWorkouts() {
  const [w, l] = await Promise.all([api.listWorkouts(me.id), api.getLogs(me.id, today())]);
  workouts = w;
  logs = Object.fromEntries(l.map((x) => [x.item_id, x]));
}

// Treino do dia: pelo dia da semana; sem dias definidos, o próximo depois do último feito
async function todaysWorkout() {
  if (!workouts.length) return { workout: null, rest: false };
  const dow = new Date().getDay();
  const scheduled = workouts.some((w) => w.weekdays?.length);
  if (scheduled) {
    const w = workouts.find((x) => x.weekdays?.includes(dow));
    return { workout: w || null, rest: !w };
  }
  const startedToday = workouts.find((w) => w.items.some((i) => logs[i.id]?.done));
  if (startedToday) return { workout: startedToday, rest: false };
  const lastId = await api.lastDoneWorkoutId(me.id);
  const i = workouts.findIndex((w) => w.id === lastId);
  return { workout: workouts[(i + 1) % workouts.length], rest: false };
}

/* =====================================================================
   INÍCIO
   ===================================================================== */
async function viewHome(view) {
  await loadWorkouts();
  const { workout, rest } = await todaysWorkout();
  const p = planStatus(me);
  const left = daysUntil(me.end_date);
  const total = me.start_date && me.end_date ? Math.max(1, daysUntil(me.end_date) - daysUntil(me.start_date)) : null;
  const pct = total ? Math.min(100, Math.max(0, ((total - Math.max(0, left)) / total) * 100)) : 0;
  const first = (me.full_name || "").split(" ")[0];
  const done = workout ? workout.items.filter((i) => logs[i.id]?.done).length : 0;
  const weekday = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  view.innerHTML = `
    <section class="hello"><p class="label">${esc(weekday)}</p><h1 class="h1">Bora, ${esc(first)}.</h1></section>

    <section class="card ${workout ? "card--accent" : ""} today-card" aria-label="Treino do dia">
      <p class="label">${rest ? "Hoje" : "Treino do dia"}</p>
      ${workout ? `
        <div><p class="today-card__name">${esc(workout.name)}</p><p class="muted">${esc(workout.focus || "")}</p></div>
        <div class="row row--between"><span class="label">${done}/${workout.items.length} exercícios feitos</span><span class="label">${workout.items.length ? Math.round((done / workout.items.length) * 100) : 0}%</span></div>
        <div class="progress" aria-hidden="true"><span style="width:${workout.items.length ? (done / workout.items.length) * 100 : 0}%"></span></div>
        <a class="btn btn--red btn--lg btn--block" href="#/treinos/${workout.id}">${done ? "Continuar treino" : "Começar treino"} →</a>`
      : rest ? `
        <div><p class="today-card__name">Descanso</p><p class="muted">Recuperar também é treino. Hidrate-se e durma bem.</p></div>
        <a class="btn btn--block" href="#/treinos">Ver minhas fichas</a>`
      : `<p class="muted">Seu treino está sendo montado. Assim que o Maicon publicar, ele aparece aqui.</p>`}
    </section>

    <section class="card plan-box" aria-label="Meu plano">
      <div class="row row--between"><p class="label">Meu plano</p>${chip(p)}</div>
      <div class="row row--between" style="align-items:flex-end">
        <div><p class="h2">${esc(me.plan || "Plano")}</p><p class="muted" style="font-size:14px">Vence em ${fmtDate(me.end_date)}</p></div>
        ${left !== null ? `<div style="text-align:right"><p class="big-num ${left <= 7 ? "red" : ""}">${Math.max(0, left)}</p><p class="label">${Math.max(0, left) === 1 ? "dia restante" : "dias restantes"}</p></div>` : ""}
      </div>
      ${total ? `<div class="progress" aria-hidden="true"><span style="width:${pct}%"></span></div>` : ""}
      ${left !== null && left <= 7 ? `<a class="btn btn--red btn--block" href="${waLink(SITE.whatsapp, `Olá Maicon! Quero renovar meu plano ${me.plan || ""}.`)}" target="_blank" rel="noopener">${ICONS.whatsapp} Renovar pelo WhatsApp</a>` : ""}
    </section>

    <a class="btn btn--lg btn--block" href="${waLink(SITE.whatsapp, `Olá Maicon! Aqui é ${first}.`)}" target="_blank" rel="noopener">${ICONS.whatsapp} Falar com o Maicon</a>

    <section class="card install" id="installCard" ${installEvent || (isIOS() && !isStandalone()) ? "" : "hidden"}>
      <img src="../assets/icon-192.png" alt="" width="44" height="44">
      <div class="grow"><p class="h3">Adicionar à tela inicial</p>
        <p class="muted" style="font-size:13px">${isIOS() ? "No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”." : "Abra como app, direto do celular."}</p></div>
      ${isIOS() ? "" : '<button class="btn btn--sm btn--red" id="install">Instalar</button>'}
    </section>`;
  const ib = $("#install", view);
  if (ib) ib.onclick = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    $("#installCard").hidden = true;
  };
}

/* =====================================================================
   MEUS TREINOS
   ===================================================================== */
async function viewWorkouts(view, id) {
  await loadWorkouts();
  if (!workouts.length) {
    view.innerHTML = `<h1 class="h1">Meus treinos</h1><div class="empty"><p>Nenhuma ficha publicada ainda.</p></div>`;
    return;
  }
  const { workout: todayW } = await todaysWorkout();
  const w = workouts.find((x) => x.id === id) || todayW || workouts[0];
  view.innerHTML = `
    <h1 class="h1">Meus treinos</h1>
    <div class="seg" role="group" aria-label="Fichas">${workouts.map((x) => `<button type="button" data-w="${x.id}" aria-pressed="${x.id === w.id}">${esc(x.name)}${todayW && x.id === todayW.id ? " · hoje" : ""}</button>`).join("")}</div>
    <section class="workout-head card">
      <p class="h2">${esc(w.focus || w.name)}</p>
      ${w.weekdays?.length ? `<p class="label">${w.weekdays.map((d) => WEEKDAYS[d]).join(" · ")}</p>` : ""}
      ${w.notes ? `<p class="muted" style="font-size:14px;white-space:pre-wrap">${esc(w.notes)}</p>` : ""}
      <div class="row row--between"><span class="label" id="doneCount"></span></div>
      <div class="progress" aria-hidden="true"><span id="doneBar"></span></div>
    </section>
    <div class="stack" id="exList">${w.items.map((it, i) => exerciseCard(it, i)).join("")}</div>`;

  $$("[data-w]", view).forEach((b) => (b.onclick = () => (location.hash = `#/treinos/${b.dataset.w}`)));
  const count = () => {
    const n = w.items.filter((i) => logs[i.id]?.done).length;
    $("#doneCount").textContent = `${n}/${w.items.length} feitos hoje`;
    $("#doneBar").style.width = (w.items.length ? (n / w.items.length) * 100 : 0) + "%";
    if (n === w.items.length && w.items.length) $("#doneCount").textContent = "Treino concluído. Mandou bem!";
  };
  count();

  // vídeo do YouTube: só carrega o player ao tocar
  $$("[data-yt]", view).forEach((b) => (b.onclick = () => {
    const info = window.Media.parse(b.dataset.yt);
    const f = document.createElement("iframe");
    f.src = window.Media.embedUrl(info, { background: false });
    f.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    f.setAttribute("allowfullscreen", "");
    f.title = "Vídeo do exercício";
    b.replaceWith(f);
  }));

  $$("[data-done]", view).forEach((cb) => cb.addEventListener("change", async () => {
    const itemId = cb.dataset.done;
    const card = cb.closest(".exercise");
    card.classList.toggle("is-done", cb.checked);
    try {
      logs[itemId] = await api.saveLog(me.id, itemId, today(), { done: cb.checked });
      count();
      if (cb.checked && navigator.vibrate) navigator.vibrate(30);
    } catch (e) { cb.checked = !cb.checked; card.classList.toggle("is-done", cb.checked); fail(e); }
  }));

  const timers = {};
  $$("[data-load]", view).forEach((inp) => inp.addEventListener("input", () => {
    clearTimeout(timers[inp.dataset.load]);
    timers[inp.dataset.load] = setTimeout(async () => {
      try { logs[inp.dataset.load] = await api.saveLog(me.id, inp.dataset.load, today(), { load_used: inp.value.trim() || null }); toast("Carga anotada."); }
      catch (e) { fail(e); }
    }, 700);
  }));

  $$("[data-rest]", view).forEach((b) => (b.onclick = () => startTimer(Number(b.dataset.rest) || 60, b.dataset.name)));
}

function exerciseCard(it, i) {
  const ex = it.exercise || { name: "Exercício removido" };
  const log = logs[it.id] || {};
  const yt = window.Media.parse(ex.video_url || "");
  let media = "";
  if (yt.kind === "youtube") media = `<button class="exercise__play" data-yt="${esc(ex.video_url)}" aria-label="Ver vídeo de ${esc(ex.name)}" style="background:url('${window.Media.ytThumb(yt)}') center/cover"><span>▶</span></button>`;
  else if (yt.kind === "vimeo") media = `<iframe src="${esc(window.Media.embedUrl(yt, { background: false }).replace("autoplay=1", "autoplay=0"))}" title="Vídeo de ${esc(ex.name)}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  else if (ex.media_url) {
    const isVideo = window.Media.parse(ex.media_url).kind === "video" || /^data:video/.test(ex.media_url);
    media = isVideo
      ? `<video src="${esc(ex.media_url)}" muted loop playsinline controls preload="metadata" ${reduced() ? "" : "autoplay"}></video>`
      : `<img src="${esc(ex.media_url)}" alt="Execução de ${esc(ex.name)}" loading="lazy">`;
  }
  return `
    <article class="card exercise${log.done ? " is-done" : ""}">
      ${media ? `<div class="exercise__media">${media}</div>` : ""}
      <div class="exercise__body">
        <div class="exercise__title">
          <div><p class="label">${String(i + 1).padStart(2, "0")} · ${esc(ex.muscle_group || "")}${ex.equipment ? " · " + esc(ex.equipment) : ""}</p>
          <h2 class="exercise__name">${esc(ex.name)}</h2></div>
          ${it.method ? `<span class="chip chip--red">${esc(it.method)}</span>` : ""}
        </div>
        <div class="stats4">
          <div><span class="label">Séries</span><strong>${esc(it.sets || "—")}</strong></div>
          <div><span class="label">Reps</span><strong>${esc(it.reps || "—")}</strong></div>
          <div><span class="label">Carga</span><strong>${esc(it.load || "—")}</strong></div>
          <div><span class="label">Descanso</span><strong>${fmtRest(it.rest_seconds)}</strong></div>
        </div>
        ${it.notes ? `<p style="font-size:14px"><span class="red">//</span> ${esc(it.notes)}</p>` : ""}
        ${ex.tips ? `<details class="tips"><summary>Como executar</summary><p>${esc(ex.tips)}</p></details>` : ""}
        <div class="ex-actions">
          <label class="field"><span>Carga usada hoje</span><input data-load="${it.id}" value="${esc(log.load_used || "")}" placeholder="${esc(it.load || "ex.: 20 kg")}" inputmode="text" autocomplete="off"></label>
          <button type="button" class="btn" data-rest="${it.rest_seconds || 60}" data-name="${esc(ex.name)}" style="min-height:48px">⏱ ${fmtRest(it.rest_seconds || 60)}</button>
        </div>
        <label class="done-toggle"><input type="checkbox" data-done="${it.id}" ${log.done ? "checked" : ""}><span class="box" aria-hidden="true"></span><span>Feito</span></label>
      </div>
    </article>`;
}

/* ---------- Timer de descanso ---------- */
const T = { el: null, end: 0, total: 0, int: 0, audio: null, lock: null, fired: false };
function startTimer(seconds, name = "") {
  stopTimer(false);
  T.total = seconds;
  T.end = Date.now() + seconds * 1000;
  T.fired = false;
  try { T.audio = T.audio || new (window.AudioContext || window.webkitAudioContext)(); T.audio.resume(); } catch { T.audio = null; }
  if (navigator.wakeLock) navigator.wakeLock.request("screen").then((l) => (T.lock = l)).catch(() => {});
  T.el = document.createElement("div");
  T.el.className = "timer";
  T.el.setAttribute("role", "timer");
  T.el.innerHTML = `
    <button class="icon-btn" data-t="-15" aria-label="Menos 15 segundos">−15</button>
    <div style="text-align:center"><p class="timer__time" aria-live="off"></p><p class="label" style="margin-top:4px">${esc(name ? "Descanso · " + name : "Descanso")}</p></div>
    <div class="row" style="gap:6px;flex-wrap:nowrap"><button class="icon-btn" data-t="15" aria-label="Mais 15 segundos">+15</button><button class="icon-btn" data-t="x" aria-label="Fechar timer">✕</button></div>
    <div class="timer__bar"><span></span></div>`;
  document.body.append(T.el);
  T.el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-t]");
    if (!b) return;
    if (b.dataset.t === "x") return stopTimer();
    T.end += Number(b.dataset.t) * 1000;
    T.total = Math.max(T.total, Math.ceil((T.end - Date.now()) / 1000));
    if (T.end > Date.now()) { T.fired = false; T.el.classList.remove("is-over"); }
    tick();
  });
  tick();
  T.int = setInterval(tick, 250);
}
function tick() {
  if (!T.el) return;
  const left = Math.ceil((T.end - Date.now()) / 1000);
  const s = Math.max(0, left);
  $(".timer__time", T.el).textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  $(".timer__bar span", T.el).style.width = `${Math.min(100, (s / T.total) * 100)}%`;
  if (left <= 0 && !T.fired) {
    T.fired = true;
    T.el.classList.add("is-over");
    $(".label", T.el).textContent = "Bora pra próxima série!";
    if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
    beep();
    setTimeout(() => { if (T.fired) stopTimer(); }, 8000);
  }
}
function beep() {
  if (!T.audio) return;
  [0, 0.25].forEach((t) => {
    const o = T.audio.createOscillator(), g = T.audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, T.audio.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.3, T.audio.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, T.audio.currentTime + t + 0.2);
    o.connect(g).connect(T.audio.destination);
    o.start(T.audio.currentTime + t);
    o.stop(T.audio.currentTime + t + 0.22);
  });
}
function stopTimer(releaseLock = true) {
  clearInterval(T.int);
  if (T.el) T.el.remove();
  T.el = null;
  if (releaseLock && T.lock) { T.lock.release().catch(() => {}); T.lock = null; }
}

/* =====================================================================
   MINHA DIETA
   ===================================================================== */
async function viewDiet(view) {
  const plan = await api.getNutrition(me.id);
  if (!plan) {
    view.innerHTML = `<h1 class="h1">Minha dieta</h1><div class="empty"><p>Nenhum plano alimentar publicado.</p></div>`;
    return;
  }
  const now = new Date();
  const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const next = plan.meals.find((m) => m.time && m.time >= nowStr);
  view.innerHTML = `
    <h1 class="h1">Minha dieta</h1>
    <section class="card stack">
      <p class="h2">${esc(plan.title)}</p>
      <div class="nutri"><span class="nutri__badge">CRN</span><div><p style="font-size:14px">Responsável: ${esc(plan.nutritionist_name)}</p><p class="label">${esc(plan.nutritionist_crn)}</p></div></div>
      ${plan.guidelines ? `<p class="muted" style="font-size:14px;white-space:pre-wrap">${esc(plan.guidelines)}</p>` : ""}
    </section>
    ${plan.meals.map((m) => `
      <section class="card meal${next && m.id === next.id ? " is-next" : ""}" aria-label="${esc(m.name)}">
        <span class="meal__time">${esc(m.time || "--:--")}</span>
        <div>
          <div class="row row--between"><h2 class="h3">${esc(m.name)}</h2>${next && m.id === next.id ? '<span class="chip chip--red">Próxima</span>' : ""}</div>
          <div class="meal__items">${(m.items || []).map((f) => `
            <div class="food"><div class="food__line"><span>${esc(f.food)}</span><span class="food__qty">${esc(f.quantity)}</span></div>
            ${f.substitutions ? `<p class="food__sub"><b>Troca</b>${esc(f.substitutions)}</p>` : ""}</div>`).join("")}</div>
        </div>
      </section>`).join("")}`;
}

/* =====================================================================
   MINHA EVOLUÇÃO
   ===================================================================== */
const MEASURES = [["weight", "Peso", "kg"], ["body_fat", "% gordura", "%"], ["waist", "Cintura", "cm"], ["hip", "Quadril", "cm"], ["chest", "Peito", "cm"], ["arm", "Braço", "cm"], ["thigh", "Coxa", "cm"], ["calf", "Panturrilha", "cm"]];

async function viewProgress(view) {
  const list = await api.listAssessments(me.id);
  if (!list.length) {
    view.innerHTML = `<h1 class="h1">Minha evolução</h1><div class="empty"><p>Sua primeira avaliação aparece aqui.</p></div>`;
    return;
  }
  const first = list[0], last = list[list.length - 1];
  const diff = (k) => (first[k] != null && last[k] != null ? Number(last[k]) - Number(first[k]) : null);
  const sign = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmtNum(Math.abs(n));
  const withPhotos = list.filter((a) => a.photoUrls?.length);
  const available = MEASURES.filter(([k]) => list.filter((a) => a[k] != null).length >= 1);

  view.innerHTML = `
    <h1 class="h1">Minha evolução</h1>
    <div class="kpis">
      <div class="kpi"><span class="label">Peso atual</span><strong>${fmtNum(last.weight)}</strong><span class="label">kg</span></div>
      <div class="kpi"><span class="label">Desde o início</span><strong class="${diff("weight") < 0 ? "red" : ""}">${diff("weight") === null ? "—" : sign(diff("weight"))}</strong><span class="label">kg</span></div>
      <div class="kpi"><span class="label">Cintura</span><strong>${diff("waist") === null ? "—" : sign(diff("waist"))}</strong><span class="label">cm</span></div>
    </div>
    <section class="card stack">
      <div class="measure-pick seg" role="group" aria-label="Medida do gráfico">${available.map(([k, l], i) => `<button type="button" data-m="${k}" aria-pressed="${i === 0}">${l}</button>`).join("")}</div>
      <p class="label" id="chartTitle"></p>
      <div id="chart"></div>
    </section>
    ${withPhotos.length >= 2 ? `<section class="card stack"><div class="row row--between"><p class="h3">Antes e depois</p><span class="label">${fmtDate(withPhotos[0].date)} → ${fmtDate(withPhotos[withPhotos.length - 1].date)}</span></div><div id="ba"></div></section>` : ""}
    ${withPhotos.length ? `<section class="card stack"><p class="h3">Fotos</p><div class="photo-grid">${withPhotos.flatMap((a) => a.photoUrls.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Foto de ${fmtDate(a.date)}" loading="lazy"><span>${fmtDate(a.date, { day: "2-digit", month: "2-digit" })}</span></a>`)).join("")}</div></section>` : ""}
    <section class="stack"><p class="h3">Histórico</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Data</th>${available.map(([, l, u]) => `<th>${l} (${u})</th>`).join("")}</tr></thead>
      <tbody>${list.slice().reverse().map((a) => `<tr><td>${fmtDate(a.date)}</td>${available.map(([k]) => `<td class="num">${fmtNum(a[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    </section>`;

  const draw = (k) => {
    const [, l, u] = MEASURES.find((m) => m[0] === k);
    $("#chartTitle").textContent = `${l} (${u})`;
    lineChart($("#chart"), list.map((a) => ({ date: a.date, value: a[k] })), { unit: u === "%" ? "%" : u });
  };
  $$("[data-m]", view).forEach((b) => (b.onclick = () => {
    $$("[data-m]", view).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw(b.dataset.m);
  }));
  if (available.length) draw(available[0][0]);
  if (withPhotos.length >= 2) $("#ba").append(beforeAfter(withPhotos[0].photoUrls[0], withPhotos[withPhotos.length - 1].photoUrls[0], fmtDate(withPhotos[0].date), fmtDate(withPhotos[withPhotos.length - 1].date)));
}

boot();
