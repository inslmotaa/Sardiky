/*
 * Tela de revisão do rascunho da IA. Cada item pode ser incluído ou não, e todos
 * os campos são editáveis. collect() devolve o resultado final aprovado.
 */
import { esc, poseLabel, CONFIG } from "./util.js";

const sel = (name, value, options) =>
  `<select name="${name}">${options.map((o) => `<option ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
const inp = (name, value, ph = "") => `<input name="${name}" value="${esc(value ?? "")}" placeholder="${esc(ph)}">`;
const num = (name, value, step = 1) => `<input type="number" step="${step}" name="${name}" value="${esc(value ?? "")}">`;
const inc = (on = true) => `<label class="inc"><input type="checkbox" name="incluir" ${on ? "checked" : ""}><span>Incluir</span></label>`;

export function renderReview(r, opts = {}) {
  r = r || {};
  const bad = (r.qualidade_fotos || []).filter((q) => !q.adequada);
  const nutri = (CONFIG.app && CONFIG.app.nutricionista) || {};
  const comp = r.composicao || {};
  const alim = r.alimentacao || {};
  return `
    ${r.demo ? `<div class="banner banner--warn"><b>Modo demonstração:</b> este rascunho é um exemplo fixo e não foi gerado a partir das fotos.</div>` : ""}

    ${(r.alertas || []).length ? `<section class="rv rv--alert" data-block="alertas"><h3>Alertas de encaminhamento</h3>
      ${(r.alertas || []).map((a) => `<div class="rv__row" data-item>${inc()}<div class="rv__fields"><textarea name="descricao" rows="2">${esc(a.descricao)}</textarea><input type="hidden" name="tipo" value="${esc(a.tipo || "encaminhamento")}"></div></div>`).join("")}
    </section>` : ""}

    <section class="rv" data-block="qualidade"><h3>Qualidade das fotos</h3>
      <ul class="rv__quality">${(r.qualidade_fotos || []).map((q) => `<li class="${q.adequada ? "ok" : "bad"}"><b>${esc(poseLabel(q.pose))}</b> ${q.adequada ? "adequada" : "pedir nova foto: " + esc(q.motivo)}</li>`).join("")}</ul>
      ${bad.length && opts.askPhoto ? `<a class="btn btn--outline btn--sm" target="_blank" rel="noopener" href="${esc(opts.askPhoto(bad))}">Pedir nova foto pelo WhatsApp</a>` : ""}
    </section>

    <section class="rv" data-block="desvios"><h3>Avaliação postural</h3>
      ${(r.desvios || []).map((d) => `<div class="rv__row" data-item>${inc()}<div class="rv__fields rv__fields--grid">
        <label>Vista ${sel("vista", d.vista, ["frente", "costas", "lado"])}</label>
        <label>Região ${inp("regiao", d.regiao)}</label>
        <label>Grau ${sel("grau", d.grau, ["leve", "moderado", "acentuado"])}</label>
        <label>Confiança da IA ${sel("confianca", d.confianca, ["baixa", "media", "alta"])}</label>
        <label class="span-all">Descrição <textarea name="descricao" rows="2">${esc(d.descricao)}</textarea></label>
      </div></div>`).join("") || `<p class="muted">Nenhum desvio identificado.</p>`}
      <button type="button" class="btn btn--ghost btn--sm" data-add="desvios">+ Adicionar desvio</button>
    </section>

    <section class="rv" data-block="corretivos"><h3>Exercícios corretivos</h3>
      ${(r.corretivos || []).map((c) => `<div class="rv__row" data-item>${inc()}<div class="rv__fields rv__fields--grid">
        <label class="span-2">Exercício ${inp("exercicio", c.exercicio)}</label>
        <label>Tipo ${sel("tipo", c.tipo, ["alongamento", "mobilidade", "fortalecimento"])}</label>
        <label>Para ${inp("desvio", c.desvio)}</label>
        <label>Dosagem ${inp("dosagem", c.dosagem, "3×30s")}</label>
        <label>Frequência ${inp("frequencia", c.frequencia, "3x por semana")}</label>
        <label class="span-all">Cuidados ${inp("cuidados", c.cuidados)}</label>
      </div></div>`).join("")}
      <button type="button" class="btn btn--ghost btn--sm" data-add="corretivos">+ Adicionar exercício</button>
    </section>

    <section class="rv" data-block="composicao"><h3>Composição corporal estimada</h3>
      <div class="rv__row" data-item>${inc(true)}<div class="rv__fields rv__fields--grid">
        <label>De (%) ${num("faixa_min", comp.faixa_min)}</label>
        <label>Até (%) ${num("faixa_max", comp.faixa_max)}</label>
        <label class="span-all">Explicação <textarea name="explicacao" rows="2">${esc(comp.explicacao || "Estimativa visual, não substitui bioimpedância, dobras cutâneas ou DEXA.")}</textarea></label>
      </div></div>
    </section>

    <section class="rv" data-block="treino"><h3>Sugestão de treino</h3>
      <p class="muted small">Divisão ${esc((r.treino || {}).divisao || "–")} · ${((r.treino || {}).dias || []).length} dias. ${esc((r.treino || {}).observacoes || "")}</p>
      <button type="button" class="btn btn--outline btn--sm" data-act="to-editor">Abrir no editor de treino</button>
    </section>

    <section class="rv" data-block="alimentacao"><h3>Alimentação</h3>
      <div class="rv__row" data-item>${inc(true)}<div class="rv__fields rv__fields--grid">
        <label>Calorias (kcal) ${num("calorias", alim.calorias)}</label>
        <label>Proteína (g) ${num("proteina_g", alim.proteina_g)}</label>
        <label>Carboidrato (g) ${num("carboidrato_g", alim.carboidrato_g)}</label>
        <label>Gordura (g) ${num("gordura_g", alim.gordura_g)}</label>
        <label>Água (L) ${num("agua_l", alim.agua_l, 0.1)}</label>
        <label class="span-all">Observações <textarea name="observacoes" rows="2">${esc(alim.observacoes || "")}</textarea></label>
      </div></div>
      ${nutri.nome ? `<p class="small muted">As refeições abaixo serão mostradas ao aluno como aprovadas por ${esc(nutri.nome)}. Confirme com o nutricionista antes de liberar.</p>
        ${(alim.refeicoes || []).map((m) => `<div class="rv__row" data-item data-sub="refeicoes">${inc()}<div class="rv__fields rv__fields--grid"><label>Refeição ${inp("nome", m.nome)}</label><label>Horário ${inp("horario", m.horario)}</label><label class="span-all">Sugestão ${inp("sugestao", m.sugestao)}</label></div></div>`).join("")}`
        : `<p class="banner">Prescrever dieta é atividade exclusiva de nutricionista (Lei 8.234/91). Sem nutricionista cadastrado no app, o aluno recebe só as orientações gerais acima (calorias, macros e água), sem cardápio.</p>`}
    </section>

    <section class="rv" data-block="observacoes"><h3>Observações</h3>
      <textarea name="observacoes_gerais" rows="3">${esc(r.observacoes || "")}</textarea>
    </section>`;
}

const BLANK = {
  desvios: { vista: "frente", regiao: "", grau: "leve", confianca: "media", descricao: "" },
  corretivos: { exercicio: "", tipo: "mobilidade", desvio: "", dosagem: "", frequencia: "", cuidados: "" },
};

export function bindReview(root, onToEditor) {
  root.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      const block = add.dataset.add;
      const tmp = document.createElement("div");
      tmp.innerHTML = renderReview({ [block]: [BLANK[block]] });
      const row = tmp.querySelector(`[data-block="${block}"] [data-item]`);
      add.before(row);
      row.querySelector("input:not([type=checkbox]), textarea").focus();
    }
    if (e.target.closest("[data-act='to-editor']") && onToEditor) onToEditor();
  });
  root.addEventListener("change", (e) => {
    if (e.target.name === "incluir") e.target.closest("[data-item]").classList.toggle("is-off", !e.target.checked);
  });
}

const rowData = (row) => {
  const o = {};
  row.querySelectorAll("input, select, textarea").forEach((el) => {
    if (el.name === "incluir" || !el.name) return;
    o[el.name] = el.type === "number" ? (el.value === "" ? null : +el.value) : el.value.trim();
  });
  return o;
};
const included = (block, root) =>
  Array.from(root.querySelectorAll(`[data-block="${block}"] [data-item]:not([data-sub])`)).filter((r) => r.querySelector("[name=incluir]").checked).map(rowData);

export function collectReview(root, original) {
  const comp = included("composicao", root)[0] || null;
  const alimRow = included("alimentacao", root)[0] || null;
  const refeicoes = Array.from(root.querySelectorAll('[data-sub="refeicoes"]')).filter((r) => r.querySelector("[name=incluir]").checked).map(rowData);
  return {
    alertas: included("alertas", root),
    desvios: included("desvios", root),
    corretivos: included("corretivos", root),
    composicao: comp,
    alimentacao: alimRow ? { ...alimRow, refeicoes } : null,
    treino: (original || {}).treino || null,
    observacoes: (root.querySelector("[name=observacoes_gerais]") || {}).value || "",
  };
}
