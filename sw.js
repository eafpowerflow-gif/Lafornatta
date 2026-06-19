// ════════════════════════════════════════
// LÀ FORNATTA Admin — Service Worker
// ════════════════════════════════════════
const CACHE_NAME = "fornatta-admin-v1";

// Recursos a cachear na instalação
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@300;400;500;600;700&display=swap",
];

// ── Instalar: pré-cachear shell da app ──
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn("Pré-cache parcial:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Ativar: remover caches antigos ──
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estratégia por tipo de recurso ──
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Requisições Supabase: sempre network (dados em tempo real)
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: "offline" }),
          { headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Fontes Google: cache-first com fallback
  if (url.hostname.includes("fonts.g")) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Shell da app (HTML, manifest): network-first com fallback ao cache
  if (
    event.request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Demais: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
