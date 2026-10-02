// The employee's navigation (same file in shiftfloo web/app/ and on the Superstar site; loaded last, after the other
// layers have added their buttons):
//   header    two menus instead of a row of buttons — "📅 סידור עבודה ונוכחות" (my schedule, constraints, vacation request,
//             swaps · monthly attendance, hours approval, sick report · request history) and "👤 אזור אישי" (my details,
//             payslips, Form 106, Form 101); constraints and vacation requests are separate items
//   home      the clock only — branch tools (operations) are not shown to employees
//   my details  photo, email, phone and home address are the employee's to change (myProfile / saveMyProfile — a new
//             email asks for the password); start date, ID number etc. are read-only
// The buttons themselves are the app's own (moved, not copied), so everything they open keeps working as before.
// Uses the app's own globals: apiPost, state, toast, shrinkImage, updateSelfAvatar, hideEmpHome, openEmpCons, openSick,
// openBlobPdf, empByName.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const empAuth = () => { const s = appState(); return s && s.emp ? { username: s.emp.username, password: s.emp.pw } : {}; };
  const fmtDate = (d) => (/^\d{4}-\d{2}-\d{2}/.test(d || '') ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : (d || ''));

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#viewerChip .em-menu{position:relative;display:inline-block}' +
    '#viewerChip .em-menu > .em-btn{background:#e8a819;color:#1b2a4a;border:0;border-radius:8px;padding:6px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}' +
    '#viewerChip .em-menu > .em-btn:after{content:" ▾";font-size:10px}' +
    '#viewerChip .em-drop{display:none;position:absolute;top:calc(100% + 4px);right:0;background:#fff;border:1px solid #e5e7eb;border-radius:10px;' +
      'box-shadow:0 6px 20px rgba(27,42,74,.18);min-width:170px;z-index:250;padding:4px}' +
    '#viewerChip .em-drop.open{display:block}' +
    '#viewerChip .em-drop button{display:block;width:100%;text-align:right;border:0;background:none;padding:9px 14px;font-family:inherit;font-size:13px;' +
      'font-weight:600;cursor:pointer;border-radius:7px;color:#1b2a4a;margin:0}' +
    '#viewerChip .em-drop button:hover{background:#f1f5f9}' +
    '.eh-links .em-sec{grid-column:1/-1;font-size:12.5px;font-weight:800;color:var(--navy,#1b2a4a);margin-top:8px;padding-top:8px;border-top:1px solid var(--line,#e5e7eb)}' +
    '.eh-links .em-sec:first-child{margin-top:0;padding-top:0;border-top:0}' +
    '.em-prof{display:grid;gap:10px}' +
    '.em-prof .em-row{display:grid;grid-template-columns:130px 1fr;gap:8px;align-items:center;font-size:14px}' +
    '.em-prof .em-row .k{color:var(--muted,#6b7280);font-size:12.5px;font-weight:700}' +
    '.em-prof input{border:1.5px solid var(--line,#d1d5db);border-radius:9px;padding:8px 10px;font:inherit;font-size:15px;width:100%;box-sizing:border-box}' +
    '.em-prof .ro{background:#f8fafc;border-radius:9px;padding:8px 10px;color:#374151;min-height:20px}' +
    '@media (max-width:480px){.em-prof .em-row{grid-template-columns:1fr;gap:3px}}' +
    '</style>');

  /* ---------- header: three menus ---------- */
  const item = (id, label, fn) => {
    const b = document.createElement('button');
    b.type = 'button'; b.id = id; b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  };
  /** the app's own button, moved into a menu (its handler, visibility and id stay as they are) */
  const own = (id, label) => { const b = $(id); if (b && label) b.textContent = label; return b; };
  function menu(id, label, items) {
    const wrap = document.createElement('span');
    wrap.className = 'em-menu';
    wrap.innerHTML = '<button type="button" class="em-btn" id="' + id + 'Btn" aria-haspopup="true" aria-expanded="false">' + label + '</button>' +
      '<div class="em-drop" id="' + id + 'Drop" role="menu"></div>';
    const drop = wrap.querySelector('.em-drop');
    items.forEach((b) => { if (!b) return; if (b.tagName === 'HR') { drop.appendChild(b); return; } b.classList.remove('hbtn', 'gold'); b.removeAttribute('style'); b.setAttribute('role', 'menuitem'); drop.appendChild(b); });
    const btn = wrap.querySelector('.em-btn');
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      syncRestricted();
      const open = !drop.classList.contains('open');
      document.querySelectorAll('#viewerChip .em-drop').forEach((d) => d.classList.remove('open'));
      drop.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
    drop.addEventListener('click', () => { drop.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
    return wrap;
  }
  function header() {
    const chip = $('viewerChip');
    if (!chip || $('emSchedBtn')) return;
    const consBtn = $('myConsBtn');
    if (consBtn) consBtn.style.display = 'none';           // replaced by two separate items (constraints / vacation)
    const before = $('viewerExit');
    const sep = () => { const h = document.createElement('hr'); h.style.cssText = 'border:0;border-top:1px solid #e5e7eb;margin:3px 0'; return h; };
    const sched = menu('emSched', '📅 סידור עבודה ונוכחות', [
      item('mySchedBtn', '📅 הסידור שלי', () => { if (typeof hideEmpHome === 'function') hideEmpHome(); }),
      item('myConstraintsBtn', '🖐 אילוצים', () => openConsPart('cons')),
      item('myVacationBtn', '🏖 בקשת חופשה', () => openConsPart('vac')),
      own('mySwapBtn', '🔁 החלפת משמרת'),
      sep(),
      own('myAttBtn', '⏱ נוכחות חודשית'),
      item('myHoursBtn', '📋 אישור שעות', () => { if (typeof window.openHoursApproval === 'function') window.openHoursApproval(); }),
      item('mySickBtn', '🤒 דיווח מחלה', () => { if (typeof openSick === 'function') openSick(); }),
      sep(),
      item('myHistoryBtn', '📜 היסטוריית בקשות', openHistory),
    ]);
    const pers = menu('emPersonal', '👤 אזור אישי', [
      item('myProfileBtn', '🪪 הפרטים שלי', openProfile),
      own('myPayBtn', '🧾 תלושי שכר'),
      own('my106Btn', '📄 טופס 106'),
      item('myFormsBtn', '📋 טופס 101', openForms),
    ]);
    const f101list = $('myF101Btn');
    if (f101list) f101list.style.display = 'none';         // inside "טופס 101" (fill when missing, else the forms sent)
    chip.insertBefore(sched, before);
    chip.insertBefore(pers, before);
    // "הטפסים שלי" holds only Form 101: called by its name
    const ov = $('myF101Overlay');
    if (ov) {
      const h = ov.querySelector('header h3'), p = ov.querySelector('header p');
      if (h) h.textContent = '📋 טופס 101';
      if (p) p.textContent = 'מילוי או עדכון הטופס, וצפייה בטפסים שהגשת';
    }
    syncRestricted();
    // the app shows / hides its header after sign-in: follow it
    new MutationObserver(syncRestricted).observe(chip, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', () => document.querySelectorAll('#viewerChip .em-drop').forEach((d) => d.classList.remove('open')));
  }
  /** an inactive employee keeps only his payslips and Form 106 (as the app's own restricted mode) */
  function syncRestricted() {
    const s = appState();
    const restricted = !!(s && s.emp && s.emp.active === false);
    ['emSched'].forEach((id) => { const w = $(id + 'Btn'); if (w) w.parentElement.style.display = restricted ? 'none' : ''; });
    ['myProfileBtn', 'myFormsBtn'].forEach((id) => { const b = $(id); if (b) b.style.display = restricted ? 'none' : ''; });
  }
  /** Form 101: the window with "fill / update" and the forms already sent */
  function openForms() { if ($('myF101Btn')) $('myF101Btn').click(); }

  /* ---------- request history: sick reports (with their certificates) and vacation requests ---------- */
  const ST = { 'מאושר': ['#dcfce7', '#166534'], 'ממתין': ['#fef3c7', '#92400e'], 'נדחה': ['#fee2e2', '#991b1b'] };
  const chip = (st) => { const c = ST[st] || ST['ממתין']; return '<span style="background:' + c[0] + ';color:' + c[1] + ';border-radius:99px;padding:2px 9px;font-size:11.5px;font-weight:700;white-space:nowrap">' + e(st) + '</span>'; };
  const dm = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(2, 4) : '');
  const range = (a, b) => (a === b ? dm(a) : dm(a) + ' – ' + dm(b));
  let histTab = 'sick';
  async function openHistory(tab) {
    if (typeof tab === 'string') histTab = tab;
    if (!$('emHistOverlay')) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="emHistOverlay"><div class="modal" style="max-width:600px">' +
        '<header><h3>📜 היסטוריית בקשות</h3><p>כל בקשות המחלה והחופשה שהגשת, והמסמכים שצירפת</p></header>' +
        '<div class="mbody"><div style="display:flex;gap:6px;margin-bottom:10px">' +
          '<button type="button" class="btn" data-ht="sick">🤒 מחלה</button><button type="button" class="btn" data-ht="vac">🏖 חופשה</button></div>' +
          '<div id="emHistBody"></div></div>' +
        '<div class="mfoot"><button class="btn plain" id="emHistClose">סגירה</button></div></div></div>');
      $('emHistClose').addEventListener('click', () => $('emHistOverlay').classList.add('hidden'));
      $('emHistOverlay').querySelectorAll('[data-ht]').forEach((b) => b.addEventListener('click', () => openHistory(b.dataset.ht)));
    }
    $('emHistOverlay').classList.remove('hidden');
    $('emHistOverlay').querySelectorAll('[data-ht]').forEach((b) => { b.className = 'btn ' + (b.dataset.ht === histTab ? 'primary' : 'plain'); });
    const body = $('emHistBody');
    body.innerHTML = 'טוען…';
    const r = await apiPost({ action: 'myRequestHistory', ...empAuth() });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const row = (main, sub, right) => '<div class="cons-item" style="align-items:center"><span><b>' + main + '</b>' + (sub ? '<br><small style="color:var(--muted,#6b7280)">' + sub + '</small>' : '') +
      '</span><span class="acts" style="display:flex;gap:6px;align-items:center">' + right + '</span></div>';
    if (histTab === 'sick') {
      body.innerHTML = r.sick.length ? r.sick.map((x) => row(range(x.from, x.to), e(x.note),
        chip(x.status) + (x.hasCert ? ' <button type="button" class="ap" data-cert="' + x.id + '">📎 אישור</button>' : ''))).join('')
        : '<p style="color:var(--muted,#6b7280)">לא הוגשו דיווחי מחלה</p>';
      body.querySelectorAll('[data-cert]').forEach((b) => b.addEventListener('click', async () => {
        const was = b.textContent; b.textContent = 'טוען…'; b.disabled = true;
        const x = await apiPost({ action: 'mySickCert', ...empAuth(), id: Number(b.dataset.cert) });
        b.textContent = was; b.disabled = false;
        if (!x.ok) return say(x.error || 'שגיאה', 'err');
        if (typeof openBlobPdf === 'function') openBlobPdf(x.data, x.filename, x.mimeType);
      }));
    } else {
      body.innerHTML = r.vacations.length ? r.vacations.map((x) => row(range(x.from, x.to), e(x.reason), chip(x.status))).join('')
        : '<p style="color:var(--muted,#6b7280)">לא הוגשו בקשות חופשה</p>';
    }
  }

  /** constraints and vacation requests are separate items: the same window, showing only the part asked for */
  async function openConsPart(part) {
    if (typeof openEmpCons !== 'function') return;
    await openEmpCons();
    const ov = $('empConsOverlay');
    if (!ov) return;
    const body = ov.querySelector('.mbody');
    const kids = [...body.children];
    const cut = kids.findIndex((c) => /border-top/.test(c.getAttribute('style') || ''));   // the line between the two parts
    kids.forEach((c, i) => {
      c.style.display = cut < 0 ? '' : (part === 'cons' ? (i < cut ? '' : 'none') : (i > cut ? '' : 'none'));
    });
    const h = ov.querySelector('header h3');
    if (h) h.textContent = part === 'cons' ? '🖐 אילוצים — אי-זמינות' : '🏖 בקשת חופשה';
    // the header line is set again by scheduling-extras.js when the window opens — adjust after it
    setTimeout(() => {
      const p = ov.querySelector('header p');
      if (p && part === 'vac') p.textContent = 'בקשת חופשה לטווח תאריכים · תמיד באישור מנהל';
    }, 0);
  }
  // any other way into the window (an old shortcut) shows both parts, as before
  document.addEventListener('click', (ev) => {
    if (ev.target.closest && ev.target.closest('#myConstraintsBtn, #myVacationBtn')) return;
    const ov = $('empConsOverlay');
    if (ov && ov.classList.contains('hidden')) ov.querySelectorAll('.mbody > *').forEach((c) => (c.style.display = ''));
  }, true);

  /* ---------- home screen: the clock only ---------- */
  // everything else lives in the header menus; branch tools (operations) are for managers only (their own menu)
  function home() {
    const links = document.querySelector('#empHome .eh-links');
    if (links) links.style.display = 'none';
  }

  /* ---------- my details ---------- */
  function overlay() {
    if ($('emProfOverlay')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="overlay hidden" id="emProfOverlay"><div class="modal" style="max-width:560px">' +
      '<header><h3>🪪 הפרטים שלי</h3><p>אפשר לעדכן תמונה, מייל, טלפון וכתובת. שאר הפרטים מעודכנים על ידי המנהל.</p></header>' +
      '<div class="mbody" id="emProfBody"></div><div class="merr" id="emProfErr" style="padding:0 18px"></div>' +
      '<div class="mfoot"><button class="btn primary" id="emProfSave">שמירה</button><button class="btn plain" id="emProfClose">סגירה</button></div></div></div>');
    $('emProfClose').addEventListener('click', () => $('emProfOverlay').classList.add('hidden'));
    $('emProfSave').addEventListener('click', saveProfile);
  }
  let loaded = null;
  async function openProfile() {
    const s = appState();
    if (!s || !s.emp) return;
    overlay();
    $('emProfOverlay').classList.remove('hidden');
    $('emProfErr').textContent = '';
    const body = $('emProfBody');
    body.innerHTML = 'טוען…';
    const r = await apiPost({ action: 'myProfile', ...empAuth() });
    if (!r.ok) { body.innerHTML = ''; $('emProfErr').textContent = r.error || 'שגיאה'; return; }
    const p = loaded = r.profile;
    const ro = (k, v) => '<div class="em-row"><span class="k">' + k + '</span><div class="ro">' + (e(v) || '—') + '</div></div>';
    body.innerHTML = '<div class="em-prof">' +
      '<div style="display:flex;align-items:center;gap:14px">' +
        '<div id="emProfPic" style="width:84px;height:84px;border-radius:50%;background:#e0e7ff;display:grid;place-items:center;font-size:32px;font-weight:800;color:#1b2a4a;overflow:hidden;flex:none">' +
        (p.avatarUrl ? '<img src="' + e(p.avatarUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : e(p.name.charAt(0))) + '</div>' +
        '<div><div style="font-size:18px;font-weight:800">' + e(p.name) + '</div>' +
        '<label class="btn plain" style="display:inline-block;margin-top:6px;cursor:pointer">📷 ' + (p.avatarUrl ? 'החלפת תמונה' : 'הוספת תמונה') +
        '<input type="file" accept="image/*" id="emProfFile" style="display:none"></label></div></div>' +
      '<div style="font-weight:800;margin-top:4px">פרטי קשר</div>' +
      '<div class="em-row"><label class="k" for="emProfEmail">אימייל</label><input type="email" id="emProfEmail" dir="ltr" autocomplete="email" value="' + e(p.email) + '"></div>' +
      '<div class="em-row hidden" id="emProfPwRow"><label class="k" for="emProfPw">סיסמה נוכחית</label><input type="password" id="emProfPw" autocomplete="current-password" placeholder="נדרשת לשינוי המייל"></div>' +
      '<div class="em-row"><label class="k" for="emProfPhone">טלפון</label><input type="tel" id="emProfPhone" dir="ltr" autocomplete="tel" value="' + e(p.phone) + '"></div>' +
      '<div class="em-row"><label class="k" for="emProfAddr">כתובת מגורים</label><input type="text" id="emProfAddr" autocomplete="street-address" maxlength="200" value="' + e(p.address) + '"></div>' +
      '<div style="font-weight:800;margin-top:4px">פרטי העסקה <span style="font-weight:600;font-size:12px;color:var(--muted,#6b7280)">(לקריאה בלבד)</span></div>' +
      ro('מספר עובד', p.empNo) + ro('תעודת זהות', p.idNumber || (p.hasForm101 ? '' : 'יתמלא מטופס 101')) + ro('תאריך לידה', fmtDate(p.birthDate)) +
      ro('תחילת העסקה', fmtDate(p.startDate)) + ro('סניף', p.branch) + ro('מחלקות', (p.departments || []).join(', ')) + ro('סוג העסקה', p.employeeType) +
      '</div>';
    $('emProfEmail').addEventListener('input', () => $('emProfPwRow').classList.toggle('hidden', $('emProfEmail').value.trim().toLowerCase() === String(p.email || '').toLowerCase()));
    $('emProfFile').addEventListener('change', async (ev) => {
      const file = ev.target.files[0]; ev.target.value = '';
      if (!file) return;
      let src;
      try { src = await window.shrinkImage(file); } catch (err) { return say(err.message || 'התמונה לא נתמכת', 'err'); }
      const x = await apiPost({ action: 'saveAvatar', ...empAuth(), avatar: src });
      if (!x.ok) return say('שגיאה: ' + (x.error || 'בשמירת התמונה'), 'err');
      $('emProfPic').innerHTML = '<img src="' + e(src) + '" alt="" style="width:100%;height:100%;object-fit:cover">';
      if (typeof updateSelfAvatar === 'function') updateSelfAvatar(src);
      const me = typeof empByName === 'function' && appState() ? empByName(appState().emp.name) : null;
      if (me) me.avatarUrl = x.avatarUrl;
      say('התמונה עודכנה ✓', 'ok');
    });
  }
  async function saveProfile() {
    if (!loaded) return;
    const err = $('emProfErr'), btn = $('emProfSave');
    const req = { action: 'saveMyProfile', ...empAuth(), email: $('emProfEmail').value.trim(), phone: $('emProfPhone').value.trim(),
      address: $('emProfAddr').value.trim(), currentPassword: $('emProfPw').value };
    btn.disabled = true; err.textContent = 'שומר…';
    try {
      const x = await apiPost(req);
      if (!x.ok) { err.textContent = x.error || 'שגיאה'; if (x.code === 'password') { $('emProfPwRow').classList.remove('hidden'); $('emProfPw').focus(); } return; }
      err.textContent = '';
      $('emProfPw').value = '';
      say('הפרטים נשמרו ✓', 'ok');
      $('emProfOverlay').classList.add('hidden');
    } finally { btn.disabled = false; }
  }
  window.openMyProfile = openProfile;

  function start() { header(); home(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
