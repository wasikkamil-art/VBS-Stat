// FleetStat Service Worker — PWA support
// CACHE_VERSION zmienia się z każdym buildem — wymusza pobranie nowych plików
const CACHE_NAME = 'fleetstat-v4';

// Install — od razu przejmij kontrolę
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Activate — wyczyść WSZYSTKIE stare cache
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Strategie:
//   1) Hashed assets Vite (assets/*-HASH.js|css) — CACHE FIRST (immutable, hash w nazwie)
//   2) index.html — STALE-WHILE-REVALIDATE (szybko z cache, w tle pobiera świeży)
//   3) Firebase/Firestore/API — pomijamy (network only, brak SW)
//   4) Reszta (fonty, ikony) — network first, cache fallback
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('/api/')) return;
  if (url.includes('firestore.googleapis.com')) return;
  if (url.includes('firebase')) return;
  if (url.includes('googleapis.com')) return;
  if (url.includes('cloudfunctions.net')) return;

  // 1) Hashed assets — cache first (immutable)
  if (url.match(/\/assets\/[^/]+-[a-zA-Z0-9_-]+\.(js|css|woff2|woff|ttf)(\?.*)?$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 2) index.html i navigations — stale-while-revalidate
  const isHtml = e.request.mode === 'navigate'
    || (e.request.headers.get('accept') || '').includes('text/html');
  if (isHtml) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkPromise = fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || networkPromise;
      })
    );
    return;
  }

  // 3) Pozostałe — network first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});