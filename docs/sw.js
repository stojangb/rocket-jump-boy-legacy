"use strict";

const CACHE_NAME = "jump-boy-web-v1";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const response = await fetch("./assets/manifest.json");
    if (!response.ok) throw new Error(`No se pudo cargar la lista de recursos (${response.status}).`);
    const assets = await response.json();
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([
      "./",
      "./index.html",
      "./game.js",
      "./manifest.webmanifest",
      "./assets/manifest.json",
      ...assets.map((name) => `./assets/${name}`)
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith("jump-boy-web-") && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    return cached || fetch(event.request);
  })());
});
