// Self-registration of new employees — screens (same file in the Sidurit template web/app/ and on the Superstar site;
// server: api/registration.ts):
//   login screen  "עובד/ת חדש/ה? הרשמה" → company (template: name or number, as for signing in) → form → e-mail code
//                 → "waiting for approval"; no access and no billing until a manager approves
//   managers      "⚙ אדמין ← 📝 בקשות הצטרפות" (count on the menu): approve with employee number, type, department,
//                 direct manager — or reject with a reason; the admin switches self-registration on / off
// Uses the app's own globals: apiPost, mgrAuth, state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const MULTI = !!window.APP_CONFIG;                          // the template: one app, many companies
  const PRIVACY = MULTI ? (window.APP_CONFIG.PRODUCT_SITE || '').replace(/\/$/, '') + '/site/privacy.html' : '';

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.rg-f{display:grid;gap:9px}.rg-f label{display:grid;gap:3px;font-size:12.5px;font-weight:700;color:#374151}' +
    '.rg-f input,.rg-f select{border:1.5px solid #d1d5db;border-radius:9px;padding:8px 10px;font:inherit;font-size:15px;width:100%;box-sizing:border-box}' +
    '.rg-2{display:grid;grid-template-columns:1fr 1fr;gap:9px}@media(max-width:480px){.rg-2{grid-template-columns:1fr}}' +
    '.rg-err{color:#b91c1c;font-size:13px;min-height:18px;font-weight:700}.rg-note{font-size:12.5px;color:#6b7280}' +
    '.rg-ok{background:#ecfdf5;border:1.5px solid #34d399;border-radius:12px;padding:14px;text-align:center}' +
    '.rg-card{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;margin-bottom:10px;display:grid;gap:8px}' +
    '.rg-card .hd{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.rg-card .hd b{font-size:15px}' +
    '.rg-chip{display:inline-block;border-radius:99px;padding:2px 9px;font-size:11.5px;font-weight:700;background:#fef3c7;color:#92400e}' +
    '.rg-chip.ok{background:#dcfce7;color:#166534}.rg-chip.no{background:#fee2e2;color:#991b1b}' +
    '.rg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}' +
    '.rg-grid label{display:grid;gap:3px;font-size:12px;font-weight:700;color:#374151}' +
    '.rg-grid input,.rg-grid select{border:1.5px solid #d1d5db;border-radius:8px;padding:6px 8px;font:inherit;font-size:13.5px;width:100%;box-sizing:border-box}' +
    '.rg-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}' +
    '.rg-btn{border:0;border-radius:9px;padding:8px 14px;font:inherit;font-weight:800;font-size:13.5px;cursor:pointer;background:#1b2a4a;color:#fff}' +
    '.rg-btn.ok{background:#16a34a}.rg-btn.no{background:#dc2626}.rg-btn.plain{background:#f1f5f9;color:#1f2937}' +
    '.rg-badge{background:#dc2626;color:#fff;border-radius:99px;padding:0 6px;font-size:11px;margin-inline-start:4px}' +
    '</style>');

  function overlay(id, title, sub, wide) {
    if (!$(id)) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="' + id + '"><div class="modal" style="max-width:' + (wide ? 820 : 520) + 'px">' +
        '<header><h3>' + title + '</h3><p id="' + id + 'Sub"></p></header><div class="mbody" id="' + id + 'Body"></div>' +
        '<div class="mfoot"><button class="btn plain" data-close>סגירה</button></div></div></div>');
      $(id).querySelector('[data-close]').addEventListener('click', () => $(id).classList.add('hidden'));
    }
    $(id + 'Sub').textContent = sub || '';
    $(id).classList.remove('hidden');
    return $(id + 'Body');
  }

  /* ================= the new employee ================= */
  let reg = { company: '', companyName: '', info: null, token: '', hint: '' };
  const post = (body) => apiPost(MULTI ? { ...body, company: reg.company } : body);

  function openRegister() {
    if ($('loginOverlay')) $('loginOverlay').classList.add('hidden');
    reg = { company: '', companyName: '', info: null, token: '', hint: '' };
    if (MULTI) stepCompany(); else loadInfo();
  }
  function stepCompany() {
    const body = overlay('rgOverlay', '✍ הרשמה של עובד/ת חדש/ה', 'שם החברה או מספר החברה — מהמנהל/ת או מהודעת הגיוס');
    const pre = ($('lgCompany') && $('lgCompany').value.trim()) || (window.BRAND && window.BRAND.name) || '';
    body.innerHTML = '<div class="rg-f"><label>חברה<input id="rgCo" value="' + e(pre) + '" placeholder="שם החברה או מספר החברה" autocomplete="organization"></label>' +
      '<div class="rg-err" id="rgErr"></div><button class="rg-btn" id="rgCoGo">המשך</button></div>';
    const go = async () => {
      const v = $('rgCo').value.trim();
      if (!v) { $('rgErr').textContent = 'יש להזין שם חברה או מספר חברה'; return; }
      $('rgCoGo').disabled = true;
      const r = await apiPost({ action: 'findCompany', query: v });
      $('rgCoGo').disabled = false;
      if (!r.ok) { $('rgErr').textContent = r.error || 'החברה לא נמצאה'; return; }
      reg.company = r.slug; reg.companyName = r.name;
      loadInfo();
    };
    $('rgCoGo').addEventListener('click', go);
    $('rgCo').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
    setTimeout(() => $('rgCo').focus(), 100);
  }
  async function loadInfo() {
    const body = overlay('rgOverlay', '✍ הרשמה של עובד/ת חדש/ה', '');
    body.innerHTML = '<p class="rg-note">טוען…</p>';
    const r = await post({ action: 'registrationInfo' });
    if (!r.ok) { body.innerHTML = '<p class="rg-err">' + e(r.error || 'שגיאה') + '</p>'; return; }
    reg.info = r; reg.companyName = r.company;
    if (!r.enabled) { body.innerHTML = '<p>ההרשמה העצמית ב<b>' + e(r.company) + '</b> כבויה — המנהל/ת יוסיף/תוסיף אותך למערכת.</p>'; return; }
    stepForm();
  }
  function stepForm() {
    const r = reg.info;
    const body = overlay('rgOverlay', '✍ הרשמה ל' + r.company, 'אחרי אימות המייל הבקשה עוברת לאישור המנהל/ת. עד האישור אין גישה למערכת.');
    const brOpts = r.branches.map((b) => '<option>' + e(b) + '</option>').join('');
    body.innerHTML = '<div class="rg-f">' +
      '<label>שם מלא<input id="rgName" autocomplete="name" maxlength="60" placeholder="שם פרטי ושם משפחה"></label>' +
      '<div class="rg-2"><label>טלפון נייד<input id="rgPhone" type="tel" dir="ltr" autocomplete="tel" maxlength="20"></label>' +
      '<label>מייל<input id="rgEmail" type="email" dir="ltr" autocomplete="email" maxlength="120"></label></div>' +
      '<div class="rg-2"><label>סניף<select id="rgBranch">' + (r.branches.length > 1 ? '<option value="">— בחירה —</option>' : '') + brOpts + '</select></label>' +
      '<label>מחלקה (לא חובה)<select id="rgDept"></select></label></div>' +
      '<label>שם משתמש לכניסה<input id="rgUser" dir="ltr" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="30" placeholder="באנגלית, למשל noa.levi"></label>' +
      '<div class="rg-2"><label>סיסמה (לפחות 4 תווים)<input id="rgPw" type="password" autocomplete="new-password"></label>' +
      '<label>אימות סיסמה<input id="rgPw2" type="password" autocomplete="new-password"></label></div>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-weight:400"><input type="checkbox" id="rgConsent" style="width:auto;margin-top:3px">' +
      '<span>אני מאשר/ת שמירה ושימוש בפרטים שמסרתי לצורך ניהול העבודה ב' + e(r.company) +
      (PRIVACY ? ', לפי <a href="' + e(PRIVACY) + '" target="_blank" rel="noopener">מדיניות הפרטיות</a>' : '') + '.</span></label>' +
      '<div class="rg-err" id="rgErr"></div><button class="rg-btn" id="rgSend">שליחת קוד אימות למייל</button></div>';
    const fillDepts = () => {
      const d = (r.departments[$('rgBranch').value] || []);
      $('rgDept').innerHTML = '<option value="">— לא ידוע —</option>' + d.map((x) => '<option>' + e(x) + '</option>').join('');
    };
    $('rgBranch').addEventListener('change', fillDepts);
    fillDepts();
    $('rgSend').addEventListener('click', async () => {
      const v = (id) => $(id).value.trim();
      const err = (m) => { $('rgErr').textContent = m; };
      if (v('rgName').split(' ').filter(Boolean).length < 2) return err('יש להזין שם פרטי ושם משפחה');
      if (!v('rgBranch')) return err('יש לבחור סניף');
      if ($('rgPw').value !== $('rgPw2').value) return err('הסיסמאות לא זהות');
      if (!$('rgConsent').checked) return err('יש לאשר את השימוש בפרטים');
      $('rgSend').disabled = true; err('');
      const x = await post({ action: 'registerStart', fullName: v('rgName'), phone: v('rgPhone'), email: v('rgEmail'), branch: v('rgBranch'),
        department: v('rgDept'), username: v('rgUser'), password: $('rgPw').value, consent: true });
      $('rgSend').disabled = false;
      if (!x.ok) return err(x.error || 'שגיאה');
      reg.token = x.token; reg.hint = x.hint; reg.username = v('rgUser');
      stepCode();
    });
    setTimeout(() => $('rgName').focus(), 100);
  }
  function stepCode() {
    const body = overlay('rgOverlay', '✉ אימות כתובת המייל', 'שלחנו קוד בן 6 ספרות אל ' + reg.hint + ' (תקף 15 דקות; כדאי לבדוק גם בספאם)');
    body.innerHTML = '<div class="rg-f"><label>הקוד מהמייל<input id="rgCode" inputmode="numeric" dir="ltr" maxlength="6" autocomplete="one-time-code" placeholder="123456"></label>' +
      '<div class="rg-err" id="rgErr"></div><button class="rg-btn" id="rgVerify">אימות ושליחה לאישור</button>' +
      '<button class="rg-btn plain" id="rgResend">לא הגיע? שליחה חוזרת</button><button class="rg-btn plain" id="rgBack">חזרה לטופס</button></div>';
    const verify = async () => {
      $('rgVerify').disabled = true;
      const x = await post({ action: 'registerVerify', token: reg.token, code: $('rgCode').value.trim() });
      $('rgVerify').disabled = false;
      if (!x.ok) { $('rgErr').textContent = x.error || 'שגיאה'; return; }
      stepDone();
    };
    $('rgVerify').addEventListener('click', verify);
    $('rgCode').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') verify(); });
    $('rgResend').addEventListener('click', async () => {
      const x = await post({ action: 'registerResend', token: reg.token });
      $('rgErr').textContent = x.ok ? '' : (x.error || 'שגיאה');
      if (x.ok) say('נשלח קוד חדש אל ' + x.hint, 'ok');
    });
    $('rgBack').addEventListener('click', stepForm);
    setTimeout(() => $('rgCode').focus(), 100);
  }
  function stepDone() {
    const body = overlay('rgOverlay', '✅ הבקשה נשלחה', '');
    body.innerHTML = '<div class="rg-ok"><div style="font-size:34px">⏳</div><b>הבקשה ממתינה לאישור המנהל/ת</b>' +
      '<p class="rg-note">כשהחשבון יאושר נשלח לך מייל, ואז אפשר להיכנס עם שם המשתמש <b dir="ltr">' + e(reg.username) + '</b> והסיסמה שבחרת' +
      (MULTI ? ' (חברה: ' + e(reg.companyName) + ')' : '') + '.</p></div>';
  }

  /* ================= managers ================= */
  let data = null;
  async function openRequests() {
    const body = overlay('rgMgrOverlay', '📝 בקשות הצטרפות', 'עובדים חדשים שנרשמו בעצמם ואימתו את המייל — ממתינים לאישור', true);
    body.innerHTML = '<p class="rg-note">טוען…</p>';
    const r = await apiPost({ action: 'listRegistrations', ...mgrAuth() });
    if (!r.ok) { body.innerHTML = '<p class="rg-err">' + e(r.error || 'שגיאה') + '</p>'; return; }
    data = r;
    setBadge(r.items.filter((x) => x.status === 'ממתין').length);
    render();
  }
  function render() {
    const r = data, body = $('rgMgrOverlayBody');
    const pending = r.items.filter((x) => x.status === 'ממתין'), done = r.items.filter((x) => x.status !== 'ממתין');
    const howTo = 'העובדים נרשמים במסך הכניסה ← "עובד/ת חדש/ה? הרשמה"' + (MULTI ? ' — עם שם החברה או מספר החברה <b>' + e(r.companyCode || '') + '</b>' : '') + '.';
    const people = '<datalist id="rgPeople">' + r.people.map((p) => '<option value="' + e(p.name) + '">' + e(p.branch) + '</option>').join('') + '</datalist>';
    body.innerHTML = people +
      (r.isAdmin ? '<div class="rg-acts" style="background:#f8fafc;border-radius:10px;padding:8px 10px;margin-bottom:10px">' +
        '<label style="display:flex;gap:6px;align-items:center;font-weight:700"><input type="checkbox" id="rgEnabled"' + (r.enabled ? ' checked' : '') + '> הרשמה עצמית פעילה</label>' +
        '<span class="rg-note">' + howTo + '</span></div>' : '<p class="rg-note">' + howTo + '</p>') +
      (pending.length ? pending.map(card).join('') : '<p class="rg-note">אין בקשות שממתינות לאישור.</p>') +
      (done.length ? '<details><summary class="rg-note" style="cursor:pointer">טופלו ב-30 הימים האחרונים (' + done.length + ')</summary>' +
        done.map((x) => '<div class="rg-note" style="padding:4px 0;border-top:1px solid #eee">' + (x.status === 'אושר' ? '<span class="rg-chip ok">אושר</span> ' : '<span class="rg-chip no">נדחה</span> ') +
          e(x.employeeName || x.fullName) + ' · ' + e(x.branch) + ' · ' + e(x.decidedBy) + (x.note ? ' — ' + e(x.note) : '') + '</div>').join('') + '</details>' : '');
    if ($('rgEnabled')) $('rgEnabled').addEventListener('change', async (ev) => {
      const x = await apiPost({ action: 'setSelfRegistration', ...mgrAuth(), enabled: ev.target.checked });
      say(x.ok ? (ev.target.checked ? 'ההרשמה העצמית הופעלה' : 'ההרשמה העצמית כובתה') : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err');
    });
    body.querySelectorAll('.rg-card').forEach(wireCard);
  }
  function card(x) {
    const brs = data.branches.map((b) => '<option' + (b === x.branch ? ' selected' : '') + '>' + e(b) + '</option>').join('');
    return '<div class="rg-card" data-id="' + x.id + '"><div class="hd"><span><b>' + e(x.fullName) + '</b> <span class="rg-chip">ממתין לאישור</span></span>' +
      '<span class="rg-note">נרשם/ה ' + e(new Date(x.verifiedAt || x.createdAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '</span></div>' +
      '<div class="rg-note">📧 <span dir="ltr">' + e(x.email) + '</span>' + (x.phone ? ' · 📱 <span dir="ltr">' + e(x.phone) + '</span>' : '') + ' · 👤 <span dir="ltr">' + e(x.username) + '</span></div>' +
      '<div class="rg-grid">' +
      '<label>שם במערכת<input data-f="name" value="' + e(x.fullName) + '"></label>' +
      '<label>סניף<select data-f="branch"' + (data.isAdmin ? '' : ' disabled') + '>' + brs + '</select></label>' +
      '<label>מחלקה<select data-f="department"></select></label>' +
      '<label>סוג העסקה<select data-f="empType"><option>שעתי</option><option>חודשי</option></select></label>' +
      '<label>מספר עובד<input data-f="employeeNo" dir="ltr"></label>' +
      '<label>מנהל/ת ישיר/ה<input data-f="reportsTo" list="rgPeople" placeholder="— ללא —"></label>' +
      '</div><div class="rg-acts"><button class="rg-btn ok" data-ok>✓ אישור והוספה</button>' +
      '<input data-f="reason" placeholder="סיבת דחייה (תישלח לנרשם/ת)" style="flex:1;min-width:160px;border:1.5px solid #d1d5db;border-radius:8px;padding:7px 9px;font:inherit;font-size:13px">' +
      '<button class="rg-btn no" data-no>✗ דחייה</button></div><div class="rg-err"></div></div>';
  }
  function wireCard(c) {
    const x = data.items.find((i) => String(i.id) === c.dataset.id);
    const f = (k) => c.querySelector('[data-f="' + k + '"]');
    const fillDepts = () => {
      const list = data.departments[f('branch').value] || [];
      f('department').innerHTML = '<option value="">— ללא —</option>' + list.map((d) => '<option' + (d === x.department ? ' selected' : '') + '>' + e(d) + '</option>').join('');
    };
    f('branch').addEventListener('change', fillDepts);
    fillDepts();
    const send = async (approve) => {
      const err = c.querySelector('.rg-err');
      const rt = f('reportsTo').value.trim();
      if (approve && rt && !data.people.some((p) => p.name === rt)) { err.textContent = 'יש לבחור מנהל/ת ישיר/ה מהרשימה'; return; }
      if (!approve && !f('reason').value.trim()) { err.textContent = 'יש לכתוב סיבת דחייה'; f('reason').focus(); return; }
      c.querySelectorAll('button').forEach((b) => (b.disabled = true));
      const r = await apiPost({ action: 'decideRegistration', ...mgrAuth(), id: x.id, approve, name: f('name').value.trim(), branch: f('branch').value,
        department: f('department').value, empType: f('empType').value, employeeNo: f('employeeNo').value.trim(), reportsTo: rt, reason: f('reason').value.trim() });
      c.querySelectorAll('button').forEach((b) => (b.disabled = false));
      if (!r.ok) { err.textContent = r.error || 'שגיאה'; return; }
      say(approve ? '✓ ' + r.name + ' נוסף/ה למערכת (יופיע/תופיע ברשימת העובדים אחרי רענון)' : 'הבקשה נדחתה ונשלחה הודעה', 'ok');
      openRequests();
    };
    c.querySelector('[data-ok]').addEventListener('click', () => send(true));
    c.querySelector('[data-no]').addEventListener('click', () => send(false));
  }
  function setBadge(n) {
    const b = $('rgMgrBtn');
    if (b) b.innerHTML = '📝 בקשות הצטרפות' + (n ? '<span class="rg-badge">' + n + '</span>' : '');
  }
  async function refreshBadge() {
    try {
      const r = await apiPost({ action: 'listRegistrations', ...mgrAuth() });
      if (r && r.ok) setBadge(r.items.filter((x) => x.status === 'ממתין').length);
    } catch (_) { /* offline */ }
  }

  /* ================= wiring ================= */
  function start() {
    const forgot = $('lgForgotPw');
    if (forgot && !$('rgLink')) {
      forgot.insertAdjacentHTML('afterend', '<br><a href="javascript:void(0)" id="rgLink" style="display:inline-block;margin-top:8px;font-size:13.5px;font-weight:800;color:#1b2a4a">עובד/ת חדש/ה? הרשמה ✍</a>');
      $('rgLink').addEventListener('click', openRegister);
    }
    const drop = $('menuAdminDrop');
    if (drop && !$('rgMgrBtn')) {
      const emp = $('empMgr');
      const btn = document.createElement('button');
      btn.id = 'rgMgrBtn'; btn.textContent = '📝 בקשות הצטרפות';
      btn.addEventListener('click', openRequests);
      if (emp && emp.nextSibling) drop.insertBefore(btn, emp.nextSibling); else drop.appendChild(btn);
    }
    const tools = $('adminTools');
    if (tools) {
      let shown = !tools.classList.contains('hidden');
      if (shown) refreshBadge();
      new MutationObserver(() => { const now = !tools.classList.contains('hidden'); if (now && !shown) refreshBadge(); shown = now; })
        .observe(tools, { attributes: true, attributeFilter: ['class'] });
    }
  }
  window.openRegistration = openRegister;
  window.openRegistrationRequests = openRequests;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
