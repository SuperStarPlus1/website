/**
 * Service Worker — סופרסטאר (רב-סניפי) + OneSignal
 */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE  = 'superstar-v216';
const ASSETS = ['/shifts', '/icon-192.png', '/icon-512.png', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('script.google') ||
      url.hostname.includes('supabase.co') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('onesignal') ||
      e.request.method !== 'GET') return;
  // the customer club's pages and data (club, club-send, club-terms, club-privacy, club-unsub, club-data/) must always be
  // current — never from this cache (a customer would see an old form)
  if (url.origin === location.origin && url.pathname.startsWith('/club')) return;
  // a page load: from the network first (the newest version), the cache only when offline
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('/shifts'))));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match('/shifts'));
    })
  );
});
