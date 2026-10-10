const CACHE = 'hooshyar-shell-v2';
const APP_SHELL = ['/', '/index.html', '/executive-evaluation-view-model.js', '/app.js', '/styles.css', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('hooshyar-shell-') && key !== CACHE).map(key => caches.delete(key))
    ))
  ]));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
