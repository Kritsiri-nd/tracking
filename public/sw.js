const CACHE = "stridebook-shell-v2";
const SHELL = ["/", "/manifest.webmanifest", "/stridebook-logo.png"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(Promise.all([
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("stridebook-shell-") && key !== CACHE).map((key) => caches.delete(key)))),
  self.clients.claim(),
])));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Private API/Supabase responses must never enter the offline shell cache.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || event.request.headers.has("Authorization")) return;
  event.respondWith(fetch(event.request).then((response) => {
    const clone = response.clone();
    if (response.ok && !response.headers.get("Cache-Control")?.includes("no-store")) caches.open(CACHE).then((cache) => cache.put(event.request, clone));
    return response;
  }).catch(() => caches.match(event.request)));
});
