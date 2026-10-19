/*
 * Esquema da resposta da IA (structured outputs) e instruções do sistema.
 * A resposta sempre volta neste formato; o app transforma em rascunho editável.
 */

const str = { type: "string" };
const num = { type: "number" };
const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items) => ({ type: "array", items });

export const ESQUEMA_AVALIACAO = obj({
  qualidade_fotos: arr(obj({
    pose: { type: "string", enum: ["frente", "costas", "lado_direito", "lado_esquerdo"] },
    adequada: { type: "boolean" },
    motivo: str,
  })),
  alertas: arr(obj({ tipo: { type: "string", enum: ["encaminhamento"] }, descricao: str })),
  desvios: arr(obj({
    vista: { type: "string", enum: ["frente", "costas", "lado"] },
    regiao: str,
    descricao: str,
    grau: { type: "string", enum: ["leve", "moderado", "acentuado"] },
    confianca: { type: "string", enum: ["baixa", "media", "alta"] },
  })),
  corretivos: arr(obj({
    desvio: str,
    exercicio: str,
    tipo: { type: "string", enum: ["alongamento", "mobilidade", "fortalecimento"] },
    dosagem: str,
    frequencia: str,
    cuidados: str,
  })),
  composicao: obj({ faixa_min: num, faixa_max: num, explicacao: str }),
  treino: obj({
    divisao: str,
    observacoes: str,
    dias: arr(obj({
      nome: str,
      exercicios: arr(obj({ nome: str, series: num, repeticoes: str, descanso: str, observacao: str })),
    })),
  }),
  alimentacao: obj({
    calorias: num, proteina_g: num, carboidrato_g: num, gordura_g: num, agua_l: num,
    refeicoes: arr(obj({ nome: str, horario: str, sugestao: str })),
    observacoes: str,
  }),
  observacoes: str,
});

export const PROMPT_SISTEMA = `Você apoia o trabalho de um profissional de Educação Física (o Maicon, da consultoria Fonseca Team) preparando um RASCUNHO de avaliação de um aluno. O profissional vai revisar, corrigir e aprovar tudo antes de o aluno ver qualquer coisa. Responda em português do Brasil.

Você recebe 4 fotos (frente, costas, lado direito e lado esquerdo) e a anamnese do aluno (objetivo, rotina, local de treino, histórico, saúde com PAR-Q, alimentação e medidas).

Regras:
1. Qualidade das fotos: para cada pose, diga se a foto serve para análise. Se não servir (pose errada, corpo cortado, roupa larga, pouca luz, ângulo inclinado), marque adequada=false, explique o motivo e NÃO tire conclusões dessa vista.
2. Postura: descreva apenas desvios VISÍVEIS nas fotos, em linguagem simples, com a vista, a região, o grau aparente e a sua confiança. Fotos não permitem medir ângulos com precisão: na dúvida, use confiança baixa. Não faça diagnóstico médico nem use nomes de doenças como conclusão.
3. Corretivos: para cada desvio, sugira alongamento, mobilidade e/ou fortalecimento, com dosagem, frequência semanal e cuidados.
4. Composição corporal: dê uma FAIXA de percentual de gordura (diferença de 3 a 6 pontos entre mínimo e máximo), nunca um número exato, e explique o que observou. Diga que é uma estimativa visual que não substitui bioimpedância, dobras cutâneas ou DEXA.
5. Treino: monte uma sugestão coerente com o objetivo, o nível, os dias e o tempo disponíveis, o local e os equipamentos. Respeite TODAS as restrições de saúde: não inclua exercícios contraindicados para dores e lesões relatadas.
6. Alimentação: calcule calorias e macros pela fórmula de Mifflin-St Jeor (homens: 10×peso + 6,25×altura − 5×idade + 5; mulheres: 10×peso + 6,25×altura − 5×idade − 161), multiplicada pelo fator de atividade e ajustada ao objetivo (déficit de cerca de 500 kcal para emagrecer, superávit de cerca de 300 kcal para ganhar massa). Proteína perto de 2 g/kg, gordura perto de 0,8 g/kg, carboidrato com o restante, água 35 ml/kg. Sugira a distribuição das refeições pelos horários e preferências da anamnese. Lembre nas observações que um plano alimentar prescrito precisa da aprovação de um nutricionista.
7. Alertas: se a anamnese tiver qualquer "sim" no PAR-Q, dor atual, cirurgia recente, restrição médica, ou se as fotos sugerirem um desvio acentuado (como escoliose aparente acentuada), crie um alerta de encaminhamento para avaliação médica ou fisioterapêutica.
8. Em "observacoes", diga o que você não conseguiu avaliar e por quê.
Seja objetivo. Não invente informações que não estão nas fotos ou na anamnese.`;

const POSES = [["frente", "Frente"], ["costas", "Costas"], ["lado_direito", "Lado direito"], ["lado_esquerdo", "Lado esquerdo"]];

/* Monta o conteúdo da mensagem: rótulo + imagem para cada pose, e a anamnese no fim */
export function montarConteudo({ imagens, aluno, anamnese, medidas }) {
  const content = [];
  for (const [pose, label] of POSES) {
    const img = imagens[pose];
    if (!img) continue;
    content.push({ type: "text", text: `Foto: ${label} (${pose})` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } });
  }
  const dados = {
    sexo: aluno.sexo === "f" ? "feminino" : aluno.sexo === "m" ? "masculino" : "não informado",
    data_nascimento: aluno.nascimento,
    altura_cm: aluno.altura,
    peso_kg: (medidas && medidas.peso) || aluno.peso,
    medidas_da_avaliacao: medidas || {},
    anamnese: anamnese || {},
  };
  content.push({ type: "text", text: "Dados do aluno e anamnese (JSON):\n" + JSON.stringify(dados, null, 2) });
  return content;
}
