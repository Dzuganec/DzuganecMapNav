const CACHE_NAME = 'dzuganec-3d-core-v5';
const TILE_CACHE = 'dzuganec-3d-tiles-v5';
const API_CACHE = 'dzuganec-3d-api-v5';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const allowed = [CACHE_NAME, TILE_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !allowed.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // 1. Кэширование векторных 3D-тайлов, 2ГИС, Спутника и шрифтов
  if (
    url.host.includes('openfreemap.org') ||
    url.host.includes('maps.2gis.com') ||
    url.host.includes('google.com') ||
    url.host.includes('fonts.googleapis.com') ||
    url.host.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          const fresh = await fetch(event.request);
          if (fresh.ok) cache.put(event.request, fresh.clone());
          return fresh;
        } catch {
          return cached || new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // 2. Кэширование поиска и маршрутов OSRM
  if (url.host.includes('nominatim.openstreetmap.org') || url.host.includes('router.project-osrm.org')) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(event.request);
          if (fresh.ok) cache.put(event.request, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(event.request);
          return cached || new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    );
    return;
  }

  // 3. Основной код приложения (Network First, чтобы обновления с GitHub применялись сразу)
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
