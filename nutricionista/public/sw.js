/*
 * Service worker do app do paciente.
 * - Plano do dia disponível sem internet: as telas do paciente (Hoje, Plano, Diário, Progresso, Mais)
 *   são buscadas na rede e a última versão fica guardada neste aparelho.
 * - Nada do painel do nutricionista é guardado.
 * - Ao sair da conta, as telas guardadas são apagadas.
 * - Recebe as notificações push (lembretes de refeição, água, plano novo, mensagens).
 */
const VERSION = 'v1'
const PAGES = `paciente-paginas-${VERSION}`
const ASSETS = `estaticos-${VERSION}`
const OFFLINE = '/offline.html'
const PRECACHE = [OFFLINE, '/icons/icon-192.png', '/icons/badge-96.png', '/icon.svg']
const PATIENT_PAGES = /^\/paciente(\/(plano(\/(?!pdf)[\w-]+)?|diario|evolucao|mais|calculadoras))?\/?$/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(ASSETS)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isStatic(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/icon.svg'
}

async function cacheFirst(req) {
  const hit = await caches.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) (await caches.open(ASSETS)).put(req, res.clone())
  return res
}

/** Rede primeiro; sem internet, a última versão guardada; sem nada guardado, a página “sem conexão”. */
async function patientPage(req) {
  const cache = await caches.open(PAGES)
  try {
    const res = await fetch(req)
    // Só guarda a própria tela (não um redirecionamento para o login).
    if (res.ok && !res.redirected && res.type === 'basic') await cache.put(req, res.clone())
    return res
  } catch {
    return (await cache.match(req, { ignoreSearch: false })) || (await cache.match(new URL(req.url).pathname)) || (await caches.match(OFFLINE))
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (isStatic(url)) {
    event.respondWith(cacheFirst(req))
    return
  }
  if (req.mode === 'navigate') {
    if (PATIENT_PAGES.test(url.pathname)) event.respondWith(patientPage(req))
    else event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)))
  }
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'logout') event.waitUntil(caches.delete(PAGES))
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: event.data ? event.data.text() : 'Nova notificação' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nova notificação', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || '/' },
      lang: 'pt-BR',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
          c.navigate(target).catch(() => undefined)
          return c.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
