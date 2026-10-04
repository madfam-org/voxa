/* Voxa service worker — plain JavaScript (browsers do not run TypeScript here).
 *
 * What it does:
 * - App shell (`/app`, `/app/edit` and their `/<locale>/` variants): network
 *   first; a successful page is kept in the shell cache, so reopening the app
 *   without a connection shows the board from the last visit.
 * - Build assets (`/_next/static/*`, hashed and immutable), icons, the manifest
 *   and the vendored pictograms (`/symbols/*`): cache first.
 * - Board data lives on the API origin and is never cached here. Reads fall
 *   back to the app's own per-board cache, and offline saves go to the
 *   IndexedDB queue (`src/lib/offline-idb.ts`, `src/lib/pending-board-save.ts`),
 *   flushed by the `sync` event below.
 * - `/api/*` (session, private media proxy) is never cached: those answers are
 *   per user, and this cache is shared by every user of the browser.
 *
 * Bump VERSION when the caching rules change; `activate` deletes caches of
 * other versions.
 */
const VERSION = 'v2';
const CACHE_PREFIX = 'voxa-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${VERSION}`;
const SYMBOL_CACHE = `${CACHE_PREFIX}symbols-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, SYMBOL_CACHE];
const MAX_STATIC_ENTRIES = 400;
const MAX_SYMBOL_ENTRIES = 1000;

const SYNC_TAG = 'voxa-board-save';
const LOCALES = ['es', 'en', 'fr'];
const SHELL_PATH = new RegExp(`^/(?:(?:${LOCALES.join('|')})/)?app(?:/edit)?/?$`);

function isShellPath(pathname) {
  return SHELL_PATH.test(pathname);
}

function shellKey(url) {
  const path = url.pathname.replace(/\/$/, '') || '/';
  return new URL(path, self.location.origin).href;
}

function isStaticPath(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.webmanifest'
  );
}

function isSymbolPath(pathname) {
  return pathname.startsWith('/symbols/');
}

function isSignOutPath(pathname) {
  return /^\/(?:(?:es|en|fr)\/)?auth\/signout\/?$/.test(pathname);
}

/** Only complete, same-origin, non-redirected 200 answers are worth keeping. */
function cacheable(response) {
  return Boolean(response) && response.status === 200 && response.type === 'basic' && !response.redirected;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i += 1) {
    await cache.delete(keys[i]);
  }
}

async function networkFirstShell(request) {
  const url = new URL(request.url);
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (cacheable(response)) {
      await cache.put(shellKey(url), response.clone());
    }
    return response;
  } catch (err) {
    const cached =
      (await cache.match(shellKey(url))) ||
      (await cache.match(new URL('/app', self.location.origin).href));
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: false });
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) {
    await cache.put(request, response.clone());
    void trimCache(cacheName, maxEntries);
  }
  return response;
}

/**
 * Cache what the page loaded before this worker controlled it (the first
 * visit), so the next offline start has every chunk of the shell.
 */
async function cacheUrls(urls) {
  const origin = self.location.origin;
  for (const raw of urls) {
    let url;
    try {
      url = new URL(raw, origin);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;
    try {
      if (isShellPath(url.pathname)) {
        const response = await fetch(url.href, { credentials: 'same-origin' });
        if (cacheable(response)) {
          await (await caches.open(SHELL_CACHE)).put(shellKey(url), response);
        }
      } else if (isStaticPath(url.pathname)) {
        const cache = await caches.open(STATIC_CACHE);
        if (!(await cache.match(url.href))) {
          const response = await fetch(url.href);
          if (cacheable(response)) await cache.put(url.href, response);
        }
      } else if (isSymbolPath(url.pathname)) {
        const cache = await caches.open(SYMBOL_CACHE);
        if (!(await cache.match(url.href))) {
          const response = await fetch(url.href);
          if (cacheable(response)) await cache.put(url.href, response);
        }
      }
    } catch {
      /* offline or a transient failure: the next visit tries again */
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // API origin, identity provider and any other origin: straight to the network.
  if (url.origin !== self.location.origin) return;
  // Session and private media answers are per user: never cached here.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    if (isSignOutPath(url.pathname)) {
      // Signing out forgets the cached shell; the network handles the request.
      event.waitUntil(caches.delete(SHELL_CACHE));
      return;
    }
    if (isShellPath(url.pathname)) {
      event.respondWith(networkFirstShell(request));
    }
    return;
  }

  if (isStaticPath(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, MAX_STATIC_ENTRIES));
    return;
  }

  if (isSymbolPath(url.pathname)) {
    event.respondWith(cacheFirst(request, SYMBOL_CACHE, MAX_SYMBOL_ENTRIES));
  }
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'voxa:cache-urls' || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((u) => typeof u === 'string').slice(0, 500);
  event.waitUntil(
    cacheUrls(urls).then(() => {
      if (event.source && typeof event.source.postMessage === 'function') {
        event.source.postMessage({ type: 'voxa:cache-urls-done', count: urls.length });
      }
    }),
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag !== SYNC_TAG) return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: 'voxa:flush-pending-save' });
      }
    }),
  );
});
