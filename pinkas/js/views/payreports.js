// clearcount — 📄 payroll reports (#/payroll/reports/<YYYY-MM | YYYY>), from the CLOSED months (api/clearcount.ts
// ccPayrollReport, _shared/payroll-reports-core.ts): the month — 102 (income tax withheld; national insurance + health
// by the kind of insured) and the contributions to the pension / study funds per employee; the year — per employee
// (form 106) and the totals (126). Summaries to fill the official forms by — the filing is the employer's, on the Tax
// Authority's / National Insurance's sites. Print (→ PDF) and CSV.
import { S } from '../store.js';
import { e, money, $, $$, toast, download, toCsv, modal, field, inp, check } from '../ui.js';
import { today, monthOf, monthName, addMonths } from '../calc.js';
import { call } from '../cloud.js';
import { go } from '../app.js';

const CSS = `<style>
.pr{font:13px/1.4 system-ui,Arial,sans-serif;color:#111;background:#fff;direction:rtl}
.pr table{width:100%;border-collapse:collapse;margin:6px 0 12px}.pr td,.pr th{border:1px solid #bbb;padding:3px 6px;text-align:right}
.pr th{background:#f1f1f1;font-size:12px}.pr .n{text-align:left;direction:ltr;white-space:nowrap}.pr .tot td{font-weight:700;background:#fafafa}
.pr h2{margin:4px 0;font-size:18px}.pr h3{margin:10px 0 2px;font-size:15px}.pr .k{color:#555;font-size:12px}
.pr .note{background:#fff3cd;border:1px solid #e0c46c;padding:4px 8px;font-size:12px;margin:6px 0}
</style>`;
const n2 = (v) => Number(v || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mm = (ym) => ym.slice(5) + '/' + ym.slice(0, 4);
const NOTE = '<div class="note">סיכום לבדיקה ולמילוי הטפסים — לא דיווח רשמי. הדיווח והתשלום: באתרי רשות המסים והביטוח הלאומי (ולקופות — בממשק שלהן). התלושים עדיין סימולציה.</div>';
const head = (r, title) => `<h2>${e(title)}</h2><div class="k">${e(r.company.legalName || r.company.name)}${r.company.taxId ? ' · ח.פ. / ע.מ. ' + e(r.company.taxId) : ''}${r.company.taxFileNo ? ' · תיק ניכויים ' + e(r.company.taxFileNo) : ''}</div>`;

function monthHtml(r) {
  const types = Object.entries(r.byType);
  return CSS + `<div class="pr">${head(r, 'דוח 102 — ' + mm(r.month))}${NOTE}
    <h3>מס הכנסה — ניכויים ממשכורת</h3>
    <table><tr><th>עובדים</th><th class="n">סה"כ תשלומים</th><th class="n">הכנסה חייבת</th><th class="n">מס שנוכה — לתשלום</th></tr>
      <tr><td>${r.employees}</td><td class="n">${n2(r.gross)}</td><td class="n">${n2(r.taxable)}</td><td class="n"><b>${n2(r.tax)}</b></td></tr></table>
    <h3>ביטוח לאומי ומס בריאות — לפי סוג המבוטח</h3>
    <table><tr><th>סוג המבוטח</th><th>עובדים</th><th class="n">הכנסה מבוטחת</th><th class="n">ב"ל עובד</th><th class="n">בריאות</th><th class="n">ב"ל מעסיק</th><th class="n">סה"כ</th></tr>
      ${types.map(([k, b]) => `<tr><td>${e(r.typeNames[k] || k)}</td><td>${b.count}</td><td class="n">${n2(b.insured)}</td><td class="n">${n2(b.employee)}</td><td class="n">${n2(b.health)}</td><td class="n">${n2(b.employer)}</td><td class="n">${n2(b.employee + b.health + b.employer)}</td></tr>`).join('')}
      <tr class="tot"><td>סה"כ לתשלום לביטוח הלאומי</td><td>${r.employees}</td><td></td><td class="n">${n2(r.bl.employee)}</td><td class="n">${n2(r.bl.health)}</td><td class="n">${n2(r.bl.employer)}</td><td class="n">${n2(r.blToPay)}</td></tr></table>
    <h3>הפרשות לקופות (פנסיה וקרן השתלמות)</h3>
    ${r.funds.length ? `<table><tr><th>עובד/ת</th><th>ת"ז</th><th class="n">פנסיה עובד</th><th class="n">פנסיה מעסיק</th><th class="n">פיצויים</th><th class="n">השתלמות עובד</th><th class="n">השתלמות מעסיק</th></tr>
      ${r.funds.map((f) => `<tr><td>${e(f.employee)}</td><td class="n">${e(f.idNumber)}</td><td class="n">${n2(f.pensionEmp)}</td><td class="n">${n2(f.pensionEr)}</td><td class="n">${n2(f.severance)}</td><td class="n">${n2(f.sfEmp)}</td><td class="n">${n2(f.sfEr)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="2">סה"כ</td><td class="n">${n2(r.fundTotals.pensionEmp)}</td><td class="n">${n2(r.fundTotals.pensionEr)}</td><td class="n">${n2(r.fundTotals.severance)}</td><td class="n">${n2(r.fundTotals.sfEmp)}</td><td class="n">${n2(r.fundTotals.sfEr)}</td></tr></table>` : '<p class="k">אין הפרשות לקופות בחודש הזה.</p>'}
  </div>`;
}
function yearHtml(r) {
  return CSS + `<div class="pr">${head(r, 'סיכום שנתי ' + r.year + ' (126)')}${NOTE}
    <div class="k">חודשים שנסגרו: ${r.months.length ? r.months.map(mm).join(', ') : '—'}</div>
    <table><tr><th>עובד/ת</th><th>ת"ז</th><th>חודשים</th><th class="n">ברוטו</th><th class="n">הכנסה חייבת</th><th class="n">מס הכנסה</th><th class="n">פטור</th><th class="n">ב"ל</th><th class="n">בריאות</th><th class="n">פנסיה עובד</th></tr>
      ${r.employees.map((x) => `<tr><td>${e(x.employee)}</td><td class="n">${e(x.idNumber)}</td><td>${x.months.length}</td><td class="n">${n2(x.gross)}</td><td class="n">${n2(x.taxable)}</td><td class="n">${n2(x.tax)}</td><td class="n">${n2(x.exempt)}</td><td class="n">${n2(x.bl)}</td><td class="n">${n2(x.health)}</td><td class="n">${n2(x.pensionEmp)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="3">סה"כ (${r.count} עובדים)</td><td class="n">${n2(r.totals.gross)}</td><td class="n">${n2(r.totals.taxable)}</td><td class="n">${n2(r.totals.tax)}</td><td class="n">${n2(r.totals.exempt)}</td><td class="n">${n2(r.totals.bl)}</td><td class="n">${n2(r.totals.health)}</td><td class="n">${n2(r.totals.pensionEmp)}</td></tr></table>
  </div>`;
}
/** form 106 — one employee's year (the employer gives it by the end of March) */
function f106Html(r, x) {
  return CSS + `<div class="pr">${head(r, 'טופס 106 — ' + r.year)}${NOTE}
    <table><tr><th>עובד/ת</th><td>${e(x.employee)}</td><th>ת"ז</th><td class="n">${e(x.idNumber)}</td></tr>
      <tr><th>חודשי עבודה</th><td colspan="3">${x.months.map(mm).join(', ')}</td></tr></table>
    <table><tr><th>פרט</th><th class="n">סכום שנתי</th></tr>
      <tr><td>סה"כ תשלומים (ברוטו)</td><td class="n">${n2(x.gross)}</td></tr>
      <tr><td>הכנסה חייבת במס</td><td class="n">${n2(x.taxable)}</td></tr>
      <tr><td>תשלומים פטורים (למשל פיצויים בתקרה)</td><td class="n">${n2(x.exempt)}</td></tr>
      <tr class="tot"><td>מס הכנסה שנוכה</td><td class="n">${n2(x.tax)}</td></tr>
      <tr><td>ביטוח לאומי (עובד/ת)</td><td class="n">${n2(x.bl)}</td></tr>
      <tr><td>מס בריאות</td><td class="n">${n2(x.health)}</td></tr>
      <tr><td>הפרשת העובד/ת לפנסיה</td><td class="n">${n2(x.pensionEmp)}</td></tr>
      <tr><td>הפרשת העובד/ת לקרן השתלמות</td><td class="n">${n2(x.sfEmp)}</td></tr>
      <tr><td>נקודות זיכוי (סכום החודשים)</td><td class="n">${n2(x.points)}</td></tr></table>
  </div>`;
}
function print(title, html) {
  const w = window.open('', '_blank');
  if (!w) return toast('הדפדפן חסם את החלון', 'err');
  w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${e(title)}</title><style>body{margin:8px}@page{size:A4;margin:10mm}</style></head><body>${html}<script>print()<\/script></body></html>`);
  w.document.close();
}

/** 📤 the funds' file of a closed month (api ccPensionFile): a test file by default; a bank transfer needs its reference
 *  and date; what is missing is listed; each file is downloaded */
async function pensionFile(ym) {
  const viaBank = (S.settings.payroll?.funds || []).filter((f) => Number(f.payMethod) === 1);
  const v = await modal('📤 קובץ לקופות — ' + monthName(ym),
    '<p class="small">קובץ לפי המבנה האחיד של רשות שוק ההון (ממשק מעסיקים — דיווח שוטף, גרסה 6), מהתלושים של החודש שנסגר. קובץ אחד לכל חברה מנהלת וסוג קופה.</p>' +
    check('test', 'קובץ בדיקה (TEST) — לבדיקת קליטה בקופה לפני הדיווח האמיתי', true) +
    viaBank.map((f) => `<div class="f"><span>העברה בנקאית ל-${e(f.name)}</span><div class="grid2">${field('מספר אסמכתא', inp('ref_' + f.id, ''))}${field('תאריך ההעברה', inp('date_' + f.id, '', 'type="date"'))}</div></div>`).join(''),
    [{ label: 'ביטול', value: null }, { label: 'הפקה', kind: 'primary', value: 1, submit: true }]);
  if (!v) return;
  const transfers = Object.fromEntries(viaBank.map((f) => [f.id, { ref: String(v['ref_' + f.id] || '').trim(), date: v['date_' + f.id] || '' }]));
  const r = await call('pensionFile', { month: ym, test: !!v.test, transfers });
  if (!r.ok) return toast(r.error || 'שגיאה', 'err');
  if (r.missing?.length) {
    await modal('חסרים פרטים לקובץ', `<p>כדי שהקופה תקלוט את הקובץ, צריך להשלים:</p><ul class="small">${r.missing.map((m) => `<li>${e(m)}</li>`).join('')}</ul>
      <p class="muted small">פרטי עובד/ת — בטופס 101 או בכרטיס העובד/ת בסידורית. קופות ואיש קשר — <a href="#/payroll/funds">🏦 קופות</a>.</p>`);
    return;
  }
  if (!r.files.length) return toast('אין הפרשות לקופות בחודש הזה', 'err');
  const res = await modal('📤 הקבצים מוכנים' + (r.test ? ' (בדיקה)' : ''), `<ul class="list">${r.files.map((f, i) => `<li class="row"><span><b>${e(f.funds.join(', '))}</b>
      <small class="muted">${e(f.kindName)} · ${f.employees} עובדים · ${money(f.total)}</small></span><button class="btn sm" type="button" data-f="${i}">⬇ הורדה</button></li>`).join('')}</ul>
    <p class="muted small">מעלים את הקובץ בפורטל המעסיקים של הקופה (או במסלקה). הקופה מחזירה תשובה על הקליטה — אם יש שגיאה, כדאי לשלוח אותה לבדיקה.
      "סך תשלומים פטורים" מדווח כהפרשות העובד והמעסיק לתגמולים — בשכר גבוה במיוחד לבדוק עם רואה החשבון.</p>`,
    [{ label: 'סגירה', value: null }], { onOpen: (fm) => $$('[data-f]', fm).forEach((b) => { b.onclick = () => { const f = r.files[Number(b.dataset.f)]; download(f.name, f.xml, 'application/xml'); }; }) });
  return res;
}

/** 🔍 the parallel run (#/payroll/compare/YYYY-MM): a closed month against the official payslips uploaded to Sidurit —
 *  the official ones are read by the AI a few at a time (api ccPayrollCompare `more` → called again) */
export async function payCompareView(main, ym) {
  main.innerHTML = `
    <div class="head row"><h1>🔍 השוואה לתלושים הרשמיים</h1><a class="btn" href="#/payroll/${ym}">→ לשכר החודש</a></div>
    <div class="monthbar"><a class="btn sm" href="#/payroll/compare/${addMonths(ym, -1)}">→</a><b>${monthName(ym)}</b><a class="btn sm" href="#/payroll/compare/${addMonths(ym, 1)}">←</a></div>
    <div class="card hint small">התלושים שלנו (מהחודש שנסגר) מול התלושים הרשמיים של מערכת השכר / רואה החשבון, שהועלו לסידורית (📁 טפסים ותלושים). כל תלוש רשמי נקרא פעם אחת ב-AI. פער של עד ${2} ₪ — עיגול, ונחשב תואם.</div>
    <div id="cp"><p class="muted">טוען…</p></div>`;
  const box = $('#cp', main);
  let r, refresh;
  for (let round = 0; round < 30; round++) {                 // a few payslips are read per call
    r = await call('payrollCompare', { month: ym, ...(refresh ? { refresh } : {}) });
    refresh = null;
    if (!box.isConnected) return;
    if (!r.ok) { box.innerHTML = `<div class="card warn">${e(r.error || 'שגיאה')} <a href="#/payroll/${ym}">לחודש ←</a></div>`; return; }
    draw();
    if (!r.more) break;
  }
  function draw() {
    const s = r.summary;
    const badge = { same: '<span class="tag ok">✓ תואם</span>', diff: '<span class="tag bad">≠ פער</span>', missing: '<span class="tag">אין תלוש רשמי</span>', pending: '<span class="tag wait">⏳ נקרא…</span>', error: '<span class="tag bad">⚠ לא נקרא</span>' };
    box.innerHTML = `<div class="kpis">
        <div class="kpi"><small>עובדים</small><b>${s.employees}</b></div><div class="kpi pos"><small>תואמים</small><b>${s.same}</b></div>
        <div class="kpi ${s.diff ? 'neg' : ''}"><small>עם פער</small><b>${s.diff}</b></div><div class="kpi"><small>בלי תלוש רשמי</small><b>${s.missing}</b></div></div>
      ${r.more ? `<p class="muted">קורא את התלושים הרשמיים… נשארו ${r.more}</p>` : ''}
      ${r.rows.map((x, i) => `<div class="card"><div class="row"><b>${x.number ? '#' + x.number + ' ' : ''}${e(x.employee)}</b> ${badge[x.status]}
          ${x.status === 'same' || x.status === 'diff' || x.status === 'error' ? `<button class="btn sm ghost" data-re="${i}" title="לקרוא שוב את התלוש הרשמי">↻</button>` : ''}</div>
        ${x.error ? `<p class="neg small">${e(x.error)}</p>` : ''}
        ${(x.warnings || []).map((w) => `<p class="neg small">⚠ ${e(w)} — אולי הועלה קובץ לא נכון</p>`).join('')}
        ${x.rows ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th></th><th class="n">שלנו</th><th class="n">רשמי</th><th class="n">פער</th></tr></thead><tbody>
          ${x.rows.map((c) => `<tr><td>${e(c.label)}</td><td class="n">${money(c.ours)}</td><td class="n">${money(c.theirs)}</td><td class="n ${c.ok ? '' : 'neg'}">${c.diff ? (c.diff > 0 ? '+' : '') + money(c.diff) : '—'}</td></tr>`).join('')}
        </tbody></table></div>` : ''}</div>`).join('')}
      <p class="muted small">פער — לבדוק בתלוש מה שונה (שעות, תעריף, נקודות זיכוי, הגדרת העובד/ת ב-⚙), לתקן ולסגור את החודש מחדש. ↻ — קריאה חוזרת של התלוש הרשמי (למשל אחרי העלאת קובץ מתוקן).</p>`;
    $$('[data-re]', box).forEach((b) => { b.onclick = async () => { refresh = r.rows[Number(b.dataset.re)].employee; b.disabled = true;
      r = await call('payrollCompare', { month: ym, refresh }); refresh = null; if (r.ok) draw(); else toast(r.error || 'שגיאה', 'err'); }; });
  }
}

export async function payReportsView(main, arg) {
  const isYear = /^\d{4}$/.test(arg || '');
  const ym = !isYear && /^\d{4}-\d{2}$/.test(arg || '') ? arg : addMonths(monthOf(today()), -1);
  const year = isYear ? arg : ym.slice(0, 4);
  main.innerHTML = `
    <div class="head row"><h1>📄 דוחות שכר</h1><a class="btn" href="#/payroll/${ym}">→ לשכר החודש</a></div>
    <div class="chips"><a class="chip${isYear ? '' : ' on'}" href="#/payroll/reports/${ym}">חודשי — 102 וקופות</a><a class="chip${isYear ? ' on' : ''}" href="#/payroll/reports/${year}">שנתי — 126 ו-106</a></div>
    <div class="monthbar">${isYear
      ? `<a class="btn sm" href="#/payroll/reports/${Number(year) - 1}">→</a><b>${year}</b><a class="btn sm" href="#/payroll/reports/${Number(year) + 1}">←</a>`
      : `<a class="btn sm" href="#/payroll/reports/${addMonths(ym, -1)}">→</a><b>${monthName(ym)}</b><a class="btn sm" href="#/payroll/reports/${addMonths(ym, 1)}">←</a>`}</div>
    <div id="rp"><p class="muted">טוען…</p></div>`;
  const box = $('#rp', main);
  const r = await call('payrollReport', isYear ? { year } : { month: ym });
  if (!box.isConnected) return;
  if (!r.ok) { box.innerHTML = `<div class="card warn">${e(r.error || 'שגיאה')}${!isYear ? ` <a href="#/payroll/${ym}">לחודש ←</a>` : ''}</div>`; return; }
  const html = isYear ? yearHtml(r) : monthHtml(r);
  box.innerHTML = `<div class="card row"><span class="muted small">${isYear ? r.count + ' עובדים · ' + r.months.length + ' חודשים סגורים' : r.employees + ' תלושים'}</span>
      <span class="actions"><button class="btn" id="csv">⬇ CSV</button><button class="btn primary" id="prt">🖨 הדפסה / PDF</button></span></div>
    <div class="card" style="overflow-x:auto">${html}</div>
    ${!isYear ? `<div class="card row"><span><b>📤 קובץ לקופות</b> <small class="muted">ממשק מעסיקים — דיווח שוטף (גרסה 6): קובץ XML לכל חברה מנהלת, להעלאה לפורטל המעסיקים של הקופה או למסלקה.
      הקופות וסעיף 14 — ב-<a href="#/payroll/funds">🏦 קופות</a> וב-⚙ של העובד/ת.</small></span><button class="btn" id="pen">📤 הפקת קובץ</button></div>` : ''}
    ${isYear && r.count ? `<div class="card"><b>טופס 106 לעובד/ת:</b> <span class="chips">${r.employees.map((x, i) => `<button class="chip" data-106="${i}">${e(x.employee)}</button>`).join('')}</span></div>` : ''}`;
  const pen = $('#pen', box);
  if (pen) pen.onclick = () => pensionFile(ym);
  $('#prt', box).onclick = () => print((isYear ? 'סיכום שנתי ' + year : 'דוח 102 ' + mm(ym)) + ' — ' + (S.settings.business || ''), html);
  $$('[data-106]', box).forEach((b) => { b.onclick = () => { const x = r.employees[Number(b.dataset['106'])]; print('טופס 106 ' + year + ' — ' + x.employee, f106Html(r, x)); }; });
  $('#csv', box).onclick = () => {
    if (isYear) download('סיכום שנתי ' + year + '.csv', toCsv([['עובד/ת', 'ת"ז', 'חודשים', 'ברוטו', 'הכנסה חייבת', 'מס הכנסה', 'פטור', 'ביטוח לאומי', 'בריאות', 'פנסיה עובד', 'השתלמות עובד', 'נקודות זיכוי'],
      ...r.employees.map((x) => [x.employee, x.idNumber, x.months.length, x.gross, x.taxable, x.tax, x.exempt, x.bl, x.health, x.pensionEmp, x.sfEmp, x.points])]), 'text/csv');
    else download('הפרשות לקופות ' + ym + '.csv', toCsv([['עובד/ת', 'ת"ז', 'פנסיה עובד', 'פנסיה מעסיק', 'פיצויים', 'השתלמות עובד', 'השתלמות מעסיק'],
      ...r.funds.map((f) => [f.employee, f.idNumber, f.pensionEmp, f.pensionEr, f.severance, f.sfEmp, f.sfEr]), [], ['מס הכנסה לתשלום', r.tax], ['ביטוח לאומי לתשלום', r.blToPay]]), 'text/csv');
  };
}
