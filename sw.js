// Service worker de la PWA: sirve lo ya visto desde caché y lo actualiza en segundo plano.
// Las respuestas parciales (206, la música pide rangos) no se guardan: cache.put las rechaza.
// shortcut: sin lista de precarga, la primera visita necesita internet; precargar si se quiere jugar offline desde el primer día.
const CACHE = 'duskforge-v8';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase y demás van siempre a la red
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(e.request);
    const fresh = fetch(e.request).then((res) => { if (res.status === 200) cache.put(e.request, res.clone()); return res; });
    if (cached) { fresh.catch(() => {}); return cached; }
    return fresh;
  }));
});
