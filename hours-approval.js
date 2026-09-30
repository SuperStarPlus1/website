// Monthly hours approval — screens (same file in shiftfloo web/app/ and on the Superstar site; server in api/hours-approval.ts):
//   employee  a banner on the home screen while last month's report waits for approval (1st–3rd), and "אישור שעות":
//             the month day by day, "I approve", and correction requests (entry / exit of a day, a missing day, a remark)
//   manager   "נוכחות ← אישורי שעות": who approved, who not yet, and the corrections to approve or reject
// Uses the app's own globals: apiPost, mgrAuth, state, toast, effectiveBranch.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const empAuth = () => { const s = appState(); return s && s.emp ? { username: s.emp.username, password: s.emp.pw } : {}; };
  const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const fmtD = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '');
  const fmtM = (m) => (m ? m.slice(5, 7) + '/' + m.slice(0, 4) : '');
  const hm = (min) => Math.floor((min || 0) / 60) + ':' + String((min || 0) % 60).padStart(2, '0');
  const dow = (d) => DAYS[new Date(d + 'T00:00:00').getDay()];
  const STATUS_CHIP = {
    'ממתין': '<span class="ha-chip wait">⏳ ממתין לאישור העובד</span>',
    'אושר': '<span class="ha-chip ok">✓ אושר ע״י העובד</span>',
    'אושר אוטומטית': '<span class="ha-chip auto">אושר אוטומטית</span>',
  };
  const C_CHIP = { 'ממתין': '<span class="ha-chip wait">ממתין למנהל</span>', 'אושר': '<span class="ha-chip ok">אושר</span>', 'נדחה': '<span class="ha-chip no">נדחה</span>' };

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.ha-chip{display:inline-block;border-radius:99px;padding:2px 9px;font-size:11.5px;font-weight:700;white-space:nowrap}' +
    '.ha-chip.wait{background:#fef3c7;color:#92400e}.ha-chip.ok{background:#dcfce7;color:#166534}.ha-chip.auto{background:#e5e7eb;color:#374151}.ha-chip.no{background:#fee2e2;color:#991b1b}' +
    '.ha-banner{margin:10px 0;background:#fff7ed;border:2px solid #fb923c;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}' +
    '.ha-banner b{color:#9a3412}' +
    '.ha-banner button,.ha-btn{border:0;border-radius:10px;padding:9px 14px;font:inherit;font-weight:800;font-size:13.5px;cursor:pointer;background:#1b2a4a;color:#fff}' +
    '.ha-btn.plain{background:#f1f5f9;color:#1f2937}.ha-btn.ok{background:#16a34a}.ha-btn.no{background:#dc2626}.ha-btn.sm{padding:5px 10px;font-size:12px}' +
    '.ha-table{width:100%;border-collapse:collapse;font-size:13px}' +
    '.ha-table th{background:#f8fafc;font-size:11.5px;color:#6b7280;text-align:right;padding:6px}' +
    '.ha-table td{border-top:1px solid #e5e7eb;padding:6px;vertical-align:top}' +
    '.ha-form{background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:10px;margin:10px 0;display:grid;gap:8px}' +
    '.ha-form label{display:grid;gap:3px;font-size:12px;font-weight:700;color:#374151}' +
    '.ha-form input,.ha-form select,.ha-form textarea{border:1.5px solid #d1d5db;border-radius:8px;padding:7px 9px;font:inherit;font-size:14px}' +
    '.ha-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
    '.ha-emp{border:1px solid #e5e7eb;border-radius:12px;padding:10px;margin-bottom:8px}' +
    '.ha-corr{background:#f8fafc;border-radius:10px;padding:8px;margin-top:6px;font-size:13px;display:grid;gap:5px}' +
    '</style>');

  function overlay(id, title) {
    if ($(id)) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="overlay hidden" id="' + id + '"><div class="modal" style="max-width:760px">' +
      '<header><h3>' + title + '</h3><p id="' + id + 'Sub"></p></header>' +
      '<div class="mbody" id="' + id + 'Body"></div>' +
      '<div class="mfoot"><button class="btn plain" data-close>סגירה</button></div></div></div>');
    $(id).querySelector('[data-close]').addEventListener('click', () => $(id).classList.add('hidden'));
  }

  /* ================= employee ================= */
  let mine = null;   // { approval, corrections, today }
  async function fetchMine() {
    const s = appState();
    if (!s || !s.emp) return null;
    try { const r = await apiPost({ action: 'myHoursApproval', ...empAuth() }); if (r.ok) mine = r; } catch (_) { /* offline: keep the last one */ }
    return mine;
  }
  function drawBanner() {
    const home = $('empHome');
    if (!home) return;
    let b = $('haBanner');
    const a = mine && mine.approval;
    const pending = a && a.status === 'ממתין';
    if (!pending) { if (b) b.remove(); return; }
    if (!b) {
      const at = $('ehNext') || home.querySelector('.eh-card');
      (at || home).insertAdjacentHTML(at ? 'afterend' : 'afterbegin', '<div class="ha-banner" id="haBanner"></div>');
      b = $('haBanner');
    }
    b.innerHTML = '<div><b>📋 דוח השעות של ' + e(fmtM(a.month)) + ' ממתין לאישורך</b><div style="font-size:12.5px;color:#7c2d12">עד ' + e(fmtD(a.deadline)) +
      ' · לאחר מכן השעות יירשמו כפי שהן</div></div><button type="button" id="haBannerBtn">לצפייה ואישור</button>';
    $('haBannerBtn').addEventListener('click', openMine);
  }
  async function refreshHome() { await fetchMine(); drawBanner(); }

  async function openMine() {
    overlay('haMineOverlay', '📋 אישור דוח שעות');
    const body = $('haMineOverlayBody');
    $('haMineOverlay').classList.remove('hidden');
    body.innerHTML = 'טוען…';
    await fetchMine();
    const a = mine && mine.approval;
    if (!a) { $('haMineOverlaySub').textContent = ''; body.innerHTML = '<p style="color:var(--muted,#6b7280)">אין דוח שעות לאישור. הדוח של החודש הקודם נשלח לאישורך ב-1 לכל חודש.</p>'; return; }
    const r = await apiPost({ action: 'myAttendance', ...empAuth(), month: a.month });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const open = a.status === 'ממתין' && mine.today <= a.deadline;
    $('haMineOverlaySub').innerHTML = 'חודש ' + e(fmtM(a.month)) + ' · ' + (STATUS_CHIP[a.status] || e(a.status)) +
      (a.status === 'ממתין' ? ' · לאישור עד ' + e(fmtD(a.deadline)) : '');
    const cs = mine.corrections || [];
    const byDate = {};
    cs.forEach((c) => (byDate[c.date] = byDate[c.date] || []).push(c));
    const inOut = (evs) => {
      const live = (evs || []).filter((x) => x.status !== 'נדחה' && x.status !== 'ממתין לאישור');
      const i = live.find((x) => x.type === 'כניסה'), o = [...live].reverse().find((x) => x.type === 'יציאה');
      return { i: i ? i.time.slice(0, 5) : '—', o: o ? o.time.slice(0, 5) : '—' };
    };
    const rows = (r.days || []).map((d) => {
      const t = inOut(d.events);
      const cc = (byDate[d.date] || []).map((c) => C_CHIP[c.status] || '').join(' ');
      return '<tr><td>' + dow(d.date) + ' ' + fmtD(d.date) + '</td><td>' + t.i + '</td><td>' + t.o + '</td><td><b>' + hm(d.minutes) + '</b>' +
        (d.complete ? '' : ' <span style="color:#b91c1c;font-size:11px">חסר דיווח</span>') + '</td><td>' + cc +
        (open ? ' <button type="button" class="ha-btn plain sm" data-fix="' + d.date + '" data-i="' + (t.i === '—' ? '' : t.i) + '" data-o="' + (t.o === '—' ? '' : t.o) + '">✏ תיקון</button>' : '') +
        '</td></tr>';
    }).join('');
    const corrList = cs.length ? '<div style="font-weight:800;margin:14px 0 6px">בקשות התיקון שלי</div>' + cs.map((c) =>
      '<div class="ha-corr"><div>' + dow(c.date) + ' ' + fmtD(c.date) + ' · <b>' + e(c.kind) + '</b>' +
      (c.entry ? ' · כניסה ' + e(c.entry) : '') + (c.exit ? ' · יציאה ' + e(c.exit) : '') + ' · ' + (C_CHIP[c.status] || '') +
      (c.status === 'ממתין' && open ? ' <button type="button" class="ha-btn plain sm" data-del="' + c.id + '">מחיקה</button>' : '') + '</div>' +
      '<div style="color:#374151">' + e(c.note) + '</div>' +
      (c.reviewNote ? '<div style="color:#6b7280">הערת המנהל: ' + e(c.reviewNote) + '</div>' : '') + '</div>').join('') : '';
    body.innerHTML =
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><div style="font-size:15px">סה"כ בחודש: <b>' + hm(r.totalMinutes) + '</b> שעות</div>' +
      (open ? '<button type="button" class="ha-btn plain sm" id="haMissing">+ יום שחסר בדוח</button><button type="button" class="ha-btn plain sm" id="haNote">+ הערה ליום</button>' : '') + '</div>' +
      '<div id="haForm"></div>' +
      '<div style="overflow-x:auto"><table class="ha-table"><tr><th>יום</th><th>כניסה</th><th>יציאה</th><th>שעות</th><th></th></tr>' +
      (rows || '<tr><td colspan="5" style="color:#6b7280">אין דיווחים בחודש זה</td></tr>') + '</table></div>' + corrList +
      (open ? '<div style="margin-top:14px;display:grid;gap:6px"><button type="button" class="ha-btn ok" id="haApprove" style="padding:13px;font-size:15px">✅ אני מאשר/ת את דוח השעות</button>' +
        '<div style="font-size:12px;color:#6b7280">אפשר לאשר גם כשיש בקשות תיקון — הן יירשמו רק אחרי אישור המנהל. אחרי האישור לא ניתן להוסיף תיקונים.</div></div>'
        : a.status === 'ממתין' ? '' : '<p style="margin-top:12px;color:#6b7280">הדוח נסגר (' + e(a.status) + '). תיקונים שעוד ממתינים יטופלו על ידי המנהל.</p>');
    body.querySelectorAll('[data-fix]').forEach((btn) => btn.addEventListener('click', () => showForm(a.month, 'שעות', btn.dataset.fix, btn.dataset.i, btn.dataset.o)));
    if ($('haMissing')) $('haMissing').addEventListener('click', () => showForm(a.month, 'יום חסר', '', '', ''));
    if ($('haNote')) $('haNote').addEventListener('click', () => showForm(a.month, 'הערה', '', '', ''));
    body.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', async () => {
      const x = await apiPost({ action: 'deleteHoursCorrection', ...empAuth(), id: Number(btn.dataset.del) });
      if (!x.ok) return say(x.error || 'שגיאה', 'err');
      say('הבקשה נמחקה', 'ok'); openMine();
    }));
    if ($('haApprove')) $('haApprove').addEventListener('click', async () => {
      const btn = $('haApprove'); btn.disabled = true;
      const x = await apiPost({ action: 'approveMyHours', ...empAuth(), month: a.month });
      btn.disabled = false;
      if (!x.ok) return say(x.error || 'שגיאה', 'err');
      say('דוח השעות אושר ✓', 'ok'); await openMine(); drawBanner();
    });
  }

  function showForm(month, kind, date, entry, exit) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const box = $('haForm');
    box.innerHTML = '<div class="ha-form">' +
      '<div style="font-weight:800">' + (kind === 'שעות' ? '✏ תיקון שעות ליום ' + fmtD(date) : kind === 'יום חסר' ? '+ יום שחסר בדוח' : '+ הערה ליום') + '</div>' +
      (kind === 'שעות' ? '<input type="hidden" id="haDate" value="' + date + '">'
        : '<label>תאריך<input type="date" id="haDate" min="' + month + '-01" max="' + month + '-' + String(last).padStart(2, '0') + '"></label>') +
      (kind !== 'הערה' ? '<div class="ha-row2"><label>שעת כניסה' + (kind === 'שעות' && entry ? ' (בדוח: ' + entry + ')' : '') + '<input type="time" id="haIn" value="' + e(entry) + '"></label>' +
        '<label>שעת יציאה' + (kind === 'שעות' && exit ? ' (בדוח: ' + exit + ')' : '') + '<input type="time" id="haOut" value="' + e(exit) + '"></label></div>' : '') +
      '<label>' + (kind === 'הערה' ? 'ההערה' : 'סיבת התיקון') + '<textarea id="haWhy" rows="2" maxlength="500"></textarea></label>' +
      '<div style="display:flex;gap:8px"><button type="button" class="ha-btn" id="haSend">שליחה לאישור המנהל</button><button type="button" class="ha-btn plain" id="haCancel">ביטול</button></div>' +
      '<div class="merr" id="haErr"></div></div>';
    box.scrollIntoView({ block: 'nearest' });
    $('haCancel').addEventListener('click', () => (box.innerHTML = ''));
    $('haSend').addEventListener('click', async () => {
      const inp = $('haIn'), out = $('haOut');
      const req = { action: 'addHoursCorrection', ...empAuth(), month, kind, date: $('haDate').value,
        entry: inp ? inp.value : '', exit: out ? out.value : '', note: $('haWhy').value.trim() };
      // for a time fix only what changed is sent
      if (kind === 'שעות') { if (req.entry === entry) req.entry = ''; if (req.exit === exit) req.exit = ''; }
      if (kind === 'שעות' && !req.entry && !req.exit) { $('haErr').textContent = 'לא שונתה אף שעה'; return; }
      $('haSend').disabled = true; $('haErr').textContent = 'שולח…';
      const x = await apiPost(req);
      $('haSend').disabled = false;
      if (!x.ok) { $('haErr').textContent = x.error || 'שגיאה'; return; }
      say('הבקשה נשלחה למנהל', 'ok'); openMine();
    });
  }

  /* ================= manager ================= */
  async function openMgr() {
    overlay('haMgrOverlay', '📋 אישורי דוחות שעות');
    $('haMgrOverlay').classList.remove('hidden');
    const sub = $('haMgrOverlaySub');
    if (!$('haMonth')) {
      const opts = [];
      const d = new Date();
      for (let i = 1; i <= 12; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); const v = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); opts.push('<option value="' + v + '">' + fmtM(v) + '</option>'); }
      sub.innerHTML = 'חודש: <select id="haMonth" data-search style="border:1.5px solid #d1d5db;border-radius:8px;padding:5px 8px;font:inherit">' + opts.join('') + '</select>' +
        ' <span style="font-size:12px">העובד מאשר עד ה-3 לחודש; מי שלא אישר — אושר אוטומטית. תיקון נרשם רק לאחר אישור מנהל.</span>';
      $('haMonth').addEventListener('change', loadMgr);
    }
    await loadMgr();
  }
  async function loadMgr() {
    const body = $('haMgrOverlayBody');
    body.innerHTML = 'טוען…';
    const branch = typeof effectiveBranch === 'function' ? effectiveBranch() : '';
    const r = await apiPost({ action: 'listHoursApprovals', ...mgrAuth(), month: $('haMonth').value, branch: branch || undefined });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const list = r.approvals || [];
    if (!list.length) { body.innerHTML = '<p style="color:#6b7280">אין דוחות שעות לחודש זה (הדוח נפתח לאישור העובדים ב-1 לחודש שאחריו).</p>'; return; }
    const cnt = (st) => list.filter((a) => a.status === st).length;
    const openC = list.reduce((n, a) => n + a.corrections.filter((c) => c.status === 'ממתין').length, 0);
    // corrections waiting for a decision first, then the rest by name
    list.sort((a, b) => (b.corrections.some((c) => c.status === 'ממתין') - a.corrections.some((c) => c.status === 'ממתין')) || a.employee.localeCompare(b.employee, 'he'));
    body.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;font-size:13px">' +
      '<span class="ha-chip ok">אישרו: ' + cnt('אושר') + '</span><span class="ha-chip wait">ממתינים: ' + cnt('ממתין') + '</span>' +
      '<span class="ha-chip auto">אושרו אוטומטית: ' + cnt('אושר אוטומטית') + '</span>' +
      (openC ? '<span class="ha-chip no">תיקונים לטיפולך: ' + openC + '</span>' : '') + '</div>' +
      list.map((a) => '<div class="ha-emp"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>' + e(a.employee) + '</b><span>' +
        (STATUS_CHIP[a.status] || '') + ' <span style="font-size:12px;color:#6b7280">' + hm(a.minutes) + ' ש׳ בדוח שנשלח' +
        (a.status === 'ממתין' ? ' · עד ' + fmtD(a.deadline) : '') + '</span></span></div>' +
        a.corrections.map((c) => '<div class="ha-corr" data-cid="' + c.id + '"><div>' + dow(c.date) + ' ' + fmtD(c.date) + ' · <b>' + e(c.kind) + '</b> · ' + (C_CHIP[c.status] || '') + '</div>' +
          (c.kind !== 'הערה' ? '<div>' + (c.kind === 'יום חסר' ? 'מבוקש: ' : 'בדוח: ' + e(c.current.entry || '—') + '–' + e(c.current.exit || '—') + ' ← מבוקש: ') +
            '<b>' + e(c.entry || c.current.entry || '—') + '–' + e(c.exit || c.current.exit || '—') + '</b></div>' : '') +
          '<div style="color:#374151">' + e(c.note) + '</div>' +
          (c.status === 'ממתין' ? '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><input type="text" class="ha-rnote" placeholder="הערה לעובד (לא חובה)" maxlength="300" ' +
            'style="flex:1;min-width:140px;border:1.5px solid #d1d5db;border-radius:8px;padding:5px 8px;font:inherit;font-size:13px">' +
            '<button type="button" class="ha-btn ok sm" data-ok="1">אישור</button><button type="button" class="ha-btn no sm" data-ok="0">דחייה</button></div>'
            : (c.reviewedBy ? '<div style="color:#6b7280;font-size:12px">' + e(c.status) + ' ע״י ' + e(c.reviewedBy) + (c.reviewNote ? ' · ' + e(c.reviewNote) : '') + '</div>' : '')) +
          '</div>').join('') + '</div>').join('');
    body.querySelectorAll('.ha-corr [data-ok]').forEach((btn) => btn.addEventListener('click', async () => {
      const box = btn.closest('.ha-corr');
      box.querySelectorAll('button').forEach((b) => (b.disabled = true));
      const x = await apiPost({ action: 'reviewHoursCorrection', ...mgrAuth(), id: Number(box.dataset.cid), approve: btn.dataset.ok === '1',
        note: box.querySelector('.ha-rnote').value.trim() });
      if (!x.ok) { box.querySelectorAll('button').forEach((b) => (b.disabled = false)); return say(x.error || 'שגיאה', 'err'); }
      say(btn.dataset.ok === '1' ? 'התיקון אושר והשעות עודכנו' : 'התיקון נדחה', 'ok');
      loadMgr();
    }));
  }

  /* ================= wiring ================= */
  function start() {
    const drop = $('menuAttDrop');
    if (drop && !$('haMgrBtn')) {
      const cons = $('consBtn');
      const html = '<button id="haMgrBtn">📋 אישורי שעות</button>';
      if (cons) cons.insertAdjacentHTML('beforebegin', html); else drop.insertAdjacentHTML('beforeend', html);
      $('haMgrBtn').addEventListener('click', openMgr);
    }
    const links = document.querySelector('#empHome .eh-links');
    if (links && !$('ehHours')) {
      links.insertAdjacentHTML('beforeend', '<button data-go="hours" id="ehHours"><span class="ic">📋</span>אישור שעות</button>');
      $('ehHours').addEventListener('click', () => { if (appState() && appState().emp) openMine(); });
    }
    // the banner follows the employee home screen: fetched whenever it is shown
    const home = $('empHome');
    if (home) {
      let shown = !home.classList.contains('hidden');
      if (shown) refreshHome();
      new MutationObserver(() => { const now = !home.classList.contains('hidden'); if (now && !shown) refreshHome(); shown = now; })
        .observe(home, { attributes: true, attributeFilter: ['class'] });
    }
  }
  window.openHoursApproval = openMine;
  window.openHoursApprovals = openMgr;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
