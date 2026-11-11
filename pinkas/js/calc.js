// Pinkas — the pure calculations (no DOM, no storage): prices and margins, due dates, the fixed expenses' schedule,
// periods and the report. Tested by pinkas/tests/calc_test.ts (deno test).

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const num = (v) => { const n = Number(String(v ?? '').replace(/[,₪\s]/g, '')); return Number.isFinite(n) ? n : 0; };
export const sum = (arr, f = (x) => x) => r2(arr.reduce((a, x) => a + (Number(f(x)) || 0), 0));

/** a day's income by means of payment (the field in a day's row, the label, the icon). Bit / PayBox — 19/10/2026 */
export const DAY_METHODS = [['cash', 'מזומן', '💵'], ['check', 'שיקים', '🧾'], ['card', 'כרטיסי אשראי', '💳'], ['bit', 'Bit', '📱'], ['paybox', 'PayBox', '📲']];
export const dayTotal = (d) => r2(DAY_METHODS.reduce((a, [k]) => a + (Number(d?.[k]) || 0), 0));

/* ---------------- dates (local, "YYYY-MM-DD") ---------------- */
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = () => ymd(new Date());
export const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const monthOf = (s) => String(s).slice(0, 7);
export const daysInMonth = (y, m) => new Date(y, m, 0).getDate();            // m: 1..12
export const endOfMonth = (s) => { const d = parse(s); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
export const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const t = y * 12 + (m - 1) + n; return Math.floor(t / 12) + '-' + pad(t % 12 + 1); };
export const monthsBetween = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
export const fmtDate = (s) => s ? s.split('-').reverse().join('/') : '';
const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const monthName = (ym) => { const [y, m] = ym.split('-').map(Number); return HE_MONTHS[m - 1] + ' ' + y; };
export const monthShort = (ym) => HE_MONTHS[Number(ym.slice(5, 7)) - 1];

/* ---------------- prices ----------------
 * A category's margin is "from the top" (רווח גולמי — a share of the sale price: price = cost / (1 − m)) or
 * "from the bottom" (תוספת על העלות: price = cost × (1 + m)). Costs are before VAT; the shelf price includes VAT
 * when settings.priceIncVat. */
export function roundPrice(p, mode) {
  if (!(p > 0)) return 0;
  if (mode === '0.1') return r2(Math.ceil(r2(p) * 10 - 1e-9) / 10);
  if (mode === '1') return Math.ceil(r2(p) - 1e-9);
  if (mode === '0.9') return r2(Math.ceil(r2(p) + 0.1 - 1e-9) - 0.1);   // the next x.90
  return r2(p);
}
export function salePrice(cost, cat, s) {
  cost = Number(cost);
  if (!(cost > 0) || !cat) return null;
  const m = (Number(cat.margin) || 0) / 100;
  let p;
  if (cat.mode === 'top') { if (m >= 1) return null; p = cost / (1 - m); } else p = cost * (1 + m);
  if (s.priceIncVat && s.vatOn) p *= 1 + s.vat / 100;
  return roundPrice(p, s.rounding);
}
/** the margin a given shelf price really gives, in the category's terms (top / bottom), in % */
export function marginOf(price, cost, mode, s) {
  price = Number(price); cost = Number(cost);
  if (!(price > 0) || !(cost > 0)) return null;
  const net = s.priceIncVat && s.vatOn ? price / (1 + s.vat / 100) : price;
  return r2(100 * (mode === 'top' ? (net - cost) / net : (net - cost) / cost));
}
/** the item's price: the manual one, else from the category */
export const itemPrice = (it, cat, s) => (Number(it.price) > 0 ? Number(it.price) : salePrice(it.cost, cat, s));

/* ---------------- supplier terms → due date ----------------
 * terms: { base: 'eom' (שוטף+) | 'net' (from the invoice date) | 'cash' (on the day), days } */
export function dueDate(invoiceDate, terms) {
  if (!invoiceDate) return '';
  const t = terms || { base: 'cash', days: 0 };
  const days = Number(t.days) || 0;
  if (t.base === 'eom') return addDays(endOfMonth(invoiceDate), days);
  if (t.base === 'net') return addDays(invoiceDate, days);
  return invoiceDate;
}
export const termsText = (t) => !t || t.base === 'cash' ? 'מזומן / מיידי' : t.base === 'eom' ? 'שוטף + ' + (Number(t.days) || 0) : (Number(t.days) || 0) + ' יום מהחשבונית';

/* ---------------- fixed expenses ----------------
 * template: { id, name, amount, every (months: 1/2/3/6/12), day (1..31), start 'YYYY-MM', end? 'YYYY-MM', active }.
 * The occurrences up to `untilYm` that are not created yet → new expense rows (the caller saves them). */
export function fixedDue(tpl, untilYm, existing) {
  if (!tpl.active || !tpl.start || !(Number(tpl.amount) >= 0)) return [];
  const every = Math.max(1, Number(tpl.every) || 1);
  const have = new Set(existing.filter((e) => e.fixedId === tpl.id).map((e) => e.period));
  const out = [];
  const last = tpl.end && tpl.end < untilYm ? tpl.end : untilYm;
  for (let ym = tpl.start; monthsBetween(ym, last) >= 0; ym = addMonths(ym, every)) {
    if (have.has(ym)) continue;
    const [y, m] = ym.split('-').map(Number);
    const day = Math.min(Math.max(1, Number(tpl.day) || 1), daysInMonth(y, m));
    out.push({ kind: 'fixed', fixedId: tpl.id, period: ym, date: ym + '-' + pad(day), name: tpl.name, category: tpl.category || '',
      amount: r2(tpl.amount), vat: !!tpl.vat, paid: false, ...(tpl.supplierId ? { supplierId: tpl.supplierId, payee: tpl.payee || '' } : {}) });
  }
  return out;
}

/* ---------------- periods ---------------- */
export const PERIODS = [['month', 'חודש'], ['bimonth', 'חודשיים (מע"מ)'], ['quarter', 'רבעון'], ['half', 'חצי שנה'], ['year', 'שנה'], ['custom', 'טווח תאריכים']];
export function periodRange(kind, anchor /* a date */) {
  const d = parse(anchor), y = d.getFullYear(), m = d.getMonth() + 1;
  const span = { month: 1, bimonth: 2, quarter: 3, half: 6, year: 12 }[kind] || 1;
  const first = Math.floor((m - 1) / span) * span + 1;
  const from = y + '-' + pad(first) + '-01';
  const to = endOfMonth(y + '-' + pad(first + span - 1) + '-01');
  const label = kind === 'month' ? monthName(monthOf(from)) : kind === 'year' ? 'שנת ' + y
    : kind === 'quarter' ? 'רבעון ' + ((first - 1) / 3 + 1) + ' · ' + y
    : kind === 'half' ? (first === 1 ? 'חציון ראשון' : 'חציון שני') + ' · ' + y
    : monthShort(monthOf(from)) + '–' + monthShort(monthOf(to)) + ' ' + y;
  return { from, to, label };
}
/** the previous / next period of the same kind */
export function shiftPeriod(kind, anchor, dir) {
  const span = { month: 1, bimonth: 2, quarter: 3, half: 6, year: 12 }[kind] || 1;
  return addMonths(monthOf(anchor), span * dir) + '-01';
}
export function monthsIn(from, to) {
  const out = [];
  for (let ym = monthOf(from); monthsBetween(ym, monthOf(to)) >= 0; ym = addMonths(ym, 1)) out.push(ym);
  return out;
}

/* ---------------- the report ----------------
 * data: { days, creditSales, payments, expenses, invoices } (arrays). Income is by its day; expenses and purchases
 * by their date (accrual — what belongs to the period); "paid" — what actually went out in the period. */
export const PAYROLL_CAT = 'שכר עובדים';
export const isPayroll = (x) => x.category === PAYROLL_CAT;
export const vatPart = (amount, s) => (s.vatOn ? r2(amount * s.vat / (100 + s.vat)) : 0);
export function report(data, from, to, s) {
  const inP = (dt) => dt && dt >= from && dt <= to;
  const days = data.days.filter((x) => inP(x.date));
  const credit = data.creditSales.filter((x) => inP(x.date));
  const inc = Object.fromEntries(DAY_METHODS.map(([k]) => [k, sum(days, (x) => x[k])]));
  inc.credit = sum(credit, (x) => x.amount);
  inc.total = r2(dayTotal(inc) + inc.credit);
  const collected = sum(data.payments.filter((x) => inP(x.date)), (x) => x.amount);   // the credit customers paid (not new income)
  const exp = data.expenses.filter((x) => !x.skipped && inP(x.date));
  // payroll apart: clearcount's posted month (👷) or a "שכר עובדים" expense typed in Pinkas
  const pay = exp.filter(isPayroll), rest = exp.filter((x) => !isPayroll(x));
  const fixed = rest.filter((x) => x.kind === 'fixed'), other = rest.filter((x) => x.kind !== 'fixed');
  const inv = data.invoices.filter((x) => inP(x.date));
  const out = { fixed: sum(fixed, (x) => x.amount), other: sum(other, (x) => x.amount), payroll: sum(pay, (x) => x.amount), purchases: sum(inv, (x) => x.amount) };
  out.total = r2(out.fixed + out.other + out.payroll + out.purchases);
  const gross = r2(inc.total - out.purchases), net = r2(inc.total - out.total);
  const vatOut = vatPart(inc.total, s);
  const vatIn = r2(sum(inv.filter((x) => x.vat !== false), (x) => vatPart(x.amount, s)) + sum(exp.filter((x) => x.vat), (x) => vatPart(x.amount, s)));
  // by category (fixed + other expenses), biggest first
  const byCat = {};
  for (const x of exp) { const k = x.category || (x.kind === 'fixed' ? x.name : 'אחר'); byCat[k] = r2((byCat[k] || 0) + Number(x.amount || 0)); }
  const bySupplier = {};
  for (const x of inv) bySupplier[x.supplierId] = r2((bySupplier[x.supplierId] || 0) + Number(x.amount || 0));
  const paidOut = r2(sum(data.expenses.filter((x) => !x.skipped && x.paid && inP(x.paidDate || x.date)), (x) => x.amount) +
    sum(data.invoices.filter((x) => x.paid && inP(x.paidDate || x.dueDate)), (x) => x.amount));
  return { from, to, inc, collected, out, gross, net, grossPct: inc.total ? r2(100 * gross / inc.total) : null,
    vat: { out: vatOut, in: vatIn, due: r2(vatOut - vatIn) }, byCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
    bySupplier: Object.entries(bySupplier).sort((a, b) => b[1] - a[1]), paidOut, workDays: days.filter((x) => dayTotal(x) > 0).length };
}

/** the months whose payroll clearcount posted (👷 → "רישום כהוצאה") */
export const payrollMonths = (expenses) => new Set(expenses.filter((x) => x.source === 'sidurit' && x.locked && !x.skipped).map((x) => monthOf(x.date)));

/** a credit customer's balance: credit sales − payments */
export function balanceOf(customerId, data) {
  return r2(sum(data.creditSales.filter((x) => x.customerId === customerId), (x) => x.amount) - sum(data.payments.filter((x) => x.customerId === customerId), (x) => x.amount));
}

/** what is still to be paid (cash-flow): unpaid supplier invoices + unpaid expenses, by due date */
export function openPayables(data, suppliers) {
  const sName = (id) => (suppliers.find((x) => x.id === id) || {}).name || 'ספק';
  return [
    ...data.invoices.filter((x) => !x.paid).map((x) => ({ type: 'invoice', id: x.id, due: x.dueDate || x.date, amount: Number(x.amount) || 0, title: sName(x.supplierId), sub: 'חשבונית ' + (x.number || '') })),
    ...data.expenses.filter((x) => !x.paid && !x.skipped).map((x) => ({ type: 'expense', id: x.id, due: x.date, amount: Number(x.amount) || 0, title: x.name || x.category || 'הוצאה', sub: x.kind === 'fixed' ? 'הוצאה קבועה' : (x.category || 'הוצאה') })),
  ].sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}

/** "Excel / CSV" text → rows (tab, comma or semicolon; quotes) */
export function parseTable(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = ['\t', ';', ','].find((c) => lines[0].includes(c)) || ',';
  return lines.map((l) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
}
