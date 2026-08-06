// Tiny stale-while-revalidate service worker. We cache:
//   • hashed Vite assets (immutable) — cache-first,
//   • /api/* responses with a 5-minute SWR window so a slow network or
//     brief offline still surfaces last-known weather,
//   • HTML navigations — network-first so deploys aren't stuck behind
//     a cached index.html that points at deleted hashed bundles.
//
// This is intentionally simple — no Workbox dependency, no precache
// manifest. Vite's hashed asset filenames give us cache-busting for free.

const VERSION = 'weatherstop-v4';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const APP_SHELL = ['/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // External weather sources (open-meteo, weather.gov, realearth, etc.)
    // are short-cached so swiping back to a recent city is instant.
    if (
      /(?:open-meteo|weather\.gov|realearth\.ssec\.wisc|tidesandcurrents)/i.test(
        url.host,
      )
    ) {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }

  // Never cache-first the document shell — stale HTML + new asset hashes
  // = blank white screen after every deploy.
  const isDocument =
    req.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isDocument) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Hashed assets + icons — cache-first.
  if (/\.(?:js|css|svg|webmanifest|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // API or weather data — stale-while-revalidate.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/data/')) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    // Do not put HTML in STATIC_CACHE — keeps deploys honest.
    return fresh;
  } catch (err) {
    const fallback =
      (await caches.match(request)) ||
      (await caches.match('/index.html')) ||
      (await caches.match('/'));
    if (fallback) return fallback;
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const fallback = await caches.match(request);
    if (fallback) return fallback;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networked = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type !== 'opaque') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached ?? networked ?? new Response('offline', { status: 503 });
}
