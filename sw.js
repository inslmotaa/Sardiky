/*
 * Service worker da Fonseca Team: guarda telas e arquivos estáticos para o app abrir rápido.
 * Fotos, dados do aluno, chamadas ao Supabase e às funções NÃO ficam em cache.
 */
const VERSION = "ft-v1";
const SHELL = [
  "/app/", "/app/index.html", "/app/app.css",
  "/app/js/app.js", "/app/js/util.js", "/app/js/store.js", "/app/js/demo-ai.js", "/app/js/image.js", "/app/js/camera.js",
  "/app/js/share.js", "/app/js/anamnese.js", "/app/js/chart.js", "/app/js/review.js", "/app/js/views-aluno.js", "/app/js/views-pro.js",
  "/js/config.js", "/assets/logo-fonseca.png", "/assets/logo-mark.png", "/assets/favicon.png", "/assets/icon-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;           // Supabase, fontes, WhatsApp: direto na rede
  if (url.pathname.startsWith("/.netlify/") || url.pathname.startsWith("/assets/videos/")) return;
  const isShell = req.mode === "navigate" || /\.(js|css|html|webmanifest)$/.test(url.pathname);
  if (isShell) {
    // Rede primeiro (sempre a versão mais nova); sem internet, usa a cópia guardada
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match("/app/"))));
  } else if (/\.(png|jpg|jpeg|svg|webp)$/.test(url.pathname) && url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })));
  }
});
