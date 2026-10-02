// The holiday table (admin; same file in shiftfloo web/app/ and on the Superstar site): "⚙ אדמין ← 📅 לוח חגים"
//   which calendars the company follows (national always + Jewish / Muslim / Christian), the holidays of a year
//   (counted as a rest day or not), import 5 years ahead, add by hand, delete.
// Server: api/holidays.ts. Uses the app's own globals: apiPost, mgrAuth, state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => { const s = appState(); return !!(s && s.mgr && s.mgr.role === 'אדמין'); };
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const CAT_COLOR = { national: '#1d4ed8', jewish: '#0369a1', muslim: '#15803d', christian: '#9333ea' };
  let cats = [], year = new Date().getFullYear();

  function build() {
    if ($('holOverlay')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="overlay hidden" id="holOverlay"><div class="modal" style="max-width:720px">' +
      '<header><h3>📅 לוח חגים</h3><p>חגים מהלוחות שנבחרו נחשבים יום מנוחה בחישוב השעות (150%); ערבי חג הם ימים רגילים</p></header>' +
      '<div class="mbody">' +
        '<div style="background:#f8fafc;border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:10px 12px;margin-bottom:12px">' +
          '<div style="font-weight:800;margin-bottom:6px">לפי אילו לוחות חגים החברה עובדת?</div>' +
          '<div id="holCals" style="display:flex;flex-wrap:wrap;gap:14px;align-items:center"></div>' +
          '<div style="margin-top:8px;display:flex;gap:8px;align-items:center"><button type="button" class="btn primary" id="holSaveCals" style="padding:6px 14px">שמירה</button>' +
          '<span id="holCalsMsg" style="font-size:12.5px;font-weight:700"></span></div></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">' +
          '<button type="button" class="btn plain" id="holPrev" aria-label="שנה קודמת">›</button><b id="holYear" style="font-size:16px"></b>' +
          '<button type="button" class="btn plain" id="holNext" aria-label="שנה הבאה">‹</button>' +
          '<span style="flex:1"></span>' +
          '<button type="button" class="btn plain" id="holImport" style="background:#dcfce7;color:#166534;font-weight:700">⬇ ייבוא חגים ל-5 שנים</button></div>' +
        '<div id="holList"></div>' +
        '<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">+ הוספת חג ידנית</summary>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px">' +
            '<input type="date" id="holDate" style="border:1.5px solid var(--line,#d1d5db);border-radius:8px;padding:6px 8px">' +
            '<input type="text" id="holName" maxlength="60" placeholder="שם החג" style="flex:1;min-width:140px;border:1.5px solid var(--line,#d1d5db);border-radius:8px;padding:6px 8px">' +
            '<select id="holCat" style="border:1.5px solid var(--line,#d1d5db);border-radius:8px;padding:6px 8px"></select>' +
            '<label style="display:flex;gap:4px;align-items:center;font-size:13px"><input type="checkbox" id="holEve"> ערב חג</label>' +
            '<button type="button" class="btn primary" id="holAdd" style="padding:6px 14px">הוספה</button></div></details>' +
        '<div style="font-size:11.5px;color:var(--muted,#6b7280);margin-top:10px">חגים מוסלמיים מחושבים לפי לוח אום אל-קורא; המועד בפועל נקבע לפי ראיית הירח ויכול לזוז ביום — אפשר לתקן ידנית (מחיקה והוספה).</div>' +
      '</div><div class="merr" id="holErr" style="padding:0 18px"></div>' +
      '<div class="mfoot"><button class="btn plain" id="holClose">סגירה</button></div></div></div>');
    $('holClose').addEventListener('click', () => $('holOverlay').classList.add('hidden'));
    $('holPrev').addEventListener('click', () => { year--; load(); });
    $('holNext').addEventListener('click', () => { year++; load(); });
    $('holSaveCals').addEventListener('click', saveCals);
    $('holImport').addEventListener('click', importYears);
    $('holAdd').addEventListener('click', addOne);
  }
  async function open() {
    if (!isAdmin()) return say('לוח החגים — אדמין בלבד', 'err');
    build();
    year = new Date().getFullYear();
    $('holOverlay').classList.remove('hidden');
    await load();
  }
  async function load() {
    const list = $('holList');
    $('holYear').textContent = year;
    list.innerHTML = 'טוען…'; $('holErr').textContent = '';
    const r = await apiPost({ action: 'listHolidays', ...mgrAuth(), year });
    if (!r.ok) { list.innerHTML = ''; $('holErr').textContent = r.error || 'שגיאה'; return; }
    cats = r.categories || [];
    $('holCals').innerHTML = cats.map((c) => '<label style="display:flex;gap:5px;align-items:center;font-size:14px' + (c.key === 'national' ? ';opacity:.7' : '') + '">' +
      '<input type="checkbox" data-cal="' + c.key + '"' + (r.calendars.includes(c.key) ? ' checked' : '') + (c.key === 'national' ? ' disabled' : '') + '> ' +
      e(c.label) + (c.key === 'national' ? ' (תמיד)' : '') + '</label>').join('');
    $('holCat').innerHTML = cats.map((c) => '<option value="' + c.key + '">' + e(c.label) + '</option>').join('');
    const label = (k) => (cats.find((c) => c.key === k) || {}).label || k;
    list.innerHTML = r.holidays.length ? '<div style="overflow-x:auto"><table class="att-table" style="width:100%;min-width:0"><tr><th>תאריך</th><th>יום</th><th>חג</th><th>סוג</th><th>בחישוב</th><th></th></tr>' +
      r.holidays.map((h) => '<tr style="' + (h.counts ? '' : 'opacity:.55') + '"><td>' + h.date.slice(8, 10) + '/' + h.date.slice(5, 7) + '</td><td>' + DAYS[new Date(h.date + 'T00:00:00').getDay()] + '</td>' +
        '<td style="text-align:right">' + e(h.name) + (h.isEve ? ' <small style="color:var(--muted,#6b7280)">(ערב חג)</small>' : '') + '</td>' +
        '<td><span style="color:' + (CAT_COLOR[h.category] || '#374151') + ';font-weight:700">' + e(label(h.category)) + '</span></td>' +
        '<td>' + (h.counts ? '✓ יום חג' : '—') + '</td>' +
        '<td><button type="button" class="dl2" data-del="' + h.id + '" aria-label="מחיקת ' + e(h.name) + '">מחיקה</button></td></tr>').join('') + '</table></div>'
      : '<p style="color:var(--muted,#6b7280)">אין חגים בטבלה לשנת ' + year + ' — אפשר לייבא.</p>';
    list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('למחוק את החג מהטבלה?')) return;
      const x = await apiPost({ action: 'deleteHoliday', ...mgrAuth(), id: Number(b.dataset.del) });
      if (!x.ok) return say(x.error || 'שגיאה', 'err');
      load();
    }));
  }
  async function saveCals() {
    const calendars = [...document.querySelectorAll('#holCals [data-cal]')].filter((c) => c.checked && c.dataset.cal !== 'national').map((c) => c.dataset.cal);
    const msg = $('holCalsMsg');
    msg.style.color = 'var(--muted,#6b7280)'; msg.textContent = 'שומר…';
    const x = await apiPost({ action: 'saveHolidayCalendars', ...mgrAuth(), calendars });
    if (!x.ok) { msg.style.color = '#dc2626'; msg.textContent = x.error || 'שגיאה'; return; }
    msg.style.color = '#16a34a'; msg.textContent = 'נשמר ✓';
    load();
  }
  async function importYears() {
    const btn = $('holImport'), was = btn.textContent;
    btn.disabled = true; btn.textContent = 'מייבא…';
    try {
      const x = await apiPost({ action: 'importHolidays', ...mgrAuth(), years: 5 });
      if (!x.ok) return say(x.error || 'שגיאה', 'err');
      say('נוספו ' + x.added + ' חגים לשנים ' + x.from + '–' + x.to, 'ok');
      load();
    } finally { btn.disabled = false; btn.textContent = was; }
  }
  async function addOne() {
    const x = await apiPost({ action: 'addHoliday', ...mgrAuth(), date: $('holDate').value, name: $('holName').value.trim(),
      category: $('holCat').value, isEve: $('holEve').checked });
    if (!x.ok) { $('holErr').textContent = x.error || 'שגיאה'; return; }
    $('holName').value = ''; $('holEve').checked = false;
    if ($('holDate').value.slice(0, 4) !== String(year)) year = Number($('holDate').value.slice(0, 4)) || year;
    say('החג נוסף', 'ok');
    load();
  }

  function start() {
    const drop = $('menuAdminDrop');
    if (!drop || $('holBtn')) return;
    drop.insertAdjacentHTML('beforeend', '<button id="holBtn">📅 לוח חגים</button>');
    $('holBtn').addEventListener('click', open);
    // admins only, checked whenever the admin menu opens (a shift manager may see this menu too)
    const menuBtn = $('menuAdminBtn');
    const sync = () => $('holBtn').classList.toggle('hidden', !isAdmin());
    if (menuBtn) menuBtn.addEventListener('click', sync, true);
    sync();
  }
  window.openHolidays = open;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
