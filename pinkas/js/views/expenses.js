// Pinkas — expenses: the month (#/expenses/YYYY-MM) — the fixed ones (rent, arnona, electricity…, created by
// themselves from #/fixed) and the other ones (repairs, service providers…); paid / not paid. #/expenses/new — add one.
// The payee: a 🛠 service supplier from 🚚 suppliers (supplierId; views/suppliers.js), or a name typed for a one-off.
import { S, save, remove, uid, syncFixed } from '../store.js';
import { e, money, money0, $, $$, toast, modal, field, money_in, sel, inp, check, confirmBox, empty } from '../ui.js';
import { today, monthOf, monthName, addMonths, fmtDate, num, r2, sum } from '../calc.js';
import { go } from '../app.js';
import { suppliersOf } from './suppliers.js';

const METHODS = [['', '—'], ['transfer', 'העברה בנקאית'], ['standing', 'הוראת קבע'], ['card', 'אשראי'], ['cash', 'מזומן'], ['check', 'שיק']];
/** the service supplier (a select of 🛠 suppliers) or, with "—", a name typed for a one-off payee */
function payeeFields(x) {
  const sups = suppliersOf('service', x?.supplierId);
  const typed = [...new Set(S.expenses.filter((r) => r.payee && !r.supplierId).map((r) => r.payee))].sort();
  return field('ספק שירות', sel('supplierId', [['', sups.length ? '— לא מהרשימה —' : '— אין עדיין ספקי שירות —'], ...sups.map((v) => [v.id, v.name])], x?.supplierId || ''),
      'ספקי השירות מ-🚚 ספקים (שם מוסיפים ספק חדש)') +
    `<div class="f" data-payee><span>למי שולם</span>${inp('payee', x?.supplierId ? '' : x?.payee || '', 'list="payees" placeholder="למשל: חשמלאי מזדמן"')}<datalist id="payees">${typed.map((p) => `<option value="${e(p)}">`).join('')}</datalist></div>`;
}
const payeeOpen = (fm) => { const sw = () => { fm.querySelector('[data-payee]').style.display = fm.elements.supplierId.value ? 'none' : ''; }; fm.elements.supplierId.addEventListener('change', sw); sw(); };
const payeeOf = (r) => { const v = S.suppliers.find((s) => s.id === r.supplierId); return v ? { supplierId: v.id, payee: v.name } : { supplierId: null, payee: r.payee || '' }; };

const EVERY = [[1, 'כל חודש'], [2, 'כל חודשיים'], [3, 'כל רבעון'], [6, 'כל חצי שנה'], [12, 'פעם בשנה']];

/** add / edit one expense (fixed occurrences too — their amount can differ, e.g. this month's electricity bill) */
export async function editExpense(x) {
  const s = S.settings, isFixed = x?.kind === 'fixed';
  const cats = isFixed ? s.fixedCats : s.expenseCats;
  const r = await modal(isFixed ? 'הוצאה קבועה — ' + x.name + ' · ' + monthName(x.period) : x ? 'עריכת הוצאה' : 'הוצאה חדשה',
    (isFixed ? '' : field('קטגוריה', sel('category', cats.map((c) => [c, c]), x?.category || cats[0])) +
      payeeFields(x) +
      field('תיאור', inp('name', x?.name || '', 'placeholder="מה נעשה"'))) +
    `<div class="grid2">${field(isFixed ? 'תאריך לתשלום' : 'תאריך', inp('date', x?.date || today(), 'type="date"'))}${field('סכום', money_in('amount', x?.amount ?? ''))}</div>` +
    (s.vatOn ? check('vat', 'כולל מע"מ מוכר (חשבונית מס)', x ? x.vat : true) : '') +
    `<div class="grid2">${check('paid', 'שולם', x?.paid)}${field('אמצעי תשלום', sel('method', METHODS, x?.method || ''))}</div>` +
    field('הערה', inp('note', x?.note || '')),
    [...(x?.id ? [{ label: isFixed ? 'דילוג על החודש' : '🗑 מחיקה', kind: 'danger ghost', value: 'del' }] : []), { label: 'ביטול', value: null },
      { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: (v) => (v.date && num(v.amount) >= 0 && v.amount !== '' ? '' : 'יש להזין תאריך וסכום') }],
    isFixed ? {} : { onOpen: payeeOpen });
  if (!r) return false;
  if (r.value === 'del') {
    if (isFixed) { if (!(await confirmBox('לדלג על "' + x.name + '" ב' + monthName(x.period) + '? (לא ייכנס לדוחות ולתזרים)', 'דילוג'))) return false; await save('expenses', { ...x, skipped: true }); }
    else { if (!(await confirmBox('למחוק את ההוצאה?', 'מחיקה'))) return false; await remove('expenses', x.id); }
    return true;
  }
  await save('expenses', { ...(x || { id: uid(), kind: 'other' }), ...(isFixed ? {} : { category: r.category, ...payeeOf(r), name: r.name }),
    date: r.date, amount: r2(num(r.amount)), vat: s.vatOn ? r.vat : false, paid: r.paid, paidDate: r.paid ? (x?.paidDate || today()) : null, method: r.method, note: r.note });
  toast('נשמר ✓');
  return true;
}

export async function expensesView(main, arg) {
  if (arg === 'new') { await editExpense(null); return go('#/expenses'); }
  const ym = arg && /^\d{4}-\d{2}$/.test(arg) ? arg : monthOf(today());
  const filter = sessionStorage.getItem('pk_ef') || 'all';
  const rows = S.expenses.filter((x) => monthOf(x.date) === ym && !x.skipped).sort((a, b) => (a.date < b.date ? -1 : 1));
  const fixed = rows.filter((x) => x.kind === 'fixed'), other = rows.filter((x) => x.kind !== 'fixed');
  const show = rows.filter((x) => filter === 'all' || (filter === 'open' ? !x.paid : filter === x.kind || (filter === 'other' && x.kind !== 'fixed')));
  const t = today();
  main.innerHTML = `
    <div class="head row"><h1>🧾 הוצאות</h1><div class="actions"><a class="btn" href="#/fixed">📌 הוצאות קבועות</a><button class="btn primary" id="add">➕ הוצאה</button></div></div>
    <div class="monthbar"><a class="btn sm" href="#/expenses/${addMonths(ym, -1)}">→</a><b>${monthName(ym)}</b><a class="btn sm" href="#/expenses/${addMonths(ym, 1)}">←</a></div>
    <div class="kpis">
      <div class="kpi"><small>קבועות</small><b>${money0(sum(fixed, (x) => x.amount))}</b></div>
      <div class="kpi"><small>נלוות</small><b>${money0(sum(other, (x) => x.amount))}</b></div>
      <div class="kpi"><small>סה"כ</small><b>${money0(sum(rows, (x) => x.amount))}</b></div>
      <div class="kpi ${rows.some((x) => !x.paid) ? 'neg' : ''}"><small>טרם שולם</small><b>${money0(sum(rows.filter((x) => !x.paid), (x) => x.amount))}</b></div>
    </div>
    <div class="chips">${[['all', 'הכל'], ['fixed', 'קבועות'], ['other', 'נלוות'], ['open', 'טרם שולם']].map(([k, l]) => `<button class="chip${k === filter ? ' on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
    <div class="card flush">${show.length ? `<ul class="list click">${show.map((x) => `<li data-id="${x.id}">
      <span><b class="sm">${x.kind === 'fixed' ? '📌 ' + e(x.name) : (x.locked ? '🔒 ' : '') + e(x.category || 'הוצאה')}${x.payee ? ' · ' + (x.supplierId ? '🛠 ' : '') + e(x.payee) : ''}</b>
        <small>${fmtDate(x.date)}${x.kind !== 'fixed' && x.name ? ' · ' + e(x.name) : ''}${x.note ? ' · ' + e(x.note) : ''}</small></span>
      <span class="end"><b>${money(x.amount)}</b>${x.paid ? '<span class="tag ok">שולם</span>' : `<button class="tag ${x.date < t ? 'bad' : 'wait'}" data-pay="${x.id}">${x.date < t ? 'באיחור · ' : ''}לסמן שולם</button>`}</span></li>`).join('')}</ul>`
      : empty(S.fixed.length ? 'אין הוצאות בחודש הזה.' : 'עוד אין הוצאות. כדאי להתחיל מ<a href="#/fixed">📌 הוצאות קבועות</a> — שכירות, ארנונה, חשמל — והן ייווצרו לבד כל חודש.')}</div>`;
  $('#add', main).onclick = async () => { if (await editExpense(null)) expensesView(main, ym); };
  $$('[data-f]', main).forEach((b) => { b.onclick = () => { sessionStorage.setItem('pk_ef', b.dataset.f); expensesView(main, ym); }; });
  $$('li[data-id]', main).forEach((li) => { li.onclick = async (ev) => {
    const x = S.expenses.find((r) => r.id === li.dataset.id);
    if (ev.target.dataset.pay) { await save('expenses', { ...x, paid: true, paidDate: today() }); toast('סומן כשולם ✓'); return expensesView(main, ym); }
    if (x.locked) {   // clearcount: the month's payroll, from Sidurit — changed only by recalculating it in 👷 שכר עובדים
      const r = await modal(x.name, `<p>${e(x.note || '')}</p><p class="muted small">ההוצאה נוצרה מנתוני הנוכחות בסידורית ומתעדכנת רק במסך 👷 שכר עובדים.</p>`,
        [{ label: 'סגירה', value: null }, ...(x.paid ? [] : [{ label: '✓ סימון כשולם', value: 'pay' }]), { label: '👷 לשכר החודש', kind: 'primary', value: 'go' }]);
      if (r?.value === 'pay') { await save('expenses', { ...x, paid: true, paidDate: today() }); toast('סומן כשולם ✓'); return expensesView(main, ym); }
      if (r?.value === 'go') go('#/payroll/' + monthOf(x.date));
      return;
    }
    if (await editExpense(x)) expensesView(main, ym);
  }; });
}

/* ---------------- the fixed expenses ---------------- */
export async function fixedView(main) {
  const s = S.settings;
  const list = S.fixed.slice().sort((a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name, 'he'));
  const monthly = r2(list.filter((x) => x.active !== false).reduce((a, x) => a + Number(x.amount || 0) / Math.max(1, Number(x.every) || 1), 0));
  main.innerHTML = `
    <div class="head row"><h1>📌 הוצאות קבועות</h1><div class="actions"><a class="btn" href="#/expenses">→ להוצאות</a><button class="btn primary" id="add">➕ הוצאה קבועה</button></div></div>
    <div class="card hint">הוצאה קבועה נרשמת לבד בכל מחזור (חודש / חודשיים / רבעון / שנה), עד חודשיים קדימה, ומופיעה בהוצאות ובתזרים. כשהחשבון בפועל שונה (חשמל, מים) — פותחים אותה בחודש הרלוונטי ומעדכנים את הסכום.</div>
    <div class="card row"><span>ממוצע חודשי של ההוצאות הקבועות: <b>${money(monthly)}</b></span></div>
    <div class="card flush">${list.length ? `<ul class="list click">${list.map((x) => `<li data-id="${x.id}" class="${x.active === false ? 'off' : ''}">
      <span><b class="sm">${e(x.name)}</b><small>${e(x.category || '')}${x.payee ? ' · ' + e(x.payee) : ''} · ${(EVERY.find((v) => v[0] === Number(x.every)) || EVERY[0])[1]} · ב-${x.day} לחודש${x.end ? ' · עד ' + monthName(x.end) : ''}${x.active === false ? ' · מושבתת' : ''}</small></span>
      <b>${money(x.amount)}</b></li>`).join('')}</ul>` : empty('אין עדיין הוצאות קבועות.')}</div>`;
  const edit = async (x) => {
    const r = await modal(x ? 'עריכת הוצאה קבועה' : 'הוצאה קבועה חדשה',
      field('קטגוריה', sel('category', s.fixedCats.map((c) => [c, c]), x?.category || s.fixedCats[0])) +
      field('שם', inp('name', x?.name || '', 'placeholder="למשל: שכירות החנות"')) +
      payeeFields(x) +
      `<div class="grid2">${field('סכום', money_in('amount', x?.amount ?? ''))}${field('תדירות', sel('every', EVERY, x?.every || 1))}</div>` +
      `<div class="grid2">${field('יום התשלום בחודש', inp('day', x?.day || 1, 'type="number" min="1" max="31"'))}${field('החל מחודש', inp('start', x?.start || monthOf(today()), 'type="month"'))}</div>` +
      field('עד חודש (לא חובה)', inp('end', x?.end || '', 'type="month"'), 'למשל סוף חוזה השכירות או ההלוואה') +
      (s.vatOn ? check('vat', 'כולל מע"מ מוכר (חשמל, שכירות מעוסק…; ארנונה — בלי)', x ? x.vat : false) : '') +
      (x ? check('active', 'פעילה', x.active !== false) : ''),
      [...(x ? [{ label: '🗑 מחיקה', kind: 'danger ghost', value: 'del' }] : []), { label: 'ביטול', value: null },
        { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: (v) => (!v.name && !v.category ? 'יש להזין שם' : !(num(v.amount) > 0) ? 'יש להזין סכום' : !(Number(v.day) >= 1 && Number(v.day) <= 31) ? 'יום בחודש: 1–31' : !v.start ? 'יש לבחור חודש התחלה' : v.end && v.end < v.start ? 'חודש הסיום לפני ההתחלה' : '') }],
      { onOpen: payeeOpen });
    if (!r) return;
    if (r.value === 'del') {
      if (!(await confirmBox('למחוק את ההוצאה הקבועה? החודשים שכבר שולמו נשארים; חודשים עתידיים שלא שולמו יימחקו.', 'מחיקה'))) return;
      for (const o of S.expenses.filter((o) => o.fixedId === x.id && !o.paid && o.date >= today())) await remove('expenses', o.id);
      await remove('fixed', x.id);
    } else {
      const row = await save('fixed', { ...(x || { id: uid() }), category: r.category, name: r.name || r.category, ...payeeOf(r), amount: r2(num(r.amount)), every: Number(r.every), day: Number(r.day),
        start: r.start, end: r.end || null, vat: s.vatOn ? r.vat : false, active: x ? r.active : true });
      // the future months not paid yet follow the new amount / day / end; then the missing ones are created
      for (const o of S.expenses.filter((o) => o.fixedId === row.id && !o.paid && o.date >= today())) {
        const stop = !row.active || (row.end && o.period > row.end);
        if (stop) await remove('expenses', o.id);
        else await save('expenses', { ...o, name: row.name, category: row.category, supplierId: row.supplierId, payee: row.payee, amount: row.amount, vat: row.vat, date: o.period + '-' + String(Math.min(row.day, new Date(+o.period.slice(0, 4), +o.period.slice(5), 0).getDate())).padStart(2, '0') });
      }
      const n = await syncFixed();
      toast('נשמר ✓' + (n ? ' · נוספו ' + n + ' חודשים' : ''));
    }
    fixedView(main);
  };
  $('#add', main).onclick = () => edit(null);
  $$('li[data-id]', main).forEach((li) => { li.onclick = () => edit(S.fixed.find((x) => x.id === li.dataset.id)); });
}
