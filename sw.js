// Word Quest — Service Worker
// Cache-first strategy: app works fully offline after first load

const CACHE_NAME = 'word-quest-v1';

// 캐시할 리소스 목록
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  // Google Fonts (네트워크 우선, 폴백 캐시)
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap'
];

// ─── Install: 핵심 파일 프리캐시 ───────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())   // 즉시 활성화
  );
});

// ─── Activate: 구버전 캐시 정리 ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())  // 즉시 모든 탭 제어
  );
});

// ─── Fetch: 요청 인터셉트 전략 ────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Google Fonts → Network-first (오프라인이면 캐시 폴백)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // 같은 origin 리소스 → Cache-first (앱 셸, HTML, JS, CSS)
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstWithNetwork(request));
    return;
  }

  // 그 외 외부 리소스 → Network-only
  event.respondWith(fetch(request));
});

// ─── 전략 헬퍼 ───────────────────────────────────────────────────────────

/**
 * Cache-first: 캐시에 있으면 즉시 반환, 없으면 네트워크 → 캐시 저장
 */
async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // 완전 오프라인 + 캐시 없음 → index.html 폴백
    return caches.match('./index.html');
  }
}

/**
 * Network-first: 네트워크 우선, 실패 시 캐시 폴백
 */
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}
