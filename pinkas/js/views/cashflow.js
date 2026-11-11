// Pinkas — the cash-flow: everything still to be paid (supplier invoices + fixed and other expenses) by due date,
// in groups (late / this week / next week / this month / later), and — when the bank balance is typed — what is left
// after each payment (the expected income on top: the average day of the last 30 days, if chosen).
import { S, save, saveSettings } from '../store.js';
import { e, money, money0, $, $$, toast, modal, field, money_in, inp } from '../ui.js';
import { dayTotal, today, addDays, endOfMonth, fmtDate, num, r2, sum, openPayables, parse } from '../calc.js';

export async function cashflowView(main) {
  const s = S.settings, t = today();
  const open = openPayables(S, S.suppliers);
  const wkEnd = addDays(t, 6 - parse(t).getDay());   // Saturday
  const groups = [
    ['⚠ באיחור', (x) => x.due < t], ['השבוע', (x) => x.due >= t && x.due <= wkEnd], ['שבוע הבא', (x) => x.due > wkEnd && x.due <= addDays(wkEnd, 7)],
    ['בהמשך החודש', (x) => x.due > addDays(wkEnd, 7) && x.due <= endOfMonth(t)], ['אחר כך', (x) => x.due > endOfMonth(t) && x.due > addDays(wkEnd, 7)],
  ];
  // the average income of a working day, the last 30 days (for the forecast)
  const last = S.days.filter((d) => d.date < t && d.date >= addDays(t, -30));
  const worked = last.filter((d) => dayTotal(d) > 0);
  const avgDay = worked.length ? r2(sum(worked, (d) => dayTotal(d)) / worked.length) : 0;
  const daysOpen = (s.workDays || [0, 1, 2, 3, 4, 5]);
  const useForecast = !!s.cfForecast && avgDay > 0;
  let bal = s.bank ? num(s.bank.amount) : null;
  let cursor = t;
  const incomeUntil = (d) => { if (!useForecast || d <= cursor) return 0; let n = 0; for (let x = addDays(cursor, 1); x <= d; x = addDays(x, 1)) if (daysOpen.includes(parse(x).getDay())) n++; cursor = d; return r2(n * avgDay); };
  const html = groups.map(([title, f]) => {
    const g = open.filter(f);
    if (!g.length) return '';
    return `<div class="card flush"><div class="grp"><b>${title}</b><b>${money(sum(g, (x) => x.amount))}</b></div><ul class="list">${g.map((x) => {
      if (bal !== null) bal = r2(bal + incomeUntil(x.due) - x.amount);
      return `<li data-t="${x.type}" data-id="${x.id}"><span>${fmtDate(x.due)} · <b class="sm">${e(x.title)}</b><small>${e(x.sub)}</small></span>
        <span class="end"><b>${money(x.amount)}</b>${bal !== null ? `<small class="${bal < 0 ? 'neg' : 'muted'}">נשאר ${money0(bal)}</small>` : ''}<button class="tag ${x.due < t ? 'bad' : 'wait'}" data-pay>✓ סימון ששולם</button></span></li>`;
    }).join('')}</ul></div>`;
  }).join('');
  main.innerHTML = `
    <div class="head row"><h1>📅 תזרים — מה לתשלום</h1></div>
    <div class="kpis">
      <div class="kpi neg"><small>סה"כ פתוח</small><b>${money0(sum(open, (x) => x.amount))}</b></div>
      <div class="kpi"><small>עד סוף החודש</small><b>${money0(sum(open.filter((x) => x.due <= endOfMonth(t)), (x) => x.amount))}</b></div>
      <div class="kpi ${open.some((x) => x.due < t) ? 'neg' : ''}"><small>באיחור</small><b>${money0(sum(open.filter((x) => x.due < t), (x) => x.amount))}</b></div>
    </div>
    <div class="card row wrap"><span>יתרה בבנק: <b>${s.bank ? money(s.bank.amount) + '</b> <small class="muted">(עודכן ' + fmtDate(s.bank.date) + ')</small>' : '—</b> <small class="muted">הזינו כדי לראות כמה נשאר אחרי כל תשלום</small>'}</span>
      <span class="actions">${avgDay ? `<label class="chk"><input type="checkbox" id="fc"${s.cfForecast ? ' checked' : ''}> להוסיף הכנסה צפויה (${money0(avgDay)} ליום עבודה)</label>` : ''}<button class="btn" id="bank">🏦 עדכון יתרה</button></span></div>
    ${html || '<div class="card"><p class="muted">אין תשלומים פתוחים 🎉</p></div>'}`;
  $('#bank', main).onclick = async () => {
    const r = await modal('יתרה בבנק', field('היתרה היום', money_in('amount', s.bank ? s.bank.amount : '')) + field('תאריך', inp('date', t, 'type="date"')),
      [{ label: 'ניקוי', kind: 'ghost', value: 'clear' }, { label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true }]);
    if (!r) return;
    await saveSettings({ bank: r.value === 'clear' || r.amount === '' ? null : { amount: r2(num(r.amount)), date: r.date || t } });
    cashflowView(main);
  };
  const fc = $('#fc', main);
  if (fc) fc.onchange = async () => { await saveSettings({ cfForecast: fc.checked }); cashflowView(main); };
  $$('[data-pay]', main).forEach((b) => { b.onclick = async () => {
    const li = b.closest('li'), table = li.dataset.t === 'invoice' ? 'invoices' : 'expenses';
    const x = S[table].find((r) => r.id === li.dataset.id);
    await save(table, { ...x, paid: true, paidDate: t });
    toast('סומן כשולם ✓');
    cashflowView(main);
  }; });
}
