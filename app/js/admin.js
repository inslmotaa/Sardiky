/* Painel do treinador (/admin): alunos, exercícios, treinos, nutrição e avaliações. */
import { loadApi, today } from "./api.js";
import {
  $, $$, esc, ICONS, fmtDate, addMonths, planStatus, chip, waLink, fmtNum, fmtRest, WEEKDAYS,
  toast, fail, formData, dialog, confirmDialog, exerciseThumb, renderAuth, demoBar, bindDemoBar, lineChart
} from "./ui.js";

const root = document.getElementById("app");
const SITE = window.SITE || {};
const PLAN_NAMES = (SITE.plans || []).map((p) => p.name).concat(["Personalizado"]);
const PLAN_MONTHS = { Mensal: 1, Trimestral: 3, Semestral: 6, Anual: 12 };
const GOALS = ["Hipertrofia", "Emagrecimento", "Performance", "Saúde e qualidade de vida", "Reabilitação"];
const GROUPS = ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Antebraço", "Quadríceps", "Posterior", "Glúteos", "Panturrilha", "Abdômen", "Cardio", "Mobilidade"];
const EQUIP = ["Barra", "Halter", "Máquina", "Polia", "Smith", "Peso corporal", "Elástico", "Kettlebell", "Banco", "Outro"];
const METHODS = ["", "Drop-set", "Bi-set", "Tri-set", "Rest-pause", "Pirâmide", "Cluster", "Isometria", "Excêntrica lenta", "FST-7"];

let api, session, exercises = [];

const opt = (list, cur) => list.map((v) => `<option value="${esc(v)}"${v === (cur ?? "") ? " selected" : ""}>${esc(v || "—")}</option>`).join("");

async function boot() {
  try { api = await loadApi(); }
  catch (e) { root.innerHTML = `<main class="auth"><div class="auth__box card"><p>Não foi possível conectar ao banco. Verifique a internet e a configuração em app/js/env.js.</p></div></main>`; return; }
  api.onAuth((ev) => { if (ev === "SIGNED_OUT") start(); });
  start();
}

async function start() {
  session = await api.session();
  if (!session || api.authIntent) {
    renderAuth(root, {
      api, title: "Painel do treinador", subtitle: "Acesso restrito ao Maicon.",
      demoRoles: [{ role: "admin", label: "Entrar como treinador" }], onDone: start
    });
    return;
  }
  if (session.role !== "admin") {
    root.innerHTML = `<main class="auth"><div class="auth__box card stack">
      <h1 class="h2">Acesso restrito</h1><p class="muted">Este painel é só do treinador. Seus treinos estão na área do aluno.</p>
      <a class="btn btn--red" href="../aluno/">Ir para a área do aluno</a>
      <button class="btn btn--ghost" id="out">Sair</button></div></main>`;
    $("#out").onclick = async () => { await api.signOut(); start(); };
    return;
  }
  root.innerHTML = `
    ${demoBar(api)}
    <header class="topbar">
      <a class="topbar__brand" href="#/alunos"><img src="../assets/logo-fonseca.png" alt="Fonseca Team" width="315" height="240"><span>Painel</span></a>
      <div class="row"><a class="btn btn--sm btn--ghost" href="../" target="_blank">Ver site</a><button class="icon-btn" id="logout" aria-label="Sair">${ICONS.logout}</button></div>
    </header>
    <div class="shell">
      <nav class="side" aria-label="Painel">
        <a href="#/alunos" data-nav="alunos">${ICONS.users}<span>Alunos</span></a>
        <a href="#/exercicios" data-nav="exercicios">${ICONS.dumbbell}<span>Exercícios</span></a>
      </nav>
      <main class="main" id="view" tabindex="-1"></main>
    </div>`;
  bindDemoBar(api);
  $("#logout").onclick = async () => { await api.signOut(); location.hash = ""; start(); };
  window.onhashchange = route;
  exercises = await api.listExercises().catch(() => []);
  route();
}

function route() {
  const [, page = "alunos", id, tab] = location.hash.split("/");
  $$("[data-nav]").forEach((a) => a.toggleAttribute("aria-current", false));
  const nav = page === "aluno" ? "alunos" : page;
  const cur = $(`[data-nav="${nav}"]`);
  if (cur) cur.setAttribute("aria-current", "page");
  const view = $("#view");
  view.innerHTML = '<div class="spinner" role="status" aria-label="Carregando"></div>';
  const run = page === "exercicios" ? viewExercises(view) : page === "aluno" && id ? viewStudent(view, id, tab || "treinos") : viewStudents(view);
  run.catch(fail);
  window.scrollTo(0, 0);
}

/* =====================================================================
   ALUNOS
   ===================================================================== */
async function viewStudents(view) {
  const students = await api.listStudents();
  const st = students.map((s) => ({ s, p: planStatus(s) }));
  const count = (f) => st.filter(f).length;
  view.innerHTML = `
    <div class="page-head"><div><p class="label">Painel</p><h1 class="h1">Alunos</h1></div>
      <button class="btn btn--red" id="newStudent">+ Novo aluno</button></div>
    <div class="kpis" style="margin-bottom:16px">
      <div class="kpi"><span class="label">Ativos</span><strong>${count((x) => x.s.status === "active")}</strong></div>
      <div class="kpi kpi--alert"><span class="label">Vencendo em 7 dias</span><strong>${count((x) => x.p.tone === "warn")}</strong></div>
      <div class="kpi"><span class="label">Vencidos</span><strong>${count((x) => x.p.tone === "late")}</strong></div>
    </div>
    <div class="toolbar">
      <input class="input" type="search" id="q" placeholder="Buscar por nome, e-mail ou WhatsApp" aria-label="Buscar aluno">
      <select class="input" id="f" aria-label="Filtrar por status">
        <option value="all">Todos</option><option value="active">Ativos</option><option value="warn">Vencendo em 7 dias</option>
        <option value="late">Vencidos</option><option value="inactive">Inativos</option>
      </select>
    </div>
    <div class="list" id="list"></div>`;
  const list = $("#list", view);
  const draw = () => {
    const q = $("#q", view).value.toLowerCase().trim();
    const f = $("#f", view).value;
    const rows = st.filter(({ s, p }) => {
      const hit = !q || [s.full_name, s.email, s.whatsapp].some((v) => String(v || "").toLowerCase().includes(q));
      const ok = f === "all" || (f === "active" && s.status === "active") || (f === "inactive" && s.status === "inactive") || p.tone === f;
      return hit && ok;
    });
    list.innerHTML = rows.length ? rows.map(({ s, p }) => `
      <a class="list-row" href="#/aluno/${s.id}">
        <div style="min-width:0">
          <p class="list-row__title">${esc(s.full_name)}</p>
          <p class="list-row__meta"><span>${esc(s.plan || "Sem plano")}</span><span>${esc(s.goal || "")}</span><span>Vence ${fmtDate(s.end_date)}</span>${s.user_id ? "" : "<span>Convite pendente</span>"}</p>
        </div>
        ${chip(p)}
      </a>`).join("") : `<div class="empty"><p>Nenhum aluno encontrado.</p></div>`;
  };
  $("#q", view).addEventListener("input", draw);
  $("#f", view).addEventListener("change", draw);
  $("#newStudent", view).onclick = () => studentForm();
  draw();
}

async function studentForm(s = null) {
  const isNew = !s;
  s = s || { status: "active", start_date: today(), plan: PLAN_NAMES[0] };
  const result = await dialog({
    title: isNew ? "Novo aluno" : "Editar aluno",
    wide: true,
    submit: isNew ? "Cadastrar e enviar convite" : "Salvar",
    danger: isNew ? null : { label: "Excluir aluno", confirm: `Excluir ${s.full_name} e todos os dados (treinos, dieta, avaliações)? Não dá para desfazer.`, onClick: () => api.deleteStudent(s.id) },
    body: `
      <div class="grid-2">
        <label class="field span-2"><span>Nome completo *</span><input name="full_name" value="${esc(s.full_name)}" required autocomplete="off"></label>
        <label class="field"><span>E-mail *</span><input type="email" name="email" value="${esc(s.email)}" required ${isNew ? "" : 'readonly title="O e-mail é o login do aluno"'}></label>
        <label class="field"><span>WhatsApp</span><input type="tel" name="whatsapp" value="${esc(s.whatsapp)}" placeholder="41999990000" inputmode="tel"></label>
        <label class="field"><span>Data de nascimento</span><input type="date" name="birth_date" value="${esc(s.birth_date)}"></label>
        <label class="field"><span>Objetivo</span><input name="goal" list="goals" value="${esc(s.goal)}"><datalist id="goals">${GOALS.map((g) => `<option value="${esc(g)}">`).join("")}</datalist></label>
      </div>
      <hr class="divider">
      <div class="grid-2">
        <label class="field"><span>Plano</span><select name="plan">${opt(PLAN_NAMES, s.plan)}</select></label>
        <label class="field"><span>Status</span><select name="status"><option value="active"${s.status === "active" ? " selected" : ""}>Ativo</option><option value="inactive"${s.status === "inactive" ? " selected" : ""}>Inativo</option></select></label>
        <label class="field"><span>Início</span><input type="date" name="start_date" value="${esc(s.start_date)}"></label>
        <label class="field"><span>Vencimento</span><input type="date" name="end_date" value="${esc(s.end_date)}"></label>
      </div>
      <label class="field"><span>Observações (lesões, rotina, preferências)</span><textarea name="notes">${esc(s.notes)}</textarea></label>
      ${isNew ? `<label class="check"><input type="checkbox" name="consent" required><span>O aluno autorizou o tratamento dos dados pessoais e de saúde para a consultoria, conforme a <a class="link" href="../privacidade.html" target="_blank">política de privacidade</a> (LGPD).</span></label>` : `<p class="label">Consentimento LGPD: ${s.consent_at ? fmtDate(s.consent_at.slice(0, 10)) : "não registrado"} · Termos aceitos pelo aluno: ${s.terms_accepted_at ? fmtDate(s.terms_accepted_at.slice(0, 10)) : "ainda não"}</p>`}`,
    onOpen(form) {
      // calcula o vencimento a partir do plano e do início
      const calc = () => {
        const m = PLAN_MONTHS[form.plan.value];
        if (m && form.start_date.value && (!form.end_date.value || form.end_date.dataset.auto)) {
          form.end_date.value = addMonths(form.start_date.value, m);
          form.end_date.dataset.auto = "1";
        }
      };
      form.plan.addEventListener("change", () => { form.end_date.dataset.auto = "1"; calc(); });
      form.start_date.addEventListener("change", () => { form.end_date.dataset.auto = "1"; calc(); });
      form.end_date.addEventListener("input", () => delete form.end_date.dataset.auto);
      if (isNew) calc();
    },
    async onSubmit(form) {
      const d = formData(form);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw new Error("E-mail inválido.");
      const row = { ...s, ...d };
      delete row.consent;
      if (isNew) row.consent_at = new Date().toISOString();
      const saved = await api.saveStudent(row);
      if (isNew) {
        try {
          const st = await api.inviteStudent(saved);
          toast(st === "demo" ? "Aluno cadastrado (na demonstração o convite não é enviado)." : `Convite enviado para ${saved.email}.`);
        } catch (e) {
          toast(`Aluno salvo, mas o convite falhou: ${e.message}`, "error");
        }
      } else toast("Dados salvos.");
      return saved;
    }
  });
  if (result === "deleted") { toast("Aluno excluído."); location.hash = "#/alunos"; return; }
  if (result && isNew) location.hash = `#/aluno/${result.id}`;
  else if (result) route();
}

async function viewStudent(view, id, tab) {
  const s = await api.getStudent(id);
  if (!s) { view.innerHTML = `<div class="empty"><p>Aluno não encontrado.</p><a class="btn" href="#/alunos">Voltar</a></div>`; return; }
  const p = planStatus(s);
  const tabs = [["treinos", "Treinos"], ["nutricao", "Nutrição"], ["avaliacoes", "Avaliações"], ["dados", "Dados"]];
  view.innerHTML = `
    <a class="label" href="#/alunos" style="text-decoration:none">← Alunos</a>
    <div class="page-head" style="margin-top:10px">
      <div class="stack" style="gap:8px"><h1 class="h1">${esc(s.full_name)}</h1>
        <div class="row">${chip(p)}<span class="chip">${esc(s.plan || "Sem plano")}</span><span class="label">Vence ${fmtDate(s.end_date)}</span></div></div>
      <div class="row">
        ${s.whatsapp ? `<a class="btn btn--sm" href="${waLink(s.whatsapp, `Olá ${s.full_name.split(" ")[0]}!`)}" target="_blank" rel="noopener">${ICONS.whatsapp} WhatsApp</a>` : ""}
        <button class="btn btn--sm" id="edit">Editar</button>
      </div>
    </div>
    <nav class="tabs" aria-label="Seções do aluno">${tabs.map(([k, l]) => `<a href="#/aluno/${id}/${k}"${k === tab ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
    <section id="tab"></section>`;
  $("#edit", view).onclick = () => studentForm(s);
  const box = $("#tab", view);
  if (tab === "treinos") return tabWorkouts(box, s);
  if (tab === "nutricao") return tabNutrition(box, s);
  if (tab === "avaliacoes") return tabAssessments(box, s);
  return tabData(box, s);
}

function tabData(box, s) {
  const rows = [
    ["E-mail", s.email], ["WhatsApp", s.whatsapp], ["Nascimento", fmtDate(s.birth_date)], ["Objetivo", s.goal],
    ["Plano", s.plan], ["Início", fmtDate(s.start_date)], ["Vencimento", fmtDate(s.end_date)], ["Status", s.status === "active" ? "Ativo" : "Inativo"],
    ["Acesso", s.user_id ? "Senha criada" : "Convite pendente"],
    ["Consentimento LGPD", s.consent_at ? fmtDate(s.consent_at.slice(0, 10)) : "Não registrado"],
    ["Termos aceitos pelo aluno", s.terms_accepted_at ? fmtDate(s.terms_accepted_at.slice(0, 10)) : "Ainda não"]
  ];
  box.innerHTML = `
    <div class="card stack">
      <div class="grid-2">${rows.map(([k, v]) => `<div><p class="label">${k}</p><p>${esc(v || "—")}</p></div>`).join("")}</div>
      <div><p class="label">Observações</p><p style="white-space:pre-wrap">${esc(s.notes || "—")}</p></div>
      <div class="row"><button class="btn btn--sm" id="invite">${s.user_id ? "Enviar link de nova senha" : "Reenviar convite"}</button></div>
    </div>`;
  $("#invite", box).onclick = async (e) => {
    e.target.disabled = true;
    try { const r = await api.inviteStudent(s); toast(r === "reset_sent" ? "Link de nova senha enviado." : r === "demo" ? "Na demonstração o e-mail não é enviado." : "Convite enviado."); }
    catch (ex) { fail(ex); }
    e.target.disabled = false;
  };
}

/* ---------- Treinos ---------- */
async function tabWorkouts(box, s) {
  const workouts = await api.listWorkouts(s.id);
  box.innerHTML = `
    <div class="row row--between" style="margin-bottom:14px">
      <p class="muted">${workouts.length} ${workouts.length === 1 ? "ficha" : "fichas"}</p>
      <div class="row">${workouts.length ? '<button class="btn btn--sm" id="dup">Duplicar para outro aluno</button>' : ""}<button class="btn btn--sm btn--red" id="newW">+ Nova ficha</button></div>
    </div>
    <div class="list">${workouts.length ? workouts.map((w) => `
      <button class="list-row" data-w="${w.id}">
        <div style="min-width:0"><p class="list-row__title">${esc(w.name)}${w.focus ? ` · <span class="muted">${esc(w.focus)}</span>` : ""}</p>
        <p class="list-row__meta"><span>${w.items.length} exercícios</span><span>${w.weekdays?.length ? w.weekdays.map((d) => WEEKDAYS[d]).join(", ") : "Sem dia fixo"}</span></p></div>
        <span class="label">Editar →</span>
      </button>`).join("") : `<div class="empty"><p>Nenhuma ficha ainda.</p><p style="font-size:14px">Monte o Treino A escolhendo exercícios da biblioteca.</p></div>`}</div>`;
  $("#newW", box).onclick = () => workoutEditor(s, { name: `Treino ${String.fromCharCode(65 + workouts.length)}`, weekdays: [], position: workouts.length }, []);
  $$("[data-w]", box).forEach((b) => (b.onclick = () => { const w = workouts.find((x) => x.id === b.dataset.w); workoutEditor(s, w, w.items); }));
  const dup = $("#dup", box);
  if (dup) dup.onclick = () => duplicateDialog(s, workouts);
}

function itemRow(it, i) {
  const groups = GROUPS.concat(["Outros"]);
  const byGroup = groups.map((g) => {
    const list = exercises.filter((e) => (e.muscle_group || "Outros") === g || (g === "Outros" && !GROUPS.includes(e.muscle_group)));
    return list.length ? `<optgroup label="${esc(g)}">${list.map((e) => `<option value="${e.id}"${e.id === it.exercise_id ? " selected" : ""}>${esc(e.name)}</option>`).join("")}</optgroup>` : "";
  }).join("");
  return `
    <div class="item-editor" data-item="${esc(it.id || "")}">
      <div class="item-editor__head">
        <span class="item-editor__num">${String(i + 1).padStart(2, "0")}</span>
        <label class="field"><span class="sr-only">Exercício</span><select name="exercise_id" required><option value="">Escolha o exercício</option>${byGroup}</select></label>
        <button type="button" class="icon-btn icon-btn--sm" data-act="up" aria-label="Subir">↑</button>
        <button type="button" class="icon-btn icon-btn--sm" data-act="down" aria-label="Descer">↓</button>
        <button type="button" class="icon-btn icon-btn--sm" data-act="del" aria-label="Remover exercício">✕</button>
      </div>
      <div class="grid-4">
        <label class="field"><span>Séries</span><input name="sets" value="${esc(it.sets)}" inputmode="numeric" placeholder="4"></label>
        <label class="field"><span>Repetições</span><input name="reps" value="${esc(it.reps)}" placeholder="8-12"></label>
        <label class="field"><span>Carga sugerida</span><input name="load" value="${esc(it.load)}" placeholder="20 kg"></label>
        <label class="field"><span>Descanso (s)</span><input name="rest_seconds" type="number" min="0" step="5" value="${esc(it.rest_seconds)}" placeholder="90"></label>
      </div>
      <div class="grid-2">
        <label class="field"><span>Método</span><input name="method" list="methods" value="${esc(it.method)}" placeholder="Normal"></label>
        <label class="field"><span>Observação</span><input name="notes" value="${esc(it.notes)}" placeholder="Ex.: cadência 3-0-1"></label>
      </div>
    </div>`;
}

async function workoutEditor(s, w, items) {
  if (!exercises.length) {
    if (await confirmDialog("A biblioteca de exercícios está vazia. Cadastrar exercícios agora?", { ok: "Ir para exercícios" })) location.hash = "#/exercicios";
    return;
  }
  let list = items.map((x) => ({ ...x }));
  const r = await dialog({
    title: w.id ? `Editar ${w.name}` : "Nova ficha",
    wide: true,
    submit: "Salvar ficha",
    danger: w.id ? { label: "Excluir ficha", confirm: `Excluir ${w.name}?`, onClick: () => api.deleteWorkout(w.id) } : null,
    body: `
      <div class="grid-2">
        <label class="field"><span>Nome *</span><input name="name" value="${esc(w.name)}" required></label>
        <label class="field"><span>Foco</span><input name="focus" value="${esc(w.focus)}" placeholder="Peito, ombros e tríceps"></label>
      </div>
      <div class="field"><span>Dias da semana (define o treino do dia)</span>
        <div class="days">${WEEKDAYS.map((d, i) => `<label><input type="checkbox" name="weekdays" value="${i}"${(w.weekdays || []).includes(i) ? " checked" : ""}><span>${d}</span></label>`).join("")}</div></div>
      <label class="field"><span>Observações gerais</span><textarea name="wnotes" placeholder="Aquecimento, cardio, cuidados...">${esc(w.notes)}</textarea></label>
      <datalist id="methods">${METHODS.filter(Boolean).map((m) => `<option value="${esc(m)}">`).join("")}</datalist>
      <div class="row row--between"><p class="label">Exercícios</p></div>
      <div class="stack" id="items"></div>
      <button type="button" class="btn btn--ghost" id="addItem">+ Adicionar exercício</button>`,
    onOpen(form) {
      const wrap = $("#items", form);
      const sync = () => {
        // guarda o que está digitado antes de redesenhar
        $$("[data-item]", wrap).forEach((row, i) => {
          const o = list[i];
          $$("input, select", row).forEach((el) => (o[el.name] = el.value));
        });
      };
      const draw = () => { wrap.innerHTML = list.map(itemRow).join("") || '<p class="muted" style="font-size:14px">Adicione o primeiro exercício.</p>'; };
      wrap.addEventListener("click", (e) => {
        const b = e.target.closest("[data-act]");
        if (!b) return;
        sync();
        const i = $$("[data-item]", wrap).indexOf(b.closest("[data-item]"));
        if (b.dataset.act === "del") list.splice(i, 1);
        if (b.dataset.act === "up" && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
        if (b.dataset.act === "down" && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
        draw();
      });
      $("#addItem", form).onclick = () => {
        sync();
        list.push({ sets: "3", reps: "10-12", rest_seconds: 60 });
        draw();
        const last = $$("[data-item]", wrap).pop();
        $("select", last).focus();
      };
      form._sync = sync;
      draw();
    },
    async onSubmit(form) {
      form._sync();
      if (!list.length) throw new Error("Adicione pelo menos um exercício.");
      if (list.some((x) => !x.exercise_id)) throw new Error("Escolha o exercício em todas as linhas.");
      const d = formData(form);
      const weekdays = [].concat(d.weekdays || []).map(Number);
      await api.saveWorkout(
        { ...w, student_id: s.id, name: d.name, focus: d.focus, notes: d.wnotes, weekdays },
        list.map((x) => ({ ...x, rest_seconds: x.rest_seconds === "" || x.rest_seconds == null ? null : Number(x.rest_seconds) }))
      );
    }
  });
  if (r) { toast(r === "deleted" ? "Ficha excluída." : "Ficha salva."); route(); }
}

async function duplicateDialog(s, workouts) {
  const others = (await api.listStudents()).filter((x) => x.id !== s.id);
  if (!others.length) { toast("Cadastre outro aluno para duplicar.", "error"); return; }
  const r = await dialog({
    title: "Duplicar fichas",
    submit: "Duplicar",
    body: `
      <label class="field"><span>Copiar para</span><select name="to" required><option value="">Escolha o aluno</option>${others.map((o) => `<option value="${o.id}">${esc(o.full_name)}</option>`).join("")}</select></label>
      <div class="field"><span>Fichas</span><div class="stack" style="gap:8px">${workouts.map((w) => `<label class="check"><input type="checkbox" name="ids" value="${w.id}" checked><span>${esc(w.name)}${w.focus ? " · " + esc(w.focus) : ""}</span></label>`).join("")}</div></div>
      <p class="muted" style="font-size:13px">As fichas são adicionadas às que o aluno já tem. Depois é só ajustar cargas e observações.</p>`,
    async onSubmit(form) {
      const d = formData(form);
      const ids = [].concat(d.ids || []);
      if (!ids.length) throw new Error("Escolha pelo menos uma ficha.");
      return { n: await api.duplicateWorkouts(s.id, d.to, ids), to: d.to };
    }
  });
  if (r) { toast(`${r.n} ${r.n === 1 ? "ficha duplicada" : "fichas duplicadas"}.`); location.hash = `#/aluno/${r.to}/treinos`; }
}

/* ---------- Nutrição ---------- */
async function tabNutrition(box, s) {
  const plan = await api.getNutrition(s.id);
  if (!plan) {
    box.innerHTML = `<div class="empty"><p>Sem plano alimentar.</p><p style="font-size:14px">Todo plano exibe o nome e o CRN do nutricionista responsável.</p><button class="btn btn--red" id="newN">+ Criar plano alimentar</button></div>`;
    $("#newN", box).onclick = () => nutritionEditor(s, { title: "Plano alimentar" }, []);
    return;
  }
  box.innerHTML = `
    <div class="stack">
      <div class="card stack">
        <div class="row row--between"><div><p class="label">Plano ativo</p><h2 class="h2">${esc(plan.title)}</h2></div><button class="btn btn--sm btn--red" id="editN">Editar plano</button></div>
        <div class="nutri"><span class="nutri__badge">CRN</span><div><p>${esc(plan.nutritionist_name)}</p><p class="label">${esc(plan.nutritionist_crn)}</p></div></div>
        ${plan.guidelines ? `<p class="muted" style="white-space:pre-wrap">${esc(plan.guidelines)}</p>` : ""}
      </div>
      ${plan.meals.map((m) => `
        <div class="card"><div class="meal"><span class="meal__time">${esc(m.time || "--:--")}</span><div>
          <p class="h3">${esc(m.name)}</p>
          <div class="meal__items">${(m.items || []).map((f) => `<div class="food"><div class="food__line"><span>${esc(f.food)}</span><span class="food__qty">${esc(f.quantity)}</span></div>${f.substitutions ? `<p class="food__sub"><b>Troca</b>${esc(f.substitutions)}</p>` : ""}</div>`).join("")}</div>
        </div></div></div>`).join("")}
    </div>`;
  $("#editN", box).onclick = () => nutritionEditor(s, plan, plan.meals);
}

function mealRow(m, i) {
  return `
    <div class="meal-editor" data-meal>
      <div class="row">
        <label class="field" style="width:120px"><span>Horário</span><input type="time" name="time" value="${esc(m.time)}"></label>
        <label class="field grow"><span>Refeição</span><input name="name" value="${esc(m.name)}" placeholder="Café da manhã" required></label>
        <button type="button" class="icon-btn icon-btn--sm" data-act="delMeal" aria-label="Remover refeição ${i + 1}" style="align-self:flex-end;margin-bottom:6px">✕</button>
      </div>
      <div class="stack" style="gap:8px" data-foods>
        ${(m.items || []).map((f) => `
          <div class="food-row" data-food>
            <label class="field"><span>Alimento</span><input name="food" value="${esc(f.food)}"></label>
            <label class="field"><span>Quantidade</span><input name="quantity" value="${esc(f.quantity)}"></label>
            <label class="field"><span>Substituições</span><input name="substitutions" value="${esc(f.substitutions)}"></label>
            <button type="button" class="icon-btn icon-btn--sm" data-act="delFood" aria-label="Remover alimento" style="margin-bottom:6px">✕</button>
          </div>`).join("")}
      </div>
      <button type="button" class="btn btn--sm btn--ghost" data-act="addFood">+ Alimento</button>
    </div>`;
}

async function nutritionEditor(s, plan, meals) {
  let list = meals.map((m) => ({ ...m, items: (m.items || []).map((f) => ({ ...f })) }));
  const r = await dialog({
    title: plan.id ? "Editar plano alimentar" : "Novo plano alimentar",
    wide: true,
    submit: "Salvar plano",
    body: `
      <label class="field"><span>Título</span><input name="title" value="${esc(plan.title)}"></label>
      <div class="grid-2">
        <label class="field"><span>Nutricionista responsável *</span><input name="nutritionist_name" value="${esc(plan.nutritionist_name)}" required></label>
        <label class="field"><span>CRN *</span><input name="nutritionist_crn" value="${esc(plan.nutritionist_crn)}" placeholder="CRN-8 00000" required></label>
      </div>
      <label class="field"><span>Orientações gerais</span><textarea name="guidelines" placeholder="Água, suplementação, horários...">${esc(plan.guidelines)}</textarea></label>
      <p class="label">Refeições</p>
      <div class="stack" id="meals"></div>
      <button type="button" class="btn btn--ghost" id="addMeal">+ Adicionar refeição</button>`,
    onOpen(form) {
      const wrap = $("#meals", form);
      const sync = () => {
        list = $$("[data-meal]", wrap).map((el) => ({
          time: $("[name=time]", el).value, name: $("[name=name]", el).value.trim(),
          items: $$("[data-food]", el).map((f) => ({ food: $("[name=food]", f).value.trim(), quantity: $("[name=quantity]", f).value.trim(), substitutions: $("[name=substitutions]", f).value.trim() }))
        }));
      };
      const draw = () => { wrap.innerHTML = list.map(mealRow).join("") || '<p class="muted" style="font-size:14px">Adicione a primeira refeição.</p>'; };
      wrap.addEventListener("click", (e) => {
        const b = e.target.closest("[data-act]");
        if (!b) return;
        sync();
        const mi = $$("[data-meal]", wrap).indexOf(b.closest("[data-meal]"));
        if (b.dataset.act === "delMeal") list.splice(mi, 1);
        if (b.dataset.act === "addFood") list[mi].items.push({ food: "", quantity: "", substitutions: "" });
        if (b.dataset.act === "delFood") list[mi].items.splice($$("[data-food]", b.closest("[data-meal]")).indexOf(b.closest("[data-food]")), 1);
        draw();
      });
      $("#addMeal", form).onclick = () => { sync(); list.push({ time: "", name: "", items: [{ food: "", quantity: "", substitutions: "" }] }); draw(); };
      form._sync = sync;
      draw();
    },
    async onSubmit(form) {
      form._sync();
      const d = formData(form);
      if (!d.nutritionist_name || !d.nutritionist_crn) throw new Error("Informe o nome e o CRN do nutricionista.");
      const meals = list.filter((m) => m.name).map((m) => ({ ...m, items: m.items.filter((f) => f.food) }));
      await api.saveNutrition({ ...plan, ...d, student_id: s.id }, meals);
    }
  });
  if (r) { toast("Plano alimentar salvo."); route(); }
}

/* ---------- Avaliações ---------- */
const MEASURES = [["weight", "Peso", "kg"], ["body_fat", "% gordura", "%"], ["chest", "Peito", "cm"], ["waist", "Cintura", "cm"], ["hip", "Quadril", "cm"], ["arm", "Braço", "cm"], ["thigh", "Coxa", "cm"], ["calf", "Panturrilha", "cm"]];

async function tabAssessments(box, s) {
  const list = await api.listAssessments(s.id);
  box.innerHTML = `
    <div class="row row--between" style="margin-bottom:14px"><p class="muted">${list.length} ${list.length === 1 ? "avaliação" : "avaliações"}</p><button class="btn btn--sm btn--red" id="newA">+ Nova avaliação</button></div>
    ${list.length ? `
      <div class="card" style="margin-bottom:14px"><p class="label" style="margin-bottom:8px">Peso (kg)</p><div id="chart"></div></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Data</th>${MEASURES.map(([, l, u]) => `<th>${l} (${u})</th>`).join("")}<th>Fotos</th><th></th></tr></thead>
        <tbody>${list.slice().reverse().map((a) => `<tr>
          <td>${fmtDate(a.date)}</td>${MEASURES.map(([k]) => `<td class="num">${fmtNum(a[k])}</td>`).join("")}
          <td><div class="thumbs">${(a.photoUrls || []).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Foto de ${fmtDate(a.date)}"></a>`).join("") || "—"}</div></td>
          <td><button class="btn btn--sm btn--danger" data-del="${a.id}">Excluir</button></td></tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty"><p>Nenhuma avaliação registrada.</p></div>`}`;
  if (list.length) lineChart($("#chart", box), list.map((a) => ({ date: a.date, value: a.weight })), { unit: "kg" });
  $("#newA", box).onclick = () => assessmentForm(s);
  $$("[data-del]", box).forEach((b) => (b.onclick = async () => {
    const a = list.find((x) => x.id === b.dataset.del);
    if (!(await confirmDialog(`Excluir a avaliação de ${fmtDate(a.date)} (e as fotos)?`))) return;
    try { await api.deleteAssessment(a); toast("Avaliação excluída."); route(); } catch (e) { fail(e); }
  }));
}

async function assessmentForm(s) {
  const r = await dialog({
    title: "Nova avaliação",
    wide: true,
    body: `
      <label class="field" style="max-width:220px"><span>Data *</span><input type="date" name="date" value="${today()}" required></label>
      <div class="grid-4">${MEASURES.map(([k, l, u]) => `<label class="field"><span>${l} (${u})</span><input name="${k}" type="number" step="0.1" min="0" inputmode="decimal"></label>`).join("")}</div>
      <label class="field"><span>Observações</span><textarea name="notes"></textarea></label>
      <label class="field"><span>Fotos de evolução (frente, lado, costas)</span><input type="file" name="photos" accept="image/*" multiple></label>
      <p class="muted" style="font-size:13px">As fotos ficam em armazenamento privado: só o aluno e você conseguem ver.</p>`,
    async onSubmit(form) {
      const d = formData(form);
      const row = { student_id: s.id, date: d.date, notes: d.notes, photos: [] };
      MEASURES.forEach(([k]) => (row[k] = d[k] === "" || d[k] == null ? null : Number(String(d[k]).replace(",", "."))));
      await api.saveAssessment(row, Array.from(form.photos.files || []));
    }
  });
  if (r) { toast("Avaliação salva."); route(); }
}

/* =====================================================================
   BIBLIOTECA DE EXERCÍCIOS
   ===================================================================== */
async function viewExercises(view) {
  exercises = await api.listExercises();
  view.innerHTML = `
    <div class="page-head"><div><p class="label">Biblioteca</p><h1 class="h1">Exercícios</h1></div><button class="btn btn--red" id="newEx">+ Novo exercício</button></div>
    <div class="toolbar">
      <input class="input" type="search" id="q" placeholder="Buscar exercício" aria-label="Buscar exercício">
      <select class="input" id="g" aria-label="Grupo muscular"><option value="">Todos os grupos</option>${GROUPS.map((g) => `<option>${g}</option>`).join("")}</select>
    </div>
    <div class="ex-grid" id="grid"></div>`;
  const draw = () => {
    const q = $("#q", view).value.toLowerCase().trim();
    const g = $("#g", view).value;
    const rows = exercises.filter((e) => (!q || e.name.toLowerCase().includes(q)) && (!g || e.muscle_group === g));
    $("#grid", view).innerHTML = rows.length ? rows.map((e) => `
      <button class="ex-card" data-ex="${e.id}">
        <div class="ex-card__media">${exerciseThumb(e) || "Sem vídeo"}</div>
        <div class="ex-card__body"><p class="h3">${esc(e.name)}</p><p class="row" style="gap:6px"><span class="chip">${esc(e.muscle_group || "—")}</span><span class="chip">${esc(e.equipment || "—")}</span></p></div>
      </button>`).join("") : `<div class="empty" style="grid-column:1/-1"><p>Nenhum exercício encontrado.</p></div>`;
    $$("[data-ex]", view).forEach((b) => (b.onclick = () => exerciseForm(exercises.find((x) => x.id === b.dataset.ex))));
  };
  $("#q", view).addEventListener("input", draw);
  $("#g", view).addEventListener("change", draw);
  $("#newEx", view).onclick = () => exerciseForm();
  draw();
}

async function exerciseForm(e = null) {
  const isNew = !e;
  e = e || {};
  const r = await dialog({
    title: isNew ? "Novo exercício" : "Editar exercício",
    danger: isNew ? null : { label: "Excluir", confirm: `Excluir "${e.name}" da biblioteca? Ele some das fichas que o usam.`, onClick: () => api.deleteExercise(e.id) },
    body: `
      <label class="field"><span>Nome *</span><input name="name" value="${esc(e.name)}" required></label>
      <div class="grid-2">
        <label class="field"><span>Grupo muscular</span><select name="muscle_group">${opt([""].concat(GROUPS), e.muscle_group || "")}</select></label>
        <label class="field"><span>Equipamento</span><select name="equipment">${opt([""].concat(EQUIP), e.equipment || "")}</select></label>
      </div>
      <label class="field"><span>Link do vídeo (YouTube ou Vimeo)</span><input name="video_url" type="url" value="${esc(e.video_url)}" placeholder="https://youtube.com/shorts/..."></label>
      <label class="field"><span>Ou envie um GIF/vídeo curto</span><input type="file" name="media" accept="image/gif,image/*,video/mp4,video/webm"></label>
      ${e.media_url ? `<label class="check"><input type="checkbox" name="remove_media"><span>Remover o arquivo atual</span></label>` : ""}
      <label class="field"><span>Dicas de execução</span><textarea name="tips" placeholder="Postura, amplitude, respiração...">${esc(e.tips)}</textarea></label>`,
    async onSubmit(form) {
      const d = formData(form);
      if (d.video_url && window.Media.parse(d.video_url).kind === "image") throw new Error("Cole um link do YouTube ou do Vimeo.");
      let media_url = d.remove_media ? null : e.media_url || null;
      const file = form.media.files[0];
      if (file) {
        if (file.size > 20e6) throw new Error("Arquivo muito grande (máx. 20 MB). Prefira um link do YouTube.");
        media_url = await api.uploadExerciseMedia(file);
      }
      await api.saveExercise({ ...e, name: d.name, muscle_group: d.muscle_group, equipment: d.equipment, video_url: d.video_url, tips: d.tips, media_url });
    }
  });
  if (r) { toast(r === "deleted" ? "Exercício excluído." : "Exercício salvo."); route(); }
}

boot();
