/* Service worker: caches the app shell, TMDB posters and TMDB API responses
   so the app loads instantly and works offline (posters stay cached). */
const VERSION = 'montvtime-v63';
const SHELL = 'shell-' + VERSION;
const IMG = 'img-' + VERSION;
const API = 'api-' + VERSION;

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './seed.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => ![SHELL, IMG, API].includes(k)).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetchP = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || fetchP;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // never cache the local persistence API
  if (url.pathname.startsWith('/api/')) return;

  // TMDB poster / still images -> cache-first (kept for offline)
  if (url.hostname === 'image.tmdb.org') {
    e.respondWith(cacheFirst(req, IMG));
    return;
  }
  // TMDB metadata API -> stale-while-revalidate
  if (url.hostname === 'api.themoviedb.org') {
    e.respondWith(staleWhileRevalidate(req, API));
    return;
  }
  // same-origin app assets -> stale-while-revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(staleWhileRevalidate(req, SHELL));
  }
});
