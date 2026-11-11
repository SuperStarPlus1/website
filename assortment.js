// 🎯 assortment optimizer (11/11/2026, the owner — after an Excel "FAST FOCUS" dashboard). Admin only:
// ⚙ אדמין ← 🎯 אופטימיזציית מגוון. Full screen. Which products carry the store and which only take shelf space.
// Data: api biAssortment (sales-bi.ts → bi_assortment, migration 20261111100000) — whole months of bi_month_item.
// The classification is here (so the rules are visible on the screen):
//   the products of the period sorted by sales; by the share of the sales before them —
//   רבי מכר < 70% · חזקים 70–90% · בסיס 90–96.5% · חלשים 96.5–99.2% · דלי מכר — the last 0.8%
//   a weak / slow product is protected (not recommended for removal) when it is new (sold < 3 months), when its gross
//   margin is ≥ 15 points above its department's and at least 35%, when it is the only product sold in its sub-group,
//   or when it is fresh / weighed (fruit & vegetables, butcher, fish — seasonal)
//   recommended to cut = slow movers that are not protected; to consider = weak ones that are not protected
//   dead stock = packaged products with stock and no sale in the period (value at cost, before VAT)
// The cost = Comax price list 108 (before VAT) — not right for every product, so the margin is a hint only.
// Uses the app's globals: apiPost, mgrAuth, state. Charts: Chart.js (cdnjs); Excel: /vendor/xlsx-js-style.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const CHART_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  const XS_URL = '/vendor/xlsx-js-style-1.2.0.min.js';
  const nis = (v) => '₪' + Math.round(Number(v || 0)).toLocaleString('he-IL');
  const num = (v, d) => Number(v || 0).toLocaleString('he-IL', { maximumFractionDigits: d == null ? 0 : d });
  const pct = (v, d) => (v == null || !isFinite(v) ? '—' : (Math.round(v * 100 * (d ? 10 : 1)) / (d ? 10 : 1)).toLocaleString('he-IL') + '%');
  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const mName = (ym) => ym ? MONTHS[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(2, 4) : '';
  const ymOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const addM = (ym, k) => { const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + k, 1); return ymOf(d); };
  const monthsBetween = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
  const FIRST = '2025-10';   // the first month of the sales history

  // the groups — the shares of the sales before the product (see the header)
  const G = [
    { k: 'A', name: 'רבי מכר', to: 0.70, c: '#15803d', bg: '#dcfce7', tip: 'לנהל כ-VIP: לא לחסור במלאי, מיקום טוב' },
    { k: 'B', name: 'חזקים', to: 0.90, c: '#65a30d', bg: '#ecfccb', tip: 'מוצרים יציבים — לשמור' },
    { k: 'C', name: 'הבסיס הרחב', to: 0.965, c: '#ca8a04', bg: '#fef9c3', tip: 'משלימים את הסל — לבדוק כפילויות' },
    { k: 'D', name: 'חלשים', to: 0.992, c: '#ea580c', bg: '#ffedd5', tip: 'לשיקול דעת — מה שלא מוגן' },
    { k: 'E', name: 'דלי מכר', to: 1.01, c: '#dc2626', bg: '#fee2e2', tip: 'מועמדים לצמצום — מה שלא מוגן' }];
  const GK = Object.fromEntries(G.map((g) => [g.k, g]));
  const PROT = { new: '🆕 חדש', margin: '💰 רווחי', only: '🧩 יחיד בקבוצה', fresh: '🥬 טרי / עונתי' };
  const FRESH_DEPS = [60, 601, 61, 62];   // fruit & vegetables, butcher, fish — seasonal and weighed: judged by hand
  const share = (v) => !v ? '0%' : v < 0.0001 ? '<0.01%' : (Math.round(v * 10000) / 100).toLocaleString('he-IL') + '%';

  const P = { from: '', to: '', dep: '' };
  let D = null, W = null, tab = 'cut', search = '', limit = 200, charts = [];

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#asOv{position:fixed;inset:0;z-index:9000;background:#f1f5f9;overflow:auto;direction:rtl;font-family:inherit}#asOv.hidden{display:none}' +
    '#asOv table.sd-tbl{min-width:0}' +
    '.as-top{position:sticky;top:0;z-index:2;background:linear-gradient(120deg,#0f172a,#1e3a8a 55%,#15803d);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 4px 16px rgba(15,23,42,.25)}' +
    '.as-top h2{margin:0;font-size:19px;font-weight:900}.as-top .sub{font-size:12px;opacity:.85}.as-top .sp{flex:1}' +
    '.as-top button{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:10px;padding:6px 12px;font:inherit;font-weight:700;cursor:pointer}' +
    '.as-wrap{max-width:1280px;margin:0 auto;padding:14px 16px 40px}' +
    '.as-verdict{border-radius:16px;padding:14px 16px;background:#fff;border-right:6px solid #15803d;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:12px;line-height:1.6}' +
    '.as-verdict b.h{font-size:16px}.as-opp{background:linear-gradient(135deg,#fff,#fef2f2);border:1.5px solid #fecaca}' +
    '.as-opp .big{font-size:34px;font-weight:900;color:#dc2626;letter-spacing:-1px}' +
    '.as-g{display:inline-flex;align-items:center;gap:5px;border-radius:99px;padding:1px 9px;font-size:12px;font-weight:800;white-space:nowrap}' +
    '.as-p{display:inline-block;border-radius:99px;padding:0 7px;font-size:11.5px;font-weight:700;background:#e0f2fe;color:#075985;margin-inline-start:3px;white-space:nowrap}' +
    '.as-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px}' +
    '.as-tabs button{border:1.5px solid #cbd5e1;background:#fff;color:#334155;border-radius:99px;padding:5px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}' +
    '.as-tabs button.on{background:#1e3a8a;color:#fff;border-color:#1e3a8a}' +
    '.as-search{border:1.5px solid #cbd5e1;border-radius:10px;padding:6px 10px;font:inherit;font-size:13px;min-width:200px}' +
    '.as-rule{font-size:12.5px;color:#475569;line-height:1.7}' +
    '.as-more{display:block;margin:10px auto 0;border:1.5px solid #cbd5e1;background:#fff;border-radius:10px;padding:6px 16px;font:inherit;font-weight:700;cursor:pointer}' +
    '@media (max-width:760px){#asOv .o{display:none}.as-opp .big{font-size:28px}}' +
    '</style>');

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }

  /* ================= open / load ================= */
  function open() {
    if (!isAdmin()) return;
    if (!$('asOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="asOv" class="hidden"><div class="as-top"><div><h2>🎯 אופטימיזציית מגוון</h2>' +
        '<div class="sub">מבט אחד על בריאות המגוון — מה מחזיק את החנות ומה רק תופס מדף</div></div>' +
        '<span class="sp"></span><button id="asXls">⬇ אקסל</button><button id="asClose">✕ סגירה</button></div><div class="as-wrap" id="asBody"></div></div>');
      $('asClose').addEventListener('click', close);
      $('asXls').addEventListener('click', () => exportXlsx().catch((er) => alert('הייצוא נכשל: ' + (er && er.message || er))));
    }
    if (!P.from) { const last = addM(ymOf(new Date()), -1); P.to = last; P.from = addM(last, -2); }
    $('asOv').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    load();
  }
  function close() { $('asOv').classList.add('hidden'); document.body.style.overflow = ''; }

  async function load() {
    $('asBody').innerHTML = '<div class="sd-empty">טוען את נתוני המכירות…</div>';
    const r = await apiPost({ action: 'biAssortment', ...mAuth(), fromMonth: P.from, toMonth: P.to, dep: P.dep }).catch(() => ({ ok: false, error: 'אין חיבור' }));
    if (!r || !r.ok) { $('asBody').innerHTML = '<div class="sd-empty">' + e((r && r.error) || 'שגיאה') + '</div>'; return; }
    D = r; W = compute(r); limit = 200;
    render();
  }

  /* ================= the classification ================= */
  function compute(r) {
    const names = { dep: {}, grp: {}, spk: {} };
    (r.names || []).forEach(([k, c, n]) => { if (names[k]) names[k][c] = n; });
    const months = monthsBetween(r.from, r.to) + 1;
    const items = (r.items || []).map((a) => {
      const it = { barcode: a[0], name: a[1], dep: a[2], grp: a[3], spk: a[4], qty: +a[5] || 0, sales: +a[6] || 0, net: +a[7] || 0, cost: +a[8] || 0,
        months: a[9] || 0, first: a[10] ? String(a[10]).slice(0, 7) : '', last: a[11] ? String(a[11]).slice(0, 7) : '', stock: a[12], price: +a[13] || 0, ucost: +a[14] || 0, weighed: !!a[15] };
      it.profit = it.cost > 0 && it.net > 0 ? it.net - it.cost : null;
      it.margin = it.profit != null ? it.profit / it.net : null;
      if (it.margin != null && (it.margin < -0.5 || it.margin > 0.9)) { it.profit = null; it.margin = null; }   // a broken cost in Comax
      return it;
    }).sort((a, b) => b.sales - a.sales);
    const total = items.reduce((s, x) => s + x.sales, 0) || 1;
    let cum = 0;
    items.forEach((it) => { it.share = it.sales / total; const before = cum / total; cum += it.sales; it.g = G.find((g) => before < g.to).k; });
    // the department margin (products with a believable cost)
    const dm = {};
    items.forEach((it) => { if (it.profit == null) return; const d = dm[it.dep] || (dm[it.dep] = { p: 0, n: 0 }); d.p += it.profit; d.n += it.net; });
    const grpCount = {};
    items.forEach((it) => { if (it.grp) grpCount[it.grp] = (grpCount[it.grp] || 0) + 1; });
    items.forEach((it) => {
      it.prot = [];
      if (it.g !== 'D' && it.g !== 'E') return;
      if (it.first && monthsBetween(it.first, r.to) < 2 && it.first > FIRST) it.prot.push('new');
      const d = dm[it.dep];
      if (it.margin != null && d && d.n > 0 && it.margin >= Math.max(d.p / d.n + 0.15, 0.35)) it.prot.push('margin');
      if (it.grp && grpCount[it.grp] === 1) it.prot.push('only');
      if (it.weighed || FRESH_DEPS.includes(Number(it.dep))) it.prot.push('fresh');
      it.act = it.prot.length ? 'protected' : it.g === 'E' ? 'cut' : 'consider';
    });
    const dead = (r.dead || []).map((a) => ({ barcode: a[0], name: a[1], dep: a[2], grp: a[3], spk: a[4], stock: +a[5] || 0, ucost: +a[6] || 0, price: +a[7] || 0,
      last: a[8] ? String(a[8]).slice(0, 7) : '', value: (+a[5] || 0) * (+a[6] || 0) })).sort((a, b) => b.value - a.value);
    const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
    const groups = G.map((g) => { const xs = items.filter((x) => x.g === g.k);
      return { ...g, items: xs.length, sales: sum(xs, (x) => x.sales), profit: sum(xs, (x) => x.profit), stockVal: sum(xs, (x) => x.stock > 0 && !x.weighed ? x.stock * x.ucost : 0) }; });
    const cut = items.filter((x) => x.act === 'cut'), consider = items.filter((x) => x.act === 'consider'), prot = items.filter((x) => x.act === 'protected');
    let c80 = 0, a80 = 0; for (const it of items) { if (a80 >= 0.8 * total) break; a80 += it.sales; c80++; }
    const deps = {};
    const dOf = (k) => deps[k] || (deps[k] = { dep: k, name: names.dep[k] || (k == null ? 'ללא מחלקה' : 'מחלקה ' + k), items: 0, sales: 0, A: 0, cut: 0, consider: 0, cutSales: 0, dead: 0, deadVal: 0 });
    items.forEach((it) => { const d = dOf(it.dep); d.items++; d.sales += it.sales; if (it.g === 'A') d.A++; if (it.act === 'cut') { d.cut++; d.cutSales += it.sales; } if (it.act === 'consider') d.consider++; });
    dead.forEach((x) => { const d = dOf(x.dep); d.dead++; d.deadVal += x.value; });
    const profitAll = sum(items, (x) => x.profit), netWithCost = sum(items, (x) => x.profit != null ? x.net : 0);
    return { names, months, items, total, groups, cut, consider, prot, dead, c80, deps: Object.values(deps).sort((a, b) => b.sales - a.sales),
      cutSales: sum(cut, (x) => x.sales), cutStock: sum(cut, (x) => x.stock > 0 && !x.weighed ? x.stock * x.ucost : 0), considerSales: sum(consider, (x) => x.sales),
      deadVal: sum(dead, (x) => x.value), margin: netWithCost > 0 ? profitAll / netWithCost : null };
  }

  /* ================= render ================= */
  function render() {
    charts.forEach((c) => c.destroy()); charts = [];
    const w = W, r = D;
    const depOpts = '<option value="">כל המחלקות</option>' + Object.entries(w.names.dep).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'he'))
      .map(([c, n]) => '<option value="' + c + '"' + (String(P.dep) === c ? ' selected' : '') + '>' + e(n) + '</option>').join('');
    const cur = ymOf(new Date()); const mOpts = (sel) => { let h = '', m = cur; while (m >= FIRST) { h += '<option value="' + m + '"' + (m === sel ? ' selected' : '') + '>' + mName(m) + '</option>'; m = addM(m, -1); } return h; };
    const last = addM(cur, -1);
    const preset = (k, f, t, lab) => '<button class="sd-chip' + (P.from === f && P.to === t ? ' on' : '') + '" data-f="' + f + '" data-t="' + t + '">' + lab + '</button>';
    const bar = '<div class="sd-bar" id="asBar">' + preset('1', last, last, 'חודש קודם') + preset('3', addM(last, -2), last, '3 חודשים') + preset('6', addM(last, -5), last, '6 חודשים') +
      preset('12', addM(last, -11) < FIRST ? FIRST : addM(last, -11), last, '12 חודשים') +
      '<span style="margin-inline-start:6px">מ-</span><select id="asFrom">' + mOpts(P.from) + '</select><span>עד</span><select id="asTo">' + mOpts(P.to) + '</select>' +
      '<select id="asDep">' + depOpts + '</select></div>';
    const per = r.from === r.to ? mName(r.from) : mName(r.from) + ' – ' + mName(r.to);
    const partial = r.to === cur ? '<div class="sd-warn">החודש הנוכחי עדיין לא נגמר — מוצרים שנמכרים לאט ייראו חלשים מהמציאות. עדיף לבחור חודשים שלמים.</div>' : '';
    const k80 = w.items.length ? w.c80 / w.items.length : 0;
    const verdict = '<div class="as-verdict" style="border-right-color:' + (w.cut.length / Math.max(w.items.length, 1) > 0.25 ? '#dc2626' : '#15803d') + '">' +
      '<b class="h">בשורה התחתונה · ' + e(per) + (P.dep ? ' · ' + e(w.names.dep[P.dep] || '') : '') + '</b><br>' +
      '<b>' + num(w.c80) + '</b> מוצרים (' + pct(k80, 1) + ' מהמגוון) מביאים 80% מהמכירות. ' +
      '<b>' + num(w.cut.length) + '</b> מוצרים מביאים יחד רק ' + pct(w.cutSales / w.total, 1) + ' מהמכירות ואינם מוגנים — מועמדים לצמצום. ' +
      (w.dead.length ? 'ועוד <b>' + num(w.dead.length) + '</b> מוצרים עם מלאי שלא נמכרו בכלל בתקופה (' + nis(w.deadVal) + ' בעלות).' : '') +
      '</div>';
    const kpi = (cls, ic, l, v, d) => '<div class="sd-kpi" style="background:' + cls + '"><div class="ic">' + ic + '</div><div class="l">' + l + '</div><div class="v">' + v + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div>';
    const kpis = '<div class="sd-kpis">' +
      kpi('linear-gradient(135deg,#1e40af,#3b82f6)', '₪', 'מכירות בתקופה (כולל מע"מ)', nis(w.total), w.months + ' חודשים · ' + nis(w.total / w.months) + ' לחודש') +
      kpi('linear-gradient(135deg,#6d28d9,#a855f7)', '📦', 'מוצרים שנמכרו', num(w.items.length), nis(w.total / Math.max(w.items.length, 1)) + ' למוצר') +
      kpi('linear-gradient(135deg,#047857,#10b981)', '🎯', 'מוצרים שעושים 80%', num(w.c80), pct(k80, 1) + ' מהמגוון') +
      kpi('linear-gradient(135deg,#b91c1c,#f87171)', '✂', 'מומלצים לצמצום', num(w.cut.length), pct(w.cutSales / w.total, 2) + ' מהמכירות') +
      kpi('linear-gradient(135deg,#78350f,#d97706)', '🧊', 'מלאי מת (לא נמכר)', num(w.dead.length), nis(w.deadVal) + ' בעלות') + '</div>';
    const opp = '<div class="sd-card as-opp"><h3>🎯 ההזדמנות הגדולה</h3>' +
      '<div>צמצום <b>' + num(w.cut.length) + '</b> מוצרי דלי מכר שאינם מוגנים — סיכון למכירות:</div>' +
      '<div class="big">' + pct(w.cutSales / w.total, 2) + '</div>' +
      '<div class="as-rule">' + nis(w.cutSales) + ' בתקופה (' + nis(w.cutSales / w.months) + ' לחודש). חלק מזה יעבור למוצרים תחליפיים. ' +
      (w.cutStock > 0 ? 'מלאי שלהם היום: ' + nis(w.cutStock) + ' בעלות. ' : '') + 'בנוסף ' + num(w.consider.length) + ' חלשים לשיקול דעת (' + pct(w.considerSales / w.total, 2) + ' מהמכירות), ו-' +
      num(w.prot.length) + ' חלשים שמוגנים ולא מומלצים להוצאה.</div>' +
      '<div style="margin-top:8px"><button class="sd-chip on" data-go="cut">לרשימה ←</button></div></div>';
    const grpRows = w.groups.map((g) => '<tr class="click" data-go="' + g.k + '" title="' + e(g.tip) + '"><td><span class="as-g" style="background:' + g.bg + ';color:' + g.c + '">● ' + g.name + '</span></td>' +
      '<td class="n">' + num(g.items) + '</td><td class="n">' + pct(g.items / Math.max(w.items.length, 1), 1) + '</td><td class="n"><b>' + pct(g.sales / w.total, 1) + '</b></td>' +
      '<td class="n o">' + nis(g.sales / Math.max(g.items, 1) / w.months) + '</td></tr>').join('');
    const groups = '<div class="sd-card"><h3>חלוקת המוצרים לפי חשיבות <small>לפי חלקם במכירות</small></h3>' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="width:170px;height:170px;margin:auto"><canvas id="asDonut"></canvas></div>' +
      '<div style="flex:1;min-width:260px" class="sd-scroll"><table class="sd-tbl"><tr><th>קבוצה</th><th class="n">מוצרים</th><th class="n">% מוצרים</th><th class="n">% מכירות</th><th class="n o">למוצר בחודש</th></tr>' + grpRows + '</table></div></div></div>';
    const trend = '<div class="sd-card"><h3>📈 ריכוז המכירות לאורך זמן <small>' + (P.dep ? e(w.names.dep[P.dep] || '') : 'כל החנות') + '</small></h3>' +
      '<div style="height:230px"><canvas id="asTrend"></canvas></div>' +
      '<div class="as-rule">הקו: כמה אחוז מהמוצרים שנמכרו בחודש עשו 80% מהמכירות שלו — ככל שהוא גבוה יותר, המגוון "עובד" רחב יותר. העמודות: מכירות החודש. חודשים עם מעט נתונים (לפני שכל הקופות דווחו) מסומנים באפור.</div></div>';
    const depRows = w.deps.filter((d) => d.items || d.dead).map((d) => '<tr class="click" data-dep="' + (d.dep == null ? '' : d.dep) + '"><td>' + e(d.name) + '</td><td class="n">' + num(d.items) + '</td><td class="n">' + nis(d.sales) + '</td>' +
      '<td class="n o">' + pct(d.sales / w.total, 1) + '</td><td class="n o">' + num(d.A) + '</td><td class="n" style="color:#dc2626;font-weight:800">' + (d.cut ? num(d.cut) : '') + '</td>' +
      '<td class="n o">' + (d.consider ? num(d.consider) : '') + '</td><td class="n">' + (d.dead ? num(d.dead) : '') + '</td><td class="n o">' + (d.deadVal ? nis(d.deadVal) : '') + '</td></tr>').join('');
    const depsCard = P.dep ? '' : '<div class="sd-card wide"><h3>🏷 לפי מחלקה <small>לחיצה על מחלקה — הניתוח בתוכה בלבד</small></h3><div class="sd-scroll"><table class="sd-tbl">' +
      '<tr><th>מחלקה</th><th class="n">מוצרים</th><th class="n">מכירות</th><th class="n o">% מהחנות</th><th class="n o">רבי מכר</th><th class="n">לצמצום</th><th class="n o">לשיקול</th><th class="n">מלאי מת</th><th class="n o">שווי מלאי מת</th></tr>' + depRows + '</table></div></div>';
    $('asBody').innerHTML = bar + partial + verdict + kpis + '<div class="sd-grid">' + opp + groups + trend + depsCard + listCard() + rulesCard() + '</div>';
    wire();
    drawCharts();
  }

  function listCard() {
    const w = W;
    const T = [['cut', '✂ מומלץ לצמצום', w.cut.length], ['consider', '🤔 לשיקול', w.consider.length], ['protected', '🛡 חלשים מוגנים', w.prot.length],
      ['dead', '🧊 מלאי מת', w.dead.length], ['A', 'רבי מכר', 0], ['B', 'חזקים', 0], ['C', 'בסיס', 0], ['all', 'הכל', w.items.length]];
    const tabs = '<div class="as-tabs" id="asTabs">' + T.map(([k, l, n]) => '<button data-t="' + k + '"' + (tab === k ? ' class="on"' : '') + '>' + l + (n ? ' · ' + num(n) : '') + '</button>').join('') + '</div>';
    const s = search.trim().toLowerCase();
    const match = (x) => !s || String(x.name || '').toLowerCase().includes(s) || String(x.barcode).includes(s) || String(w.names.spk[x.spk] || '').toLowerCase().includes(s);
    let body;
    if (tab === 'dead') {
      const xs = w.dead.filter(match);
      body = '<table class="sd-tbl"><tr><th>מוצר</th><th class="o">מחלקה</th><th class="o">ספק</th><th class="n">מלאי</th><th class="n">שווי בעלות</th><th class="n o">נמכר לאחרונה</th></tr>' +
        xs.slice(0, limit).map((x) => '<tr><td><b>' + e(x.name) + '</b><div class="as-rule" dir="ltr" style="text-align:right">' + e(x.barcode) + '</div></td><td class="o">' + e(w.names.dep[x.dep] || '') + '</td><td class="o">' + e(w.names.spk[x.spk] || '') + '</td>' +
          '<td class="n">' + num(x.stock, 1) + '</td><td class="n">' + (x.value ? nis(x.value) : '—') + '</td><td class="n o">' + (x.last ? mName(x.last) : 'לא נמכר מאז ' + mName(FIRST)) + '</td></tr>').join('') + '</table>' +
        (xs.length > limit ? '<button class="as-more" id="asMore">עוד ' + num(Math.min(200, xs.length - limit)) + ' מתוך ' + num(xs.length - limit) + '</button>' : '');
    } else {
      const xs = w.items.filter((x) => (tab === 'all' || x.act === tab || x.g === tab) && match(x));
      if (tab === 'cut' || tab === 'consider' || tab === 'protected') xs.sort((a, b) => a.sales - b.sales);
      body = '<table class="sd-tbl"><tr><th>מוצר</th><th class="o">מחלקה</th><th class="o">ספק</th><th class="n">כמות</th><th class="n">מכירות</th><th class="n o">% מהמכירות</th><th class="n o">רווח גולמי</th><th class="n o">חודשים שנמכר</th><th class="n o">מלאי</th><th>סימון</th></tr>' +
        xs.slice(0, limit).map((x) => { const g = GK[x.g];
          return '<tr><td><b>' + e(x.name) + '</b><div class="as-rule" dir="ltr" style="text-align:right">' + e(x.barcode) + '</div></td><td class="o">' + e(w.names.dep[x.dep] || '') + '</td><td class="o">' + e(w.names.spk[x.spk] || '') + '</td>' +
            '<td class="n">' + num(x.qty, x.weighed ? 1 : 0) + '</td><td class="n">' + nis(x.sales) + '</td><td class="n o">' + share(x.share) + '</td>' +
            '<td class="n o">' + (x.margin == null ? '—' : pct(x.margin, 1)) + '</td><td class="n o">' + x.months + '/' + w.months + '</td><td class="n o">' + (x.stock == null ? '' : num(x.stock, 1)) + '</td>' +
            '<td><span class="as-g" style="background:' + g.bg + ';color:' + g.c + '">' + g.name + '</span>' + (x.prot || []).map((p) => '<span class="as-p">' + PROT[p] + '</span>').join('') + '</td></tr>'; }).join('') + '</table>' +
        (xs.length > limit ? '<button class="as-more" id="asMore">עוד ' + num(Math.min(200, xs.length - limit)) + ' מתוך ' + num(xs.length - limit) + '</button>' : '') +
        (!xs.length ? '<div class="sd-empty">אין מוצרים ברשימה</div>' : '');
    }
    return '<div class="sd-card wide" id="asList"><h3>📋 המוצרים <small>' + (tab === 'cut' || tab === 'consider' || tab === 'protected' ? 'מהנמכר פחות' : 'מהנמכר יותר') + '</small>' +
      '<span style="flex:1"></span><input class="as-search" id="asSearch" placeholder="חיפוש: שם, ברקוד או ספק" value="' + e(search) + '"></h3>' + tabs + '<div class="sd-scroll">' + body + '</div></div>';
  }

  function rulesCard() {
    return '<div class="sd-card wide"><h3>ℹ איך זה מחושב</h3><div class="as-rule">' +
      'המוצרים של התקופה ממוינים לפי המכירות (כולל מע"מ). כל מוצר שייך לקבוצה לפי חלק המכירות של המוצרים שלפניו: ' +
      '<b>רבי מכר</b> — עד 70% · <b>חזקים</b> — 70–90% · <b>בסיס רחב</b> — 90–96.5% · <b>חלשים</b> — 96.5–99.2% · <b>דלי מכר</b> — 0.8% האחרונים.<br>' +
      'מוצר חלש או דל מכר <b>מוגן</b> ולא מומלץ להוצאה כש: 🆕 הוא חדש (נמכר פחות מ-3 חודשים) · 💰 הרווח הגולמי שלו לפחות 35% וגבוה ב-15 נקודות לפחות מהממוצע של המחלקה · 🧩 הוא המוצר היחיד שנמכר בתת-הקבוצה שלו בקומקס · 🥬 הוא טרי או שקיל (פירות וירקות, קצביה, דגים) — עונתי, נבדק ידנית.<br>' +
      '<b>מומלץ לצמצום</b> = דלי מכר שאינם מוגנים · <b>לשיקול</b> = חלשים שאינם מוגנים · <b>מלאי מת</b> = מוצרים ארוזים עם מלאי בקומקס שלא נמכרו בכלל בתקופה (השווי לפי עלות לפני מע"מ).<br>' +
      'הרווח הגולמי לפי העלות שבמחירון 108 בקומקס, לפני מע"מ — אצל חלק מהמוצרים היא לא מעודכנת, ולכן הוא רק סימן. המלאי של פירות, ירקות ובשר לא מדויק בקומקס ולא נכלל במלאי המת.<br>' +
      'כדאי לבחור תקופה של 3 חודשים לפחות, ולבדוק מוצרים עונתיים (חגים, קיץ) לפני הוצאה.' +
      (D.lastPush ? '<br>נתונים עדכניים ל-' + new Date(D.lastPush).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) + '.' : '') + '</div></div>';
  }

  function rerenderList() { const el = $('asList'); if (!el) return; const pos = $('asSearch') && $('asSearch').selectionStart; el.outerHTML = listCard(); wireList(); const s = $('asSearch'); if (s && pos != null) { s.focus(); s.setSelectionRange(pos, pos); } }
  function wireList() {
    $('asTabs').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { tab = b.dataset.t; limit = 200; rerenderList(); } });
    $('asSearch').addEventListener('input', (ev) => { search = ev.target.value; limit = 200; rerenderList(); });
    if ($('asMore')) $('asMore').addEventListener('click', () => { limit += 200; rerenderList(); });
  }
  function wire() {
    $('asBar').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-f]'); if (b) { P.from = b.dataset.f; P.to = b.dataset.t; load(); } });
    $('asFrom').addEventListener('change', (ev) => { P.from = ev.target.value; if (P.from > P.to) P.to = P.from; load(); });
    $('asTo').addEventListener('change', (ev) => { P.to = ev.target.value; if (P.from > P.to) P.from = P.to; load(); });
    $('asDep').addEventListener('change', (ev) => { P.dep = ev.target.value; load(); });
    $('asBody').querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', () => { tab = el.dataset.go; limit = 200; rerenderList(); $('asList').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    $('asBody').querySelectorAll('[data-dep]').forEach((el) => el.addEventListener('click', () => { P.dep = el.dataset.dep; load(); }));
    wireList();
  }

  async function drawCharts() {
    try { if (!window.Chart) await loadScript(CHART_URL); } catch (_) { return; }
    if (!$('asDonut')) return;
    charts.push(new window.Chart($('asDonut'), { type: 'doughnut', data: { labels: G.map((g) => g.name), datasets: [{ data: W.groups.map((g) => g.items), backgroundColor: G.map((g) => g.c), borderWidth: 2 }] },
      options: { cutout: '62%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.label + ': ' + num(c.raw) + ' מוצרים' } } } } }));
    const ms = (D.months || []).map((m) => ({ ym: String(m.month).slice(0, 7), sales: +m.sales || 0, items: +m.items || 0, k: +m.items80 || 0 }));
    const max = Math.max(1, ...ms.map((m) => m.sales));
    charts.push(new window.Chart($('asTrend'), { data: { labels: ms.map((m) => mName(m.ym)), datasets: [
      { type: 'line', label: '% מוצרים שעושים 80%', data: ms.map((m) => m.items ? Math.round(m.k / m.items * 1000) / 10 : null), borderColor: '#15803d', backgroundColor: '#15803d', yAxisID: 'y', tension: 0.3,
        segment: { borderDash: (c) => ms[c.p0DataIndex].sales < 0.4 * max ? [4, 4] : undefined } },
      { type: 'bar', label: 'מכירות', data: ms.map((m) => m.sales), backgroundColor: ms.map((m) => m.sales < 0.4 * max ? '#cbd5e1' : 'rgba(59,130,246,.35)'), yAxisID: 'y2' }] },
      options: { maintainAspectRatio: false, plugins: { legend: { rtl: true, position: 'bottom' }, tooltip: { callbacks: { label: (c) => c.dataset.type === 'bar' ? 'מכירות: ' + nis(c.raw) : c.raw + '% · ' + num(ms[c.dataIndex].k) + ' מתוך ' + num(ms[c.dataIndex].items) + ' מוצרים' } } },
        scales: { y: { position: 'right', ticks: { callback: (v) => v + '%' } }, y2: { position: 'left', grid: { display: false }, ticks: { callback: (v) => '₪' + Math.round(v / 1000) + 'K' } } } } }));
  }

  /* ================= Excel ================= */
  let XS = null;
  async function styledXlsx() {
    if (XS) return XS;
    const prev = window.XLSX;
    await loadScript(XS_URL);
    XS = window.XLSX;
    if (prev) window.XLSX = prev;
    return XS;
  }
  const border = { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'F1F5F9' } }, right: { style: 'thin', color: { rgb: 'F1F5F9' } } };
  const font = (o) => ({ name: 'Arial', sz: 11, ...o });
  const FMT = { money: '"₪"#,##0;[Red]-"₪"#,##0', pct: '0.0%;[Red]-0.0%', pct2: '0.00%', n1: '#,##0.0', n0: '#,##0' };
  function sheetOf(X, rows, cols) {
    const ws = {}; let maxC = 0;
    rows.forEach((r, ri) => (r || []).forEach((c, ci) => {
      if (c == null) return;
      const cell = typeof c === 'object' ? c : { v: c };
      const o = { v: cell.v == null ? '' : cell.v, t: typeof cell.v === 'number' ? 'n' : 's', s: { font: font(cell.f || {}), alignment: { horizontal: 'right', vertical: 'center', wrapText: !!cell.wrap, readingOrder: 2 }, ...(cell.s || {}) } };
      if (cell.z) o.z = o.s.numFmt = cell.z;
      ws[X.utils.encode_cell({ r: ri, c: ci })] = o; maxC = Math.max(maxC, ci);
    }));
    ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length - 1, 0), c: maxC } });
    ws['!cols'] = cols.map((w) => ({ wch: w }));
    ws['!views'] = [{ RTL: true }];
    return ws;
  }
  const H = (v) => ({ v, f: { bold: true, color: { rgb: 'FFFFFF' } }, s: { fill: { fgColor: { rgb: '1E3A8A' } }, border } });
  const N = (v, z, s) => ({ v: v == null || !isFinite(v) ? '' : v, z, s: { border, ...(s || {}) } });
  const T = (v, s) => ({ v: v == null ? '' : String(v), s: { border, ...(s || {}) } });
  const hex = (c) => c.replace('#', '').toUpperCase();
  async function exportXlsx() {
    if (!W) return;
    const X = await styledXlsx(), w = W, r = D;
    const per = r.from === r.to ? mName(r.from) : mName(r.from) + ' עד ' + mName(r.to);
    const wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
    const S = [[{ v: 'אופטימיזציית מגוון — ' + per + (P.dep ? ' — ' + (w.names.dep[P.dep] || '') : ''), f: { bold: true, sz: 16, color: { rgb: '1E3A8A' } } }], [],
      [H('מדד'), H('ערך')],
      [T('מכירות בתקופה (כולל מע"מ)'), N(w.total, FMT.money)], [T('מוצרים שנמכרו'), N(w.items.length, FMT.n0)],
      [T('מוצרים שעושים 80% מהמכירות'), N(w.c80, FMT.n0)], [T('מומלצים לצמצום'), N(w.cut.length, FMT.n0)], [T('המכירות שלהם'), N(w.cutSales, FMT.money)],
      [T('% מהמכירות'), N(w.cutSales / w.total, FMT.pct2)], [T('לשיקול'), N(w.consider.length, FMT.n0)], [T('חלשים מוגנים'), N(w.prot.length, FMT.n0)],
      [T('מלאי מת — מוצרים'), N(w.dead.length, FMT.n0)], [T('מלאי מת — שווי בעלות'), N(w.deadVal, FMT.money)], [],
      [H('קבוצה'), H('מוצרים'), H('% מוצרים'), H('מכירות'), H('% מכירות')]]
      .concat(w.groups.map((g) => [T(g.name, { fill: { fgColor: { rgb: hex(g.bg) } }, font: font({ bold: true, color: { rgb: hex(g.c) } }) }), N(g.items, FMT.n0), N(g.items / Math.max(w.items.length, 1), FMT.pct), N(g.sales, FMT.money), N(g.sales / w.total, FMT.pct)]));
    X.utils.book_append_sheet(wb, sheetOf(X, S, [34, 14, 12, 14, 12]), 'סיכום');
    const head = ['ברקוד', 'מוצר', 'מחלקה', 'ספק', 'קבוצה', 'מוגן', 'כמות', 'מכירות', '% מהמכירות', 'רווח גולמי %', 'חודשים שנמכר', 'מלאי'];
    const itemRows = (xs) => [head.map(H)].concat(xs.map((x) => { const g = GK[x.g]; return [T(x.barcode), T(x.name), T(w.names.dep[x.dep] || ''), T(w.names.spk[x.spk] || ''),
      T(g.name, { fill: { fgColor: { rgb: hex(g.bg) } }, font: font({ bold: true, color: { rgb: hex(g.c) } }) }), T((x.prot || []).map((p) => PROT[p].replace(/^\S+\s/, '')).join(', ')),
      N(x.qty, FMT.n1), N(x.sales, FMT.money), N(x.share, FMT.pct2), N(x.margin, FMT.pct), N(x.months, FMT.n0), N(x.stock, FMT.n1)]; }));
    const cols = [16, 34, 16, 20, 12, 18, 10, 12, 11, 11, 10, 9];
    const asc = (xs) => xs.slice().sort((a, b) => a.sales - b.sales);
    X.utils.book_append_sheet(wb, sheetOf(X, itemRows(asc(w.cut)), cols), 'מומלץ לצמצום');
    X.utils.book_append_sheet(wb, sheetOf(X, itemRows(asc(w.consider)), cols), 'לשיקול');
    X.utils.book_append_sheet(wb, sheetOf(X, itemRows(asc(w.prot)), cols), 'חלשים מוגנים');
    X.utils.book_append_sheet(wb, sheetOf(X, [['ברקוד', 'מוצר', 'מחלקה', 'ספק', 'מלאי', 'עלות ליחידה', 'שווי בעלות', 'נמכר לאחרונה'].map(H)].concat(w.dead.map((x) =>
      [T(x.barcode), T(x.name), T(w.names.dep[x.dep] || ''), T(w.names.spk[x.spk] || ''), N(x.stock, FMT.n1), N(x.ucost, '"₪"#,##0.00'), N(x.value, FMT.money), T(x.last ? mName(x.last) : '—')])), [16, 34, 16, 20, 10, 12, 12, 14]), 'מלאי מת');
    X.utils.book_append_sheet(wb, sheetOf(X, itemRows(w.items), cols), 'כל המוצרים');
    X.writeFile(wb, 'אופטימיזציית מגוון ' + per.replace(/\s/g, ' ') + '.xlsx');
  }

  function start() {
    const drop = $('menuAdminDrop');
    if (drop && !$('asMgrBtn')) {
      const anchor = $('miMgrBtn') || $('sdMgrBtn');
      const html = '<button id="asMgrBtn" style="display:none">🎯 אופטימיזציית מגוון</button>';
      if (anchor) anchor.insertAdjacentHTML('afterend', html); else drop.insertAdjacentHTML('afterbegin', html);
      $('asMgrBtn').addEventListener('click', open);
      const show = () => { $('asMgrBtn').style.display = isAdmin() ? '' : 'none'; };
      $('menuAdminBtn')?.addEventListener('click', show, true);
      show();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openAssortment = open;
  window._asCompute = compute;   // tests
})();
