// Manager / admin entries for an employee (same file in shiftfloo web/app/ and on the Superstar site):
//   "🤒 מחלה לעובד"   sick leave with the certificate (mgrReportSick) — approved at once
//   "🏖 חופשה לעובד"  a vacation in the employee's name (mgrAddVacation) — approved at once, past dates allowed
// Both are in the manager's "נוכחות" menu; a shift manager sees his branch's employees, an admin the branch chosen.
// Uses the app's own globals: apiPost, mgrAuth, state, toast, load.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const fileToB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });

  function build() {
    if ($('meOverlay')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="overlay hidden" id="meOverlay"><div class="modal" style="max-width:520px">' +
      '<header><h3 id="meTitle"></h3><p id="meSub"></p></header>' +
      '<div class="mbody"><div style="display:grid;gap:10px">' +
        '<div class="mrow"><label for="meEmp">עובד</label><select id="meEmp" data-search></select></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          '<div class="mrow"><label for="meFrom">מתאריך</label><input type="date" id="meFrom"></div>' +
          '<div class="mrow"><label for="meTo">עד תאריך</label><input type="date" id="meTo"></div></div>' +
        '<div class="mrow" id="meFileRow"><label for="meFile">אישור מחלה (PDF / תמונה)</label><input type="file" id="meFile" accept="application/pdf,image/*"></div>' +
        '<div class="mrow"><label for="meNote" id="meNoteLbl"></label><input type="text" id="meNote" maxlength="300"></div>' +
      '</div></div>' +
      '<div class="merr" id="meErr" style="padding:0 18px"></div>' +
      '<div class="mfoot"><button class="btn primary" id="meSave">שמירה</button><button class="btn plain" id="meClose">ביטול</button></div></div></div>');
    $('meClose').addEventListener('click', () => $('meOverlay').classList.add('hidden'));
    $('meFrom').addEventListener('change', () => { if (!$('meTo').value || $('meTo').value < $('meFrom').value) $('meTo').value = $('meFrom').value; });
    $('meSave').addEventListener('click', save);
  }
  let kind = 'sick';
  function open(k) {
    const s = appState();
    if (!s || !s.mgr) return;
    build();
    kind = k;
    const sick = k === 'sick';
    $('meTitle').textContent = sick ? '🤒 דיווח מחלה לעובד' : '🏖 חופשה לעובד';
    $('meSub').textContent = sick ? 'נרשם כמאושר, עם האישור המצורף. הימים יסומנו בנוכחות כימי מחלה.' : 'נרשמת כמאושרת. הימים יסומנו בנוכחות כימי חופש.';
    $('meFileRow').style.display = sick ? '' : 'none';
    $('meNoteLbl').textContent = sick ? 'הערה (לא חובה)' : 'סיבה (לא חובה)';
    const emps = (s.employees || []).filter((x) => x.active !== false).map((x) => x.name).sort((a, b) => a.localeCompare(b, 'he'));
    $('meEmp').innerHTML = '<option value="">— בחר עובד —</option>' + emps.map((n) => '<option value="' + e(n) + '">' + e(n) + '</option>').join('');
    $('meFrom').value = today(); $('meTo').value = today();
    $('meNote').value = ''; $('meFile').value = ''; $('meErr').textContent = '';
    $('meOverlay').classList.remove('hidden');
  }
  async function save() {
    const err = $('meErr'), btn = $('meSave');
    const employee = $('meEmp').value, from = $('meFrom').value, to = $('meTo').value, note = $('meNote').value.trim();
    if (!employee) { err.textContent = 'יש לבחור עובד'; return; }
    if (!from || !to) { err.textContent = 'יש לבחור תאריכים'; return; }
    const req = kind === 'sick'
      ? { action: 'mgrReportSick', ...mgrAuth(), employee, from, to, note }
      : { action: 'mgrAddVacation', ...mgrAuth(), employee, from, to, reason: note };
    if (kind === 'sick') {
      const f = $('meFile').files[0];
      if (!f) { err.textContent = 'יש לצרף את אישור המחלה'; return; }
      if (f.size > 15 * 1024 * 1024) { err.textContent = 'הקובץ גדול מדי (עד 15MB)'; return; }
      req.certData = await fileToB64(f); req.certMime = f.type || 'application/pdf';
    }
    btn.disabled = true; err.textContent = 'שומר…';
    try {
      const x = await apiPost(req);
      if (!x.ok) { err.textContent = x.error || 'שגיאה'; return; }
      err.textContent = '';
      $('meOverlay').classList.add('hidden');
      say(kind === 'sick' ? 'המחלה נרשמה ל' + employee : 'החופשה נרשמה ל' + employee, 'ok');
      if (typeof load === 'function') load();
    } catch (ex) { err.textContent = 'שגיאה: ' + ex.message; }
    finally { btn.disabled = false; }
  }

  function start() {
    const drop = $('menuAttDrop');
    if (!drop || $('meSickBtn')) return;
    const at = $('sickMgrBtn');
    const html = '<button id="meSickBtn">🤒 מחלה לעובד</button><button id="meVacBtn">🏖 חופשה לעובד</button>';
    if (at) at.insertAdjacentHTML('afterend', html); else drop.insertAdjacentHTML('beforeend', html);
    $('meSickBtn').addEventListener('click', () => open('sick'));
    $('meVacBtn').addEventListener('click', () => open('vac'));
  }
  window.openMgrEntry = open;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
