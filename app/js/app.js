/* Site-app da Fonseca Team: entrada, rotas e layout. */
import { $, $$, esc, toast, CONFIG } from "./util.js";
import { store, MODE } from "./store.js";
import * as A from "./views-aluno.js";
import * as P from "./views-pro.js";

const view = $("#view");
const ctx = {
  me: null,
  email: null,
  render(html) {
    view.innerHTML = html;
    view.focus({ preventScroll: true });
  },
  go(hash, replace) {
    if (replace) { history.replaceState(null, "", hash); route(); }
    else if (location.hash === hash) route();
    else location.hash = hash;
  },
};

const ROUTES = [
  { re: /^\/consentimento$/, role: "aluno", fn: A.consentView },
  { re: /^\/inicio$/, role: "aluno", fn: A.homeView, tab: "inicio" },
  { re: /^\/perfil$/, role: "aluno", fn: A.profileView, tab: "conta" },
  { re: /^\/anamnese\/(\d+)$/, role: "aluno", fn: A.anamneseView, tab: "inicio" },
  { re: /^\/fotos$/, role: "aluno", fn: A.photosView, tab: "fotos" },
  { re: /^\/evolucao$/, role: "aluno", fn: A.evolutionView, tab: "evolucao" },
  { re: /^\/plano$/, role: "aluno", fn: A.planView, tab: "plano" },
  { re: /^\/conta$/, role: "aluno", fn: A.accountView, tab: "conta" },
  { re: /^\/pro$/, role: "profissional", fn: P.dashboardView, tab: "pro" },
  { re: /^\/pro\/convidar$/, role: "profissional", fn: P.inviteView, tab: "convidar" },
  { re: /^\/pro\/aluno\/([\w-]+)$/, role: "profissional", fn: P.studentView, tab: "pro" },
  { re: /^\/pro\/avaliacao\/([\w-]+)$/, role: "profissional", fn: P.evaluationView, tab: "pro" },
  { re: /^\/pro\/treino\/([\w-]+)$/, role: "profissional", fn: P.workoutView, tab: "pro" },
  { re: /^\/pro\/imprimir\/([\w-]+)$/, role: "profissional", fn: P.printView, tab: "pro" },
];

let consentOk = false;

async function route() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  const params = new URLSearchParams(qs || "");
  try {
    const session = await store.session();
    if (!session) return loginView();
    ctx.email = session.email || "";
    ctx.me = await store.getProfile(session.userId);
    if (!ctx.me) {
      ctx.render(`<section class="page narrow"><div class="card"><h1>Quase lá</h1><p>Seu acesso está sendo preparado. Atualize a página em alguns segundos.</p><button class="btn btn--ghost" onclick="location.reload()">Atualizar</button></div></section>`);
      return;
    }
    const role = ctx.me.role === "profissional" ? "profissional" : "aluno";
    document.body.dataset.role = role;
    $("#topNav").hidden = role !== "profissional";
    $("#tabBar").hidden = role !== "aluno";

    if (role === "aluno" && !consentOk) {
      consentOk = !!(await store.getConsent(ctx.me.id));
      if (!consentOk && path !== "/consentimento") return ctx.go("#/consentimento", true);
    }
    const r = ROUTES.find((x) => x.role === role && x.re.test(path));
    if (!r) return ctx.go(role === "profissional" ? "#/pro" : "#/inicio", true);
    $$("[data-tab]").forEach((a) => a.classList.toggle("is-active", a.dataset.tab === r.tab));
    await r.fn(ctx, params, path.match(r.re).slice(1));
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    ctx.render(`<section class="page narrow"><div class="card"><h1>Algo deu errado</h1><p>${esc(err.message || "Erro inesperado.")}</p><button class="btn btn--primary" onclick="location.reload()">Tentar de novo</button></div></section>`);
  }
}

/* ---------- Entrada ---------- */
function loginView() {
  document.body.dataset.role = "";
  $("#topNav").hidden = true;
  $("#tabBar").hidden = true;
  consentOk = false;
  if (MODE === "demo") {
    ctx.render(`
      <section class="page narrow login">
        <img class="login__logo" src="../assets/logo-fonseca.png" alt="Fonseca Team" width="315" height="240">
        <h1>Entrar no app</h1>
        <div class="banner banner--warn"><b>Modo demonstração.</b> Os dados ficam salvos só neste aparelho. Para usar com alunos de verdade, configure o Supabase no arquivo <code>js/config.js</code>.</div>
        <form class="card form" id="demoForm">
          <label class="field"><span>Seu nome</span><input name="nome" placeholder="Ex.: Ana Souza"></label>
          <button class="btn btn--primary btn--block" type="submit" name="role" value="aluno">Entrar como aluno</button>
          <button class="btn btn--outline btn--block" type="submit" name="role" value="profissional">Entrar como profissional</button>
        </form>
        <a class="back" href="../">← Voltar ao site</a>
      </section>`);
    $("#demoForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const role = (e.submitter && e.submitter.value) || "aluno";
      await store.signInDemo(role, e.target.nome.value.trim());
      ctx.go(role === "profissional" ? "#/pro" : "#/inicio", true);
    });
    return;
  }
  ctx.render(`
    <section class="page narrow login">
      <img class="login__logo" src="../assets/logo-fonseca.png" alt="Fonseca Team" width="315" height="240">
      <h1>Entrar no app</h1>
      <p class="lead">Digite seu e-mail. Enviamos um link e um código de acesso. Não precisa de senha.</p>
      <form class="card form" id="emailForm">
        <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="email" required placeholder="voce@email.com"></label>
        <button class="btn btn--primary btn--block" type="submit">Receber acesso</button>
      </form>
      <form class="card form" id="codeForm" hidden>
        <p>Enviamos para <b id="sentTo"></b>. Toque no link do e-mail ou digite o código:</p>
        <label class="field"><span>Código</span><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required></label>
        <button class="btn btn--primary btn--block" type="submit">Entrar</button>
        <button class="btn btn--ghost btn--block" type="button" id="otherEmail">Usar outro e-mail</button>
      </form>
      <a class="back" href="../">← Voltar ao site</a>
    </section>`);
  let email = "";
  $("#emailForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    email = e.target.email.value.trim();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      await store.signInEmail(email);
      $("#sentTo").textContent = email;
      $("#emailForm").hidden = true;
      $("#codeForm").hidden = false;
      $("#codeForm [name=code]").focus();
    } catch (err) { toast(err.message || "Não foi possível enviar. Tente de novo.", "error"); }
    btn.disabled = false;
  });
  $("#codeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await store.verifyCode(email, e.target.code.value.trim()); route(); }
    catch (err) { toast("Código inválido ou expirado.", "error"); }
  });
  $("#otherEmail").addEventListener("click", () => { $("#emailForm").hidden = false; $("#codeForm").hidden = true; });
}

/* ---------- Início ---------- */
(async function boot() {
  $("#demoFlag").hidden = MODE !== "demo";
  $("#logoutTop").addEventListener("click", async () => { await store.signOut(); ctx.go("#/entrar", true); });
  try { await store.init(); }
  catch (err) { ctx.render(`<section class="page narrow"><div class="card"><h1>Sem conexão</h1><p>${esc(err.message)}</p></div></section>`); return; }
  store.onAuthChange(() => route());
  window.addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("../sw.js").catch(() => {});
  }
})();
