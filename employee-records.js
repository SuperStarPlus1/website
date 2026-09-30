// Employee records layer of the app (loaded after the app code and company-admin.js):
//   1. profile photos — shrunk on the device before upload (shrinkImage), large view on click (avatarClick)
//   2. "my alerts" — every manager picks the alerts he receives, by email / push (getMyAlertPrefs / saveMyAlertPrefs)
//   3. employee card (admin): "more details" — personal details from Form 101, bank account, Form 101 / 106 files,
//      Form 106 upload — and "employment contract" (hours by labor law)
//   4. employee home: "Form 106" — the employee's own forms
// Uses the app's own globals: apiPost, mgrAuth, state, _currentEmp, empByName, show, toast, openBlobPdf.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const fmtDate = (d) => /^\d{4}-\d{2}-\d{2}/.test(d || '') ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : (d || '');
  // the app declares state / _currentEmp with const / let: global by name, but not properties of window
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const curEmp = () => (typeof _currentEmp !== 'undefined' ? _currentEmp : null);
  // an admin (by role) — checked each time it is needed: watching another button's visibility missed the case where
  // that button never changes (visible from the start, as in Superstar), so the buttons stayed hidden after sign-in
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const fileToB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });

  function addOverlay(id, title, sub, bodyId, foot) {
    document.body.insertAdjacentHTML('beforeend',
      '<div class="overlay hidden" id="' + id + '"><div class="modal" style="max-width:720px">' +
      '<header><h3>' + title + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') + '</header>' +
      '<div class="mbody" id="' + bodyId + '"></div><div class="merr" id="' + id + 'Err" style="padding:0 18px"></div>' +
      '<div class="mfoot">' + (foot || '') + '<button class="btn plain" data-close>סגירה</button></div></div></div>');
    $(id).querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => $(id).classList.add('hidden')));
  }

  /* ---------- 1. photos ---------- */
  // phones take 3–12MB photos: scale to at most 800px and re-encode as JPEG (~50–150KB) before sending
  window.shrinkImage = function (file, max = 800) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type || '')) return reject(new Error('יש לבחור קובץ תמונה'));
      if (file.size > 25 * 1024 * 1024) return reject(new Error('התמונה גדולה מדי'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('לא ניתן לפתוח את התמונה (נסו JPG או PNG)')); };
      img.src = url;
    });
  };

  document.body.insertAdjacentHTML('beforeend',
    '<div class="overlay hidden" id="avViewer" style="background:rgba(10,15,25,.86);z-index:9999" role="dialog" aria-label="תמונה מוגדלת">' +
    '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px">' +
    '<img id="avViewerImg" alt="" style="max-width:min(92vw,720px);max-height:72vh;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.5);background:#fff">' +
    '<div id="avViewerName" style="color:#fff;font-weight:800;font-size:18px"></div>' +
    '<div style="display:flex;gap:8px"><button class="btn primary" id="avViewerChange">📷 החלפת תמונה</button>' +
    '<button class="btn plain" id="avViewerClose">סגירה</button></div></div></div>');
  let viewerChange = null;
  const closeViewer = () => $('avViewer').classList.add('hidden');
  $('avViewerClose').addEventListener('click', closeViewer);
  $('avViewer').addEventListener('click', (ev) => { if (ev.target === $('avViewer') || ev.target === $('avViewer').firstChild) closeViewer(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeViewer(); });
  $('avViewerChange').addEventListener('click', () => { closeViewer(); if (viewerChange) viewerChange(); });

  /** large view of a photo; onChange (optional) shows a "change photo" button */
  window.showPhoto = function (src, name, onChange) {
    if (!src) return;
    $('avViewerImg').src = src; $('avViewerImg').alt = name || '';
    $('avViewerName').textContent = name || '';
    viewerChange = onChange || null;
    $('avViewerChange').classList.toggle('hidden', !onChange);
    $('avViewer').classList.remove('hidden');
  };
  /** click on the employee's own photo ('self') or on the photo in the manager's employee card ('mgr') */
  window.avatarClick = function (kind) {
    const img = $(kind === 'self' ? 'empSelfAvatarImg' : 'empAvatarImg');
    const input = $(kind === 'self' ? 'empSelfAvatarFile' : 'empAvatarFile');
    const has = img && img.style.display !== 'none' && img.getAttribute('src');
    if (!has) { input.click(); return; }
    const name = kind === 'self' ? (appState() && appState().emp && appState().emp.name) : (curEmp() && curEmp().name) || $('empCardName').textContent;
    window.showPhoto(img.src, name, () => input.click());
  };

  /* ---------- 2. my alerts ---------- */
  addOverlay('myAlertsOverlay', '🔔 ההתראות שלי', 'בחרו אילו התראות לקבל, ובאיזו דרך. חל רק עליך.', 'myAlertsBody',
    '<button class="btn primary" id="myAlertsSave">שמירה</button>');
  async function openMyAlerts() {
    $('myAlertsBody').innerHTML = 'טוען…'; $('myAlertsOverlayErr').textContent = '';
    show('myAlertsOverlay');
    const r = await apiPost({ action: 'getMyAlertPrefs', ...mgrAuth() });
    if (!r.ok) { $('myAlertsBody').innerHTML = ''; $('myAlertsOverlayErr').textContent = r.error || 'שגיאה'; return; }
    $('myAlertsBody').innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>' +
      '<th style="text-align:right;padding:6px">התראה</th><th style="width:70px">מייל</th><th style="width:70px">Push</th></tr></thead><tbody>' +
      r.types.map((a) => '<tr data-key="' + e(a.key) + '" style="border-top:1px solid #eef0f4"><td style="padding:8px 6px">' + e(a.label) + '</td>' +
        '<td style="text-align:center"><input type="checkbox" class="al-email" aria-label="מייל — ' + e(a.label) + '"' + (a.email ? ' checked' : '') + '></td>' +
        '<td style="text-align:center"><input type="checkbox" class="al-push" aria-label="Push — ' + e(a.label) + '"' + (a.push ? ' checked' : '') + '></td></tr>').join('') +
      '</tbody></table><p style="font-size:12px;color:var(--muted);margin-top:10px">מייל נשלח לכתובת שהוגדרה לך ברשימת המנהלים. Push מגיע למכשיר שבו אישרת התראות.</p>';
  }
  $('myAlertsSave').addEventListener('click', async () => {
    const prefs = {};
    $('myAlertsBody').querySelectorAll('tr[data-key]').forEach((tr) => {
      prefs[tr.dataset.key] = { email: tr.querySelector('.al-email').checked, push: tr.querySelector('.al-push').checked };
    });
    const r = await apiPost({ action: 'saveMyAlertPrefs', ...mgrAuth(), prefs });
    if (!r.ok) { $('myAlertsOverlayErr').textContent = r.error || 'שגיאה'; return; }
    $('myAlertsOverlay').classList.add('hidden'); toast('ההתראות נשמרו ✓', 'ok');
  });
  if ($('menuAdminDrop')) {
    $('menuAdminDrop').insertAdjacentHTML('beforeend', '<button id="myAlertsBtn">🔔 ההתראות שלי</button>');
    $('myAlertsBtn').addEventListener('click', openMyAlerts);
  }

  /* ---------- 3. employee card: more details, contract, Form 106 ---------- */
  addOverlay('empDetOverlay', '📋 פרטים נוספים', 'מתוך טופס 101 האחרון · גלוי לאדמין בלבד', 'empDetBody');
  addOverlay('empConOverlay', '📄 חוזה עבודה', '', 'empConBody', '<button class="btn primary" id="empConSave">שמירה</button>');
  const chips = $('empCardActive') && $('empCardActive').parentElement;
  if (chips) {
    chips.insertAdjacentHTML('afterend', '<div id="empRecBtns" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn plain" id="empDetBtn" style="padding:5px 10px;font-size:12.5px">📋 פרטים נוספים</button>' +
      '<button type="button" class="btn plain" id="empConBtn" style="padding:5px 10px;font-size:12.5px">📄 חוזה עבודה</button></div>');
    const sync = () => $('empRecBtns').classList.toggle('hidden', !isAdmin());
    // re-checked whenever an employee card is shown (and on sign-in / role changes)
    const card = $('empCard');
    if (card) new MutationObserver(sync).observe(card, { attributes: true, attributeFilter: ['class'] });
    if ($('payBtn')) new MutationObserver(sync).observe($('payBtn'), { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', (ev) => { if (ev.target && ev.target.closest && ev.target.closest('#empMgr, #empSelector')) setTimeout(sync, 0); }, true);
    sync();
    $('empDetBtn').addEventListener('click', () => openDetails(currentName()));
    $('empConBtn').addEventListener('click', () => openContract(currentName()));
  }
  function currentName() { return (curEmp() && curEmp().name) || $('empCardName').textContent.trim(); }

  const row = (label, value) => value ? '<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px dashed #eef0f4"><span style="color:var(--muted);min-width:130px">' +
    e(label) + '</span><b style="font-weight:600">' + e(value) + '</b></div>' : '';
  const h4 = (t) => '<h4 style="margin:16px 0 6px;color:var(--navy)">' + t + '</h4>';
  const BANK_CHECK = { match: '✅ תואם לאישור שהועלה', mismatch: '⚠ לא נמצא באישור שהועלה — לבדוק מול הקובץ', unreadable: 'ℹ האישור הוא תמונה / סריקה — לבדוק מול הקובץ' };

  async function openDetails(emp) {
    if (!emp) return;
    $('empDetBody').innerHTML = 'טוען…'; $('empDetOverlayErr').textContent = '';
    show('empDetOverlay');
    const r = await apiPost({ action: 'employeeDetails', ...mgrAuth(), employee: emp });
    if (!r.ok) { $('empDetBody').innerHTML = ''; $('empDetOverlayErr').textContent = r.error || 'שגיאה'; return; }
    const p = r.profile;
    let html = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">' +
      (r.avatarUrl ? '<img src="' + e(r.avatarUrl) + '" alt="" id="empDetPhoto" style="width:64px;height:64px;border-radius:50%;object-fit:cover;cursor:zoom-in" title="הגדלה">' : '') +
      '<div><div style="font-size:18px;font-weight:800">' + e(r.employee) + '</div>' +
      '<div style="font-size:12.5px;color:var(--muted)">' + (r.f101 ? 'טופס 101 לשנת ' + r.f101.year + ' · הוגש ' + e(r.f101.submitted) : 'העובד עוד לא הגיש טופס 101 במערכת') + '</div></div></div>';
    if (p) {
      html += h4('פרטים אישיים') + row('שם מלא', p.firstName + ' ' + p.lastName) + row('מספר זהות', p.idNumber) + row('דרכון', p.passportNumber) +
        row('תאריך לידה', fmtDate(p.birthDate)) + row('מין', p.gender) + row('מצב משפחתי', p.marital) + row('תאריך עלייה', fmtDate(p.aliyaDate)) +
        row('כתובת', p.address) + row('טלפון', p.phone) + row('נייד', p.mobile) + row('אימייל', p.email) +
        row('קופת חולים', p.healthFund) + row('תושב ישראל', p.israeliResident ? 'כן' : 'לא') + row('חבר קיבוץ / מושב', p.kibbutz ? 'כן' : '') +
        row('תחילת עבודה בשנת המס', fmtDate(p.workStart));
      if (p.spouse) html += h4('בן / בת זוג') + row('שם', p.spouse.firstName + ' ' + p.spouse.lastName) + row('מספר זהות', p.spouse.id) +
        row('תאריך לידה', fmtDate(p.spouse.birthDate)) + row('הכנסה', p.spouse.incomeStatus);
      html += h4('ילדים (' + p.kids.length + ')') + (p.kids.length ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13.5px"><thead><tr>' +
        '<th style="text-align:right">שם</th><th>ת"ז</th><th>תאריך לידה</th><th>בחזקתי</th><th>קצבת ילדים</th></tr></thead><tbody>' +
        p.kids.map((k) => '<tr><td>' + e(k.name) + '</td><td style="text-align:center" dir="ltr">' + e(k.id) + '</td><td style="text-align:center">' + e(fmtDate(k.birth)) +
          '</td><td style="text-align:center">' + (k.inCustody ? '✓' : '') + '</td><td style="text-align:center">' + (k.childAllowance ? '✓' : '') + '</td></tr>').join('') +
        '</tbody></table></div>' : '<p style="color:var(--muted);margin:0">לא דווחו ילדים</p>');
    }
    html += h4('חשבון בנק לתשלום שכר') + (r.bank ? row('בנק', r.bank.bank) + row('סניף', r.bank.branch) + row('מספר חשבון', r.bank.account) +
      '<div style="margin-top:6px;font-size:13px">' + e(BANK_CHECK[r.bank.check] || '') + '</div>'
      : '<p style="color:var(--muted);margin:0">' + (r.f101 ? 'הטופס הוגש לפני שנוספו פרטי הבנק — יופיעו בהגשה הבאה' : 'יופיע אחרי הגשת טופס 101') + '</p>');
    if (r.f101) {
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn plain" data-f101="">📋 טופס 101</button>' +
        r.f101.attachments.map((a) => '<button class="btn plain" data-f101="' + e(a.kind) + '">' + (a.kind === 'bank' ? '🏦 אישור בנק' : a.kind === 'resident' ? '🏠 אישור תושב' : e(a.kind)) + '</button>').join('') + '</div>';
    }
    const thisYear = new Date().getFullYear();
    html += h4('טופס 106') + (r.form106.length ? r.form106.map((f) => '<div class="cons-item" style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
      '<span>' + f.year + ' <small style="color:var(--muted)">· הועלה ' + e(f.uploaded) + '</small></span><span style="display:flex;gap:6px">' +
      '<button class="btn plain" data-f106="' + f.id + '">פתיחה</button><button class="btn plain" data-f106del="' + f.id + '" style="color:#b91c1c">מחיקה</button></span></div>').join('')
      : '<p style="color:var(--muted);margin:0 0 6px">עדיין לא הועלה טופס 106</p>') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;background:#f8fafc;border-radius:8px;padding:8px">' +
      '<label style="font-size:13px">שנת מס <select id="f106Year">' + [0, 1, 2, 3].map((k) => '<option>' + (thisYear - 1 - k) + '</option>').join('') + '<option>' + thisYear + '</option></select></label>' +
      '<input type="file" id="f106File" accept="application/pdf" aria-label="קובץ טופס 106 (PDF)">' +
      '<label style="font-size:13px"><input type="checkbox" id="f106Notify" checked> לשלוח לעובד במייל</label>' +
      '<button class="btn primary" id="f106Upload">⬆ העלאה</button></div>';
    $('empDetBody').innerHTML = html;
    const photo = $('empDetPhoto');
    if (photo) photo.addEventListener('click', () => window.showPhoto(r.avatarUrl, r.employee));
    $('empDetBody').querySelectorAll('[data-f101]').forEach((b) => b.addEventListener('click', async () => {
      const x = await apiPost({ action: 'getF101File', ...mgrAuth(), fileId: r.f101.fileId, kind: b.dataset.f101 || undefined });
      if (x.ok) openBlobPdf(x.data, x.filename, x.mimeType); else toast(x.error || 'שגיאה', 'err');
    }));
    $('empDetBody').querySelectorAll('[data-f106]').forEach((b) => b.addEventListener('click', async () => {
      const x = await apiPost({ action: 'getForm106', ...mgrAuth(), employee: emp, id: b.dataset.f106 });
      if (x.ok) openBlobPdf(x.data, x.filename, x.mimeType); else toast(x.error || 'שגיאה', 'err');
    }));
    $('empDetBody').querySelectorAll('[data-f106del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('למחוק את טופס 106?')) return;
      const x = await apiPost({ action: 'deleteForm106', ...mgrAuth(), employee: emp, id: b.dataset.f106del });
      if (x.ok) openDetails(emp); else toast(x.error || 'שגיאה', 'err');
    }));
    $('f106Upload').addEventListener('click', async () => {
      const f = $('f106File').files[0];
      if (!f) { toast('יש לבחור קובץ PDF', 'err'); return; }
      if (f.size > 10 * 1024 * 1024) { toast('הקובץ גדול מדי (עד 10MB)', 'err'); return; }
      $('f106Upload').disabled = true;
      const x = await apiPost({ action: 'uploadForm106', ...mgrAuth(), employee: emp, year: Number($('f106Year').value),
        data: await fileToB64(f), notify: $('f106Notify').checked });
      $('f106Upload').disabled = false;
      if (!x.ok) { toast(x.error || 'שגיאה', 'err'); return; }
      toast('טופס 106 לשנת ' + x.year + ' הועלה' + (x.notified ? ' ונשלח לעובד' : '') + ' ✓', 'ok');
      openDetails(emp);
    });
  }

  let conEmp = '';
  async function openContract(emp) {
    if (!emp) return;
    conEmp = emp;
    $('empConBody').innerHTML = 'טוען…'; $('empConOverlayErr').textContent = '';
    show('empConOverlay');
    const r = await apiPost({ action: 'employeeDetails', ...mgrAuth(), employee: emp });
    if (!r.ok) { $('empConBody').innerHTML = ''; $('empConOverlayErr').textContent = r.error || 'שגיאה'; return; }
    const c = r.contract, L = r.rules;
    const opt = (v, cur, label) => '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + label + '</option>';
    $('empConBody').innerHTML =
      '<div style="font-weight:800;margin-bottom:8px">' + e(emp) + (r.contractSaved ? '' : ' <small style="color:var(--muted);font-weight:400">— לא הוגדר חוזה, מוצגות ברירות המחדל</small>') + '</div>' +
      '<div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">' +
      '<label class="mrow">סוג העסקה<select id="conType">' + opt('hourly', c.type, 'שעתי') + opt('monthly', c.type, 'חודשי') + opt('global', c.type, 'גלובלי (כולל שעות נוספות)') + '</select></label>' +
      '<label class="mrow">ימי עבודה בשבוע<select id="conDays">' + opt(5, c.daysPerWeek, '5 ימים') + opt(6, c.daysPerWeek, '6 ימים') + '</select></label>' +
      '<label class="mrow">היקף משרה (שעות בשבוע)<input id="conWeekly" type="number" min="1" max="80" step="0.5" dir="ltr" value="' + c.weeklyHours + '"></label>' +
      '<label class="mrow">יום עבודה רגיל (שעות)<input id="conDaily" type="number" min="1" max="24" step="0.1" dir="ltr" value="' + c.dailyHours + '"></label>' +
      '<label class="mrow">יום מנוחה שבועי<select id="conRest">' + opt(-1, c.restDay, 'לא נקבע (לפי הסכם — בלי תוספת יום מנוחה)') + DAYS.map((d, i) => opt(i, c.restDay, d)).join('') + '</select></label>' +
      '<label class="mrow" style="align-self:end"><span><input type="checkbox" id="conOt"' + (c.overtime ? ' checked' : '') + '> זכאות לגמול שעות נוספות</span></label></div>' +
      '<div id="conScope" style="font-size:13px;margin-top:8px"></div>' +
      '<p style="font-size:12.5px;color:var(--muted);margin-top:10px;line-height:1.6"><b>חישוב לפי ' + e(L.name) + '</b> (' + e(L.source) + '): ' +
      'יום רגיל ' + L.dailyRegular5 + ' ש׳ בשבוע של 5 ימים / ' + L.dailyRegular6 + ' ש׳ בשבוע של 6 ימים, ' + L.nightRegular + ' ש׳ במשמרת לילה; ' +
      'שבוע מלא ' + L.weeklyRegular + ' ש׳. נוספות: שעתיים ראשונות 125%, מעבר 150%. יום מנוחה או חג: 150% (נוספות בו 175% / 200%). ' +
      'ימי חופש קבועים נקבעים בכרטיס העובד. המספרים הם הערכה לצורך דוחות — יש לאשר אותם מול מחלקת השכר.</p>';
    const scope = () => {
      const w = Number($('conWeekly').value) || 0;
      $('conScope').textContent = w ? 'היקף משרה: ' + Math.round(w / L.weeklyRegular * 100) + '%' : '';
      if ($('conType').value === 'global') $('conOt').checked = false;
      $('conOt').disabled = $('conType').value === 'global';
    };
    ['conWeekly', 'conType'].forEach((id) => $(id).addEventListener('input', scope));
    $('conDays').addEventListener('change', () => { $('conDaily').value = $('conDays').value === '6' ? L.dailyRegular6 : L.dailyRegular5; });
    scope();
  }
  $('empConSave').addEventListener('click', async () => {
    const contract = { type: $('conType').value, daysPerWeek: Number($('conDays').value), weeklyHours: Number($('conWeekly').value),
      dailyHours: Number($('conDaily').value), restDay: Number($('conRest').value), overtime: $('conOt').checked };
    const r = await apiPost({ action: 'saveEmployeeContract', ...mgrAuth(), employee: conEmp, contract });
    if (!r.ok) { $('empConOverlayErr').textContent = r.error || 'שגיאה'; return; }
    $('empConOverlay').classList.add('hidden'); toast('החוזה נשמר ✓', 'ok');
  });

  /* ---------- 3b. admin menu: Form 106 of all employees (by tax year) ---------- */
  addOverlay('f106AllOverlay', '📄 טפסי 106', 'טופס 106 לכל עובד פעיל, לפי שנת מס · אדמין בלבד', 'f106AllBody');
  let f106All = null;
  async function openF106All() {
    $('f106AllBody').innerHTML = 'טוען…'; $('f106AllOverlayErr').textContent = '';
    show('f106AllOverlay');
    const r = await apiPost({ action: 'listForm106All', ...mgrAuth() });
    if (!r.ok) { $('f106AllBody').innerHTML = ''; $('f106AllOverlayErr').textContent = r.error || 'שגיאה'; return; }
    f106All = r;
    renderF106All();
  }
  function renderF106All(year) {
    const thisYear = new Date().getFullYear();
    const years = [0, 1, 2, 3, 4].map((k) => thisYear - 1 - k).concat([thisYear]);
    const y = Number(year || ($('f106Year2') && $('f106Year2').value) || thisYear - 1);
    const byEmp = {};
    f106All.forms.filter((f) => f.year === y).forEach((f) => (byEmp[f.employee] = f));
    const names = f106All.employees.slice().sort((a, b) => a.localeCompare(b, 'he'));
    const done = names.filter((n) => byEmp[n]).length;
    $('f106AllBody').innerHTML =
      // batch: one PDF with every employee's form — pages matched on the server (ID from Form 101 / employee no. / name)
      '<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;margin-bottom:12px">' +
      '<b>העלאה מרוכזת</b> <span style="font-size:13px;color:var(--muted)">— קובץ PDF אחד עם טפסי 106 של כל העובדים. ' +
      'זיהוי אוטומטי לפי ת״ז (מטופס 101), מספר עובד או שם — כמו בתלושים.</span>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">' +
      '<input type="file" id="f106Batch" accept="application/pdf" aria-label="קובץ PDF מרוכז של טפסי 106">' +
      '<button class="btn primary" id="f106Analyze">🔍 ניתוח</button></div>' +
      '<div id="f106Review"></div></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
      '<label style="font-size:14px">שנת מס <select id="f106Year2">' + years.map((v) => '<option' + (v === y ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
      '<label style="font-size:14px"><input type="checkbox" id="f106Notify2" checked> לשלוח לעובד במייל בהעלאה</label>' +
      '<span style="font-size:13px;color:var(--muted);margin-inline-start:auto">הועלו ' + done + ' מתוך ' + names.length + '</span></div>' +
      '<input type="search" id="f106Filter" placeholder="חיפוש עובד" aria-label="חיפוש עובד" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #d1d5db;border-radius:8px">' +
      '<input type="file" id="f106Pick" accept="application/pdf" style="display:none" aria-label="בחירת קובץ טופס 106">' +
      '<div id="f106Rows">' + names.map((n) => {
        const f = byEmp[n];
        return '<div class="cons-item f106-row" data-name="' + e(n) + '" style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
          '<span><b>' + e(n) + '</b> ' + (f ? '<small style="color:#166534">✓ הועלה ' + e(f.uploaded) + '</small>' : '<small style="color:var(--muted)">— לא הועלה</small>') + '</span>' +
          '<span style="display:flex;gap:6px">' + (f ? '<button class="btn plain" data-open106="' + f.id + '">פתיחה</button>' : '') +
          '<button class="btn plain" data-up106="' + e(n) + '">' + (f ? 'החלפה' : '⬆ העלאה') + '</button>' +
          (f ? '<button class="btn plain" data-del106="' + f.id + '" style="color:#b91c1c">מחיקה</button>' : '') + '</span></div>';
      }).join('') + '</div>';
    $('f106Year2').addEventListener('change', () => renderF106All($('f106Year2').value));
    $('f106Analyze').addEventListener('click', () => analyzeBatch106());
    if (batch) renderBatch106();   // a review in progress survives a change of tax year
    $('f106Filter').addEventListener('input', () => {
      const q = $('f106Filter').value.trim();
      document.querySelectorAll('#f106Rows .f106-row').forEach((row) => { row.style.display = !q || row.dataset.name.includes(q) ? '' : 'none'; });
    });
    let target = '';
    $('f106AllBody').querySelectorAll('[data-up106]').forEach((b) => b.addEventListener('click', () => { target = b.dataset.up106; $('f106Pick').click(); }));
    $('f106Pick').addEventListener('change', async () => {
      const f = $('f106Pick').files[0]; $('f106Pick').value = '';
      if (!f || !target) return;
      if (f.size > 10 * 1024 * 1024) { toast('הקובץ גדול מדי (עד 10MB)', 'err'); return; }
      const x = await apiPost({ action: 'uploadForm106', ...mgrAuth(), employee: target, year: y, data: await fileToB64(f), notify: $('f106Notify2').checked });
      if (!x.ok) { toast(x.error || 'שגיאה', 'err'); return; }
      toast('טופס 106 של ' + target + ' לשנת ' + y + ' הועלה' + (x.notified ? ' ונשלח במייל' : '') + ' ✓', 'ok');
      openF106All().then(() => renderF106All(y));
    });
    $('f106AllBody').querySelectorAll('[data-open106]').forEach((b) => b.addEventListener('click', async () => {
      const f = f106All.forms.find((x) => String(x.id) === b.dataset.open106);
      const x = await apiPost({ action: 'getForm106', ...mgrAuth(), employee: f.employee, id: f.id });
      if (x.ok) openBlobPdf(x.data, x.filename, x.mimeType); else toast(x.error || 'שגיאה', 'err');
    }));
    $('f106AllBody').querySelectorAll('[data-del106]').forEach((b) => b.addEventListener('click', async () => {
      const f = f106All.forms.find((x) => String(x.id) === b.dataset.del106);
      if (!confirm('למחוק את טופס 106 של ' + f.employee + ' לשנת ' + f.year + '?')) return;
      const x = await apiPost({ action: 'deleteForm106', ...mgrAuth(), employee: f.employee, id: f.id });
      if (x.ok) openF106All().then(() => renderF106All(y)); else toast(x.error || 'שגיאה', 'err');
    }));
  }
  /* batch Form 106: read each page's text in the browser (pdf.js), match on the server, review, split (pdf-lib), upload */
  const BY_LABEL = { id: 'לפי ת״ז', empNo: 'לפי מס׳ עובד', name: 'לפי שם' };
  let batch = null;   // { bytes, pages: [{ page, employee, by, ambiguous, unknownIds }] }
  async function analyzeBatch106() {
    const box = $('f106Review'), f = $('f106Batch').files[0];
    if (!f) { box.innerHTML = '<p class="merr">יש לבחור קובץ PDF</p>'; return; }
    if (f.size > 40 * 1024 * 1024) { box.innerHTML = '<p class="merr">הקובץ גדול מדי (עד 40MB)</p>'; return; }
    box.innerHTML = 'קורא את הקובץ…';
    try {
      await loadScript(PDFJS_URL);
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await window.pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      const texts = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const tc = await (await doc.getPage(p)).getTextContent();
        texts.push(tc.items.map((it) => String(it.str || '')).join(' '));
        box.textContent = 'קורא עמוד ' + p + ' מתוך ' + doc.numPages + '…';
      }
      box.textContent = 'מזהה עובדים…';
      const r = await apiPost({ action: 'matchForm106Pages', ...mgrAuth(), pages: texts });
      if (!r.ok) { box.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
      batch = { bytes, noId: r.noId || [], employees: r.employees || null, pages: r.pages.map((x, i) => ({ page: i + 1, ...x })) };
      renderBatch106();
    } catch (err) { box.innerHTML = '<p class="merr">שגיאה בקריאת הקובץ: ' + e(err.message || err) + '</p>'; }
  }
  function renderBatch106() {
    const box = $('f106Review');
    // active employees first, then those who left (a year's forms include them); older servers send active names only
    const people = (batch.employees || f106All.employees.map((n) => ({ name: n, active: true })))
      .slice().sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name, 'he') : a.active ? -1 : 1));
    const found = batch.pages.filter((p) => p.employee).length;
    const unknownN = batch.pages.filter((p) => !p.employee && (p.unknownNos || []).length).length;
    box.innerHTML = '<div style="margin:10px 0 6px;font-size:14px"><b>זוהו ' + found + ' מתוך ' + batch.pages.length + ' עמודים.</b> ' +
      'עמוד בלי זיהוי (מסגרת אדומה) — לשייך ידנית, לסמן "המשך העמוד הקודם", או להשאיר "דלג".</div>' +
      (batch.noId.length ? '<div style="font-size:12.5px;color:var(--muted);margin-bottom:6px">ל-' + batch.noId.length +
        ' עובדים אין ת״ז במערכת (עוד לא הגישו טופס 101) — הם מזוהים רק לפי מספר עובד או שם.</div>' : '') +
      (unknownN ? '<div style="font-size:12.5px;color:#b91c1c;margin-bottom:6px">ב-' + unknownN + ' עמודים מספר העובד לא קיים במערכת — ' +
        'עובדים שעזבו לפני שהוזנו למערכת, או מספר עובד שונה בכרטיס. אפשר להוסיף אותם כעובדים לא פעילים עם מספר העובד, או לדלג.</div>' : '') +
      batch.pages.map((pg, i) => {
        const why = pg.employee ? '<span style="font-size:12px;color:#166534">✓ ' + BY_LABEL[pg.by] + '</span>'
          : pg.ambiguous.length ? '<span style="font-size:12px;color:#b91c1c">⚠ כמה עובדים בעמוד: ' + e(pg.ambiguous.join(', ')) + '</span>'
          : (pg.unknownNos || []).length ? '<span style="font-size:12px;color:#b91c1c">מספר עובד ' + e(pg.unknownNos.join(', ')) + ' לא קיים במערכת</span>'
          : pg.unknownIds.length ? '<span style="font-size:12px;color:#b91c1c">ת״ז ' + e(pg.unknownIds.join(', ')) + ' לא שייכת לאף עובד פעיל (לא הגיש 101?)</span>'
          : '<span style="font-size:12px;color:var(--muted)">לא נמצאו פרטים מזהים</span>';
        return '<div class="cons-item" style="display:grid;grid-template-columns:80px 1fr;gap:6px;align-items:center">' +
          '<span>עמוד ' + pg.page + '</span>' +
          '<select class="b106-sel" data-i="' + i + '" aria-label="עובד לעמוד ' + pg.page + '" style="border:1.5px solid ' + (pg.employee ? 'var(--line,#d1d5db)' : '#ef4444') + ';border-radius:8px;padding:6px">' +
          '<option value="">— לא זוהה / דלג —</option>' + (i > 0 ? '<option value="__prev"' + (pg.employee === '__prev' ? ' selected' : '') + '>↑ המשך הטופס מהעמוד הקודם</option>' : '') +
          people.map((p) => '<option value="' + e(p.name) + '"' + (p.name === pg.employee ? ' selected' : '') + '>' + e(p.name) + (p.active ? '' : ' (לא פעיל)') + '</option>').join('') + '</select>' +
          '<span></span>' + why + '</div>';
      }).join('') +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:10px"><button class="btn primary" id="b106Upload">⬆ העלאת הכל</button>' +
      '<span id="b106Prog" style="font-size:13px"></span></div>';
    box.querySelectorAll('.b106-sel').forEach((s) => s.addEventListener('change', () => { batch.pages[Number(s.dataset.i)].employee = s.value; }));
    $('b106Upload').addEventListener('click', uploadBatch106);
  }
  async function uploadBatch106() {
    const prog = $('b106Prog'), year = Number($('f106Year2').value);
    // consecutive pages of one employee (a form of more than one page, or "continues the previous page") → one file
    const groups = [];
    let current = null;
    batch.pages.forEach((pg) => {
      if (pg.employee === '__prev' && current) { current.pages.push(pg.page); return; }
      if (!pg.employee || pg.employee === '__prev') { current = null; return; }
      if (current && current.employee === pg.employee && current.pages[current.pages.length - 1] === pg.page - 1) current.pages.push(pg.page);
      else { current = { employee: pg.employee, pages: [pg.page] }; groups.push(current); }
    });
    if (!groups.length) { prog.textContent = 'אין עמודים משויכים'; return; }
    const replacing = groups.filter((g) => f106All.forms.some((f) => f.employee === g.employee && f.year === year)).length;
    if (!confirm('להעלות ' + groups.length + ' טפסי 106 לשנת ' + year + '?' + (replacing ? '\n' + replacing + ' טפסים קיימים לשנה זו יוחלפו.' : ''))) return;
    $('b106Upload').disabled = true;
    try {
      await loadScript(PDFLIB_URL);
      const src = await window.PDFLib.PDFDocument.load(batch.bytes);
      const notify = $('f106Notify2').checked;
      let ok = 0, mailed = 0; const fails = [];
      for (const [k, g] of groups.entries()) {
        prog.textContent = 'מעלה ' + (k + 1) + '/' + groups.length + ' — ' + g.employee + '…';
        try {
          const out = await window.PDFLib.PDFDocument.create();
          (await out.copyPages(src, g.pages.map((p) => p - 1))).forEach((p) => out.addPage(p));
          const x = await apiPost({ action: 'uploadForm106', ...mgrAuth(), employee: g.employee, year, data: await out.saveAsBase64(), notify });
          if (x.ok) { ok++; if (x.notified) mailed++; } else fails.push(g.employee + ': ' + (x.error || 'שגיאה'));
        } catch (err) { fails.push(g.employee + ': ' + (err.message || err)); }
      }
      toast('הועלו ' + ok + ' טפסי 106' + (mailed ? ' · ' + mailed + ' נשלחו במייל' : '') + (fails.length ? ' · ' + fails.length + ' נכשלו' : '') + ' ✓', fails.length ? 'err' : 'ok');
      batch = null;
      await openF106All();
      renderF106All(year);
      if (fails.length) $('f106Review').innerHTML = '<p class="merr">נכשלו: ' + e(fails.join(' | ')) + '</p>';
    } finally { const b = $('b106Upload'); if (b) b.disabled = false; }
  }

  if ($('menuAdminDrop')) {
    $('menuAdminDrop').insertAdjacentHTML('beforeend', '<button id="f106AllBtn" class="hidden">📄 טפסי 106</button>');
    $('f106AllBtn').addEventListener('click', openF106All);
    // admins only, re-checked whenever the admin menu opens (the same rule as the employee-card buttons)
    const syncMenu = () => $('f106AllBtn').classList.toggle('hidden', !isAdmin());
    if ($('menuAdminBtn')) $('menuAdminBtn').addEventListener('click', syncMenu, true);
    syncMenu();
  }

  /* ---------- 4. employee: my Form 106 ---------- */
  addOverlay('my106Overlay', '📄 טופס 106', 'סיכום שכר וניכויים שנתי מהמעסיק', 'my106Body');
  async function openMy106() {
    $('my106Body').innerHTML = 'טוען…'; $('my106OverlayErr').textContent = '';
    show('my106Overlay');
    const r = await apiPost({ action: 'myForm106', username: state.emp.username, password: state.emp.pw });
    if (!r.ok) { $('my106Body').innerHTML = ''; $('my106OverlayErr').textContent = r.error || 'שגיאה'; return; }
    $('my106Body').innerHTML = r.forms.length ? r.forms.map((f) => '<div class="cons-item" style="display:flex;justify-content:space-between;align-items:center">' +
      '<span>שנת ' + f.year + '</span><button class="btn plain" data-my106="' + f.id + '">פתיחה</button></div>').join('')
      : '<p style="color:var(--muted)">עדיין אין טופסי 106</p>';
    $('my106Body').querySelectorAll('[data-my106]').forEach((b) => b.addEventListener('click', async () => {
      const x = await apiPost({ action: 'getForm106', username: state.emp.username, password: state.emp.pw, id: b.dataset.my106 });
      if (x.ok) openBlobPdf(x.data, x.filename, x.mimeType); else toast(x.error || 'שגיאה', 'err');
    }));
  }
  const payHome = document.querySelector('#empHome .eh-links [data-go="pay"]');
  if (payHome) {
    payHome.insertAdjacentHTML('afterend', '<button data-go="f106" id="ehF106"><span class="ic">📄</span>טופס 106</button>');
    $('ehF106').addEventListener('click', () => { if (appState() && appState().emp) openMy106(); });
  }
  if ($('myPayBtn')) {
    $('myPayBtn').insertAdjacentHTML('afterend', '<button class="hbtn gold" id="my106Btn" style="padding:6px 10px;font-size:12px">📄 106</button>');
    $('my106Btn').addEventListener('click', () => { if (appState() && appState().emp) openMy106(); });
  }
})();
