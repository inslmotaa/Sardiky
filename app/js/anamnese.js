/*
 * Anamnese em etapas. Cada pergunta é descrita aqui; a tela é montada automaticamente
 * e as respostas são salvas sozinhas a cada mudança.
 */
import { esc } from "./util.js";

// PAR-Q (Physical Activity Readiness Questionnaire), versão em português
const PARQ = [
  ["parq_coracao", "Algum médico já disse que você tem um problema de coração e que só deveria fazer atividade física com orientação médica?"],
  ["parq_dor_peito_atividade", "Você sente dor no peito quando pratica atividade física?"],
  ["parq_dor_peito_mes", "No último mês, você sentiu dor no peito sem estar fazendo atividade física?"],
  ["parq_tontura", "Você perde o equilíbrio por tontura ou já perdeu a consciência?"],
  ["parq_osso_articulacao", "Você tem algum problema nos ossos ou nas articulações que pode piorar com a atividade física?"],
  ["parq_medicamento_pressao", "Você toma algum remédio para pressão arterial ou para o coração?"],
  ["parq_outro_motivo", "Existe algum outro motivo pelo qual você não deveria fazer atividade física?"],
];

export const STEPS = [
  {
    id: "objetivo", title: "Objetivo",
    fields: [
      { id: "objetivo", label: "Qual é o seu objetivo principal?", type: "choice", required: true, options: [["emagrecimento", "Emagrecimento"], ["hipertrofia", "Hipertrofia"], ["definicao", "Definição"], ["performance", "Performance"]] },
      { id: "prazo", label: "Em quanto tempo você gostaria de ver resultado?", type: "choice", options: [["3m", "3 meses"], ["6m", "6 meses"], ["12m", "1 ano"], ["sem_prazo", "Sem prazo definido"]] },
      { id: "motivacao", label: "O que te motivou a começar agora?", type: "textarea" },
    ],
  },
  {
    id: "rotina", title: "Rotina",
    fields: [
      { id: "trabalho", label: "Como é o seu trabalho?", type: "choice", options: [["sentado", "Fico sentado a maior parte do tempo"], ["misto", "Alterno entre sentado e em pé"], ["ativo", "Fico em pé ou me movimento bastante"]] },
      { id: "horario_treino", label: "Em qual horário você consegue treinar?", type: "choice", options: [["manha", "Manhã"], ["tarde", "Tarde"], ["noite", "Noite"], ["varia", "Varia"]] },
      { id: "dias_semana", label: "Quantos dias por semana você pode treinar?", type: "choice", required: true, options: [["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"]] },
      { id: "tempo_treino", label: "Quanto tempo por treino?", type: "choice", options: [["30", "30 min"], ["45", "45 min"], ["60", "1 hora"], ["90", "1h30 ou mais"]] },
      { id: "sono", label: "Quantas horas você dorme por noite, em média?", type: "number", min: 3, max: 12, step: 0.5, suffix: "horas" },
    ],
  },
  {
    id: "local", title: "Local de treino",
    fields: [
      { id: "local", label: "Onde você vai treinar?", type: "choice", required: true, options: [["academia", "Academia completa"], ["condominio", "Academia de condomínio"], ["casa", "Em casa"]] },
      { id: "equipamentos", label: "Quais equipamentos você tem disponíveis?", type: "multi", showIf: (r) => r.local && r.local !== "academia", options: [["halteres", "Halteres"], ["barra", "Barra e anilhas"], ["elasticos", "Elásticos"], ["kettlebell", "Kettlebell"], ["banco", "Banco"], ["barra_fixa", "Barra fixa"], ["maquinas", "Algumas máquinas"], ["nenhum", "Nenhum"]] },
    ],
  },
  {
    id: "historico", title: "Histórico",
    fields: [
      { id: "experiencia", label: "Há quanto tempo você treina musculação?", type: "choice", required: true, options: [["nunca", "Nunca treinei"], ["menos_6m", "Menos de 6 meses"], ["6m_2a", "De 6 meses a 2 anos"], ["mais_2a", "Mais de 2 anos"]] },
      { id: "parado", label: "Está treinando atualmente?", type: "choice", options: [["sim", "Sim"], ["nao", "Não, estou parado"]] },
      { id: "funcionou", label: "O que já funcionou e o que não funcionou para você?", type: "textarea" },
    ],
  },
  {
    id: "saude", title: "Saúde",
    intro: "Responda com atenção. Essas informações garantem que o treino seja seguro para você.",
    fields: [
      ...PARQ.map(([id, label]) => ({ id, label, type: "yesno", required: true })),
      { id: "dor", label: "Sente alguma dor hoje (costas, joelho, ombro...)?", type: "yesno", required: true },
      { id: "dor_detalhe", label: "Onde dói e em quais movimentos?", type: "textarea", showIf: (r) => r.dor === "sim" },
      { id: "lesoes", label: "Lesões ou cirurgias (quais e quando)", type: "textarea" },
      { id: "doencas", label: "Doenças ou condições de saúde", type: "textarea" },
      { id: "medicamentos", label: "Medicamentos de uso contínuo", type: "textarea" },
      { id: "restricao_medica", label: "Algum médico já restringiu exercício para você?", type: "yesno", required: true },
    ],
  },
  {
    id: "alimentacao", title: "Alimentação",
    fields: [
      { id: "refeicoes_dia", label: "Quantas refeições você faz por dia?", type: "choice", options: [["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6 ou mais"]] },
      { id: "horarios_refeicoes", label: "Horários das refeições", type: "text", placeholder: "Ex.: 7h, 12h, 16h, 20h" },
      { id: "preferencias", label: "Alimentos que você gosta e come com frequência", type: "textarea" },
      { id: "nao_come", label: "Alimentos que você não come", type: "textarea" },
      { id: "restricoes", label: "Restrições ou alergias alimentares", type: "textarea" },
      { id: "agua", label: "Quanta água você bebe por dia?", type: "choice", options: [["menos_1", "Menos de 1 litro"], ["1_2", "1 a 2 litros"], ["2_3", "2 a 3 litros"], ["mais_3", "Mais de 3 litros"]] },
      { id: "alcool", label: "Consome bebida alcoólica?", type: "choice", options: [["nao", "Não"], ["social", "Socialmente"], ["frequente", "Com frequência"]] },
      { id: "suplementos", label: "Usa suplementos? Quais?", type: "text" },
    ],
  },
  {
    id: "medidas", title: "Medidas",
    intro: "Opcional. Se tiver uma fita métrica, meça com o corpo relaxado.",
    fields: [
      { id: "cintura", label: "Cintura (cm)", type: "number", min: 40, max: 200, step: 0.5 },
      { id: "quadril", label: "Quadril (cm)", type: "number", min: 50, max: 200, step: 0.5 },
      { id: "braco", label: "Braço (cm)", type: "number", min: 15, max: 70, step: 0.5 },
      { id: "coxa", label: "Coxa (cm)", type: "number", min: 30, max: 100, step: 0.5 },
    ],
  },
];

export const visible = (f, r) => !f.showIf || f.showIf(r || {});

export function stepComplete(step, r) {
  return step.fields.every((f) => !f.required || !visible(f, r) || (r[f.id] != null && r[f.id] !== ""));
}

export function renderField(f, r) {
  if (!visible(f, r)) return "";
  const v = r[f.id];
  const req = f.required ? ' <span class="req" aria-hidden="true">*</span>' : "";
  const name = esc(f.id);
  if (f.type === "choice" || f.type === "yesno") {
    const opts = f.type === "yesno" ? [["sim", "Sim"], ["nao", "Não"]] : f.options;
    return `<fieldset class="q"><legend>${esc(f.label)}${req}</legend><div class="opts ${f.type === "yesno" ? "opts--row" : ""}">${opts
      .map(([val, lab]) => `<label class="opt"><input type="radio" name="${name}" value="${esc(val)}" ${v === val ? "checked" : ""}><span>${esc(lab)}</span></label>`)
      .join("")}</div></fieldset>`;
  }
  if (f.type === "multi") {
    const arr = Array.isArray(v) ? v : [];
    return `<fieldset class="q"><legend>${esc(f.label)}${req}</legend><div class="opts opts--wrap">${f.options
      .map(([val, lab]) => `<label class="opt"><input type="checkbox" name="${name}" value="${esc(val)}" ${arr.includes(val) ? "checked" : ""}><span>${esc(lab)}</span></label>`)
      .join("")}</div></fieldset>`;
  }
  if (f.type === "textarea") {
    return `<label class="q"><span class="q__label">${esc(f.label)}${req}</span><textarea name="${name}" rows="3">${esc(v || "")}</textarea></label>`;
  }
  const t = f.type === "number" ? "number" : "text";
  const extra = f.type === "number" ? ` inputmode="decimal" min="${f.min}" max="${f.max}" step="${f.step || 1}"` : "";
  return `<label class="q"><span class="q__label">${esc(f.label)}${req}</span><input type="${t}" name="${name}" value="${esc(v ?? "")}"${extra} placeholder="${esc(f.placeholder || "")}">${f.suffix ? `<small class="muted">${esc(f.suffix)}</small>` : ""}</label>`;
}

/* Lê os valores do formulário de uma etapa */
export function readStep(form, step, r) {
  const out = { ...r };
  step.fields.forEach((f) => {
    if (f.type === "multi") out[f.id] = Array.from(form.querySelectorAll(`[name="${f.id}"]:checked`)).map((i) => i.value);
    else if (f.type === "choice" || f.type === "yesno") {
      const c = form.querySelector(`[name="${f.id}"]:checked`);
      if (c) out[f.id] = c.value;
    } else {
      const i = form.querySelector(`[name="${f.id}"]`);
      if (i) out[f.id] = i.value.trim();
    }
  });
  return out;
}

/* Resumo legível (para o profissional e para a IA) */
export function summarize(r) {
  r = r || {};
  return STEPS.map((s) => ({
    title: s.title,
    items: s.fields
      .filter((f) => r[f.id] != null && r[f.id] !== "" && !(Array.isArray(r[f.id]) && !r[f.id].length))
      .map((f) => {
        let v = r[f.id];
        const opts = f.type === "yesno" ? [["sim", "Sim"], ["nao", "Não"]] : f.options;
        if (opts) v = (Array.isArray(v) ? v : [v]).map((x) => (opts.find((o) => o[0] === x) || [x, x])[1]).join(", ");
        return { label: f.label, value: String(v), alert: (f.type === "yesno" && r[f.id] === "sim") };
      }),
  })).filter((s) => s.items.length);
}
