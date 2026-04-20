// FleetStat Service Worker — PWA support
// CACHE_VERSION zmienia się z każdym buildem — wymusza pobranie nowych plików
const CACHE_NAME = 'fleetstat-v3';

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

// Fetch — network first, cache only offline fallback
// NIE cachuj plików JS/CSS z hashami Vite (i tak mają unikalne nazwy)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  if (e.request.url.includes('firestore.googleapis.com')) return;
  if (e.request.url.includes('firebase')) return;
  if (e.request.url.includes('googleapis.com')) return;

  // Pliki z hashem Vite (np. index-C8o9MIg5.js) — zawsze sieć, bez cache
  if (e.request.url.match(/assets\/index-[a-zA-Z0-9_-]+\.(js|css)$/)) {
    return; // pozwól przeglądarce normalnie pobrać — bez cache SW
  }

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