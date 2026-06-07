const CACHE_NAME = 'atomicflow-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/animations.css',
  './js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching Core App Assets...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing old cache asset:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only handle GET requests for standard caching
  if (event.request.method !== 'GET') return;

  // Do NOT intercept/cache dynamic API pulls from Google Sheets or the local proxy
  const url = event.request.url;
  if (url.includes('script.google.com') || url.includes('googleusercontent.com') || url.includes('/api/proxy') || url.includes('action=pull')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // If we got a valid response, cache it for offline use
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If network request fails (offline), load from local cache
        return caches.match(event.request);
      })
  );
});
