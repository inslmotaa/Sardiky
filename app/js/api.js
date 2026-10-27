/*
 * Camada de dados da área logada.
 * Com o Supabase configurado (app/js/env.js) usa o banco de verdade;
 * sem configuração, usa o MODO DEMONSTRAÇÃO (dados no navegador).
 * As duas implementações têm exatamente as mesmas funções.
 */
const env = window.FT_ENV || {};
const configured = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
const forceDemo = new URLSearchParams(location.search).has("demo");

// Lê o tipo do link de e-mail (convite / redefinir senha) antes do Supabase limpar a URL
const hashParams = new URLSearchParams(location.hash.slice(1));
const authIntent = hashParams.get("type") || new URLSearchParams(location.search).get("type") || null;
const authError = hashParams.get("error_description") || null;

const WORKOUT_FIELDS = ["student_id", "name", "focus", "notes", "weekdays", "position"];
const ITEM_FIELDS = ["exercise_id", "position", "sets", "reps", "load", "rest_seconds", "method", "notes"];
const STUDENT_FIELDS = ["full_name", "email", "whatsapp", "birth_date", "goal", "plan", "start_date", "end_date", "status", "notes", "consent_at"];
const PLAN_FIELDS = ["student_id", "title", "guidelines", "nutritionist_name", "nutritionist_crn", "active"];
const ASSESS_FIELDS = ["student_id", "date", "weight", "body_fat", "chest", "waist", "hip", "arm", "thigh", "calf", "notes", "photos"];

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k] === "" ? null : o[k]]));
const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0);
const byTime = (a, b) => String(a.time || "99").localeCompare(String(b.time || "99")) || byPos(a, b);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2));
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Reduz fotos antes de enviar (celular gera arquivos enormes)
async function shrinkImage(file, max = 1400) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.84));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/* =====================================================================
   SUPABASE
   ===================================================================== */
async function supabaseApi() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" }
  });

  const must = async (q) => {
    const { data, error } = await q;
    if (error) throw new Error(translate(error.message));
    return data;
  };

  const api = {
    mode: "supabase",
    authIntent,
    authError,

    async session() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return null;
      const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", session.user.id).maybeSingle();
      return { user: { id: session.user.id, email: session.user.email }, role: prof?.role || "student", name: prof?.full_name || "" };
    },
    onAuth(cb) { sb.auth.onAuthStateChange((event) => cb(event)); },
    async signIn(email, password) { await must(sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })); },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) {
      await must(sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: location.href.split("#")[0].split("?")[0] }));
    },
    async updatePassword(password) { await must(sb.auth.updateUser({ password })); },
    async acceptTerms() { await must(sb.rpc("accept_terms")); },

    /* ---------- Alunos ---------- */
    async listStudents() { return must(sb.from("students").select("*").order("full_name")); },
    async getStudent(id) { return must(sb.from("students").select("*").eq("id", id).single()); },
    async myStudent() {
      const { data: { user } } = await sb.auth.getUser();
      return must(sb.from("students").select("*").eq("user_id", user.id).maybeSingle());
    },
    async saveStudent(s) {
      const row = pick(s, STUDENT_FIELDS);
      if (row.email) row.email = row.email.trim().toLowerCase();
      return s.id
        ? must(sb.from("students").update(row).eq("id", s.id).select().single())
        : must(sb.from("students").insert(row).select().single());
    },
    async deleteStudent(id) { await must(sb.from("students").delete().eq("id", id)); },
    async inviteStudent(student) {
      const { data, error } = await sb.functions.invoke("invite-student", {
        body: { email: student.email, fullName: student.full_name, redirectTo: new URL("../aluno/", location.href).href }
      });
      if (error) {
        let msg = error.message;
        try { const b = await error.context.json(); msg = b.error || msg; } catch { /* sem corpo */ }
        throw new Error(msg);
      }
      return data?.status || "invited";
    },

    /* ---------- Exercícios ---------- */
    async listExercises() { return must(sb.from("exercises").select("*").order("name")); },
    async saveExercise(e) {
      const row = pick(e, ["name", "muscle_group", "equipment", "video_url", "media_url", "tips"]);
      return e.id
        ? must(sb.from("exercises").update(row).eq("id", e.id).select().single())
        : must(sb.from("exercises").insert(row).select().single());
    },
    async deleteExercise(id) { await must(sb.from("exercises").delete().eq("id", id)); },
    async uploadExerciseMedia(file) {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `${uid()}.${ext}`;
      await must(sb.storage.from("exercises").upload(path, file, { contentType: file.type, upsert: false }));
      return sb.storage.from("exercises").getPublicUrl(path).data.publicUrl;
    },

    /* ---------- Treinos ---------- */
    async listWorkouts(studentId) {
      const rows = await must(sb.from("workouts").select("*, items:workout_items(*, exercise:exercises(*))").eq("student_id", studentId).order("position"));
      rows.forEach((w) => w.items.sort(byPos));
      return rows;
    },
    async saveWorkout(w, items) {
      const row = pick(w, WORKOUT_FIELDS);
      let id = w.id;
      if (id) await must(sb.from("workouts").update(row).eq("id", id));
      else id = (await must(sb.from("workouts").insert(row).select("id").single())).id;

      // atualiza sem apagar os itens que continuam (preserva o histórico do aluno)
      const existing = await must(sb.from("workout_items").select("id").eq("workout_id", id));
      const keep = new Set(items.filter((i) => i.id).map((i) => i.id));
      const removed = existing.map((e) => e.id).filter((x) => !keep.has(x));
      if (removed.length) await must(sb.from("workout_items").delete().in("id", removed));
      const rows = items.map((it, i) => ({ ...pick(it, ITEM_FIELDS), id: it.id, workout_id: id, position: i }));
      const updates = rows.filter((r) => r.id);
      const inserts = rows.filter((r) => !r.id).map(({ id: _x, ...r }) => r);
      if (updates.length) await must(sb.from("workout_items").upsert(updates));
      if (inserts.length) await must(sb.from("workout_items").insert(inserts));
      return id;
    },
    async deleteWorkout(id) { await must(sb.from("workouts").delete().eq("id", id)); },

    /* ---------- Registro do treino (aluno) ---------- */
    async getLogs(studentId, date) {
      return must(sb.from("workout_logs").select("*").eq("student_id", studentId).eq("performed_on", date));
    },
    async saveLog(studentId, itemId, date, patch) {
      return must(sb.from("workout_logs")
        .upsert({ student_id: studentId, item_id: itemId, performed_on: date, ...patch }, { onConflict: "item_id,performed_on" })
        .select().single());
    },
    async lastDoneWorkoutId(studentId) {
      const rows = await must(sb.from("workout_logs").select("performed_on, item:workout_items(workout_id)")
        .eq("student_id", studentId).eq("done", true).lt("performed_on", today())
        .order("performed_on", { ascending: false }).limit(1));
      return rows[0]?.item?.workout_id || null;
    },

    /* ---------- Nutrição ---------- */
    async getNutrition(studentId) {
      const plan = await must(sb.from("nutrition_plans").select("*, meals(*)").eq("student_id", studentId).eq("active", true)
        .order("created_at", { ascending: false }).limit(1).maybeSingle());
      if (plan) plan.meals = plan.meals.map((m) => ({ ...m, time: m.time ? m.time.slice(0, 5) : "" })).sort(byTime);
      return plan;
    },
    async saveNutrition(plan, meals) {
      const row = { ...pick(plan, PLAN_FIELDS), active: true };
      let id = plan.id;
      if (id) await must(sb.from("nutrition_plans").update(row).eq("id", id));
      else id = (await must(sb.from("nutrition_plans").insert(row).select("id").single())).id;
      await must(sb.from("meals").delete().eq("plan_id", id));
      if (meals.length) {
        await must(sb.from("meals").insert(meals.map((m, i) => ({
          plan_id: id, position: i, time: m.time || null, name: m.name, notes: m.notes || null, items: m.items || []
        }))));
      }
      return id;
    },

    /* ---------- Avaliações ---------- */
    async listAssessments(studentId) {
      const rows = await must(sb.from("assessments").select("*").eq("student_id", studentId).order("date"));
      const paths = rows.flatMap((r) => r.photos || []);
      const urls = {};
      if (paths.length) {
        const signed = await must(sb.storage.from("progress").createSignedUrls(paths, 60 * 60));
        signed.forEach((s) => { if (s.signedUrl) urls[s.path] = s.signedUrl; });
      }
      rows.forEach((r) => (r.photoUrls = (r.photos || []).map((p) => urls[p]).filter(Boolean)));
      return rows;
    },
    async saveAssessment(a, files = []) {
      const photos = [...(a.photos || [])];
      for (const f of files) {
        const img = await shrinkImage(f);
        const path = `${a.student_id}/${a.date}-${uid().slice(0, 8)}.jpg`;
        await must(sb.storage.from("progress").upload(path, img, { contentType: img.type || "image/jpeg" }));
        photos.push(path);
      }
      const row = { ...pick(a, ASSESS_FIELDS), photos };
      return a.id
        ? must(sb.from("assessments").update(row).eq("id", a.id).select().single())
        : must(sb.from("assessments").insert(row).select().single());
    },
    async deleteAssessment(a) {
      if (a.photos?.length) await sb.storage.from("progress").remove(a.photos);
      await must(sb.from("assessments").delete().eq("id", a.id));
    }
  };
  api.duplicateWorkouts = (from, to, ids) => duplicate(api, from, to, ids);
  return api;
}

async function duplicate(api, fromId, toId, ids) {
  const [src, dst] = await Promise.all([api.listWorkouts(fromId), api.listWorkouts(toId)]);
  const chosen = src.filter((w) => !ids || ids.includes(w.id));
  let pos = dst.length;
  for (const w of chosen) {
    await api.saveWorkout(
      { ...w, id: undefined, student_id: toId, position: pos++ },
      w.items.map(({ id: _i, workout_id: _w, exercise: _e, ...it }) => it)
    );
  }
  return chosen.length;
}

function translate(msg) {
  const m = String(msg || "");
  if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail pelo link que enviamos.";
  if (/duplicate key.*email/i.test(m)) return "Já existe um aluno com este e-mail.";
  if (/Password should be at least/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/rate limit/i.test(m)) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (/row-level security/i.test(m)) return "Sem permissão para esta ação.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão. Verifique a internet.";
  return m;
}

/* =====================================================================
   MODO DEMONSTRAÇÃO (dados no navegador)
   ===================================================================== */
const DEMO_KEY = "ft-demo-v1";
const SESSION_KEY = "ft-demo-session";

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function seed() {
  const ex = (name, muscle_group, equipment, tips) => ({ id: uid(), name, muscle_group, equipment, video_url: "", media_url: "", tips });
  const E = [
    ex("Supino reto com barra", "Peito", "Barra", "Escápulas encaixadas, pés firmes no chão. Desça a barra até a linha do peito e empurre sem tirar o quadril do banco."),
    ex("Supino inclinado com halteres", "Peito", "Halter", "Banco entre 30 e 45 graus. Cotovelos levemente para dentro, controle a descida."),
    ex("Desenvolvimento com halteres", "Ombros", "Halter", "Tronco firme, sem arquear a lombar. Suba até quase estender os cotovelos."),
    ex("Elevação lateral", "Ombros", "Halter", "Leve flexão dos cotovelos. Suba até a linha dos ombros, sem balançar o corpo."),
    ex("Tríceps na polia com corda", "Tríceps", "Polia", "Cotovelos colados ao corpo. Abra a corda no final do movimento."),
    ex("Puxada frontal", "Costas", "Polia", "Puxe a barra até a parte de cima do peito, levando os cotovelos para baixo."),
    ex("Remada curvada com barra", "Costas", "Barra", "Tronco a cerca de 45 graus, coluna neutra. Puxe a barra em direção ao umbigo."),
    ex("Rosca direta", "Bíceps", "Barra", "Cotovelos parados ao lado do corpo. Sem jogar o tronco para trás."),
    ex("Agachamento livre", "Quadríceps", "Barra", "Pés na largura dos ombros, joelhos acompanham a ponta dos pés. Desça mantendo o peito aberto."),
    ex("Leg press 45°", "Quadríceps", "Máquina", "Lombar sempre apoiada. Não trave os joelhos no final."),
    ex("Stiff com halteres", "Posterior", "Halter", "Joelhos levemente flexionados, quadril vai para trás. Sinta o alongamento do posterior."),
    ex("Elevação pélvica", "Glúteos", "Barra", "Queixo para dentro, suba até alinhar tronco e coxas. Segure 1 segundo no topo."),
    ex("Panturrilha em pé", "Panturrilha", "Máquina", "Amplitude completa: desça bem e suba na ponta dos pés."),
    ex("Prancha", "Abdômen", "Peso corporal", "Corpo alinhado da cabeça aos pés. Contraia abdômen e glúteos.")
  ];
  const me = { id: uid(), user_id: "demo-student", full_name: "Aluno Demonstração", email: "aluno@demo.com", whatsapp: "41999990000", birth_date: "1995-04-12", goal: "Hipertrofia", plan: "Trimestral", start_date: addDays(-50), end_date: addDays(40), status: "active", notes: "Dor leve no ombro direito em 2024. Evitar desenvolvimento atrás da nuca.", consent_at: new Date().toISOString(), terms_accepted_at: null };
  const students = [
    me,
    { id: uid(), user_id: null, full_name: "Carla Souza (exemplo)", email: "carla@exemplo.com", whatsapp: "41988880000", birth_date: "1990-09-03", goal: "Emagrecimento", plan: "Mensal", start_date: addDays(-26), end_date: addDays(4), status: "active", notes: "", consent_at: new Date().toISOString(), terms_accepted_at: null },
    { id: uid(), user_id: null, full_name: "Rafael Lima (exemplo)", email: "rafael@exemplo.com", whatsapp: "", birth_date: null, goal: "Performance", plan: "Semestral", start_date: addDays(-200), end_date: addDays(-18), status: "inactive", notes: "", consent_at: new Date().toISOString(), terms_accepted_at: null }
  ];
  const item = (wid, e, position, sets, reps, load, rest_seconds, method = "", notes = "") => ({ id: uid(), workout_id: wid, exercise_id: e.id, position, sets, reps, load, rest_seconds, method, notes });
  const wA = { id: uid(), student_id: me.id, name: "Treino A", focus: "Peito, ombros e tríceps", notes: "Aquecimento: 2 séries leves no primeiro exercício.", weekdays: [1, 4], position: 0 };
  const wB = { id: uid(), student_id: me.id, name: "Treino B", focus: "Costas e bíceps", notes: "", weekdays: [2, 5], position: 1 };
  const wC = { id: uid(), student_id: me.id, name: "Treino C", focus: "Pernas e glúteos", notes: "Beba água entre as séries.", weekdays: [3, 6], position: 2 };
  const items = [
    item(wA.id, E[0], 0, "4", "8-10", "40 kg", 90),
    item(wA.id, E[1], 1, "3", "10-12", "18 kg", 75),
    item(wA.id, E[2], 2, "3", "10", "14 kg", 75),
    item(wA.id, E[3], 3, "3", "12-15", "8 kg", 60, "Drop-set", "Drop na última série: reduza 30% e vá até a falha."),
    item(wA.id, E[4], 4, "3", "12", "25 kg", 60),
    item(wB.id, E[5], 0, "4", "10", "50 kg", 90),
    item(wB.id, E[6], 1, "4", "8-10", "40 kg", 90),
    item(wB.id, E[7], 2, "3", "10-12", "20 kg", 60, "Bi-set", "Junto com a prancha, sem descanso entre os dois."),
    item(wB.id, E[13], 3, "3", "40 s", "—", 60, "Bi-set"),
    item(wC.id, E[8], 0, "4", "8", "60 kg", 120),
    item(wC.id, E[9], 1, "4", "12", "160 kg", 90),
    item(wC.id, E[10], 2, "3", "10", "20 kg", 75),
    item(wC.id, E[11], 3, "3", "12", "60 kg", 75),
    item(wC.id, E[12], 4, "4", "15", "40 kg", 45)
  ];
  const plan = { id: uid(), student_id: me.id, title: "Plano alimentar · Hipertrofia", guidelines: "Beba de 3 a 3,5 litros de água por dia. Mantenha os horários com no máximo 1 hora de diferença. Exemplo de demonstração: o plano real é feito pelo nutricionista.", nutritionist_name: "Nome do nutricionista (exemplo)", nutritionist_crn: "CRN-0 00000", active: true };
  const meal = (time, name, position, list) => ({ id: uid(), plan_id: plan.id, time, name, position, notes: "", items: list.map(([food, quantity, substitutions]) => ({ food, quantity, substitutions })) });
  const meals = [
    meal("07:00", "Café da manhã", 0, [["Ovos mexidos", "3 unidades", "2 fatias de queijo branco"], ["Pão integral", "2 fatias", "4 colheres de aveia"], ["Banana", "1 unidade", "1 maçã"]]),
    meal("10:00", "Lanche da manhã", 1, [["Iogurte natural", "170 g", "Leite desnatado 200 ml"], ["Granola sem açúcar", "30 g", ""]]),
    meal("12:30", "Almoço", 2, [["Arroz", "150 g", "Batata-doce 200 g"], ["Feijão", "1 concha", "Lentilha 1 concha"], ["Peito de frango", "150 g", "Patinho moído 150 g"], ["Salada à vontade", "—", ""]]),
    meal("16:00", "Pré-treino", 3, [["Tapioca", "1 média", "2 fatias de pão integral"], ["Frango desfiado", "80 g", "Atum 1 lata"]]),
    meal("20:30", "Jantar", 4, [["Batata-doce", "200 g", "Arroz 150 g"], ["Tilápia", "150 g", "Peito de frango 150 g"], ["Legumes cozidos", "à vontade", ""]])
  ];
  const ass = (days, weight, body_fat, waist, hip, arm, thigh, chest, calf, photoUrls = []) => ({ id: uid(), student_id: me.id, date: addDays(days), weight, body_fat, waist, hip, arm, thigh, chest, calf, notes: "", photos: [], photoUrls });
  const assessments = [
    ass(-49, 84.2, 22.0, 92, 104, 36.0, 60, 102, 38, ["../media/resultados/exemplo-1-antes.svg"]),
    ass(-35, 83.1, 21.1, 90.5, 103, 36.2, 60.5, 102.5, 38),
    ass(-21, 82.0, 20.0, 89, 102.5, 36.6, 61, 103, 38.2),
    ass(-7, 80.9, 19.2, 87.5, 102, 37.0, 61.5, 103.5, 38.4, ["../media/resultados/exemplo-1-depois.svg"])
  ];
  return { students, exercises: E, workouts: [wA, wB, wC], workout_items: items, workout_logs: [], nutrition_plans: [plan], meals, assessments };
}

function demoApi() {
  let db;
  try { db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { db = null; }
  if (!db) db = seed();
  const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch { /* cheio/bloqueado */ } };
  save();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const getSession = () => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } };
  const wait = () => new Promise((r) => setTimeout(r, 120));
  const listeners = [];

  const withItems = (w) => ({
    ...w,
    items: db.workout_items.filter((i) => i.workout_id === w.id).sort(byPos)
      .map((i) => ({ ...i, exercise: db.exercises.find((e) => e.id === i.exercise_id) || null }))
  });

  const api = {
    mode: "demo",
    authIntent: null,
    authError: null,
    async session() {
      const s = getSession();
      if (!s) return null;
      return s.role === "admin"
        ? { user: { id: "demo-admin", email: "treinador@demo.com" }, role: "admin", name: "Maicon Fonseca" }
        : { user: { id: "demo-student", email: "aluno@demo.com" }, role: "student", name: "Aluno Demonstração" };
    },
    onAuth(cb) { listeners.push(cb); },
    async signIn(email) {
      await wait();
      const role = /treinador|admin|maicon/i.test(email) ? "admin" : "student";
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role }));
      listeners.forEach((cb) => cb("SIGNED_IN"));
    },
    async demoLogin(role) { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role })); },
    async signOut() { sessionStorage.removeItem(SESSION_KEY); },
    async resetPassword() { await wait(); },
    async updatePassword() { await wait(); },
    async acceptTerms() { const me = db.students.find((s) => s.user_id === "demo-student"); if (me && !me.terms_accepted_at) { me.terms_accepted_at = new Date().toISOString(); save(); } },
    resetDemo() { localStorage.removeItem(DEMO_KEY); },

    async listStudents() { await wait(); return clone(db.students).sort((a, b) => a.full_name.localeCompare(b.full_name)); },
    async getStudent(id) { return clone(db.students.find((s) => s.id === id)); },
    async myStudent() { return clone(db.students.find((s) => s.user_id === "demo-student") || null); },
    async saveStudent(s) {
      await wait();
      const row = pick(s, STUDENT_FIELDS);
      if (row.email) row.email = row.email.trim().toLowerCase();
      if (db.students.some((x) => x.email === row.email && x.id !== s.id)) throw new Error("Já existe um aluno com este e-mail.");
      if (s.id) { Object.assign(db.students.find((x) => x.id === s.id), row); }
      else db.students.push({ id: uid(), user_id: null, terms_accepted_at: null, ...row });
      save();
      return clone(db.students.find((x) => (s.id ? x.id === s.id : x.email === row.email)));
    },
    async deleteStudent(id) {
      const wids = db.workouts.filter((w) => w.student_id === id).map((w) => w.id);
      db.workout_items = db.workout_items.filter((i) => !wids.includes(i.workout_id));
      db.workouts = db.workouts.filter((w) => w.student_id !== id);
      db.assessments = db.assessments.filter((a) => a.student_id !== id);
      db.nutrition_plans = db.nutrition_plans.filter((p) => p.student_id !== id);
      db.students = db.students.filter((s) => s.id !== id);
      save();
    },
    async inviteStudent() { await wait(); return "demo"; },

    async listExercises() { return clone(db.exercises).sort((a, b) => a.name.localeCompare(b.name)); },
    async saveExercise(e) {
      const row = pick(e, ["name", "muscle_group", "equipment", "video_url", "media_url", "tips"]);
      if (e.id) Object.assign(db.exercises.find((x) => x.id === e.id), row);
      else db.exercises.push({ id: uid(), ...row });
      save();
    },
    async deleteExercise(id) {
      db.exercises = db.exercises.filter((x) => x.id !== id);
      db.workout_items.forEach((i) => { if (i.exercise_id === id) i.exercise_id = null; });
      save();
    },
    async uploadExerciseMedia(file) {
      if (file.size > 1.5e6) throw new Error("Na demonstração, envie arquivos de até 1,5 MB.");
      return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
    },

    async listWorkouts(studentId) { return clone(db.workouts.filter((w) => w.student_id === studentId).sort(byPos).map(withItems)); },
    async saveWorkout(w, items) {
      const row = pick(w, WORKOUT_FIELDS);
      let id = w.id;
      if (id) Object.assign(db.workouts.find((x) => x.id === id), row);
      else { id = uid(); db.workouts.push({ id, ...row }); }
      const keep = new Set(items.filter((i) => i.id).map((i) => i.id));
      db.workout_items = db.workout_items.filter((i) => i.workout_id !== id || keep.has(i.id));
      items.forEach((it, i) => {
        const r = { ...pick(it, ITEM_FIELDS), workout_id: id, position: i };
        const cur = it.id && db.workout_items.find((x) => x.id === it.id);
        if (cur) Object.assign(cur, r); else db.workout_items.push({ id: uid(), ...r });
      });
      save();
      return id;
    },
    async deleteWorkout(id) {
      db.workout_items = db.workout_items.filter((i) => i.workout_id !== id);
      db.workouts = db.workouts.filter((w) => w.id !== id);
      save();
    },

    async getLogs(studentId, date) { return clone(db.workout_logs.filter((l) => l.student_id === studentId && l.performed_on === date)); },
    async saveLog(studentId, itemId, date, patch) {
      let l = db.workout_logs.find((x) => x.item_id === itemId && x.performed_on === date);
      if (!l) { l = { id: uid(), student_id: studentId, item_id: itemId, performed_on: date, done: false, load_used: null }; db.workout_logs.push(l); }
      Object.assign(l, patch);
      save();
      return clone(l);
    },
    async lastDoneWorkoutId(studentId) {
      const l = db.workout_logs.filter((x) => x.student_id === studentId && x.done && x.performed_on < today())
        .sort((a, b) => b.performed_on.localeCompare(a.performed_on))[0];
      return l ? db.workout_items.find((i) => i.id === l.item_id)?.workout_id || null : null;
    },

    async getNutrition(studentId) {
      const p = db.nutrition_plans.find((x) => x.student_id === studentId && x.active);
      return p ? clone({ ...p, meals: db.meals.filter((m) => m.plan_id === p.id).sort(byTime) }) : null;
    },
    async saveNutrition(plan, meals) {
      const row = { ...pick(plan, PLAN_FIELDS), active: true };
      let id = plan.id;
      if (id) Object.assign(db.nutrition_plans.find((x) => x.id === id), row);
      else { id = uid(); db.nutrition_plans.push({ id, ...row }); }
      db.meals = db.meals.filter((m) => m.plan_id !== id)
        .concat(meals.map((m, i) => ({ id: uid(), plan_id: id, position: i, time: m.time, name: m.name, notes: m.notes || "", items: m.items || [] })));
      save();
      return id;
    },

    async listAssessments(studentId) {
      return clone(db.assessments.filter((a) => a.student_id === studentId).sort((a, b) => a.date.localeCompare(b.date)))
        .map((a) => ({ ...a, photoUrls: [...(a.photoUrls || []), ...(a.photos || [])] }));
    },
    async saveAssessment(a, files = []) {
      const photos = [...(a.photos || [])];
      for (const f of files) {
        const img = await shrinkImage(f, 700);
        photos.push(await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(img); }));
      }
      const row = { ...pick(a, ASSESS_FIELDS), photos };
      if (a.id) Object.assign(db.assessments.find((x) => x.id === a.id), row);
      else db.assessments.push({ id: uid(), photoUrls: [], ...row });
      save();
    },
    async deleteAssessment(a) { db.assessments = db.assessments.filter((x) => x.id !== a.id); save(); }
  };
  api.duplicateWorkouts = (from, to, ids) => duplicate(api, from, to, ids);
  return api;
}

export async function loadApi() {
  if (configured && !forceDemo) return supabaseApi();
  return demoApi();
}
export const isConfigured = configured;
