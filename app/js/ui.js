/* Utilitários de interface da área logada (painel e aluno). */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const ICONS = {
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3.5 10.5 12 4l8.5 6.5V20h-5.5v-6h-6v6H3.5z"/></svg>',
  food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.5 1-4 3.5-4 7v4h4"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3.5 20.5h17M5 16l4.5-5 4 3L20 6.5"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>'
};

/* ---------- Datas ---------- */
export function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function fmtDate(iso, opts) {
  const d = parseDate(iso);
  if (!d) return "—";
  return opts ? d.toLocaleDateString("pt-BR", opts) : d.toLocaleDateString("pt-BR");
}
export function daysUntil(iso) {
  const d = parseDate(iso);
  if (!d) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
export function addMonths(iso, n) {
  const d = parseDate(iso);
  if (!d) return "";
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Situação do plano: ativo / vencendo (7 dias) / vencido / inativo
export function planStatus(s) {
  if (s.status === "inactive") return { tone: "off", label: "Inativo", days: null };
  const d = daysUntil(s.end_date);
  if (d === null) return { tone: "ok", label: "Ativo", days: null };
  if (d < 0) return { tone: "late", label: `Vencido há ${-d} ${-d === 1 ? "dia" : "dias"}`, days: d };
  if (d === 0) return { tone: "warn", label: "Vence hoje", days: 0 };
  if (d <= 7) return { tone: "warn", label: `Vence em ${d} ${d === 1 ? "dia" : "dias"}`, days: d };
  return { tone: "ok", label: "Ativo", days: d };
}
export const chip = (st) => `<span class="chip chip--${st.tone}">${esc(st.label)}</span>`;

export const waLink = (number, msg = "") => `https://wa.me/${String(number || "").replace(/\D/g, "")}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
export const fmtNum = (n, digits = 1) => (n === null || n === undefined || n === "" ? "—" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: digits }));
export const fmtRest = (s) => (!s ? "—" : s >= 60 ? `${Math.floor(s / 60)}min${s % 60 ? String(s % 60).padStart(2, "0") : ""}` : `${s}s`);

/* ---------- Toast ---------- */
let toastWrap;
export function toast(msg, type = "ok") {
  if (!toastWrap) {
    toastWrap = document.createElement("div");
    toastWrap.className = "toast-wrap";
    toastWrap.setAttribute("role", "status");
    toastWrap.setAttribute("aria-live", "polite");
    document.body.append(toastWrap);
  }
  const t = document.createElement("div");
  t.className = "toast" + (type === "error" ? " toast--error" : "");
  t.textContent = msg;
  toastWrap.append(t);
  setTimeout(() => t.remove(), type === "error" ? 5000 : 2600);
}
export const fail = (e) => { console.error(e); toast(e?.message || "Algo deu errado. Tente de novo.", "error"); };

/* ---------- Formulários ---------- */
export function formData(form) {
  const o = {};
  new FormData(form).forEach((v, k) => {
    if (v instanceof File) return;
    if (k in o) o[k] = [].concat(o[k], v); else o[k] = typeof v === "string" ? v.trim() : v;
  });
  return o;
}

/*
 * Diálogo com formulário. onSubmit(form, dialog) pode lançar erro: a
 * mensagem aparece no rodapé e o diálogo continua aberto.
 */
export function dialog({ title, body, submit = "Salvar", cancel = "Cancelar", wide = false, danger = null, onSubmit, onOpen }) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "dlg" + (wide ? " dlg--wide" : "");
    d.innerHTML = `
      <form class="dlg__form" method="dialog" novalidate>
        <header class="dlg__head">
          <h2 class="h2">${esc(title)}</h2>
          <button type="button" class="icon-btn icon-btn--sm" data-x aria-label="Fechar">✕</button>
        </header>
        <div class="dlg__body">${body}<p class="form-error" role="alert"></p></div>
        <footer class="dlg__foot">
          ${danger ? `<button type="button" class="btn btn--danger" data-danger style="margin-right:auto">${esc(danger.label)}</button>` : ""}
          ${cancel ? `<button type="button" class="btn btn--ghost" data-x>${esc(cancel)}</button>` : ""}
          ${submit ? `<button type="submit" class="btn btn--red">${esc(submit)}</button>` : ""}
        </footer>
      </form>`;
    document.body.append(d);
    const form = $("form", d);
    const err = $(".form-error", d);
    const close = (val) => { d.close(); d.remove(); resolve(val); };
    $$("[data-x]", d).forEach((b) => b.addEventListener("click", () => close(null)));
    d.addEventListener("cancel", (e) => { e.preventDefault(); close(null); });
    if (danger) $("[data-danger]", d).addEventListener("click", async () => {
      if (await confirmDialog(danger.confirm || "Tem certeza?")) { try { await danger.onClick(); close("deleted"); } catch (e) { err.textContent = e.message; } }
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "";
      const invalid = $$("[required]", form).find((el) => (el.type === "checkbox" ? !el.checked : !String(el.value).trim()));
      if (invalid) {
        err.textContent = invalid.type === "checkbox" ? "Marque a confirmação para continuar." : "Preencha os campos obrigatórios.";
        invalid.focus();
        return;
      }
      const btn = $('button[type="submit"]', form);
      btn.disabled = true;
      try {
        const r = onSubmit ? await onSubmit(form, d) : formData(form);
        close(r === undefined ? true : r);
      } catch (ex) {
        err.textContent = ex?.message || "Não foi possível salvar.";
        btn.disabled = false;
      }
    });
    d.showModal();
    if (onOpen) onOpen(form, d);
    const first = $("input:not([type=hidden]), select, textarea", form);
    if (first && window.innerWidth > 600) first.focus();
  });
}

export function confirmDialog(message, { ok = "Confirmar" } = {}) {
  return dialog({ title: "Confirmar", body: `<p>${esc(message)}</p>`, submit: ok, onSubmit: () => true }).then(Boolean);
}

/* ---------- Mídia do exercício ---------- */
export function exerciseThumb(ex) {
  if (!ex) return "";
  const info = window.Media.parse(ex.video_url || ex.media_url || "");
  if (info.kind === "youtube") return `<img src="${window.Media.ytThumb(info)}" alt="" loading="lazy">`;
  if (ex.media_url) {
    const m = window.Media.parse(ex.media_url);
    if (m.kind === "video" || /^data:video/.test(ex.media_url)) return `<video src="${esc(ex.media_url)}" muted playsinline loop preload="metadata"></video>`;
    return `<img src="${esc(ex.media_url)}" alt="" loading="lazy">`;
  }
  return "";
}

/* ---------- Antes e depois ---------- */
export function beforeAfter(before, after, labelA = "Antes", labelB = "Depois") {
  const wrap = document.createElement("div");
  wrap.className = "ba";
  wrap.innerHTML = `
    <img src="${esc(after)}" alt="${esc(labelB)}">
    <img class="ba__before" src="${esc(before)}" alt="${esc(labelA)}">
    <span class="ba__tag" style="left:10px">${esc(labelA)}</span>
    <span class="ba__tag" style="right:10px">${esc(labelB)}</span>
    <input class="ba__range" type="range" min="0" max="100" value="50" aria-label="Comparar ${esc(labelA)} e ${esc(labelB)}">
    <span class="ba__handle" aria-hidden="true"><span class="ba__knob">↔</span></span>`;
  const r = $(".ba__range", wrap);
  r.addEventListener("input", () => wrap.style.setProperty("--pos", r.value + "%"));
  return wrap;
}

/*
 * Gráfico de linha (uma série). Pontos: [{ date: "2026-01-10", value: 82.4 }]
 * Linha de 2px, marcadores com anel, rótulo só no último ponto,
 * mira + tooltip ao passar o dedo/mouse.
 */
export function lineChart(el, points, { unit = "", digits = 1 } = {}) {
  const data = points.filter((p) => p.value !== null && p.value !== undefined && p.value !== "").map((p) => ({ ...p, value: Number(p.value) }));
  if (data.length < 2) {
    el.innerHTML = `<p class="muted" style="font-size:14px">${data.length ? "Com mais uma avaliação, o gráfico aparece aqui." : "Sem dados ainda."}</p>`;
    return;
  }
  // desenha no tamanho real do container para o texto não encolher no celular
  const W = Math.max(300, Math.round(el.clientWidth || 640)), H = W < 500 ? 200 : 240, pl = 40, pr = 56, pt = 16, pb = 28;
  const xs = data.map((d) => parseDate(d.date).getTime());
  const ys = data.map((d) => d.value);
  let min = Math.min(...ys), max = Math.max(...ys);
  const pad = (max - min) * 0.2 || 1;
  min -= pad; max += pad;
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const X = (t) => pl + ((t - x0) / (x1 - x0 || 1)) * (W - pl - pr);
  const Y = (v) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
  const ticks = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3);
  const path = data.map((d, i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(1)},${Y(d.value).toFixed(1)}`).join(" ");
  const area = `${path} L${X(xs[xs.length - 1]).toFixed(1)},${H - pb} L${X(xs[0]).toFixed(1)},${H - pb} Z`;
  const fmt = (v) => fmtNum(v, digits) + (unit ? " " + unit : "");
  const last = data[data.length - 1];
  el.innerHTML = `
    <div class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução: de ${fmt(data[0].value)} para ${fmt(last.value)}">
        <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E10600" stop-opacity=".22"/><stop offset="1" stop-color="#E10600" stop-opacity="0"/></linearGradient></defs>
        <g class="grid">${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/>`).join("")}</g>
        <g class="axis">
          ${ticks.map((t) => `<text x="${pl - 8}" y="${Y(t) + 3}" text-anchor="end">${fmtNum(t, digits)}</text>`).join("")}
          <text x="${pl}" y="${H - 8}">${fmtDate(data[0].date, { day: "2-digit", month: "short" })}</text>
          <text x="${W - pr}" y="${H - 8}" text-anchor="end">${fmtDate(last.date, { day: "2-digit", month: "short" })}</text>
        </g>
        <path class="area" d="${area}"/>
        <path class="line" d="${path}"/>
        <line class="cross" y1="${pt}" y2="${H - pb}" x1="-10" x2="-10"/>
        ${data.map((d, i) => `<circle class="pt" r="4.5" cx="${X(xs[i])}" cy="${Y(d.value)}"/>`).join("")}
        <text class="last-label" x="${X(xs[xs.length - 1]) + 10}" y="${Y(last.value) + 4}">${esc(fmt(last.value))}</text>
        <rect x="${pl}" y="0" width="${W - pl - pr}" height="${H}" fill="transparent" class="hit"/>
      </svg>
      <div class="chart__tip" hidden></div>
    </div>`;
  const svg = $("svg", el), tip = $(".chart__tip", el), cross = $(".cross", el), dots = $$(".pt", el);
  const show = (clientX) => {
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    let best = 0;
    xs.forEach((t, i) => { if (Math.abs(X(t) - vx) < Math.abs(X(xs[best]) - vx)) best = i; });
    const cx = X(xs[best]), cy = Y(data[best].value);
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx);
    dots.forEach((d, i) => d.classList.toggle("is-hover", i === best));
    tip.hidden = false;
    tip.textContent = `${fmtDate(data[best].date)} · ${fmt(data[best].value)}`;
    tip.style.left = (cx / W) * r.width + "px";
    tip.style.top = (cy / H) * r.height + "px";
  };
  const hide = () => { tip.hidden = true; cross.setAttribute("x1", -10); cross.setAttribute("x2", -10); dots.forEach((d) => d.classList.remove("is-hover")); };
  svg.addEventListener("pointermove", (e) => show(e.clientX));
  svg.addEventListener("pointerdown", (e) => show(e.clientX));
  svg.addEventListener("pointerleave", hide);
}

/* ---------- Tela de login compartilhada ---------- */
export function renderAuth(root, { api, title, subtitle, demoRoles, onDone }) {
  const intent = api.authIntent; // "invite" | "recovery" | null
  if (intent === "invite" || intent === "recovery") return renderSetPassword(root, { api, intent, onDone });
  root.innerHTML = `
    <main class="auth">
      <div class="auth__box">
        <img class="auth__logo" src="../assets/logo-fonseca.png" alt="Fonseca Team" width="315" height="240">
        <div class="auth__title"><h1 class="h1">${esc(title)}</h1><p class="muted">${esc(subtitle)}</p></div>
        ${api.authError ? `<p class="card" role="alert" style="border-color:var(--red)">O link expirou ou já foi usado. Peça um novo ao treinador ou use “Esqueci a senha”.</p>` : ""}
        <form class="card stack" id="loginForm" novalidate>
          <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="email" inputmode="email" required></label>
          <label class="field"><span>Senha</span><input type="password" name="password" autocomplete="current-password" required></label>
          <p class="form-error" role="alert"></p>
          <button class="btn btn--red btn--lg btn--block" type="submit">Entrar</button>
          <button class="btn btn--ghost btn--sm" type="button" id="forgot">Esqueci a senha</button>
        </form>
        ${api.mode === "demo" ? `
          <div class="card stack">
            <p class="label">Modo demonstração</p>
            <p style="font-size:14px">O Supabase ainda não foi configurado. Explore com dados de exemplo, salvos só neste navegador.</p>
            <div class="row">${demoRoles.map((r) => `<button class="btn btn--sm" data-demo="${r.role}">${esc(r.label)}</button>`).join("")}</div>
          </div>` : ""}
        <p class="auth__note"><a class="link" href="../">← Voltar ao site</a> · <a class="link" href="../privacidade.html">Privacidade</a></p>
      </div>
    </main>`;
  const form = $("#loginForm", root);
  const err = $(".form-error", form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { email, password } = formData(form);
    if (!email || !password) { err.textContent = "Informe e-mail e senha."; return; }
    const b = $('button[type="submit"]', form);
    b.disabled = true; err.textContent = "";
    try { await api.signIn(email, password); onDone(); }
    catch (ex) { err.textContent = ex.message; b.disabled = false; }
  });
  $("#forgot", root).addEventListener("click", async () => {
    const r = await dialog({
      title: "Redefinir senha",
      body: `<p class="muted" style="font-size:14px">Enviamos um link para você criar uma nova senha.</p>
             <label class="field"><span>E-mail</span><input type="email" name="email" value="${esc($('[name=email]', form).value)}" required></label>`,
      submit: "Enviar link",
      onSubmit: async (f) => { await api.resetPassword(formData(f).email); }
    });
    if (r) toast("Pronto! Confira seu e-mail.");
  });
  $$("[data-demo]", root).forEach((b) => b.addEventListener("click", async () => { await api.demoLogin(b.dataset.demo); onDone(); }));
}

function renderSetPassword(root, { api, intent, onDone }) {
  const invite = intent === "invite";
  root.innerHTML = `
    <main class="auth">
      <div class="auth__box">
        <img class="auth__logo" src="../assets/logo-fonseca.png" alt="Fonseca Team" width="315" height="240">
        <div class="auth__title"><h1 class="h1">${invite ? "Bem-vindo à Fonseca Team" : "Nova senha"}</h1>
          <p class="muted">${invite ? "Crie sua senha para acessar seus treinos." : "Escolha uma nova senha de acesso."}</p></div>
        <form class="card stack" id="pwForm" novalidate>
          <label class="field"><span>Nova senha (mín. 8 caracteres)</span><input type="password" name="pw" autocomplete="new-password" minlength="8" required></label>
          <label class="field"><span>Repita a senha</span><input type="password" name="pw2" autocomplete="new-password" required></label>
          ${invite ? `<label class="check"><input type="checkbox" name="lgpd" required><span>Li a <a class="link" href="../privacidade.html" target="_blank">política de privacidade</a> e autorizo o uso dos meus dados de saúde (medidas, fotos e anamnese) para a minha consultoria. Eles ficam visíveis só para mim e para o treinador.</span></label>` : ""}
          <p class="form-error" role="alert"></p>
          <button class="btn btn--red btn--lg btn--block" type="submit">${invite ? "Criar senha e entrar" : "Salvar senha"}</button>
        </form>
      </div>
    </main>`;
  const form = $("#pwForm", root);
  const err = $(".form-error", form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { pw, pw2 } = formData(form);
    if (!pw || pw.length < 8) { err.textContent = "Use pelo menos 8 caracteres."; return; }
    if (pw !== pw2) { err.textContent = "As senhas não são iguais."; return; }
    if (invite && !form.lgpd.checked) { err.textContent = "Para continuar, aceite a política de privacidade."; return; }
    const b = $('button[type="submit"]', form);
    b.disabled = true;
    try {
      await api.updatePassword(pw);
      if (invite) await api.acceptTerms().catch(() => {});
      api.authIntent = null;
      history.replaceState(null, "", location.pathname);
      toast("Senha salva!");
      onDone();
    } catch (ex) { err.textContent = ex.message; b.disabled = false; }
  });
}

/* ---------- Barra de demonstração ---------- */
export function demoBar(api) {
  if (api.mode !== "demo") return "";
  return `<div class="demo-bar">Modo demonstração · dados de exemplo <button type="button" id="demoReset">Restaurar dados</button></div>`;
}
export function bindDemoBar(api) {
  const b = $("#demoReset");
  if (b) b.addEventListener("click", async () => {
    if (await confirmDialog("Apagar as alterações e voltar aos dados de exemplo?")) { api.resetDemo(); location.reload(); }
  });
}
