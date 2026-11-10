// 🥩 meat inventory (10/11/2026, the owner) — admin only: ⚙ ניהול ← 🥩 מלאי בשר. Full screen. Replaces meat_inventory.html.
// Data: api meatData / meatReport / meatSave / meatItemsSave / meatCountDelete (server meat-inventory.ts, migration
// 20261110100000_meat_inventory.sql). The counts come by themselves from the count form (meat-count.html); the owner
// uploads only Comax's "רכש מכר" report for the period between the two counts. Everything WITH VAT.
// Cost per kg (with VAT) = last entry sum / last entry qty when that entry is at most N days (settings, default 14)
// before the closing count; otherwise the item's wholes (meat_items.sources, averaged by the kg bought in the period);
// otherwise a manual cost / an old price (flagged). Shrinkage = (opening + bought − sold − closing) per group — the
// wholes turn into cuts inside a group, so only the group's sum is the real loss (bones, trimmings, cutting).
// Uses the app's globals: apiPost, mgrAuth, state, loadScript, XLSX_URL.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const CHART_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  const XURL = typeof XLSX_URL !== 'undefined' ? XLSX_URL : 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const GROUPS = ['עוף', 'בקר ועגל', 'טלה', 'אחר', 'לא משויך'];
  const GCOL = { 'עוף': '#d97706', 'בקר ועגל': '#9f1239', 'טלה': '#7c3aed', 'אחר': '#0f766e', 'לא משויך': '#64748b' };
  const KIND = { whole: 'שלם', cut: 'חלק', ready: 'מוכן' };
  const nis = (v, d) => (v == null || !isFinite(v) ? '—' : (v < 0 ? '-' : '') + '₪' + Math.abs(Number(v)).toLocaleString('he-IL', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d }));
  const kg = (v, d) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('he-IL', { maximumFractionDigits: d == null ? 1 : d, minimumFractionDigits: d == null ? 1 : d }));
  const pct = (v) => (v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toLocaleString('he-IL') + '%');
  const ilDay = (t) => { const d = new Date(t); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); };
  const dmy = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(2, 4) : '');
  const dm = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '');
  const hm = (t) => new Date(t).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem('mi_' + k); localStorage.setItem('mi_' + k, v); } catch (x) { return null; } };

  let D = null;            // meatData
  let W = null;            // the computed week
  let tab = 'week', sel = { to: null, from: null }, openRow = null, sortK = '', sortD = -1, charts = [];

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#miOv{position:fixed;inset:0;z-index:9000;background:#f6f3ef;overflow:auto;direction:rtl;font-family:inherit;color:#1f1a17}#miOv.hidden{display:none}' +
    '.mi-top{position:sticky;top:0;z-index:3;background:linear-gradient(120deg,#4a0d18,#7f1d2d 55%,#b45309);color:#fff;padding:11px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 4px 16px rgba(74,13,24,.3)}' +
    '.mi-top h2{margin:0;font-size:19px;font-weight:900}.mi-top .sp{flex:1}' +
    '.mi-top button{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:10px;padding:6px 12px;font:inherit;font-weight:700;cursor:pointer}' +
    '.mi-tabs{display:flex;gap:4px;flex-wrap:wrap}.mi-tabs button.on{background:#fff;color:#4a0d18}' +
    '.mi-wrap{max-width:1280px;margin:0 auto;padding:14px 16px 48px}' +
    '.mi-card{background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 2px 10px rgba(60,20,10,.07);margin-bottom:12px;min-width:0}' +
    '.mi-card h3{margin:0 0 10px;font-size:15.5px;font-weight:900;color:#4a0d18;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mi-card h3 small{font-weight:600;color:#78716c;font-size:12.5px}' +
    '.mi-row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}.mi-row label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700;color:#78716c}' +
    '.mi-row select,.mi-row input,.mi-in{border:1.5px solid #e7d8cc;border-radius:10px;padding:7px 9px;font:inherit;font-size:13.5px;background:#fff;color:#1f1a17;min-width:0}' +
    '.mi-btn{background:#7f1d2d;color:#fff;border:0;border-radius:10px;padding:8px 14px;font:inherit;font-weight:800;cursor:pointer}.mi-btn.ghost{background:#fff;color:#7f1d2d;border:1.5px solid #e7d8cc}.mi-btn:disabled{opacity:.5;cursor:default}' +
    '.mi-drop{border:2px dashed #d6bfae;border-radius:14px;padding:18px;text-align:center;cursor:pointer;background:#fffaf5;font-weight:700;color:#7f1d2d}.mi-drop:hover{background:#fdf0e3}.mi-drop small{display:block;font-weight:500;color:#78716c;margin-top:4px}' +
    '.mi-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:12px}' +
    '.mi-kpi{border-radius:16px;padding:12px 14px;color:#fff;min-height:96px;box-shadow:0 6px 18px rgba(60,20,10,.14);position:relative;overflow:hidden}' +
    '.mi-kpi .l{font-size:12.5px;font-weight:700;opacity:.92}.mi-kpi .v{font-size:24px;font-weight:900;margin-top:4px;letter-spacing:-.5px}.mi-kpi .d{font-size:12px;margin-top:3px;opacity:.95}.mi-kpi .ic{position:absolute;left:10px;top:8px;font-size:28px;opacity:.3}' +
    '.mi-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:10px;margin-bottom:12px}' +
    '.mi-g{background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 2px 10px rgba(60,20,10,.07);border-top:5px solid var(--c);cursor:pointer}.mi-g.on{outline:2px solid var(--c)}' +
    '.mi-g h4{margin:0 0 6px;font-size:16px;font-weight:900;color:var(--c);display:flex;justify-content:space-between;gap:6px}' +
    '.mi-g .flow{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;text-align:center;margin:6px 0}.mi-g .flow div{background:#faf6f2;border-radius:10px;padding:5px 2px}.mi-g .flow b{display:block;font-size:14.5px}.mi-g .flow span{font-size:11px;color:#78716c}' +
    '.mi-g .line{display:flex;justify-content:space-between;font-size:13px;padding:2px 0}.mi-g .line b{font-variant-numeric:tabular-nums}' +
    '.mi-bar{height:8px;border-radius:9px;background:#f1e6dc;overflow:hidden;margin:6px 0 2px}.mi-bar i{display:block;height:100%}' +
    '.mi-badge{display:inline-block;border-radius:99px;padding:1px 8px;font-size:11.5px;font-weight:800}.mi-ok{background:#dcfce7;color:#166534}.mi-warn{background:#fef3c7;color:#92400e}.mi-bad{background:#fee2e2;color:#991b1b}.mi-mute{background:#f1f5f9;color:#475569}' +
    '.mi-tbl{width:100%;border-collapse:collapse;font-size:13px}.mi-tbl th{text-align:right;color:#78716c;font-weight:800;font-size:12px;padding:6px;border-bottom:1.5px solid #eadbcf;white-space:nowrap;cursor:pointer;position:sticky;top:0;background:#fff}' +
    '.mi-tbl td{padding:6px;border-bottom:1px solid #f4ece4;vertical-align:top}.mi-tbl .n{text-align:left;direction:ltr;white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '.mi-tbl tr.it{cursor:pointer}.mi-tbl tr.it:hover td{background:#fdf6ee}.mi-tbl tr.gh td{background:#f8efe6;font-weight:900;color:#4a0d18}.mi-tbl tr.gt td{font-weight:900;border-top:1.5px solid #eadbcf;background:#fcf8f4}' +
    '.mi-tbl tr.det td{background:#fffaf5;font-size:12.5px;line-height:1.7;color:#44403c}.mi-tbl small{color:#78716c}' +
    '.neg{color:#b91c1c;font-weight:800}.pos{color:#15803d;font-weight:800}' +
    '.mi-warns{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:9px 13px;font-size:13px;margin-bottom:12px;line-height:1.7}.mi-warns ul{margin:4px 0 0;padding-right:18px}' +
    '.mi-info{background:#f0f9ff;border:1px solid #bae6fd;color:#075985;border-radius:12px;padding:9px 13px;font-size:13px;margin-bottom:12px;line-height:1.6}' +
    '.mi-empty{background:#fff;border-radius:16px;padding:30px 20px;text-align:center;color:#44403c;font-size:15px;line-height:1.8}' +
    '.mi-scroll{overflow-x:auto}.mi-note{font-size:12px;color:#78716c;line-height:1.7;margin-top:8px}' +
    '@media (max-width:560px){.mi-kpi .v{font-size:20px}.mi-top h2{font-size:16px}.mi-g .flow b{font-size:13px}}' +
    '</style>');

  /* ================= open / load ================= */
  function open() {
    if (!isAdmin()) return;
    if (!$('miOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="miOv" class="hidden"><div class="mi-top"><h2>🥩 מלאי בשר</h2>' +
        '<div class="mi-tabs" id="miTabs"><button data-t="week">שבוע</button><button data-t="hist">היסטוריה</button><button data-t="counts">ספירות</button><button data-t="cat">קטלוג ומחירים</button></div>' +
        '<span class="sp"></span><button id="miClose">✕ סגירה</button></div><div class="mi-wrap" id="miBody"></div></div>');
      $('miClose').addEventListener('click', close);
      $('miTabs').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { tab = b.dataset.t; render(); } });
    }
    $('miOv').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    load();
  }
  function close() { $('miOv').classList.add('hidden'); document.body.style.overflow = ''; }

  async function load(keepSel) {
    $('miBody').innerHTML = '<div class="mi-empty">טוען…</div>';
    const r = await apiPost({ action: 'meatData', ...mAuth() }).catch(() => ({ ok: false, error: 'אין חיבור' }));
    if (!r || !r.ok) { $('miBody').innerHTML = '<div class="mi-empty">' + e((r && r.error) || 'שגיאה') + '</div>'; return; }
    D = r;
    D.counts.forEach((c) => { c.day = ilDay(c.counted_at); c.map = {}; (c.items || []).forEach((it) => { c.map[String(it.code)] = it; }); });
    D.itemMap = {}; D.items.forEach((it) => { D.itemMap[String(it.barcode)] = it; });
    D.priceMap = {}; D.prices.forEach((p) => { D.priceMap[String(p.barcode)] = p; });
    if (!keepSel || !D.counts.find((c) => c.id === sel.to)) { sel.to = D.counts[0] ? D.counts[0].id : null; sel.from = prevOf(sel.to); }
    await showWeek();
  }
  function prevOf(toId) {
    const i = D.counts.findIndex((c) => c.id === toId);
    return i >= 0 && D.counts[i + 1] ? D.counts[i + 1].id : null;
  }
  const countById = (id) => D.counts.find((c) => c.id === id) || null;

  async function showWeek() {
    W = null;
    const rep = D.reports.find((r) => r.to_count === sel.to && (r.from_count || null) === (sel.from || null));
    if (rep) {
      const full = await apiPost({ action: 'meatReport', ...mAuth(), id: rep.id }).catch(() => null);
      if (full && full.ok) W = compute(full.report.rows, { saved: full.report });
    }
    render();
  }

  /* ================= the Comax file ================= */
  async function readFile(file) {
    await loadScript(XURL);
    const buf = new Uint8Array(await file.arrayBuffer());
    let wb;
    const head = new TextDecoder('ascii').decode(buf.slice(0, 64)).trim().toLowerCase();
    if (head.startsWith('<')) {   // Comax's ".xls" that is really HTML in Windows-1255
      wb = XLSX.read(new TextDecoder('windows-1255').decode(buf), { type: 'string', cellDates: true });
    } else wb = XLSX.read(buf, { type: 'array', cellDates: true });
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
      const h = rows.findIndex((r) => r && r.some((c) => String(c || '').trim() === 'ברקוד') && r.some((c) => String(c || '').includes('כמות מכירות')));
      if (h < 0) continue;
      const hdr = rows[h].map((c) => String(c || '').trim());
      const col = (t) => hdr.indexOf(t);
      const C = { bc: col('ברקוד'), name: col('שם פריט'), last: col('כניסה אחרונה'), lq: col('כמות כניסה אחרונה'), ls: col('סכום כניסה אחרונה'),
        ss: col('סכום מכירות'), bs: col('סכום קניות'), sq: col('כמות מכירות'), bq: col('כמות קניות') };
      const miss = Object.entries(C).filter(([, v]) => v < 0).map(([k]) => k);
      if (miss.length) throw new Error('בקובץ חסרות עמודות: ' + miss.join(', '));
      const out = [];
      for (const r of rows.slice(h + 1)) {
        if (!r) continue;
        const bc = String(r[C.bc] == null ? '' : r[C.bc]).trim().replace(/\.0+$/, '');
        if (!/^\d{1,20}$/.test(bc)) continue;
        out.push({ barcode: bc, name: String(r[C.name] || '').trim(), lastDate: toDay(r[C.last]), lastQty: num(r[C.lq]), lastSum: num(r[C.ls]),
          salesSum: num(r[C.ss]), buySum: num(r[C.bs]), salesQty: num(r[C.sq]), buyQty: num(r[C.bq]) });
      }
      if (out.length) return out;
    }
    throw new Error('לא נמצאה בקובץ טבלה עם "ברקוד" ו"כמות מכירות" — זה הדוח "רכש מכר" מקומקס?');
  }
  function num(v) { if (v == null || v === '') return 0; const x = Number(String(v).replace(/[,₪\s]/g, '')); return isFinite(x) ? x : 0; }
  function toDay(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) { if (v.getFullYear() < 1990) return null; return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0'); }
    if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return d && d.y > 1990 ? d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0') : null; }
    const m = String(v).match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
    const m2 = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m2 ? m2[0] : null;
  }

  async function onFile(file) {
    const st = $('miFileSt'); if (st) st.textContent = 'קורא את הקובץ…';
    try {
      const rows = await readFile(file);
      W = compute(rows, { fileName: file.name });
      render();
      const sv = $('miSaveSt'); if (sv) sv.textContent = 'שומר…';
      const r = await apiPost({ action: 'meatSave', ...mAuth(), fromCount: sel.from, toCount: sel.to, fileName: file.name, rows, result: summaryOf(W) }).catch(() => ({ ok: false, error: 'אין חיבור' }));
      if (!r || !r.ok) { if ($('miSaveSt')) $('miSaveSt').innerHTML = '<span class="mi-badge mi-bad">השמירה נכשלה: ' + e((r && r.error) || '') + '</span>'; return; }
      await load(true);
    } catch (err) {
      if (st) st.innerHTML = '<span class="mi-badge mi-bad">' + e(err.message || err) + '</span>';
    }
  }

  /* ================= the computation ================= */
  function compute(rows, meta) {
    const to = countById(sel.to), from = countById(sel.from);
    const refDay = to ? to.day : ilDay(Date.now());
    const days = D.priceDays || 14;
    const file = {}; rows.forEach((r) => { file[r.barcode] = r; });
    const codes = new Set([...Object.keys(file), ...(to ? Object.keys(to.map) : []), ...(from ? Object.keys(from.map) : [])]);
    const warns = [];
    const entry = (bc) => {   // the last purchase entry known for a barcode (this file first, else the saved prices)
      const f = file[bc], p = D.priceMap[bc];
      const cand = [];
      if (f && f.lastDate && f.lastQty > 0 && f.lastSum > 0) cand.push({ date: f.lastDate, qty: f.lastQty, sum: f.lastSum });
      if (p && p.last_date && Number(p.last_qty) > 0 && Number(p.last_sum) > 0) cand.push({ date: String(p.last_date).slice(0, 10), qty: Number(p.last_qty), sum: Number(p.last_sum) });
      cand.sort((a, b) => (a.date < b.date ? 1 : -1));
      return cand[0] || null;
    };
    const nameOf = (bc) => (D.itemMap[bc] && D.itemMap[bc].name) || (file[bc] && file[bc].name) || (to && to.map[bc] && to.map[bc].name) || (from && from.map[bc] && from.map[bc].name) || bc;
    const memo = {};
    function price(bc, depth) {
      if (memo[bc]) return memo[bc];
      const it = D.itemMap[bc] || {}, en = entry(bc);
      const unit = en ? en.sum / en.qty : null;
      const age = en ? daysBetween(en.date, refDay) : null;
      let out;
      if (Number(it.manual_cost) > 0) out = { cost: Number(it.manual_cost), src: 'מחיר ידני מהקטלוג', how: 'manual' };
      else if (en && age <= days) out = { cost: unit, src: 'כניסה אחרונה ' + dmy(en.date) + ' · ' + kg(en.qty) + ' ק"ג ב-' + nis(en.sum), how: 'own', date: en.date };
      else if (it.kind === 'whole' && en) out = { cost: unit, src: 'כניסה אחרונה ' + dmy(en.date) + ' (לפני ' + age + ' ימים)', how: 'own', date: en.date, old: age > 60 };
      else {
        for (const step of (it.sources || [])) {
          if (depth > 3) break;
          const ps = step.map((s) => ({ s, p: price(s, (depth || 0) + 1), w: file[s] ? file[s].buyQty : 0 })).filter((x) => x.p && x.p.cost > 0);
          if (!ps.length) continue;
          const wsum = ps.reduce((a, x) => a + (x.w > 0 ? x.w : 0), 0);
          const cost = wsum > 0 ? ps.reduce((a, x) => a + x.p.cost * (x.w > 0 ? x.w : 0), 0) / wsum : ps.reduce((a, x) => a + x.p.cost, 0) / ps.length;
          out = { cost, how: 'source', src: 'לפי ' + ps.map((x) => nameOf(x.s) + ' ' + nis(x.p.cost, 2) + (wsum > 0 && x.w > 0 ? ' (' + kg(x.w, 0) + ' ק"ג נקנו)' : '')).join(' + ') + (wsum > 0 && ps.length > 1 ? ' — ממוצע לפי ק"ג' : ''),
            note: en ? 'הכניסה של הפריט עצמו (' + dmy(en.date) + ', ' + nis(unit, 2) + ') ישנה מ-' + days + ' ימים' : 'לפריט אין כניסה משלו' };
          break;
        }
        if (!out && en) out = { cost: unit, src: 'כניסה ישנה ' + dmy(en.date) + ' (לפני ' + age + ' ימים)', how: 'old', old: true };
        if (!out) out = { cost: null, src: 'אין מחיר', how: 'none' };
      }
      memo[bc] = out; return out;
    }
    const items = [];
    for (const bc of codes) {
      const it = D.itemMap[bc], f = file[bc] || {};
      const opening = from && from.map[bc] ? Number(from.map[bc].net) || 0 : 0;
      const closing = to && to.map[bc] ? Number(to.map[bc].net) || 0 : 0;
      const p = price(bc, 0);
      const r = { barcode: bc, name: nameOf(bc), grp: it ? it.grp : 'לא משויך', kind: it ? it.kind : 'ready', mapped: !!it,
        opening, buyQty: f.buyQty || 0, salesQty: f.salesQty || 0, closing, buySum: f.buySum || 0, salesSum: f.salesSum || 0,
        inFile: !!file[bc], counted: !!(to && to.map[bc]), cost: p.cost, costSrc: p.src, costNote: p.note, costHow: p.how, costOld: !!p.old, entry: entry(bc) };
      r.expected = r.opening + r.buyQty - r.salesQty;
      r.diff = r.expected - r.closing;                         // + = kg missing
      const c = r.cost || 0;
      r.openVal = r.opening * c; r.closeVal = r.closing * c;
      r.buyVal = r.buySum || r.buyQty * c;
      r.diffVal = r.diff * c;
      r.cogs = r.openVal + r.buyVal - r.closeVal;
      r.profit = r.salesSum - r.cogs;
      r.avgPrice = r.salesQty > 0.001 ? r.salesSum / r.salesQty : null;   // per item the margin per kg is what tells (a whole is sold as cuts)
      r.unitMargin = r.avgPrice != null && r.cost != null ? r.avgPrice - r.cost : null;
      r.unitMarginPct = r.unitMargin != null && r.avgPrice > 0 ? r.unitMargin / r.avgPrice * 100 : null;
      if (!(Math.abs(r.opening) + Math.abs(r.buyQty) + Math.abs(r.salesQty) + Math.abs(r.closing) > 0.001)) continue;
      items.push(r);
    }
    // warnings
    const noPrice = items.filter((r) => r.cost == null && (r.opening || r.closing || r.buyQty || r.salesQty));
    if (noPrice.length) warns.push('אין מחיר ל: ' + noPrice.map((r) => r.name).join(', ') + ' — אפשר לקבוע מחיר ידני בלשונית "קטלוג ומחירים".');
    const unm = items.filter((r) => !r.mapped);
    if (unm.length) warns.push('פריטים חדשים שלא משויכים לקבוצה: ' + unm.map((r) => r.name + ' (' + r.barcode + ')').join(', ') + ' — שייך אותם בלשונית "קטלוג ומחירים".');
    const old = items.filter((r) => r.costOld);
    if (old.length) warns.push('מחיר ישן (יותר מחודשיים): ' + old.map((r) => r.name + ' — ' + r.costSrc).join(' · '));
    const neg = items.filter((r) => r.kind !== 'whole' && r.diff < -5);
    if (!from) warns.push('אין ספירת פתיחה — מלאי הפתיחה נחשב 0, והפחת והרווח לא מדויקים.');
    if (to && from && rows.length) {
      const late = rows.filter((r) => r.lastDate && r.buyQty > 0 && r.lastDate > to.day);
      if (late.length) warns.push('בקובץ יש קניות שהכניסה האחרונה שלהן אחרי ספירת הסגירה (' + late.map((r) => r.name + ' ' + dmy(r.lastDate)).join(', ') + ') — ודא שהקובץ הופק לתקופה ' + dmy(from.day) + '–' + dmy(to.day) + '.');
    }
    // groups
    const groups = {};
    for (const r of items) {
      const g = groups[r.grp] = groups[r.grp] || { name: r.grp, opening: 0, buyQty: 0, salesQty: 0, closing: 0, buySum: 0, salesSum: 0, openVal: 0, closeVal: 0, buyVal: 0, diffVal: 0, cogs: 0, profit: 0, items: [] };
      ['opening', 'buyQty', 'salesQty', 'closing', 'buySum', 'salesSum', 'openVal', 'closeVal', 'buyVal', 'diffVal', 'cogs', 'profit'].forEach((k) => { g[k] += r[k] || 0; });
      g.items.push(r);
    }
    const T = { name: 'סה"כ', opening: 0, buyQty: 0, salesQty: 0, closing: 0, buySum: 0, salesSum: 0, openVal: 0, closeVal: 0, buyVal: 0, diffVal: 0, cogs: 0, profit: 0 };
    Object.values(groups).forEach((g) => {
      g.in = g.opening + g.buyQty; g.loss = g.in - g.salesQty - g.closing; g.lossPct = g.in > 0.001 ? g.loss / g.in * 100 : null;
      g.margin = g.salesSum > 0 ? g.profit / g.salesSum * 100 : null;
      Object.keys(T).forEach((k) => { if (k !== 'name') T[k] += g[k]; });
    });
    T.in = T.opening + T.buyQty; T.loss = T.in - T.salesQty - T.closing; T.lossPct = T.in > 0.001 ? T.loss / T.in * 100 : null; T.margin = T.salesSum > 0 ? T.profit / T.salesSum * 100 : null;
    return { rows, items, groups, T, warns, meta: meta || {}, from, to, neg };
  }
  function summaryOf(w) {
    const g = {};
    Object.values(w.groups).forEach((x) => { g[x.name] = { in: r2(x.in), sold: r2(x.salesQty), closing: r2(x.closing), loss: r2(x.loss), lossPct: x.lossPct == null ? null : r2(x.lossPct), lossVal: r2(x.diffVal), sales: r2(x.salesSum), profit: r2(x.profit), margin: x.margin == null ? null : r2(x.margin), stock: r2(x.closeVal) }; });
    const T = w.T;
    return { groups: g, total: { in: r2(T.in), sold: r2(T.salesQty), closing: r2(T.closing), loss: r2(T.loss), lossPct: T.lossPct == null ? null : r2(T.lossPct), lossVal: r2(T.diffVal), sales: r2(T.salesSum), profit: r2(T.profit), margin: T.margin == null ? null : r2(T.margin), stock: r2(T.closeVal) }, priceDays: D.priceDays };
  }
  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

  /* ================= render ================= */
  function render() {
    charts.forEach((c) => { try { c.destroy(); } catch (x) {} }); charts = [];
    document.querySelectorAll('#miTabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    const body = $('miBody');
    if (!D) return;
    if (tab === 'hist') return renderHist(body);
    if (tab === 'counts') return renderCounts(body);
    if (tab === 'cat') return renderCat(body);
    renderWeek(body);
  }
  const thr = () => Number(LS('thr')) || 8;
  const lossCls = (p) => (p == null ? 'mi-mute' : p >= thr() ? 'mi-bad' : p >= thr() / 2 ? 'mi-warn' : 'mi-ok');

  function countOpt(c, selId) { return '<option value="' + c.id + '"' + (c.id === selId ? ' selected' : '') + '>' + dmy(c.day) + ' ' + hm(c.counted_at) + ' · ' + e(c.performed_by || '') + ' · ' + (c.items || []).length + ' פריטים</option>'; }

  function renderWeek(body) {
    if (!D.counts.length) { body.innerHTML = '<div class="mi-empty">עוד אין ספירות. הספירות נכנסות לכאן לבד כששולחים את טופס ספירת הבשר.</div>'; return; }
    const to = countById(sel.to), from = countById(sel.from);
    const saved = D.reports.find((r) => r.to_count === sel.to && (r.from_count || null) === (sel.from || null));
    let h = '<div class="mi-card"><div class="mi-row">' +
      '<label>ספירת סגירה<select id="miTo">' + D.counts.map((c) => countOpt(c, sel.to)).join('') + '</select></label>' +
      '<label>ספירת פתיחה<select id="miFrom"><option value="">— ללא (פתיחה 0) —</option>' + D.counts.filter((c) => to && c.counted_at < to.counted_at).map((c) => countOpt(c, sel.from)).join('') + '</select></label>' +
      '<label>סף התראת פחת %<input id="miThr" type="number" min="1" max="50" step="0.5" value="' + thr() + '" style="width:80px"></label>' +
      '<span style="flex:1"></span>' + (W ? '<button class="mi-btn ghost" id="miXls">⬇ ייצוא לאקסל</button>' : '') + '</div>';
    const period = from && to ? dmy(from.day) + ' עד ' + dmy(to.day) : to ? 'עד ' + dmy(to.day) : '';
    h += '<div style="margin-top:12px"><input type="file" id="miFile" accept=".xlsx,.xls,.html,.htm" hidden>' +
      '<div class="mi-drop" id="miDrop">' + (saved ? '🔁 החלפת קובץ רכש ומכר לשבוע הזה' : '📦 העלאת קובץ "רכש מכר" מקומקס') +
      '<small>התקופה: ' + e(period) + ' — הפק בקומקס את הדוח לתאריכים האלה בדיוק. גרור לכאן או לחץ.</small></div>' +
      '<div id="miFileSt" style="margin-top:6px;font-size:13px"></div><div id="miSaveSt" style="font-size:13px"></div>' +
      (saved ? '<div class="mi-note">נשמר ע"י ' + e(saved.uploaded_by) + ' ב-' + dmy(ilDay(saved.uploaded_at)) + ' ' + hm(saved.uploaded_at) + ' · קובץ: ' + e(saved.file_name) + '</div>' : '') + '</div></div>';
    if (!W) {
      h += '<div class="mi-empty">' + (saved ? 'טוען את השבוע…' : 'בחר ספירות והעלה את קובץ הרכש והמכר מקומקס לתקופה ' + e(period) + '.<br>הספירות עצמן כבר כאן — מטופס ספירת הבשר.') + '</div>';
      body.innerHTML = h; wireWeek(); return;
    }
    const T = W.T;
    if (W.warns.length) h += '<div class="mi-warns"><b>⚠ לבדיקה</b><ul>' + W.warns.map((w) => '<li>' + e(w) + '</li>').join('') + '</ul></div>';
    h += '<div class="mi-kpis">' +
      kpi('linear-gradient(135deg,#0f766e,#14b8a6)', '🛒', 'מכירות (כולל מע"מ)', nis(T.salesSum), kg(T.salesQty, 0) + ' ק"ג נמכרו') +
      kpi('linear-gradient(135deg,#15803d,#22c55e)', '💰', 'רווח גולמי', nis(T.profit), pct(T.margin) + ' מהמכירות') +
      kpi('linear-gradient(135deg,#b91c1c,#f97316)', '🦴', 'פחת (עצמות, שאריות, חיתוך)', kg(T.loss, 1) + ' ק"ג', pct(T.lossPct) + ' מהנכנס · ' + nis(T.diffVal)) +
      kpi('linear-gradient(135deg,#4a0d18,#9f1239)', '📦', 'מלאי בספירת הסגירה', nis(T.closeVal), kg(T.closing, 0) + ' ק"ג') +
      kpi('linear-gradient(135deg,#78350f,#d97706)', '🚚', 'קניות בתקופה', nis(T.buyVal), kg(T.buyQty, 0) + ' ק"ג') + '</div>';
    h += '<div class="mi-groups">' + GROUPS.filter((g) => W.groups[g]).map((g) => groupCard(W.groups[g])).join('') + '</div>';
    h += '<div class="mi-card"><h3>פירוט פריטים <small>לחיצה על פריט מציגה איך חושבה העלות ואת פירוט הספירה</small></h3><div class="mi-row" style="margin-bottom:8px">' +
      '<input class="mi-in" id="miQ" placeholder="חיפוש פריט או ברקוד" value="' + e(LS('q') || '') + '" style="flex:1;min-width:160px">' +
      '<select class="mi-in" id="miG"><option value="">כל הקבוצות</option>' + GROUPS.filter((g) => W.groups[g]).map((g) => '<option' + (LS('g') === g ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></div>' +
      '<div class="mi-scroll"><table class="mi-tbl" id="miTbl"></table></div>' +
      '<div class="mi-note">כל הסכומים כולל מע"מ. עלות לק"ג = סכום הכניסה האחרונה ÷ כמות הכניסה האחרונה, אם הכניסה עד ' + D.priceDays + ' ימים לפני ספירת הסגירה; אחרת — לפי השלם שממנו הנתח נחתך (ממוצע לפי הק"ג שנקנו בתקופה). ' +
      'הפרש = פתיחה + קניות − מכירות − סגירה (חיובי = חסר). רווח לק"ג = מחיר מכירה ממוצע − עלות לק"ג. בשלם ההפרש גדול כי הוא הפך לנתחים — הפחת האמיתי הוא סכום הקבוצה. רווח גולמי = מכירות − (שווי פתיחה + קניות − שווי סגירה).</div></div>';
    body.innerHTML = h; wireWeek(); drawItems();
  }
  function kpi(bg, ic, l, v, d) { return '<div class="mi-kpi" style="background:' + bg + '"><span class="ic">' + ic + '</span><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>'; }
  function groupCard(g) {
    const c = GCOL[g.name] || '#64748b', cls = lossCls(g.lossPct);
    const sold = g.in > 0 ? Math.max(0, g.salesQty / g.in * 100) : 0, left = g.in > 0 ? Math.max(0, g.closing / g.in * 100) : 0, lost = Math.max(0, 100 - sold - left);
    return '<div class="mi-g' + (LS('g') === g.name ? ' on' : '') + '" style="--c:' + c + '" data-g="' + e(g.name) + '"><h4><span>' + e(g.name) + '</span><span class="mi-badge ' + cls + '">פחת ' + pct(g.lossPct) + '</span></h4>' +
      '<div class="flow"><div><b>' + kg(g.opening, 0) + '</b><span>פתיחה</span></div><div><b>' + kg(g.buyQty, 0) + '</b><span>קניות</span></div><div><b>' + kg(g.salesQty, 0) + '</b><span>נמכר</span></div><div><b>' + kg(g.closing, 0) + '</b><span>נשאר</span></div></div>' +
      '<div class="mi-bar" title="נמכר / נשאר / פחת"><i style="width:' + sold + '%;background:#16a34a;float:right"></i><i style="width:' + left + '%;background:#a8a29e;float:right"></i><i style="width:' + lost + '%;background:#dc2626;float:right"></i></div>' +
      '<div class="line"><span>פחת</span><b class="' + (g.loss > 0 ? 'neg' : 'pos') + '">' + kg(g.loss) + ' ק"ג · ' + nis(g.diffVal) + '</b></div>' +
      '<div class="line"><span>מכירות</span><b>' + nis(g.salesSum) + '</b></div>' +
      '<div class="line"><span>עלות המכר</span><b>' + nis(g.cogs) + '</b></div>' +
      '<div class="line"><span>רווח גולמי</span><b class="' + (g.profit < 0 ? 'neg' : 'pos') + '">' + nis(g.profit) + ' · ' + pct(g.margin) + '</b></div>' +
      '<div class="line"><span>שווי מלאי בסגירה</span><b>' + nis(g.closeVal) + '</b></div></div>';
  }
  function wireWeek() {
    $('miTo')?.addEventListener('change', (ev) => { sel.to = Number(ev.target.value); sel.from = prevOf(sel.to); showWeek(); });
    $('miFrom')?.addEventListener('change', (ev) => { sel.from = ev.target.value ? Number(ev.target.value) : null; showWeek(); });
    $('miThr')?.addEventListener('change', (ev) => { LS('thr', String(Number(ev.target.value) || 8)); render(); });
    const drop = $('miDrop'), fi = $('miFile');
    if (drop) {
      drop.addEventListener('click', () => fi.click());
      fi.addEventListener('change', () => { if (fi.files[0]) onFile(fi.files[0]); });
      drop.addEventListener('dragover', (ev) => { ev.preventDefault(); drop.style.background = '#fdf0e3'; });
      drop.addEventListener('drop', (ev) => { ev.preventDefault(); if (ev.dataTransfer.files[0]) onFile(ev.dataTransfer.files[0]); });
    }
    $('miXls')?.addEventListener('click', exportXlsx);
    $('miQ')?.addEventListener('input', (ev) => { LS('q', ev.target.value); drawItems(); });
    $('miG')?.addEventListener('change', (ev) => { LS('g', ev.target.value); render(); });
    document.querySelectorAll('.mi-g').forEach((el) => el.addEventListener('click', () => { LS('g', LS('g') === el.dataset.g ? '' : el.dataset.g); render(); }));
  }
  const COLS = [['name', 'פריט'], ['cost', 'עלות לק"ג'], ['opening', 'פתיחה'], ['buyQty', 'קניות'], ['salesQty', 'מכירות'], ['closing', 'סגירה'], ['diff', 'הפרש ק"ג'], ['salesSum', 'מכירות ₪'], ['avgPrice', 'מחיר מכירה לק"ג'], ['unitMargin', 'רווח לק"ג'], ['closeVal', 'שווי מלאי']];
  function drawItems() {
    const t = $('miTbl'); if (!t || !W) return;
    const q = (LS('q') || '').trim(), gsel = LS('g') || '';
    let h = '<tr>' + COLS.map(([k, l]) => '<th data-k="' + k + '"' + (k === 'name' ? '' : ' class="n"') + '>' + l + (sortK === k ? (sortD < 0 ? ' ▼' : ' ▲') : '') + '</th>').join('') + '</tr>';
    for (const g of GROUPS) {
      const G = W.groups[g]; if (!G || (gsel && gsel !== g)) continue;
      let its = G.items.filter((r) => !q || r.name.includes(q) || r.barcode.includes(q));
      if (!its.length) continue;
      const ord = { whole: 0, cut: 1, ready: 2 };
      its = its.slice().sort(sortK ? (a, b) => (typeof a[sortK] === 'string' ? sortD * String(a[sortK]).localeCompare(String(b[sortK]), 'he') : sortD * ((a[sortK] ?? -1e18) - (b[sortK] ?? -1e18))) : (a, b) => (ord[a.kind] - ord[b.kind]) || (b.salesSum - a.salesSum));
      h += '<tr class="gh"><td colspan="10" style="border-right:5px solid ' + (GCOL[g] || '#999') + '">' + e(g) + ' · ' + its.length + ' פריטים</td></tr>';
      for (const r of its) {
        const kb = '<span class="mi-badge ' + (r.kind === 'whole' ? 'mi-warn' : r.kind === 'ready' ? 'mi-mute' : 'mi-ok') + '">' + KIND[r.kind] + '</span>';
        const cb = r.costHow === 'none' ? '<span class="mi-badge mi-bad">אין מחיר</span>' : r.costHow === 'source' ? '<small>לפי שלם</small>' : r.costHow === 'manual' ? '<small>ידני</small>' : r.costOld ? '<span class="mi-badge mi-warn">ישן</span>' : '<small>כניסה ' + dm(r.entry && r.entry.date) + '</small>';
        h += '<tr class="it" data-bc="' + r.barcode + '"><td>' + e(r.name) + ' ' + kb + '<br><small>' + r.barcode + '</small></td>' +
          '<td class="n">' + nis(r.cost, 2) + '<br>' + cb + '</td><td class="n">' + kg(r.opening, 2) + '</td><td class="n">' + kg(r.buyQty, 2) + '</td><td class="n">' + kg(r.salesQty, 2) + '</td>' +
          '<td class="n">' + kg(r.closing, 2) + (r.counted || !W.to ? '' : '<br><small>לא נספר</small>') + '</td>' +
          '<td class="n ' + (r.kind !== 'whole' && r.diff > 0.05 ? 'neg' : r.diff < -0.05 ? 'pos' : '') + '">' + kg(r.diff, 2) + '</td>' +
          '<td class="n">' + nis(r.salesSum) + '</td><td class="n">' + nis(r.avgPrice, 2) + '</td><td class="n ' + (r.unitMargin < 0 ? 'neg' : r.unitMargin > 0 ? 'pos' : '') + '">' + (r.unitMargin == null ? '—' : nis(r.unitMargin, 2) + '<br><small>' + pct(r.unitMarginPct) + '</small>') + '</td><td class="n">' + nis(r.closeVal) + '</td></tr>';
        if (openRow === r.barcode) h += '<tr class="det"><td colspan="10">' + detail(r) + '</td></tr>';
      }
      h += '<tr class="gt"><td>סה"כ ' + e(g) + '</td><td></td><td class="n">' + kg(G.opening) + '</td><td class="n">' + kg(G.buyQty) + '</td><td class="n">' + kg(G.salesQty) + '</td><td class="n">' + kg(G.closing) + '</td>' +
        '<td class="n ' + (G.loss > 0 ? 'neg' : 'pos') + '">' + kg(G.loss) + '<br><small>' + pct(G.lossPct) + '</small></td><td class="n">' + nis(G.salesSum) + '</td><td class="n" colspan="2">רווח גולמי ' + nis(G.profit) + '<br><small>' + pct(G.margin) + ' מהמכירות</small></td><td class="n">' + nis(G.closeVal) + '</td></tr>';
    }
    t.innerHTML = h;
    t.querySelectorAll('th').forEach((th) => th.addEventListener('click', () => { const k = th.dataset.k; if (sortK === k) sortD *= -1; else { sortK = k; sortD = -1; } drawItems(); }));
    t.querySelectorAll('tr.it').forEach((tr) => tr.addEventListener('click', () => { openRow = openRow === tr.dataset.bc ? null : tr.dataset.bc; drawItems(); }));
  }
  function detail(r) {
    const lines = [];
    lines.push('<b>עלות לק"ג:</b> ' + nis(r.cost, 2) + ' — ' + e(r.costSrc) + (r.costNote ? ' <small>(' + e(r.costNote) + ')</small>' : ''));
    lines.push('<b>חישוב:</b> פתיחה ' + kg(r.opening, 2) + ' + קניות ' + kg(r.buyQty, 2) + ' − מכירות ' + kg(r.salesQty, 2) + ' = צפוי ' + kg(r.expected, 2) + ' ק"ג · נספר ' + kg(r.closing, 2) + ' · הפרש ' + kg(r.diff, 2) + ' ק"ג (' + nis(r.diffVal) + ')');
    if (r.salesQty > 0) lines.push('<b>מכירה:</b> ' + nis(r.salesSum) + ' על ' + kg(r.salesQty, 2) + ' ק"ג = ' + nis(r.avgPrice, 2) + ' לק"ג · רווח ' + nis(r.unitMargin, 2) + ' לק"ג (' + pct(r.unitMarginPct) + ')');
    lines.push('<b>שווי:</b> פתיחה ' + nis(r.openVal) + ' · קניות ' + nis(r.buyVal) + ' · סגירה ' + nis(r.closeVal));
    if (r.kind === 'whole') lines.push('<small>זה פריט שנקנה שלם — הוא מתפרק לנתחים, ולכן ההפרש שלו גדול. הפחת האמיתי הוא של הקבוצה כולה.</small>');
    if (!r.inFile) lines.push('<small>הפריט לא הופיע בקובץ הרכש והמכר — אין לו קניות או מכירות בתקופה.</small>');
    const ent = W.to && W.to.map[r.barcode];
    if (ent) lines.push('<b>בספירת הסגירה:</b> ' + kg(ent.net, 2) + ' ק"ג (' + e(W.to.performed_by || '') + ', ' + dmy(W.to.day) + ')');
    return lines.join('<br>');
  }

  /* ================= history ================= */
  async function renderHist(body) {
    const reps = D.reports.slice().sort((a, b) => (a.period_to < b.period_to ? -1 : 1));
    if (!reps.length) { body.innerHTML = '<div class="mi-empty">עוד אין שבועות שמורים. כל שבוע שתעלה לו קובץ רכש ומכר יישמר כאן.</div>'; return; }
    const gs = GROUPS.filter((g) => reps.some((r) => r.result && r.result.groups && r.result.groups[g]));
    let h = '<div class="mi-card"><h3>פחת ורווח לאורך השבועות</h3><div style="height:260px"><canvas id="miC1"></canvas></div></div>';
    h += '<div class="mi-card"><h3>כל השבועות <small>לחיצה פותחת את השבוע</small></h3><div class="mi-scroll"><table class="mi-tbl"><tr><th>תקופה</th><th class="n">מכירות</th><th class="n">רווח</th><th class="n">פחת כולל</th>' +
      gs.map((g) => '<th class="n">' + e(g) + '<br><small>פחת % · ₪</small></th>').join('') + '<th>הועלה</th></tr>';
    for (const r of reps.slice().reverse()) {
      const t = (r.result && r.result.total) || {};
      h += '<tr class="it" data-to="' + r.to_count + '" data-from="' + (r.from_count || '') + '"><td><b>' + (r.period_from ? dmy(r.period_from) + '–' : '') + dmy(r.period_to) + '</b></td><td class="n">' + nis(t.sales) + '</td>' +
        '<td class="n">' + nis(t.profit) + '<br><small>' + pct(t.margin) + '</small></td><td class="n"><span class="mi-badge ' + lossCls(t.lossPct) + '">' + pct(t.lossPct) + '</span><br><small>' + nis(t.lossVal) + '</small></td>' +
        gs.map((g) => { const x = r.result.groups[g]; return '<td class="n">' + (x ? '<span class="mi-badge ' + lossCls(x.lossPct) + '">' + pct(x.lossPct) + '</span><br><small>' + nis(x.lossVal) + '</small>' : '—') + '</td>'; }).join('') +
        '<td><small>' + e(r.uploaded_by || '') + '</small></td></tr>';
    }
    h += '</table></div></div>';
    body.innerHTML = h;
    body.querySelectorAll('tr.it').forEach((tr) => tr.addEventListener('click', () => { sel.to = Number(tr.dataset.to); sel.from = tr.dataset.from ? Number(tr.dataset.from) : null; tab = 'week'; showWeek(); }));
    try {
      if (!window.Chart) await loadScript(CHART_URL);
      const labels = reps.map((r) => dm(r.period_to));
      const ds = gs.map((g) => ({ label: 'פחת ' + g + ' %', data: reps.map((r) => (r.result.groups[g] ? r.result.groups[g].lossPct : null)), borderColor: GCOL[g], backgroundColor: GCOL[g], tension: .3, spanGaps: true, yAxisID: 'y' }));
      ds.push({ label: 'רווח גולמי %', data: reps.map((r) => r.result.total && r.result.total.margin), borderColor: '#16a34a', backgroundColor: '#16a34a', borderDash: [6, 4], tension: .3, yAxisID: 'y' });
      charts.push(new window.Chart($('miC1'), { type: 'line', data: { labels, datasets: ds }, options: { maintainAspectRatio: false, plugins: { legend: { rtl: true, position: 'bottom' } }, scales: { y: { ticks: { callback: (v) => v + '%' } } } } }));
    } catch (x) { /* no chart offline */ }
  }

  /* ================= counts ================= */
  function renderCounts(body) {
    let h = '<div class="mi-info">הספירות נכנסות לכאן לבד מטופס ספירת הבשר (כל שליחה = ספירה). ספירה שנשלחה בטעות אפשר למחוק.</div><div class="mi-card"><div class="mi-scroll"><table class="mi-tbl"><tr><th>תאריך</th><th>מבצע הספירה</th><th class="n">פריטים</th><th class="n">ק"ג</th><th>שבוע שמור</th><th></th></tr>';
    for (const c of D.counts) {
      const tot = (c.items || []).reduce((a, x) => a + (Number(x.net) || 0), 0);
      const rep = D.reports.find((r) => r.to_count === c.id);
      h += '<tr class="it" data-id="' + c.id + '"><td><b>' + dmy(c.day) + '</b> ' + hm(c.counted_at) + '</td><td>' + e(c.performed_by || '') + '</td><td class="n">' + (c.items || []).length + '</td><td class="n">' + kg(tot, 1) + '</td>' +
        '<td>' + (rep ? '<span class="mi-badge mi-ok">כן</span>' : '<span class="mi-badge mi-mute">לא</span>') + '</td><td><button class="mi-btn ghost" data-del="' + c.id + '" style="padding:3px 9px">מחיקה</button></td></tr>';
      if (openRow === 'c' + c.id) h += '<tr class="det"><td colspan="6">' + (c.items || []).map((x) => e(x.name) + ' <small>(' + e(x.code) + ')</small>: <b>' + kg(x.net, 2) + '</b>').join(' · ') + '</td></tr>';
    }
    body.innerHTML = h + '</table></div></div>';
    body.querySelectorAll('tr.it').forEach((tr) => tr.addEventListener('click', (ev) => { if (ev.target.closest('[data-del]')) return; openRow = openRow === 'c' + tr.dataset.id ? null : 'c' + tr.dataset.id; renderCounts(body); }));
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const c = countById(Number(b.dataset.del));
      if (!c || !window.confirm('למחוק את הספירה מ-' + dmy(c.day) + ' ' + hm(c.counted_at) + '? השבוע שנשמר עליה יימחק גם הוא.')) return;
      const r = await apiPost({ action: 'meatCountDelete', ...mAuth(), id: c.id }).catch(() => null);
      if (r && r.ok) load(); else b.textContent = 'נכשל';
    }));
  }

  /* ================= catalog ================= */
  function renderCat(body) {
    const src2txt = (s) => (s || []).map((step) => step.join(', ')).join(' | ');
    const bcs = new Set(D.items.map((i) => String(i.barcode)));
    // barcodes seen in counts / prices but not in the catalog
    const extra = new Map();
    D.counts.forEach((c) => (c.items || []).forEach((x) => { if (!bcs.has(String(x.code))) extra.set(String(x.code), x.name); }));
    D.prices.forEach((p) => { if (!bcs.has(String(p.barcode))) extra.set(String(p.barcode), p.name); });
    const rows = D.items.map((i) => ({ ...i, isNew: false })).concat([...extra].map(([b, nm]) => ({ barcode: b, name: nm, grp: 'לא משויך', kind: 'cut', sources: [], manual_cost: null, isNew: true })));
    let h = '<div class="mi-info">כאן קובעים לכל פריט: לאיזו קבוצה הוא שייך, אם הוא נקנה <b>שלם</b>, הוא <b>חלק</b> שנחתך משלם או נקנה <b>מוכן</b>, ומאילו שלמים הוא נחתך. ' +
      'בעמודת "נחתך מ" כותבים ברקודים של השלמים מופרדים בפסיק (ממוצע ביניהם), ו-| לחלופה אם לראשונים אין מחיר. "מחיר ידני" (כולל מע"מ, לק"ג) גובר על הכל.</div>';
    h += '<div class="mi-card"><div class="mi-row" style="margin-bottom:10px"><label>כניסה אחרונה תקפה עד (ימים לפני הספירה)<input id="miDays" type="number" min="1" max="365" value="' + D.priceDays + '" style="width:90px"></label>' +
      '<span style="flex:1"></span><button class="mi-btn" id="miCatSave">💾 שמירה</button><span id="miCatSt" style="font-size:13px"></span></div>' +
      '<div class="mi-scroll"><table class="mi-tbl" id="miCat"><tr><th>ברקוד</th><th>שם</th><th>קבוצה</th><th>סוג</th><th>נחתך מ</th><th class="n">מחיר ידני</th><th>כניסה אחרונה ידועה</th><th>הסרה</th></tr>';
    for (const i of rows) {
      const p = D.priceMap[String(i.barcode)];
      h += '<tr data-bc="' + e(i.barcode) + '"' + (i.isNew ? ' style="background:#fff7ed"' : '') + '><td class="n">' + e(i.barcode) + (i.isNew ? '<br><span class="mi-badge mi-warn">חדש</span>' : '') + '</td>' +
        '<td><input class="mi-in" data-f="name" value="' + e(i.name || '') + '" style="width:170px"></td>' +
        '<td><select class="mi-in" data-f="grp">' + GROUPS.map((g) => '<option' + (g === i.grp ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></td>' +
        '<td><select class="mi-in" data-f="kind">' + Object.entries(KIND).map(([k, l]) => '<option value="' + k + '"' + (k === i.kind ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></td>' +
        '<td><input class="mi-in" data-f="sources" value="' + e(src2txt(i.sources)) + '" style="width:190px;direction:ltr" placeholder="888006, 888009"><br><small>' + e((i.sources || []).map((st) => st.map((b) => (D.itemMap[b] && D.itemMap[b].name) || b).join(' + ')).join(' | ')) + '</small></td>' +
        '<td><input class="mi-in" data-f="manual" type="number" step="0.01" min="0" value="' + (i.manual_cost == null ? '' : Number(i.manual_cost)) + '" style="width:85px"></td>' +
        '<td><small>' + (p ? dmy(String(p.last_date)) + ' · ' + kg(p.last_qty) + ' ק"ג · ' + nis(p.last_sum) + '<br><b>' + nis(p.last_sum / p.last_qty, 2) + ' לק"ג</b>' : '—') + '</small></td>' +
        '<td>' + (i.isNew ? '' : '<input type="checkbox" data-f="rm">') + '</td></tr>';
    }
    body.innerHTML = h + '</table></div></div>';
    $('miCatSave').addEventListener('click', async () => {
      const items = [], remove = [];
      document.querySelectorAll('#miCat tr[data-bc]').forEach((tr) => {
        const g = (f) => tr.querySelector('[data-f="' + f + '"]');
        if (g('rm') && g('rm').checked) { remove.push(tr.dataset.bc); return; }
        const isNew = !!tr.querySelector('.mi-warn');
        if (isNew && g('grp').value === 'לא משויך') return;   // a new barcode is added only once given a group
        items.push({ barcode: tr.dataset.bc, name: g('name').value.trim(), grp: g('grp').value, kind: g('kind').value,
          sources: g('sources').value.split('|').map((s) => s.split(/[,\s]+/).map((b) => b.trim()).filter(Boolean)).filter((s) => s.length), manualCost: g('manual').value });
      });
      $('miCatSt').textContent = 'שומר…';
      const r = await apiPost({ action: 'meatItemsSave', ...mAuth(), items, remove, days: Number($('miDays').value) || 14 }).catch(() => null);
      if (r && r.ok) { $('miCatSt').innerHTML = '<span class="mi-badge mi-ok">נשמר</span>'; await load(true); tab = 'cat'; render(); }
      else $('miCatSt').innerHTML = '<span class="mi-badge mi-bad">' + e((r && r.error) || 'השמירה נכשלה') + '</span>';
    });
  }

  /* ================= Excel ================= */
  async function exportXlsx() {
    await loadScript(XURL);
    const per = (W.from ? dmy(W.from.day) + '–' : '') + (W.to ? dmy(W.to.day) : '');
    const sum = [['מלאי בשר · סופרסטאר פלוס · ' + per + ' · כל הסכומים כולל מע"מ'], [],
      ['קבוצה', 'פתיחה ק"ג', 'קניות ק"ג', 'נמכר ק"ג', 'סגירה ק"ג', 'פחת ק"ג', '% פחת', 'שווי פחת', 'מכירות', 'עלות המכר', 'רווח גולמי', '% רווח', 'שווי מלאי סגירה']];
    const gl = GROUPS.filter((g) => W.groups[g]).map((g) => W.groups[g]).concat([W.T]);
    gl.forEach((g) => sum.push([g.name, r2(g.opening), r2(g.buyQty), r2(g.salesQty), r2(g.closing), r2(g.loss), g.lossPct == null ? '' : r2(g.lossPct) / 100, r2(g.diffVal), r2(g.salesSum), r2(g.cogs), r2(g.profit), g.margin == null ? '' : r2(g.margin) / 100, r2(g.closeVal)]));
    const its = [['קבוצה', 'ברקוד', 'פריט', 'סוג', 'עלות לק"ג', 'מקור העלות', 'פתיחה', 'קניות', 'מכירות', 'סגירה', 'הפרש ק"ג', 'שווי הפרש', 'סכום קניות', 'סכום מכירות', 'שווי סגירה', 'מחיר מכירה לק"ג', 'רווח לק"ג']];
    GROUPS.forEach((g) => (W.groups[g] ? W.groups[g].items : []).forEach((r) => its.push([g, r.barcode, r.name, KIND[r.kind], r.cost == null ? '' : r2(r.cost), r.costSrc, r2(r.opening), r2(r.buyQty), r2(r.salesQty), r2(r.closing), r2(r.diff), r2(r.diffVal), r2(r.buyVal), r2(r.salesSum), r2(r.closeVal), r.avgPrice == null ? '' : r2(r.avgPrice), r.unitMargin == null ? '' : r2(r.unitMargin)])));
    const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
    const s1 = XLSX.utils.aoa_to_sheet(sum); s1['!cols'] = [{ wch: 14 }].concat(Array(12).fill({ wch: 12 }));
    for (let i = 4; i <= sum.length; i++) { ['G', 'L'].forEach((c) => { if (s1[c + i] && s1[c + i].t === 'n') s1[c + i].z = '0.0%'; }); ['H', 'I', 'J', 'K', 'M'].forEach((c) => { if (s1[c + i]) s1[c + i].z = '"₪"#,##0'; }); }
    const s2 = XLSX.utils.aoa_to_sheet(its); s2['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 22 }, { wch: 6 }, { wch: 9 }, { wch: 40 }].concat(Array(10).fill({ wch: 10 })); s2['!autofilter'] = { ref: 'A1:Q' + its.length };
    XLSX.utils.book_append_sheet(wb, s1, 'סיכום'); XLSX.utils.book_append_sheet(wb, s2, 'פריטים');
    XLSX.writeFile(wb, 'מלאי בשר ' + per.replace(/\//g, '-') + '.xlsx');
  }

  function start() {
    const drop = $('menuAdminDrop');
    if (drop && !$('miMgrBtn')) {
      const anchor = $('sdMgrBtn');
      const html = '<button id="miMgrBtn" style="display:none">🥩 מלאי בשר</button>';
      if (anchor) anchor.insertAdjacentHTML('afterend', html); else drop.insertAdjacentHTML('afterbegin', html);
      $('miMgrBtn').addEventListener('click', open);
      const show = () => { $('miMgrBtn').style.display = isAdmin() ? '' : 'none'; };
      $('menuAdminBtn')?.addEventListener('click', show, true);
      show();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openMeatInv = open;
  window._meatCompute = (rows, data, s) => { D = data; sel = s; return compute(rows, {}); };   // tests
})();
