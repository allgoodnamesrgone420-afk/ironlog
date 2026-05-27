/* Tiny offline shell — caches the app shell so the UI loads with no network.
   Firebase calls themselves require network and will fail offline (expected). */

const CACHE = "ironlog-shell-v1";
const SHELL = ["/", "/dashboard", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        SHELL.map((url) =>
          fetch(url)
            .then((r) => (r.ok ? cache.put(url, r.clone()) : null))
            .catch(() => null),
        ),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Never cache POST or API routes — they need fresh auth + responses.
  if (request.method !== "GET" || request.url.includes("/api/")) return;
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request)
          .then((resp) => {
            // Cache successful navigations
            if (resp.ok && request.mode === "navigate") {
              const clone = resp.clone();
              caches.open(CACHE).then((c) => c.put(request, clone));
            }
            return resp;
          })
          .catch(() => caches.match("/dashboard")),
    ),
  );
});
