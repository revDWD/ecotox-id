// Offline support: the app shell is cached up front; photos and silhouettes are cached as they are used.
const VERSION = 'ecotoxid-v1';
const SHELL = [
  './', 'index.html', 'css/style.css', 'fonts/PressStart2P-latin.woff2', 'icon.svg', 'manifest.webmanifest',
  'js/main.js', 'js/battle.js', 'js/game.js', 'js/guide.js', 'js/sound.js', 'js/sprites.js', 'js/storage.js', 'js/ui.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ecotoxid-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  const url = new URL(request.url);
  const isDeck = url.pathname.endsWith('/data/deck.json');
  const isMedia = /\/data\/(photos|silhouettes)\//.test(url.pathname);

  if (isMedia) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); }
        return res;
      })),
    );
    return;
  }

  // Deck and app files: try the network first so updates show up, fall back to cache offline.
  event.respondWith(
    fetch(request).then((res) => {
      if (res.ok && (isDeck || SHELL.some((p) => url.pathname.endsWith(p.replace('./', ''))))) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => caches.match(request).then((hit) => hit || caches.match('index.html'))),
  );
});
