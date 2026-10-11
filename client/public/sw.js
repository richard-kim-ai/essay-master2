// v2: 예전(v1) 캐시에 JS 자리에 저장된 HTML이 남아 "Unexpected token '<'"가 계속되는 것을 막기 위해 이름을 올려 옛 캐시를 비운다.
const CACHE_NAME = "essay-master-shell-v2";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "논술 마스터", body: "새로운 학습 알림이 있습니다.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Ignore malformed push payloads and show the fallback notification.
  }
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: "/favicon.ico", badge: "/favicon.ico", tag: payload.tag || "essay-master", data: { url: payload.url || "/" } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => "focus" in client);
    if (existing) {
      existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  }));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached || Response.error())),
    );
    return;
  }

  // 해시가 붙은 assets/ 파일만 캐시 우선으로 쓴다. 개발 서버의 모듈 등 그 밖의 파일은 항상 네트워크에서 받는다(오래된 모듈이 남지 않게).
  if (!url.pathname.startsWith("/assets/")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // 없는 파일에 대신 내려온 HTML(index.html)은 저장하지 않는다.
        const contentType = response.headers.get("content-type") || "";
        if (response.ok && !contentType.includes("text/html")) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
