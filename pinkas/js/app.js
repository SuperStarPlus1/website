// Pinkas — the app shell: start-up, the menu, the router (#/screen/arg) and the home screen.
import { S, load, syncFixed, dev, hasData } from './store.js';
import { welcome, unlock, cloudStart, ensureLicense, ensureApproved } from './auth.js';
import { licenseState } from './license.js';
import { startSync, status, onPulled, isCloud, serverConfig } from './cloud.js';
import { autoBackup } from './backup.js';
import { IS_APP, newerVersion, CC, HOST, BRAND, HOST_NAME, FEAT } from './env.js';
import { e, money, money0, $, toast } from './ui.js';
import { dayTotal, today, monthOf, report, periodRange, openPayables, balanceOf, fmtDate, monthName, addDays, sum } from './calc.js';
import { incomeView } from './views/income.js';
import { customersView, customerView } from './views/customers.js';
import { expensesView, fixedView } from './views/expenses.js';
import { purchasingView } from './views/purchasing.js';
import { cashflowView } from './views/cashflow.js';
import { reportsView } from './views/reports.js';
import { settingsView, loadDemo } from './views/settings.js';
import { payrollView } from './views/payroll.js';
import { suppliersView } from './views/suppliers.js';

const NAV = [
  ['home', '🏠', 'ראשי'], ['income', '💰', 'הכנסות'], ['expenses', '🧾', 'הוצאות'], ['purchasing', '📦', 'רכש'], ['suppliers', '🚚', 'ספקים'],
  ['cashflow', '📅', 'תזרים'], ['reports', '📊', 'דוחות'], ['customers', '👥', 'לקוחות הקפה', () => S.settings.creditOn],
  ['payroll', '👷', 'שכר עובדים', () => !!CC && FEAT.payroll], ['settings', '⚙', 'הגדרות'],
];
const ROUTES = { home: homeView, income: incomeView, customers: customersView, customer: customerView, expenses: expensesView, fixed: fixedView,
  purchasing: purchasingView, suppliers: suppliersView, cashflow: cashflowView, reports: reportsView, settings: settingsView, payroll: payrollView };

export function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
let renders = 0;
export async function render() {
  const [, name = 'home', ...args] = location.hash.replace(/^#/, '').split('/');
  const view = ROUTES[name] || homeView;
  drawNav(name === 'customer' ? 'customers' : name === 'fixed' ? 'expenses' : name);
  const main = $('#main'), n = ++renders;
  main.innerHTML = '';
  try { await view(main, ...args.map(decodeURIComponent)); }
  catch (err) { console.error(err); if (n === renders) main.innerHTML = `<div class="card err-card">שגיאה: ${e(err.message)}</div>`; }   // a screen already left — not over the new one
  main.focus({ preventScroll: true });
}
function drawNav(active) {
  const items = NAV.filter((n) => !n[3] || n[3]());
  const html = items.map(([k, ic, label]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}"><span class="ic">${ic}</span><span class="lb">${label}</span></a>`).join('');
  $('#side').innerHTML = `<div class="brand"><span class="logo">📒</span><div><b>${BRAND}</b><small>${e(S.settings.business || 'ניהול העסק')}</small></div></div><nav>${html}</nav>` +
    `<div class="sync" id="syncBadge"></div>`;
  drawSync();
  // the phone: 5 main tabs + "more"
  const main5 = ['home', 'income', 'expenses', 'purchasing', 'reports'];
  $('#tabs').innerHTML = items.filter((n) => main5.includes(n[0])).map(([k, ic, label]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}"><span class="ic">${ic}</span><span class="lb">${label}</span></a>`).join('') +
    `<a href="#/more" class="${!main5.includes(active) ? 'on' : ''}" id="moreTab"><span class="ic">☰</span><span class="lb">עוד</span></a>`;
  $('#moreTab').onclick = (ev) => { ev.preventDefault(); toggleMore(items, active); };
}
/** the online mode's state, in the menu (and a dot on the phone's "more") */
const SYNC_TEXT = { ok: ['☁', 'מסונכרן'], syncing: ['⟳', 'מסנכרן…'], pending: ['⏳', 'ממתין לסנכרון'], offline: ['📴', 'אין חיבור — נשמר במכשיר'], error: ['⚠', 'שגיאת סנכרון'], signin: ['🔑', 'יש להתחבר מחדש'], 'pending-approval': ['⏳', 'ממתין לאישור'], blocked: ['⛔', 'החשבון חסום'], idle: ['☁', ''] };
function drawSync() {
  const b = $('#syncBadge');
  if (!b) return;
  if (!isCloud()) { b.innerHTML = '<span class="muted">📱 עצמאי · במכשיר בלבד</span>'; return; }
  const [ic, t] = SYNC_TEXT[status.v] || SYNC_TEXT.idle;
  b.innerHTML = `<button class="sync-btn ${status.v}" id="syncGo">${ic} ${e(t || dev.get('storeName') || 'חשבון מקוון')}</button>`;
  $('#syncGo').onclick = async () => { if (status.v === 'signin') return relogin(); const { syncNow } = await import('./cloud.js'); syncNow(); };
}
let relogging = false;
async function relogin() {
  if (CC) { toast('יש להתחבר מחדש ל' + HOST_NAME + ' — ואז לפתוח שוב את ' + BRAND, 'err'); return; }
  if (relogging) return;
  relogging = true;
  await new Promise((done) => cloudStart(done, 'relogin'));
  relogging = false;
  const { syncNow } = await import('./cloud.js');
  await syncNow(); render();
}
function toggleMore(items, active) {
  let m = $('#moreMenu');
  if (m) { m.remove(); return; }
  m = document.createElement('div');
  m.id = 'moreMenu';
  m.innerHTML = items.map(([k, ic, label]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}">${ic} ${label}</a>`).join('');
  m.onclick = () => m.remove();
  document.body.appendChild(m);
}

/* ---------------- home ---------------- */
async function homeView(main) {
  const t = today(), s = S.settings;
  const mon = periodRange('month', t);
  const r = report(S, mon.from, mon.to, s);
  const todayRow = S.days.find((d) => d.date === t);
  const todayIncome = dayTotal(todayRow);
  const todayCredit = sum(S.creditSales.filter((x) => x.date === t), (x) => x.amount);
  const open = openPayables(S, S.suppliers);
  const week = addDays(t, 7);
  const late = open.filter((x) => x.due < t), soon = open.filter((x) => x.due >= t && x.due <= week);
  const debt = s.creditOn ? S.customers.reduce((a, c) => a + Math.max(0, balanceOf(c.id, S)), 0) : 0;
  const lb = dev.get('lastBackup'), daysSinceBackup = lb ? Math.floor((Date.now() - Date.parse(lb)) / 864e5) : null;
  const remind = !isCloud() && hasData() && (daysSinceBackup === null || daysSinceBackup >= 7);
  const lic = isCloud() ? null : await licenseState();
  main.innerHTML = `
    <div class="head"><h1>${e(s.business || 'שלום 👋')}</h1><p class="muted">${fmtDate(t)} · ${monthName(monthOf(t))}</p></div>
    ${!s.business ? `<div class="card hint">ברוכים הבאים לפנקס! מתחילים ב<a href="#/settings">⚙ הגדרות</a> — שם העסק, מע"מ והאם עובדים בהקפה. כל המידע נשמר רק במכשיר הזה.</div>` : ''}
    <div id="updBox"></div>
    ${lic && lic.status === 'ok' && lic.leaseDays <= 5 && lic.days > 5 ? `<div class="card warn">🌐 צריך להתחבר לאינטרנט ${lic.leaseDays <= 0 ? 'היום' : 'בתוך ' + lic.leaseDays + ' ימים'} — לאימות הרישיון החודשי (קורה לבד כשיש חיבור).</div>` : ''}
    ${lic && lic.status === 'ok' && lic.days <= 14 ? `<div class="card warn">🔑 תוקף קוד ההפעלה מסתיים ${lic.days === 0 ? 'היום' : 'בעוד ' + lic.days + ' ימים'} (${fmtDate(lic.p.e)}). לחידוש — פנו לספק התוכנה; <a href="#/settings">הזנת קוד חדש</a>.</div>` : ''}
    ${remind ? `<div class="card warn">💾 ${daysSinceBackup === null ? 'עוד לא נעשה גיבוי' : 'הגיבוי האחרון לפני ' + daysSinceBackup + ' ימים'}. המידע שמור רק במכשיר הזה — <a href="#/settings">גיבוי עכשיו</a>.</div>` : ''}
    <div class="today card">
      <div><small class="muted">הכנסות היום</small><div class="big">${money(todayIncome + todayCredit)}</div>${todayRow ? '' : '<small class="muted">עוד לא נרשמו</small>'}</div>
      <a class="btn primary" href="#/income/${t}">${todayRow ? '✏ עדכון היום' : '➕ רישום הכנסות היום'}</a>
    </div>
    <h2>${monthName(monthOf(t))} עד עכשיו</h2>
    <div class="kpis">
      <div class="kpi"><small>הכנסות</small><b>${money0(r.inc.total)}</b></div>
      <div class="kpi"><small>רכש (ספקים)</small><b>${money0(r.out.purchases)}</b></div>
      <div class="kpi"><small>הוצאות ושכר</small><b>${money0(r.out.fixed + r.out.other + r.out.payroll)}</b></div>
      <div class="kpi ${r.net < 0 ? 'neg' : 'pos'}"><small>רווח (לפני מס)</small><b>${money0(r.net)}</b></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>📅 לתשלום בשבוע הקרוב</h3>
        ${late.length ? `<p class="neg">⚠ ${late.length} תשלומים באיחור — ${money(sum(late, (x) => x.amount))}</p>` : ''}
        ${soon.length ? `<ul class="list">${soon.slice(0, 6).map((x) => `<li><span>${fmtDate(x.due)} · ${e(x.title)}<small>${e(x.sub)}</small></span><b>${money(x.amount)}</b></li>`).join('')}</ul>` : '<p class="muted">אין תשלומים בשבוע הקרוב.</p>'}
        <a href="#/cashflow">לתזרים המלא ←</a></div>
      <div class="card"><h3>⚡ פעולות מהירות</h3>
        <div class="quick">
          <a class="btn" href="#/purchasing/invoices/photo">📷 חשבונית מצילום</a>
          <a class="btn" href="#/purchasing/invoices/new">📥 חשבונית ספק</a>
          <a class="btn" href="#/expenses/new">🧾 הוצאה</a>
          ${s.creditOn ? '<a class="btn" href="#/customers">👥 לקוחות הקפה</a>' : ''}
          <a class="btn" href="#/reports">📊 דוח חודשי</a>
        </div>
        ${s.creditOn ? `<p class="muted" style="margin-top:12px">חוב לקוחות הקפה: <b>${money(debt)}</b></p>` : ''}
      </div>
    </div>`;
  if (IS_APP) fetch('version.json').then((r) => r.json()).then((v) => newerVersion(v.version)).then((n) => {
    const box = $('#updBox', main);
    if (n && box) box.innerHTML = `<div class="card hint">⬆ יש גרסה חדשה של פנקס (${e(n.version)}). <a href="${e(n.url)}" target="_blank" rel="noopener">להורדה ולהתקנה</a> — המידע נשמר.</div>`;
  }).catch(() => {});
}

/* ---------------- clearcount: the start inside Sidurit ---------------- */
async function ccStart() {
  const stop = (html) => { $('#main').innerHTML = `<div class="card" style="max-width:560px;margin:12vh auto;text-align:center">${html}</div>`; return false; };
  if (!HOST) return stop('<h2>📒 clearcount</h2><p>clearcount נפתח מתוך סידורית: <b>⚙ אדמין ← 📒 clearcount</b> (אדמין של החברה).</p>');
  document.title = BRAND + ' — ניהול העסק';
  dev.set('mode', 'cloud'); dev.set('token', 'sidurit');            // the online mode; the sign-in is Sidurit's own
  const { call } = await import('./cloud.js');
  const r = await call('open');
  if (!r.ok) return stop('<h2>📒 ' + e(BRAND) + '</h2><p>' + e(r.error || 'לא ניתן לפתוח') + '</p>');
  Object.assign(FEAT, r.features || {});
  dev.set('storeName', r.store);
  // the business details are the company's (shared with Sidurit, edited there) — kept with the ledger's settings
  const p = r.profile || {};
  const { saveSettings } = await import('./store.js');
  if (S.settings.business !== p.business || JSON.stringify(S.settings.company || {}) !== JSON.stringify(p)) await saveSettings({ business: p.business, company: p });
  return true;
}

/* ---------------- start ---------------- */
async function start() {
  try { await load(); }
  catch (err) {
    $('#main').innerHTML = `<div class="card err-card">לא ניתן לפתוח את מאגר הנתונים במכשיר (${e(err.message)}). בגלישה בסתר / פרטית הדפדפן לא שומר מידע — פתחו בחלון רגיל.</div>`;
    return;
  }
  // clearcount (inside Sidurit): no entrance of its own — the company's ledger through the Sidurit sign-in
  if (CC) { if (!(await ccStart())) return; }
  // the entrance: first open → the mode; standalone → the password; online without a session → sign in
  for (; !CC;) {
    const mode = dev.get('mode');
    if (mode === 'local') { await ensureLicense(); if (dev.get('lock')) await unlock(); break; }
    if (mode === 'cloud') {
      if (!dev.get('token')) await new Promise((done) => cloudStart(done, 'relogin'));
      if ((await ensureApproved()) === 'left') continue;   // went back to standalone / signed out
      break;
    }
    if (/[?&]demo(=|&|$)/.test(location.search) && !hasData()) { await ensureLicense(); dev.set('mode', 'local'); dev.set('demo', true); break; }   // trying it out (an activated device): no password
    await welcome();
    if (dev.get('mode') === 'cloud') continue;   // → the approval check above
    if (dev.get('mode')) break;
  }
  status.on(async () => { drawSync(); if (status.v === 'signin') relogin(); if (!CC && (status.v === 'pending-approval' || status.v === 'blocked')) { if ((await ensureApproved()) === 'left') location.reload(); else { const { syncNow } = await import('./cloud.js'); syncNow(); } } });
  onPulled(() => render());
  startSync();
  serverConfig();
  autoBackup();
  // ?demo — an empty device gets the sample data (a link for trying the app)
  if (/[?\&]demo(=|&|$)/.test(location.search) && !(S.days.length + S.invoices.length + S.expenses.length)) await loadDemo();
  window.addEventListener('hashchange', () => { const m = $('#moreMenu'); if (m) m.remove(); render(); });
  // a new day / month while the app stays open → the fixed expenses of the coming months
  document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && await syncFixed()) render(); });
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !IS_APP && !CC) navigator.serviceWorker.register('sw.js').catch(() => {});   // the installed apps carry their files
}
start();
