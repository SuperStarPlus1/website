// Pinkas — offline: every file of the app is cached on install; served from the cache (the data itself is in IndexedDB,
// never here). On a release: bump CACHE (and version.json) — the new files load on the next open.
const CACHE = 'pinkas-v20';
const FILES = ['./', 'index.html', 'app.css', 'manifest.webmanifest', 'version.json', 'oauth.html', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'js/app.js', 'js/calc.js', 'js/store.js', 'js/ui.js', 'js/cloud.js', 'js/auth.js', 'js/backup.js', 'js/license.js', 'js/env.js', 'js/views/income.js', 'js/views/customers.js', 'js/views/expenses.js',
  'js/views/purchasing.js', 'js/views/suppliers.js', 'js/views/payroll.js', 'js/views/payreports.js', 'js/views/payfunds.js', 'js/views/cashflow.js', 'js/views/reports.js', 'js/views/settings.js'];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('pinkas-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET' || new URL(ev.request.url).origin !== location.origin) return;
  ev.respondWith(caches.match(ev.request, { ignoreSearch: true }).then((hit) => hit || fetch(ev.request).catch(() => caches.match('index.html'))));
});
