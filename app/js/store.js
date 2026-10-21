/*
 * Camada de dados do app.
 * - Modo demonstração: tudo fica no próprio aparelho (IndexedDB). Serve para testar o app sem servidor.
 * - Modo Supabase: login por e-mail, banco Postgres com RLS e fotos em bucket privado.
 * As duas versões têm a mesma interface, então as telas não precisam saber qual está em uso.
 */
import { CONFIG, uid, nowISO } from "./util.js";
import { demoEvaluation } from "./demo-ai.js";

const SB = CONFIG.supabase || {};
export const MODE = SB.url && SB.anonKey ? "supabase" : "demo";
export const CONSENT_VERSION = "v1-2026-10";

/* =========================================================
   MODO DEMONSTRAÇÃO (IndexedDB)
   ========================================================= */
const DB_NAME = "fonseca-team-demo";
const STORES = ["profiles", "consentimentos", "anamneses", "avaliacoes", "fotos", "treinos", "meta"];
let dbp;
const db = () =>
  (dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => STORES.forEach((s) => req.result.objectStoreNames.contains(s) || req.result.createObjectStore(s, { keyPath: "id" }));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
const tx = async (store, mode, fn) => {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((r) => (out = r));
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  });
};
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idb = {
  get: (store, id) => tx(store, "readonly", (s) => reqP(s.get(id))),
  all: (store) => tx(store, "readonly", (s) => reqP(s.getAll())),
  put: (store, val) => tx(store, "readwrite", (s) => reqP(s.put(val))).then(() => val),
  del: (store, id) => tx(store, "readwrite", (s) => reqP(s.delete(id))),
};
const urlCache = new Map();

const demo = {
  mode: "demo",
  async init() {},
  async session() {
    const m = await idb.get("meta", "session");
    return m ? { userId: m.userId } : null;
  },
  onAuthChange() {},
  async signInDemo(role, nome) {
    const id = role === "profissional" ? "demo-profissional" : "demo-aluno";
    let p = await idb.get("profiles", id);
    if (!p) p = await idb.put("profiles", { id, role, nome: nome || (role === "profissional" ? CONFIG.coachName : "Aluno de teste"), criado_em: nowISO() });
    else if (nome && nome !== p.nome) p = await idb.put("profiles", { ...p, nome });
    await idb.put("meta", { id: "session", userId: id });
    return p;
  },
  async signOut() { await idb.del("meta", "session"); },
  getProfile: (id) => idb.get("profiles", id),
  async saveProfile(id, patch) {
    const p = (await idb.get("profiles", id)) || { id };
    return idb.put("profiles", { ...p, ...patch });
  },
  async listStudents() {
    return (await idb.all("profiles")).filter((p) => p.role === "aluno");
  },
  async getConsent(alunoId) {
    return (await idb.all("consentimentos")).find((c) => c.aluno_id === alunoId && c.versao === CONSENT_VERSION) || null;
  },
  acceptConsent: (alunoId, versao) => idb.put("consentimentos", { id: uid(), aluno_id: alunoId, versao, aceito_em: nowISO() }),
  getAnamnese: (alunoId) => idb.get("anamneses", alunoId),
  saveAnamnese: (alunoId, respostas, concluida) =>
    idb.put("anamneses", { id: alunoId, aluno_id: alunoId, respostas, concluida: !!concluida, atualizado_em: nowISO() }),
  async listAvaliacoes(alunoId) {
    return (await idb.all("avaliacoes")).filter((a) => !alunoId || a.aluno_id === alunoId).sort((a, b) => (a.criada_em < b.criada_em ? 1 : -1));
  },
  getAvaliacao: (id) => idb.get("avaliacoes", id),
  createAvaliacao: (alunoId, medidas) =>
    idb.put("avaliacoes", { id: uid(), aluno_id: alunoId, criada_em: nowISO(), status: "pendente", medidas: medidas || {}, resultado_ia: null, resultado_final: null }),
  async updateAvaliacao(id, patch) {
    const a = await idb.get("avaliacoes", id);
    return idb.put("avaliacoes", { ...a, ...patch });
  },
  async uploadFoto(avaliacaoId, alunoId, pose, blob) {
    const old = (await idb.all("fotos")).find((f) => f.avaliacao_id === avaliacaoId && f.pose === pose);
    if (old) await idb.del("fotos", old.id);
    return idb.put("fotos", { id: uid(), avaliacao_id: avaliacaoId, aluno_id: alunoId, pose, blob, criada_em: nowISO() });
  },
  async listFotos(avaliacaoId) {
    return (await idb.all("fotos")).filter((f) => f.avaliacao_id === avaliacaoId);
  },
  async fotoURL(f) {
    if (!urlCache.has(f.id)) urlCache.set(f.id, URL.createObjectURL(f.blob));
    return urlCache.get(f.id);
  },
  async getTreino(alunoId) { return idb.get("treinos", alunoId); },
  saveTreino: (alunoId, conteudo, liberado) =>
    idb.put("treinos", { id: alunoId, aluno_id: alunoId, conteudo, liberado: !!liberado, atualizado_em: nowISO() }),
  async requestAI(avaliacaoId) {
    const a = await idb.get("avaliacoes", avaliacaoId);
    await idb.put("avaliacoes", { ...a, status: "processando" });
    const [profile, anamnese] = await Promise.all([idb.get("profiles", a.aluno_id), idb.get("anamneses", a.aluno_id)]);
    await new Promise((r) => setTimeout(r, 1800));
    return idb.put("avaliacoes", { ...a, status: "rascunho", resultado_ia: demoEvaluation(profile, anamnese && anamnese.respostas, a.medidas) });
  },
  async exportData(alunoId) {
    const fotos = (await idb.all("fotos")).filter((f) => f.aluno_id === alunoId).map(({ blob, ...r }) => r);
    return {
      perfil: await idb.get("profiles", alunoId),
      consentimentos: (await idb.all("consentimentos")).filter((c) => c.aluno_id === alunoId),
      anamnese: await idb.get("anamneses", alunoId),
      avaliacoes: await demo.listAvaliacoes(alunoId),
      fotos,
      treino: await idb.get("treinos", alunoId),
    };
  },
  async deleteAccount(alunoId) {
    for (const store of ["fotos", "avaliacoes", "consentimentos"]) {
      for (const r of await idb.all(store)) if (r.aluno_id === alunoId) await idb.del(store, r.id);
    }
    await idb.del("anamneses", alunoId);
    await idb.del("treinos", alunoId);
    await idb.del("profiles", alunoId);
    await idb.del("meta", "session");
  },
};

/* =========================================================
   MODO SUPABASE
   ========================================================= */
let sb = null;
const must = ({ data, error }) => { if (error) throw error; return data; };
const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Falha ao carregar " + src));
    document.head.appendChild(s);
  });

const supa = {
  mode: "supabase",
  async init() {
    if (!window.supabase) await loadScript(new URL("./vendor/supabase.js", import.meta.url).href);
    sb = window.supabase.createClient(SB.url, SB.anonKey, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } });
  },
  async session() {
    const { data } = await sb.auth.getSession();
    return data.session ? { userId: data.session.user.id, email: data.session.user.email } : null;
  },
  onAuthChange(cb) { sb.auth.onAuthStateChange((_e, s) => cb(s ? { userId: s.user.id } : null)); },
  async signInEmail(email) {
    must(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }));
  },
  async verifyCode(email, token) { must(await sb.auth.verifyOtp({ email, token, type: "email" })); },
  async signOut() { await sb.auth.signOut(); },
  async getProfile(id) { return must(await sb.from("profiles").select("*").eq("id", id).maybeSingle()); },
  async saveProfile(id, patch) { return must(await sb.from("profiles").update(patch).eq("id", id).select().single()); },
  async listStudents() { return must(await sb.from("profiles").select("*").eq("role", "aluno").order("nome")); },
  async getConsent(alunoId) {
    return must(await sb.from("consentimentos").select("*").eq("aluno_id", alunoId).eq("versao", CONSENT_VERSION).maybeSingle());
  },
  async acceptConsent(alunoId, versao) { return must(await sb.from("consentimentos").insert({ aluno_id: alunoId, versao }).select().single()); },
  async getAnamnese(alunoId) { return must(await sb.from("anamneses").select("*").eq("aluno_id", alunoId).maybeSingle()); },
  async saveAnamnese(alunoId, respostas, concluida) {
    return must(await sb.from("anamneses").upsert({ aluno_id: alunoId, respostas, concluida: !!concluida, atualizado_em: nowISO() }).select().single());
  },
  async listAvaliacoes(alunoId) {
    let q = sb.from("avaliacoes").select("*").order("criada_em", { ascending: false });
    if (alunoId) q = q.eq("aluno_id", alunoId);
    return must(await q);
  },
  async getAvaliacao(id) {
    const a = must(await sb.from("avaliacoes").select("*").eq("id", id).single());
    // O rascunho da IA fica numa tabela que só o profissional consegue ler (RLS).
    const r = await sb.from("rascunhos_ia").select("resultado").eq("avaliacao_id", id).maybeSingle();
    return { ...a, resultado_ia: r.data ? r.data.resultado : null };
  },
  async createAvaliacao(alunoId, medidas) {
    return must(await sb.from("avaliacoes").insert({ aluno_id: alunoId, status: "pendente", medidas: medidas || {} }).select().single());
  },
  async updateAvaliacao(id, patch) {
    const { resultado_ia, ...rest } = patch;
    if (resultado_ia !== undefined) {
      must(await sb.from("rascunhos_ia").upsert({ avaliacao_id: id, resultado: resultado_ia, atualizado_em: nowISO() }));
    }
    if (Object.keys(rest).length) must(await sb.from("avaliacoes").update(rest).eq("id", id));
    return supa.getAvaliacao(id);
  },
  async uploadFoto(avaliacaoId, alunoId, pose, blob) {
    const caminho = `${alunoId}/${avaliacaoId}/${pose}.jpg`;
    must(await sb.storage.from("avaliacoes").upload(caminho, blob, { contentType: "image/jpeg", upsert: true }));
    await sb.from("fotos").delete().eq("avaliacao_id", avaliacaoId).eq("pose", pose);
    return must(await sb.from("fotos").insert({ avaliacao_id: avaliacaoId, aluno_id: alunoId, pose, caminho }).select().single());
  },
  async listFotos(avaliacaoId) { return must(await sb.from("fotos").select("*").eq("avaliacao_id", avaliacaoId)); },
  async fotoURL(f) {
    if (urlCache.has(f.id)) return urlCache.get(f.id);
    const { signedUrl } = must(await sb.storage.from("avaliacoes").createSignedUrl(f.caminho, 60 * 30));
    urlCache.set(f.id, signedUrl);
    setTimeout(() => urlCache.delete(f.id), 25 * 60 * 1000);
    return signedUrl;
  },
  async getTreino(alunoId) { return must(await sb.from("treinos").select("*").eq("aluno_id", alunoId).maybeSingle()); },
  async saveTreino(alunoId, conteudo, liberado) {
    return must(await sb.from("treinos").upsert({ aluno_id: alunoId, conteudo, liberado: !!liberado, atualizado_em: nowISO() }).select().single());
  },
  async requestAI(avaliacaoId) {
    const { data } = await sb.auth.getSession();
    const res = await fetch("/.netlify/functions/avaliacao-background", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
      body: JSON.stringify({ avaliacaoId }),
    });
    if (!res.ok && res.status !== 202) throw new Error("Não foi possível iniciar a análise (" + res.status + ").");
    // A análise roda em segundo plano; aguarda o resultado consultando o status.
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const a = await supa.getAvaliacao(avaliacaoId);
      if (a.status === "rascunho" || a.status === "erro") return a;
    }
    throw new Error("A análise está demorando mais que o normal. Atualize a página em alguns minutos.");
  },
  async exportData(alunoId) {
    return {
      perfil: await supa.getProfile(alunoId),
      consentimentos: must(await sb.from("consentimentos").select("*").eq("aluno_id", alunoId)),
      anamnese: await supa.getAnamnese(alunoId),
      avaliacoes: await supa.listAvaliacoes(alunoId),
      fotos: must(await sb.from("fotos").select("*").eq("aluno_id", alunoId)),
      treino: await supa.getTreino(alunoId),
    };
  },
  async deleteAccount() {
    const { data } = await sb.auth.getSession();
    const res = await fetch("/.netlify/functions/excluir-conta", { method: "POST", headers: { Authorization: "Bearer " + data.session.access_token } });
    if (!res.ok) throw new Error("Não foi possível excluir a conta agora. Tente novamente ou fale com o Maicon.");
    await sb.auth.signOut();
  },
};

export const store = MODE === "supabase" ? supa : demo;
