/* 单词猫 Service Worker — 离线优先缓存策略 */

const CACHE = 'wordpet-v1';

/** 需要预缓存的核心资源（相对路径，构建时由脚本补全） */
const PRECACHE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE).catch(() => {});
      // 顺手缓存猫图与图标，保证离线也有形象
      const assets = [
        './cats/stage1.png', './cats/stage2.png', './cats/stage3.png',
        './cats/stage4.png', './cats/stage5.png',
        './cats/food.png', './cats/soap.png', './cats/heart.png',
        './icons/icon-192.png', './icons/icon-512.png',
      ];
      await Promise.all(assets.map((u) => cache.add(u).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 清理旧版本缓存
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：网络优先，失败回退缓存（保证更新及时，离线可用）
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put('./index.html', fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match('./index.html')) ??
            (await cache.match('./')) ??
            new Response('离线中，请联网后重试', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        }
      })(),
    );
    return;
  }

  // 其他静态资源：缓存优先，后台更新
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);

      return cached ?? (await network) ?? new Response('', { status: 504 });
    })(),
  );
});
