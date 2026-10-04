// Monthly hours approval — screens (same file in shiftfloo web/app/ and on the Superstar site; server in api/hours-approval.ts):
//   employee  "אישור שעות": the current month (approved as it goes — "up to yesterday") and last month until the 3rd, day
//             by day, with correction requests (entry / exit of a day, a missing day, a remark); a home-screen banner while
//             last month still waits for approval
//   manager   "נוכחות ← אישורי שעות": who approved, who not yet, and the corrections to approve or reject
//   admin     on the same screen: "📤 סגירת החודש לשכר" — after checking everyone's hours, a detailed PDF + an Excel summary
//             go to the payroll e-mails (api/payroll.ts)
// Uses the app's own globals: apiPost, mgrAuth, state, toast, effectiveBranch, openBlobPdf.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const isAdminNow = () => { const s = appState(); return !!(s && s.mgr && s.mgr.role === 'אדמין'); };
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
    '.ha-table{width:100%;min-width:0;border-collapse:collapse;font-size:13px}' +
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
    const a = mine && mine.approval;                  // last month, while it waits for approval
    const pending = a && a.status === 'ממתין';
    if (!pending) { if (b) b.remove(); return; }
    if (!b) {
      const at = $('ehNext') || home.querySelector('.eh-card');
      (at || home).insertAdjacentHTML(at ? 'afterend' : 'afterbegin', '<div class="ha-banner" id="haBanner"></div>');
      b = $('haBanner');
    }
    b.innerHTML = '<div><b>📋 דוח השעות של ' + e(fmtM(a.month)) + ' ממתין לאישורך</b><div style="font-size:12.5px;color:#7c2d12">עד ' + e(fmtD(a.deadline)) +
      ' · לאחר מכן השעות יירשמו כפי שהן</div></div><button type="button" id="haBannerBtn">לצפייה ואישור</button>';
    $('haBannerBtn').addEventListener('click', () => openMine(a.month));
  }
  async function refreshHome() { await fetchMine(); drawBanner(); }

  let pick = '';     // the month shown in the employee window
  async function openMine(month) {
    overlay('haMineOverlay', '📋 אישור שעות');
    const body = $('haMineOverlayBody');
    $('haMineOverlay').classList.remove('hidden');
    body.innerHTML = 'טוען…';
    await fetchMine();
    const months = (mine && mine.months) || [];
    if (!months.length) { $('haMineOverlaySub').textContent = ''; body.innerHTML = '<p style="color:var(--muted,#6b7280)">אין דוח שעות לאישור.</p>'; return; }
    // last month first while it waits for approval, otherwise the current month
    const urgent = months.find((m) => m.month < mine.today.slice(0, 7) && m.status === 'ממתין');
    pick = (typeof month === 'string' && months.some((m) => m.month === month)) ? month : (urgent || months[months.length - 1]).month;
    const a = months.find((m) => m.month === pick);
    const r = await apiPost({ action: 'myAttendance', ...empAuth(), month: a.month });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const open = a.status === 'ממתין' && mine.today <= a.deadline;
    const thru = a.approvedThrough || '';
    const canApprove = open && a.approvable && thru < a.approvable;
    const whole = a.approvable && a.approvable.slice(8) === String(new Date(+a.month.slice(0, 4), +a.month.slice(5, 7), 0).getDate()).padStart(2, '0');
    $('haMineOverlaySub').innerHTML = (months.length > 1 ? months.map((m) =>
      '<button type="button" class="ha-btn sm ' + (m.month === pick ? '' : 'plain') + '" data-month="' + m.month + '">' + fmtM(m.month) +
      (m.status === 'ממתין' && m.month < mine.today.slice(0, 7) ? ' ⏳' : '') + '</button>').join(' ') + ' ' : '') +
      (STATUS_CHIP[a.status] || e(a.status)) +
      (a.status === 'ממתין' ? (thru ? ' · אישרת עד ' + e(fmtD(thru)) : '') + ' · לאישור סופי עד ' + e(fmtD(a.deadline)) : '');
    $('haMineOverlaySub').querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => openMine(b.dataset.month)));
    const cs = a.corrections || [];
    const byDate = {};
    cs.forEach((c) => (byDate[c.date] = byDate[c.date] || []).push(c));
    const inOut = (evs) => {
      const live = (evs || []).filter((x) => x.status !== 'נדחה' && x.status !== 'ממתין לאישור');
      const i = live.find((x) => x.type === 'כניסה'), o = [...live].reverse().find((x) => x.type === 'יציאה');
      return { i: i ? i.time.slice(0, 5) : '—', o: o ? o.time.slice(0, 5) : '—' };
    };
    // days with punches and approved sick / vacation days (marks), in date order
    const all = [...(r.days || []).map((d) => ({ d })), ...(r.marks || []).map((m) => ({ m }))]
      .sort((x, y) => (x.d || x.m).date.localeCompare((y.d || y.m).date));
    const rows = all.map(({ d, m }) => {
      if (m) return '<tr><td>' + dow(m.date) + ' ' + fmtD(m.date) + '</td><td colspan="4" style="font-weight:800;color:' +
        (m.type === 'מחלה' ? '#b45309' : '#1d4ed8') + '">' + (m.type === 'מחלה' ? '🤒 יום מחלה' : '🏖 יום חופש') + '</td></tr>';
      const t = inOut(d.events);
      const cc = (byDate[d.date] || []).map((c) => C_CHIP[c.status] || '').join(' ');
      const ok = a.status !== 'ממתין' || (thru && d.date <= thru);
      return '<tr><td>' + dow(d.date) + ' ' + fmtD(d.date) + '</td><td>' + t.i + '</td><td>' + t.o + '</td><td><b>' + hm(d.minutes) + '</b>' +
        (d.complete ? '' : ' <span style="color:#b91c1c;font-size:11px">חסר דיווח</span>') + '</td><td>' +
        (ok ? '<span class="ha-chip ok">✓ אושר</span> ' : '') + cc +
        (open && d.date <= mine.today ? ' <button type="button" class="ha-btn plain sm" data-fix="' + d.date + '" data-i="' + (t.i === '—' ? '' : t.i) + '" data-o="' + (t.o === '—' ? '' : t.o) + '">✏ תיקון</button>' : '') +
        '</td></tr>';
    }).join('');
    const corrList = cs.length ? '<div style="font-weight:800;margin:14px 0 6px">בקשות התיקון שלי</div>' + cs.map((c) =>
      '<div class="ha-corr"><div>' + dow(c.date) + ' ' + fmtD(c.date) + ' · <b>' + e(c.kind) + '</b>' +
      (c.entry ? ' · כניסה ' + e(c.entry) : '') + (c.exit ? ' · יציאה ' + e(c.exit) : '') + ' · ' + (C_CHIP[c.status] || '') +
      (c.status === 'ממתין' && open ? ' <button type="button" class="ha-btn plain sm" data-del="' + c.id + '">מחיקה</button>' : '') + '</div>' +
      '<div style="color:#374151">' + e(c.note) + '</div>' +
      (c.reviewNote ? '<div style="color:#6b7280">הערת המנהל: ' + e(c.reviewNote) + '</div>' : '') + '</div>').join('') : '';
    const approveLabel = whole ? '✅ אני מאשר/ת את שעות כל החודש' : '✅ אני מאשר/ת את השעות עד ' + fmtD(a.approvable);
    body.innerHTML =
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><div style="font-size:15px">סה"כ עד כה: <b>' + hm(r.totalMinutes) + '</b> שעות</div>' +
      '<button type="button" class="ha-btn plain sm" id="haPdf">📄 PDF של ההחתמות</button>' +
      (open ? '<button type="button" class="ha-btn plain sm" id="haMissing">+ יום שחסר בדוח</button><button type="button" class="ha-btn plain sm" id="haNote">+ הערה ליום</button>' : '') + '</div>' +
      '<div id="haForm"></div>' +
      '<div style="overflow-x:auto"><table class="ha-table"><tr><th>יום</th><th>כניסה</th><th>יציאה</th><th>שעות</th><th></th></tr>' +
      (rows || '<tr><td colspan="5" style="color:#6b7280">אין דיווחים בחודש זה עדיין</td></tr>') + '</table></div>' + corrList +
      (canApprove ? '<div style="margin-top:14px;display:grid;gap:6px"><button type="button" class="ha-btn ok" id="haApprove" style="padding:13px;font-size:15px">' + approveLabel + '</button>' +
        '<div style="font-size:12px;color:#6b7280">אפשר לאשר במהלך החודש, בכל פעם עד אתמול; האישור הסופי של החודש — עד ' + fmtD(a.deadline) +
        '. בקשות תיקון נרשמות רק אחרי אישור המנהל, ואפשר להגיש אותן עד ' + fmtD(a.deadline) + '.</div></div>'
        : open && thru && thru >= (a.approvable || '') ? '<p style="margin-top:12px;color:#166534;font-weight:700">✓ אישרת את השעות עד ' + fmtD(thru) + '. אפשר להמשיך לאשר כשיתווספו ימים.</p>'
        : a.status !== 'ממתין' ? '<p style="margin-top:12px;color:#6b7280">החודש נסגר (' + e(a.status) + '). תיקונים שעוד ממתינים יטופלו על ידי המנהל.</p>' : '');
    body.querySelectorAll('[data-fix]').forEach((btn) => btn.addEventListener('click', () => showForm(a.month, 'שעות', btn.dataset.fix, btn.dataset.i, btn.dataset.o)));
    $('haPdf').addEventListener('click', () => downloadPdf({ action: 'myHoursPdf', ...empAuth(), month: a.month }, $('haPdf')));
    if ($('haMissing')) $('haMissing').addEventListener('click', () => showForm(a.month, 'יום חסר', '', '', ''));
    if ($('haNote')) $('haNote').addEventListener('click', () => showForm(a.month, 'הערה', '', '', ''));
    body.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', async () => {
      const x = await apiPost({ action: 'deleteHoursCorrection', ...empAuth(), id: Number(btn.dataset.del) });
      if (!x.ok) return say(x.error || 'שגיאה', 'err');
      say('הבקשה נמחקה', 'ok'); openMine(pick);
    }));
    if ($('haApprove')) $('haApprove').addEventListener('click', async () => {
      const btn = $('haApprove'); btn.disabled = true;
      const x = await apiPost({ action: 'approveMyHours', ...empAuth(), month: a.month });
      btn.disabled = false;
      if (!x.ok) return say(x.error || 'שגיאה', 'err');
      say(x.status === 'אושר' ? 'השעות של כל החודש אושרו ✓' : 'השעות אושרו עד ' + fmtD(x.approvedThrough) + ' ✓', 'ok');
      await openMine(pick); drawBanner();
    });
  }

  /** the month's punches as a PDF (built on the server) */
  async function downloadPdf(req, btn) {
    const was = btn.textContent; btn.disabled = true; btn.textContent = 'מכין PDF…';
    try {
      const x = await apiPost(req);
      if (!x.ok) return say(x.error || 'שגיאה', 'err');
      if (typeof openBlobPdf === 'function') openBlobPdf(x.data, x.filename);
    } finally { btn.disabled = false; btn.textContent = was; }
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
      say('הבקשה נשלחה למנהל', 'ok'); openMine(pick);
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
    if (!list.length) { body.innerHTML = '<p style="color:#6b7280">אין דוחות שעות לחודש זה (הדוח נפתח לאישור העובדים ב-1 לחודש שאחריו).</p>'; payrollPanel(); return; }
    const cnt = (st) => list.filter((a) => a.status === st).length;
    const openC = list.reduce((n, a) => n + a.corrections.filter((c) => c.status === 'ממתין').length, 0);
    // corrections waiting for a decision first, then the rest by name
    list.sort((a, b) => (b.corrections.some((c) => c.status === 'ממתין') - a.corrections.some((c) => c.status === 'ממתין')) || a.employee.localeCompare(b.employee, 'he'));
    body.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;font-size:13px">' +
      '<span class="ha-chip ok">אישרו: ' + cnt('אושר') + '</span><span class="ha-chip wait">ממתינים: ' + cnt('ממתין') + '</span>' +
      '<span class="ha-chip auto">אושרו אוטומטית: ' + cnt('אושר אוטומטית') + '</span>' +
      (openC ? '<span class="ha-chip no">תיקונים לטיפולך: ' + openC + '</span>' : '') +
      (isAdminNow() && cnt('ממתין') ? '<button type="button" class="ha-btn plain sm" id="haResend">✉ שליחה חוזרת עם PDF ל-' + cnt('ממתין') + ' שלא אישרו</button>' : '') + '</div>' +
      list.map((a) => '<div class="ha-emp"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>' + e(a.employee) +
        ' <button type="button" class="ha-btn plain sm" data-pdf="' + e(a.employee) + '">📄 PDF</button></b><span>' +
        (STATUS_CHIP[a.status] || '') + ' <span style="font-size:12px;color:#6b7280">' + hm(a.minutes) + ' ש׳ בדוח שנשלח' +
        (a.status === 'ממתין' ? (a.approvedThrough ? ' · אישר עד ' + fmtD(a.approvedThrough) : '') + ' · עד ' + fmtD(a.deadline) : '') + '</span></span></div>' +
        a.corrections.map((c) => '<div class="ha-corr" data-cid="' + c.id + '"><div>' + dow(c.date) + ' ' + fmtD(c.date) + ' · <b>' + e(c.kind) + '</b> · ' + (C_CHIP[c.status] || '') + '</div>' +
          (c.kind !== 'הערה' ? '<div>' + (c.kind === 'יום חסר' ? 'מבוקש: ' : 'בדוח: ' + e(c.current.entry || '—') + '–' + e(c.current.exit || '—') + ' ← מבוקש: ') +
            '<b>' + e(c.entry || c.current.entry || '—') + '–' + e(c.exit || c.current.exit || '—') + '</b></div>' : '') +
          '<div style="color:#374151">' + e(c.note) + '</div>' +
          (c.status === 'ממתין' ? '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><input type="text" class="ha-rnote" placeholder="הערה לעובד (לא חובה)" maxlength="300" ' +
            'style="flex:1;min-width:140px;border:1.5px solid #d1d5db;border-radius:8px;padding:5px 8px;font:inherit;font-size:13px">' +
            '<button type="button" class="ha-btn ok sm" data-ok="1">אישור</button><button type="button" class="ha-btn no sm" data-ok="0">דחייה</button></div>'
            : (c.reviewedBy ? '<div style="color:#6b7280;font-size:12px">' + e(c.status) + ' ע״י ' + e(c.reviewedBy) + (c.reviewNote ? ' · ' + e(c.reviewNote) : '') + '</div>' : '')) +
          '</div>').join('') + '</div>').join('');
    payrollPanel();
    if ($('haResend')) $('haResend').addEventListener('click', async () => {
      if (!confirm('לשלוח שוב את דוח השעות של ' + fmtM($('haMonth').value) + ' עם קובץ PDF של ההחתמות לכל העובדים שעוד לא אישרו (ויש להם מייל)?')) return;
      const btn = $('haResend'); btn.disabled = true; btn.textContent = 'שולח…';
      const x = await apiPost({ action: 'resendHoursRequests', ...mgrAuth(), month: $('haMonth').value });
      btn.disabled = false;
      if (!x.ok) { btn.textContent = '✉ שליחה חוזרת'; return say(x.error || 'שגיאה', 'err'); }
      btn.textContent = '✓ נשלח ל-' + x.sent + ' עובדים';
      say('נשלח שוב ל-' + x.sent + ' עובדים, עם PDF', 'ok');
    });
    body.querySelectorAll('[data-pdf]').forEach((btn) => btn.addEventListener('click', () =>
      downloadPdf({ action: 'mgrHoursPdf', ...mgrAuth(), employee: btn.dataset.pdf, month: $('haMonth').value }, btn)));
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


  /* ---------- admin: the month for payroll ---------- */
  function saveFile(b64, filename, mime) {
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function payrollPanel() {
    if (!isAdminNow()) return;
    const body = $('haMgrOverlayBody'), month = $('haMonth').value;
    body.insertAdjacentHTML('afterbegin', '<div id="haPay" class="ha-form" style="border:2px solid #1b2a4a;background:#f8fafc;margin-top:0">טוען את מצב החודש לשכר…</div>');
    const box = $('haPay');
    const r = await apiPost({ action: 'payrollStatus', ...mgrAuth(), month });
    if ($('haMonth').value !== month || !box.isConnected) return;
    if (!r.ok) { box.innerHTML = '<span class="merr">' + e(r.error || 'שגיאה') + '</span>'; return; }
    const block = r.openCorrections || r.pendingPunches;
    const chips = '<span class="ha-chip auto">' + r.employees + ' עובדים עם שעות</span>' +
      (r.notApproved.length ? '<span class="ha-chip wait">' + r.notApproved.length + ' עוד לא אישרו</span>' : '<span class="ha-chip ok">כל העובדים אישרו</span>') +
      (r.openCorrections ? '<span class="ha-chip no">' + r.openCorrections + ' תיקונים ממתינים</span>' : '') +
      (r.pendingPunches ? '<span class="ha-chip no">' + r.pendingPunches + ' הזנות ידניות ממתינות</span>' : '');
    box.innerHTML = '<b style="font-size:15px">📤 סגירת החודש לשכר — ' + fmtM(month) + '</b>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + chips + '</div>' +
      (r.closing ? '<div style="background:#dcfce7;border-radius:10px;padding:8px;font-size:13px">✓ נשלח לשכר ב-' + e(r.closing.approvedAt) + ' · אישר/ה: <b>' + e(r.closing.approvedBy) + '</b> · אל ' + e(r.closing.sentTo) +
        ' · ' + r.closing.employees + ' עובדים <button type="button" class="ha-btn plain sm" id="haPayPdf">📄 PDF</button> <button type="button" class="ha-btn plain sm" id="haPayXlsx">📊 אקסל</button></div>' : '') +
      (r.currentMonth ? '<div style="font-size:13px;color:#6b7280">אפשר לסגור לשכר אחרי שהחודש מסתיים.</div>' :
        '<label>מייל חשב/ת שכר / רואה חשבון (כמה כתובות — פסיק)<input type="text" id="haPayEmails" dir="ltr" value="' + e(r.emails) + '" placeholder="payroll@example.com"></label>' +
        '<label style="display:flex;gap:8px;align-items:flex-start;font-weight:700"><input type="checkbox" id="haPayOk" style="margin-top:3px"' + (block ? ' disabled' : '') + '>' +
        '<span>בדקתי ואני מאשר/ת את שעות כל העובדים לחודש ' + fmtM(month) + '. יישלחו: PDF מפורט (עם שמי ותאריך האישור) ודוח אקסל מרוכז.</span></label>' +
        (block ? '<div class="merr" style="font-size:13px">לפני השליחה יש לטפל בבקשות שממתינות (תיקונים למטה; הזנות ידניות — נוכחות ← דוח חודשי).</div>' : '') +
        '<div><button type="button" class="ha-btn ok" id="haPayGo"' + (block ? ' disabled' : '') + '>' + (r.closing ? '🔁 אישור ושליחה מחדש' : '📤 אישור ושליחה לשכר') + '</button></div>');
    if ($('haPayPdf')) $('haPayPdf').addEventListener('click', () => payFile('pdf', $('haPayPdf')));
    if ($('haPayXlsx')) $('haPayXlsx').addEventListener('click', () => payFile('xlsx', $('haPayXlsx')));
    if ($('haPayGo')) $('haPayGo').addEventListener('click', () => sendPayroll(false));
    async function payFile(kind, btn) {
      const was = btn.textContent; btn.disabled = true; btn.textContent = 'טוען…';
      const x = await apiPost({ action: 'payrollFile', ...mgrAuth(), month, kind });
      btn.disabled = false; btn.textContent = was;
      if (!x.ok) return say(x.error || 'שגיאה', 'err');
      saveFile(x.data, x.filename, x.mimeType);
    }
    async function sendPayroll(includeUnapproved) {
      if (!$('haPayOk').checked) return say('יש לסמן שבדקת ואישרת את השעות', 'err');
      const btn = $('haPayGo'); btn.disabled = true; btn.textContent = 'מכין את הדוחות ושולח… (עד דקה)';
      const x = await apiPost({ action: 'closePayrollMonth', ...mgrAuth(), month, emails: $('haPayEmails').value.trim(), confirm: true, includeUnapproved });
      btn.disabled = false; btn.textContent = r.closing ? '🔁 אישור ושליחה מחדש' : '📤 אישור ושליחה לשכר';
      if (!x.ok && x.code === 'unapproved') {
        if (confirm(x.notApproved.length + ' עובדים עוד לא אישרו בעצמם את השעות:\n' + x.notApproved.slice(0, 15).join(', ') + (x.notApproved.length > 15 ? '…' : '') +
          '\n\nלשלוח בכל זאת? בדוח יסומן שהם לא אישרו.')) return sendPayroll(true);
        return;
      }
      if (!x.ok) return say(x.error || 'שגיאה', 'err');
      say('✓ נשלח לשכר: ' + x.employees + ' עובדים, אל ' + x.sentTo.join(', '), 'ok');
      loadMgr();
    }
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
