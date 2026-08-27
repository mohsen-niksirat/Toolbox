// ═══════════════════════════════════════════════
// Toolbox Pro PWA — Service Worker v1.2.1
// Enhanced: cache-first smart, IndexedDB persist, Notification API, background sync
// ═══════════════════════════════════════════════

const CACHE_NAME = 'toolbox-pro-v1.2.3';
const RUNTIME_CACHE = 'toolbox-runtime-v4';
const OFFLINE_RESPONSE = new Response('آفلاین هستید 😕', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

const PRECACHE_URLS = [
  './', './index.html', './404.html', './manifest.json',
  './icons/icon-72.png', './icons/icon-96.png', './icons/icon-128.png',
  './icons/icon-144.png', './icons/icon-152.png', './icons/icon-192.png',
  './icons/icon-384.png', './icons/icon-512.png'
];

const CACHE_FIRST_ROUTES = [
  /\/index\.html$/, /\/icons\//, /\/manifest\.json$/, /\/404\.html$/,
  /\/$/, /^\/[^.]*$/
];

self.addEventListener('install', (event) => {
  console.log('[SW] 📦 Installing v1.2.1...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] ✅ Pre-caching app shell');
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] 🔄 Activating v1.2.1...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => { console.log('[SW] 🗑️ Deleting old cache:', name); return caches.delete(name); })
      );
    }).then(() => {
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED', version: '1.2.1' }));
        return self.clients.claim();
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  const { type } = event.data;
  if (type === 'SKIP_WAITING') { self.skipWaiting(); }
  else if (type === 'SAVE_STATE') { saveState(event.data.toolId, event.data.state); }
  else if (type === 'GET_STATE') {
    getState(event.data.toolId).then((state) => {
      if (event.source && event.source.postMessage) {
        event.source.postMessage({ type: 'STATE_RESPONSE', toolId: event.data.toolId, state: state });
      }
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      clients.length > 0 ? clients[0].focus() : self.clients.openWindow('./index.html');
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-toolbox') event.waitUntil(performBackgroundSync());
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') event.waitUntil(updateCachePeriodically());
});

async function performBackgroundSync() {
  console.log('[SW] 🔄 Background sync...');
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await fetch('./index.html');
    if (res.ok) { await cache.put('./index.html', res); console.log('[SW] ✅ Background sync complete'); }
  } catch (err) { console.warn('[SW] Background sync failed:', err); }
}

async function updateCachePeriodically() {
  try {
    const cache = await caches.open(CACHE_NAME);
    for (const url of PRECACHE_URLS) {
      try { const res = await fetch(url, { cache: 'no-cache' }); if (res.ok) cache.put(url, res); } catch (e) {}
    }
  } catch (err) {}
}

// ─── SW-side IndexedDB for tool state persistence ───
function openSWDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('toolbox-sw-states', 1);
    req.onupgradeneeded = (e) => { if (!e.target.result.objectStoreNames.contains('states')) e.target.result.createObjectStore('states'); };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function saveState(toolId, state) {
  try { const db = await openSWDB(); const tx = db.transaction('states', 'readwrite'); tx.objectStore('states').put(state, toolId); return new Promise((r) => { tx.oncomplete = r; }); } catch (e) {}
}

async function getState(toolId) {
  try { const db = await openSWDB(); const tx = db.transaction('states', 'readonly'); return new Promise((r) => { tx.objectStore('states').get(toolId).onsuccess = (e) => r(e.target.result); }); } catch (e) { return null; }
}

// ─── Fetch ───
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) { event.respondWith(networkFirst(request)); return; }
  const isCacheFirst = CACHE_FIRST_ROUTES.some((p) => p.test(url.pathname));
  event.respondWith(isCacheFirst ? cacheFirst(request) : cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request).then((r) => { if (r.ok) caches.open(CACHE_NAME).then((c) => c.put(request, r)); }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) { const cache = await caches.open(CACHE_NAME); cache.put(request, response.clone()); }
    return response;
  } catch (error) {
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    return OFFLINE_RESPONSE.clone();
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) { const cache = await caches.open(RUNTIME_CACHE); cache.put(request, response.clone()); }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return OFFLINE_RESPONSE.clone();
  }
}
