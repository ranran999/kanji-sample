// Service worker: caches the full app shell so the app keeps working
// offline (a home-screen-installed iPad app losing its network mid-lesson
// shouldn't just show an error page).
//
// This is a buildless app -- there's no build step that content-hashes
// filenames, so cache invalidation is manual: bump CACHE_NAME (e.g.
// "kanji-master-v2") whenever a deploy changes any precached file. Old
// caches are deleted on activate, so a stale version never lingers once a
// client picks up the new service worker.
const CACHE_NAME = 'kanji-master-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './js/main.js',
  './js/data.js',
  './js/confetti.js',
  './js/drawingCanvas.js',
  './js/iphoneGuards.js',
  './js/kanjiText.js',
  './js/pathMeasure.js',
  './js/soundManager.js',
  './js/strokeChecker.js',
  './js/components/allKanjiModal.js',
  './js/components/categoryModal.js',
  './js/components/footer.js',
  './js/components/header.js',
  './js/components/kanjiGrid.js',
  './js/components/kanjiInfoCard.js',
  './js/components/testResultsModal.js',
  './js/components/toast.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Take over from any previously-waiting service worker immediately --
      // this app has no unsaved-form-style state worth protecting against a
      // mid-session reload, so prompt updates beat delayed ones.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations (including hash-only URL changes, which don't even reach
  // the network) always resolve to the cached shell -- this is a
  // client-side-hash-routed single page app, so index.html covers every
  // in-app "page".
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for everything else (the precached app-shell assets): an
  // instant response with no network round-trip, falling back to the
  // network (and caching what it returns) for anything not precached.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      });
    })
  );
});
