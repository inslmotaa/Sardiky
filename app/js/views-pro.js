/* Telas da área do profissional. */
import { $, $$, esc, toast, confirmDialog, fmtDate, fmtNum, waLink, CONFIG, POSES, poseLabel, STATUS, ageFrom, nowISO } from "./util.js";
import { store, MODE } from "./store.js";
import { summarize } from "./anamnese.js";
import { renderReview, bindReview, collectReview } from "./review.js";

const OBJ = { emagrecimento: "Emagrecimento", hipertrofia: "Hipertrofia", definicao: "Definição", performance: "Performance" };

/* Situação de cada aluno, para filtros e avisos */
async function studentState(p) {
  const [anam, avals, treino] = await Promise.all([store.getAnamnese(p.id), store.listAvaliacoes(p.id), store.getTreino(p.id)]);
  const last = avals[0];
  const fotos = last ? await store.listFotos(last.id) : [];
  let sit = "em_dia", label = "Em dia";
  if (!anam || !anam.concluida) { sit = "sem_anamnese"; label = "Anamnese pendente"; }
  else if (!last || fotos.length < 4) { sit = "sem_fotos"; label = "Aguardando fotos"; }
  else if (last.status === "pendente") { sit = "fotos_novas"; label = "Fotos novas"; }
  else if (last.status === "rascunho" || last.status === "erro") { sit = "revisar"; label = last.status === "erro" ? "Erro na análise" : "Avaliação para revisar"; }
  else if (!treino || !treino.liberado) { sit = "sem_treino"; label = "Liberar treino"; }
  return { p, anam, avals, last, fotos, treino, sit, label, objetivo: anam && anam.respostas && anam.respostas.objetivo };
}

/* ---------- Painel ---------- */
export async function dashboardView(ctx, params) {
  const students = await store.listStudents();
  const states = await Promise.all(students.map(studentState));
  const avisos = states.filter((s) => ["fotos_novas", "revisar", "sem_treino"].includes(s.sit) || (s.anam && s.anam.concluida && s.sit === "sem_fotos"));
  const q = (params.get("q") || "").toLowerCase();
  const fo = params.get("objetivo") || "", fp = params.get("plano") || "", fs = params.get("sit") || "";
  const list = states.filter((s) =>
    (!q || (s.p.nome || "").toLowerCase().includes(q)) && (!fo || s.objetivo === fo) && (!fp || s.p.plano === fp) && (!fs || s.sit === fs));
  const opt = (v, cur, l) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
  ctx.render(`
    <section class="page">
      <div class="page__head"><div><span class="pill">Painel</span><h1>Seus alunos</h1></div><a class="btn btn--primary" href="#/pro/convidar">+ Convidar aluno</a></div>
      ${avisos.length ? `<div class="card notices"><h3>Avisos</h3><ul>${avisos.map((s) => `<li><a href="#/pro/aluno/${esc(s.p.id)}"><b>${esc(s.p.nome || "Aluno")}</b> · ${esc(s.sit === "sem_fotos" ? "Anamnese respondida" : s.label)}</a></li>`).join("")}</ul></div>` : ""}
      <form class="filters" id="filters">
        <input type="search" name="q" placeholder="Buscar por nome" value="${esc(q)}" aria-label="Buscar por nome">
        <select name="objetivo" aria-label="Objetivo">${opt("", fo, "Todos os objetivos")}${Object.entries(OBJ).map(([k, v]) => opt(k, fo, v)).join("")}</select>
        <select name="plano" aria-label="Plano">${opt("", fp, "Todos os planos")}${(CONFIG.plans || []).map((p) => opt(p.name, fp, p.name)).join("")}</select>
        <select name="sit" aria-label="Situação">${opt("", fs, "Todas as situações")}${[["sem_anamnese", "Anamnese pendente"], ["sem_fotos", "Aguardando fotos"], ["fotos_novas", "Fotos novas"], ["revisar", "Avaliação para revisar"], ["sem_treino", "Liberar treino"], ["em_dia", "Em dia"]].map(([k, v]) => opt(k, fs, v)).join("")}</select>
      </form>
      <ul class="students">
        ${list.length ? list.map((s) => `
          <li><a class="student" href="#/pro/aluno/${esc(s.p.id)}">
            <span class="avatar">${esc((s.p.nome || "?").trim()[0] || "?")}</span>
            <span class="student__main"><b>${esc(s.p.nome || "Aluno sem nome")}</b><small>${esc(OBJ[s.objetivo] || "Objetivo não informado")} · ${esc(s.p.plano || "Plano não definido")}</small></span>
            <span class="badge ${["fotos_novas", "revisar", "sem_treino"].includes(s.sit) ? "badge--red" : s.sit === "em_dia" ? "badge--ok" : ""}">${esc(s.label)}</span>
          </a></li>`).join("") : `<li class="card empty">${students.length ? "Nenhum aluno com esses filtros." : MODE === "demo" ? "Nenhum aluno ainda. No modo demonstração, saia e entre como aluno para criar um aluno de teste." : "Nenhum aluno ainda. Convide o primeiro pelo botão acima."}</li>`}
      </ul>
    </section>`);
  const f = $("#filters");
  const apply = () => { const p = new URLSearchParams(new FormData(f)); [...p.keys()].forEach((k) => !p.get(k) && p.delete(k)); ctx.go("#/pro" + (p.toString() ? "?" + p : ""), true); };
  f.addEventListener("change", apply);
  let t; f.q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(apply, 400); });
  f.addEventListener("submit", (e) => { e.preventDefault(); apply(); });
}

/* ---------- Convidar ---------- */
export async function inviteView(ctx) {
  const appUrl = location.origin + location.pathname;
  ctx.render(`
    <section class="page narrow">
      <span class="pill">Convidar</span>
      <h1>Convidar aluno</h1>
      <form class="card form" id="inviteForm">
        <label class="field"><span>Nome do aluno</span><input name="nome" required></label>
        <label class="field"><span>WhatsApp do aluno</span><input name="fone" type="tel" placeholder="(41) 99999-9999" required></label>
        <label class="field"><span>Mensagem</span><textarea name="msg" rows="6"></textarea></label>
        <button class="btn btn--primary btn--block" type="submit">Enviar pelo WhatsApp</button>
      </form>
      <p class="muted small">O aluno entra com o próprio e-mail no link e aparece no seu painel assim que fizer o primeiro acesso.</p>
    </section>`);
  const f = $("#inviteForm");
  const fill = () => {
    const nome = f.nome.value.trim().split(/\s+/)[0] || "";
    f.msg.value = `Olá${nome ? ", " + nome : ""}! Aqui é o ${CONFIG.coachName} da Fonseca Team.\n\nPara começarmos sua consultoria, acesse o app, entre com seu e-mail e responda a anamnese:\n${appUrl}\n\nDepois, tire as 4 fotos de avaliação pelo próprio app. Qualquer dúvida, me chama aqui.`;
  };
  fill();
  f.nome.addEventListener("input", fill);
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    let fone = f.fone.value.replace(/\D/g, "");
    if (fone.length <= 11) fone = "55" + fone;
    window.open(waLink(f.msg.value, fone), "_blank", "noopener");
  });
}

/* ---------- Ficha do aluno ---------- */
export async function studentView(ctx, params, [id]) {
  const s = await studentState(await store.getProfile(id));
  const p = s.p;
  const tab = params.get("aba") || "resumo";
  const avalId = params.get("av") || (s.last && s.last.id);
  const aval = s.avals.find((a) => a.id === avalId) || s.last;
  const fotos = aval ? await store.listFotos(aval.id) : [];
  const urls = {};
  for (const f of fotos) urls[f.pose] = await store.fotoURL(f);
  const tabs = [["resumo", "Resumo"], ["anamnese", "Anamnese"], ["fotos", "Fotos"], ["avaliacoes", "Avaliações"]];
  const anamSum = summarize(s.anam && s.anam.respostas);

  ctx.render(`
    <section class="page">
      <a class="back" href="#/pro">← Alunos</a>
      <div class="page__head">
        <div><span class="pill">Ficha do aluno</span><h1>${esc(p.nome || "Aluno")}</h1>
        <p class="muted">${[ageFrom(p.nascimento) ? ageFrom(p.nascimento) + " anos" : null, p.altura ? p.altura + " cm" : null, p.peso ? fmtNum(p.peso, 1) + " kg" : null, OBJ[s.objetivo]].filter(Boolean).map(esc).join(" · ")}</p></div>
        <span class="badge ${s.sit === "em_dia" ? "badge--ok" : "badge--red"}">${esc(s.label)}</span>
      </div>
      <nav class="tabs" aria-label="Seções da ficha">${tabs.map(([k, l]) => `<a href="#/pro/aluno/${esc(id)}?aba=${k}" class="${tab === k ? "is-active" : ""}">${l}</a>`).join("")}</nav>

      ${tab === "resumo" ? `
        <div class="grid-2">
          <div class="card">
            <h3>Dados</h3>
            <dl class="dl"><dt>WhatsApp</dt><dd>${p.whatsapp ? `<a target="_blank" rel="noopener" href="${waLink("Olá, " + (p.nome || "").split(" ")[0] + "!", (p.whatsapp.replace(/\D/g, "").length <= 11 ? "55" : "") + p.whatsapp.replace(/\D/g, ""))}">${esc(p.whatsapp)}</a>` : "–"}</dd>
            <dt>Nascimento</dt><dd>${esc(fmtDate(p.nascimento))}</dd><dt>Sexo</dt><dd>${p.sexo === "f" ? "Feminino" : p.sexo === "m" ? "Masculino" : "–"}</dd></dl>
            <label class="field"><span>Plano contratado</span><select id="planoSel"><option value="">Não definido</option>${(CONFIG.plans || []).map((x) => `<option ${p.plano === x.name ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
          </div>
          <div class="card">
            <h3>Próximos passos</h3>
            <ul class="list">
              <li>${s.anam && s.anam.concluida ? "✓ Anamnese respondida" : "Anamnese pendente"}</li>
              <li>${s.fotos.length >= 4 ? "✓ Fotos da última avaliação" : "Aguardando as 4 fotos"}</li>
              <li>${s.last && s.last.status === "aprovada" ? "✓ Avaliação liberada" : s.last ? STATUS[s.last.status].label : "Sem avaliação"}</li>
              <li>${s.treino && s.treino.liberado ? "✓ Treino liberado" : "Treino não liberado"}</li>
            </ul>
            <div class="btn-row">
              ${s.last ? `<a class="btn btn--primary btn--sm" href="#/pro/avaliacao/${esc(s.last.id)}">Abrir avaliação</a>` : ""}
              <a class="btn btn--outline btn--sm" href="#/pro/treino/${esc(id)}">Montar treino</a>
              <a class="btn btn--ghost btn--sm" href="#/pro/imprimir/${esc(id)}">Exportar PDF</a>
            </div>
          </div>
        </div>` : ""}

      ${tab === "anamnese" ? (anamSum.length ? `
        <div class="card anam-sum">${s.anam.concluida ? "" : `<p class="banner">Anamnese ainda não concluída pelo aluno.</p>`}
          ${anamSum.map((sec) => `<h3>${esc(sec.title)}</h3><dl class="dl">${sec.items.map((it) => `<dt>${esc(it.label)}</dt><dd class="${it.alert ? "is-alert" : ""}">${esc(it.value)}</dd>`).join("")}</dl>`).join("")}
          <p class="small muted">Atualizada em ${esc(fmtDate(s.anam.atualizado_em))}</p>
        </div>` : `<div class="card empty">O aluno ainda não respondeu a anamnese.</div>`) : ""}

      ${tab === "fotos" ? (aval ? `
        <div class="toolbar">
          <label class="field field--inline"><span>Avaliação</span><select id="avSel">${s.avals.map((a) => `<option value="${esc(a.id)}" ${a.id === aval.id ? "selected" : ""}>${esc(fmtDate(a.criada_em))}</option>`).join("")}</select></label>
          <label class="check"><input type="checkbox" id="gridToggle" checked><span>Linhas de grade</span></label>
        </div>
        <div class="photo-grid is-grid" id="photoGrid">
          ${POSES.map((po) => `<figure>${urls[po.id] ? `<button type="button" class="zoomable" data-src="${esc(urls[po.id])}" aria-label="Ampliar ${esc(po.label)}"><img src="${esc(urls[po.id])}" alt="${esc(po.label)}"></button>` : `<div class="photo-missing">Sem foto</div>`}<figcaption>${esc(po.label)}</figcaption></figure>`).join("")}
        </div>` : `<div class="card empty">Ainda não há fotos.</div>`) : ""}

      ${tab === "avaliacoes" ? `
        <ul class="timeline">${s.avals.length ? s.avals.map((a) => `<li class="timeline__item"><div><b>${esc(fmtDate(a.criada_em))}</b><span class="badge badge--${STATUS[a.status].tone}">${esc(STATUS[a.status].label)}</span>${a.medidas && a.medidas.peso ? `<span class="muted small">${fmtNum(a.medidas.peso, 1)} kg</span>` : ""}</div><a class="btn btn--sm btn--outline" href="#/pro/avaliacao/${esc(a.id)}">Abrir</a></li>`).join("") : "<li class='card empty'>Nenhuma avaliação.</li>"}</ul>` : ""}
    </section>`);

  const planoSel = $("#planoSel");
  if (planoSel) planoSel.addEventListener("change", async () => { await store.saveProfile(id, { plano: planoSel.value || null }); toast("Plano atualizado."); });
  const avSel = $("#avSel");
  if (avSel) avSel.addEventListener("change", () => ctx.go(`#/pro/aluno/${id}?aba=fotos&av=${avSel.value}`, true));
  const gt = $("#gridToggle");
  if (gt) gt.addEventListener("change", () => $("#photoGrid").classList.toggle("is-grid", gt.checked));
  $$(".zoomable").forEach((b) => b.addEventListener("click", () => zoom(b.dataset.src)));
}

function zoom(src) {
  const el = document.createElement("div");
  el.className = "lightbox is-grid";
  el.innerHTML = `<button type="button" class="icon-btn lightbox__close" aria-label="Fechar">✕</button><div class="lightbox__img"><img src="${esc(src)}" alt=""></div><label class="check lightbox__grid"><input type="checkbox" checked><span>Grade</span></label>`;
  document.body.appendChild(el);
  document.body.classList.add("no-scroll");
  const close = () => { el.remove(); document.body.classList.remove("no-scroll"); };
  el.querySelector(".lightbox__close").addEventListener("click", close);
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  el.querySelector("input").addEventListener("change", (e) => el.classList.toggle("is-grid", e.target.checked));
  el.querySelector(".lightbox__img").addEventListener("click", (e) => e.currentTarget.classList.toggle("is-zoomed"));
  document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
  el.querySelector(".lightbox__close").focus();
}

/* ---------- Avaliação: gerar com IA, revisar e aprovar ---------- */
export async function evaluationView(ctx, params, [id]) {
  let a = await store.getAvaliacao(id);
  const p = await store.getProfile(a.aluno_id);
  const [fotos, anam] = await Promise.all([store.listFotos(id), store.getAnamnese(a.aluno_id)]);
  const ready = fotos.length >= 4 && anam && anam.concluida;
  const editing = params.get("editar") === "1";
  const thumbs = await Promise.all(POSES.map(async (po) => { const f = fotos.find((x) => x.pose === po.id); return f ? { po, url: await store.fotoURL(f) } : { po }; }));

  const head = `
    <a class="back" href="#/pro/aluno/${esc(a.aluno_id)}?aba=avaliacoes">← ${esc(p.nome || "Aluno")}</a>
    <div class="page__head"><div><span class="pill">Avaliação · ${esc(fmtDate(a.criada_em))}</span><h1>${esc(p.nome || "Aluno")}</h1></div><span class="badge badge--${STATUS[a.status].tone}">${esc(STATUS[a.status].label)}</span></div>
    <div class="thumb-row">${thumbs.map((t) => t.url ? `<figure><img src="${esc(t.url)}" alt="${esc(t.po.label)}"><figcaption>${esc(t.po.label)}</figcaption></figure>` : `<figure><div class="photo-missing">Sem foto</div><figcaption>${esc(t.po.label)}</figcaption></figure>`).join("")}</div>`;

  if (a.status === "pendente" || a.status === "erro" || a.status === "processando") {
    ctx.render(`
      <section class="page">${head}
        <div class="card center-card">
          ${a.status === "processando" ? `<div class="spinner" aria-hidden="true"></div><h3>Analisando fotos e anamnese…</h3><p class="muted">Leva em torno de 1 minuto. Você pode sair desta tela; o aviso aparece no painel.</p>` : `
          <h3>Gerar avaliação com IA</h3>
          <p class="muted">A IA prepara um rascunho com desvios posturais, corretivos, composição estimada, sugestão de treino e alimentação. Você revisa tudo antes de liberar.</p>
          ${a.status === "erro" ? `<p class="banner banner--warn">A análise anterior não terminou (${esc(a.erro || "erro")}). Tente de novo.</p>` : ""}
          ${!ready ? `<p class="banner">Para gerar, o aluno precisa ter as 4 fotos e a anamnese concluída.</p>` : ""}
          <button class="btn btn--primary btn--lg" id="genBtn" ${ready ? "" : "disabled"}>Gerar avaliação com IA</button>
          ${MODE === "demo" ? `<p class="small muted">Modo demonstração: gera um rascunho de exemplo, sem analisar as fotos.</p>` : ""}`}
        </div>
      </section>`);
    const gen = $("#genBtn");
    if (gen) gen.addEventListener("click", async () => {
      gen.disabled = true;
      gen.textContent = "Analisando fotos e anamnese…";
      $(".center-card").insertAdjacentHTML("afterbegin", `<div class="spinner" aria-hidden="true"></div>`);
      try {
        a = await store.requestAI(id);
        toast(a.status === "erro" ? "A análise falhou. Tente novamente." : "Rascunho pronto para revisar.", a.status === "erro" ? "error" : "");
      } catch (err) { toast(err.message, "error"); }
      ctx.go("#/pro/avaliacao/" + id, true);
    });
    if (a.status === "processando") setTimeout(() => location.hash === "#/pro/avaliacao/" + id && ctx.go("#/pro/avaliacao/" + id, true), 5000);
    return;
  }

  if (a.status === "aprovada" && !editing) {
    ctx.render(`
      <section class="page">${head}
        <div class="card"><p>Liberada em ${esc(fmtDate(a.aprovada_em))}. O aluno já vê esta avaliação na tela <b>Meu plano</b>.</p>
          <div class="btn-row"><a class="btn btn--outline btn--sm" href="#/pro/avaliacao/${esc(id)}?editar=1">Editar e liberar de novo</a><a class="btn btn--ghost btn--sm" href="#/pro/imprimir/${esc(a.aluno_id)}">Exportar PDF</a></div>
        </div>
        <form class="review" id="review">${renderReview({ ...(a.resultado_ia || {}), ...a.resultado_final })}</form>
      </section>`);
    $$("#review input, #review select, #review textarea, #review button").forEach((el) => (el.disabled = true));
    return;
  }

  // Rascunho para revisão
  const fone = String(p.whatsapp || "").replace(/\D/g, "");
  const askPhoto = fone ? (bad) => waLink(`Olá, ${(p.nome || "").split(" ")[0]}! Preciso que você tire de novo ${bad.length > 1 ? "as fotos" : "a foto"} ${bad.map((q) => poseLabel(q.pose) + " (" + q.motivo + ")").join(", ")} pelo app. Obrigado!`, (fone.length <= 11 ? "55" : "") + fone) : null;
  const draft = a.status === "aprovada" ? { ...(a.resultado_ia || {}), ...a.resultado_final } : a.resultado_ia;
  ctx.render(`
    <section class="page">${head}
      <p class="lead">Revise cada item. Desmarque o que não concorda, edite o texto e só então libere para o aluno.</p>
      <form class="review" id="review">${renderReview(draft, { askPhoto })}</form>
      <div class="sticky-actions">
        <button class="btn btn--ghost" id="saveDraft" type="button">Salvar rascunho</button>
        <button class="btn btn--primary" id="approve" type="button">Aprovar e liberar para o aluno</button>
      </div>
    </section>`);
  const root = $("#review");
  bindReview(root, async () => {
    const t = await store.getTreino(a.aluno_id);
    if (t && t.conteudo && (t.conteudo.dias || []).length) {
      const ok = await confirmDialog({ title: "Substituir o treino atual?", text: "O aluno já tem um treino salvo. Deseja substituí-lo pela sugestão da IA no editor?", ok: "Substituir" });
      if (!ok) { ctx.go("#/pro/treino/" + a.aluno_id); return; }
    }
    await store.saveTreino(a.aluno_id, draft.treino || {}, false);
    ctx.go("#/pro/treino/" + a.aluno_id);
  });
  $("#saveDraft").addEventListener("click", async () => {
    await store.updateAvaliacao(id, { resultado_ia: { ...draft, ...collectReview(root, draft) } });
    toast("Rascunho salvo.");
  });
  $("#approve").addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Liberar para o aluno?", text: "O aluno vai ver os itens marcados como incluídos na tela Meu plano.", ok: "Liberar" });
    if (!ok) return;
    await store.updateAvaliacao(id, { status: "aprovada", resultado_final: collectReview(root, draft), aprovada_por: ctx.me.id, aprovada_em: nowISO() });
    toast("Avaliação liberada para o aluno.");
    ctx.go("#/pro/avaliacao/" + id, true);
  });
}

/* ---------- Editor de treino ---------- */
const LIB = ["Agachamento livre", "Agachamento búlgaro", "Leg press 45°", "Cadeira extensora", "Mesa flexora", "Cadeira flexora", "Stiff", "Levantamento terra", "Elevação pélvica", "Afundo", "Cadeira abdutora", "Panturrilha em pé", "Panturrilha sentado", "Supino reto com barra", "Supino inclinado com halteres", "Crucifixo", "Crossover", "Flexão de braço", "Puxada frontal", "Remada curvada", "Remada baixa", "Remada unilateral", "Pulldown", "Barra fixa", "Desenvolvimento com halteres", "Elevação lateral", "Elevação frontal", "Face pull", "Crucifixo invertido", "Rosca direta", "Rosca alternada", "Rosca martelo", "Tríceps na polia", "Tríceps francês", "Tríceps testa", "Mergulho", "Prancha", "Abdominal supra", "Abdominal infra", "Pallof press", "Mobilidade torácica", "Alongamento de peitoral", "Retração cervical (chin tuck)"];

export async function workoutView(ctx, params, [alunoId]) {
  const p = await store.getProfile(alunoId);
  const saved = await store.getTreino(alunoId);
  let t = (saved && saved.conteudo) || { divisao: "", observacoes: "", dias: [] };
  if (!t.dias || !t.dias.length) t.dias = [{ nome: "Treino A", exercicios: [{ nome: "", series: 3, repeticoes: "10-12", descanso: "60s", observacao: "" }] }];

  const exRow = (x) => `<tr data-ex>
      <td><input name="nome" list="exLib" value="${esc(x.nome)}" aria-label="Exercício" placeholder="Exercício"></td>
      <td><input name="series" value="${esc(x.series)}" aria-label="Séries" inputmode="numeric"></td>
      <td><input name="repeticoes" value="${esc(x.repeticoes)}" aria-label="Repetições"></td>
      <td><input name="descanso" value="${esc(x.descanso)}" aria-label="Descanso"></td>
      <td><input name="observacao" value="${esc(x.observacao || "")}" aria-label="Observação" placeholder="Obs."></td>
      <td><button type="button" class="icon-btn" data-del-ex aria-label="Remover exercício">✕</button></td></tr>`;
  const dayBlock = (d) => `<div class="day-edit card" data-day>
      <div class="day-edit__head"><input name="dia" value="${esc(d.nome)}" aria-label="Nome do dia"><button type="button" class="btn btn--ghost btn--sm" data-del-day>Remover dia</button></div>
      <div class="table-scroll"><table class="ex-edit"><thead><tr><th>Exercício</th><th>Séries</th><th>Reps</th><th>Descanso</th><th>Obs.</th><th></th></tr></thead><tbody>${(d.exercicios || []).map(exRow).join("")}</tbody></table></div>
      <button type="button" class="btn btn--ghost btn--sm" data-add-ex>+ Exercício</button></div>`;

  ctx.render(`
    <section class="page">
      <a class="back" href="#/pro/aluno/${esc(alunoId)}">← ${esc(p.nome || "Aluno")}</a>
      <div class="page__head"><div><span class="pill">Treino</span><h1>Treino de ${esc((p.nome || "").split(" ")[0])}</h1></div>
        <span class="badge ${saved && saved.liberado ? "badge--ok" : ""}">${saved && saved.liberado ? "Liberado" : "Não liberado"}</span></div>
      <form id="wForm">
        <div class="card"><div class="field-row">
          <label class="field"><span>Divisão</span><input name="divisao" value="${esc(t.divisao || "")}" placeholder="Ex.: ABC"></label>
          <label class="field"><span>Observações gerais</span><input name="observacoes" value="${esc(t.observacoes || "")}"></label>
        </div></div>
        <div id="days">${t.dias.map(dayBlock).join("")}</div>
        <button type="button" class="btn btn--outline" id="addDay">+ Adicionar dia</button>
        <datalist id="exLib">${LIB.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      </form>
      <div class="sticky-actions">
        <button class="btn btn--ghost" id="saveW" type="button">Salvar</button>
        <button class="btn btn--primary" id="releaseW" type="button">Salvar e liberar para o aluno</button>
      </div>
    </section>`);

  const form = $("#wForm");
  form.addEventListener("click", (e) => {
    if (e.target.closest("[data-add-ex]")) e.target.closest("[data-day]").querySelector("tbody").insertAdjacentHTML("beforeend", exRow({ nome: "", series: 3, repeticoes: "10-12", descanso: "60s" }));
    if (e.target.closest("[data-del-ex]")) e.target.closest("[data-ex]").remove();
    if (e.target.closest("[data-del-day]")) e.target.closest("[data-day]").remove();
  });
  $("#addDay").addEventListener("click", () => {
    const n = $$("[data-day]").length;
    $("#days").insertAdjacentHTML("beforeend", dayBlock({ nome: "Treino " + String.fromCharCode(65 + n), exercicios: [{ nome: "", series: 3, repeticoes: "10-12", descanso: "60s" }] }));
  });
  const collect = () => ({
    divisao: form.divisao.value.trim(),
    observacoes: form.observacoes.value.trim(),
    dias: $$("[data-day]").map((d) => ({
      nome: d.querySelector("[name=dia]").value.trim(),
      exercicios: $$("[data-ex]", d).map((r) => Object.fromEntries($$("input", r).map((i) => [i.name, i.value.trim()]))).filter((x) => x.nome),
    })),
  });
  $("#saveW").addEventListener("click", async () => { await store.saveTreino(alunoId, collect(), saved && saved.liberado); toast("Treino salvo."); });
  $("#releaseW").addEventListener("click", async () => {
    await store.saveTreino(alunoId, collect(), true);
    toast("Treino liberado para o aluno.");
    ctx.go("#/pro/treino/" + alunoId, true);
  });
}

/* ---------- Exportar em PDF (impressão) ---------- */
export async function printView(ctx, params, [alunoId]) {
  const p = await store.getProfile(alunoId);
  const [treino, avals] = await Promise.all([store.getTreino(alunoId), store.listAvaliacoes(alunoId)]);
  const aval = avals.find((a) => a.status === "aprovada");
  const f = aval && aval.resultado_final;
  const t = treino && treino.conteudo;
  ctx.render(`
    <section class="page print">
      <div class="no-print btn-row"><a class="back" href="#/pro/aluno/${esc(alunoId)}">← Voltar</a><button class="btn btn--primary" onclick="window.print()">Salvar como PDF</button></div>
      <header class="print__head"><img src="../assets/logo-fonseca.png" alt="Fonseca Team"><div><h1>${esc(p.nome || "Aluno")}</h1><p>${esc(CONFIG.coachName)} · Fonseca Team · ${esc(fmtDate(new Date().toISOString()))}</p></div></header>
      ${f ? `<h2>Avaliação de ${esc(fmtDate(aval.criada_em))}</h2>
        ${(f.desvios || []).length ? `<h3>Postura</h3><ul>${f.desvios.map((d) => `<li><b>${esc(d.regiao)}</b> (${esc(d.vista)}, ${esc(d.grau)}): ${esc(d.descricao)}</li>`).join("")}</ul>` : ""}
        ${(f.corretivos || []).length ? `<h3>Corretivos</h3><ul>${f.corretivos.map((c) => `<li><b>${esc(c.exercicio)}</b> · ${esc(c.tipo)} · ${esc(c.dosagem)} · ${esc(c.frequencia)}${c.cuidados ? " · " + esc(c.cuidados) : ""}</li>`).join("")}</ul>` : ""}
        ${f.composicao ? `<h3>Composição corporal estimada</h3><p>${fmtNum(f.composicao.faixa_min)}% a ${fmtNum(f.composicao.faixa_max)}%. ${esc(f.composicao.explicacao || "")}</p>` : ""}
        ${f.alimentacao ? `<h3>Orientações de alimentação</h3><p>${fmtNum(f.alimentacao.calorias)} kcal/dia · proteína ${fmtNum(f.alimentacao.proteina_g)} g · carboidrato ${fmtNum(f.alimentacao.carboidrato_g)} g · gordura ${fmtNum(f.alimentacao.gordura_g)} g · água ${fmtNum(f.alimentacao.agua_l, 1)} L</p>` : ""}` : ""}
      ${t && (t.dias || []).length ? `<h2>Treino ${esc(t.divisao || "")}</h2>${t.observacoes ? `<p>${esc(t.observacoes)}</p>` : ""}
        ${t.dias.map((d) => `<h3>${esc(d.nome)}</h3><table class="ex-table"><thead><tr><th>Exercício</th><th>Séries</th><th>Reps</th><th>Descanso</th><th>Obs.</th></tr></thead><tbody>${(d.exercicios || []).map((x) => `<tr><td>${esc(x.nome)}</td><td>${esc(x.series)}</td><td>${esc(x.repeticoes)}</td><td>${esc(x.descanso)}</td><td>${esc(x.observacao || "")}</td></tr>`).join("")}</tbody></table>`).join("")}` : ""}
      <p class="disclaimer">Avaliação feita com apoio de inteligência artificial e revisada por um profissional. Não substitui avaliação presencial nem diagnóstico médico.</p>
    </section>`);
}
