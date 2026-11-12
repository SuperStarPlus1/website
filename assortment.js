// 🎯 אופטימייזר מגוון (11/11/2026, the owner — after an Excel "FAST FOCUS" dashboard, and laid out like it). Admin only:
// ⚙ אדמין ← 🎯 אופטימייזר מגוון. Full screen. The health of the product mix (SKU) and its effect on the business.
// Data: api biAssortment (sales-bi.ts → bi_assortment, migrations 20261111100000 + 20261111140000 + 20261112130000) — whole months of
// bi_month_item. The rules are here (so the screen can show them):
//   active SKU = a barcode sold in the period that is still carried: it sold in the period's last month, or it has
//     stock in Comax (packaged). Sold in the period but neither → "יצאו מהמדף" (counted apart, not ranked)
//     12/11/2026: an SKU moved to Comax's archive (Prt_Del → bi_products.archived, migration 20261112130000) is out
//     at once (🗄), and the MQI card shows the last MQI after the archive (the productive share without them)
//   the ranking (ABC by the share of the sales before the SKU): רבי מכר – VIP < 70% · חזקים טובים 70–90% ·
//     הבסיס הרחב 90–96.5% · חלשים – לשיקול דעת 96.5–99.2% · דלי-מכר – לצמצום the last 0.8%
//   a weak / slow SKU is protected (never recommended out) when new (< 3 months), profitable (gross margin ≥ 35% and
//     15 points over its department), the only one sold in its Comax sub-group, or fresh / weighed (seasonal)
//   cut = slow movers not protected · consider = weak ones not protected
//   MQI — מדד יעילות מסחרית, per whole month, 0–100: 50% productive SKUs (sold ≥ 20% of their department's average
//     per SKU) + 30% continuity (also sold the month before) + 20% gross margin against a 25% target (cost = Comax
//     list 108; without a cost the other two). A month counts only when it and the month before have full data
//   simulator: cut the weakest X% of the active SKUs (by default without the protected) → the sales / profit at risk,
//     the stock freed, the MQI after (the productive share without them)
//   dead stock = packaged products with stock and no sale in the period (value at cost, before VAT)
// Uses the app's globals: apiPost, mgrAuth, state; the sd-* styles of sales-dash.js. Charts: Chart.js (cdnjs);
// Excel: /vendor/xlsx-js-style.
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
  const nisM = (v) => { v = Number(v || 0); return Math.abs(v) >= 1e6 ? '₪' + (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e4 ? '₪' + Math.round(v / 1e3) + 'K' : nis(v); };
  const num = (v, d) => Number(v || 0).toLocaleString('he-IL', { maximumFractionDigits: d == null ? 0 : d });
  const pct = (v, d) => (v == null || !isFinite(v) ? '—' : (Math.round(v * 100 * (d ? 10 ** d : 1)) / (d ? 10 ** d : 1)).toLocaleString('he-IL') + '%');
  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const mName = (ym) => ym ? MONTHS[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(2, 4) : '';
  const mShort = (ym) => ym ? MONTHS[Number(ym.slice(5, 7)) - 1] : '';
  const ymOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const addM = (ym, k) => { const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + k, 1); return ymOf(d); };
  const monthsBetween = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
  const FIRST = '2025-10';   // the first month of the sales history

  // the ranking — the shares of the sales before the SKU (see the header)
  const G = [
    { k: 'A', name: 'רבי מכר – לניהול VIP', short: 'רבי מכר VIP', to: 0.70, c: '#15803d', bg: '#dcfce7', tip: 'לא לחסור במלאי, מיקום טוב במדף' },
    { k: 'B', name: 'חזקים טובים', short: 'חזקים טובים', to: 0.90, c: '#84cc16', bg: '#ecfccb', tip: 'מוצרים יציבים — לשמור' },
    { k: 'C', name: 'הבסיס הרחב', short: 'הבסיס הרחב', to: 0.965, c: '#eab308', bg: '#fef9c3', tip: 'משלימים את הסל — לבדוק כפילויות' },
    { k: 'D', name: 'חלשים – לשיקול דעת', short: 'חלשים', to: 0.992, c: '#f97316', bg: '#ffedd5', tip: 'לבדוק אחד-אחד — מה שלא מוגן' },
    { k: 'E', name: 'דלי-מכר – לצמצום מיידי', short: 'דלי-מכר', to: 1.01, c: '#dc2626', bg: '#fee2e2', tip: 'מועמדים להוצאה — מה שלא מוגן' }];
  const GK = Object.fromEntries(G.map((g) => [g.k, g]));
  const PROT = { new: '🆕 חדש', margin: '💰 רווחי', only: '🧩 יחיד בקבוצה', fresh: '🥬 טרי / עונתי' };
  const FRESH_DEPS = [60, 601, 61, 62];   // fruit & vegetables, butcher, fish — seasonal and weighed: judged by hand
  const share = (v) => !v ? '0%' : v < 0.0001 ? '<0.01%' : (Math.round(v * 10000) / 100).toLocaleString('he-IL') + '%';
  // MQI — the weights and the rating
  const MQ = { prod: 0.5, cont: 0.3, margin: 0.2, marginTarget: 0.25 };
  const RATE = [[80, 'מצוין', '#15803d'], [70, 'טוב מאוד', '#16a34a'], [60, 'טוב', '#65a30d'], [50, 'בינוני', '#ca8a04'], [-1, 'דורש טיפול', '#dc2626']];
  const rateOf = (v) => RATE.find((r) => v >= r[0]);

  const P = { from: '', to: '', dep: '' };
  const SIM = { pct: 20, prot: true };
  let D = null, W = null, tab = 'cut', search = '', limit = 200, charts = [];

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#asOv{position:fixed;inset:0;z-index:9000;background:#eef2f7;overflow:auto;direction:rtl;font-family:inherit}#asOv.hidden{display:none}' +
    '#asOv table.sd-tbl{min-width:0}' +
    '.ff-top{position:sticky;top:0;z-index:3;background:#0b1530;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 4px 16px rgba(15,23,42,.3)}' +
    '.ff-top .t{flex:1;text-align:center;min-width:220px}.ff-top h2{margin:0;font-size:22px;font-weight:900;letter-spacing:-.3px}' +
    '.ff-top h2 .acc{color:#bef264}.ff-top .sub{font-size:12.5px;opacity:.85;margin-top:1px}' +
    '.ff-pill{background:#fff;color:#0b1530;border-radius:10px;padding:6px 12px;font-weight:800;font-size:13px;white-space:nowrap;border:0;font-family:inherit}' +
    '.ff-top button{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:10px;padding:6px 12px;font:inherit;font-weight:700;cursor:pointer}' +
    '.ff-wrap{max-width:1320px;margin:0 auto;padding:14px 16px 40px}' +
    '.ff-row{display:grid;gap:12px;margin-bottom:12px}.ff-r1{grid-template-columns:1.15fr 1fr 1fr 1fr}.ff-r2{grid-template-columns:1fr 1.25fr 1.25fr}.ff-r3{grid-template-columns:1.25fr 1fr}' +
    '@media (max-width:1100px){.ff-r1{grid-template-columns:1fr 1fr}.ff-r2,.ff-r3{grid-template-columns:1fr}}@media (max-width:560px){.ff-r1{grid-template-columns:1fr}}' +
    '.ff-c{background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,.07);border:1px solid #e2e8f0;display:flex;flex-direction:column;min-width:0;overflow:hidden}' +
    '.ff-c .in{padding:12px 14px;flex:1;display:flex;flex-direction:column;gap:4px}' +
    '.ff-c h3{margin:0;font-size:15.5px;font-weight:900;color:#0b1530;display:flex;align-items:center;gap:7px;flex-wrap:wrap}.ff-c h3 small{font-weight:600;color:#64748b;font-size:12px}' +
    '.ff-kt{font-size:15px;font-weight:900;text-align:center}.ff-kv{font-size:40px;font-weight:900;text-align:center;letter-spacing:-1px;line-height:1.15;font-variant-numeric:tabular-nums}' +
    '.ff-ks{text-align:center;font-size:13px;color:#334155;font-weight:700}.ff-kd{text-align:center;font-size:12px;font-weight:800}' +
    '.ff-go{display:block;width:100%;border:0;border-top:1px solid #e2e8f0;background:#f8fafc;color:#1e40af;font:inherit;font-weight:800;font-size:13px;padding:7px;cursor:pointer}.ff-go:hover{background:#eef2ff}' +
    '.ff-bl .hd{background:#15803d;color:#fff;text-align:center;font-weight:900;font-size:16px;padding:8px}' +
    '.ff-bl .ok{display:flex;align-items:center;justify-content:center;gap:10px;font-size:19px;font-weight:900;color:#0b1530;margin-top:6px}' +
    '.ff-bl .ok i{font-style:normal;display:inline-flex;width:34px;height:34px;border-radius:50%;color:#fff;align-items:center;justify-content:center;font-size:19px}' +
    '.ff-tag{display:inline-block;background:#f1f5f9;color:#475569;border-radius:99px;padding:2px 10px;font-size:11.5px;font-weight:700;margin:4px auto 0}' +
    '.ff-opp .big{font-size:46px;font-weight:900;color:#dc2626;text-align:center;letter-spacing:-1px;line-height:1.1}' +
    '.ff-btn{display:block;width:100%;background:#4d9e1f;color:#fff;border:0;border-radius:10px;padding:10px;font:inherit;font-weight:900;font-size:15px;cursor:pointer;margin-top:auto}.ff-btn:hover{background:#3f8a17}' +
    '.ff-g{display:inline-flex;align-items:center;gap:5px;border-radius:99px;padding:1px 9px;font-size:12px;font-weight:800;white-space:nowrap}' +
    '.ff-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-inline-end:6px;vertical-align:-1px}' +
    '.ff-p{display:inline-block;border-radius:99px;padding:0 7px;font-size:11.5px;font-weight:700;background:#e0f2fe;color:#075985;margin-inline-start:3px;white-space:nowrap}' +
    '.ff-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:6px}' +
    '.ff-tabs button{border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:8px 8px 0 0;padding:5px 11px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}' +
    '.ff-tabs button.on{background:#0b1530;color:#fff;border-color:#0b1530}' +
    '.ff-search{border:1.5px solid #cbd5e1;border-radius:10px;padding:6px 10px;font:inherit;font-size:13px;min-width:200px}' +
    '.ff-rule{font-size:12.5px;color:#475569;line-height:1.7}' +
    '.ff-more{display:block;margin:10px auto 0;border:1.5px solid #cbd5e1;background:#fff;border-radius:10px;padding:6px 16px;font:inherit;font-weight:700;cursor:pointer}' +
    '.ff-sim{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:6px}' +
    '.ff-sim div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px}.ff-sim .l{font-size:12px;color:#64748b;font-weight:700}.ff-sim .v{font-size:20px;font-weight:900;color:#0b1530}' +
    '.ff-act{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}' +
    '.ff-act li{display:flex;gap:10px;align-items:flex-start;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;cursor:pointer;line-height:1.5;font-size:13.5px}.ff-act li:hover{background:#eef2ff}' +
    '.ff-act li b.n{flex:none;width:24px;height:24px;border-radius:50%;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px}' +
    '#asOv input[type=range]{width:100%;accent-color:#4d9e1f}' +
    '@media (max-width:760px){.ff-sim{grid-template-columns:repeat(2,minmax(0,1fr))}#asOv .o{display:none}.ff-kv{font-size:32px}.ff-opp .big{font-size:36px}.ff-top h2{font-size:18px}}' +
    '</style>');

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }

  /* ================= open / load ================= */
  function open() {
    if (!isAdmin()) return;
    if (!$('asOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="asOv" class="hidden"><div class="ff-top"><span class="ff-pill" id="asPer"></span>' +
        '<div class="t"><h2>🎯 אופטימייזר <span class="acc">מגוון</span></h2><div class="sub">מבט אחד על בריאות התמהיל והשפעה על העסק</div></div>' +
        '<span class="ff-pill" id="asScope">🏪 החנות שלי</span><button id="asXls">⬇ אקסל</button><button id="asClose">✕ סגירה</button></div><div class="ff-wrap" id="asBody"></div></div>');
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

  /* ================= MQI per month ================= */
  function mqiMonths(list) {
    const ms = (list || []).map((m) => ({ ym: String(m.month).slice(0, 7), sales: +m.sales || 0, items: +m.items || 0, k80: +m.items80 || 0,
      prod: +m.productive || 0, cont: +m.cont || 0, net: +m.mnet || 0, profit: +m.mprofit || 0 }));
    const max = Math.max(1, ...ms.map((m) => m.sales));
    ms.forEach((m, i) => {
      m.full = m.sales >= 0.4 * max;
      const prev = ms[i - 1];
      m.valid = m.full && !!prev && prev.full && prev.ym === addM(m.ym, -1) && m.items > 0;
      m.pProd = m.items ? m.prod / m.items : 0;
      m.pCont = m.items ? m.cont / m.items : 0;
      m.margin = m.net > 0 ? m.profit / m.net : null;
      const ms_ = m.margin == null ? null : Math.max(0, Math.min(1, m.margin / MQ.marginTarget));
      m.mqi = m.valid ? Math.round(1000 * (ms_ == null ? (MQ.prod * m.pProd + MQ.cont * m.pCont) / (MQ.prod + MQ.cont)
        : MQ.prod * m.pProd + MQ.cont * m.pCont + MQ.margin * ms_)) / 10 : null;
    });
    return ms;
  }

  /* ================= the classification ================= */
  function compute(r) {
    const names = { dep: {}, grp: {}, spk: {} };
    (r.names || []).forEach(([k, c, n]) => { if (names[k]) names[k][c] = n; });
    const months = monthsBetween(r.from, r.to) + 1;
    const all = (r.items || []).map((a) => {
      const it = { barcode: a[0], name: a[1], dep: a[2], grp: a[3], spk: a[4], qty: +a[5] || 0, sales: +a[6] || 0, net: +a[7] || 0, cost: +a[8] || 0,
        months: a[9] || 0, first: a[10] ? String(a[10]).slice(0, 7) : '', last: a[11] ? String(a[11]).slice(0, 7) : '', stock: a[12], price: +a[13] || 0, ucost: +a[14] || 0, weighed: !!a[15], arc: a[16] ? String(a[16]).slice(0, 10) : '' };
      it.profit = it.cost > 0 && it.net > 0 ? it.net - it.cost : null;
      it.margin = it.profit != null ? it.profit / it.net : null;
      if (it.margin != null && (it.margin < -0.5 || it.margin > 0.9)) { it.profit = null; it.margin = null; }   // a broken cost in Comax
      it.onShelf = it.last === r.to || (!it.weighed && Number(it.stock) > 0);
      it.active = it.onShelf && !it.arc;   // 12/11/2026: moved to Comax's archive → out at once
      return it;
    }).sort((a, b) => b.sales - a.sales);
    const items = all.filter((x) => x.active), gone = all.filter((x) => !x.active);
    const total = items.reduce((s, x) => s + x.sales, 0) || 1;
    let cum = 0;
    items.forEach((it) => { it.share = it.sales / total; const before = cum / total; cum += it.sales; it.g = G.find((g) => before < g.to).k; });
    // the department margin (SKUs with a believable cost) and average sales per SKU
    const dm = {};
    items.forEach((it) => { const d = dm[it.dep] || (dm[it.dep] = { p: 0, n: 0, s: 0, c: 0 }); d.s += it.sales; d.c++; if (it.profit == null) return; d.p += it.profit; d.n += it.net; });
    items.forEach((it) => { const d = dm[it.dep]; it.productive = it.sales >= 0.2 * d.s / d.c; });
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
      last: a[8] ? String(a[8]).slice(0, 7) : '', arc: a[9] ? String(a[9]).slice(0, 10) : '', value: (+a[5] || 0) * (+a[6] || 0) })).sort((a, b) => b.value - a.value);
    const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
    const stockVal = (x) => x.stock > 0 && !x.weighed ? x.stock * x.ucost : 0;
    const groups = G.map((g) => { const xs = items.filter((x) => x.g === g.k);
      return { ...g, items: xs.length, sales: sum(xs, (x) => x.sales), profit: sum(xs, (x) => x.profit), stockVal: sum(xs, stockVal) }; });
    const cut = items.filter((x) => x.act === 'cut'), consider = items.filter((x) => x.act === 'consider'), prot = items.filter((x) => x.act === 'protected');
    let c80 = 0, a80 = 0; for (const it of items) { if (a80 >= 0.8 * total) break; a80 += it.sales; c80++; }
    const deps = {};
    const dOf = (k) => deps[k] || (deps[k] = { dep: k, name: names.dep[k] || (k == null ? 'ללא מחלקה' : 'מחלקה ' + k), items: 0, sales: 0, A: 0, cut: 0, consider: 0, cutSales: 0, dead: 0, deadVal: 0 });
    items.forEach((it) => { const d = dOf(it.dep); d.items++; d.sales += it.sales; if (it.g === 'A') d.A++; if (it.act === 'cut') { d.cut++; d.cutSales += it.sales; } if (it.act === 'consider') d.consider++; });
    dead.forEach((x) => { const d = dOf(x.dep); d.dead++; d.deadVal += x.value; });
    const profitAll = sum(items, (x) => x.profit), netWithCost = sum(items, (x) => x.profit != null ? x.net : 0);
    const ms = mqiMonths(r.months);
    const valid = ms.filter((m) => m.valid && m.ym <= r.to);
    const mq = valid[valid.length - 1] || null;
    const mqPrev = valid[valid.length - 2] || null, mqFirst = ms.find((m) => m.valid) || null;
    const lastM = ms.find((m) => m.ym === r.to), prevM = ms.find((m) => m.ym === addM(r.to, -1));
    // the archive (12/11/2026): SKUs that would be on the shelf but were moved to Comax's archive. The months' MQI is
    // history (they sold then); "after the archive" = the last MQI with the productive share without them — as the simulator
    const arcOut = all.filter((x) => x.arc && x.onShelf);
    let mqiArc = null;
    if (mq && arcOut.length) {
      const u = items.concat(arcOut), da = {};
      u.forEach((x) => { const d = da[x.dep] || (da[x.dep] = { s: 0, c: 0 }); d.s += x.sales; d.c++; });
      const before = u.filter((x) => x.sales >= 0.2 * da[x.dep].s / da[x.dep].c).length / u.length;
      const after = items.filter((x) => x.productive).length / Math.max(items.length, 1);
      mqiArc = Math.max(0, Math.min(100, Math.round(10 * (mq.mqi + 100 * MQ.prod * (after - before))) / 10));
    }
    return { names, months, items, gone, total, groups, cut, consider, prot, dead, c80, deps: Object.values(deps).sort((a, b) => b.sales - a.sales),
      cutSales: sum(cut, (x) => x.sales), considerSales: sum(consider, (x) => x.sales), stockVal,
      deadVal: sum(dead, (x) => x.value), margin: netWithCost > 0 ? profitAll / netWithCost : null,
      productive: items.filter((x) => x.productive).length, ms, mq, mqPrev, mqFirst, arcOut, mqiArc,
      lastSales: lastM ? lastM.sales : null, prevSales: prevM && prevM.full ? prevM.sales : null,
      vipNoStock: items.filter((x) => x.g === 'A' && !x.weighed && x.stock != null && Number(x.stock) <= 0) };
  }

  /* ================= the simulator ================= */
  function simulate() {
    const w = W;
    const n = Math.round(w.items.length * SIM.pct / 100);
    const pool = w.items.filter((x) => !SIM.prot || !(x.prot && x.prot.length)).slice().sort((a, b) => a.sales - b.sales);
    const xs = pool.slice(0, n);
    const sum = (f) => xs.reduce((s, x) => s + (f(x) || 0), 0);
    const left = w.items.length - xs.length;
    const prodNow = w.productive / Math.max(w.items.length, 1);
    const prodAfter = (w.productive - xs.filter((x) => x.productive).length) / Math.max(left, 1);
    const mqiAfter = w.mq ? Math.min(100, Math.round(10 * (w.mq.mqi + 100 * MQ.prod * (prodAfter - prodNow))) / 10) : null;
    return { xs, n: xs.length, short: n - xs.length, sales: sum((x) => x.sales), profit: sum((x) => x.profit), stock: sum(w.stockVal), mqiAfter, prodNow, prodAfter };
  }

  /* ================= render ================= */
  function render() {
    charts.forEach((c) => c.destroy()); charts = [];
    const w = W, r = D;
    const depOpts = '<option value="">כל המחלקות</option>' + Object.entries(w.names.dep).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'he'))
      .map(([c, n]) => '<option value="' + c + '"' + (String(P.dep) === c ? ' selected' : '') + '>' + e(n) + '</option>').join('');
    const cur = ymOf(new Date()); const mOpts = (sel) => { let h = '', m = cur; while (m >= FIRST) { h += '<option value="' + m + '"' + (m === sel ? ' selected' : '') + '>' + mName(m) + '</option>'; m = addM(m, -1); } return h; };
    const last = addM(cur, -1);
    const preset = (f, t, lab) => '<button class="sd-chip' + (P.from === f && P.to === t ? ' on' : '') + '" data-f="' + f + '" data-t="' + t + '">' + lab + '</button>';
    const bar = '<div class="sd-bar" id="asBar">' + preset(last, last, 'חודש קודם') + preset(addM(last, -2), last, '3 חודשים') + preset(addM(last, -5), last, '6 חודשים') +
      preset(addM(last, -11) < FIRST ? FIRST : addM(last, -11), last, '12 חודשים') +
      '<span style="margin-inline-start:6px">מ-</span><select id="asFrom">' + mOpts(P.from) + '</select><span>עד</span><select id="asTo">' + mOpts(P.to) + '</select>' +
      '<select id="asDep">' + depOpts + '</select></div>';
    const per = r.from === r.to ? mName(r.from) : mShort(r.from) + '–' + mName(r.to);
    $('asPer').textContent = '📅 ' + per;
    $('asScope').textContent = P.dep ? '🏷 ' + (w.names.dep[P.dep] || 'מחלקה') : '🏪 החנות שלי';
    const partial = r.to === cur ? '<div class="sd-warn">החודש הנוכחי עדיין לא נגמר — SKU שנמכרים לאט ייראו חלשים מהמציאות. עדיף לבחור חודשים שלמים.</div>' : '';
    const old = r.from < '2026-07' ? '<div class="sd-warn">לפני יולי 2026 לא כל הקופות דיווחו — המכירות והמגוון של החודשים האלה חלקיים, והם לא נכנסים למדד MQI.</div>' : '';
    const go = (t, lab) => '<button class="ff-go" data-go="' + t + '">☞ ' + (lab || 'לחץ לפרטים') + '</button>';

    // ---- row 1: the bottom line · active SKU · total sales · MQI
    const mq = w.mq, rt = mq ? rateOf(mq.mqi) : null;
    const up = mq && w.mqPrev ? mq.mqi - w.mqPrev.mqi : null;
    let head, color, icon;
    if (!mq) { head = 'אין עדיין מספיק חודשים מלאים'; color = '#64748b'; icon = 'ℹ'; }
    else if (mq.mqi >= 70) { head = up != null && up > 0.3 ? 'התמהיל חזק ומשתפר' : up != null && up < -0.3 ? 'התמהיל חזק, אבל נחלש מעט' : 'התמהיל חזק ויציב'; color = '#15803d'; icon = '✓'; }
    else if (mq.mqi >= 60) { head = up != null && up > 0.3 ? 'התמהיל טוב ומשתפר' : 'התמהיל טוב — יש מקום לשיפור'; color = '#65a30d'; icon = '✓'; }
    else if (mq.mqi >= 50) { head = 'התמהיל בינוני — כדאי לצמצם'; color = '#ca8a04'; icon = '!'; }
    else { head = 'התמהיל דורש טיפול'; color = '#dc2626'; icon = '!'; }
    const k80 = w.items.length ? w.c80 / w.items.length : 0;
    const bl = '<div class="ff-c ff-bl"><div class="hd" style="background:' + color + '">בשורה התחתונה</div><div class="in">' +
      '<div class="ok"><i style="background:' + color + '">' + icon + '</i>' + head + '</div>' +
      '<div class="ff-ks" style="font-weight:600;margin-top:4px">' + num(w.c80) + ' SKU (' + pct(k80, 1) + ' מהמגוון) מביאים 80% מהמכירות · ' +
      num(w.cut.length) + ' דלי-מכר לצמצום מיידי</div><span class="ff-tag">נתוני ' + e(per) + '</span></div>' + go('rules', 'איך זה מחושב') + '</div>';
    const skuCard = '<div class="ff-c"><div class="in"><div class="ff-kt" style="color:#4c1d95">מספר SKU פעילים <span style="font-size:22px">📦</span></div>' +
      '<div class="ff-kv" style="color:#4c1d95">' + num(w.items.length) + '</div><div class="ff-ks">' + e(per) + '</div>' +
      (w.arcOut.length ? '<div class="ff-kd" style="color:#64748b">🗄 ' + num(w.arcOut.length) + ' הועברו לארכיון בקומקס ולא נספרים</div>' : '') +
      (w.gone.length > w.arcOut.length ? '<div class="ff-kd" style="color:#64748b">+ ' + num(w.gone.length - w.arcOut.length) + ' שנמכרו בתקופה ויצאו מהמדף</div>' : '') + '</div>' + go('all') + '</div>';
    const dS = w.lastSales != null && w.prevSales ? w.lastSales / w.prevSales - 1 : null;
    const salesCard = '<div class="ff-c"><div class="in"><div class="ff-kt" style="color:#1e40af">מכירות כוללות <span style="font-size:22px">💰</span></div>' +
      '<div class="ff-kv" style="color:#1d4ed8">' + nisM(w.total) + '</div><div class="ff-ks">' + e(per) + ' · ' + nisM(w.total / w.months) + ' לחודש</div>' +
      (dS != null && r.from !== r.to ? '<div class="ff-kd" style="color:' + (dS >= 0 ? '#15803d' : '#dc2626') + '">' + (dS >= 0 ? '▲ ' : '▼ ') + pct(Math.abs(dS), 1) + ' ב' + mShort(r.to) + ' לעומת ' + mShort(addM(r.to, -1)) + '</div>' : '') +
      '</div>' + go('deps') + '</div>';
    const dFirst = mq && w.mqFirst && w.mqFirst !== mq ? mq.mqi - w.mqFirst.mqi : null;
    const mqiCard = '<div class="ff-c" style="background:linear-gradient(180deg,#f0fdf4,#fff)"><div class="in"><div class="ff-kt" style="color:#14532d">מדד יעילות מסחרית MQI ' + (mq ? '· ' + mShort(mq.ym) : '') + ' <span style="font-size:20px">〰</span></div>' +
      (mq ? '<div class="ff-kv" style="color:#14532d">' + num(mq.mqi, 1) + '</div><div class="ff-ks" style="color:' + rt[2] + '">' + rt[1] + '</div>' +
        (w.mqiArc != null ? '<div class="ff-kd" style="color:#14532d">🗄 אחרי הארכיון (' + num(w.arcOut.length) + ' SKU): <b>' + num(w.mqiArc, 1) + '</b></div>' : '') +
        (dFirst != null ? '<div class="ff-kd" style="color:' + (dFirst >= 0 ? '#15803d' : '#dc2626') + '">' + (dFirst >= 0 ? '▲ ' : '▼ ') + num(Math.abs(dFirst), 1) + ' נק\' מתחילת המדידה (' + mShort(w.mqFirst.ym) + ')</div>' : '')
        : '<div class="ff-ks" style="margin-top:14px">צריך לפחות שני חודשים מלאים ברצף</div>') + '</div>' + go('rules') + '</div>';
    const row1 = '<div class="ff-row ff-r1">' + bl + skuCard + salesCard + mqiCard + '</div>';

    // ---- row 2: the opportunity · the SKU by ranking · MQI over time
    const s = simulate();
    const opp = '<div class="ff-c ff-opp"><div class="in"><h3 style="justify-content:center">🎯 ההזדמנות הגדולה שלך</h3>' +
      '<div class="ff-kt" style="font-size:17px">צמצם ' + SIM.pct + '% מה-SKU החלשים</div><div class="ff-ks" style="font-weight:600">סיכון למכירות:</div>' +
      '<div class="big">' + share(s.sales / w.total) + '</div>' +
      '<div class="ff-ks" style="font-weight:600">אפשר לבחון צמצום ממוקד של <b>' + num(s.n) + '</b> SKU' + (SIM.prot ? ' (בלי המוגנים)' : '') + ', על בסיס נתוני המכירות — ' + nis(s.sales / w.months) + ' בחודש.</div>' +
      '<button class="ff-btn" data-go="simCard">☞ לחץ לפרטי הסימולציה</button></div></div>';
    const grpRows = w.groups.map((g) => '<tr class="click" data-go="' + g.k + '" title="' + e(g.tip) + '"><td><span class="ff-dot" style="background:' + g.c + '"></span><b style="white-space:nowrap">' + g.short + '</b></td>' +
      '<td class="n">' + num(g.items) + '</td><td class="n"><b style="color:' + g.c + '">' + pct(g.sales / w.total, 1) + '</b></td></tr>').join('');
    const groups = '<div class="ff-c"><div class="in"><h3>📊 חלוקת ה-SKU לפי דירוג</h3>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="position:relative;width:150px;height:150px;margin:auto"><canvas id="asDonut"></canvas>' +
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none"><b style="font-size:20px">' + num(w.items.length) + '</b><span style="font-size:12px;color:#64748b">SKU</span></div></div>' +
      '<div style="flex:1;min-width:230px" class="sd-scroll"><table class="sd-tbl"><tr><th>קבוצה</th><th class="n">מספר SKU</th><th class="n">% מהמכירות</th></tr>' + grpRows + '</table></div></div></div>' + go('A', 'לחץ לראות פירוט לפי קבוצה') + '</div>';
    const trend = '<div class="ff-c"><div class="in"><h3>📈 מדד יעילות מסחרית MQI לאורך זמן <small>' + (P.dep ? e(w.names.dep[P.dep] || '') : 'כל החנות') + '</small></h3>' +
      '<div style="height:200px"><canvas id="asTrend"></canvas></div></div>' + go('rules', 'מה נכנס למדד') + '</div>';
    const row2 = '<div class="ff-row ff-r2">' + opp + groups + trend + '</div>';

    // ---- row 3: the simulator · what to do now
    const row3 = '<div class="ff-row ff-r3">' + simCard() + actCard() + '</div>';

    const depRows = w.deps.filter((d) => d.items || d.dead).map((d) => '<tr class="click" data-dep="' + (d.dep == null ? '' : d.dep) + '"><td>' + e(d.name) + '</td><td class="n">' + num(d.items) + '</td><td class="n">' + nis(d.sales) + '</td>' +
      '<td class="n o">' + pct(d.sales / w.total, 1) + '</td><td class="n o">' + num(d.A) + '</td><td class="n" style="color:#dc2626;font-weight:800">' + (d.cut ? num(d.cut) : '') + '</td>' +
      '<td class="n o">' + (d.consider ? num(d.consider) : '') + '</td><td class="n">' + (d.dead ? num(d.dead) : '') + '</td><td class="n o">' + (d.deadVal ? nis(d.deadVal) : '') + '</td></tr>').join('');
    const depsCard = P.dep ? '' : '<div class="sd-card wide" id="asDeps"><h3>🏷 לפי מחלקה <small>לחיצה על מחלקה — הניתוח בתוכה בלבד</small></h3><div class="sd-scroll"><table class="sd-tbl">' +
      '<tr><th>מחלקה</th><th class="n">SKU</th><th class="n">מכירות</th><th class="n o">% מהחנות</th><th class="n o">רבי מכר</th><th class="n">לצמצום</th><th class="n o">לשיקול</th><th class="n">מלאי מת</th><th class="n o">שווי מלאי מת</th></tr>' + depRows + '</table></div></div>';
    $('asBody').innerHTML = bar + partial + old + row1 + row2 + row3 + '<div class="sd-grid">' + depsCard + listCard() + rulesCard() + '</div>';
    wire();
    drawCharts();
  }

  function simCard() {
    const w = W, s = simulate();
    const protN = w.items.filter((x) => x.prot && x.prot.length).length;
    return '<div class="ff-c" id="asSim"><div class="in"><h3>🧪 הסימולטור לצמצום מגוון <small>מה קורה אם מוציאים את ה-SKU החלשים ביותר</small></h3>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px"><b style="white-space:nowrap">צמצום של <span id="asSimPct">' + SIM.pct + '</span>% מה-SKU</b>' +
      '<input type="range" id="asSimR" min="5" max="40" step="5" value="' + SIM.pct + '" style="flex:1;min-width:160px">' +
      '<label style="white-space:nowrap;font-size:13px"><input type="checkbox" id="asSimP"' + (SIM.prot ? ' checked' : '') + '> בלי מוצרים מוגנים (' + num(protN) + ')</label></div>' +
      '<div class="ff-sim">' +
      '<div><div class="l">SKU שיוצאים</div><div class="v">' + num(s.n) + '</div></div>' +
      '<div><div class="l">סיכון למכירות</div><div class="v" style="color:#dc2626">' + share(s.sales / w.total) + '</div><div class="l">' + nis(s.sales / w.months) + ' בחודש</div></div>' +
      '<div><div class="l">רווח גולמי בסיכון</div><div class="v">' + nis(s.profit / w.months) + '</div><div class="l">בחודש, לפני מע"מ</div></div>' +
      '<div><div class="l">מלאי שמשתחרר</div><div class="v" style="color:#15803d">' + nis(s.stock) + '</div><div class="l">בעלות, לפי קומקס</div></div>' +
      '<div><div class="l">MQI צפוי</div><div class="v" style="color:#14532d">' + (s.mqiAfter == null ? '—' : num(s.mqiAfter, 1)) + '</div><div class="l">' + (w.mq ? 'היום ' + num(w.mq.mqi, 1) : '') + '</div></div>' +
      '<div><div class="l">SKU פרודוקטיביים</div><div class="v">' + pct(s.prodAfter, 0) + '</div><div class="l">היום ' + pct(s.prodNow, 0) + '</div></div></div>' +
      (s.short > 0 ? '<div class="ff-rule" style="color:#9a3412">אין מספיק SKU לא-מוגנים — נבחרו ' + num(s.n) + ' בלבד.</div>' : '') +
      '<div class="ff-rule">ההערכה זהירה: חלק מהמכירות של SKU שיוצאים עובר בדרך כלל לתחליפים במדף, כך שההפסד בפועל קטן יותר.</div>' +
      '</div><button class="ff-go" data-go="sim">☞ לרשימת ה-SKU בסימולציה</button></div>';
  }

  function actCard() {
    const w = W;
    const topDep = w.deps.filter((d) => d.cut).sort((a, b) => b.cut - a.cut)[0];
    const A = w.groups[0];
    const li = (c, n, t, goTo) => '<li data-go="' + goTo + '"><b class="n" style="background:' + c + '">' + n + '</b><span>' + t + '</span></li>';
    let i = 0;
    return '<div class="ff-c"><div class="in"><h3>✅ מה לעשות עכשיו</h3><ul class="ff-act">' +
      li('#15803d', ++i, '<b>רבי מכר – VIP (' + num(A.items) + ' SKU, ' + pct(A.sales / w.total, 0) + ' מהמכירות):</b> לוודא מלאי ומיקום טוב.' +
        (w.vipNoStock.length ? ' <b style="color:#dc2626">' + num(w.vipNoStock.length) + ' מהם בלי מלאי בקומקס עכשיו!</b>' : ''), w.vipNoStock.length ? 'vipOut' : 'A') +
      li('#dc2626', ++i, '<b>דלי-מכר לצמצום מיידי:</b> ' + num(w.cut.length) + ' SKU שמביאים ' + share(w.cutSales / w.total) + ' מהמכירות — לא להזמין שוב, לגמור מלאי.', 'cut') +
      li('#f97316', ++i, '<b>חלשים לשיקול דעת:</b> ' + num(w.consider.length) + ' SKU — לבדוק כפילויות מול מוצרים דומים.', 'consider') +
      (w.dead.length ? li('#78350f', ++i, '<b>מלאי מת:</b> ' + num(w.dead.length) + ' SKU עם מלאי שלא נמכרו בתקופה — ' + nis(w.deadVal) + ' בעלות. מבצע חיסול או החזרה לספק.', 'dead') : '') +
      (topDep && !P.dep ? li('#1e40af', ++i, '<b>להתחיל ממחלקת ' + e(topDep.name) + ':</b> הכי הרבה מועמדים לצמצום (' + num(topDep.cut) + ').', 'dep:' + topDep.dep) : '') +
      '</ul></div></div>';
  }

  const TABS = () => { const w = W; return [['all', 'כל ה-SKU', w.items.length]].concat(G.map((g) => [g.k, g.short, w.groups.find((x) => x.k === g.k).items]),
    [['cut', '✂ לצמצום מיידי', w.cut.length], ['consider', '🤔 לשיקול', w.consider.length], ['protected', '🛡 חלשים מוגנים', w.prot.length],
      ['sim', '🧪 הסימולציה', simulate().n], ['dead', '🧊 מלאי מת', w.dead.length], ['vipOut', '⚠ VIP בלי מלאי', w.vipNoStock.length], ['gone', 'יצאו מהמדף', w.gone.length]]); };
  function listCard() {
    const w = W;
    const tabs = '<div class="ff-tabs" id="asTabs">' + TABS().filter(([k, , n]) => n || k === tab || k === 'all').map(([k, l, n]) => '<button data-t="' + k + '"' + (tab === k ? ' class="on"' : '') + '>' + l + ' · ' + num(n) + '</button>').join('') + '</div>';
    const s = search.trim().toLowerCase();
    const match = (x) => !s || String(x.name || '').toLowerCase().includes(s) || String(x.barcode).includes(s) || String(w.names.spk[x.spk] || '').toLowerCase().includes(s);
    let body;
    if (tab === 'dead') {
      const xs = w.dead.filter(match);
      body = '<table class="sd-tbl"><tr><th>SKU</th><th class="o">מחלקה</th><th class="o">ספק</th><th class="n">מלאי</th><th class="n">שווי בעלות</th><th class="n o">נמכר לאחרונה</th></tr>' +
        xs.slice(0, limit).map((x) => '<tr><td><b>' + e(x.name) + '</b><div class="ff-rule" dir="ltr" style="text-align:right">' + e(x.barcode) + '</div></td><td class="o">' + e(w.names.dep[x.dep] || '') + '</td><td class="o">' + e(w.names.spk[x.spk] || '') + '</td>' +
          '<td class="n">' + num(x.stock, 1) + '</td><td class="n">' + (x.value ? nis(x.value) : '—') + '</td><td class="n o">' + (x.last ? mName(x.last) : 'לא נמכר מאז ' + mName(FIRST)) + (x.arc ? ' · 🗄 בארכיון' : '') + '</td></tr>').join('') + '</table>' +
        (xs.length > limit ? '<button class="ff-more" id="asMore">עוד ' + num(Math.min(200, xs.length - limit)) + ' מתוך ' + num(xs.length - limit) + '</button>' : '');
    } else {
      const src = tab === 'sim' ? simulate().xs : tab === 'gone' ? w.gone : tab === 'vipOut' ? w.vipNoStock : w.items.filter((x) => tab === 'all' || x.act === tab || x.g === tab);
      const xs = src.filter(match);
      if (tab === 'cut' || tab === 'consider' || tab === 'protected' || tab === 'sim') xs.sort((a, b) => a.sales - b.sales);
      body = '<table class="sd-tbl"><tr><th>SKU</th><th class="o">מחלקה</th><th class="o">ספק</th><th class="n">כמות</th><th class="n">מכירות</th><th class="n o">% מהמכירות</th><th class="n o">רווח גולמי</th><th class="n o">חודשים שנמכר</th><th class="n o">מלאי</th><th>דירוג</th></tr>' +
        xs.slice(0, limit).map((x) => { const g = GK[x.g];
          return '<tr><td><b>' + e(x.name) + '</b><div class="ff-rule" dir="ltr" style="text-align:right">' + e(x.barcode) + '</div></td><td class="o">' + e(w.names.dep[x.dep] || '') + '</td><td class="o">' + e(w.names.spk[x.spk] || '') + '</td>' +
            '<td class="n">' + num(x.qty, x.weighed ? 1 : 0) + '</td><td class="n">' + nis(x.sales) + '</td><td class="n o">' + (x.share == null ? '' : share(x.share)) + '</td>' +
            '<td class="n o">' + (x.margin == null ? '—' : pct(x.margin, 1)) + '</td><td class="n o">' + x.months + '/' + w.months + '</td><td class="n o">' + (x.stock == null ? '' : num(x.stock, 1)) + '</td>' +
            '<td>' + (g ? '<span class="ff-g" style="background:' + g.bg + ';color:' + g.c + '">' + g.short + '</span>' : '<span class="ff-g" style="background:#f1f5f9;color:#64748b">' + (x.arc ? '🗄 בארכיון מ-' + x.arc.split('-').reverse().slice(0, 2).join('/') : 'יצא מהמדף') + '</span>') +
            (x.prot || []).map((p) => '<span class="ff-p">' + PROT[p] + '</span>').join('') + '</td></tr>'; }).join('') + '</table>' +
        (xs.length > limit ? '<button class="ff-more" id="asMore">עוד ' + num(Math.min(200, xs.length - limit)) + ' מתוך ' + num(xs.length - limit) + '</button>' : '') +
        (!xs.length ? '<div class="sd-empty">אין SKU ברשימה</div>' : '');
    }
    const note = tab === 'gone' ? 'נמכרו בתקופה, אבל לא ב' + mShort(D.to) + ' ואין להם מלאי בקומקס, או שהועברו לארכיון בקומקס (🗄) — כבר לא על המדף, ולכן לא נכנסים לדירוג.' :
      tab === 'vipOut' ? 'רבי מכר שהמלאי שלהם בקומקס 0 או פחות — כל יום בלי מלאי הוא מכירות שהולכות למתחרים (או שהמלאי בקומקס לא מעודכן).' : '';
    return '<div class="sd-card wide" id="asList"><h3>📋 רשימת ה-SKU <small>' + (tab === 'cut' || tab === 'consider' || tab === 'protected' || tab === 'sim' ? 'מהנמכר פחות' : 'מהנמכר יותר') + '</small>' +
      '<span style="flex:1"></span><input class="ff-search" id="asSearch" placeholder="חיפוש: שם, ברקוד או ספק" value="' + e(search) + '"></h3>' + tabs +
      (note ? '<div class="ff-rule" style="margin-bottom:6px">' + note + '</div>' : '') + '<div class="sd-scroll">' + body + '</div></div>';
  }

  function rulesCard() {
    return '<div class="sd-card wide" id="asRules"><h3>ℹ איך זה מחושב</h3><div class="ff-rule">' +
      '<b>SKU פעיל</b> — ברקוד שנמכר בתקופה ועדיין על המדף: נמכר בחודש האחרון של התקופה, או שיש לו מלאי בקומקס. SKU שנמכר בתקופה אבל לא בחודש האחרון ואין לו מלאי — "יצא מהמדף", ולא נכנס לדירוג. SKU שהועבר לארכיון בקומקס יוצא מיד (🗄, תוך רבע שעה מההעברה). ' +
      'לא נספרים: שורות הנחה של מבצעים, מתנת הסל ה-41, קופונים, תווי קנייה, תשלומים ועמלות.<br>' +
      '<b>הדירוג (ABC)</b> — ה-SKU ממוינים לפי המכירות (כולל מע"מ), וכל SKU שייך לקבוצה לפי חלק המכירות של ה-SKU שלפניו: ' +
      '<b>רבי מכר – VIP</b> עד 70% · <b>חזקים טובים</b> 70–90% · <b>הבסיס הרחב</b> 90–96.5% · <b>חלשים – לשיקול דעת</b> 96.5–99.2% · <b>דלי-מכר</b> 0.8% האחרונים.<br>' +
      'SKU חלש או דל-מכר <b>מוגן</b> ולא מומלץ להוצאה כש: 🆕 הוא חדש (נמכר פחות מ-3 חודשים) · 💰 הרווח הגולמי שלו לפחות 35% וגבוה ב-15 נקודות מהמחלקה · 🧩 הוא היחיד שנמכר בתת-הקבוצה שלו בקומקס · 🥬 הוא טרי או שקיל (פירות וירקות, קצביה, דגים) — עונתי, נבדק ידנית. ' +
      '<b>לצמצום מיידי</b> = דלי-מכר לא מוגנים · <b>לשיקול</b> = חלשים לא מוגנים.<br>' +
      '<b>MQI — מדד יעילות מסחרית</b> (0–100, לכל חודש שלם): ' + Math.round(MQ.prod * 100) + '% <b>פריון מגוון</b> — כמה מה-SKU מוכרים לפחות חמישית מהממוצע ל-SKU במחלקה שלהם · ' +
      Math.round(MQ.cont * 100) + '% <b>רציפות</b> — כמה מה-SKU נמכרו גם בחודש הקודם (מגוון יציב, לא קניות חד-פעמיות) · ' +
      Math.round(MQ.margin * 100) + '% <b>רווחיות</b> — הרווח הגולמי מול יעד של ' + Math.round(MQ.marginTarget * 100) + '%. ' +
      'דירוג: 80+ מצוין · 70–80 טוב מאוד · 60–70 טוב · 50–60 בינוני · מתחת ל-50 דורש טיפול. חודש נכנס למדד רק כשגם הוא וגם החודש שלפניו מלאים.<br>' +
      '<b>הסימולטור</b> — מוציא את ה-SKU הפעילים עם המכירות הנמוכות ביותר (בלי המוגנים, אם מסומן) ומראה מה בסיכון ומה משתחרר. MQI צפוי = המדד האחרון אחרי שינוי הפריון בלעדיהם. כך מחושב גם <b>MQI אחרי הארכיון</b> — בלי ה-SKU שהועברו לארכיון (המדד של החודשים שעברו לא משתנה: אז הם עוד נמכרו).<br>' +
      '<b>מלאי מת</b> — SKU ארוזים עם מלאי בקומקס שלא נמכרו בכלל בתקופה (השווי לפי עלות לפני מע"מ).<br>' +
      'העלות והרווח הגולמי לפי מחירון 108 בקומקס, לפני מע"מ — אצל חלק מה-SKU היא לא מעודכנת, ולכן הם סימן בלבד. המלאי של פירות, ירקות ובשר לא מדויק בקומקס. ' +
      'כדאי לבחור תקופה של 3 חודשים לפחות, ולבדוק SKU עונתיים (חגים, קיץ) לפני הוצאה.' +
      (D.lastPush ? '<br>נתונים עדכניים ל-' + new Date(D.lastPush).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) + '.' : '') + '</div></div>';
  }

  function rerenderList() { const el = $('asList'); if (!el) return; const pos = $('asSearch') && $('asSearch').selectionStart; el.outerHTML = listCard(); wireList(); const s = $('asSearch'); if (s && pos != null && document.activeElement !== s && search) { s.focus(); s.setSelectionRange(pos, pos); } }
  function rerenderSim() { const el = $('asSim'); if (!el) return; el.outerHTML = simCard(); wireSim(); if (tab === 'sim') rerenderList(); }
  function wireList() {
    $('asTabs').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { tab = b.dataset.t; limit = 200; rerenderList(); } });
    $('asSearch').addEventListener('input', (ev) => { search = ev.target.value; limit = 200; rerenderList(); });
    if ($('asMore')) $('asMore').addEventListener('click', () => { limit += 200; rerenderList(); });
  }
  function wireSim() {
    $('asSimR').addEventListener('input', (ev) => { $('asSimPct').textContent = ev.target.value; });
    $('asSimR').addEventListener('change', (ev) => { SIM.pct = Number(ev.target.value); rerenderSim(); });
    $('asSimP').addEventListener('change', (ev) => { SIM.prot = ev.target.checked; rerenderSim(); });
    $('asSim').querySelector('[data-go]').addEventListener('click', () => goTo('sim'));
  }
  function goTo(t) {
    const scroll = (id) => { const el = $(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    if (t === 'rules') return scroll('asRules');
    if (t === 'deps') return scroll(P.dep ? 'asList' : 'asDeps');
    if (t === 'simCard') return scroll('asSim');
    if (t.startsWith('dep:')) { P.dep = t.slice(4); return load(); }
    tab = t; limit = 200; rerenderList(); scroll('asList');
  }
  function wire() {
    $('asBar').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-f]'); if (b) { P.from = b.dataset.f; P.to = b.dataset.t; load(); } });
    $('asFrom').addEventListener('change', (ev) => { P.from = ev.target.value; if (P.from > P.to) P.to = P.from; load(); });
    $('asTo').addEventListener('change', (ev) => { P.to = ev.target.value; if (P.from > P.to) P.from = P.to; load(); });
    $('asDep').addEventListener('change', (ev) => { P.dep = ev.target.value; load(); });
    $('asBody').querySelectorAll('[data-go]').forEach((el) => { if (!el.closest('#asSim')) el.addEventListener('click', () => goTo(el.dataset.go)); });
    $('asBody').querySelectorAll('[data-dep]').forEach((el) => el.addEventListener('click', () => { P.dep = el.dataset.dep; load(); }));
    wireSim();
    wireList();
  }

  async function drawCharts() {
    try { if (!window.Chart) await loadScript(CHART_URL); } catch (_) { return; }
    if (!$('asDonut')) return;
    charts.push(new window.Chart($('asDonut'), { type: 'doughnut', data: { labels: G.map((g) => g.name), datasets: [{ data: W.groups.map((g) => g.items), backgroundColor: G.map((g) => g.c), borderWidth: 2 }] },
      options: { cutout: '64%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.label + ': ' + num(c.raw) + ' SKU' } } } } }));
    const ms = W.ms.filter((m) => m.valid);
    if (!ms.length) { $('asTrend').parentNode.innerHTML = '<div class="sd-empty" style="padding:20px">אין עדיין שני חודשים מלאים ברצף</div>'; return; }
    const labels = { id: 'ffLabels', afterDatasetsDraw(ch) {
      const ctx = ch.ctx; ctx.save(); ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#14532d'; ctx.textAlign = 'center';
      ch.getDatasetMeta(0).data.forEach((p, i) => { const v = ch.data.datasets[0].data[i]; if (v != null) ctx.fillText(num(v, 1), p.x, p.y - 8); });
      ctx.restore(); } };
    const vals = ms.map((m) => m.mqi);
    charts.push(new window.Chart($('asTrend'), { type: 'line', plugins: [labels], data: { labels: ms.map((m) => mShort(m.ym)), datasets: [
      { label: 'MQI', data: vals, borderColor: '#2f6b1f', backgroundColor: 'rgba(132,204,22,.18)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#2f6b1f' }] },
      options: { maintainAspectRatio: false, layout: { padding: { top: 16 } }, plugins: { legend: { display: false }, tooltip: { rtl: true, callbacks: {
        label: (c) => { const m = ms[c.dataIndex]; return ['MQI ' + num(m.mqi, 1), 'פריון ' + pct(m.pProd, 0) + ' · רציפות ' + pct(m.pCont, 0) + (m.margin != null ? ' · רווח גולמי ' + pct(m.margin, 1) : ''), num(m.items) + ' SKU · ' + nis(m.sales)]; } } } },
        scales: { y: { position: 'right', suggestedMin: Math.floor(Math.min(...vals) - 4), suggestedMax: Math.ceil(Math.max(...vals) + 3) } } } }));
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
  const H = (v) => ({ v, f: { bold: true, color: { rgb: 'FFFFFF' } }, s: { fill: { fgColor: { rgb: '0B1530' } }, border } });
  const N = (v, z, s) => ({ v: v == null || !isFinite(v) ? '' : v, z, s: { border, ...(s || {}) } });
  const T = (v, s) => ({ v: v == null ? '' : String(v), s: { border, ...(s || {}) } });
  const hex = (c) => c.replace('#', '').toUpperCase();
  async function exportXlsx() {
    if (!W) return;
    const X = await styledXlsx(), w = W, r = D, s = simulate();
    const per = r.from === r.to ? mName(r.from) : mName(r.from) + ' עד ' + mName(r.to);
    const wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
    const S = [[{ v: 'אופטימייזר מגוון — ' + per + (P.dep ? ' — ' + (w.names.dep[P.dep] || '') : ''), f: { bold: true, sz: 16, color: { rgb: '0B1530' } } }], [],
      [H('מדד'), H('ערך')],
      [T('מכירות כוללות (כולל מע"מ)'), N(w.total, FMT.money)], [T('מספר SKU פעילים'), N(w.items.length, FMT.n0)], [T('SKU שיצאו מהמדף'), N(w.gone.length, FMT.n0)], [T('מהם הועברו לארכיון בקומקס'), N(w.arcOut.length, FMT.n0)],
      [T('מדד יעילות מסחרית MQI' + (w.mq ? ' — ' + mName(w.mq.ym) : '')), N(w.mq ? w.mq.mqi : null, FMT.n1)], [T('MQI אחרי הארכיון'), N(w.mqiArc, FMT.n1)],
      [T('SKU שעושים 80% מהמכירות'), N(w.c80, FMT.n0)], [T('דלי-מכר לצמצום מיידי'), N(w.cut.length, FMT.n0)], [T('המכירות שלהם'), N(w.cutSales, FMT.money)],
      [T('% מהמכירות'), N(w.cutSales / w.total, FMT.pct2)], [T('חלשים לשיקול'), N(w.consider.length, FMT.n0)], [T('חלשים מוגנים'), N(w.prot.length, FMT.n0)],
      [T('מלאי מת — SKU'), N(w.dead.length, FMT.n0)], [T('מלאי מת — שווי בעלות'), N(w.deadVal, FMT.money)], [],
      [H('סימולציה: צמצום ' + SIM.pct + '%' + (SIM.prot ? ' בלי מוגנים' : '')), H('')], [T('SKU שיוצאים'), N(s.n, FMT.n0)], [T('סיכון למכירות'), N(s.sales / w.total, FMT.pct2)],
      [T('מכירות בחודש'), N(s.sales / w.months, FMT.money)], [T('רווח גולמי בחודש'), N(s.profit / w.months, FMT.money)], [T('מלאי שמשתחרר (עלות)'), N(s.stock, FMT.money)], [T('MQI צפוי'), N(s.mqiAfter, FMT.n1)], [],
      [H('קבוצה'), H('מספר SKU'), H('% SKU'), H('מכירות'), H('% מהמכירות')]]
      .concat(w.groups.map((g) => [T(g.name, { fill: { fgColor: { rgb: hex(g.bg) } }, font: font({ bold: true, color: { rgb: hex(g.c) } }) }), N(g.items, FMT.n0), N(g.items / Math.max(w.items.length, 1), FMT.pct), N(g.sales, FMT.money), N(g.sales / w.total, FMT.pct)]),
      [[], [H('חודש'), H('MQI'), H('פריון'), H('רציפות'), H('רווח גולמי'), H('SKU'), H('מכירות')]],
      w.ms.filter((m) => m.valid).map((m) => [T(mName(m.ym)), N(m.mqi, FMT.n1), N(m.pProd, FMT.pct), N(m.pCont, FMT.pct), N(m.margin, FMT.pct), N(m.items, FMT.n0), N(m.sales, FMT.money)]));
    X.utils.book_append_sheet(wb, sheetOf(X, S, [36, 14, 12, 14, 12, 10, 14]), 'Store Dashboard');
    const head = ['ברקוד', 'SKU', 'מחלקה', 'ספק', 'דירוג', 'מוגן', 'כמות', 'מכירות', '% מהמכירות', 'רווח גולמי %', 'חודשים שנמכר', 'מלאי'];
    const itemRows = (xs) => [head.map(H)].concat(xs.map((x) => { const g = GK[x.g]; return [T(x.barcode), T(x.name), T(w.names.dep[x.dep] || ''), T(w.names.spk[x.spk] || ''),
      g ? T(g.short, { fill: { fgColor: { rgb: hex(g.bg) } }, font: font({ bold: true, color: { rgb: hex(g.c) } }) }) : T('יצא מהמדף'), T((x.prot || []).map((p) => PROT[p].replace(/^\S+\s/, '')).join(', ')),
      N(x.qty, FMT.n1), N(x.sales, FMT.money), N(x.share, FMT.pct2), N(x.margin, FMT.pct), N(x.months, FMT.n0), N(x.stock, FMT.n1)]; }));
    const cols = [16, 34, 16, 20, 14, 18, 10, 12, 11, 11, 10, 9];
    const asc = (xs) => xs.slice().sort((a, b) => a.sales - b.sales);
    X.utils.book_append_sheet(wb, sheetOf(X, itemRows(w.items), cols), 'כל ה-SKU');
    G.forEach((g) => X.utils.book_append_sheet(wb, sheetOf(X, itemRows(w.items.filter((x) => x.g === g.k)), cols), g.short));
    X.utils.book_append_sheet(wb, sheetOf(X, itemRows(asc(w.cut)), cols), 'לצמצום מיידי');
    X.utils.book_append_sheet(wb, sheetOf(X, itemRows(asc(w.consider)), cols), 'לשיקול');
    X.utils.book_append_sheet(wb, sheetOf(X, itemRows(asc(w.prot)), cols), 'חלשים מוגנים');
    X.utils.book_append_sheet(wb, sheetOf(X, itemRows(asc(s.xs)), cols), 'סימולציה');
    X.utils.book_append_sheet(wb, sheetOf(X, [['ברקוד', 'SKU', 'מחלקה', 'ספק', 'מלאי', 'עלות ליחידה', 'שווי בעלות', 'נמכר לאחרונה'].map(H)].concat(w.dead.map((x) =>
      [T(x.barcode), T(x.name), T(w.names.dep[x.dep] || ''), T(w.names.spk[x.spk] || ''), N(x.stock, FMT.n1), N(x.ucost, '"₪"#,##0.00'), N(x.value, FMT.money), T(x.last ? mName(x.last) : '—')])), [16, 34, 16, 20, 10, 12, 12, 14]), 'מלאי מת');
    X.utils.book_append_sheet(wb, sheetOf(X, itemRows(w.gone), cols), 'יצאו מהמדף');
    X.writeFile(wb, 'אופטימייזר מגוון ' + per + '.xlsx');
  }

  function start() {
    const drop = $('menuAdminDrop');
    if (drop && !$('asMgrBtn')) {
      const anchor = $('miMgrBtn') || $('sdMgrBtn');
      const html = '<button id="asMgrBtn" style="display:none">🎯 אופטימייזר מגוון</button>';
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
