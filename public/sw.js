// FleetStat Service Worker — PWA support
// v6 (2026-07-01): index.html → NETWORK FIRST (był stale-while-revalidate, serwował
// stary shell → stare hashe assetów → stary bundle po deployu). Od v6 shell jest
// zawsze świeży online, więc KOLEJNE deploye propagują się same — bez ręcznego
// "wyczyść dane witryny". Ten bump to jednorazowe przejście v5→v6 (wymusza instalację
// nowego SW u klientów z otwartymi kartami; dalej bump niepotrzebny do propagacji).
// v5 (2026-04-30): emergency bump po fixie array race condition (utrata frachtów 27-30.04).
const CACHE_NAME = 'fleetstat-v6';

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
//   2) index.html / nawigacje — NETWORK FIRST (świeży shell online → nowe hashe → nowy
//      bundle; offline → cache fallback). Kluczowe dla auto-propagacji deployów.
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

  // 2) index.html i navigations — NETWORK FIRST (świeży shell online; offline → cache)
  const isHtml = e.request.mode === 'navigate'
    || (e.request.headers.get('accept') || '').includes('text/html');
  if (isHtml) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('/index.html')))
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