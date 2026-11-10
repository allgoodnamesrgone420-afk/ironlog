/* Network-first SW. Fixes "stale on one device" by always trying the network
   for pages and only falling back to cache when offline or the network stalls.
   Bump CACHE on releases to force-evict the old shell. */

const CACHE = "ironlog-shell-v6";
const STATIC = ["/manifest.json", "/icon.svg"];
// A gym basement with one bar of signal: don't stare at a blank screen while a
// request hangs. After this long, show the cached page (the fetch carries on
// and refreshes the cache for next time).
const NAV_TIMEOUT_MS = 3500;
const MAX_ENTRIES = 300; // hashed build assets pile up across deploys

async function remember(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  const keys = await cache.keys();
  // Keys come back oldest first: drop the oldest beyond the limit.
  const extra = keys.length - MAX_ENTRIES;
  if (extra > 0) await Promise.all(keys.slice(0, extra).map((k) => cache.delete(k)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        STATIC.map((url) =>
          fetch(url, { cache: "no-cache" })
            .then((r) => (r.ok ? cache.put(url, r.clone()) : null))
            .catch(() => null),
        ),
      ),
    ),
  );
  // Activate immediately on first install
  self.skipWaiting();
});

// Allow the page to tell us to skip waiting on subsequent updates
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      // Take control of open clients so they get the new SW immediately.
      await self.clients.claim();
    })(),
  );
});

/** Network first; the cached copy when offline or when the network takes too long. */
function networkFirst(request, fallbackUrl) {
  const fromNetwork = fetch(request).then((resp) => {
    if (resp.ok) remember(request, resp.clone()).catch(() => {});
    return resp;
  });
  const fromCache = () =>
    caches.match(request).then((hit) => hit || (fallbackUrl ? caches.match(fallbackUrl) : undefined));

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (resp) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(resp);
    };
    const timer = setTimeout(() => {
      fromCache().then((hit) => hit && done(hit));
    }, NAV_TIMEOUT_MS);
    fromNetwork.then(done, () =>
      fromCache().then((hit) => (hit ? done(hit) : settled || reject(new TypeError("offline")))),
    );
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: network-first, cached copy when offline or stalled.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/dashboard"));
    return;
  }

  // Client-side navigation payloads change with every deploy. Serving them
  // cache-first handed out pages from an old build until CACHE was bumped.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Hashed build assets never change: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((resp) => {
            if (resp.ok) remember(request, resp.clone()).catch(() => {});
            return resp;
          }),
      ),
    );
    return;
  }

  // Icons, manifest and the like: show the cached copy, refresh it in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((resp) => {
          if (resp.ok) remember(request, resp.clone()).catch(() => {});
          return resp;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
