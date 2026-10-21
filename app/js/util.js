/* Utilitários do app. */

export const $ = (s, ctx = document) => ctx.querySelector(s);
export const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

export const esc = (t) =>
  String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2));

export const nowISO = () => new Date().toISOString();

export const fmtDate = (iso, opts = { day: "2-digit", month: "short", year: "numeric" }) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", opts) : "–";

export const fmtNum = (v, d = 0) =>
  v == null || isNaN(v) ? "–" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const CONFIG = window.CONFIG || {};

export const waLink = (msg, phone = CONFIG.whatsapp) =>
  "https://wa.me/" + String(phone || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(msg || "");

export const POSES = [
  { id: "frente", label: "Frente" },
  { id: "costas", label: "Costas" },
  { id: "lado_direito", label: "Lado direito" },
  { id: "lado_esquerdo", label: "Lado esquerdo" },
];
export const poseLabel = (id) => (POSES.find((p) => p.id === id) || {}).label || id;

export const STATUS = {
  pendente: { label: "Fotos enviadas", tone: "neutral" },
  processando: { label: "Analisando…", tone: "neutral" },
  rascunho: { label: "Pronta para revisar", tone: "red" },
  aprovada: { label: "Liberada", tone: "ok" },
  erro: { label: "Erro na análise", tone: "red" },
};

/* Avisos rápidos */
let toastTimer;
export function toast(msg, tone = "") {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = "toast is-on " + (tone ? "toast--" + tone : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-on"), 3200);
}

/* Confirmação simples em modal */
export function confirmDialog({ title, text, ok = "Confirmar", cancel = "Cancelar", danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = `
      <div class="modal__box" role="alertdialog" aria-modal="true" aria-labelledby="mTitle">
        <h3 id="mTitle">${esc(title)}</h3>
        <p>${esc(text)}</p>
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" data-r="0">${esc(cancel)}</button>
          <button type="button" class="btn ${danger ? "btn--danger" : "btn--primary"}" data-r="1">${esc(ok)}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const done = (r) => { wrap.remove(); resolve(r); };
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("[data-r]");
      if (b) done(b.dataset.r === "1");
      else if (e.target === wrap) done(false);
    });
    wrap.addEventListener("keydown", (e) => { if (e.key === "Escape") done(false); });
    $("[data-r='1']", wrap).focus();
  });
}

export function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* Idade a partir da data de nascimento */
export const ageFrom = (birth) => {
  if (!birth) return null;
  const b = new Date(birth);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
};
