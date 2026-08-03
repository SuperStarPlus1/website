/**
 * Service Worker — סופרסטאר סידור עבודה
 * אסטרטגיה: Cache-First לקבצים סטטיים, Network-First לבקשות API
 */
const CACHE  = 'superstar-v1';
const ASSETS = [
  '/shifts',
  '/shifts-guide.pdf',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

/* ── התקנה: שמירת כל הנכסים ב-cache ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {})) // שגיאת רשת לא תעצור את ההתקנה
      .then(() => self.skipWaiting())
  );
});

/* ── הפעלה: מחיקת cache ישנים ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── בקשות: Cache-First לקבצים, Network-First לאחר ── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // בקשות Apps Script (GAS) — תמיד מהרשת, אל תמיד ב-cache
  if (url.hostname.includes('script.google') ||
      url.hostname.includes('googleapis') ||
      e.request.method !== 'GET') {
    return; // נפל ל-browser default
  }

  // נכסים סטטיים — Cache-First עם Network Fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // שמור רק תגובות תקינות
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // אין רשת ואין cache — דף אופליין בסיסי
        if (e.request.destination === 'document') {
          return caches.match('/shifts');
        }
      });
    })
  );
});

/* ── Push Notifications (בסיס להרחבה עתידית) ── */
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'סופרסטאר ⭐', body: 'התראה חדשה' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'סופרסטאר ⭐', {
      body:    data.body || '',
      icon:    '/icon-192.png',
      badge:   '/icon-96.png',
      dir:     'rtl',
      lang:    'he',
      tag:     data.tag || 'superstar',
      data:    data.url ? { url: data.url } : {},
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/shifts';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const open = list.find(c => c.url.includes('/shifts'));
      if (open) return open.focus();
      return clients.openWindow(url);
    })
  );
});
