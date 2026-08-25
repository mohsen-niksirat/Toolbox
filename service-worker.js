// ═══════════════════════════════════════════════
// Toolbox Pro PWA — Service Worker v1.2.0
// ═══════════════════════════════════════════════

const CACHE_NAME = 'toolbox-pro-v1.2.0';
const RUNTIME_CACHE = 'toolbox-runtime-v3';
const OFFLINE_RESPONSE = new Response('آفلاین هستید 😕', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

// فایل‌هایی که موقع نصب کش میشن
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png'
];

// ─── نصب (Install) ───
self.addEventListener('install', (event) => {
  console.log('[SW] 📦 Installing v1.2.0...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] ✅ Pre-caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// ─── فعال‌سازی (Activate) ───
self.addEventListener('activate', (event) => {
  console.log('[SW] 🔄 Activating v1.2.0...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] 🗑️ Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Notify all clients that a new version is available
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: '1.2.0' });
        });
        return self.clients.claim();
      });
    })
  );
});

// ─── پیام‌ها (Messages) ───
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── رهگیری درخواست‌ها (Fetch) ───
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // درخواست‌های خارجی (CDN، API) → Network First
  if (url.origin !== location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }

  // فایل‌های محلی → Cache First
  event.respondWith(cacheFirst(request));
});

// ─── Cache First ───
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    return OFFLINE_RESPONSE.clone();
  }
}

// ─── Network First ───
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return OFFLINE_RESPONSE.clone();
  }
}