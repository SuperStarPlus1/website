// Pinkas — reports: a month / two months (the VAT period) / quarter / half / year / any dates — income by means of
// payment, purchases, expenses and 👷 payroll (apart), gross and net profit, VAT estimate, month by month, by supplier
// and by expense category. Print (→ PDF) and CSV. clearcount: the closed months whose payroll is not posted yet are named.
import { S } from '../store.js';
import { e, money, money0, pct, $, $$, download, toCsv, toast } from '../ui.js';
import { DAY_METHODS, today, PERIODS, periodRange, shiftPeriod, report, monthsIn, monthName, endOfMonth, fmtDate, monthOf, payrollMonths } from '../calc.js';
import { CC, FEAT } from '../env.js';
import { call, syncNow } from '../cloud.js';

export async function reportsView(main) {
  const s = S.settings;
  const st = JSON.parse(sessionStorage.getItem('pk_rep') || '{}');
  st.kind ||= 'month'; st.anchor ||= today();
  const keep = () => sessionStorage.setItem('pk_rep', JSON.stringify(st));
  const rng = st.kind === 'custom' ? { from: st.from || today().slice(0, 8) + '01', to: st.to || today(), label: fmtDate(st.from || today().slice(0, 8) + '01') + ' – ' + fmtDate(st.to || today()) } : periodRange(st.kind, st.anchor);
  const r = report(S, rng.from, rng.to, s);
  const months = monthsIn(rng.from, rng.to);
  const perMonth = months.length > 1 ? months.map((ym) => ({ ym, r: report(S, ym + '-01', endOfMonth(ym + '-01'), s) })) : [];
  const supName = (id) => (S.suppliers.find((v) => v.id === id) || {}).name || '—';
  // clearcount: closed months in the period with no payroll posted (👷 שכר עובדים → "רישום כהוצאה")
  const posted = payrollMonths(S.expenses), thisMonth = monthOf(today());
  const missing = CC && FEAT.payroll ? months.filter((ym) => ym <= thisMonth && !posted.has(ym)).slice(-12) : [];
  const line = (label, v, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="n">${money(v)}</td></tr>`;
  main.innerHTML = `
    <div class="head row noprint"><h1>📊 דוחות</h1><div class="actions"><button class="btn" id="csv">⬇ CSV</button><button class="btn" id="prt">🖨 הדפסה / PDF</button></div></div>
    <div class="card row wrap noprint">
      <div class="chips">${PERIODS.map(([k, l]) => `<button class="chip${k === st.kind ? ' on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
      ${st.kind === 'custom' ? `<div class="actions"><input type="date" id="from" value="${rng.from}"> – <input type="date" id="to" value="${rng.to}"></div>`
        : `<div class="monthbar"><button class="btn sm" id="prev">→</button><b>${rng.label}</b><button class="btn sm" id="next">←</button></div>`}
    </div>
    <h2 class="printonly">${e(s.business || 'פנקס')} — דוח ${e(rng.label)}</h2>
    <div class="kpis">
      <div class="kpi"><small>הכנסות</small><b>${money0(r.inc.total)}</b></div>
      <div class="kpi"><small>רווח גולמי</small><b>${money0(r.gross)}</b><small>${pct(r.grossPct)}</small></div>
      <div class="kpi"><small>הוצאות, שכר ורכש</small><b>${money0(r.out.total)}</b></div>
      <div class="kpi ${r.net < 0 ? 'neg' : 'pos'}"><small>רווח נקי (לפני מס)</small><b>${money0(r.net)}</b></div>
    </div>
    <div class="grid2">
      <div class="card flush"><table class="tbl"><thead><tr><th colspan="2">💰 הכנסות</th></tr></thead><tbody>
        ${DAY_METHODS.map(([k, l]) => (k === 'bit' || k === 'paybox') && !r.inc[k] ? '' : line(l, r.inc[k])).join('')}${s.creditOn || r.inc.credit ? line('מכירות בהקפה', r.inc.credit) : ''}
        ${line('סה"כ הכנסות', r.inc.total, 'tot')}
        ${s.creditOn || r.collected ? `<tr><td colspan="2" class="muted small">גבייה מלקוחות הקפה בתקופה: ${money(r.collected)} (תשלום על חוב — לא הכנסה חדשה)</td></tr>` : ''}
        <tr><td colspan="2" class="muted small">${r.workDays} ימי עבודה · ממוצע ליום ${r.workDays ? money(r.inc.total / r.workDays) : '—'}</td></tr>
      </tbody></table></div>
      <div class="card flush"><table class="tbl"><thead><tr><th colspan="2">🧾 הוצאות</th></tr></thead><tbody>
        ${line('רכש מספקים', r.out.purchases)}${line('הוצאות קבועות', r.out.fixed)}${line('הוצאות נלוות', r.out.other)}${(CC && FEAT.payroll) || r.out.payroll ? line('👷 שכר עובדים (עלות מעסיק)', r.out.payroll) : ''}${line('סה"כ', r.out.total, 'tot')}
        ${missing.length ? `<tr class="noprint"><td colspan="2" id="payEst" class="small muted">👷 מחשב את עלות השכר שטרם נרשמה…</td></tr>` : ''}
        <tr><td colspan="2" class="muted small">שולם בפועל בתקופה: ${money(r.paidOut)}</td></tr>
      </tbody></table></div>
    </div>
    ${s.vatOn ? `<div class="card flush"><table class="tbl"><thead><tr><th colspan="2">🧮 מע"מ (הערכה, ${s.vat}%)</th></tr></thead><tbody>
      ${line('מע"מ עסקאות (מההכנסות)', r.vat.out)}${line('מע"מ תשומות (רכש והוצאות עם חשבונית מס)', r.vat.in)}${line(r.vat.due >= 0 ? 'מע"מ לתשלום' : 'מע"מ להחזר', Math.abs(r.vat.due), 'tot')}
      <tr><td colspan="2" class="muted small">הערכה בלבד, לפי הסכומים שנרשמו (כולל מע"מ). הדיווח הרשמי — לפי רואה החשבון.</td></tr></tbody></table></div>` : ''}
    ${perMonth.length ? `<div class="card flush scroll"><table class="tbl"><thead><tr><th>חודש</th><th class="n">הכנסות</th><th class="n">רכש</th><th class="n">הוצאות</th><th class="n">שכר</th><th class="n">רווח נקי</th></tr></thead><tbody>
      ${perMonth.map(({ ym, r: m }) => `<tr><td>${monthName(ym)}</td><td class="n">${money0(m.inc.total)}</td><td class="n">${money0(m.out.purchases)}</td><td class="n">${money0(m.out.fixed + m.out.other)}</td><td class="n">${money0(m.out.payroll)}</td><td class="n ${m.net < 0 ? 'neg' : ''}">${money0(m.net)}</td></tr>`).join('')}
      <tr class="tot"><td>סה"כ</td><td class="n">${money0(r.inc.total)}</td><td class="n">${money0(r.out.purchases)}</td><td class="n">${money0(r.out.fixed + r.out.other)}</td><td class="n">${money0(r.out.payroll)}</td><td class="n">${money0(r.net)}</td></tr></tbody></table></div>` : ''}
    <div class="grid2">
      ${r.bySupplier.length ? `<div class="card flush"><table class="tbl"><thead><tr><th>🚚 רכש לפי ספק</th><th></th></tr></thead><tbody>${r.bySupplier.map(([id, v]) => line(e(supName(id)), v)).join('')}</tbody></table></div>` : ''}
      ${r.byCat.length ? `<div class="card flush"><table class="tbl"><thead><tr><th>🧾 הוצאות לפי קטגוריה</th><th></th></tr></thead><tbody>${r.byCat.map(([k, v]) => line(e(k), v)).join('')}</tbody></table></div>` : ''}
    </div>`;
  $$('[data-k]', main).forEach((b) => { b.onclick = () => { st.kind = b.dataset.k; keep(); reportsView(main); }; });
  const pv = $('#prev', main), nx = $('#next', main);
  if (pv) pv.onclick = () => { st.anchor = shiftPeriod(st.kind, st.anchor, -1); keep(); reportsView(main); };
  if (nx) nx.onclick = () => { st.anchor = shiftPeriod(st.kind, st.anchor, 1); keep(); reportsView(main); };
  const fr = $('#from', main), to = $('#to', main);
  if (fr) fr.onchange = to.onchange = () => { st.from = fr.value; st.to = to.value; keep(); reportsView(main); };
  $('#prt', main).onclick = () => window.print();
  if (missing.length) payrollEstimate(main, missing, thisMonth);
  $('#csv', main).onclick = () => download('דוח ' + rng.label + '.csv', toCsv([
    ['דוח', rng.label], [], ['הכנסות'], ...DAY_METHODS.map(([k, l]) => [l, r.inc[k]]), ['הקפה', r.inc.credit], ['סה"כ הכנסות', r.inc.total], [],
    ['הוצאות'], ['רכש מספקים', r.out.purchases], ['הוצאות קבועות', r.out.fixed], ['הוצאות נלוות', r.out.other], ['שכר עובדים', r.out.payroll], ['סה"כ', r.out.total], [],
    ['רווח גולמי', r.gross], ['רווח נקי', r.net], ...(s.vatOn ? [[], ['מע"מ עסקאות', r.vat.out], ['מע"מ תשומות', r.vat.in], ['מע"מ לתשלום', r.vat.due]] : []),
    ...(perMonth.length ? [[], ['חודש', 'הכנסות', 'רכש', 'הוצאות', 'שכר', 'רווח נקי'], ...perMonth.map(({ ym, r: m }) => [monthName(ym), m.inc.total, m.out.purchases, r2x(m.out.fixed + m.out.other), m.out.payroll, m.net])] : []),
    ...(r.bySupplier.length ? [[], ['רכש לפי ספק'], ...r.bySupplier.map(([id, v]) => [supName(id), v])] : []),
    ...(r.byCat.length ? [[], ['הוצאות לפי קטגוריה'], ...r.byCat] : []),
  ]), 'text/csv');
}
const r2x = (n) => Math.round(n * 100) / 100;

/** clearcount: the months of the period whose payroll is not posted — the employer cost computed now (👷, from the
 *  attendance; this month — up to today), shown as an estimate (not in the totals) with "📥 רישום" for a closed month */
const estCache = new Map();                                   // month → { at, r } — the report redraws after each sync
const estOf = async (ym) => {
  const c = estCache.get(ym);
  if (c && Date.now() - c.at < 120000) return c.r;
  const r = await call('payroll', { month: ym });
  if (r.ok) estCache.set(ym, { at: Date.now(), r });
  return r;
};
async function payrollEstimate(main, months, thisMonth) {
  const box = $('#payEst', main);
  const rows = [];
  for (const ym of months) {
    const r = await estOf(ym);
    if (!box.isConnected) return;                             // the report was left / redrawn
    rows.push({ ym, ok: r.ok, cost: r.ok ? r.totals.employerCost : 0, n: r.ok ? r.totals.employees : 0, err: r.error });
  }
  const shown = rows.filter((x) => !x.ok || x.n > 0);
  if (!shown.length) { box.closest('tr').remove(); return; }
  const est = shown.filter((x) => x.ok).reduce((a, x) => a + x.cost, 0);
  box.className = 'small';
  box.innerHTML = `<b class="neg">⚠ עלות שכר שטרם נרשמה${shown.length > 1 ? ' — ' + money(est) + ' (הערכה)' : ''}:</b> לא נכללת בסה"כ וברווח עד הרישום.<ul class="list" style="margin:6px 0 0">` +
    shown.map((x) => `<li><span><a href="#/payroll/${x.ym}">${monthName(x.ym)}</a>${x.ym === thisMonth ? ' <small>(החודש — עד היום)</small>' : ''}</span>` +
      (x.ok ? `<span class="end"><b>${money(x.cost)}</b>${x.ym < thisMonth ? ` <button class="btn sm" data-post="${x.ym}">📥 רישום</button>` : ''}</span>` : `<span class="neg">${e(x.err || 'שגיאה')}</span>`) + '</li>').join('') + '</ul>';
  box.querySelectorAll('[data-post]').forEach((b) => { b.onclick = async () => {
    b.disabled = true;
    const x = await call('payrollPost', { month: b.dataset.post });
    if (!x.ok) { b.disabled = false; toast(x.error || 'שגיאה', 'err'); return; }
    estCache.delete(b.dataset.post);
    await syncNow();
    toast('נרשם בהוצאות ✓ ' + money(x.amount));
    reportsView(main);
  }; });
}
