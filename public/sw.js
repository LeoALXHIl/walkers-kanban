// Service worker do Walkers (versão web/PWA). Objetivo: tornar o app instalável
// e dar um shell offline básico. NÃO intercepta Firebase/APIs externas — só
// assets estáticos do próprio domínio. Estratégia conservadora pra não quebrar
// a sincronização (dados ficam no Firestore/IndexedDB, não no cache do SW).

const CACHE = 'walkers-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Só GET same-origin. Firebase, Google e qualquer cross-origin passam direto.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Navegação (SPA): network-first com fallback pro shell quando offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || Response.error()))
    );
    return;
  }

  // Assets estáticos (JS/CSS/img com hash do Vite): cache-first, popula em background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    })
  );
});
