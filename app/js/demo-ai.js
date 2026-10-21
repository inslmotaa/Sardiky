/*
 * MODO DEMONSTRAÇÃO: gera um rascunho de EXEMPLO para mostrar a tela de revisão.
 * Não analisa as fotos. Na versão real, quem gera o rascunho é a função
 * netlify/functions/avaliacao-background.mjs, com o Claude.
 */
import { ageFrom } from "./util.js";

export function demoEvaluation(profile = {}, r = {}, medidas = {}) {
  r = r || {};
  const peso = parseFloat(medidas.peso || profile.peso) || 75;
  const altura = parseFloat(profile.altura) || 172;
  const idade = ageFrom(profile.nascimento) || 30;
  const sexoM = (profile.sexo || "m") === "m";
  const fator = { "1": 1.375, "2": 1.375, "3": 1.55, "4": 1.55, "5": 1.725, "6": 1.725 }[String(r.dias_semana || 4)] || 1.55;
  const gasto = (10 * peso + 6.25 * altura - 5 * idade + (sexoM ? 5 : -161)) * fator;
  const objetivo = r.objetivo || "hipertrofia";
  const meta = Math.round(objetivo === "emagrecimento" || objetivo === "definicao" ? gasto - 500 : objetivo === "hipertrofia" ? gasto + 300 : gasto);
  const prot = Math.round(2 * peso);
  const gord = Math.round(0.8 * peso);
  const carb = Math.max(0, Math.round((meta - prot * 4 - gord * 9) / 4));
  const casa = r.local === "casa";

  const dias = casa
    ? [
        { nome: "A · Membros inferiores", exercicios: [ex("Agachamento livre com peso do corpo", 4, "15", "60s"), ex("Afundo alternado", 3, "12 cada perna", "60s"), ex("Ponte de glúteo", 4, "15", "45s"), ex("Panturrilha em pé", 4, "20", "30s")] },
        { nome: "B · Membros superiores", exercicios: [ex("Flexão de braço", 4, "até a falha técnica", "60s"), ex("Remada com elástico", 4, "15", "60s"), ex("Desenvolvimento com elástico", 3, "12", "60s"), ex("Prancha", 3, "40s", "30s")] },
      ]
    : [
        { nome: "A · Peito, ombro e tríceps", exercicios: [ex("Supino reto com barra", 4, "8-10", "90s"), ex("Supino inclinado com halteres", 3, "10-12", "75s"), ex("Desenvolvimento com halteres", 3, "10-12", "75s"), ex("Tríceps na polia", 3, "12-15", "60s")] },
        { nome: "B · Costas e bíceps", exercicios: [ex("Puxada frontal", 4, "8-10", "90s"), ex("Remada curvada", 3, "10-12", "75s"), ex("Face pull", 3, "15", "60s"), ex("Rosca direta", 3, "10-12", "60s")] },
        { nome: "C · Membros inferiores", exercicios: [ex("Agachamento livre", 4, "8-10", "120s"), ex("Leg press", 3, "10-12", "90s"), ex("Mesa flexora", 3, "12", "60s"), ex("Panturrilha sentado", 4, "15", "45s")] },
      ];

  return {
    demo: true,
    qualidade_fotos: [
      { pose: "frente", adequada: true, motivo: "" },
      { pose: "costas", adequada: true, motivo: "" },
      { pose: "lado_direito", adequada: true, motivo: "" },
      { pose: "lado_esquerdo", adequada: true, motivo: "" },
    ],
    alertas: r.restricao_medica === "sim" || r.dor === "sim"
      ? [{ tipo: "encaminhamento", descricao: "A anamnese relata dor ou restrição médica. Avaliar a necessidade de liberação médica ou fisioterapêutica antes de progredir as cargas." }]
      : [],
    desvios: [
      { vista: "lado", regiao: "cabeça", descricao: "EXEMPLO: cabeça levemente à frente da linha dos ombros.", grau: "leve", confianca: "baixa" },
      { vista: "frente", regiao: "ombros", descricao: "EXEMPLO: ombros projetados para a frente (protração).", grau: "moderado", confianca: "baixa" },
    ],
    corretivos: [
      { desvio: "Cabeça à frente", exercicio: "Retração cervical (chin tuck)", tipo: "mobilidade", dosagem: "2×10", frequencia: "diário", cuidados: "Movimento lento, sem dor." },
      { desvio: "Ombros protraídos", exercicio: "Alongamento de peitoral na porta", tipo: "alongamento", dosagem: "3×30s", frequencia: "5x por semana", cuidados: "Sem forçar o ombro." },
      { desvio: "Ombros protraídos", exercicio: "Face pull", tipo: "fortalecimento", dosagem: "3×15", frequencia: "2-3x por semana", cuidados: "Escápulas para trás e para baixo." },
    ],
    composicao: { faixa_min: 15, faixa_max: 20, explicacao: "EXEMPLO de faixa. Estimativa visual, não substitui bioimpedância, dobras cutâneas ou DEXA." },
    treino: {
      divisao: casa ? "AB" : "ABC",
      observacoes: "EXEMPLO de sugestão montada a partir da anamnese. Ajuste cargas e exercícios ao aluno.",
      dias,
    },
    alimentacao: {
      calorias: meta, proteina_g: prot, carboidrato_g: carb, gordura_g: gord,
      agua_l: Math.round(peso * 0.035 * 10) / 10,
      refeicoes: [
        { nome: "Café da manhã", horario: "07:00", sugestao: "EXEMPLO: fonte de proteína + carboidrato + fruta." },
        { nome: "Almoço", horario: "12:30", sugestao: "EXEMPLO: proteína magra, arroz e feijão, salada." },
        { nome: "Pré-treino", horario: "17:30", sugestao: "EXEMPLO: carboidrato de fácil digestão." },
        { nome: "Jantar", horario: "20:30", sugestao: "EXEMPLO: proteína, legumes e carboidrato." },
      ],
      observacoes: "Calorias e macros pela fórmula de Mifflin-St Jeor. Refeições só são liberadas com aprovação de nutricionista.",
    },
    observacoes: "MODO DEMONSTRAÇÃO: este rascunho é um exemplo fixo e NÃO foi gerado a partir das fotos. Configure o Supabase e a chave da IA para a análise real.",
  };
}

function ex(nome, series, repeticoes, descanso, observacao = "") {
  return { nome, series, repeticoes, descanso, observacao };
}
