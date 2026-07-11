import { CACHE_NAME, CACHE_PREFIX, deleteObsoleteShellCaches, installCompleteShell, shouldHandleRequest } from './src/pwa/app-shell.js';

self.addEventListener('install', (event) => {
  event.waitUntil(installCompleteShell({
    cacheStorage: caches,
    fetchAsset: (url) => fetch(url, { cache: 'reload', credentials: 'same-origin' }),
    origin: self.location.origin,
  }));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteObsoleteShellCaches(caches).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (!shouldHandleRequest(event.request, self.location.origin)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => (await cache.match(event.request.url)) ?? fetch(event.request)));
});
