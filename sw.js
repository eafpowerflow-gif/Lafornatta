// ════════════════════════════════════════
// LÀ FORNATTA Admin — Service Worker
// ════════════════════════════════════════
const CACHE_NAME = "fornatta-admin-v1";

const PRECACHE_URLS = [
  "./admin.html",
  "./manifest.json",
  "https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@300;400;500;600;700&display=swap",
];

// ── Instalar ──
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn("Pré-cache parcial:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Ativar: limpar caches antigos ──
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

// ── Fetch ──
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Supabase: sempre network (dados ao vivo)
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ error: "offline" }),
          { headers: { "Content-Type": "application/json" } }
        )
      )
    );
    return;
  }

  // Fontes Google: cache-first
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

  // admin.html e manifest: network-first com fallback ao cache
  if (
    event.request.mode === "navigate" ||
    url.pathname.endsWith("admin.html") ||
    url.pathname.endsWith("manifest.json")
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

  // Demais assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request)
    )
  );
});
