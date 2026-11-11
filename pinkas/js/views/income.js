// Pinkas — income: the month's days (#/income/YYYY-MM) and one day's entry (#/income/YYYY-MM-DD) — cash, cheques,
// credit cards and, when the business sells on credit (הקפה), the credit sales by customer.
import { S, save, saveMany, remove, uid } from '../store.js';
import { CC, FEAT } from '../env.js';
import { e, money, money0, $, $$, toast, modal, field, money_in, sel, inp, confirmBox } from '../ui.js';
import { DAY_METHODS, dayTotal, today, monthOf, monthName, addMonths, daysInMonth, fmtDate, num, r2, sum, parse } from '../calc.js';
import { go } from '../app.js';

const DOW = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export async function incomeView(main, arg) {
  if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) return dayView(main, arg);
  const ym = arg && /^\d{4}-\d{2}$/.test(arg) ? arg : monthOf(today());
  const [y, m] = ym.split('-').map(Number);
  const n = daysInMonth(y, m), t = today();
  const rows = [];
  // Bit / PayBox get a column only when used this month (most shops: not at all)
  const inMonth = S.days.filter((x) => monthOf(x.date) === ym);
  const cols = DAY_METHODS.filter(([k]) => !['bit', 'paybox'].includes(k) || inMonth.some((x) => num(x[k]) > 0));
  const short = { card: 'אשראי' };
  let tot = Object.fromEntries([...cols.map(([k]) => [k, 0]), ['credit', 0]]);
  for (let d = n; d >= 1; d--) {
    const date = ym + '-' + String(d).padStart(2, '0');
    if (date > t) continue;
    const r = S.days.find((x) => x.date === date) || {};
    const credit = sum(S.creditSales.filter((x) => x.date === date), (x) => x.amount);
    const v = { ...Object.fromEntries(DAY_METHODS.map(([k]) => [k, num(r[k])])), credit };
    for (const k in tot) tot[k] = r2(tot[k] + v[k]);
    const total = r2(dayTotal(v) + v.credit);
    rows.push(`<tr class="${r.id || credit ? '' : 'none'}" data-d="${date}"><td>${DOW[parse(date).getDay()]}' ${fmtDate(date).slice(0, 5)}</td>
      ${cols.map(([k]) => `<td class="n">${v[k] ? money0(v[k]) : ''}</td>`).join('')}
      ${S.settings.creditOn ? `<td class="n">${v.credit ? money0(v.credit) : ''}</td>` : ''}<td class="n"><b>${total ? money0(total) : (r.closed ? 'סגור' : '—')}</b></td></tr>`);
  }
  const total = r2(Object.values(tot).reduce((a, x) => a + x, 0));
  main.innerHTML = `
    <div class="head row"><h1>💰 הכנסות</h1><div class="actions">${CC && FEAT.sales ? '<button class="btn" id="posFill">📥 מילוי מהקופות</button>' : ''}<a class="btn primary" href="#/income/${t}">➕ רישום היום</a></div></div>
    <div class="monthbar"><a class="btn sm" href="#/income/${addMonths(ym, -1)}">→</a><b>${monthName(ym)}</b>${ym < monthOf(t) ? `<a class="btn sm" href="#/income/${addMonths(ym, 1)}">←</a>` : '<span></span>'}</div>
    <div class="kpis">
      ${cols.map(([k, l]) => `<div class="kpi"><small>${short[k] || l}</small><b>${money0(tot[k])}</b></div>`).join('')}${S.settings.creditOn ? `<div class="kpi"><small>הקפה</small><b>${money0(tot.credit)}</b></div>` : ''}
      <div class="kpi pos"><small>סה"כ החודש</small><b>${money0(total)}</b></div>
    </div>
    <div class="card flush"><table class="tbl click"><thead><tr><th>יום</th>${cols.map(([k, l]) => `<th class="n">${short[k] || l}</th>`).join('')}${S.settings.creditOn ? '<th class="n">הקפה</th>' : ''}<th class="n">סה"כ</th></tr></thead>
      <tbody>${rows.join('') || '<tr><td colspan="8" class="muted">אין ימים בחודש הזה עדיין</td></tr>'}</tbody></table></div>
    <p class="muted small">לחיצה על יום — רישום או עדכון.${CC && FEAT.sales ? ' 📥 מילוי מהקופות — מדוחות ה-Z של הקופות (מזומן, אשראי, והשאר בשיקים / אחר); יום שהוקלד ידנית לא נדרס.' : ''}</p>`;
  $$('tr[data-d]', main).forEach((tr) => { tr.onclick = () => go('#/income/' + tr.dataset.d); });
  const pf = $('#posFill', main);
  if (pf) pf.onclick = async () => { pf.disabled = true; try { await fillFromPos(ym); } finally { pf.disabled = false; } incomeView(main, ym); };
}

/** Superstar (📒 פנקס והוצאות): the month's days from the registers' Z receipts (ccSales). A day filled from them
 *  (src 'pos') is refreshed; a day typed by hand is kept. */
async function fillFromPos(ym) {
  const { call } = await import('../cloud.js');
  const r = await call('sales', { month: ym });
  if (!r || !r.ok) return toast((r && r.error) || 'שגיאה', 'err');
  const rows = []; let kept = 0;
  for (const d of r.days || []) {
    if (!d.z && !d.cash && !d.card) continue;
    const ex = S.days.find((x) => x.date === d.date);
    if (ex && ex.src !== 'pos' && DAY_METHODS.some(([k]) => num(ex[k]) > 0)) { kept++; continue; }
    const note = 'מהקופות: Z ' + money(d.z) + (d.accountPay ? ' · כולל תשלומי הקפה ' + money(d.accountPay) : '') + (d.creditSales ? ' · מכירות בחשבונית (לא ב-Z) ' + money(d.creditSales) : '');
    rows.push({ ...(ex || {}), id: (ex && ex.id) || 'd' + d.date, date: d.date, cash: r2(d.cash), card: r2(d.card), check: r2(Math.max(0, d.other)), bit: 0, paybox: 0, closed: false, src: 'pos', note });
  }
  await saveMany('days', rows);
  toast(rows.length ? 'מולאו ' + rows.length + ' ימים מהקופות' + (kept ? ' · ' + kept + ' ימים שהוקלדו ידנית נשארו' : '') + ' ✓' : (kept ? 'כל הימים כבר הוקלדו ידנית' : 'אין נתוני קופות לחודש הזה'));
}

async function dayView(main, date) {
  const s = S.settings;
  const row = S.days.find((x) => x.date === date) || { date, cash: '', check: '', card: '', bit: '', paybox: '', note: '', closed: false };
  const credits = () => S.creditSales.filter((x) => x.date === date);
  const custOpts = () => S.customers.filter((c) => c.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'he')).map((c) => [c.id, c.name]);
  const draw = () => {
    const cr = credits();
    main.innerHTML = `
      <div class="head row"><h1>💰 ${DOW[parse(date).getDay()]}' ${fmtDate(date)}</h1><a class="btn" href="#/income/${monthOf(date)}">כל החודש</a></div>
      <form class="card" id="dayF">
        <div class="grid3">${DAY_METHODS.slice(0, 3).map(([k, l, ic]) => field(ic + ' ' + l, money_in(k, row[k] ?? ''))).join('')}</div>
        <div class="grid3">${DAY_METHODS.slice(3).map(([k, l, ic]) => field(ic + ' ' + l, money_in(k, row[k] ?? ''))).join('')}</div>
        ${field('הערה', inp('note', row.note, 'placeholder="לא חובה"'))}
        <label class="chk"><input type="checkbox" name="closed"${row.closed ? ' checked' : ''}> העסק היה סגור ביום הזה</label>
        <div class="total-line">סה"כ ביום: <b id="dayTot"></b></div>
        <div class="actions"><button class="btn primary" type="submit">💾 שמירה</button>
          <a class="btn" href="#/income/${prevDay(date, -1)}">→ יום קודם</a>${date < today() ? `<a class="btn" href="#/income/${prevDay(date, 1)}">יום הבא ←</a>` : ''}</div>
      </form>
      ${s.creditOn ? `<div class="card"><div class="row"><h3>📒 מכירות בהקפה ביום הזה</h3><button class="btn" id="addCr">➕ מכירה בהקפה</button></div>
        ${cr.length ? `<ul class="list">${cr.map((x) => `<li><span>${e((S.customers.find((c) => c.id === x.customerId) || {}).name || 'לקוח')}${x.note ? `<small>${e(x.note)}</small>` : ''}</span><b>${money(x.amount)}</b><button class="btn sm ghost" data-del="${x.id}" aria-label="מחיקה">🗑</button></li>`).join('')}</ul>` : '<p class="muted">אין מכירות בהקפה ביום הזה.</p>'}
      </div>` : ''}`;
    const f = $('#dayF', main);
    const upd = () => { $('#dayTot', main).textContent = money(DAY_METHODS.reduce((a, [k]) => a + num(f.elements[k].value), 0) + sum(credits(), (x) => x.amount)); };
    f.addEventListener('input', upd); upd();
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const v = (n) => f.elements[n].value.trim();
      for (const [k] of DAY_METHODS) if (v(k) && !(num(v(k)) >= 0)) return toast('סכום לא תקין', 'err');
      Object.assign(row, Object.fromEntries(DAY_METHODS.map(([k]) => [k, r2(num(v(k)))])), { note: v('note'), closed: f.elements.closed.checked, src: 'hand' });   // typed: a fill from the registers keeps it
      if (!row.id) row.id = 'd' + date;
      await save('days', row);
      toast('נשמר ✓');
      go('#/income/' + monthOf(date));
    };
    const keep = () => { for (const k of [...DAY_METHODS.map((m) => m[0]), 'note']) row[k] = f.elements[k].value.trim(); row.closed = f.elements.closed.checked; };   // typed, not saved yet
    const add = $('#addCr', main);
    if (add) add.onclick = async () => {
      keep();
      const opts = custOpts();
      if (!opts.length) { toast('קודם מוסיפים לקוח הקפה', 'err'); return go('#/customers'); }
      const r = await modal('מכירה בהקפה', field('לקוח', sel('customerId', opts)) + field('סכום', money_in('amount')) + field('פירוט', inp('note', '', 'placeholder="מה נקנה / מספר חשבונית"')),
        [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: (x) => (num(x.amount) > 0 ? '' : 'יש להזין סכום') }]);
      if (!r) return;
      await save('creditSales', { id: uid(), date, customerId: r.customerId, amount: r2(num(r.amount)), note: r.note });
      draw();
    };
    $$('[data-del]', main).forEach((b) => { b.onclick = async () => { keep(); if (await confirmBox('למחוק את המכירה בהקפה?', 'מחיקה')) { await remove('creditSales', b.dataset.del); draw(); } }; });
  };
  draw();
}
const prevDay = (date, n) => { const d = parse(date); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
