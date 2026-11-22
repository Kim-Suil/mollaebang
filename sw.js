// 서비스 워커: 앱 파일을 폰에 캐시해서 인터넷 없이도 열리게 한다.
// ponytail: 캐시 우선 + 뒤에서 새 파일 받기. 새 버전은 "그다음 실행"부터 보인다.
// 파일 목록이 바뀌면 CACHE 숫자를 올린다.
const CACHE = 'karaoke-v18';
const FILES = [
  './', 'index.html', 'app.js', 'logic.js', 'style.css', 'manifest.webmanifest',
  'fonts/Freesentation-500.woff2', 'fonts/Freesentation-700.woff2', 'fonts/Freesentation-900.woff2',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
