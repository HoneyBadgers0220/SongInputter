/**
 * SongRate Service Worker
 * Caches the app shell for fast loading.
 * API calls are always network-first (need live data).
 */

const CACHE_NAME = "songrate-v1";
const APP_SHELL = [
    "/",
    "/style.css",
    "/app.js",
    "/manifest.json",
    "/icon.svg",
];

// Install — cache the app shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Fetch — network-first for API, cache-first for app shell
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // API calls: always go to network (need live data)
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(JSON.stringify({ error: "Offline" }), {
                    headers: { "Content-Type": "application/json" },
                })
            )
        );
        return;
    }

    // App shell: try cache first, then network
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const networkFetch = fetch(event.request)
                .then((response) => {
                    // Update cache with fresh version
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) =>
                            cache.put(event.request, clone)
                        );
                    }
                    return response;
                })
                .catch(() => cached);

            return cached || networkFetch;
        })
    );
});
