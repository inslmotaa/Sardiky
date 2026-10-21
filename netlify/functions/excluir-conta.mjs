/*
 * "Apagar minhas fotos e minha conta" (LGPD).
 * Apaga as fotos do bucket e o usuário; os registros do aluno saem junto (on delete cascade).
 */
import { createClient } from "@supabase/supabase-js";

export default async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data } = await admin.auth.getUser(token);
  const user = data && data.user;
  if (!user) return new Response("Não autorizado", { status: 401 });

  // Fotos: uma pasta por avaliação dentro da pasta do aluno
  const bucket = admin.storage.from("avaliacoes");
  const { data: pastas } = await bucket.list(user.id, { limit: 1000 });
  for (const pasta of pastas || []) {
    const { data: arquivos } = await bucket.list(`${user.id}/${pasta.name}`, { limit: 1000 });
    const caminhos = (arquivos || []).map((a) => `${user.id}/${pasta.name}/${a.name}`);
    if (caminhos.length) await bucket.remove(caminhos);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return new Response("Não foi possível excluir a conta", { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
};
