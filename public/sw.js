const CACHE_NAME = 'horosho-v-lesu-v1.0.3';

// Install: Cache core assets and immediately activate
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: Clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network first for HTML/API, Cache with background revalidation for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip Google Apps Script from Service Worker cache (always fresh API network)
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    return;
  }

  // Network First, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
