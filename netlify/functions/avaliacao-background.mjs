/*
 * Avaliação com IA (Netlify Background Function: roda em segundo plano por até 15 minutos).
 * O app chama POST /.netlify/functions/avaliacao-background com o token do profissional logado.
 * Resultado: um RASCUNHO salvo em rascunhos_ia, que só o profissional vê, para revisar e aprovar.
 *
 * Variáveis de ambiente (Netlify → Site configuration → Environment variables):
 *   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { ESQUEMA_AVALIACAO, PROMPT_SISTEMA, montarConteudo } from "../lib/avaliacao.mjs";

const MODELO = "claude-opus-5-5";

export default async (req) => {
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  let avaliacaoId = null;
  const falhar = async (motivo) => {
    console.error("avaliacao:", avaliacaoId, motivo);
    if (avaliacaoId) await admin.from("avaliacoes").update({ status: "erro", erro: String(motivo).slice(0, 300) }).eq("id", avaliacaoId);
  };

  try {
    // 1) Só um profissional logado pode pedir a análise
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData && userData.user;
    if (!user) return console.warn("avaliacao: token inválido");
    const { data: quem } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (!quem || quem.role !== "profissional") return console.warn("avaliacao: usuário não é profissional");

    ({ avaliacaoId } = await req.json());
    if (!avaliacaoId) return;

    // 2) Dados da avaliação, do aluno, a anamnese e as 4 fotos
    const { data: av, error: avErr } = await admin.from("avaliacoes").select("*").eq("id", avaliacaoId).single();
    if (avErr || !av) return falhar("Avaliação não encontrada.");
    const [{ data: aluno }, { data: anam }, { data: fotos }] = await Promise.all([
      admin.from("profiles").select("*").eq("id", av.aluno_id).single(),
      admin.from("anamneses").select("*").eq("aluno_id", av.aluno_id).maybeSingle(),
      admin.from("fotos").select("*").eq("avaliacao_id", avaliacaoId),
    ]);
    if (!fotos || fotos.length < 4) return falhar("A avaliação precisa das 4 fotos.");
    if (!anam || !anam.concluida) return falhar("A anamnese ainda não foi concluída.");

    await admin.from("avaliacoes").update({ status: "processando", erro: null }).eq("id", avaliacaoId);

    const imagens = {};
    for (const f of fotos) {
      const { data: blob, error } = await admin.storage.from("avaliacoes").download(f.caminho);
      if (error) return falhar("Não foi possível ler a foto " + f.pose + ".");
      imagens[f.pose] = Buffer.from(await blob.arrayBuffer()).toString("base64");
    }

    // 3) Análise com o Claude, com resposta em JSON validado pelo esquema
    const anthropic = new Anthropic();
    const resposta = await anthropic.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // se o modelo recusar, a própria API tenta com o modelo indicado pela Anthropic
      output_config: { effort: "high", format: { type: "json_schema", schema: ESQUEMA_AVALIACAO } },
      system: PROMPT_SISTEMA,
      messages: [{ role: "user", content: montarConteudo({ imagens, aluno, anamnese: anam.respostas, medidas: av.medidas }) }],
    });

    if (resposta.stop_reason === "refusal") return falhar("A IA não conseguiu analisar estas fotos. Faça a avaliação manualmente.");
    if (resposta.stop_reason === "max_tokens") return falhar("A resposta da IA ficou incompleta. Tente de novo.");
    const texto = (resposta.content.find((b) => b.type === "text") || {}).text;
    if (!texto) return falhar("A IA não devolveu resultado.");
    const resultado = JSON.parse(texto);

    // 4) Salva o rascunho (só o profissional vê) e avisa que está pronto para revisar
    const { error: upErr } = await admin.from("rascunhos_ia").upsert({ avaliacao_id: avaliacaoId, resultado, atualizado_em: new Date().toISOString() });
    if (upErr) return falhar("Não foi possível salvar o rascunho.");
    await admin.from("avaliacoes").update({ status: "rascunho", erro: null }).eq("id", avaliacaoId);
    console.log("avaliacao: rascunho pronto", avaliacaoId, resposta.usage);
  } catch (err) {
    await falhar(err && err.message ? err.message : err);
  }
};
