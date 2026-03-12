// ION Service Worker v1.0 — CuraHack Curaçao
const CACHE_NAME = 'ion-v1.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,900&family=JetBrains+Mono:wght@400;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// Install: pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[ION SW] Pre-caching assets');
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(e => console.warn('Cache miss:', url)))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for tiles, network-first for API, stale-while-revalidate otherwise
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Map tiles: cache-first (offline maps)
  if (url.hostname.includes('tile.openstreetmap.org') ||
      url.hostname.includes('opentopomap.org') ||
      url.hostname.includes('arcgisonline.com') ||
      url.hostname.includes('stadiamaps.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME + '-tiles').then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Weather & geo APIs: network-first with cache fallback
  if (url.hostname.includes('open-meteo.com') ||
      url.hostname.includes('worldtimeapi.org') ||
      url.hostname.includes('nominatim.openstreetmap.org')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME + '-api').then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets: cache-first
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          if (event.request.destination === 'document') return caches.match('/index.html');
        });
      })
    );
  }
});

// Background sync for GPS data
self.addEventListener('sync', event => {
  if (event.tag === 'ion-gps-sync') {
    console.log('[ION SW] Background GPS sync');
  }
});

// Push notifications (future)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification('ION Alert', {
      body: data.message,
      icon: '/icons/ion-icon-192.svg',
      badge: '/icons/ion-icon-192.svg',
      tag: 'ion-alert',
      vibrate: [100, 50, 100]
    });
  }
});
