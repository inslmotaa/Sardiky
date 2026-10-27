// =====================================================================
//  Edge Function: invite-student
//  Envia o convite por e-mail para o aluno criar a senha.
//  Só o treinador (admin) pode chamar. Usa a service role, que fica
//  apenas no servidor do Supabase (nunca no site).
//
//  Deploy:  supabase functions deploy invite-student
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // 1) Quem está chamando precisa ser o treinador
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return json({ error: "Faça login novamente." }, 401);
  const { data: isAdmin } = await asCaller.rpc("is_admin");
  if (!isAdmin) return json({ error: "Apenas o treinador pode enviar convites." }, 403);

  // 2) Dados do convite
  let body: { email?: string; redirectTo?: string; fullName?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "E-mail inválido" }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // O aluno precisa estar cadastrado antes do convite
  const { data: student } = await admin.from("students").select("id, full_name, user_id").ilike("email", email).maybeSingle();
  if (!student) return json({ error: "Cadastre o aluno antes de enviar o convite." }, 404);

  // 3) Convite. Se o e-mail já tem conta, manda o link de redefinir senha.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: body.redirectTo,
    data: { full_name: body.fullName ?? student.full_name },
  });

  if (error) {
    const already = /already|registered|exists/i.test(error.message);
    if (!already) return json({ error: error.message }, 400);
    const { error: resetError } = await asCaller.auth.resetPasswordForEmail(email, { redirectTo: body.redirectTo });
    if (resetError) return json({ error: resetError.message }, 400);
    return json({ status: "reset_sent" });
  }

  // 4) Liga o usuário criado ao cadastro do aluno (o trigger também faz isso)
  if (data?.user && !student.user_id) {
    await admin.from("students").update({ user_id: data.user.id }).eq("id", student.id);
  }
  return json({ status: "invited" });
});
