const CACHE_NAME = 'navigator-core-v4';
const TILE_CACHE = 'navigator-tiles-v4';
const API_CACHE = 'navigator-api-v4';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

const TRANSPARENT_TILE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const allowedCaches = [CACHE_NAME, TILE_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !allowedCaches.includes(k)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // 1. Кэширование тайлов 2ГИС, Google HD и OSM для офлайн-работы
  if (
    url.host.includes('maps.2gis.com') ||
    url.host.includes('google.com') ||
    url.host.includes('tile.openstreetmap.org')
  ) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          const fresh = await fetch(event.request);
          if (fresh.ok) {
            cache.put(event.request, fresh.clone());
          }
          return fresh;
        } catch {
          return fetch(TRANSPARENT_TILE);
        }
      })
    );
    return;
  }

  // 2. Обработка API поиска и маршрутов
  if (url.host.includes('nominatim.openstreetmap.org') || url.host.includes('router.project-osrm.org')) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(event.request);
          if (fresh.ok) {
            cache.put(event.request, fresh.clone());
          }
          return fresh;
        } catch {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    );
    return;
  }

  // 3. Оболочка приложения
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
