// 🚦 חדר בקרה (14/11/2026, the owner — after looking at boosty.ai's "control room": one screen, what is off comes first;
// "the UI is very important — don't make it complicated"). Admin only: 💼 ניהול העסק ▸ דוחות ▸ 🚦 חדר בקרה (the first
// item; its red number = the things to handle, also on the closed sub-menu's title — menus.js).
// Nothing new is collected — it reads what is already here:
//   api biControl (sales-bi.ts → bi_control, migration 20261114100000): yesterday's sales / today so far against the same
//     weekday, the departments falling (7 days against the 4 weeks before), products sold under their cost (14 days,
//     with the promotions' discounts), archived items with stock, the clock's missing exits, the missed tasks, the
//     regular club customers who stopped coming, the store PC's last push
//   api biAssortment (the last whole month) + assortment.js's compute: the MQI and the best sellers out of stock
//   the site's /data/promos-he.json (Last-Modified): the promotions on the site
//   🗂 the branch file (14/11/2026): deadlines late / within 30 days, faults open (biControl's bfDue / bfCalls)
//   💬 the customers' feedback (14/11/2026): messages to handle (✓ טופל), the ratings of 30 days (biControl's feedback)
// Three kinds: 🔴 to handle now · 🟠 to check · 🔵 good to know (not in the number) · ✓ all right (one line, at the end).
// Each one opens the screen that handles it (the dashboard, the optimizer, the attendance report, the tasks) or a list.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const XS_URL = '/vendor/xlsx-js-style-1.2.0.min.js';
  const nis = (v) => '₪' + Math.round(Number(v || 0)).toLocaleString('he-IL');
  const num = (v, d) => Number(v || 0).toLocaleString('he-IL', { maximumFractionDigits: d == null ? 0 : d });
  const dm = (s) => s ? String(s).slice(8, 10) + '/' + String(s).slice(5, 7) : '';
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayName = (s) => DAYS[new Date(String(s).slice(0, 10) + 'T12:00:00').getDay()];
  const hm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const ymOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const RANK = { red: 0, amber: 1, info: 2, ok: 3 };
  let C = null, M = null, cards = [], at = 0, busy = false, openKey = '';

  // the look (14/11/2026, the owner: "make it catch the eye"): a dark hero with the health ring and four tiles,
  // the cards grouped by level with tinted icon chips, a soft entry, the all-right ones as chips
  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#crOv{position:fixed;inset:0;z-index:9000;background:#eef2f7;overflow:auto;direction:rtl;font-family:inherit;color:#0f172a}#crOv.hidden{display:none}' +
    '.cr-top{position:sticky;top:0;z-index:3;background:rgba(11,18,32,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#fff;padding:10px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.08)}' +
    '.cr-top h2{margin:0;font-size:17px;font-weight:900}.cr-top .sp{flex:1}' +
    '.cr-top button{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:7px 13px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;transition:background .15s,transform .1s}' +
    '.cr-top button:hover{background:rgba(255,255,255,.2)}.cr-top button:active{transform:scale(.96)}' +
    '.cr-hero{position:relative;overflow:hidden;color:#fff;padding:22px 16px 74px;background:radial-gradient(900px 340px at 85% -10%,rgba(0,118,218,.55),transparent 60%),radial-gradient(700px 300px at 5% 110%,rgba(124,58,237,.45),transparent 60%),linear-gradient(160deg,#0b1220,#111c33 60%,#0b1220)}' +
    '.cr-hero::after{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:18px 18px;pointer-events:none}' +
    '.cr-hin{position:relative;z-index:1;max-width:900px;margin:0 auto;display:flex;align-items:center;gap:22px}' +
    '.cr-ring{--p:0;--c:#22c55e;flex:none;width:118px;height:118px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--c) calc(var(--p)*1%),rgba(255,255,255,.1) 0);box-shadow:0 0 40px -6px var(--c);animation:crSpin .9s cubic-bezier(.2,.8,.2,1)}' +
    '.cr-ring>div{width:94px;height:94px;border-radius:50%;background:#0d1628;display:grid;place-items:center;text-align:center;line-height:1}' +
    '.cr-ring b{font-size:34px;font-weight:900;display:block}.cr-ring small{font-size:10.5px;opacity:.7;display:block;margin-top:4px}' +
    '.cr-hl{flex:1;min-width:0}.cr-hl h3{margin:8px 0 6px;font-size:25px;font-weight:900;line-height:1.2}' +
    '.cr-hl p{margin:0;font-size:14px;opacity:.82;line-height:1.5}' +
    '.cr-live{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.1);border-radius:99px;padding:3px 10px;font-size:12px;font-weight:700}' +
    '.cr-live i{width:7px;height:7px;border-radius:50%;background:#22c55e;animation:crPulse 2s infinite}' +
    '.cr-body{max-width:900px;margin:-56px auto 0;padding:0 14px 44px;position:relative;z-index:2}' +
    '.cr-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px}' +
    '.cr-kpi{position:relative;overflow:hidden;background:#fff;border-radius:18px;padding:14px 14px 12px;box-shadow:0 10px 30px -12px rgba(15,23,42,.25),0 1px 0 rgba(15,23,42,.04);cursor:pointer;transition:transform .15s,box-shadow .15s;border:0;font:inherit;text-align:right;color:inherit}' +
    '.cr-kpi:hover{transform:translateY(-2px);box-shadow:0 16px 34px -12px rgba(15,23,42,.3)}' +
    '.cr-kpi::before{content:"";position:absolute;inset:0 0 auto 0;height:4px;background:var(--g)}' +
    '.cr-kpi b{display:block;font-size:32px;font-weight:900;line-height:1.05;background:var(--g);-webkit-background-clip:text;background-clip:text;color:transparent}' +
    '.cr-kpi span{display:block;font-size:12.5px;font-weight:800;color:#475569;margin-top:3px}.cr-kpi.z{--g:linear-gradient(135deg,#cbd5e1,#94a3b8)!important}.cr-kpi.z span{color:#94a3b8}' +
    '.cr-kpi.red{--g:linear-gradient(135deg,#ef4444,#be123c)}.cr-kpi.amber{--g:linear-gradient(135deg,#f59e0b,#ea580c)}' +
    '.cr-kpi.info{--g:linear-gradient(135deg,#3b82f6,#6366f1)}.cr-kpi.ok{--g:linear-gradient(135deg,#22c55e,#0d9488)}' +
    '.cr-sec{display:flex;align-items:center;gap:9px;margin:20px 4px 10px;font-size:13px;font-weight:900;color:#334155;scroll-margin-top:70px}' +
    '.cr-sec i{width:9px;height:9px;border-radius:50%;flex:none}.cr-sec::after{content:"";flex:1;height:1px;background:linear-gradient(to left,transparent,#cbd5e1)}' +
    '.cr-sec.red i{background:#ef4444;animation:crPulseR 1.8s infinite}.cr-sec.amber i{background:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.18)}' +
    '.cr-sec.info i{background:#3b82f6;box-shadow:0 0 0 4px rgba(59,130,246,.18)}.cr-sec.ok i{background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.18)}' +
    '.cr-card{background:#fff;border-radius:18px;box-shadow:0 6px 20px -10px rgba(15,23,42,.18),0 1px 0 rgba(15,23,42,.04);margin-bottom:10px;overflow:hidden;position:relative;transition:box-shadow .2s,transform .15s;animation:crIn .45s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*45ms)}' +
    '.cr-card:hover{box-shadow:0 14px 30px -12px rgba(15,23,42,.28);transform:translateY(-1px)}' +
    '.cr-card::before{content:"";position:absolute;inset-block:0;inset-inline-start:0;width:4px;background:var(--g)}' +
    '.cr-card.red{--g:linear-gradient(180deg,#ef4444,#be123c);--t:#fff1f2;--v:#be123c;box-shadow:0 8px 26px -10px rgba(225,29,72,.35),0 1px 0 rgba(15,23,42,.04)}' +
    '.cr-card.amber{--g:linear-gradient(180deg,#f59e0b,#ea580c);--t:#fff7ed;--v:#c2410c}.cr-card.info{--g:linear-gradient(180deg,#3b82f6,#6366f1);--t:#eef2ff;--v:#4338ca}' +
    '.cr-h{display:flex;align-items:center;gap:13px;padding:14px 16px 14px 14px;cursor:pointer}' +
    '.cr-ic{font-size:23px;flex:none;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:var(--t)}' +
    '.cr-tx{flex:1;min-width:0}.cr-tx b{display:block;font-size:15.5px;font-weight:800;color:#0f172a;line-height:1.35}.cr-tx small{display:block;color:#64748b;font-size:13px;margin-top:2px;line-height:1.45}' +
    '.cr-v{font-size:14.5px;font-weight:900;white-space:nowrap;color:var(--v);background:var(--t);border-radius:12px;padding:6px 11px;max-width:46%;overflow:hidden;text-overflow:ellipsis}' +
    '.cr-v:empty{display:none}.cr-ar{color:#94a3b8;font-size:11px;transition:transform .2s;flex:none}.cr-card.open .cr-ar{transform:rotate(-90deg)}' +
    '.cr-d{display:none;padding:2px 16px 14px;border-top:1px solid #f1f5f9;background:linear-gradient(#fafbfd,#fff)}.cr-card.open .cr-d{display:block;animation:crDrop .25s ease}' +
    '.cr-d table{width:100%;border-collapse:collapse;font-size:13px}.cr-d td,.cr-d th{padding:8px 6px;border-bottom:1px solid #f1f5f9;text-align:right}' +
    '.cr-d tr:hover td{background:#f8fafc}' +
    '.cr-d th{color:#64748b;font-weight:800;font-size:11.5px;position:sticky;top:0;background:#fafbfd}.cr-d td.n,.cr-d th.n{text-align:left;white-space:nowrap}' +
    '.cr-d .cr-list{max-height:340px;overflow:auto;margin-top:8px}' +
    '.cr-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}' +
    '.cr-acts button{border:1.5px solid #e2e8f0;background:#fff;border-radius:12px;padding:8px 14px;font:inherit;font-size:13px;font-weight:800;color:#0f172a;cursor:pointer;transition:transform .1s,background .15s}' +
    '.cr-acts button:hover{background:#f8fafc}.cr-acts button:active{transform:scale(.96)}' +
    '.cr-acts button.pri{background:linear-gradient(135deg,#0076DA,#4f46e5);color:#fff;border-color:transparent;box-shadow:0 6px 16px -6px rgba(79,70,229,.6)}' +
    '.cr-note{color:#64748b;font-size:12.5px;margin-top:14px;line-height:1.5}' +
    '.cr-oks{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}' +
    '.cr-okc{display:flex;gap:10px;align-items:center;background:#fff;border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.45;color:#334155;box-shadow:0 1px 0 rgba(15,23,42,.04),0 4px 14px -10px rgba(15,23,42,.2);animation:crIn .45s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*30ms)}' +
    '.cr-okc em{font-style:normal;font-size:17px;flex:none;width:32px;height:32px;border-radius:10px;background:#f0fdf4;display:grid;place-items:center}' +
    '.cr-allok{background:linear-gradient(135deg,#ecfdf5,#f0fdfa);border:1px solid #bbf7d0;border-radius:18px;padding:16px;margin-top:14px;font-size:15px;color:#065f46}' +
    '.cr-fb{border-bottom:1px solid #f1f5f9;padding:10px 2px;font-size:13.5px}.cr-fb small{color:#94a3b8}.cr-fb .t{margin:4px 0 8px;white-space:pre-wrap;color:#0f172a;background:#f8fafc;border-radius:10px;padding:8px 10px}' +
    '.cr-fb button{border:0;color:#fff;background:linear-gradient(135deg,#22c55e,#0d9488);border-radius:10px;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}' +
    '.cr-sk{height:74px;border-radius:18px;margin-bottom:10px;background:linear-gradient(90deg,#fff 0%,#f1f5f9 40%,#fff 80%);background-size:200% 100%;animation:crShim 1.2s linear infinite}' +
    '.cr-kpis+.cr-sk{margin-top:20px}' +
    '.cr-err{background:#fff;border-radius:18px;padding:26px 18px;text-align:center;box-shadow:0 10px 30px -12px rgba(15,23,42,.25)}.cr-err>div:first-child{font-size:40px}' +
    '.cr-err button{margin-top:12px;border:0;background:linear-gradient(135deg,#0076DA,#4f46e5);color:#fff;border-radius:12px;padding:9px 18px;font:inherit;font-weight:800;cursor:pointer}' +
    '@keyframes crIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes crDrop{from{opacity:0}to{opacity:1}}' +
    '@keyframes crSpin{from{transform:rotate(-120deg) scale(.85);opacity:0}to{transform:none;opacity:1}}@keyframes crShim{to{background-position:-200% 0}}' +
    '@keyframes crPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.7)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}' +
    '@keyframes crPulseR{0%{box-shadow:0 0 0 0 rgba(239,68,68,.6)}70%{box-shadow:0 0 0 8px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}' +
    '@media (prefers-reduced-motion:reduce){#crOv *{animation:none!important;transition:none!important}}' +
    '#crMgrBtn .badge:empty{display:none}#crMgrBtn .badge{background:#dc2626;color:#fff;border-radius:99px;padding:0 7px;font-size:11px;margin-inline-start:6px}' +
    '@media (max-width:620px){.cr-kpis{grid-template-columns:repeat(2,1fr)}.cr-hin{gap:14px}.cr-ring{width:92px;height:92px}.cr-ring>div{width:72px;height:72px}.cr-ring b{font-size:26px}.cr-ring small{font-size:9px}' +
    '.cr-hl h3{font-size:19px}.cr-hl p{font-size:13px}.cr-hero{padding:16px 16px 66px}.cr-h{gap:10px;padding:12px}.cr-ic{width:40px;height:40px;font-size:20px;border-radius:12px}' +
    '.cr-tx b{font-size:14.5px}.cr-v{font-size:13px;padding:5px 9px}.cr-kpi b{font-size:27px}}' +
    '</style>');

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }

  /* ================= the data ================= */
  async function fetchControl() {
    const r = await apiPost({ action: 'biControl', ...mAuth() }).catch(() => null);
    return r && r.ok ? r : null;
  }
  async function fetchPromos() {
    try {
      const r = await fetch('/data/promos-he.json', { method: 'HEAD', cache: 'no-store' });
      const lm = r.headers.get('Last-Modified');
      return lm ? new Date(lm) : null;
    } catch (_) { return null; }
  }
  // the MQI of the last whole month and the best sellers out of stock — the optimizer's own rules (assortment.js)
  async function fetchMqi() {
    if (typeof window._asCompute !== 'function') return null;
    const now = new Date(), last = ymOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const r = await apiPost({ action: 'biAssortment', ...mAuth(), fromMonth: last, toMonth: last, dep: '' }).catch(() => null);
    if (!r || !r.ok) return null;
    try { return window._asCompute(r); } catch (_) { return null; }
  }

  /* ================= the cards ================= */
  // { key, level, ic, title, value, sub, rows: [[...]], head: [...], acts: [[label, fn, primary]], note, okText }
  function build(c, mqi, promosAt) {
    const out = [], now = new Date(), hour = now.getHours();
    const add = (o) => out.push(o);
    // the store PC — the sales come every 15 minutes
    if (c) {
      const lp = c.lastPush ? new Date(c.lastPush) : null, age = lp ? (now - lp) / 60e3 : 1e9;
      if (age > 45 && hour >= 8 && hour <= 22) add({ key: 'push', level: 'red', ic: '🖥', title: 'המחשב בחנות לא שולח מכירות',
        value: lp ? 'מאז ' + hm(lp) : '', sub: 'הנתונים בלוח המכירות ובחדר הבקרה לא מתעדכנים. כדאי לבדוק שהמחשב בחנות דולק ומחובר לאינטרנט.' });
      else add({ key: 'push', level: 'ok', okText: '🖥 המכירות מהקופות מתעדכנות' + (lp ? ' (' + hm(lp) + ')' : '') });
    }
    // the promotions on the site (the store PC pushes them every night at 05:00)
    if (promosAt) {
      const hrs = (now - promosAt) / 3600e3;
      if (hrs > 26) add({ key: 'promos', level: 'amber', ic: '🏷', title: 'המבצעים באתר לא התעדכנו', value: 'מאז ' + dm(promosAt.toISOString()),
        sub: 'העדכון הלילי מהמחשב בחנות לא הגיע. במחשב בחנות: "עדכון אתר מלא עכשיו – לחיצה כפולה" (בתיקיית סקריפטים קומקס).' });
      else add({ key: 'promos', level: 'ok', okText: '🏷 המבצעים באתר עודכנו ב-' + dm(promosAt.toISOString()) + ' ' + hm(promosAt) });
    }
    if (c) {
      // the clock
      const ct = c.clockToday || {};
      if (!Number(ct.rows) && hour >= 9 && hour <= 21) add({ key: 'clock', level: 'red', ic: '⏱', title: 'אין היום דיווחי נוכחות', value: '0',
        sub: 'אף עובד לא דיווח כניסה היום. כדאי לבדוק את מחשב שעון הנוכחות.', acts: [['⏱ לנוכחות בזמן אמת', () => go('liveBtn'), true]] });
      else add({ key: 'clock', level: 'ok', okText: '⏱ שעון הנוכחות: ' + num(ct.rows) + ' דיווחים היום' + (ct.last ? ', אחרון ב-' + ct.last : '') });
      // yesterday
      const y = c.yday || {};
      if (y.sales != null && y.avg) {
        const ch = (y.sales - y.avg) / y.avg * 100;
        const s = c.sofar || {}, so = s.sales && s.lastWeek ? (s.sales - s.lastWeek) / s.lastWeek * 100 : null;
        const sub = 'מול ממוצע ' + nis(y.avg) + ' בימי ' + dayName(y.day) + ' ב-4 השבועות שלפני' +
          (so != null ? ' · היום עד ' + c.hour + ':00: ' + nis(s.sales) + ' (' + sign(so) + ' מול שבוע שעבר)' : '');
        if (ch <= -7) add({ key: 'yday', level: ch <= -15 ? 'red' : 'amber', ic: '📉', title: 'המכירות אתמול (' + dayName(y.day) + ') ירדו', value: sign(ch), sub,
          acts: [['📊 ללוח המכירות', () => openDash(), true]] });
        else add({ key: 'yday', level: 'ok', okText: '📈 אתמול (' + dayName(y.day) + '): ' + nis(y.sales) + ' — ' + sign(ch) + ' מהממוצע' + (so != null ? ' · היום עד עכשיו ' + sign(so) : '') });
      }
      // the departments
      const deps = c.deps || [];
      if (deps.length) add({ key: 'deps', level: 'amber', ic: '🧺', title: deps.length === 1 ? 'מחלקה אחת בירידה' : deps.length + ' מחלקות בירידה', value: deps.map((d) => d.name).slice(0, 2).join(', ') + (deps.length > 2 ? '…' : ''),
        sub: '7 הימים האחרונים מול שבוע ממוצע בחודש שלפני (ירידה של 20% ויותר).',
        head: ['מחלקה', 'השבוע', 'שבוע ממוצע', 'שינוי'], rows: deps.map((d) => [d.name, nis(d.week), nis(d.avg), sign((d.week - d.avg) / d.avg * 100)]),
        acts: [['📊 ללוח המכירות', () => openDash(), true]] });
      else add({ key: 'deps', level: 'ok', okText: '🏷 אין מחלקה בירידה חדה' });
    }
    // the MQI and the best sellers (the optimizer)
    if (mqi && mqi.mq) {
      const mq = mqi.mq, up = mqi.mqPrev ? mq.mqi - mqi.mqPrev.mqi : null;
      const lvl = mq.mqi < 50 ? 'red' : up != null && up <= -2 ? 'amber' : 'ok';
      if (lvl === 'ok') add({ key: 'mqi', level: 'ok', okText: '🎯 מדד היעילות (MQI): ' + num(mq.mqi, 1) + (up != null ? ' (' + (up >= 0 ? '+' : '') + num(up, 1) + ')' : '') });
      else add({ key: 'mqi', level: lvl, ic: '🎯', title: 'מדד היעילות המסחרית (MQI) ' + (mq.mqi < 50 ? 'נמוך' : 'ירד'), value: num(mq.mqi, 1),
        sub: up != null ? 'שינוי של ' + num(up, 1) + ' נקודות מהחודש הקודם.' : '', acts: [['🎯 לאופטימייזר', () => openAs(), true]] });
    }
    if (mqi && mqi.vipNoStock && mqi.vipNoStock.length) {
      const v = mqi.vipNoStock;
      add({ key: 'vip', level: 'red', ic: '📦', title: v.length === 1 ? 'רב-מכר אחד אזל במלאי' : v.length + ' רבי מכר אזלו במלאי', value: num(v.length),
        sub: 'מוצרים מקבוצת רבי המכר (70% מהמכירות) שהמלאי שלהם בקומקס 0 או פחות. אם זה טעות ספירה — כדאי לתקן בקומקס.',
        head: ['מוצר', 'מלאי', 'מכירות בחודש'], rows: v.slice(0, 60).map((x) => [x.name, num(x.stock, 1), nis(x.sales)]),
        acts: [['🎯 לאופטימייזר', () => openAs(), true]] });
    }
    if (c) {
      const arc = c.arcStock || [];
      if (arc.length) add({ key: 'arc', level: 'amber', ic: '🗄', title: arc.length + ' מוצרים בארכיון עם מלאי', value: num(arc.reduce((s, x) => s + Number(x.stock || 0), 0)) + ' יח\'',
        sub: 'הועברו לארכיון בקומקס, אבל עדיין רשום להם מלאי. אם הם על המדף — אי אפשר למכור אותם בקופה.',
        head: ['מוצר', 'מלאי', 'בארכיון מ-'], rows: arc.map((x) => [x.name, num(x.stock), dm(x.archived)]) });
      const ne = c.noExit || [];
      if (ne.length) add({ key: 'noexit', level: 'amber', ic: '🚪', title: ne.length === 1 ? 'יציאה אחת לא דווחה' : ne.length + ' יציאות לא דווחו', value: num(ne.length),
        sub: 'עובד דיווח כניסה ולא דיווח יציאה (7 הימים האחרונים). השעות שלו לא נספרות עד שיתוקן.',
        head: ['עובד', 'יום', 'דיווח אחרון'], rows: ne.map((x) => [x.employee, dayName(x.day) + ' ' + dm(x.day), x.last]),
        acts: [['⏱ לדוח הנוכחות', () => go('attBtn'), true]] });
      else add({ key: 'noexit', level: 'ok', okText: '🚪 כל היציאות דווחו' });
      const ms = c.missed || [];
      if (ms.length) add({ key: 'missed', level: 'amber', ic: '📋', title: ms.length === 1 ? 'משימה אחת לא בוצעה' : ms.length + ' משימות לא בוצעו', value: ms.map((x) => x.title).slice(0, 2).join(', ') + (ms.length > 2 ? '…' : ''),
        sub: 'אתמול והיום.', head: ['משימה', 'יום'], rows: ms.map((x) => [x.title, dayName(x.day) + ' ' + dm(x.day)]),
        acts: [['📋 למשימות', () => go('tkMgrBtn'), true]] });
      else add({ key: 'missed', level: 'ok', okText: '📋 כל המשימות של אתמול והיום בוצעו' });
      // 🗂 the branch file (branch-file.js): deadlines late / within 30 days, faults still open
      const bd = c.bfDue || [], today = String(c.today).slice(0, 10);
      const left = (d) => Math.round((Date.parse(String(d).slice(0, 10) + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 864e5);
      const late = bd.filter((x) => left(x.due) < 0), soon = bd.filter((x) => left(x.due) >= 0);
      const dRow = (x) => [x.title + (x.employee ? ' — ' + x.employee : ''), dm(x.due) + '/' + String(x.due).slice(2, 4), left(x.due) < 0 ? 'פג לפני ' + (-left(x.due)) + ' ימים' : left(x.due) === 0 ? 'היום' : 'עוד ' + left(x.due) + ' ימים'];
      if (late.length) add({ key: 'bfLate', level: 'red', ic: '⛔', title: late.length === 1 ? 'מסמך / רישיון אחד פג תוקף' : late.length + ' מסמכים / רישיונות פגו', value: late.map((x) => x.title).slice(0, 2).join(', ') + (late.length > 2 ? '…' : ''),
        sub: 'מתוך תיק הסניף — מועדים ורישוי.', head: ['מה', 'בתוקף עד', ''], rows: late.map(dRow), acts: [['🗂 לתיק הסניף', () => openBf(), true]] });
      if (soon.length) add({ key: 'bfSoon', level: 'amber', ic: '⏳', title: soon.length === 1 ? 'מועד אחד מתקרב' : soon.length + ' מועדים מתקרבים', value: 'ב-30 יום',
        sub: 'רישיונות, אישורים, ביטוחים, חוזים והסמכות שפגים בחודש הקרוב.', head: ['מה', 'בתוקף עד', ''], rows: soon.map(dRow), acts: [['🗂 לתיק הסניף', () => openBf(), true]] });
      if (!late.length && !soon.length) add({ key: 'bf', level: 'ok', okText: '🗂 אין מועדים שפגים בחודש הקרוב' });
      const bc = c.bfCalls || [], days = (t) => Math.floor((Date.now() - Date.parse(t)) / 864e5);
      const hot = bc.filter((x) => x.urgent || days(x.opened_at) >= 3);
      if (bc.length) add({ key: 'bfCalls', level: bc.some((x) => x.urgent) ? 'red' : hot.length ? 'amber' : 'info', ic: '🔧', title: bc.length === 1 ? 'תקלה פתוחה' : bc.length + ' תקלות פתוחות', value: num(bc.length),
        sub: 'מתוך תיק הסניף — ציוד ותקלות.', head: ['תקלה', 'נפתחה', 'מצב'],
        rows: bc.map((x) => [(x.urgent ? '🚨 ' : '') + x.title, days(x.opened_at) ? 'לפני ' + days(x.opened_at) + ' ימים' : 'היום', x.status === 'wait' ? 'ממתינה לטכנאי' : 'פתוחה']),
        acts: [['🗂 לתיק הסניף', () => openBf(), true]] });
      else add({ key: 'bfCalls', level: 'ok', okText: '🔧 אין תקלות פתוחות' });
      // 💬 the customers' feedback (club-feedback.ts): the messages to handle, the ratings of the last 30 days
      const fb = c.feedback;
      if (fb) {
        const op = fb.open || [];
        if (op.length) add({ key: 'fbOpen', level: 'amber', ic: '💬', title: op.length === 1 ? 'פנייה אחת מלקוח מחכה' : op.length + ' פניות מלקוחות מחכות', value: op.map((x) => x.topic).slice(0, 3).join(', '),
          sub: 'מהאזור האישי במועדון. אחרי שטיפלתם — "✓ טופל".', html: op.map((x) => '<div class="cr-fb" data-fb="' + x.id + '"><div><b>' + e(x.topic) + '</b> · ' + e(x.name || 'לקוח') +
            (x.phone ? ' · <a href="tel:' + e(x.phone) + '" dir="ltr">' + e(x.phone) + '</a>' : '') + ' <small>' + dm(x.at) + '</small></div><div class="t">' + e(x.text) + '</div>' +
            '<button type="button" data-done="' + x.id + '">✓ טופל</button></div>').join(''), bind: bindFb });
        const g = fb.ratings || { good: 0, ok: 0, bad: 0 }, n = g.good + g.ok + g.bad, pc = (v) => n ? Math.round(v / n * 100) + '%' : '';
        if (n) {
          const line = '😀 ' + pc(g.good) + ' · 😐 ' + pc(g.ok) + ' · 😞 ' + pc(g.bad);
          const w = fb.words || [];
          if (w.length || (n >= 10 && g.bad / n >= 0.15)) add({ key: 'fbRate', level: n >= 10 && g.bad / n >= 0.15 ? 'amber' : 'info', ic: '⭐', title: 'דירוגי הלקוחות — ' + n + ' ב-30 יום', value: line,
            sub: 'מהקבלות במייל ומהאזור האישי. למטה — מה כתבו לקוחות שלא היו מרוצים לגמרי.', head: ['', 'מה כתבו', 'לקוח', 'מתי'],
            rows: w.map((x) => [x.face, x.text, (x.name || '') + (x.phone ? ' ' + x.phone : ''), dm(x.at)]) });
          else add({ key: 'fbRate', level: 'ok', okText: '⭐ דירוגי הלקוחות (30 יום): ' + line + ' — ' + n + ' דירוגים' });
        } else add({ key: 'fbRate', level: 'ok', okText: '⭐ עוד אין דירוגים מלקוחות — הם יגיעו מהקבלות במייל ומהאזור האישי' });
      }
      // good to know — not in the number
      const ls = c.loss || [];
      if (ls.length) add({ key: 'loss', level: 'info', ic: '💸', title: ls.length + ' מוצרים נמכרו מתחת לעלות', value: nis(ls.reduce((s, x) => s + Number(x.loss || 0), 0)),
        sub: 'ב-14 הימים האחרונים — כולל הנחות מבצע. ההפסד = עלות פחות מכירות לפני מע"מ. מוצר שהעלות שלו בקומקס לא הגיונית לא נכלל.',
        head: ['מוצר', 'כמות', 'מכירות', 'עלות', 'הפסד'], rows: ls.map((x) => [x.name, num(x.qty, 1), nis(x.net), nis(x.cost), nis(x.loss)]) });
      const lp = c.lapsed || [];
      if (lp.length) {
        const month = lp.reduce((s, x) => s + Number(x.spent || 0), 0) / 3;
        add({ key: 'lapsed', level: 'info', ic: '🛒', title: lp.length + ' לקוחות קבועים הפסיקו לקנות', value: '~' + nis(month) + ' בחודש',
          sub: 'חברי מועדון שקנו 6 פעמים ויותר ב-3 החודשים שלפני, ולא קנו ב-30 הימים האחרונים. כדאי ליצור קשר או לשלוח הטבה.',
          head: ['לקוח', 'קניות', 'קנה ב-3 חודשים', 'אחרונה'], rows: lp.slice(0, 80).map((x) => [x.name || 'כרטיס ' + x.card, num(x.visits), nis(x.spent), dm(x.last)]),
          acts: [['⬇ רשימה מלאה לאקסל', () => lapsedXlsx(lp), true]] });
      }
    }
    return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
  }
  const sign = (v) => (v >= 0 ? '+' : '−') + num(Math.abs(v), 1) + '%';

  /* ================= the screen ================= */
  function open() {
    if (!isAdmin()) return;
    if (!$('crOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="crOv" class="hidden"><div class="cr-top"><h2>🚦 חדר בקרה</h2><span class="sp"></span>' +
        '<button id="crRe">↻ רענון</button><button id="crX">✕ סגירה</button></div><div class="cr-hero"><div class="cr-hin" id="crHero"></div></div><div class="cr-body" id="crBody"></div></div>');
      $('crX').addEventListener('click', close);
      $('crRe').addEventListener('click', () => load(true));
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('crOv') && !$('crOv').classList.contains('hidden')) close(); });
    }
    $('crOv').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    load(Date.now() - at > 5 * 60e3 || !M);
  }
  function close() { $('crOv').classList.add('hidden'); document.body.style.overflow = ''; }
  function leave(fn) { close(); setTimeout(fn, 0); }
  const go = (id) => leave(() => { const b = $(id); if (b) b.click(); });
  const openDash = () => leave(() => window.openSalesDash && window.openSalesDash());
  const openAs = () => leave(() => window.openAssortment && window.openAssortment());
  const openBf = () => leave(() => window.openBranchFile && window.openBranchFile());

  async function load(fresh) {
    if (busy) return;
    if (!fresh && C) { draw(); return; }
    busy = true;
    $('crHero').innerHTML = hero(null);
    $('crBody').innerHTML = '<div class="cr-kpis">' + '<div class="cr-sk" style="height:76px;margin:0"></div>'.repeat(4) + '</div>' + '<div class="cr-sk"></div>'.repeat(4);
    const [c, m, p] = await Promise.all([fetchControl(), fetchMqi(), fetchPromos()]);
    busy = false;
    if (!c) {
      $('crHero').innerHTML = hero(false);
      $('crBody').innerHTML = '<div class="cr-err"><div>📡</div><b>לא הצלחתי לטעון את הנתונים.</b><div class="cr-note">נסה שוב בעוד רגע.</div><button type="button" id="crRe2">↻ לנסות שוב</button></div>';
      $('crRe2').addEventListener('click', () => load(true));
      return;
    }
    C = c; M = m; at = Date.now();
    cards = build(c, m, p);
    setBadge(cards);
    draw();
  }

  // the hero: the health ring (100 − 15 per red − 5 per amber) and one sentence
  function hero(k) {
    const live = '<span class="cr-live"><i></i>' + (k ? 'נבדק ב-' + hm(new Date(at)) : k === false ? 'אין חיבור' : 'בודק…') + '</span>';
    if (!k) return '<div class="cr-ring" style="--p:0;--c:#64748b"><div><b>' + (k === false ? '!' : '…') + '</b><small>בריאות הסניף</small></div></div>' +
      '<div class="cr-hl"><div class="k">' + live + '</div><h3>' + (k === false ? 'משהו לא נטען' : 'בודק את כל המערכות…') + '</h3><p>קופות, מלאי, שעון, משימות, מועדון ותיק הסניף.</p></div>';
    const sc = Math.max(0, Math.min(100, 100 - k.red * 15 - k.amber * 5));
    const col = sc >= 85 ? '#22c55e' : sc >= 60 ? '#f59e0b' : '#ef4444';
    const head = k.red ? (k.red === 1 ? 'דבר אחד דורש טיפול עכשיו' : k.red + ' דברים דורשים טיפול עכשיו') : k.amber ? (k.amber === 1 ? 'כמעט מושלם — דבר אחד לבדוק' : 'יציב — ' + k.amber + ' דברים לבדוק') : 'הכול רץ חלק ✨';
    const hr = new Date().getHours(), hi = hr < 12 ? 'בוקר טוב' : hr < 17 ? 'צהריים טובים' : 'ערב טוב';
    return '<div class="cr-ring" style="--p:' + sc + ';--c:' + col + '"><div><b>' + sc + '</b><small>בריאות הסניף</small></div></div>' +
      '<div class="cr-hl"><div class="k">' + live + '</div><h3>' + e(head) + '</h3><p>' + hi + '. ' + (k.ok + k.red + k.amber + k.info) + ' בדיקות — ' + k.ok + ' תקינות.</p></div>';
  }

  function draw() {
    const n = (l) => cards.filter((x) => x.level === l).length;
    const todo = cards.filter((x) => x.level !== 'ok'), ok = cards.filter((x) => x.level === 'ok');
    $('crHero').innerHTML = hero({ red: n('red'), amber: n('amber'), info: n('info'), ok: ok.length });
    const cnt = (l) => (l === 'ok' ? ok.length : n(l));
    const tile = (l, label) => '<button type="button" class="cr-kpi ' + l + (cnt(l) ? '' : ' z') + '" data-go="' + l + '"><b>' + cnt(l) + '</b><span>' + label + '</span></button>';
    let h = '<div class="cr-kpis">' + tile('red', '🔴 לטיפול עכשיו') + tile('amber', '🟠 לבדיקה') + tile('info', '🔵 כדאי לדעת') + tile('ok', '✓ תקינים') + '</div>';
    if (!n('red') && !n('amber')) h += '<div class="cr-allok"><b>✓ הכול תקין.</b> אין משהו שדורש טיפול עכשיו.</div>';
    const SEC = { red: 'לטיפול עכשיו', amber: 'לבדיקה', info: 'כדאי לדעת' };
    let last = '';
    todo.forEach((x, i) => {
      if (x.level !== last) { last = x.level; h += '<div class="cr-sec ' + x.level + '" id="crSec-' + x.level + '"><i></i>' + SEC[x.level] + '</div>'; }
      h += '<div class="cr-card ' + x.level + (openKey === x.key ? ' open' : '') + '" style="--i:' + i + '" data-k="' + x.key + '"><div class="cr-h" role="button" tabindex="0"><span class="cr-ic">' + x.ic + '</span>' +
        '<span class="cr-tx"><b>' + e(x.title) + '</b>' + (x.sub && !(x.rows || x.acts || x.html) ? '<small>' + e(x.sub) + '</small>' : '') + '</span>' +
        '<span class="cr-v">' + e(x.value) + '</span>' + (x.rows || x.acts || x.html ? '<span class="cr-ar">◀</span>' : '') + '</div>' +
        (x.rows || x.acts || x.html ? '<div class="cr-d">' + (x.sub ? '<div class="cr-note" style="margin:0 0 8px">' + e(x.sub) + '</div>' : '') +
          (x.html ? '<div class="cr-list">' + x.html + '</div>' : '') +
          (x.rows ? '<div class="cr-list"><table><tr>' + x.head.map((t, j) => '<th' + (j ? ' class="n"' : '') + '>' + e(t) + '</th>').join('') + '</tr>' +
            x.rows.map((r) => '<tr>' + r.map((t, j) => '<td' + (j ? ' class="n"' : '') + '>' + e(t) + '</td>').join('') + '</tr>').join('') + '</table></div>' : '') +
          (x.acts ? '<div class="cr-acts">' + x.acts.map((a, j) => '<button data-a="' + i + ':' + j + '"' + (a[2] ? ' class="pri"' : '') + '>' + e(a[0]) + '</button>').join('') + '</div>' : '') +
        '</div>' : '') + '</div>';
    });
    if (ok.length) h += '<div class="cr-sec ok" id="crSec-ok"><i></i>תקין</div><div class="cr-oks">' + ok.map((x, i) => {
      const m = String(x.okText || '').match(/^(\S+)\s+([\s\S]*)$/), ic = m && !/[א-תa-z0-9]/i.test(m[1]) ? m[1] : '✓', tx = m && ic !== '✓' ? m[2] : x.okText;
      return '<div class="cr-okc" style="--i:' + i + '"><em>' + e(ic) + '</em><span>' + e(tx) + '</span></div>';
    }).join('') + '</div>';
    h += '<div class="cr-note">הנתונים מתעדכנים מהקופות כל 15 דקות (בקומקס רק קוראים). מדד היעילות — של החודש השלם האחרון.</div>';
    const body = $('crBody');
    body.innerHTML = h;
    body.querySelectorAll('.cr-card').forEach((card) => {
      const hd = card.querySelector('.cr-h');
      const t = () => { if (!card.querySelector('.cr-d')) return; const on = !card.classList.contains('open'); body.querySelectorAll('.cr-card.open').forEach((x) => x.classList.remove('open')); card.classList.toggle('open', on); openKey = on ? card.dataset.k : ''; };
      hd.addEventListener('click', t);
      hd.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); t(); } });
    });
    body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { const t = $('crSec-' + b.dataset.go); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    body.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => { const [i, j] = b.dataset.a.split(':').map(Number); todo[i].acts[j][1](); }));
    todo.forEach((x) => { if (x.bind) x.bind(body.querySelector('.cr-card[data-k="' + x.key + '"]')); });
  }

  // 💬 a customer's message handled (biFeedbackHandle)
  function bindFb(card) {
    if (!card) return;
    card.querySelectorAll('[data-done]').forEach((b) => b.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      b.disabled = true;
      const r = await apiPost({ action: 'biFeedbackHandle', ...mAuth(), id: Number(b.dataset.done) }).catch(() => null);
      if (!r || !r.ok) { b.disabled = false; b.textContent = '✕ לא נשמר — שוב'; return; }
      const row = b.closest('.cr-fb'); row.style.opacity = '.45'; b.textContent = '✓ סומן';
      if (C && C.feedback) C.feedback.open = (C.feedback.open || []).filter((x) => x.id !== Number(b.dataset.done));
    }));
  }

  /* ================= the club list → Excel ================= */
  async function lapsedXlsx(list) {
    let X = null;
    try { const prev = window.XLSX; await loadScript(XS_URL); X = window.XLSX; if (prev) window.XLSX = prev; } catch (_) { return; }
    const rows = [['לקוח', 'טלפון', 'כרטיס', 'קניות ב-3 החודשים', 'סכום ב-3 החודשים', 'קנייה אחרונה', 'מסכים ל-SMS']]
      .concat(list.map((x) => [x.name || '', x.phone || '', x.card, Number(x.visits) || 0, Math.round(Number(x.spent) || 0), dm(x.last) + '/' + String(x.last || '').slice(0, 4), x.noSms ? 'לא' : 'כן']));
    const ws = X.utils.aoa_to_sheet(rows);
    ws['!cols'] = [22, 13, 12, 10, 12, 12, 10].map((w) => ({ wch: w }));
    ws['!views'] = [{ RTL: true }];
    rows[0].forEach((_, ci) => { const a = X.utils.encode_cell({ r: 0, c: ci }); if (ws[a]) ws[a].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0F172A' } }, alignment: { horizontal: 'center' } }; });
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, 'לקוחות שהפסיקו');
    X.writeFile(wb, 'לקוחות קבועים שהפסיקו לקנות ' + dm(new Date().toISOString()).replace('/', '-') + '.xlsx');
  }

  /* ================= the menu item and its number ================= */
  function setBadge(list) {
    const b = $('crMgrBtn') && $('crMgrBtn').querySelector('.badge');
    if (!b) return;
    const n = list.filter((x) => x.level === 'red' || x.level === 'amber').length;
    if (b.textContent !== (n ? String(n) : '')) b.textContent = n ? String(n) : '';
  }
  // the number on the menu: once on sign-in and then at most every 10 minutes (on a menu click) — the light part only
  let badgeAt = 0;
  async function refreshBadge() {
    if (!isAdmin() || Date.now() - badgeAt < 10 * 60e3) return;
    badgeAt = Date.now();
    const [c, p] = await Promise.all([fetchControl(), fetchPromos()]);
    if (c) setBadge(build(c, M, p));
  }
  function start() {
    const drop = $('menuAdminDrop');
    if (drop && !$('crMgrBtn')) {
      drop.insertAdjacentHTML('afterbegin', '<button id="crMgrBtn" style="display:none">🚦 חדר בקרה<span class="badge"></span></button>');
      $('crMgrBtn').addEventListener('click', open);
      const show = () => { const a = isAdmin(); $('crMgrBtn').style.display = a ? '' : 'none'; if (a) refreshBadge(); else badgeAt = 0; };
      $('menuAdminBtn')?.addEventListener('click', show, true);
      show();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openControl = open;
})();
