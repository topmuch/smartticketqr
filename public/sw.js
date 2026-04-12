// SmartTicketQR Service Worker — Cache-first for static assets, network-first for API/pages

const CACHE_NAME = 'smartticketqr-v2';
const STATIC_CACHE = 'smartticketqr-static-v2';
const DYNAMIC_CACHE = 'smartticketqr-dynamic-v2';

// Static assets to pre-cache (icons, fonts, core shell)
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/logo.svg',
];

// Extensions and routes for cache-first (static assets)
const CACHE_FIRST_EXTENSIONS = [
  '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.webp',
];

// API routes for network-first
const isApiRequest = (url) => url.pathname.startsWith('/api/');

// Install — precache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('smartticketqr-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — strategy router
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Strategy 1: Cache-first for static assets
  if (CACHE_FIRST_EXTENSIONS.some((ext) => url.pathname.endsWith(ext))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Strategy 2: Network-first for API calls
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Strategy 3: Stale-while-revalidate for HTML pages / navigation
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ── Strategies ──────────────────────────────────────────────────────────────

/**
 * Cache-first: serve from cache, fall back to network then cache the response.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline fallback for navigation-like requests
    return new Response('Ressource indisponible', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-first: try network, fall back to cache, then offline page.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // For navigation requests, show offline page
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
    }

    return new Response('Ressource indisponible', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Stale-while-revalidate: serve cache immediately, update cache in background.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      // Network failed, return cached if available
      return caches.match('/offline.html');
    });

  // Return cached version immediately, or wait for network
  return cached || fetchPromise;
}

// ── Message Handler ─────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});
