const CACHE = 'hooshyar-shell-v3';
const APP_SHELL = ['/', '/index.html', '/app.js', '/offline-sync.js', '/styles.css', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
