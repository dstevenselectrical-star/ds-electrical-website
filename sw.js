// DS Electrical — Service Worker
// Precaches core pages + shared assets, serves offline.
// Stale-while-revalidate for photos, network-first for HTML, cache-first for static assets.

const VERSION = 'ds-v1';
const PRECACHE = [
  '/',
  '/contact.html',
  '/eicr.html',
  '/commercial-electrical.html',
  '/ev-chargers.html',
  '/cctv.html',
  '/domestic.html',
  '/gallery.html',
  '/testimonials.html',
  '/24-hour-callouts.html',
  '/shared.css',
  '/book.css',
  '/analytics.js',
  '/chat-widget.js',
  '/logo-full.webp',
  '/logo-full.png',
  '/photos/hero-kitchen.webp',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept the Cloudflare chat worker or GA or external APIs
  if (url.origin !== location.origin) return;

  // HTML: network-first (always try fresh, fall back to cache for offline)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/contact.html')))
    );
    return;
  }

  // Photos: stale-while-revalidate (show cached, update in background)
  if (url.pathname.startsWith('/photos/') || request.destination === 'image') {
    event.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // CSS / JS / fonts: cache-first (they change rarely)
  if (['style', 'script', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        });
      })
    );
    return;
  }
});
