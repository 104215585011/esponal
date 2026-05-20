/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const STATIC_CACHE = "esponal-static-v1";
const PAGE_CACHE = "esponal-page-v2";
const SUBTITLE_CACHE = "esponal-subtitle-v1";
const LECTURA_AUDIO_CACHE = "esponal-lectura-audio-v1";
const TTS_AUDIO_CACHE = "esponal-tts-audio-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png"
];

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    /\.(?:js|css|png|svg|woff2?)$/i.test(pathname)
  );
}

function isLecturaAudio(pathname: string) {
  return pathname.startsWith("/audio/lectura/") && pathname.endsWith(".mp3");
}

function isTtsAudio(pathname: string, search: string) {
  return pathname === "/api/tts" && search.includes("text=");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, PAGE_CACHE, SUBTITLE_CACHE, LECTURA_AUDIO_CACHE, TTS_AUDIO_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/auth/") || url.pathname.startsWith("/api/vocab/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          // Only cache successful HTML responses (not redirects or error pages)
          if (response.ok) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          // Try a previously cached version of this exact URL first
          const cached = await caches.match(request);
          if (cached) return cached;
          // Only show the offline page when the browser is genuinely offline.
          // If online but the server failed/timed out, let the browser show its
          // native error rather than misleading the user with the offline screen.
          if (!self.navigator.onLine) {
            const offline = await caches.match(OFFLINE_URL);
            if (offline) return offline;
          }
          return Response.error();
        }
      })()
    );
    return;
  }

  if (url.pathname.startsWith("/api/subtitle/")) {
    event.respondWith(
      caches.open(SUBTITLE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);

        if (cached) {
          void fetch(request)
            .then((response) => {
              cache.put(request, response.clone());
              return response;
            })
            .catch(() => undefined);
          return cached;
        }

        try {
          const response = await fetch(request);
          cache.put(request, response.clone());
          return response;
        } catch {
          return Response.error();
        }
      })
    );
    return;
  }

  if (isLecturaAudio(url.pathname)) {
    event.respondWith(
      caches.open(LECTURA_AUDIO_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }

        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  if (isTtsAudio(url.pathname, url.search)) {
    event.respondWith(
      caches.open(TTS_AUDIO_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }

        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }

        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      })
    );
  }
});

export {};
