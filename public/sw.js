/**
 * Service worker.
 *
 * Deliberately minimal, and it caches almost nothing.
 *
 * This site has already been through a bug where the page showed one version of
 * the content and then replaced it with an older one. A service worker is the
 * classic way to reintroduce exactly that, permanently and much harder to
 * diagnose — a stale HTML shell or a cached API response can outlive several
 * deploys. So the rule here is narrow: only fingerprinted build assets are
 * cached, because their filenames change whenever their contents do and a
 * stale one is therefore impossible.
 *
 * Everything else — the HTML shell, every /api call, uploaded images — goes to
 * the network every time. The point of this worker is installability, not
 * offline capability. The dashboard is useless offline anyway: it exists to
 * read applications out of a database.
 */

const ASSET_CACHE = 'scc-assets-v1';

/**
 * Fingerprinted by the build: /assets/index-B3Mq2Vmg.js and friends.
 *
 * Vite separates the hash with a hyphen, not a dot. Source maps are excluded
 * by the extension list — there is no reason to spend a visitor's cache on
 * them, and they are only fetched when devtools is open anyway.
 */
function isImmutableAsset(url) {
  return url.origin === self.location.origin && /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?)$/.test(url.pathname);
}

/** Icons change rarely and are small; worth having offline for the splash. */
function isAppIcon(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/icons/');
}

self.addEventListener('install', (event) => {
  // Take over as soon as possible; there is no old worker whose caches need
  // draining, because nothing meaningful is cached.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from any earlier naming scheme, so a future change to the
      // strategy cannot leave stale entries behind.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== ASSET_CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never interfere with anything that changes state, and never with the API.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.pathname.startsWith('/api/')) return;

  if (!isImmutableAsset(url) && !isAppIcon(url)) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      // Only store a complete, successful, same-origin response. A partial or
      // error response cached here would be served for the life of the cache.
      if (response.ok && response.status === 200 && response.type === 'basic') {
        const cache = await caches.open(ASSET_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
