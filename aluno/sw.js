/*
 * Service worker da área do aluno (PWA).
 * Arquivos do app: rede primeiro, cache como reserva (abre mesmo com
 * internet ruim na academia). Dados do Supabase nunca são cacheados.
 * Ao publicar mudanças grandes, aumente a versão abaixo.
 */
const CACHE = "ft-aluno-v1";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "../css/fonts.css", "../css/app.css",
  "../fonts/archivo-400.woff2", "../fonts/archivo-expanded-800.woff2",
  "../js/config.js", "../js/media.js",
  "../app/js/env.js", "../app/js/api.js", "../app/js/ui.js", "../app/js/aluno.js",
  "../assets/logo-fonseca.png", "../assets/icon-192.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return; // Supabase, YouTube etc. vão direto para a rede

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (sameOrigin || isFont)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
