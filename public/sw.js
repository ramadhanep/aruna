const VERSION = '1.8.0';
const STATIC_CACHE = `aruna-static-${VERSION}`;
const PAGE_CACHE = `aruna-pages-${VERSION}`;
const DATA_CACHE = `aruna-data-${VERSION}`;
const RUNTIME_CACHE = `aruna-runtime-${VERSION}`;
const ASSET_CACHE = `aruna-assets-${VERSION}`;
const OFFLINE_URL = '/offline';

const MAX_RUNTIME_ENTRIES = 100;
const API_CACHE_TTL_MS = 5 * 60 * 1000;

const APP_SHELL = [
  '/',
  '/?source=pwa',
  '/explore',
  '/chart',
  '/idx-bubbles',
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

const trimCache = async (cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
  }
};

const isApiCacheFresh = async (cacheName, request) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (!cached) return false;
  const header = cached.headers.get('sw-cached-at');
  if (!header) return false;
  return Date.now() - Number(header) < API_CACHE_TTL_MS;
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
  if (await isApiCacheFresh(cacheName, request)) {
    const cached = await caches.open(cacheName).then((c) => c.match(request));
    if (cached) return cached;
  }
  try {
    const response = await fetch(request);
    const clone = response.clone();
    if (clone.ok) {
      const cache = await caches.open(cacheName);
      const stamped = new Response(clone.body, {
        status: clone.status,
        statusText: clone.statusText,
        headers: clone.headers,
      });
      stamped.headers.set('sw-cached-at', String(Date.now()));
      await cache.put(request, stamped);
    }
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
    .catch(() => cached || Response.error());
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
  event.waitUntil(trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES));
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
