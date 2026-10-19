/* Service worker: giúp app mở được và chạy khi mất mạng.
   Khi cập nhật index.html lên GitHub, đổi số phiên bản CACHE bên dưới (v1 -> v2...) để máy người dùng lấy bản mới. */
const CACHE = 'qldc-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(u => cache.add(u)));
    try { await cache.put(XLSX_URL, await fetch(new Request(XLSX_URL, { mode: 'no-cors' }))); } catch (e) {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // Chỉ xử lý file của app và thư viện Excel; các lời gọi đồng bộ tới Google Apps Script đi thẳng ra mạng
  if (!sameOrigin && req.url !== XLSX_URL) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isPage) {
    // Trang chính: ưu tiên mạng (để nhận bản mới), mất mạng thì dùng bản đã lưu
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(async () => (await caches.match(req)) || (await caches.match('./index.html')) || (await caches.match('./')))
    );
    return;
  }
  // File tĩnh (biểu tượng, manifest, thư viện Excel): ưu tiên bản đã lưu
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
