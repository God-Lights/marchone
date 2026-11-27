// Minimal service worker (installability + future Web Push). No offline caching yet.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : { title: "MarchOne", body: "마치가 소식을 보냈어요" };
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body }));
});
