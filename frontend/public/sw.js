const CACHE_NAME = 'aura-cache-v1';
const ASSETS = ['/', '/index.html', '/src/App.jsx', '/src/index.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      if (res) return res;
      return fetch(e.request).then((netRes) => {
        if (e.request.url.includes('api.mapbox.com')) {
          return caches.open(CACHE_NAME).then(c => {
            c.put(e.request, netRes.clone());
            return netRes;
          });
        }
        return netRes;
      });
    })
  );
});