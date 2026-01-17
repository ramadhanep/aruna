const VERSION = '1.3.42';
const STATIC_CACHE = `aruna-static-${VERSION}`;
const PAGE_CACHE = `aruna-pages-${VERSION}`;
const DATA_CACHE = `aruna-data-${VERSION}`;
const RUNTIME_CACHE = `aruna-runtime-${VERSION}`;
const ASSET_CACHE = `aruna-assets-${VERSION}`;
const OFFLINE_URL = '/offline';

const APP_SHELL = [
  '/',
  '/?source=pwa',
  '/chart',
  '/explore',
  '/watchlist',
  '/msci',
  '/portfolio-tracker',
  '/offline',
  '/manifest.json',
  '/aruna.png',
];

const ASSET_PATTERN = /\.(?:png|jpg|jpeg|gif|svg|webp|ico|ttf|otf|woff2?|css|js)$/i;
const KNOWN_CACHES = [STATIC_CACHE, PAGE_CACHE, DATA_CACHE, RUNTIME_CACHE, ASSET_CACHE];

const precacheAppShell = async () => {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(
    APP_SHELL.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
    )
  );
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await precacheAppShell();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => !KNOWN_CACHES.includes(name))
          .map((staleName) => caches.delete(staleName))
      );
      await self.clients.claim();
    })()
  );
});

const isHtmlRequest = (request) =>
  request.mode === 'navigate' ||
  (request.headers.get('accept') || '').includes('text/html');

const isApiRequest = (url) => url.pathname.startsWith('/api/');

const cachePut = async (cacheName, request, response) => {
  if (!response || response.status !== 200 || response.type === 'opaque') {
    return;
  }
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
};

const handlePageRequest = async (request) => {
  try {
    const response = await fetch(request);
    cachePut(PAGE_CACHE, request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
};

const networkFirst = async (cacheName, request) => {
  try {
    const response = await fetch(request);
    cachePut(cacheName, request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
};

const staleWhileRevalidate = async (cacheName, request) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      cachePut(cacheName, request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isHtmlRequest(request)) {
    event.respondWith(handlePageRequest(request));
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(networkFirst(DATA_CACHE, request));
    return;
  }

  if (ASSET_PATTERN.test(url.pathname) || ['style', 'script', 'font'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(ASSET_CACHE, request));
    return;
  }

  event.respondWith(staleWhileRevalidate(RUNTIME_CACHE, request));
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CLEAR_RUNTIME_CACHE') {
    caches.delete(RUNTIME_CACHE);
    caches.delete(DATA_CACHE);
  }
});
