/* Telas da área do aluno. */
import { $, $$, esc, toast, confirmDialog, downloadBlob, fmtDate, fmtNum, waLink, CONFIG, POSES, poseLabel, STATUS } from "./util.js";
import { store, CONSENT_VERSION, MODE } from "./store.js";
import { STEPS, renderField, readStep, stepComplete } from "./anamnese.js";
import { openCamera } from "./camera.js";
import { makeBeforeAfter, shareImage } from "./share.js";
import { lineChart } from "./chart.js";

const coach = CONFIG.coachName || "Maicon";
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";

/* ---------- Termo de consentimento (LGPD) ---------- */
export const CONSENT_TEXT = `
  <p>Para montar e acompanhar sua consultoria, a Fonseca Team precisa tratar dados pessoais <b>sensíveis</b> sobre você, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018):</p>
  <ul>
    <li><b>Quais dados:</b> suas fotos de avaliação (frente, costas e lados), respostas da anamnese (inclusive informações de saúde), medidas, peso e dados de contato.</li>
    <li><b>Para quê:</b> avaliar sua postura e composição corporal, montar e ajustar seu treino e suas orientações, e acompanhar sua evolução.</li>
    <li><b>Inteligência artificial:</b> suas fotos e sua anamnese podem ser analisadas por uma IA de um fornecedor externo (Anthropic) para gerar um rascunho de avaliação. Esse rascunho é sempre revisado por ${esc(coach)} antes de chegar até você. A IA não faz diagnóstico médico.</li>
    <li><b>Quem vê:</b> apenas você e o profissional responsável pela sua consultoria. Suas fotos ficam em armazenamento privado e nunca são públicas.</li>
    <li><b>Por quanto tempo:</b> enquanto durar o acompanhamento e por até 12 meses depois, salvo se você pedir a exclusão antes.</li>
    <li><b>Seus direitos:</b> a qualquer momento você pode baixar seus dados ou apagar suas fotos e sua conta pela tela <i>Conta</i>, ou pedir pelo WhatsApp.</li>
    <li><b>Menores de 18 anos</b> só podem usar o app com autorização do responsável legal.</li>
  </ul>
  <p class="small muted">Versão do termo: ${CONSENT_VERSION}. Leia também a <a href="../privacidade.html" target="_blank" rel="noopener">política de privacidade</a>.</p>`;

export async function consentView(ctx) {
  ctx.render(`
    <section class="page narrow">
      <span class="pill">Antes de começar</span>
      <h1>Termo de consentimento</h1>
      <div class="card prose">${CONSENT_TEXT}</div>
      <form class="card" id="consentForm">
        <label class="check"><input type="checkbox" name="ok" required><span>Li e concordo com o tratamento dos meus dados pessoais e sensíveis para as finalidades acima.</span></label>
        <label class="check"><input type="checkbox" name="idade" required><span>Tenho 18 anos ou mais, ou tenho autorização do meu responsável legal.</span></label>
        <button class="btn btn--primary btn--block" type="submit">Aceitar e continuar</button>
      </form>
    </section>`);
  $("#consentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await store.acceptConsent(ctx.me.id, CONSENT_VERSION);
    ctx.go("#/perfil?primeiro=1");
  });
}

/* ---------- Início ---------- */
export async function homeView(ctx) {
  const me = ctx.me;
  const [anam, avals, treino] = await Promise.all([store.getAnamnese(me.id), store.listAvaliacoes(me.id), store.getTreino(me.id)]);
  const perfilOk = me.nome && me.nascimento && me.altura && me.sexo;
  const last = avals[0];
  const lastFotos = last ? await store.listFotos(last.id) : [];
  const fotosOk = last && lastFotos.length >= 4;
  const planoOk = (treino && treino.liberado) || avals.some((a) => a.status === "aprovada");
  const steps = [
    { ok: perfilOk, title: "Seus dados", text: "Nome, idade, altura e peso.", href: "#/perfil", cta: "Preencher" },
    { ok: anam && anam.concluida, title: "Anamnese", text: "Rotina, saúde, treino e alimentação.", href: "#/anamnese/0", cta: anam ? "Continuar" : "Responder" },
    { ok: fotosOk, title: "Fotos de avaliação", text: "Frente, costas e os dois lados.", href: "#/fotos", cta: "Tirar fotos" },
    { ok: planoOk, title: "Seu plano", text: `${coach} revisa e libera seu treino.`, href: "#/plano", cta: "Ver" },
  ];
  const done = steps.filter((s) => s.ok).length;
  ctx.render(`
    <section class="page">
      <span class="pill">Fonseca Team</span>
      <h1>Olá, ${esc(firstName(me.nome) || "aluno")}!</h1>
      <p class="lead">${done === 4 ? "Tudo em dia. Bora treinar." : `${4 - done === 1 ? "Falta 1 passo" : `Faltam ${4 - done} passos`} para o seu plano ficar completo.`}</p>
      <div class="progress progress--lg" aria-label="${done} de 4 passos"><span style="width:${done * 25}%"></span></div>
      <ol class="steps">
        ${steps.map((s, i) => `
          <li class="step ${s.ok ? "is-done" : ""}">
            <span class="step__num">${s.ok ? "✓" : i + 1}</span>
            <div class="step__body"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>
            <a class="btn btn--sm ${s.ok ? "btn--ghost" : "btn--primary"}" href="${s.href}">${s.ok ? "Abrir" : esc(s.cta)}</a>
          </li>`).join("")}
      </ol>
      ${last ? `<div class="card status-card"><div><span class="muted small">Última avaliação · ${esc(fmtDate(last.criada_em))}</span><h3>${esc(STATUS[last.status].label)}</h3></div><a class="btn btn--ghost btn--sm" href="#/evolucao">Ver evolução</a></div>` : ""}
      <a class="btn btn--outline btn--block" target="_blank" rel="noopener" href="${waLink(`Olá, ${coach}! Sou ${me.nome || "aluno"} da Fonseca Team.`)}">Falar com o ${esc(firstName(coach))}</a>
    </section>`);
}

/* ---------- Dados básicos ---------- */
export async function profileView(ctx, params) {
  const me = ctx.me;
  const first = params.get("primeiro");
  ctx.render(`
    <section class="page narrow">
      <span class="pill">Seus dados</span>
      <h1>${first ? "Vamos começar" : "Seus dados"}</h1>
      <form class="card form" id="profileForm" novalidate>
        <label class="field"><span>Nome completo</span><input name="nome" autocomplete="name" required value="${esc(me.nome || "")}"></label>
        <div class="field-row">
          <label class="field"><span>Data de nascimento</span><input type="date" name="nascimento" required value="${esc(me.nascimento || "")}"></label>
          <fieldset class="field"><legend>Sexo</legend>
            <div class="segmented">
              <label><input type="radio" name="sexo" value="m" ${me.sexo !== "f" ? "checked" : ""}><span>Masculino</span></label>
              <label><input type="radio" name="sexo" value="f" ${me.sexo === "f" ? "checked" : ""}><span>Feminino</span></label>
            </div>
          </fieldset>
        </div>
        <div class="field-row">
          <label class="field"><span>Altura (cm)</span><input type="number" name="altura" min="120" max="230" inputmode="numeric" required value="${esc(me.altura || "")}"></label>
          <label class="field"><span>Peso (kg)</span><input type="number" name="peso" min="30" max="300" step="0.1" inputmode="decimal" required value="${esc(me.peso || "")}"></label>
        </div>
        <label class="field"><span>WhatsApp</span><input type="tel" name="whatsapp" autocomplete="tel" placeholder="(41) 99999-9999" value="${esc(me.whatsapp || "")}"></label>
        <p class="form-error" hidden>Preencha nome, nascimento, altura e peso.</p>
        <button class="btn btn--primary btn--block" type="submit">${first ? "Salvar e ir para a anamnese" : "Salvar"}</button>
      </form>
    </section>`);
  const form = $("#profileForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const ok = d.nome.trim() && d.nascimento && d.altura && d.peso;
    $(".form-error", form).hidden = !!ok;
    if (!ok) return;
    ctx.me = await store.saveProfile(me.id, { nome: d.nome.trim(), nascimento: d.nascimento, sexo: d.sexo, altura: +d.altura, peso: +d.peso, whatsapp: d.whatsapp.trim() });
    toast("Dados salvos.");
    ctx.go(first ? "#/anamnese/0" : "#/inicio");
  });
}

/* ---------- Anamnese ---------- */
export async function anamneseView(ctx, params, [stepParam]) {
  const me = ctx.me;
  const saved = (await store.getAnamnese(me.id)) || {};
  let r = saved.respostas || {};
  let i = Math.max(0, Math.min(STEPS.length - 1, parseInt(stepParam, 10) || 0));
  let saveTimer = null;

  const draw = () => {
    const step = STEPS[i];
    ctx.render(`
      <section class="page narrow">
        <div class="stepper"><span>Anamnese</span><b>Etapa ${i + 1} de ${STEPS.length}</b></div>
        <div class="progress"><span style="width:${((i + 1) / STEPS.length) * 100}%"></span></div>
        <h1>${esc(step.title)}</h1>
        ${step.intro ? `<p class="lead">${esc(step.intro)}</p>` : ""}
        <form class="card form anamnese" id="anamForm" novalidate>
          ${step.fields.map((f) => renderField(f, r)).join("")}
          <p class="form-error" hidden>Responda as perguntas marcadas com *.</p>
          <p class="autosave muted small" aria-live="polite"></p>
          <div class="form-nav">
            ${i > 0 ? `<button type="button" class="btn btn--ghost" data-nav="-1">Voltar</button>` : "<span></span>"}
            <button type="submit" class="btn btn--primary">${i === STEPS.length - 1 ? "Concluir" : "Próxima"}</button>
          </div>
        </form>
      </section>`);
    const form = $("#anamForm");
    const status = $(".autosave", form);
    const save = async (final) => {
      r = readStep(form, step, r);
      status.textContent = "Salvando…";
      await store.saveAnamnese(me.id, r, final || saved.concluida);
      status.textContent = "Salvo automaticamente.";
    };
    form.addEventListener("input", () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => save(), 600); });
    form.addEventListener("change", (e) => {
      // Perguntas condicionais aparecem ou somem
      r = readStep(form, step, r);
      if (e.target.type === "radio" || e.target.type === "checkbox") { clearTimeout(saveTimer); save().then(() => { const y = scrollY; draw(); scrollTo(0, y); }); }
    });
    $("[data-nav]", form) && $("[data-nav]", form).addEventListener("click", async () => { await save(); ctx.go("#/anamnese/" + (i - 1)); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      r = readStep(form, step, r);
      const ok = stepComplete(step, r);
      $(".form-error", form).hidden = ok;
      if (!ok) { $(".form-error", form).scrollIntoView({ block: "center" }); return; }
      const last = i === STEPS.length - 1;
      await save(last && STEPS.every((s) => stepComplete(s, r)));
      if (last) { toast("Anamnese concluída. Obrigado!"); ctx.go("#/fotos"); }
      else ctx.go("#/anamnese/" + (i + 1));
    });
  };
  draw();
}

/* ---------- Fotos de avaliação ---------- */
export async function photosView(ctx) {
  const me = ctx.me;
  const avals = await store.listAvaliacoes(me.id);
  // Continua a avaliação aberta (sem as 4 fotos) ou prepara uma nova
  let current = null;
  if (avals[0] && avals[0].status === "pendente") {
    const f = await store.listFotos(avals[0].id);
    if (f.length < 4) current = avals[0];
  }
  const draw = async () => {
    const fotos = current ? await store.listFotos(current.id) : [];
    const urls = {};
    for (const f of fotos) urls[f.pose] = await store.fotoURL(f);
    const med = (current && current.medidas) || {};
    const done = fotos.length;
    ctx.render(`
      <section class="page">
        <span class="pill">Avaliação</span>
        <h1>Fotos de avaliação</h1>
        <p class="lead">Tire as 4 fotos no mesmo lugar, com a mesma roupa e a mesma luz. Assim a comparação fica justa.</p>
        <form class="card form" id="medForm">
          <div class="field-row">
            <label class="field"><span>Peso de hoje (kg)</span><input type="number" name="peso" step="0.1" min="30" max="300" inputmode="decimal" value="${esc(med.peso || me.peso || "")}"></label>
            <label class="field"><span>Cintura (cm, opcional)</span><input type="number" name="cintura" step="0.5" min="40" max="200" inputmode="decimal" value="${esc(med.cintura || "")}"></label>
          </div>
        </form>
        <div class="poses">
          ${POSES.map((p, k) => `
            <button type="button" class="pose ${urls[p.id] ? "is-done" : ""}" data-pose="${p.id}">
              ${urls[p.id] ? `<img src="${esc(urls[p.id])}" alt="Foto ${esc(p.label)}">` : `<span class="pose__num">${k + 1}</span>`}
              <span class="pose__label">${esc(p.label)}${urls[p.id] ? " · Refazer" : ""}</span>
            </button>`).join("")}
        </div>
        <div class="progress"><span style="width:${done * 25}%"></span></div>
        <p class="muted small">${done} de 4 fotos</p>
        ${done === 4 ? `<a class="btn btn--primary btn--block" href="#/inicio">Pronto! ${esc(firstName(coach))} já recebeu suas fotos</a>` : ""}
      </section>`);

    const medForm = $("#medForm");
    const saveMed = async () => {
      const d = Object.fromEntries(new FormData(medForm));
      const medidas = { peso: d.peso ? +d.peso : null, cintura: d.cintura ? +d.cintura : null };
      if (current) current = await store.updateAvaliacao(current.id, { medidas });
      if (d.peso) ctx.me = await store.saveProfile(me.id, { peso: +d.peso });
      return medidas;
    };
    medForm.addEventListener("change", saveMed);

    $$(".pose").forEach((btn) => btn.addEventListener("click", async () => {
      const pose = btn.dataset.pose;
      const k = POSES.findIndex((p) => p.id === pose);
      const blob = await openCamera({ pose, label: poseLabel(pose), index: k + 1, total: 4 });
      if (!blob) return;
      try {
        const medidas = await saveMed();
        if (!current) current = await store.createAvaliacao(me.id, medidas);
        await store.uploadFoto(current.id, me.id, pose, blob);
        toast("Foto " + poseLabel(pose) + " salva.");
        await draw();
        const next = POSES.find((p) => !$(`.pose[data-pose="${p.id}"]`).classList.contains("is-done"));
        if (next) $(`.pose[data-pose="${next.id}"]`).focus();
      } catch (err) {
        toast("Não foi possível enviar a foto. Verifique a internet e tente de novo.", "error");
      }
    }));
  };
  await draw();
}

/* ---------- Evolução ---------- */
export async function evolutionView(ctx) {
  const me = ctx.me;
  const avals = await store.listAvaliacoes(me.id);
  const withFotos = [];
  for (const a of avals) {
    const fotos = await store.listFotos(a.id);
    if (fotos.length) withFotos.push({ ...a, fotos });
  }
  const chrono = withFotos.slice().reverse();
  ctx.render(`
    <section class="page">
      <span class="pill">Evolução</span>
      <h1>Sua evolução</h1>
      ${chrono.length < 2 ? `<div class="card empty"><p>${chrono.length ? "Você tem 1 avaliação. Na próxima, o comparador de antes e depois aparece aqui." : "Ainda não há fotos. Comece pela sua primeira avaliação."}</p><a class="btn btn--primary" href="#/fotos">Tirar fotos</a></div>` : `
      <div class="card compare">
        <div class="field-row field-row--3">
          <label class="field"><span>Pose</span><select id="cmpPose">${POSES.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join("")}</select></label>
          <label class="field"><span>Antes</span><select id="cmpA">${chrono.map((a, k) => `<option value="${k}" ${k === 0 ? "selected" : ""}>${esc(fmtDate(a.criada_em))}</option>`).join("")}</select></label>
          <label class="field"><span>Depois</span><select id="cmpB">${chrono.map((a, k) => `<option value="${k}" ${k === chrono.length - 1 ? "selected" : ""}>${esc(fmtDate(a.criada_em))}</option>`).join("")}</select></label>
        </div>
        <div class="slider" id="slider">
          <img class="slider__a" alt="Antes"><div class="slider__b"><img alt="Depois"></div>
          <span class="slider__handle" aria-hidden="true"></span>
          <span class="slider__tag slider__tag--a">Antes</span><span class="slider__tag slider__tag--b">Depois</span>
          <input type="range" min="0" max="100" value="50" aria-label="Arraste para comparar antes e depois">
        </div>
        <div class="share-row">
          <label class="check"><input type="checkbox" id="brand" checked><span>Com a marca da Fonseca Team</span></label>
          <button class="btn btn--primary" id="shareBtn" type="button">Compartilhar</button>
        </div>
      </div>`}
      <div class="charts" id="charts"></div>
      <h2 class="h2">Avaliações</h2>
      <ul class="timeline">
        ${withFotos.length ? "" : "<li class='muted'>Nenhuma avaliação ainda.</li>"}
        ${await Promise.all(withFotos.map(async (a) => {
          const thumbs = await Promise.all(a.fotos.slice(0, 4).map((f) => store.fotoURL(f)));
          return `<li class="timeline__item"><div><b>${esc(fmtDate(a.criada_em))}</b><span class="badge badge--${STATUS[a.status].tone}">${esc(STATUS[a.status].label)}</span>${a.medidas && a.medidas.peso ? `<span class="muted small">${fmtNum(a.medidas.peso, 1)} kg</span>` : ""}</div><div class="thumbs">${thumbs.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</div></li>`;
        })).then((x) => x.join(""))}
      </ul>
    </section>`);

  // Gráficos (só com 2 ou mais registros)
  const charts = $("#charts");
  const pesoPts = avals.map((a) => ({ date: a.criada_em, value: a.medidas && a.medidas.peso })).filter((p) => p.value);
  const cintPts = avals.map((a) => ({ date: a.criada_em, value: a.medidas && a.medidas.cintura })).filter((p) => p.value);
  if (pesoPts.length >= 2) { const d = document.createElement("div"); charts.appendChild(d); lineChart(d, pesoPts, { title: "Peso", unit: "kg" }); }
  if (cintPts.length >= 2) { const d = document.createElement("div"); charts.appendChild(d); lineChart(d, cintPts, { title: "Cintura", unit: "cm" }); }

  if (chrono.length < 2) return;
  const urlFor = async (a, pose) => { const f = a.fotos.find((x) => x.pose === pose); return f ? store.fotoURL(f) : null; };
  const slider = $("#slider");
  const update = async () => {
    const pose = $("#cmpPose").value;
    const A = chrono[+$("#cmpA").value], B = chrono[+$("#cmpB").value];
    const [ua, ub] = await Promise.all([urlFor(A, pose), urlFor(B, pose)]);
    $(".slider__a", slider).src = ua || "";
    $(".slider__b img", slider).src = ub || "";
    slider.classList.toggle("is-missing", !ua || !ub);
  };
  const setPos = (v) => slider.style.setProperty("--pos", v + "%");
  $("input[type=range]", slider).addEventListener("input", (e) => setPos(e.target.value));
  setPos(50);
  ["cmpPose", "cmpA", "cmpB"].forEach((id) => $("#" + id).addEventListener("change", update));
  await update();

  $("#shareBtn").addEventListener("click", async () => {
    const pose = $("#cmpPose").value;
    const A = chrono[+$("#cmpA").value], B = chrono[+$("#cmpB").value];
    const [ua, ub] = await Promise.all([urlFor(A, pose), urlFor(B, pose)]);
    if (!ua || !ub) { toast("Essa pose não existe nas duas avaliações.", "error"); return; }
    const blob = await makeBeforeAfter({ beforeURL: ua, afterURL: ub, beforeDate: A.criada_em, afterDate: B.criada_em, brand: $("#brand").checked, handle: CONFIG.instagram });
    const r = await shareImage(blob);
    if (r === "downloaded") toast("Imagem salva. Agora é só postar!");
  });
}

/* ---------- Meu plano ---------- */
export async function planView(ctx) {
  const me = ctx.me;
  const [treino, avals] = await Promise.all([store.getTreino(me.id), store.listAvaliacoes(me.id)]);
  const aval = avals.find((a) => a.status === "aprovada");
  const fin = aval && aval.resultado_final;
  const t = treino && treino.liberado ? treino.conteudo : null;
  const nutri = (CONFIG.app && CONFIG.app.nutricionista) || {};
  ctx.render(`
    <section class="page">
      <span class="pill">Meu plano</span>
      <h1>Seu plano</h1>
      ${!t && !fin ? `<div class="card empty"><p>Seu plano aparece aqui assim que ${esc(coach)} revisar sua anamnese e suas fotos.</p></div>` : ""}
      ${t ? `
        <h2 class="h2">Treino ${t.divisao ? esc(t.divisao) : ""}</h2>
        ${t.observacoes ? `<p class="muted">${esc(t.observacoes)}</p>` : ""}
        <div class="days">${(t.dias || []).map((d) => `
          <details class="day" open><summary>${esc(d.nome)}</summary>
            <table class="ex-table"><thead><tr><th>Exercício</th><th>Séries</th><th>Reps</th><th>Descanso</th></tr></thead><tbody>
              ${(d.exercicios || []).map((x) => `<tr><td>${esc(x.nome)}${x.observacao ? `<small>${esc(x.observacao)}</small>` : ""}</td><td>${esc(x.series)}</td><td>${esc(x.repeticoes)}</td><td>${esc(x.descanso)}</td></tr>`).join("")}
            </tbody></table>
          </details>`).join("")}</div>` : ""}
      ${fin ? `
        <h2 class="h2">Sua avaliação · ${esc(fmtDate(aval.aprovada_em || aval.criada_em))}</h2>
        ${fin.desvios && fin.desvios.length ? `<div class="card"><h3>Pontos de atenção na postura</h3><ul class="list">${fin.desvios.map((d) => `<li><b>${esc(d.regiao)}</b> · ${esc(d.descricao)} <span class="badge">${esc(d.grau)}</span></li>`).join("")}</ul></div>` : ""}
        ${fin.corretivos && fin.corretivos.length ? `<div class="card"><h3>Exercícios corretivos</h3><ul class="list">${fin.corretivos.map((c) => `<li><b>${esc(c.exercicio)}</b> · ${esc(c.dosagem)} · ${esc(c.frequencia)}${c.cuidados ? `<small>${esc(c.cuidados)}</small>` : ""}</li>`).join("")}</ul></div>` : ""}
        ${fin.composicao ? `<div class="card"><h3>Composição corporal estimada</h3><p class="big">${fmtNum(fin.composicao.faixa_min)}% a ${fmtNum(fin.composicao.faixa_max)}%</p><p class="muted small">${esc(fin.composicao.explicacao || "Estimativa visual, não substitui bioimpedância, dobras cutâneas ou DEXA.")}</p></div>` : ""}
        ${fin.alimentacao ? `<div class="card"><h3>Orientações de alimentação</h3>
          <div class="macros"><div><b>${fmtNum(fin.alimentacao.calorias)}</b><span>kcal/dia</span></div><div><b>${fmtNum(fin.alimentacao.proteina_g)} g</b><span>proteína</span></div><div><b>${fmtNum(fin.alimentacao.carboidrato_g)} g</b><span>carboidrato</span></div><div><b>${fmtNum(fin.alimentacao.gordura_g)} g</b><span>gordura</span></div><div><b>${fmtNum(fin.alimentacao.agua_l, 1)} L</b><span>água</span></div></div>
          ${fin.alimentacao.refeicoes && fin.alimentacao.refeicoes.length && nutri.nome ? `<ul class="list">${fin.alimentacao.refeicoes.map((m) => `<li><b>${esc(m.horario)} · ${esc(m.nome)}</b> ${esc(m.sugestao)}</li>`).join("")}</ul><p class="small muted">Plano alimentar aprovado por ${esc(nutri.nome)}${nutri.crn ? " · CRN " + esc(nutri.crn) : ""}.</p>` : ""}
          ${fin.alimentacao.observacoes ? `<p class="small muted">${esc(fin.alimentacao.observacoes)}</p>` : ""}
        </div>` : ""}
        <p class="disclaimer">Avaliação feita com apoio de inteligência artificial e revisada por um profissional. Não substitui avaliação presencial nem diagnóstico médico.</p>` : ""}
      <a class="btn btn--outline btn--block" target="_blank" rel="noopener" href="${waLink(`Olá, ${coach}! Tenho uma dúvida sobre o meu plano.`)}">Falar com o ${esc(firstName(coach))}</a>
    </section>`);
}

/* ---------- Conta e privacidade ---------- */
export async function accountView(ctx) {
  const me = ctx.me;
  const consent = await store.getConsent(me.id);
  ctx.render(`
    <section class="page narrow">
      <span class="pill">Conta</span>
      <h1>Conta e privacidade</h1>
      <div class="card">
        <p><b>${esc(me.nome || "")}</b><br><span class="muted small">${MODE === "demo" ? "Modo demonstração" : esc(ctx.email || "")}</span></p>
        <a class="btn btn--ghost btn--block" href="#/perfil">Editar meus dados</a>
      </div>
      <div class="card">
        <h3>Seus dados</h3>
        <p class="small muted">Termo aceito em ${esc(fmtDate(consent && consent.aceito_em))} (versão ${esc(consent ? consent.versao : "–")}).</p>
        <details class="consent-read"><summary>Ler o termo de consentimento</summary><div class="prose">${CONSENT_TEXT}</div></details>
        <button class="btn btn--ghost btn--block" id="exportBtn" type="button">Baixar meus dados</button>
        <button class="btn btn--danger btn--block" id="deleteBtn" type="button">Apagar minhas fotos e minha conta</button>
      </div>
      <button class="btn btn--outline btn--block" id="logoutBtn" type="button">Sair</button>
    </section>`);
  $("#exportBtn").addEventListener("click", async () => {
    const data = await store.exportData(me.id);
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "meus-dados-fonseca-team.json");
  });
  $("#deleteBtn").addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Apagar tudo?", text: "Suas fotos, anamnese, avaliações e conta serão apagadas para sempre. Isso não pode ser desfeito.", ok: "Apagar tudo", danger: true });
    if (!ok) return;
    try { await store.deleteAccount(me.id); toast("Seus dados foram apagados."); ctx.go("#/entrar", true); }
    catch (err) { toast(err.message, "error"); }
  });
  $("#logoutBtn").addEventListener("click", async () => { await store.signOut(); ctx.go("#/entrar", true); });
}
