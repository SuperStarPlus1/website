// 📍 The store's location for attendance reports from the app (Superstar, admins): ⚙ אדמין ← 📍 מיקום לדיווח נוכחות.
// "📍 המיקום הנוכחי שלי" takes the point from the phone (standing in the store), "🗺 בדיקה במפה" shows it.
// Server: api/attendance.ts geoSettings / saveGeoSettings (settings store_location, allowed_radius_m). (Sidurit — the same
// buttons per branch in ⚙ אדמין ← 🏢 הגדרות חברה, company-admin.js.)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const admin = () => typeof isAdmin === 'function' && isAdmin();
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const mapUrl = (lat, lng) => 'https://www.google.com/maps?q=' + lat + ',' + lng;

  /** the phone's position, the most accurate one within a few seconds (indoors the first fix is often far off) */
  function herePosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('הדפדפן לא תומך במיקום')); return; }
      let best = null;
      const done = () => { navigator.geolocation.clearWatch(id); clearTimeout(t); best ? resolve(best) : reject(new Error('לא התקבל מיקום — יש להפעיל GPS ולאשר גישה למיקום')); };
      const id = navigator.geolocation.watchPosition((p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
        if (!best || c.acc < best.acc) best = c;
        if (best.acc <= 20) done();
      }, (er) => { if (!best) { navigator.geolocation.clearWatch(id); clearTimeout(t); reject(new Error(er.code === 1 ? 'אין הרשאת מיקום — יש לאשר לאתר גישה למיקום' : 'לא התקבל מיקום — יש להפעיל GPS')); } },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
      const t = setTimeout(done, 10000);
    });
  }

  function build() {
    if ($('geoOverlay')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="overlay hidden" id="geoOverlay"><div class="modal">' +
        '<header><h3>📍 מיקום לדיווח נוכחות</h3><p>דיווח מהאפליקציה בתוך הרדיוס נרשם "תקין"; מחוצה לו — "מחוץ לאזור"</p></header>' +
        '<div class="mbody">' +
          '<button class="btn primary" id="geoHere" style="width:100%">📍 המיקום הנוכחי שלי</button>' +
          '<p style="font-size:12px;color:var(--muted);margin:6px 0 12px">עומדים בחנות ולוחצים — הטלפון קולט את המיקום (עד 10 שניות). אפשר גם להקליד.</p>' +
          '<div class="timegrid"><div class="mrow"><label>קו רוחב</label><input id="geoLat" dir="ltr" inputmode="decimal" placeholder="32.919817"></div>' +
          '<div class="mrow"><label>קו אורך</label><input id="geoLng" dir="ltr" inputmode="decimal" placeholder="35.263710"></div></div>' +
          '<div class="mrow"><label>רדיוס (מטרים)</label><input id="geoRad" type="number" min="20" max="5000" step="10" dir="ltr"></div>' +
          '<p style="font-size:12px;color:var(--muted);margin:-4px 0 10px">מומלץ 100–200 מ׳ — בתוך מבנה ה-GPS של הטלפון לא מדויק.</p>' +
          '<a id="geoMap" target="_blank" rel="noopener" style="font-weight:700">🗺 בדיקה במפה</a>' +
          '<div class="merr" id="geoErr"></div>' +
        '</div>' +
        '<div class="mfoot"><button class="btn primary" id="geoSave">שמירה</button><span class="spacer"></span><button class="btn plain" id="geoClose">סגירה</button></div>' +
      '</div></div>');
    const map = () => { const a = Number($('geoLat').value), b = Number($('geoLng').value); $('geoMap').style.display = a && b ? '' : 'none'; if (a && b) $('geoMap').href = mapUrl(a, b); };
    $('geoLat').addEventListener('input', map); $('geoLng').addEventListener('input', map);
    $('geoClose').addEventListener('click', () => $('geoOverlay').classList.add('hidden'));
    $('geoHere').addEventListener('click', async () => {
      const b = $('geoHere'); b.disabled = true; b.textContent = '⏳ קולט מיקום…'; $('geoErr').textContent = '';
      try {
        const p = await herePosition();
        $('geoLat').value = p.lat.toFixed(6); $('geoLng').value = p.lng.toFixed(6); map();
        say('המיקום נקלט (דיוק ~' + p.acc + ' מ׳) — לבדוק במפה ולשמור');
        if (p.acc > Number($('geoRad').value || 0)) $('geoErr').textContent = 'הדיוק כרגע (~' + p.acc + ' מ׳) גדול מהרדיוס — כדאי לנסות שוב ליד חלון או בכניסה.';
      } catch (er) { $('geoErr').textContent = er.message; }
      b.disabled = false; b.textContent = '📍 המיקום הנוכחי שלי';
    });
    $('geoSave').addEventListener('click', async () => {
      $('geoErr').textContent = '';
      const r = await apiPost({ action: 'saveGeoSettings', ...mAuth(), lat: $('geoLat').value.trim(), lng: $('geoLng').value.trim(), radius: $('geoRad').value });
      if (!r || !r.ok) { $('geoErr').textContent = (r && r.error) || 'שגיאה'; return; }
      $('geoOverlay').classList.add('hidden');
      say('✓ המיקום לדיווח נוכחות נשמר');
    });
  }

  async function open() {
    if (!admin()) { say('אדמין בלבד', 'err'); return; }
    build();
    const r = await apiPost({ action: 'geoSettings', ...mAuth() });
    if (!r || !r.ok) { say((r && r.error) || 'שגיאה', 'err'); return; }
    $('geoLat').value = r.lat ? Number(r.lat).toFixed(6) : ''; $('geoLng').value = r.lng ? Number(r.lng).toFixed(6) : '';
    $('geoRad').value = r.radius || 200; $('geoErr').textContent = '';
    $('geoLat').dispatchEvent(new Event('input'));
    $('geoOverlay').classList.remove('hidden');
  }

  function start() {
    const drop = $('menuAdminDrop');
    if (!drop || $('geoMgrBtn')) return;
    drop.insertAdjacentHTML('beforeend', '<button id="geoMgrBtn" style="display:none">📍 מיקום לדיווח נוכחות</button>');
    $('geoMgrBtn').addEventListener('click', open);
    const show = () => { $('geoMgrBtn').style.display = admin() ? '' : 'none'; };
    $('menuAdminBtn')?.addEventListener('click', show, true);
    show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
