// 📊 the sales and profit dashboard (25/10/2026) — admin only: ⚙ ניהול ← 📊 לוח מכירות ורווח. Full screen.
// Data: api biDashboard (sales-bi.ts / migration 20261107100000_sales_bi.sql), fed by the store PC
// (C:\Dropbox\superstar\sales_summary_sync.py, READ ONLY on Comax, every 15 minutes).
// The cost = Comax's last purchase price (price list 108, before VAT); profit = sales without VAT − cost; a product
// without a cost is left out of the profit (shown apart). Charts: Chart.js from cdnjs (loaded on first open).
// Uses the app's globals: apiPost, mgrAuth, state.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const CHART_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#84cc16', '#f97316', '#14b8a6', '#64748b'];
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const nis = (v, d) => '₪' + Number(v || 0).toLocaleString('he-IL', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d });
  const num = (v, d) => Number(v || 0).toLocaleString('he-IL', { maximumFractionDigits: d == null ? 0 : d });
  const pct = (v) => (v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toLocaleString('he-IL') + '%');
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const addD = (d, k) => { const x = new Date(d); x.setDate(x.getDate() + k); return x; };
  const dm = (s) => s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '';
  const P = { period: '7d', from: '', to: '', compare: 'prev', dep: '' };
  let R = null, charts = [], timer = null, tab = 'topSales';

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#sdOv{position:fixed;inset:0;z-index:9000;background:#f1f5f9;overflow:auto;direction:rtl;font-family:inherit}' +
    '#sdOv.hidden{display:none}' +
    '.sd-top{position:sticky;top:0;z-index:2;background:linear-gradient(120deg,#4f46e5,#7c3aed 45%,#db2777);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 4px 16px rgba(79,70,229,.25)}' +
    '.sd-top h2{margin:0;font-size:19px;font-weight:900}.sd-top .fresh{font-size:12px;opacity:.9}.sd-top .sp{flex:1}' +
    '.sd-top button{background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:10px;padding:6px 12px;font:inherit;font-weight:700;cursor:pointer}' +
    '.sd-wrap{max-width:1280px;margin:0 auto;padding:14px 16px 40px}' +
    '.sd-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px}' +
    '.sd-chip{border:1.5px solid #c7d2fe;background:#fff;color:#3730a3;border-radius:99px;padding:6px 13px;font:inherit;font-weight:700;font-size:13px;cursor:pointer}' +
    '.sd-chip.on{background:#4f46e5;color:#fff;border-color:#4f46e5}' +
    '.sd-bar select,.sd-bar input{border:1.5px solid #c7d2fe;border-radius:10px;padding:6px 8px;font:inherit;font-size:13px;background:#fff}' +
    '.sd-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}' +
    '@media (max-width:520px){.sd-kpi{min-height:80px;padding:10px 11px}.sd-kpi .v{font-size:20px}.sd-kpi .ic{font-size:22px}.sd-kpi .d{font-size:11px}.sd-top h2{font-size:17px}}' +
    '.sd-kpi{border-radius:16px;padding:12px 14px;color:#fff;box-shadow:0 6px 18px rgba(15,23,42,.12);min-height:92px;position:relative;overflow:hidden}' +
    '.sd-kpi .l{font-size:12.5px;font-weight:700;opacity:.92}.sd-kpi .v{font-size:25px;font-weight:900;margin-top:4px;letter-spacing:-.5px}' +
    '.sd-kpi .d{font-size:12px;font-weight:800;margin-top:4px;display:inline-block;background:rgba(255,255,255,.22);border-radius:99px;padding:2px 8px}' +
    '.sd-kpi .ic{position:absolute;left:10px;top:8px;font-size:30px;opacity:.35}' +
    '.sd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px}' +
    '.sd-card{background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 2px 10px rgba(15,23,42,.06);min-width:0}' +
    '.sd-card h3{margin:0 0 8px;font-size:15px;font-weight:900;color:#1e1b4b;display:flex;gap:6px;align-items:center;flex-wrap:wrap}' +
    '.sd-card h3 small{font-weight:600;color:#64748b;font-size:12px}' +
    '.sd-card.wide{grid-column:1/-1}' +
    '.sd-tbl{width:100%;border-collapse:collapse;font-size:13px}.sd-tbl th{text-align:right;color:#64748b;font-weight:700;font-size:12px;padding:5px 6px;border-bottom:1px solid #e2e8f0}' +
    '.sd-tbl td{padding:6px;border-bottom:1px solid #f1f5f9}.sd-tbl tr.click{cursor:pointer}.sd-tbl tr.click:hover td{background:#eef2ff}' +
    '.sd-tbl .n{text-align:left;direction:ltr;white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '.sd-m{display:inline-block;min-width:46px;text-align:center;border-radius:99px;padding:1px 7px;font-weight:800;font-size:12px}' +
    '.sd-up{color:#059669;font-weight:800}.sd-dn{color:#dc2626;font-weight:800}' +
    '.sd-bar2{height:7px;border-radius:9px;background:#eef2ff;overflow:hidden;margin-top:3px}.sd-bar2 i{display:block;height:100%;border-radius:9px}' +
    '.sd-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}' +
    '.sd-heat{display:grid;gap:2px;font-size:11px;direction:rtl}.sd-heat div{border-radius:4px;text-align:center;padding:5px 0;color:#1e1b4b}' +
    '.sd-heat .h{background:none;color:#64748b;font-weight:700}' +
    '.sd-note{font-size:12px;color:#64748b;margin-top:12px;line-height:1.6}' +
    '.sd-warn{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:8px 12px;font-size:13px;margin-bottom:12px}' +
    '.sd-empty{background:#fff;border-radius:16px;padding:30px 20px;text-align:center;color:#334155;font-size:15px;line-height:1.7}' +
    '.sd-scroll{overflow-x:auto}' +
    '</style>');

  function loadChart() {
    if (window.Chart) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = CHART_URL; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }

  function range() {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    switch (P.period) {
      case 'today': return [t, t];
      case 'yday': return [addD(t, -1), addD(t, -1)];
      case '30d': return [addD(t, -29), t];
      case 'month': return [new Date(t.getFullYear(), t.getMonth(), 1), t];
      case 'pmonth': return [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)];
      case 'year': return [addD(t, -364), t];
      case 'custom': return [P.from ? new Date(P.from + 'T00:00') : addD(t, -6), P.to ? new Date(P.to + 'T00:00') : t];
      default: return [addD(t, -6), t];
    }
  }

  function open() {
    if (!isAdmin()) return;
    if (!$('sdOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="sdOv" class="hidden"><div class="sd-top"><h2>📊 לוח מכירות ורווח</h2><span class="fresh" id="sdFresh"></span>' +
        '<span class="sp"></span><button id="sdRefresh">⟳ רענון</button><button id="sdClose">✕ סגירה</button></div><div class="sd-wrap" id="sdBody"></div></div>');
      $('sdClose').addEventListener('click', close);
      $('sdRefresh').addEventListener('click', load);
    }
    $('sdOv').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    load();
    clearInterval(timer);
    timer = setInterval(() => { if (!$('sdOv').classList.contains('hidden') && P.period === 'today') load(); }, 5 * 60e3);
  }
  function close() { $('sdOv').classList.add('hidden'); document.body.style.overflow = ''; clearInterval(timer); }

  async function load() {
    const body = $('sdBody');
    if (!R) body.innerHTML = '<div class="sd-empty">טוען…</div>';
    const [f, t] = range();
    const [r] = await Promise.all([
      apiPost({ action: 'biDashboard', ...mAuth(), from: iso(f), to: iso(t), compare: P.compare, dep: P.dep }).catch(() => ({ ok: false, error: 'אין חיבור' })),
      loadChart().catch(() => null)]);
    if (!r.ok) { body.innerHTML = '<div class="sd-empty">' + e(r.error || 'שגיאה') + '</div>'; return; }
    R = r;
    draw();
  }

  function delta(cur, prev, money) {
    if (!prev) return '<span class="d">' + (money ? 'אין נתון להשוואה' : '—') + '</span>';
    const d = (cur - prev) / Math.abs(prev) * 100;
    return '<span class="d">' + (d >= 0 ? '▲ ' : '▼ ') + pct(Math.abs(d)) + ' ' + (R.compare === 'year' ? 'משנה שעברה' : R.compare === 'week' ? 'מאותו יום בשבוע שעבר' : 'מהתקופה הקודמת') + '</span>';
  }
  const marginColor = (m) => m == null ? '#e2e8f0;#475569' : m < 10 ? '#fee2e2;#b91c1c' : m < 20 ? '#fef3c7;#92400e' : m < 30 ? '#dcfce7;#166534' : '#d1fae5;#065f46';
  const mBadge = (m) => { const [bg, fg] = marginColor(m).split(';'); return '<span class="sd-m" style="background:' + bg + ';color:' + fg + '">' + pct(m) + '</span>'; };

  function draw() {
    charts.forEach((c) => c.destroy()); charts = [];
    const r = R, body = $('sdBody');
    $('sdFresh').textContent = r.lastPush ? 'עודכן מהחנות: ' + new Date(r.lastPush).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const chips = [['today', 'היום'], ['yday', 'אתמול'], ['7d', '7 ימים'], ['30d', '30 ימים'], ['month', 'החודש'], ['pmonth', 'חודש קודם'], ['year', 'שנה'], ['custom', 'תאריכים…']];
    const deps = (r.depNames || []).map(([c, n]) => '<option value="' + c + '"' + (String(P.dep) === String(c) ? ' selected' : '') + '>' + e(n) + '</option>').join('');
    let h = '<div class="sd-bar">' + chips.map(([k, l]) => '<button class="sd-chip' + (P.period === k ? ' on' : '') + '" data-p="' + k + '">' + l + '</button>').join('') +
      (P.period === 'custom' ? '<input type="date" id="sdFrom" value="' + e(r.from) + '"><input type="date" id="sdTo" value="' + e(r.to) + '">' : '') +
      '<select id="sdCmp"><option value="prev">לעומת התקופה הקודמת</option><option value="year"' + (P.compare === 'year' ? ' selected' : '') + '>לעומת שנה שעברה</option></select>' +
      '<select id="sdDep"><option value="">כל המחלקות</option>' + deps + '</select></div>';
    if (!r.since) {
      body.innerHTML = h + '<div class="sd-empty">📭 עוד לא התקבלו נתונים מהחנות.<br>במחשב בחנות, בתיקייה superstar שב-Dropbox: לחיצה כפולה על<br><b>"התקנת לוח מכירות - לחיצה כפולה"</b><br>הטעינה הראשונה שולחת שנה של היסטוריה (כמה דקות).</div>';
      bindBar(); return;
    }
    const c = r.cur, p = r.cmp, cr = r.curR, pr = r.cmpR;
    const profit = c.net_c - c.cost, pprofit = p.net_c - p.cost, margin = c.net_c ? profit / c.net_c * 100 : null;
    const basket = cr.receipts ? cr.sales / cr.receipts : 0, pbasket = pr.receipts ? pr.sales / pr.receipts : 0;
    const kpi = (ic, l, v, d, g) => '<div class="sd-kpi" style="background:' + g + '"><span class="ic">' + ic + '</span><div class="l">' + l + '</div><div class="v">' + v + '</div>' + (d || '') + '</div>';
    h += '<div class="sd-kpis">' +
      kpi('💰', 'מכירות (כולל מע"מ)', nis(c.sales), delta(c.sales, p.sales, 1), 'linear-gradient(135deg,#6366f1,#8b5cf6)') +
      kpi('📈', 'רווח גולמי (לפני מע"מ)', nis(profit), delta(profit, pprofit, 1), 'linear-gradient(135deg,#059669,#10b981)') +
      kpi('🎯', 'אחוז רווח', pct(margin), '<span class="d">מהמכירות לפני מע"מ</span>', 'linear-gradient(135deg,#0891b2,#06b6d4)') +
      (P.dep === '' ? kpi('🧾', 'קבלות', num(cr.receipts), delta(cr.receipts, pr.receipts), 'linear-gradient(135deg,#f59e0b,#f97316)') +
        kpi('🛒', 'סל ממוצע', nis(basket, 2), delta(basket, pbasket), 'linear-gradient(135deg,#ec4899,#f43f5e)') +
        kpi('⭐', 'מכירות במועדון', pct(cr.sales ? cr.club_sales / cr.sales * 100 : null), '<span class="d">' + num(cr.club_receipts) + ' קבלות עם כרטיס</span>', 'linear-gradient(135deg,#7c3aed,#c026d3)') : '') +
      '</div>';
    if (r.noCostSales > 0) h += '<div class="sd-warn">⚠ ' + (r.noCost === 1 ? 'מוצר אחד נמכר' : num(r.noCost) + ' מוצרים נמכרו') + ' ב-' + nis(r.noCostSales) + ' בלי מחיר עלות ב-Comax — הם לא נכללים ברווח.</div>';
    const oneDay = r.from === r.to;
    h += '<div class="sd-grid">' +
      '<div class="sd-card wide"><h3>' + (oneDay ? '⏰ מכירות לפי שעה' : '📅 מכירות ורווח לפי יום') + ' <small>' + dm(r.from) + (oneDay ? '' : '–' + dm(r.to)) + '</small></h3><div style="height:260px"><canvas id="sdC1"></canvas></div></div>' +
      '<div class="sd-card"><h3>🍩 מחלקות <small>לחיצה — סינון</small></h3><div style="height:260px"><canvas id="sdC2"></canvas></div></div>' +
      '<div class="sd-card"><h3>🏷 מחלקות — מכירות ורווח</h3><div class="sd-scroll" style="max-height:290px;overflow:auto"><table class="sd-tbl"><tr><th>מחלקה</th><th class="n">מכירות</th><th class="n">שינוי</th><th class="n">רווח</th><th>%</th></tr>' +
        r.deps.map((d) => { const pf = d.net_c - d.cost, m = d.net_c > 0 && d.cost > 0 ? pf / d.net_c * 100 : null, ch = d.cmp_sales ? (d.sales - d.cmp_sales) / Math.abs(d.cmp_sales) * 100 : null;
          return '<tr class="click" data-dep="' + (d.dep > 0 ? d.dep : '') + '"><td>' + e(d.name) + '</td><td class="n">' + nis(d.sales) + '</td><td class="n ' + (ch == null ? '' : ch >= 0 ? 'sd-up' : 'sd-dn') + '">' + (ch == null ? '—' : (ch >= 0 ? '▲' : '▼') + pct(Math.abs(ch))) +
            '</td><td class="n">' + (d.cost > 0 || d.dep < 0 ? nis(pf) : '—') + '</td><td>' + (d.dep < 0 ? '' : mBadge(m)) + '</td></tr>'; }).join('') + '</table></div></div>' +
      '<div class="sd-card wide"><div class="sd-tabs">' + [['topSales', '🏆 הכי נמכרים'], ['topProfit', '💎 הכי רווחיים'], ['lowMargin', '⚠ רווח נמוך']].map(([k, l]) =>
        '<button class="sd-chip' + (tab === k ? ' on' : '') + '" data-tab="' + k + '">' + l + '</button>').join('') + ' <small style="color:#64748b;align-self:center">' + (r.itemsBy === 'month' ? 'לפי חודשים שלמים' : '') + '</small></div><div id="sdItems"></div></div>' +
      (!oneDay ? '<div class="sd-card wide"><h3>🔥 מתי קונים <small>ממוצע מכירות לשעה לפי יום בשבוע</small></h3><div class="sd-scroll" id="sdHeat"></div></div>' : '') +
      '<div class="sd-card"><h3>🚚 ספקים מובילים</h3><div style="height:300px"><canvas id="sdC3"></canvas></div></div>' +
      '<div class="sd-card"><h3>🖥 קופות</h3><div style="height:300px"><canvas id="sdC4"></canvas></div></div>' +
      '<div class="sd-card"><h3>📦 עומד להיגמר <small>פחות מ-3 ימי מלאי, לפי קצב 14 הימים האחרונים</small></h3>' + stockTbl(r.lowStock, 'low') + '</div>' +
      '<div class="sd-card"><h3>💤 מלאי שלא זז <small>30 יום בלי מכירה — לפי שווי בעלות</small></h3>' + stockTbl(r.deadStock, 'dead') + '</div>' +
      '</div>' +
      '<div class="sd-note">העלות היא מחיר הקנייה האחרון ב-Comax (לפני מע"מ), כפול הכמות. הרווח = מכירות לפני מע"מ פחות עלות; מוצר בלי מחיר עלות לא נכלל ברווח. ' +
      'הנחת מבצע נרשמת על המוצרים שבמבצע (המכירות והרווח שלהם אחרי ההנחה); הנחה שלא ניתן לשייך למוצר והטבת סל 41 מופיעות כשורות נפרדות. מלאי — מוצרים ארוזים בלבד (שקילים, כמו ירקות ובשר, נספרים ידנית). ' +
      'הנתונים מגיעים מהחנות כל 15 דקות; ב-Comax רק קוראים.' + (r.since ? ' נתונים מ-' + dm(r.since) + '/' + r.since.slice(0, 4) + '.' : '') + '</div>';
    body.innerHTML = h;
    bindBar();
    drawItems();
    if (!oneDay) heat();
    body.querySelectorAll('[data-dep]').forEach((tr) => tr.addEventListener('click', () => { if (tr.dataset.dep) { P.dep = tr.dataset.dep; load(); } }));
    body.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; body.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b)); drawItems(); }));
    if (window.Chart) chartsDraw(oneDay);
  }

  function bindBar() {
    const body = $('sdBody');
    body.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { P.period = b.dataset.p; if (P.period !== 'custom') load(); else draw(); }));
    $('sdCmp').addEventListener('change', () => { P.compare = $('sdCmp').value; load(); });
    $('sdDep').addEventListener('change', () => { P.dep = $('sdDep').value; load(); });
    if ($('sdFrom')) [$('sdFrom'), $('sdTo')].forEach((i) => i.addEventListener('change', () => { P.from = $('sdFrom').value; P.to = $('sdTo').value; if (P.from && P.to) load(); }));
  }

  function stockTbl(list, kind) {
    if (!list || !list.length) return '<p style="color:#64748b;font-size:13px">' + (kind === 'low' ? 'אין מוצרים שעומדים להיגמר ✓' : 'אין ✓') + '</p>';
    return '<div style="max-height:290px;overflow:auto"><table class="sd-tbl"><tr><th>מוצר</th><th class="n">במלאי</th><th class="n">' + (kind === 'low' ? 'ביום' : 'שווי') + '</th>' + (kind === 'low' ? '<th class="n">ימים</th>' : '') + '</tr>' +
      list.map((x) => '<tr><td>' + e(x.name) + '</td><td class="n">' + num(x.stock, 1) + '</td><td class="n">' + (kind === 'low' ? num(x.per_day, 1) : nis(x.value)) + '</td>' +
        (kind === 'low' ? '<td class="n"><span class="sd-m" style="background:' + (x.days_left < 1 ? '#fee2e2;color:#b91c1c' : '#fef3c7;color:#92400e') + '">' + num(x.days_left, 1) + '</span></td>' : '') + '</tr>').join('') + '</table></div>';
  }

  function drawItems() {
    const list = R[tab] || [], max = Math.max(1, ...list.map((x) => Math.abs(tab === 'topProfit' ? x.profit : x.sales) || 0));
    $('sdItems').innerHTML = list.length ? '<div class="sd-scroll"><table class="sd-tbl"><tr><th>#</th><th>מוצר</th><th class="n">כמות</th><th class="n">מכירות</th><th class="n">רווח</th><th>% רווח</th></tr>' +
      list.map((x, i) => '<tr><td>' + (i + 1) + '</td><td>' + e(x.name) + '<div class="sd-bar2"><i style="width:' + Math.round(Math.abs(tab === 'topProfit' ? x.profit : x.sales) / max * 100) + '%;background:' + COLORS[i % COLORS.length] + '"></i></div></td>' +
        '<td class="n">' + num(x.qty, 1) + '</td><td class="n">' + nis(x.sales) + '</td><td class="n">' + (x.profit == null ? '—' : nis(x.profit)) + '</td><td>' + mBadge(x.margin) + '</td></tr>').join('') + '</table></div>'
      : '<p style="color:#64748b;font-size:13px">אין נתונים לתקופה.</p>';
  }

  function heat() {
    const cells = {}; let max = 0, hmin = 23, hmax = 0;
    (R.hours || []).forEach((x) => { cells[x.dow + '-' + x.hour] = x.avg_sales; max = Math.max(max, x.avg_sales); if (x.avg_sales > 0) { hmin = Math.min(hmin, x.hour); hmax = Math.max(hmax, x.hour); } });
    if (!max) { $('sdHeat').innerHTML = ''; return; }
    const hours = []; for (let k = hmin; k <= hmax; k++) hours.push(k);
    let g = '<div class="sd-heat" style="grid-template-columns:52px repeat(' + hours.length + ',minmax(30px,1fr));min-width:' + (60 + hours.length * 32) + 'px"><div class="h"></div>' + hours.map((k) => '<div class="h">' + k + '</div>').join('');
    for (let d = 0; d < 7; d++) {
      g += '<div class="h">' + DAYS[d] + '</div>' + hours.map((k) => { const v = cells[d + '-' + k] || 0, a = v / max;
        return '<div title="' + DAYS[d] + ' ' + k + ':00 — ' + nis(v) + '" style="background:' + (v ? 'rgba(124,58,237,' + (0.08 + a * 0.85).toFixed(2) + ')' : '#f8fafc') + ';color:' + (a > 0.55 ? '#fff' : '#1e1b4b') + '">' + (v ? Math.round(v / 100) / 10 + 'K' : '') + '</div>'; }).join('');
    }
    $('sdHeat').innerHTML = g + '</div>';
  }

  function chartsDraw(oneDay) {
    const C = window.Chart, r = R;
    C.defaults.font.family = getComputedStyle(document.body).fontFamily; C.defaults.color = '#475569';
    const money = { ticks: { callback: (v) => '₪' + Number(v).toLocaleString('he-IL', { notation: 'compact' }) } };
    const tip = { rtl: true, textDirection: 'rtl', callbacks: { label: (c) => ' ' + c.dataset.label + ': ' + nis(c.parsed.y != null && c.chart.config.type !== 'doughnut' ? (c.chart.options.indexAxis === 'y' ? c.parsed.x : c.parsed.y) : c.parsed) } };
    if (oneDay) {
      const hrs = {}; (r.hours || []).forEach((x) => { hrs[x.hour] = (hrs[x.hour] || 0) + x.avg_sales; });
      const keys = Object.keys(hrs).map(Number).sort((a, b) => a - b);
      charts.push(new C($('sdC1'), { type: 'bar', data: { labels: keys.map((k) => k + ':00'), datasets: [{ label: 'מכירות', data: keys.map((k) => hrs[k]), backgroundColor: keys.map((_, i) => COLORS[i % 4]), borderRadius: 8 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { y: money } } }));
    } else {
      const d = r.daily || [], cmp = r.dailyCmp || [];
      charts.push(new C($('sdC1'), { data: { labels: d.map((x) => dm(x.day)), datasets: [
        { type: 'bar', label: 'מכירות', data: d.map((x) => x.sales), backgroundColor: 'rgba(99,102,241,.75)', borderRadius: 6, order: 2 },
        { type: 'line', label: 'רווח', data: d.map((x) => x.profit), borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.35, pointRadius: 2, order: 1 },
        { type: 'line', label: R.compare === 'year' ? 'מכירות שנה שעברה' : 'מכירות תקופה קודמת', data: d.map((_, i) => cmp[i] ? cmp[i].sales : null), borderColor: '#f59e0b', borderDash: [6, 4], pointRadius: 0, tension: 0.35, order: 0 }] },
        options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { rtl: true, labels: { usePointStyle: true } }, tooltip: tip }, scales: { y: money } } }));
    }
    const deps = r.deps.filter((x) => x.dep > 0 && x.sales > 0), top = deps.slice(0, 9), rest = deps.slice(9).reduce((s, x) => s + x.sales, 0);
    charts.push(new C($('sdC2'), { type: 'doughnut', data: { labels: top.map((x) => x.name).concat(rest ? ['אחר'] : []), datasets: [{ data: top.map((x) => x.sales).concat(rest ? [rest] : []), backgroundColor: COLORS, borderWidth: 2, borderColor: '#fff' }] },
      options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: innerWidth < 560 ? 'bottom' : 'right', rtl: true, labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { rtl: true, callbacks: { label: (c) => ' ' + c.label + ': ' + nis(c.parsed) } } },
        onClick: (_, el) => { if (el.length && top[el[0].index]) { P.dep = String(top[el[0].index].dep); load(); } } } }));
    const sp = r.suppliers || [];
    charts.push(new C($('sdC3'), { type: 'bar', data: { labels: sp.map((x) => x.name), datasets: [{ label: 'מכירות', data: sp.map((x) => x.sales), backgroundColor: 'rgba(236,72,153,.75)', borderRadius: 6 },
      { label: 'רווח', data: sp.map((x) => x.profit), backgroundColor: 'rgba(16,185,129,.8)', borderRadius: 6 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { rtl: true }, tooltip: tip }, scales: { x: { ...money, reverse: true }, y: { position: 'right', ticks: { font: { size: 11 } } } } } }));
    const rg = r.registers || [];
    charts.push(new C($('sdC4'), { type: 'bar', data: { labels: rg.map((x) => 'קופה ' + x.register), datasets: [{ label: 'מכירות', data: rg.map((x) => x.sales), backgroundColor: rg.map((_, i) => COLORS[(i + 2) % COLORS.length]), borderRadius: 8 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { y: money } } }));
  }

  function start() {
    const drop = $('menuAdminDrop');
    if (drop && !$('sdMgrBtn')) {
      drop.insertAdjacentHTML('afterbegin', '<button id="sdMgrBtn" style="display:none">📊 לוח מכירות ורווח</button>');
      $('sdMgrBtn').addEventListener('click', open);
      const show = () => { $('sdMgrBtn').style.display = isAdmin() ? '' : 'none'; };
      $('menuAdminBtn')?.addEventListener('click', show, true);
      show();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openSalesDash = open;
})();
