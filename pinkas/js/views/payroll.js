// clearcount — 👷 payroll (#/payroll/YYYY-MM), only inside Sidurit: the month's employees from the attendance (hours,
// rights, Form 101) → a payslip SIMULATION each (computed on the server, api/clearcount.ts ccPayroll), the totals, and
// "record as an expense" — the month's employer cost as one locked expense ("שכר עובדים") in the ledger. The employer's
// settings per employee (payPeople: salary, travel, locality discount, extra credit points, pension) and how recovery is
// paid (settings.payroll) are kept in the ledger and synced before each calculation.
import { S, save, saveSettings, uid } from '../store.js';
import { e, money, money0, $, $$, toast, modal, field, money_in, inp, sel, check, confirmBox } from '../ui.js';
import { today, monthOf, monthName, addMonths, num } from '../calc.js';
import { call, syncNow } from '../cloud.js';
import { go } from '../app.js';
import { payReportsView, payCompareView } from './payreports.js';
import { payFundsView, FUND_KINDS } from './payfunds.js';

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const setupOf = (name) => S.payPeople.find((x) => x.employee === name) || null;
// the funds of 🏦 קופות; with one fund of the kind — everyone is in it (the server does the same)
const fundOpts = (ofKind) => { const l = (S.settings.payroll?.funds || []).filter((f) => ofKind(f.kind));
  return [['', l.length === 1 ? 'ברירת מחדל — ' + l[0].name : l.length ? '— לבחור —' : 'אין קופות (🏦 קופות)'], ...l.map((f) => [f.id, f.name + ' (' + (FUND_KINDS.find((k) => k[0] === f.kind) || ['', ''])[1] + ')'])]; };
// the funds' file (🏦 קופות): which fund, section 14 — in the employee's ⚙ (in a closed month — only this)
const fundSection = (s) => `<div class="f"><span>🏦 קופות — לקובץ הדיווח לקופות</span><div class="grid2">${field('קופת הפנסיה', sel('pensionFund', fundOpts((k) => k !== 'study'), s.pensionFund || ''))}
      ${field('קרן ההשתלמות', sel('studyFundId', fundOpts((k) => k === 'study'), s.studyFundId || ''))}</div>
      <div class="grid2">${field('סעיף 14', sel('sec14', SEC14, s.sec14 || 1), 'ההפקדות לפיצויים במקום פיצויים. בפנסיית חובה — כן, מתחילת העבודה')}
      ${field('מתאריך (לאפשרות 2 או 4)', inp('sec14Date', s.sec14Date || '', 'type="date"'))}</div></div>`;
const fundValues = (r) => ({ pensionFund: r.pensionFund || null, studyFundId: r.studyFundId || null, sec14: Number(r.sec14) || 1, sec14Date: r.sec14Date || null });
async function editFunds(row) {
  const s = setupOf(row.employee) || { employee: row.employee };
  const r = await modal('קופות — ' + row.employee, fundSection(s) + '<p class="muted small">החודש נסגר — שאר הגדרות השכר נערכות בחודש פתוח.</p>',
    [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true }]);
  if (!r) return;
  await save('payPeople', { ...s, id: s.id || 'pp-' + row.employee.slice(0, 60), employee: row.employee, ...fundValues(r) });
  toast('נשמר ✓');
}
const SEC14 = [[1, 'כן — מתחילת העבודה'], [2, 'כן — מתאריך אחר'], [3, 'לא חתום/ה על סעיף 14'], [4, 'כבר לא חל — מתאריך'], [5, 'קושי משפטי לקבוע (ענפים מסוימים)']];
// the kinds of insured (the server's _shared/payslip-core.ts BL_TYPES)
const BL_TYPES = [['auto', 'לפי הגיל (רגיל; מתחת ל-18 — נוער)'], ['regular', 'תושב/ת ישראל, 18 עד גיל הפרישה'], ['youth', 'מתחת לגיל 18'],
  ['pensioner', 'מקבל/ת קצבת אזרח ותיק'], ['retiredW', 'אישה בין גיל הפרישה ל-67, בלי קצבה'], ['retired67', 'בין 67 ל-70, בלי קצבה'],
  ['foreign', 'תושב/ת זר/ה'], ['treaty', 'תושב/ת זר/ה ממדינת אמנה'], ['territories', 'תושב/ת שטחים'], ['disabled', 'קצבת נכות עם אישור פטור']];

export async function payrollView(main, arg, sub) {
  if (arg === 'reports') return payReportsView(main, sub);
  if (arg === 'funds') return payFundsView(main);
  if (arg === 'compare') return payCompareView(main, /^\d{4}-\d{2}$/.test(sub || '') ? sub : addMonths(monthOf(today()), -1));
  const ym = arg && /^\d{4}-\d{2}$/.test(arg) ? arg : addMonths(monthOf(today()), -1);   // the month just closed
  const cfg = S.settings.payroll || {};
  main.innerHTML = `
    <div class="head row"><h1>👷 שכר עובדים</h1><span class="actions"><a class="btn" href="#/payroll/reports">📄 דוחות שכר</a><a class="btn" href="#/payroll/funds">🏦 קופות</a><button class="btn" id="cfg">⚙ הגדרות שכר</button></span></div>
    <div class="monthbar"><a class="btn sm" href="#/payroll/${addMonths(ym, -1)}">→</a><b>${monthName(ym)}</b>${ym < monthOf(today()) ? `<a class="btn sm" href="#/payroll/${addMonths(ym, 1)}">←</a>` : '<span></span>'}</div>
    <div class="card warn small">🧪 <b>סימולציה לבדיקה — לא תלוש שכר רשמי.</b> מחושב מנתוני הנוכחות בסידורית, מהזכויות לפי החוק ומטופס 101.
      יש לאמת מול רואה החשבון / מערכת השכר לפני כל שימוש.</div>
    <div id="pr"><p class="muted">מחשב…</p></div>`;
  $('#cfg', main).onclick = async () => {
    const r = await modal('הגדרות שכר', field('דמי הבראה', sel('recoveryMode', [['monthly', 'כל חודש (חלק יחסי)'], ['annual', 'פעם בשנה']], cfg.recoveryMode || 'monthly')) +
      field('חודש התשלום השנתי', sel('recoveryMonth', MONTHS.map((m, i) => [i + 1, m]), cfg.recoveryMonth || 6), 'רק כשההבראה משולמת פעם בשנה') +
      field('חישוב מס הכנסה', sel('taxMethod', [['monthly', 'חודשי — כל חודש בנפרד'], ['cumulative', 'מצטבר מתחילת השנה (לפי החודשים שנסגרו)']], cfg.taxMethod || 'monthly'),
        'מצטבר — המס של כל חודש מתחשב בחודשים הקודמים שנסגרו (🔒), ומחזיר מס שנוכה ביותר') +
      field('ריבית לפי החוק להלוואות לעובדים (% לשנה)', inp('loanRate', cfg.loanRate ?? '', 'inputmode="decimal" dir="ltr" class="num" placeholder="לפי סעיף 3(ט) — מרו״ח"'),
        'הלוואה בריבית נמוכה מזו — ההפרש נרשם בתלוש כשווי הטבת ריבית (חייב במס)'),
      [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true }]);
    if (!r) return;
    await saveSettings({ payroll: { ...(S.settings.payroll || {}), recoveryMode: r.recoveryMode, recoveryMonth: Number(r.recoveryMonth), loanRate: String(r.loanRate).trim() === '' ? null : num(r.loanRate), taxMethod: r.taxMethod } });
    await syncNow(); go('#/payroll/' + ym);
  };
  const box = $('#pr', main);
  await syncNow();                                  // the settings above are read by the server
  const r = await call('payroll', { month: ym });
  if (!box.isConnected) return;                     // the screen was left while computing
  if (!r.ok) { box.innerHTML = `<div class="card err-card">${e(r.error || 'שגיאה')}</div>`; return; }
  const t = r.totals;
  box.innerHTML = `
    <div class="kpis">
      <div class="kpi"><small>עובדים</small><b>${t.employees}</b></div>
      <div class="kpi"><small>ברוטו</small><b>${money0(t.gross)}</b></div>
      <div class="kpi"><small>נטו לתשלום</small><b>${money0(t.net)}</b></div>
      <div class="kpi neg"><small>עלות מעסיק</small><b>${money0(t.employerCost)}</b></div>
    </div>
    ${r.closed ? `<div class="card row"><span>🔒 <b>החודש נסגר</b> ב-${new Date(r.closed.at).toLocaleDateString('he-IL')} ע"י ${e(r.closed.by)} · התלושים נשמרו (מס׳ ${r.rows.map((x) => x.number).filter(Boolean).sort((a, b) => a - b).slice(0, 1).concat(r.rows.map((x) => x.number).filter(Boolean).sort((a, b) => b - a).slice(0, 1)).join('–')})${r.posted ? ' · נרשם כהוצאה: <b>' + money(r.posted.amount) + '</b>' : ''}</span>
      <span class="actions"><a class="btn" href="#/payroll/compare/${ym}">🔍 השוואה לתלושים הרשמיים</a>${r.closed.latest ? '<button class="btn ghost" id="reopen">פתיחה מחדש</button>' : ''}</span></div>`
    : `<div class="card row">
      <span>${r.posted ? `✅ נרשם כהוצאה: <b>${money(r.posted.amount)}</b>${Math.abs(r.posted.amount - t.employerCost) > 0.5 ? ' · <span class="neg">השתנה מאז — כדאי לעדכן</span>' : ''}` : 'עלות המעסיק של החודש עוד לא נרשמה בהוצאות.'}</span>
      ${t.employees ? `<span class="actions"><button class="btn" id="post">📥 ${r.posted ? 'עדכון ההוצאה' : 'רישום כהוצאה'} — ${money0(t.employerCost)}</button>${ym < monthOf(today()) ? '<button class="btn primary" id="close">🔒 סגירת החודש</button>' : ''}</span>` : ''}
    </div>`}
    <div class="card flush"><table class="tbl click"><thead><tr><th>עובד/ת</th><th class="n sm-hide">שעות</th><th class="sm-hide">101</th><th class="n">ברוטו</th><th class="n">נטו</th><th class="n">עלות מעסיק</th><th></th></tr></thead>
      <tbody>${r.rows.map((x, i) => `<tr data-i="${i}"><td>${x.number ? `<small class="muted">#${x.number}</small> ` : ''}<b class="sm">${e(x.employee)}</b><small class="muted"> ${e(x.empType)}${x.f101 ? '' : ' · <span class="neg">אין 101</span>'}${x.approval === 'ממתין' ? ' · ⏳ לא אישר/ה שעות' : ''}</small></td>
        <td class="n sm-hide">${x.hours}</td><td class="sm-hide">${x.f101 ? e(x.f101) : '<span class="neg">חסר</span>'}</td><td class="n">${money0(x.gross)}</td><td class="n">${money0(x.net)}</td>
        <td class="n">${money0(x.employerCost)}</td><td style="white-space:nowrap"><button class="btn sm ghost" data-items="${i}" title="רכיבים וניכויים: מתנות, תשלומים, הלוואות, מפרעות, קנסות" aria-label="רכיבים וניכויים">🧾${(setupOf(x.employee)?.items || []).length ? '<sup>' + setupOf(x.employee).items.length + '</sup>' : ''}</button><button class="btn sm ghost" data-set="${i}" aria-label="הגדרות שכר לעובד/ת">⚙</button></td></tr>`).join('') ||
        '<tr><td colspan="7" class="muted">אין שעות עבודה בחודש הזה.</td></tr>'}</tbody></table></div>
    <p class="muted small">לחיצה על עובד/ת — התלוש המפורט. ⚙ — משכורת חודשית, נסיעות, יישוב מזכה, נקודות זיכוי נוספות ופנסיה. ${e(r.params)}</p>`;
  $$('tr[data-i]', box).forEach((tr) => { tr.onclick = (ev) => { if (!ev.target.closest('[data-set],[data-items]')) slipView(r.rows[Number(tr.dataset.i)], ym); }; });
  $$('[data-items]', box).forEach((b) => { b.onclick = async () => { if (await editItems(r.rows[Number(b.dataset.items)], ym)) go('#/payroll/' + ym); }; });
  $$('[data-set]', box).forEach((b) => { b.onclick = async () => { if (await editSetup(r.rows[Number(b.dataset.set)])) go('#/payroll/' + ym); }; });
  const close = $('#close', box), reopen = $('#reopen', box);
  if (r.closed) {   // the setup changes the coming months — a closed month: only the funds (for the funds' file)
    $$('[data-items]', box).forEach((b) => { b.disabled = true; b.title = 'החודש נסגר'; });
    $$('[data-set]', box).forEach((b) => { b.title = 'החודש נסגר — קופות וסעיף 14 בלבד'; b.onclick = async () => { await editFunds(r.rows[Number(b.dataset.set)]); }; });
  }
  if (close) close.onclick = async () => {
    if (!(await confirmBox('לסגור את ' + monthName(ym) + '?\n\n' + t.employees + ' תלושים יישמרו כפי שהם עכשיו, יקבלו מספר, ועלות המעסיק (' + money(t.employerCost) +
      ') תירשם בהוצאות. אחרי הסגירה החודש לא מחושב מחדש (אפשר לפתוח מחדש רק את החודש האחרון שנסגר). התלושים נשארים סימולציה — לא נשלחים לעובדים.', '🔒 סגירה', 'primary'))) return;
    close.disabled = true;
    const x = await call('payrollClose', { month: ym });
    close.disabled = false;
    if (!x.ok) return toast(x.error || 'שגיאה', 'err');
    await syncNow();
    toast('🔒 החודש נסגר — תלושים ' + x.from + '–' + x.to);
    go('#/payroll/' + ym);
  };
  if (reopen) reopen.onclick = async () => {
    const v = await modal('פתיחת ' + monthName(ym) + ' מחדש', '<p>התלושים השמורים יימחקו והחודש יחושב מחדש מהנוכחות (המספרים יינתנו שוב בסגירה). נרשם בלוג.</p>' +
      field('סיבת הפתיחה', inp('reason', '', 'placeholder="למשל: תיקון שעות של עובד"')),
      [{ label: 'ביטול', value: null }, { label: 'פתיחה מחדש', kind: 'danger', value: 1, submit: true, check: (f) => (String(f.reason || '').trim().length < 3 ? 'יש לכתוב סיבה' : '') }]);
    if (!v) return;
    const x = await call('payrollReopen', { month: ym, reason: v.reason });
    if (!x.ok) return toast(x.error || 'שגיאה', 'err');
    toast('החודש נפתח מחדש');
    go('#/payroll/' + ym);
  };
  const post = $('#post', box);
  if (post) post.onclick = async () => {
    post.disabled = true;
    const x = await call('payrollPost', { month: ym });
    post.disabled = false;
    if (!x.ok) return toast(x.error || 'שגיאה', 'err');
    await syncNow();
    toast('נרשם בהוצאות ✓ ' + money(x.amount));
    go('#/payroll/' + ym);
  };
}

// 🧾 manual components and voluntary deductions on the employee's payslips (payPeople.items — _shared/payslip-core.ts PayItem)
const KINDS = [['payment', 'תשלום חייב במס (מענק, תוספת)'], ['benefit', 'שווי — מתנה / שי (לא משולם, חייב במס)'], ['loan', 'הלוואה לעובד/ת (החזר בתשלומים)'],
  ['advance', 'מפרעה (מקדמה על השכר)'], ['deduction', 'קנס / ניכוי אחר מהנטו']];
const kindName = (k) => (KINDS.find((x) => x[0] === k) || [k, k])[1].split(' (')[0];
const mm = (ym) => (ym ? ym.slice(5) + '/' + ym.slice(0, 4) : '');
function itemText(it) {
  const amt = money(it.amount);
  if (it.kind === 'loan') return `${amt} ב-${it.installments || 1} תשלומים מ-${mm(it.from)} · ריבית ${it.rate || 0}%`;
  if (it.kind === 'advance') return `${amt}${(it.installments || 1) > 1 ? ' ב-' + it.installments + ' תשלומים' : ''} מ-${mm(it.from)}`;
  return `${amt} · ${it.to && it.to > it.from ? mm(it.from) + '–' + mm(it.to) : mm(it.from)}${it.grossUp ? ' · מגולם' : ''}${it.exempt ? ' · פטור' : ''}`;
}
async function editItems(row, ym) {
  let changed = false;
  for (;;) {
    const s = setupOf(row.employee) || { employee: row.employee };
    const list = s.items || [];
    const r = await modal('רכיבים וניכויים — ' + row.employee,
      (list.length ? `<ul class="list">${list.map((it, i) => `<li><label class="chk" style="flex:1"><input type="radio" name="sel" value="${i}"${i === 0 ? ' checked' : ''}>
        <span><b class="sm">${e(kindName(it.kind))}${it.label ? ' — ' + e(it.label) : ''}</b><small>${e(itemText(it))}</small></span></label></li>`).join('')}</ul>`
        : '<p class="muted">אין רכיבים. מוסיפים מתנה, מענק, הלוואה, מפרעה או קנס — והם נכנסים לתלושים בחודשים שלהם.</p>') +
      '<p class="muted small">תשלומים ושווי (מתנה) נכנסים להכנסה החייבת. "מגולם" — המעסיק נושא במס. הלוואות, מפרעות וקנסות יורדים מהנטו לתשלום.</p>',
      [{ label: 'סגירה', value: null }, ...(list.length ? [{ label: '🗑 מחיקה', kind: 'danger ghost', value: 'del' }, { label: '✏ עריכה', value: 'edit' }] : []),
        { label: '➕ רכיב חדש', kind: 'primary', value: 'add' }]);
    if (!r) return changed;
    const i = Number(r.sel);
    if (r.value === 'del' && list[i]) { list.splice(i, 1); await save('payPeople', { ...s, id: s.id || 'pp-' + row.employee.slice(0, 60), employee: row.employee, items: list }); changed = true; continue; }
    const it = await editItem(r.value === 'edit' ? list[i] : null, ym);
    if (!it) continue;
    if (r.value === 'edit') list[i] = it; else list.push(it);
    await save('payPeople', { ...s, id: s.id || 'pp-' + row.employee.slice(0, 60), employee: row.employee, items: list });
    changed = true; toast('נשמר ✓');
  }
}
async function editItem(it, ym) {
  const kind = it?.kind || 'payment';
  const r = await modal(it ? 'עריכת רכיב' : 'רכיב חדש',
    field('סוג', sel('kind', KINDS, kind)) + field('תיאור', inp('label', it?.label || '', 'placeholder="למשל: שי לראש השנה, הלוואה לרכב, מענק חג"')) +
    `<div class="grid2">${field('סכום (₪)', money_in('amount', it?.amount ?? ''), 'הלוואה / מפרעה — הסכום כולו')}${field('מחודש', inp('from', it?.from || ym, 'type="month"'))}</div>` +
    `<div class="grid2" data-k="once">${field('עד חודש (לחוזר)', inp('to', it?.to || '', 'type="month"'), 'ריק — חודש אחד')}<span></span></div>` +
    `<div class="grid2" data-k="inst">${field('מספר תשלומים', inp('installments', it?.installments ?? 1, 'inputmode="numeric" dir="ltr" class="num"'))}` +
      `${field('ריבית שנתית %', inp('rate', it?.rate ?? (S.settings.payroll?.loanRate ?? ''), 'inputmode="decimal" dir="ltr" class="num"'), 'הלוואה לעובד/ת — בריבית לפי החוק')}</div>` +
    check('grossUp', 'מגולם — המעסיק נושא במס (לתשלום: הסכום הוא נטו לעובד/ת)', it?.grossUp) + check('exempt', 'שי פטור ממס (בגבול הפטור למתנות)', it?.exempt),
    [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true,
      check: (v) => (!(num(v.amount) > 0) ? 'יש להזין סכום' : !/^\d{4}-\d{2}$/.test(v.from) ? 'יש לבחור חודש' : v.to && v.to < v.from ? '"עד חודש" לפני "מחודש"' :
        (v.kind === 'loan' || v.kind === 'advance') && !(Math.round(num(v.installments)) >= 1) ? 'מספר תשלומים — לפחות 1' : '') }],
    { onOpen: (f) => {
      const show = () => { const k = f.elements.kind.value;
        f.querySelector('[data-k="once"]').style.display = ['payment', 'benefit', 'deduction'].includes(k) ? '' : 'none';
        f.querySelector('[data-k="inst"]').style.display = ['loan', 'advance'].includes(k) ? '' : 'none';
        f.elements.rate.closest('.f').style.display = k === 'loan' ? '' : 'none';
        f.elements.grossUp.closest('label').style.display = ['payment', 'benefit'].includes(k) ? '' : 'none';
        f.elements.exempt.closest('label').style.display = k === 'benefit' ? '' : 'none'; };
      f.elements.kind.addEventListener('change', show); show(); } });
  if (!r) return null;
  const k = r.kind, n = (v) => (String(v).trim() === '' ? 0 : num(v));
  return { id: it?.id || uid(), kind: k, label: r.label, amount: n(r.amount), from: r.from,
    ...(['payment', 'benefit', 'deduction'].includes(k) && r.to ? { to: r.to } : {}),
    ...(['loan', 'advance'].includes(k) ? { installments: Math.max(1, Math.round(n(r.installments))) } : {}),
    ...(k === 'loan' ? { rate: n(r.rate) } : {}),
    ...(['payment', 'benefit'].includes(k) && r.grossUp ? { grossUp: true } : {}), ...(k === 'benefit' && r.exempt ? { exempt: true } : {}) };
}

async function editSetup(row) {
  const s = setupOf(row.employee) || { employee: row.employee };
  const r = await modal('הגדרות שכר — ' + row.employee,
    (row.empType === 'חודשי' ? field('משכורת חודשית (ברוטו)', money_in('monthlySalary', s.monthlySalary ?? ''), 'אם לא נקבעה בהסכם ההעסקה') : '') +
    check('netPay', 'שכר נטו מוסכם — התשלומים מגולמים (גילום) כך שהנטו יהיה הסכום שהוזן', s.netPay) +
    `<div class="grid2">${field('נסיעות ליום (₪)', money_in('travelPerDay', s.travelPerDay ?? ''), 'מוגבל לתקרה שבחוק')}${field('או נסיעות קבוע לחודש (₪)', money_in('travelMonthly', s.travelMonthly ?? ''))}</div>` +
    field('שעות נוספות גלובליות (₪ לחודש)', money_in('globalOvertime', s.globalOvertime ?? ''), 'תשלום קבוע — ואז השעות הנוספות לא משולמות אחת-אחת') +
    `<div class="grid2">${field('יישוב מזכה — אחוז הנחה', inp('settlementPct', s.settlementPct ?? '', 'inputmode="decimal" dir="ltr" class="num" placeholder="למשל 10"'))}
      ${field('תקרת הכנסה שנתית (₪)', money_in('settlementCap', s.settlementCap ?? ''))}</div>` +
    '<p class="muted small">רק כשסומן בטופס 101 (סעיף 3). ריק = לבד לפי היישוב שבטופס 101, מרשימת רשות המסים (491 יישובים). ממלאים רק כשהיישוב לא נמצא או כשיש אישור אחר.</p>' +
    `<div class="grid2">${field('נקודות זיכוי נוספות', inp('extraPoints', s.extraPoints ?? '', 'inputmode="decimal" dir="ltr" class="num"'), 'לסעיפים שלא מחושבים: עולה חדש, מזונות, ילד עם מוגבלות…')}
      ${field('על מה', inp('extraPointsNote', s.extraPointsNote || ''))}</div>` +
    field('פנסיה', sel('pension', [['auto', 'לפי הוותק (מ-6 חודשים)'], ['yes', 'כן — מנכים'], ['no', 'לא מנכים']], s.pension || 'auto')) +
    `<div class="grid2">${field('קרן השתלמות — עובד/ת (%)', inp('sfEmp', s.studyFund?.emp ?? '', 'inputmode="decimal" dir="ltr" class="num" placeholder="למשל 2.5"'))}
      ${field('קרן השתלמות — מעסיק (%)', inp('sfEr', s.studyFund?.er ?? '', 'inputmode="decimal" dir="ltr" class="num" placeholder="למשל 7.5"'), 'מעל 7.5% משכר של 15,712 ₪ — שווי חייב במס')}</div>` +
    fundSection(s) +
    // גמר חשבון: used in the month of the end date in the employee's card (Sidurit)
    `<div class="f"><span>🏁 סיום העסקה (גמר חשבון)</span><small>חל רק בחודש של תאריך סיום ההעסקה שבכרטיס העובד/ת. יתרת החופשה ויתרת ההבראה משולמות לבד.</small>
      <div class="grid2">${field('סיבת הסיום', sel('endReason', [['', '—'], ['dismissal', 'פיטורים'], ['resignEntitled', 'התפטרות בדין מפוטר/ת'], ['resignation', 'התפטרות']], s.ending?.reason || ''))}
      ${field('פיצויים', sel('endSev', [['section14', 'לפי סעיף 14 (ההפקדות בקופה)'], ['pay', 'תשלום מהמעסיק (בניכוי הקופה)']], s.ending?.severance || 'section14'))}</div>
      <div class="grid2">${field('שכר קובע לפיצויים (₪)', money_in('endBase', s.ending?.base ?? ''), 'ריק = המשכורת החודשית; שעתי — ממוצע 12 חודשים')}
      ${field('כספי פיצויים בקופה (₪)', money_in('endFund', s.ending?.inFund ?? ''))}</div>
      ${field('ימי הודעה מוקדמת בתשלום (במקום עבודה)', inp('endNotice', s.ending?.noticeDays ?? '', 'inputmode="decimal" dir="ltr" class="num"'))}</div>` +
    field('ביטוח לאומי — סוג המבוטח', sel('blType', BL_TYPES, s.blType || 'auto'), 'לפי חוזר המעסיקים של הביטוח הלאומי. גיל הפרישה / עובד זר — לבחור כאן') +
    // תיאום מס: the approval the employee brings from the tax assessor (an employee with more than one employer)
    `<div class="f"><span>🧾 תיאום מס (לפי אישור פקיד השומה)</span><div class="grid2">${field('שיעור מס קבוע (%)', inp('tcRate', s.taxCoord?.rate ?? '', 'inputmode="decimal" dir="ltr" class="num" placeholder="ריק = לפי המדרגות"'))}
      ${field('נקודות זיכוי אצלנו', inp('tcPoints', s.taxCoord?.points ?? '', 'inputmode="decimal" dir="ltr" class="num" placeholder="ריק = לפי טופס 101"'))}</div>
      ${field('בתוקף עד חודש', inp('tcTo', s.taxCoord?.to || '', 'type="month"'), 'ריק = עד סוף השנה. בלי אישור — מי שיש לו הכנסה נוספת מנוכה במס המרבי')}</div>` +
    // the year's recovery days paid at the old value (2026: 418 → 451.50) — the difference, once
    `<div class="f"><span>🌴 הפרש דמי הבראה ${new Date().getFullYear()}</span><div class="grid2">${field('ימי הבראה ששולמו לפי הערך הישן', inp('rdDays', s.recoveryDiff?.days ?? '', 'inputmode="decimal" dir="ltr" class="num"'))}
      ${field('לשלם את ההפרש בחודש', inp('rdMonth', s.recoveryDiff?.month || '', 'type="month"'))}</div><small>ב-2026 יום הבראה עלה מ-418 ל-451.50 ₪ לכל השנה. מי שקיבל השנה לפי 418 — מגיע לו 33.50 ₪ לכל יום.</small></div>`,
    [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true }]);
  if (!r) return false;
  const n = (v) => (String(v).trim() === '' ? null : num(v));
  await save('payPeople', { ...s, id: s.id || 'pp-' + row.employee.slice(0, 60), employee: row.employee, monthlySalary: n(r.monthlySalary ?? ''), travelPerDay: n(r.travelPerDay),
    settlementPct: n(r.settlementPct), settlementCap: n(r.settlementCap), extraPoints: n(r.extraPoints), extraPointsNote: r.extraPointsNote, pension: r.pension,
    netPay: !!r.netPay, travelMonthly: n(r.travelMonthly), globalOvertime: n(r.globalOvertime), blType: r.blType === 'auto' ? null : r.blType,
    studyFund: n(r.sfEmp) || n(r.sfEr) ? { emp: n(r.sfEmp), er: n(r.sfEr) } : null,
    ...fundValues(r),
    ending: r.endReason || n(r.endNotice) ? { reason: r.endReason || null, severance: r.endSev, base: n(r.endBase), inFund: n(r.endFund), noticeDays: n(r.endNotice) } : null,
    taxCoord: n(r.tcRate) !== null || n(r.tcPoints) !== null ? { rate: n(r.tcRate), points: n(r.tcPoints), to: r.tcTo || null } : null,
    recoveryDiff: n(r.rdDays) > 0 && r.rdMonth ? { days: n(r.rdDays), month: r.rdMonth } : null });
  toast('נשמר ✓');
  return true;
}

// the payslip — laid out like a real Israeli payslip (the payroll programs' common form, e.g. Superstar's): the head
// (employer, the employee's details, rates, days / hours, bank), the payments (description · quantity · rate · net
// grossed up · amount), the compulsory / voluntary deductions, the tax data, the employer's provisions, the totals,
// the absences (previous · accrued · used · balance) and the informative lines (minimum wage, standard hours).
const n2 = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const n0 = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('he-IL', { maximumFractionDigits: 2 }));
const SLIP_CSS = `<style>
.ps{font:12px/1.35 system-ui,Arial,sans-serif;color:#111;background:#fff;border:1px solid #333;padding:8px;direction:rtl}
.ps table{width:100%;border-collapse:collapse}.ps td,.ps th{border:1px solid #999;padding:2px 5px;text-align:right;vertical-align:top}
.ps th{background:#f1f1f1;font-weight:600;font-size:11px}.ps .n{text-align:left;direction:ltr;white-space:nowrap}
.ps .hd{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:start;margin-bottom:6px}.ps .hd h2{margin:0;font-size:17px;text-align:center}
.ps .box{border:1px solid #999;padding:4px 6px}.ps .k{font-size:10.5px;color:#444}.ps .main{display:grid;grid-template-columns:2.2fr 1fr;gap:6px;margin-top:6px}
.ps .tot td{font-weight:700}.ps .sim{background:#fff3cd;border:1px solid #e0c46c;padding:3px 6px;margin:6px 0;font-weight:600;text-align:center}
.ps .sub{margin-top:6px}.ps .muted{color:#555}.ps .box table td{border:0;padding:1px 2px}
@media (max-width:640px){.ps .hd,.ps .main{grid-template-columns:1fr}.ps{font-size:11px}}
</style>`;
const kv = (pairs) => `<table>${pairs.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `<tr><td class="k">${e(k)}</td><td class="n">${e(v)}</td></tr>`).join('')}</table>`;
function slipHtml(x, ym) {
  const s = x.slip, co = S.settings.company || {}, m = x.meta || {};
  const er = (label) => (s.employer.find((d) => d.label.startsWith(label)) || {}).amount || 0;
  const grossUp = s.earnings.some((l) => l.net !== undefined);
  const mm = ym.slice(5) + '/' + ym.slice(0, 4);
  const pay = s.earnings.map((l) => `<tr><td>${e(l.label)}${l.nonCash ? ' <span class="k">(שווי)</span>' : ''}</td><td class="n">${l.qty !== undefined ? n0(l.qty) : '1'}</td><td class="n">${l.rate !== undefined ? n2(l.rate) : n2(l.net ?? l.amount)}</td>` +
    (grossUp ? `<td class="n">${l.net !== undefined ? n2(l.net) : ''}</td>` : '') + `<td class="n">${n2(l.amount)}</td></tr>`).join('');
  const rows = (pairs) => pairs.map(([k, v]) => `<tr><td class="k">${k}</td><td class="n">${n2(v)}</td></tr>`).join('');
  return SLIP_CSS + `<div class="ps">
  <div class="hd">
    <div class="box"><b>${e(co.legalName || S.settings.business)}</b>${co.address ? '<br>' + e(co.address) : ''}${co.taxId ? '<br><span class="k">מספר תאגיד</span> ' + e(co.taxId) : ''}</div>
    <h2>תלוש משכורת לחודש ${mm}${x.number ? `<br><span class="k">מס׳ תלוש ${x.number}</span>` : ''}</h2>
    <div class="box">${kv([['תיק ניכויים', co.taxFileNo], ['מחלקה', x.dept], ['סניף', x.branch]])}</div>
  </div>
  <div style="overflow-x:auto"><table style="min-width:520px"><tr><th>מס׳ עובד</th><th>שם עובד</th><th>תעודת זהות</th><th>מחלקה</th><th>תחילת עבודה</th><th>ותק</th><th>אחוז משרה</th></tr>
    <tr><td class="n">${e(m.empNo || '')}</td><td><b>${e(x.employee)}</b></td><td class="n">${e(m.idNumber || '')}</td><td>${e(x.dept || '')}</td>
      <td class="n">${m.startDate ? e(m.startDate.split('-').reverse().join('/')) : ''}</td><td>${e(m.seniority || '')}</td><td class="n">${m.jobPct ? m.jobPct + '%' : ''}</td></tr>
    <tr><th>תעריף</th><th>תעריף שעה</th><th>תעריף יום</th><th>ימי עבודה</th><th>שעות עבודה</th><th colspan="2">בנק · סניף · חשבון</th></tr>
    <tr><td class="n">${m.salary ? n2(m.salary) : ''}</td><td class="n">${n2(m.hourRate)}</td><td class="n">${n2(m.dayRate)}</td><td class="n">${n0(m.days)}</td><td class="n">${n0(m.hours)}</td>
      <td colspan="2" class="n">${m.bank ? e(m.bank.code + ' · ' + m.bank.branch + ' · ' + m.bank.account) : ''}</td></tr></table></div>
  <div class="sim">סימולציה לבדיקה — לא תלוש שכר רשמי</div>
  <div class="main">
    <div>
      <table><tr><th>תאור התשלום</th><th>כמות</th><th>תעריף</th>${grossUp ? '<th>נטו לגילום</th>' : ''}<th>סכום התשלום</th></tr>${pay}
        <tr class="tot"><td colspan="${grossUp ? 4 : 3}">סה"כ תשלומים</td><td class="n">${n2(s.gross)}</td></tr></table>
      <table class="sub"><tr><th>ניכויי חובה</th><th>הסכום</th><th>ניכויי רשות</th><th>הסכום</th></tr>
        ${Array.from({ length: Math.max(s.deductions.length, (s.voluntary || []).length) }, (_, i) => { const d = s.deductions[i], v = (s.voluntary || [])[i];
          return `<tr><td>${d ? e(d.label) : ''}</td><td class="n">${d ? n2(d.amount) : ''}</td><td>${v ? e(v.label) : ''}</td><td class="n">${v ? n2(v.amount) : ''}</td></tr>`; }).join('')}
        <tr class="tot"><td>סה"כ</td><td class="n">${n2(s.totalDeductions)}</td><td>סה"כ</td><td class="n">${n2(s.totalVoluntary || 0)}</td></tr></table>
      <table class="sub"><tr><th>סוג היעדרות</th><th>יתרה קודמת</th><th>צבירה</th><th>ניצול</th><th>יתרה</th></tr>
        ${s.balances.map((b) => `<tr><td>${e(b.label.replace(' (ימים)', ''))}</td><td class="n">${n0(b.prev)}</td><td class="n">${n0(b.add)}</td><td class="n">${n0(b.used)}</td><td class="n"><b>${n0(b.now)}</b></td></tr>`).join('') ||
          '<tr><td colspan="5" class="muted">—</td></tr>'}</table>
    </div>
    <div>
      <div class="box">${kv([['מצב משפחתי', m.marital], ['נ. זיכוי', s.credit.points], ['מס שולי %', Math.round(s.tax.marginal * 100)], ['זיכוי אישי', n0(Math.round(s.credit.value))],
        ['זיכוי גמל', s.credit.pension ? n0(Math.round(s.credit.pension)) : ''], ['הנחת ישובי פיתוח', s.credit.settlement ? n0(Math.round(s.credit.settlement)) : '']])}</div>
      <table class="sub">${rows([['חייב מ.ה.', s.tax.taxable], ['חייב ב.ל.', s.gross], ['סה"כ תשלומים', s.gross], ['סה"כ ניכויים', s.totalDeductions], ['שכר נטו', s.net]])}
        ${s.earnings.some((l) => l.nonCash) ? `<tr><td class="k">שווי (לא משולם)</td><td class="n">${n2(s.earnings.filter((l) => l.nonCash).reduce((a, l) => a + l.amount, 0))}</td></tr>` : ''}
        ${s.totalVoluntary ? `<tr><td class="k">ניכויי רשות</td><td class="n">${n2(s.totalVoluntary)}</td></tr>` : ''}
        <tr class="tot"><td>נטו לתשלום</td><td class="n">${n2(s.netPay ?? s.net)}</td></tr></table>
      <table class="sub">${rows([['שכר לקופ"ג / פיצויים', s.pensionable], ['קופ"ג מעסיק', er('פנסיה')], ['פיצויים מעסיק', er('פיצויים')],
        ...(er('קרן השתלמות') ? [['קרן השתלמות מעסיק', er('קרן השתלמות')]] : [])])}</table>
      ${m.minWageHour ? `<table class="sub">${rows([['אינפורמטיבי — שכר מינימום לשעה', m.minWageHour], ['אינפורמטיבי — שכר מינימום לחודש', m.minWageMonth]])}
        <tr><td class="k">שעות תקן</td><td class="n">${n0(m.stdHours)}</td></tr><tr><td class="k">ימי תקן</td><td class="n">${n0(m.stdDays)}</td></tr></table>` : ''}
    </div>
  </div>
  ${s.notes.length ? `<div class="sub"><b>הערות:</b><ul style="margin:2px 0;padding-inline-start:18px">${s.notes.map((n) => `<li>${e(n)}</li>`).join('')}</ul></div>` : ''}
  <p class="muted" style="margin:4px 0 0;font-size:10.5px">${e(co.legalName || S.settings.business)}${co.taxId ? ' · ח.פ. ' + e(co.taxId) : ''} · הופק ב-clearcount (סימולציה) · ${new Date().toLocaleDateString('he-IL')}</p>
</div>`;
}
async function slipView(x, ym) {
  const r = await modal('תלוש לבדיקה — ' + x.employee, slipHtml(x, ym), [{ label: '🖨 הדפסה', value: 'print' }, { label: 'סגירה', value: null }], { wide: true });
  if (r && r.value === 'print') {
    const w = window.open('', '_blank');
    if (!w) return toast('הדפדפן חסם את החלון', 'err');
    w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>תלוש לבדיקה — ${e(x.employee)} — ${ym}</title>
      <style>body{margin:0}@page{size:A4;margin:8mm}</style></head><body>${slipHtml(x, ym)}<script>print()<\/script></body></html>`);
    w.document.close();
  }
}
