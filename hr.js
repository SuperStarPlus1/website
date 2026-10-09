// The full employee card (same file in the Sidurit template web/app/ and on the Superstar site; server:
// _shared/hr-handlers.ts, rules and texts: _shared/hr-core.ts). Admin only.
//   ⚙ ניהול ← 🗂 כרטיס עובד (pick an employee), or "🗂 כרטיס עובד מלא" in the employee's card — one window, tabs:
//   👤 פרטים (Form 101, 106 — employee-records.js) · 🏦 חשבון בנק (saved here; filled from Form 101 until saved) ·
//   📄 חוזה עבודה (employee-records.js) · 📂 מסמכים (every document — recruit.js) · ⚖ שימוע ופיטורים: a hearing —
//   summons → protocol → decision — and a dismissal letter; each a PDF signed on screen, optionally sent to the employee,
//   who signs that he received it.
//   the employee: a letter waiting → a banner on the home screen and "📨 מכתבים", read + sign the receipt.
// Uses the app's own globals: apiPost, mgrAuth, state, toast, openBlobFile, and recruit.js (signature pad, the text).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const empAuth = () => { const s = appState(); return s && s.emp ? { username: s.emp.username, password: s.emp.pw } : {}; };
  const dmy = (d) => /^\d{4}-\d{2}-\d{2}/.test(d || '') ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : (d || '');
  const when = (d) => { if (!d) return ''; const t = new Date(d); return isNaN(t) ? String(d) : t.toLocaleDateString('he-IL') + ' ' + t.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); };
  const openFile = (b64, name, mime) => { if (typeof openBlobFile === 'function') openBlobFile(b64, name, mime); };
  const TITLES = { summons: 'זימון לשימוע', protocol: 'פרוטוקול שימוע', decision: 'החלטה לאחר שימוע', dismissal: 'מכתב פיטורים' };
  const ICON = { summons: '📨', protocol: '📝', decision: '⚖', dismissal: '✉' };

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.hr-case{border:1.5px solid #e5e7eb;border-radius:12px;padding:9px 12px;margin-bottom:10px;background:#fff}' +
    '.hr-doc{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;border-bottom:1px dashed #eef0f4}.hr-doc .t{flex:1;min-width:180px}' +
    '.hr-steps{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.hr-steps button{font-size:12.5px;padding:5px 11px}' +
    '.hr-legal{background:#eff6ff;color:#1e3a8a;border-radius:10px;padding:8px 11px;font-size:12.5px;line-height:1.6;margin:8px 0}' +
    '.hr-off{text-decoration:line-through;opacity:.6}' +
    '#hrBanner{background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;border-radius:12px;padding:10px 12px;margin:10px 0;font-weight:700;cursor:pointer}' +
    '</style>');

  function overlay(id, title, sub, wide) {
    if (!$(id)) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="' + id + '"><div class="modal" style="max-width:' + (wide || 860) + 'px">' +
        '<header><h3 id="' + id + 'T"></h3><p id="' + id + 'S"></p></header>' +
        '<div class="mbody" id="' + id + 'B"></div><div class="merr" id="' + id + 'E" style="padding:0 18px"></div>' +
        '<div class="mfoot"><span class="spacer"></span><button class="btn plain" data-close>סגירה</button></div></div></div>');
      $(id).querySelector('[data-close]').addEventListener('click', () => $(id).classList.add('hidden'));
    }
    $(id + 'T').textContent = title; $(id + 'S').textContent = sub || ''; $(id + 'E').textContent = '';
    $(id).classList.remove('hidden');
    return $(id + 'B');
  }

  /* ---------- the prior notice (same rule as hr-core.ts noticeFor) ---------- */
  function fullMonths(from, to) {
    if (!from || !to || to < from) return 0;
    const [y1, m1, d1] = from.split('-').map(Number), [y2, m2, d2] = to.split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  }
  function noticeFor(type, start, date) {
    const m = fullMonths(start, date);
    if (type === 'monthly') return m >= 12 ? { days: 30, label: 'חודש ימים' } : m > 6 ? { days: 6 + 2.5 * (m - 6), label: (6 + 2.5 * (m - 6)) + ' ימים' } : { days: m, label: m + ' ימים' };
    if (m >= 36) return { days: 30, label: 'חודש ימים' };
    const d = m >= 24 ? 21 + Math.floor((m - 24) / 2) : m >= 12 ? 14 + Math.floor((m - 12) / 2) : m;
    return { days: d, label: d + ' ימים' };
  }
  const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + Math.ceil(n)); return t.toISOString().slice(0, 10); };

  /* ================= the full card ================= */
  let C = null, emp = '', tab = 'details';
  async function openCard(name, startTab) {
    if (!isAdmin() || !name) return;
    emp = name; tab = startTab || 'details';
    const body = overlay('hrOverlay', '🗂 כרטיס עובד — ' + name, 'כל המידע והמסמכים של העובד/ת במקום אחד · אדמין בלבד', 900);
    body.innerHTML = '<div class="rc-tabs"><button data-t="details">👤 פרטים</button><button data-t="bank">🏦 חשבון בנק</button><button data-t="contract">📄 חוזה עבודה</button>' +
      '<button data-t="docs">📂 מסמכים</button><button data-t="hr">⚖ שימוע ופיטורים</button></div><div id="hrPane"></div>';
    body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; drawTab(); }));
    C = null;
    drawTab();
  }
  async function load() {
    const r = await apiPost({ action: 'hrCard', ...mAuth(), employee: emp });
    if (!r.ok) { $('hrPane').innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return null; }
    C = r; return r;
  }
  async function drawTab() {
    document.querySelectorAll('#hrOverlayB [data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    const pane = $('hrPane');
    pane.innerHTML = '<p class="rc-meta">טוען…</p>';
    if (tab === 'details') { if (window.renderEmpDetails) window.renderEmpDetails(emp, pane); return; }
    if (tab === 'contract') { if (window.renderEmpContract) window.renderEmpContract(emp, pane); return; }
    if (tab === 'docs') { if (window.renderEmployeeDocs) window.renderEmployeeDocs(emp, pane); return; }
    if (!(await load())) return;
    if (tab === 'bank') drawBank(); else drawHr();
  }

  /* ---------- the bank account ---------- */
  function drawBank() {
    const pane = $('hrPane'), s = C.bank, f = C.bank101, b = s || f || {};
    const banks = Object.entries(C.banks).sort((x, y) => Number(x[0]) - Number(y[0]));
    const differs = s && f && (String(f.bankCode) !== String(s.bankCode) || String(f.branch).replace(/^0+/, '') !== String(s.branch).replace(/^0+/, '') || String(f.account).replace(/^0+/, '') !== String(s.account).replace(/^0+/, ''));
    pane.innerHTML = '<h4 style="margin:4px 0">🏦 חשבון בנק לתשלום שכר</h4>' +
      (s ? '<p class="rc-meta">עודכן ע"י ' + e(s.updatedBy) + ' · ' + e(when(s.updatedAt)) + '</p>'
        : f ? '<p class="rc-warn">מולא מטופס 101 (' + e(f.year) + ') — לבדוק ולשמור.</p>' : '<p class="rc-meta">עדיין אין חשבון בנק. ממלאים כאן, או שהוא יגיע מטופס 101.</p>') +
      (differs ? '<p class="rc-warn">בטופס 101 האחרון (' + e(f.year) + ') מופיע חשבון אחר: בנק ' + e(f.bankCode) + ' · סניף ' + e(f.branch) + ' · חשבון ' + e(f.account) +
        ' <button class="btn plain" id="hbFrom101" style="font-size:12px;padding:3px 9px">מילוי לפי טופס 101</button></p>' : '') +
      '<div class="rc-f" style="max-width:560px"><label>בנק<select id="hbBank"><option value="">— בחירה —</option>' +
      banks.map(([k, v]) => '<option value="' + k + '"' + (String(b.bankCode) === k ? ' selected' : '') + '>' + k.padStart(2, '0') + ' — ' + e(v) + '</option>').join('') + '</select></label>' +
      '<label>מספר סניף<input id="hbBranch" inputmode="numeric" dir="ltr" value="' + e(b.branch || '') + '"></label>' +
      '<label>מספר חשבון<input id="hbAccount" inputmode="numeric" dir="ltr" value="' + e(b.account || '') + '"></label>' +
      '<label>שם בעל/ת החשבון<input id="hbHolder" value="' + e(b.holder || emp) + '"></label></div>' +
      '<div class="merr" id="hbErr"></div><button class="btn primary" id="hbSave">💾 שמירת חשבון הבנק</button>' +
      '<p class="rc-meta" style="margin-top:8px">הפרטים גלויים לאדמין בלבד, וכל צפייה ושינוי נרשמים ביומן.</p>';
    if ($('hbFrom101')) $('hbFrom101').addEventListener('click', () => { $('hbBank').value = f.bankCode; $('hbBranch').value = f.branch; $('hbAccount').value = f.account; if (f.holder) $('hbHolder').value = f.holder; });
    $('hbSave').addEventListener('click', async () => {
      $('hbErr').textContent = 'שומר…';
      const r = await apiPost({ action: 'saveEmployeeBank', ...mAuth(), employee: emp, bank: { bankCode: $('hbBank').value, branch: $('hbBranch').value, account: $('hbAccount').value, holder: $('hbHolder').value } });
      if (!r.ok) { $('hbErr').textContent = r.error || 'שגיאה'; return; }
      $('hbErr').textContent = ''; say('חשבון הבנק נשמר ✓', 'ok'); await load(); drawBank();
    });
  }

  /* ---------- hearing and dismissal ---------- */
  function drawHr() {
    const pane = $('hrPane'), docs = C.docs;
    const cases = docs.filter((d) => d.kind === 'summons');
    const loose = docs.filter((d) => d.kind !== 'summons' && !d.caseId);
    const status = (d) => d.status === 'cancelled' ? '<span class="rc-st" style="background:#f3f4f6;color:#4b5563">בוטל</span>'
      : d.kind === 'protocol' ? (d.employeeSigned ? '<span class="rc-st" style="background:#dcfce7;color:#166534">נחתם ע"י העובד/ת</span>' : d.refused ? '<span class="rc-st" style="background:#fee2e2;color:#991b1b">סירב/ה לחתום</span>' : '')
      : d.ackAt ? '<span class="rc-st" style="background:#dcfce7;color:#166534">✓ הקבלה אושרה ' + e(when(d.ackAt)) + '</span>'
      : d.sent ? '<span class="rc-st" style="background:#fef9c3;color:#854d0e">נשלח — ממתין לאישור קבלה</span>' : '<span class="rc-st" style="background:#f3f4f6;color:#374151">נמסר ידנית</span>';
    const docRow = (d) => '<div class="hr-doc"><span class="t' + (d.status === 'cancelled' ? ' hr-off' : '') + '">' + ICON[d.kind] + ' <b>' + e(d.title) + '</b>' +
      (d.kind === 'decision' && d.fields.decision ? ' — ' + e(C.decisions[d.fields.decision]) : '') +
      ' <span class="rc-meta">' + e(when(d.issuedAt)) + ' · ' + e(d.issuedBy) + '</span></span>' + status(d) +
      '<button class="btn plain" data-pdf="' + d.id + '" style="font-size:12px;padding:4px 10px">📄 PDF</button>' +
      (d.status !== 'cancelled' ? '<button class="btn plain" data-cancel="' + d.id + '" style="font-size:12px;padding:4px 10px;color:#b91c1c">ביטול</button>' : '') + '</div>';
    pane.innerHTML = '<div class="hr-legal">שימוע הוא חובה לפני פיטורים: <b>זימון בכתב</b> עם הטענות וזמן סביר להתכונן ← <b>שימוע</b> שבו העובד/ת משמיע/ה את טענותיו/ה (פרוטוקול) ← <b>החלטה</b> מנומקת ← אם הוחלט — <b>מכתב פיטורים</b> עם הודעה מוקדמת לפי החוק. ' +
      'הנוסחים הם תבנית סטנדרטית — מומלץ להתייעץ עם עורך/ת דין בכל מקרה של פיטורים.</div>' +
      '<div class="hr-steps" style="margin-bottom:10px"><button class="btn primary" id="hrNewCase">📨 זימון לשימוע</button><button class="btn plain" id="hrLooseDis">✉ מכתב פיטורים (ללא שימוע במערכת)</button></div>' +
      (cases.length ? cases.slice().reverse().map((s) => {
        const inCase = docs.filter((d) => d.caseId === s.id && d.id !== s.id && d.status !== 'cancelled');
        const has = (k) => inCase.find((d) => d.kind === k);
        const dec = has('decision');
        const open = s.status !== 'cancelled';
        return '<div class="hr-case"><b>שימוע — ' + e(dmy(s.fields.hearingDate)) + ' ' + e(s.fields.hearingTime || '') + '</b> <span class="rc-meta">' + e(s.fields.place || '') + '</span>' +
          docRow(s) + docs.filter((d) => d.caseId === s.id && d.id !== s.id).map(docRow).join('') +
          (open ? '<div class="hr-steps">' + (!has('protocol') ? '<button class="btn plain" data-step="protocol" data-case="' + s.id + '">📝 פרוטוקול השימוע</button>' : '') +
            (!dec ? '<button class="btn plain" data-step="decision" data-case="' + s.id + '">⚖ החלטה לאחר השימוע</button>' : '') +
            (dec && dec.fields.decision === 'dismissal' && !has('dismissal') ? '<button class="btn primary" data-step="dismissal" data-case="' + s.id + '">✉ מכתב פיטורים</button>' : '') + '</div>' : '') + '</div>';
      }).join('') : '<p class="rc-meta">אין שימועים לעובד/ת.</p>') +
      (loose.length ? '<h4 style="margin:12px 0 4px">מסמכים נוספים</h4>' + loose.map(docRow).join('') : '');
    $('hrNewCase').addEventListener('click', () => form('summons', null));
    $('hrLooseDis').addEventListener('click', () => form('dismissal', null));
    pane.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => form(b.dataset.step, Number(b.dataset.case))));
    pane.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', async () => {
      const x = await apiPost({ action: 'hrDocPdf', ...mAuth(), id: Number(b.dataset.pdf) });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      openFile(x.data, x.filename, 'application/pdf');
    }));
    pane.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
      const reason = prompt('למה המסמך מבוטל? (נשמר ביומן)');
      if (!reason) return;
      const x = await apiPost({ action: 'cancelHrDoc', ...mAuth(), id: Number(b.dataset.cancel), reason });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      await load(); drawHr();
    }));
  }

  function form(kind, caseId) {
    const pane = $('hrPane'), P = C.person, t = C.today;
    const s = caseId ? C.docs.find((d) => d.id === caseId) : null;
    const prot = caseId ? C.docs.find((d) => d.caseId === caseId && d.kind === 'protocol' && d.status !== 'cancelled') : null;
    const dec = caseId ? C.docs.find((d) => d.caseId === caseId && d.kind === 'decision' && d.status !== 'cancelled') : null;
    const mgr = (appState().mgr && appState().mgr.name) || '';
    const ta = (id, label, val, rows) => '<label class="wide">' + label + '<textarea id="' + id + '" rows="' + (rows || 4) + '">' + e(val || '') + '</textarea></label>';
    const inp = (id, label, val, type, extra) => '<label>' + label + '<input id="' + id + '" type="' + (type || 'text') + '" value="' + e(val || '') + '"' + (extra || '') + '></label>';
    let html = '<button class="btn plain" id="hfBack" style="font-size:12.5px">→ חזרה</button><h3 style="margin:8px 0 4px">' + ICON[kind] + ' ' + TITLES[kind] + ' — ' + e(P.name) + '</h3>';
    if (kind === 'summons') {
      const soon = addDays(t, 3);
      html += '<div class="hr-legal">יש לתת לעובד/ת <b>זמן סביר להתכונן</b> (מקובל כמה ימים), לפרט <b>את כל הטענות</b>, ולאפשר להגיע עם מלווה. הזכויות נכתבות בזימון אוטומטית.</div>' +
        '<div class="rc-f">' + inp('hfDate', 'תאריך השימוע', soon, 'date') + inp('hfTime', 'שעה', '10:00', 'time') +
        inp('hfPlace', 'מקום', 'משרדי ההנהלה — ' + (P.branch || '')) + inp('hfCond', 'השימוע ייערך בפני', mgr) +
        inp('hfConsidered', 'מה ייבחן בשימוע', 'סיום העסקתך') +
        ta('hfReasons', 'הטענות והנימוקים (שורה לכל טענה — תאריכים ופרטים)', '', 5) + '</div>';
    } else if (kind === 'protocol') {
      html += '<div class="rc-f">' + inp('hfDate', 'תאריך השימוע', s.fields.hearingDate > t ? t : s.fields.hearingDate, 'date') + inp('hfPlace', 'מקום', s.fields.place) +
        inp('hfStart', 'שעת התחלה', s.fields.hearingTime, 'time') + inp('hfEnd', 'שעת סיום', '', 'time') +
        inp('hfAtt', 'נוכחים מטעם המעסיק', s.fields.conductor) + inp('hfRep', 'מלווה מטעם העובד/ת (אם היה)', '') +
        '<label class="wide" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" id="hfPresent" checked style="width:auto"> העובד/ת התייצב/ה לשימוע</label>' +
        ta('hfReasons', 'הטענות שהוצגו לעובד/ת', (s.fields.reasons || []).join('\n'), 4) +
        ta('hfResp', 'תגובת העובד/ת (כמה שיותר במדויק — מה נאמר)', '', 6) + ta('hfNotes', 'הערות / מסמכים שהוגשו (לא חובה)', '', 3) + '</div>' +
        '<div style="margin-top:10px"><b style="font-size:12.5px">חתימת העובד/ת על הפרוטוקול (על המסך, אם נוכח/ת)</b>' + window.rcSigHtml('hfEmpSig') +
        '<label style="display:flex;gap:8px;align-items:center;margin-top:4px;font-size:13px"><input type="checkbox" id="hfRefused"> העובד/ת סירב/ה לחתום</label></div>';
    } else if (kind === 'decision') {
      html += '<div class="rc-f">' + inp('hfDate', 'תאריך השימוע', prot ? prot.fields.hearingDate : s.fields.hearingDate, 'date') +
        '<label>ההחלטה<select id="hfDec">' + Object.entries(C.decisions).map(([k, v]) => '<option value="' + k + '">' + e(v) + '</option>').join('') + '</select></label>' +
        '<label class="wide" id="hfWarnW" style="display:none">נוסח ההתראה<input id="hfWarn"></label>' +
        '<label class="wide" id="hfOtherW" style="display:none">פירוט ההחלטה<input id="hfOther"></label>' +
        ta('hfReason', 'נימוקים — התייחסות לטענות העובד/ת בשימוע', '', 6) + inp('hfContact', 'לשאלות ניתן לפנות אל (לא חובה)', mgr) + '</div>' +
        (!prot ? '<p class="rc-warn">עדיין לא נרשם פרוטוקול לשימוע הזה. מומלץ לתעד את השימוע לפני ההחלטה.</p>' : '');
    } else {
      const n = P.startDate ? noticeFor(P.type, P.startDate, t) : null;
      html += (caseId ? '' : '<p class="rc-warn">⚠ לפני פיטורים חובה לערוך שימוע. אם השימוע נערך מחוץ למערכת — ציינו את התאריך למטה.</p>') +
        '<div class="hr-legal">ההודעה המוקדמת מחושבת לפי <b>חוק הודעה מוקדמת לפיטורים ולהתפטרות</b>: ' + (P.type === 'monthly' ? 'עובד/ת חודשי/ת' : 'עובד/ת שעתי/ת') +
        (P.startDate ? ', תחילת עבודה ' + e(dmy(P.startDate)) : ' — <b>חסר תאריך תחילת עבודה בכרטיס העובד</b>') + '. אפשר לתת הודעה ארוכה מהחוק, לא קצרה ממנו.</div>' +
        '<div class="rc-f">' + inp('hfNotice', 'תאריך המכתב (מסירת ההודעה)', t, 'date') +
        inp('hfDays', 'תקופת ההודעה המוקדמת (ימים)', n ? n.days : '', 'number', ' min="0" max="365" step="0.5" dir="ltr"') +
        '<label>בתקופת ההודעה<select id="hfMode"><option value="work">העובד/ת ממשיך/ה לעבוד</option><option value="paid">תמורת הודעה מוקדמת (לא עובד/ת)</option><option value="partial">חלקית עבודה, חלקית תמורה</option></select></label>' +
        inp('hfLast', 'יום העבודה האחרון', n ? addDays(t, n.days) : t, 'date') +
        inp('hfHearing', 'תאריך השימוע', prot ? prot.fields.hearingDate : s ? s.fields.hearingDate : '', 'date') +
        ta('hfWhy', 'הסיבה לסיום ההעסקה (לא חובה — נכתבת במכתב)', '', 2) + '</div>' +
        '<p class="rc-meta" id="hfNoticeLbl">' + (n ? 'לפי החוק: ' + e(n.label) : '') + '</p>' +
        '<div class="hr-legal" style="background:#fef2f2;color:#7f1d1d"><b>אסור לפטר בלי היתר</b> (מהממונה על חוק עבודת נשים / משרד העבודה) עובדת בהיריון (אחרי 6 חודשי עבודה), בחופשת לידה ו-60 יום אחריה, ' +
        'עובד/ת בטיפולי פוריות, עובד/ת במילואים או סמוך אחריהם, ועוד. גם פיטורים בזמן מחלה, או מסיבה מפלה — אסורים.' +
        '<label style="display:flex;gap:8px;align-items:center;margin-top:6px;font-weight:700"><input type="checkbox" id="hfProt"> בדקתי שאין מניעה חוקית לפיטורים</label></div>' +
        '<label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:13px"><input type="checkbox" id="hfEnd" checked> לרשום את יום העבודה האחרון כתאריך סיום בכרטיס העובד</label>';
    }
    html += '<div style="margin-top:10px"><b style="font-size:12.5px">חתימה בשם המעסיק (' + e(mgr) + ')</b>' + window.rcSigHtml('hfSig') + '</div>' +
      (kind !== 'protocol' ? '<label style="display:flex;gap:8px;align-items:center;margin:8px 0;font-weight:700"><input type="checkbox" id="hfSend" checked> לשלוח לעובד/ת באפליקציה ובמייל — לאישור קבלה בחתימה</label>' +
        '<p class="rc-meta" style="margin:0">בלי שליחה — מדפיסים את ה-PDF ומוסרים ביד (מומלץ להחתים על העותק).</p>' : '') +
      '<div class="merr" id="hfErr"></div><button class="btn primary" id="hfGo">' + ICON[kind] + ' הפקת ה' + (kind === 'summons' ? 'זימון' : kind === 'protocol' ? 'פרוטוקול' : kind === 'decision' ? 'החלטה' : 'מכתב') + ' וחתימה</button>';
    pane.innerHTML = html;
    const pad = window.rcSigPad('hfSig');
    const empPad = kind === 'protocol' ? window.rcSigPad('hfEmpSig') : null;
    $('hfBack').addEventListener('click', drawHr);
    if (kind === 'decision') $('hfDec').addEventListener('change', () => { $('hfWarnW').style.display = $('hfDec').value === 'warning' ? '' : 'none'; $('hfOtherW').style.display = $('hfDec').value === 'other' ? '' : 'none'; });
    if (kind === 'dismissal') {
      const re = () => {
        if (!P.startDate || !$('hfNotice').value) return;
        const n = noticeFor(P.type, P.startDate, $('hfNotice').value);
        $('hfDays').value = n.days; $('hfNoticeLbl').textContent = 'לפי החוק: ' + n.label;
        if ($('hfMode').value === 'work') $('hfLast').value = addDays($('hfNotice').value, n.days);
      };
      $('hfNotice').addEventListener('change', re);
      $('hfDays').addEventListener('input', () => { if ($('hfMode').value === 'work' && $('hfNotice').value) $('hfLast').value = addDays($('hfNotice').value, Number($('hfDays').value) || 0); });
    }
    $('hfGo').addEventListener('click', async () => {
      const sig = pad.value();
      if (!sig) { $('hfErr').textContent = 'יש לחתום בשם המעסיק'; return; }
      const v = (id) => ($(id) ? $(id).value : '');
      const fields = kind === 'summons' ? { hearingDate: v('hfDate'), hearingTime: v('hfTime'), place: v('hfPlace'), conductor: v('hfCond'), considered: v('hfConsidered'), reasons: v('hfReasons') }
        : kind === 'protocol' ? { hearingDate: v('hfDate'), place: v('hfPlace'), start: v('hfStart'), end: v('hfEnd'), attendees: v('hfAtt'), representative: v('hfRep'),
          employeePresent: $('hfPresent').checked, reasons: v('hfReasons'), response: v('hfResp'), notes: v('hfNotes'), conductor: s.fields.conductor }
        : kind === 'decision' ? { hearingDate: v('hfDate'), decision: v('hfDec'), warning: v('hfWarn'), other: v('hfOther'), reasoning: v('hfReason'), contact: v('hfContact') }
        : { noticeDate: v('hfNotice'), noticeDays: Number(v('hfDays')), noticeLabel: (() => { const n = P.startDate ? noticeFor(P.type, P.startDate, v('hfNotice')) : null; return n && n.days === Number(v('hfDays')) ? n.label : v('hfDays') + ' ימים'; })(),
          mode: v('hfMode'), lastDay: v('hfLast'), hearingDate: v('hfHearing'), decisionDate: dec ? String(dec.issuedAt || '').slice(0, 10) : '', reason: v('hfWhy'), checkedProtections: $('hfProt').checked };
      if (kind === 'dismissal' && !confirm('להפיק מכתב פיטורים ל' + P.name + '? יום עבודה אחרון: ' + dmy(fields.lastDay))) return;
      $('hfErr').textContent = 'מפיק…'; $('hfGo').disabled = true;
      const r = await apiPost({ action: 'issueHrDoc', ...mAuth(), employee: emp, kind, caseId: caseId || undefined, fields, signature: sig,
        send: $('hfSend') ? $('hfSend').checked : false, employeeSignature: empPad ? empPad.value() : undefined, employeeRefused: $('hfRefused') ? $('hfRefused').checked : false,
        setEndDate: $('hfEnd') ? $('hfEnd').checked : false });
      $('hfGo').disabled = false;
      if (!r.ok) { $('hfErr').textContent = r.error || 'שגיאה'; return; }
      say(TITLES[kind] + ' הופק ✓', 'ok');
      await load(); drawHr();
      const x = await apiPost({ action: 'hrDocPdf', ...mAuth(), id: r.id });
      if (x.ok) openFile(x.data, x.filename, 'application/pdf');
    });
  }

  /* ---------- picking an employee (⚙ ניהול ← 🗂 כרטיס עובד) ---------- */
  function openPicker() {
    if (!isAdmin()) { say('אדמין בלבד', 'err'); return; }
    const body = overlay('hrPickOverlay', '🗂 כרטיס עובד', 'בחירת עובד/ת — כולל עובדים שאינם פעילים', 520);
    const list = ((appState() && appState().employees) || []).slice().sort((a, b) => (a.active === false) - (b.active === false) || String(a.name).localeCompare(String(b.name), 'he'));
    body.innerHTML = '<input class="rc-in" id="hpQ" placeholder="חיפוש שם / מחלקה…"><div id="hpList" style="margin-top:8px;max-height:60vh;overflow:auto"></div>';
    const draw = () => {
      const q = $('hpQ').value.trim();
      $('hpList').innerHTML = list.filter((x) => !q || (x.name + ' ' + (x.dept || x.department || '')).includes(q)).map((x) => '<div class="rc-card" data-n="' + e(x.name) + '"><span class="t">' + e(x.name) + '</span> ' +
        '<span class="rc-meta">' + e(x.dept || x.department || '') + (x.active === false ? ' · לא פעיל/ה' : '') + '</span></div>').join('') || '<p class="rc-meta">לא נמצא</p>';
      $('hpList').querySelectorAll('[data-n]').forEach((c) => c.addEventListener('click', () => { $('hrPickOverlay').classList.add('hidden'); openCard(c.dataset.n); }));
    };
    $('hpQ').addEventListener('input', draw); draw(); setTimeout(() => $('hpQ').focus(), 50);
  }

  /* ================= the employee: letters from the employer ================= */
  let mine = [];
  async function fetchMine() {
    const s = appState();
    if (!s || !s.emp) return;
    try { const r = await apiPost({ action: 'myHrDocs', ...empAuth() }); if (r && r.ok) mine = r.items || []; } catch (_) { return; }
    if ($('hrBanner')) $('hrBanner').remove();
    const wait = mine.find((d) => d.needsAck), home = $('empHome');
    if (home && wait) {
      const links = home.querySelector('.eh-links');
      (links || home).insertAdjacentHTML(links ? 'beforebegin' : 'afterbegin', '<div id="hrBanner">📨 ' + e(wait.title) + ' ממתין לך — לחיצה לקריאה ולאישור קבלה</div>');
      $('hrBanner').addEventListener('click', () => openLetter(wait));
    }
    if ($('ehLetters')) $('ehLetters').style.display = mine.length ? '' : 'none';
  }
  function openMine() {
    const body = overlay('hrMineOverlay', '📨 מכתבים מהמעסיק', '', 640);
    body.innerHTML = mine.map((d) => '<div class="rc-doc"><span>' + (ICON[d.kind] || '📄') + ' ' + e(d.title) + ' <span class="rc-meta">' + e(d.issuedAt) + '</span>' +
      (d.needsAck ? ' <span class="rc-st" style="background:#fee2e2;color:#991b1b">ממתין לאישור קבלה</span>' : '') + '</span><button class="btn plain" data-i="' + d.id + '">פתיחה</button></div>').join('') || '<p class="rc-meta">אין מכתבים</p>';
    body.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => openLetter(mine.find((d) => d.id === Number(b.dataset.i)))));
  }
  function openLetter(d) {
    const body = overlay('hrLetterOverlay', (ICON[d.kind] || '📄') + ' ' + d.title, 'מאת: ' + d.issuedBy + ' · ' + d.issuedAt, 720);
    body.innerHTML = window.rcContentHtml(d.content) +
      (d.needsAck ? '<div class="hr-legal">החתימה מאשרת <b>שקיבלת את המסמך</b> בלבד — אין בה הסכמה לתוכנו.</div><b style="font-size:12.5px">החתימה שלי</b>' + window.rcSigHtml('hlSig') +
        '<div class="merr" id="hlErr"></div><button class="btn primary" id="hlGo">✍ קיבלתי את המסמך</button>' : '<p class="rc-meta">✓ הקבלה אושרה · ' + e(when(d.ackAt)) + '</p>') +
      ' <button class="btn plain" id="hlPdf">📄 PDF</button>';
    $('hlPdf').addEventListener('click', async () => {
      const x = await apiPost({ action: 'hrDocPdf', ...empAuth(), id: d.id });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      openFile(x.data, x.filename, 'application/pdf');
    });
    if (!d.needsAck) return;
    const pad = window.rcSigPad('hlSig');
    $('hlGo').addEventListener('click', async () => {
      const sig = pad.value();
      if (!sig) { $('hlErr').textContent = 'יש לחתום בתיבת החתימה'; return; }
      $('hlErr').textContent = 'שולח…';
      const r = await apiPost({ action: 'ackHrDoc', ...empAuth(), id: d.id, signature: sig });
      if (!r.ok) { $('hlErr').textContent = r.error || 'שגיאה'; return; }
      $('hrLetterOverlay').classList.add('hidden'); say('הקבלה אושרה ✓', 'ok'); fetchMine();
    });
  }

  /* ================= wiring ================= */
  function start() {
    // the employee's card: one button for everything (the separate ones hidden — their windows still work)
    const recBtns = $('empRecBtns');
    if (recBtns && !$('empFullBtn')) {
      recBtns.insertAdjacentHTML('afterbegin', '<button type="button" class="btn primary" id="empFullBtn" style="padding:5px 12px;font-size:12.5px">🗂 כרטיס עובד מלא</button>');
      ['empDetBtn', 'empConBtn'].forEach((id) => { if ($(id)) $(id).style.display = 'none'; });
      $('empFullBtn').addEventListener('click', () => {
        const cur = typeof _currentEmp !== 'undefined' && _currentEmp ? _currentEmp.name : ($('empCardName') ? $('empCardName').textContent.trim() : '');
        if (cur) openCard(cur);
      });
    }
    const drop = $('menuAdminDrop');
    if (drop && !$('hrMenuBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="hrMenuBtn">🗂 כרטיס עובד</button>');
      $('hrMenuBtn').addEventListener('click', openPicker);
      $('menuAdminBtn')?.addEventListener('click', () => { $('hrMenuBtn').style.display = isAdmin() ? '' : 'none'; }, true);
    }
    const links = document.querySelector('#empHome .eh-links');
    if (links && !$('ehLetters')) {
      links.insertAdjacentHTML('beforeend', '<button data-go="letters" id="ehLetters" style="display:none"><span class="ic">📨</span>מכתבים מהמעסיק</button>');
      $('ehLetters').addEventListener('click', openMine);
    }
    const home = $('empHome');
    if (home) {
      let shown = !home.classList.contains('hidden');
      if (shown) fetchMine();
      new MutationObserver(() => { const now = !home.classList.contains('hidden'); if (now && !shown) fetchMine(); shown = now; })
        .observe(home, { attributes: true, attributeFilter: ['class'] });
    }
  }
  window.openEmployeeCard = openCard;
  window.openEmployeeCardPicker = openPicker;
  window.openMyLetters = openMine;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
