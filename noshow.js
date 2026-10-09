// "לא התייצב למשמרת" — the admin's settings (same file in the Sidurit template web/app/ and on the Superstar site; server:
// api/noshow.ts, rules: _shared/noshow-core.ts). "📍 נוכחות ← 🚫 לא התייצבו למשמרת": on / off, the employees and the
// departments that are never recorded (people who do not clock in — management), and who WOULD have been recorded in
// each of the last 7 days with the settings on screen — checked before turning it on.
// Uses the app's own globals: apiPost, mgrAuth, state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.ns-chips{display:flex;flex-wrap:wrap;gap:5px;max-height:150px;overflow:auto}.ns-chips button{border:1.5px solid #d1d5db;background:#fff;border-radius:99px;padding:4px 11px;font:inherit;font-size:13px;cursor:pointer}' +
    '.ns-chips button.on{background:#1b2a4a;color:#fff;border-color:#1b2a4a}' +
    '.ns-day{border:1px solid #e5e7eb;border-radius:10px;padding:7px 10px;margin-bottom:6px}.ns-day b{margin-inline-end:6px}' +
    '.ns-p{display:inline-block;background:#fee2e2;color:#991b1b;border-radius:99px;padding:2px 9px;font-size:12px;font-weight:700;margin:2px}' +
    '.ns-odd{background:#fef9c3;color:#854d0e;border-radius:8px;padding:3px 8px;font-size:12px}' +
    '</style>');

  let st = null, exempt = new Set(), exemptDepts = new Set();
  function overlay() {
    if (!$('nsOverlay')) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="nsOverlay"><div class="modal" style="max-width:760px">' +
        '<header><h3>🚫 לא התייצבו למשמרת</h3><p>עובד שהיה משובץ, לא החתים נוכחות ולא הגיש אישור מחלה או חופשה — נרשם לו יום חופש עם ההערה "לא התייצב למשמרת" (בבוקר שלמחרת, 06:00)</p></header>' +
        '<div class="mbody" id="nsBody"></div>' +
        '<div class="mfoot"><button class="btn primary" id="nsSave">שמירה</button><span class="spacer"></span><button class="btn plain" id="nsClose">סגירה</button></div></div></div>');
      $('nsClose').addEventListener('click', () => $('nsOverlay').classList.add('hidden'));
      $('nsSave').addEventListener('click', save);
    }
    $('nsOverlay').classList.remove('hidden');
    return $('nsBody');
  }
  const settings = () => ({ enabled: !!($('nsOn') && $('nsOn').checked), exempt: [...exempt], exemptDepts: [...exemptDepts] });

  async function open() {
    if (!isAdmin()) { say('אדמין בלבד', 'err'); return; }
    const body = overlay();
    body.innerHTML = '<p class="tk-meta">טוען…</p>';
    const r = await apiPost({ action: 'noShowSettings', ...mAuth() });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    st = r; exempt = new Set(r.settings.exempt); exemptDepts = new Set(r.settings.exemptDepts);
    draw();
  }
  function draw() {
    const body = $('nsBody');
    const on = st.settings.enabled;
    body.innerHTML =
      '<label style="display:flex;gap:8px;align-items:center;font-weight:800"><input type="checkbox" id="nsOn"' + (on ? ' checked' : '') + '> פעיל — לרשום ימי חופש למי שלא התייצב</label>' +
      (on ? '' : '<p class="ns-odd" style="margin:6px 0">כבוי — שום דבר לא נרשם. בודקים למטה מה היה נרשם, מוסיפים פטורים, ואז מפעילים.</p>') +
      '<div style="margin-top:10px;font-weight:700">מחלקות פטורות <span class="tk-meta">(למשל הנהלה — מי שלא מחתים נוכחות)</span></div>' +
      '<div class="ns-chips" id="nsDepts">' + st.departments.map((d) => '<button type="button" data-d="' + e(d) + '" class="' + (exemptDepts.has(d) ? 'on' : '') + '">' + e(d) + '</button>').join('') + '</div>' +
      '<div style="margin-top:10px;font-weight:700">עובדים פטורים</div><input id="nsQ" placeholder="חיפוש עובד…" style="border:1.5px solid #d1d5db;border-radius:8px;padding:6px 9px;font:inherit;margin:4px 0;width:100%;max-width:260px">' +
      '<div class="ns-chips" id="nsEmps"></div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:12px"><b>מה היה נרשם ב-7 הימים האחרונים</b><button type="button" class="btn plain" id="nsPrev" style="font-size:12px;padding:4px 10px">🔄 לפי ההגדרות על המסך</button></div>' +
      '<div id="nsPreview" style="margin-top:6px"></div><div class="merr" id="nsErr"></div>';
    const drawEmps = () => {
      const q = $('nsQ').value.trim();
      $('nsEmps').innerHTML = st.employees.filter((n) => exempt.has(n) || !q || n.includes(q)).map((n) => '<button type="button" data-n="' + e(n) + '" class="' + (exempt.has(n) ? 'on' : '') + '">' + e(n) + '</button>').join('');
      $('nsEmps').querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => { const n = b.dataset.n; exempt.has(n) ? exempt.delete(n) : exempt.add(n); b.classList.toggle('on'); }));
    };
    $('nsQ').addEventListener('input', drawEmps);
    drawEmps();
    $('nsDepts').querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { const d = b.dataset.d; exemptDepts.has(d) ? exemptDepts.delete(d) : exemptDepts.add(d); b.classList.toggle('on'); }));
    $('nsPrev').addEventListener('click', preview);
    drawPreview(st.preview);
  }
  function drawPreview(days) {
    const total = days.reduce((s, d) => s + (d.odd ? 0 : d.people.length), 0);
    $('nsPreview').innerHTML = '<p class="tk-meta">סה"כ ' + total + ' ימי חופש היו נרשמים.</p>' + days.map((d) => {
      const dt = new Date(d.date + 'T00:00:00');
      return '<div class="ns-day"><b>' + DAYS[dt.getDay()] + ' ' + d.date.slice(8, 10) + '/' + d.date.slice(5, 7) + '</b>' +
        (d.odd ? '<span class="ns-odd">⚠ ' + e(d.odd) + ' — לא היה נרשם כלום (נראה כמו נוכחות שלא נקלטה)</span>'
          : d.people.length ? d.people.map((p) => '<span class="ns-p" title="' + e(p.dept + ' ' + p.start + '–' + p.end) + '">' + e(p.employee) + ' · ' + e(p.dept) + '</span>').join('') : '<span class="tk-meta">אף אחד</span>') + '</div>';
    }).join('');
  }
  async function preview() {
    $('nsPreview').innerHTML = '<p class="tk-meta">מחשב…</p>';
    const r = await apiPost({ action: 'noShowSettings', ...mAuth(), settings: settings() });
    if (!r.ok) { $('nsErr').textContent = r.error || 'שגיאה'; return; }
    drawPreview(r.preview);
  }
  async function save() {
    const s = settings();
    if (s.enabled && !st.settings.enabled && !confirm('להפעיל? מחר ב-06:00 יירשם יום חופש "לא התייצב למשמרת" לכל מי שלא התייצב אתמול (חוץ מהפטורים).')) return;
    $('nsErr').textContent = 'שומר…';
    const r = await apiPost({ action: 'saveNoShow', ...mAuth(), settings: s });
    if (!r.ok) { $('nsErr').textContent = r.error || 'שגיאה'; return; }
    st.settings = r.settings; $('nsErr').textContent = '';
    say('ההגדרות נשמרו ✓', 'ok'); draw();
  }

  function start() {
    const drop = $('menuAttDrop');
    if (drop && !$('nsMenuBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="nsMenuBtn">🚫 לא התייצבו למשמרת</button>');
      $('nsMenuBtn').addEventListener('click', open);
      $('menuAttBtn')?.addEventListener('click', () => { $('nsMenuBtn').style.display = isAdmin() ? '' : 'none'; }, true);
    }
  }
  window.openNoShowSettings = open;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
