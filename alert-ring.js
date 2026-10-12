// A ring for attendance alerts (same file in Superstar and Sidurit). The attendance check runs every 15 minutes; when it
// sends a push (late ⏱, long break ⏸, no exit ⏹ / ⚠, did not come 🚫) and the system is open on this device, a loud
// three-tone ring plays as well — on by default, per device: 🔔 ההתראות שלי ← "צלצול בהתראות נוכחות" (with a test).
// When the system is closed the phone plays its own notification sound (a web page cannot choose that sound).
(function () {
  'use strict';
  const KEY = 'alert_ring';
  const ringOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch (_) { return true; } };
  const setRing = (on) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (_) { /* private mode */ } };
  // the attendance alerts' titles (api/scheduled.ts, noshow): their icon and what happened
  const isAtt = (t) => /^(⏱|⏸|⏹|⚠|🚫)/.test(t) && /(איחור|הפסקה|יציאה|התייצב|נוכחות|שעון)/.test(t);

  // the browser lets a page play sound only after a touch / click — the first one unlocks it
  let ctx = null;
  const unlock = () => {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (_) { /* no Web Audio */ }
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true }));

  /** three rising tones, twice (~2 s) */
  function ring() {
    unlock();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.05;
    [0, 1].forEach((rep) => [880, 1175, 1568].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), at = t0 + rep * 0.9 + i * 0.22;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.6, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + 0.22);
    }));
    try { if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]); } catch (_) { /* no vibration */ }
  }

  // a push that arrives while the system is open
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push((OneSignal) => {
    try {
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (ev) => {
        const n = ev && ev.notification;
        if (n && isAtt(String(n.title || '') + ' ' + String(n.body || '')) && ringOn()) ring();
      });
    } catch (_) { /* an older SDK */ }
  });

  // 🔔 ההתראות שלי: the switch and a test, under the table (the window is drawn by employee-records.js)
  function addSwitch() {
    const body = document.getElementById('myAlertsBody');
    if (!body || !body.querySelector('table') || document.getElementById('ringBox')) return;
    body.insertAdjacentHTML('beforeend', '<div id="ringBox" style="margin-top:12px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<label style="display:flex;gap:8px;align-items:center;font-weight:700;flex:1;min-width:200px"><input type="checkbox" id="ringOn" style="width:20px;height:20px"' + (ringOn() ? ' checked' : '') + '>' +
      '🔔 צלצול בהתראות נוכחות</label><button type="button" class="btn plain" id="ringTest" style="padding:5px 12px">▶ השמעה לבדיקה</button>' +
      '<div style="flex-basis:100%;font-size:12px;color:var(--muted,#6b7280)">איחור, הפסקה ארוכה, אין יציאה ולא התייצב/ה — צלצול כשהמערכת פתוחה במכשיר הזה. כשהיא סגורה — צליל ההתראות של הטלפון. הבדיקה רצה כל 15 דקות.</div></div>');
    document.getElementById('ringOn').addEventListener('change', (e) => setRing(e.target.checked));
    document.getElementById('ringTest').addEventListener('click', ring);
  }
  function watch() {
    const body = document.getElementById('myAlertsBody');
    if (!body) { setTimeout(watch, 1500); return; }
    new MutationObserver(addSwitch).observe(body, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  window.ringAttendanceAlert = ring;
})();
