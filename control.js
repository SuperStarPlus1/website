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

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#crOv{position:fixed;inset:0;z-index:9000;background:#f1f5f9;overflow:auto;direction:rtl;font-family:inherit}#crOv.hidden{display:none}' +
    '.cr-top{position:sticky;top:0;z-index:2;background:#0f172a;color:#fff;padding:11px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 4px 16px rgba(15,23,42,.25)}' +
    '.cr-top h2{margin:0;font-size:18px;font-weight:900}.cr-top .t{font-size:12px;opacity:.75}.cr-top .sp{flex:1}' +
    '.cr-top button{background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:10px;padding:7px 12px;font:inherit;font-weight:800;cursor:pointer}' +
    '.cr-top button:hover{background:rgba(255,255,255,.2)}' +
    '.cr-body{max-width:860px;margin:0 auto;padding:14px 14px 40px}' +
    '.cr-sum{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}' +
    '.cr-sum span{border-radius:99px;padding:5px 12px;font-weight:800;font-size:13.5px}' +
    '.cr-card{background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:10px;border-inline-start:5px solid #cbd5e1;overflow:hidden}' +
    '.cr-card.red{border-color:#dc2626}.cr-card.amber{border-color:#f59e0b}.cr-card.info{border-color:#3b82f6}' +
    '.cr-h{display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer}.cr-h:hover{background:#f8fafc}' +
    '.cr-ic{font-size:24px;flex:none;width:32px;text-align:center}' +
    '.cr-tx{flex:1;min-width:0}.cr-tx b{display:block;font-size:15px;color:#0f172a}.cr-tx small{display:block;color:#475569;font-size:13px;margin-top:2px;line-height:1.45}' +
    '.cr-v{font-size:19px;font-weight:900;white-space:nowrap}.cr-card.red .cr-v{color:#b91c1c}.cr-card.amber .cr-v{color:#b45309}.cr-card.info .cr-v{color:#1d4ed8}' +
    '.cr-ar{color:#94a3b8;font-size:11px;transition:transform .15s}.cr-card.open .cr-ar{transform:rotate(-90deg)}' +
    '.cr-d{display:none;padding:0 14px 12px}.cr-card.open .cr-d{display:block}' +
    '.cr-d table{width:100%;border-collapse:collapse;font-size:13px}.cr-d td,.cr-d th{padding:6px 6px;border-bottom:1px solid #f1f5f9;text-align:right}' +
    '.cr-d th{color:#64748b;font-weight:700;font-size:12px}.cr-d td.n,.cr-d th.n{text-align:left;white-space:nowrap}' +
    '.cr-d .cr-list{max-height:320px;overflow:auto}' +
    '.cr-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}' +
    '.cr-acts button{border:1.5px solid #cbd5e1;background:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;color:#0f172a;cursor:pointer}' +
    '.cr-acts button.pri{background:#0f172a;color:#fff;border-color:#0f172a}' +
    '.cr-note{color:#64748b;font-size:12.5px;margin-top:8px;line-height:1.5}' +
    '.cr-ok{background:#fff;border-radius:14px;padding:12px 14px;color:#166534;font-size:13.5px;line-height:1.9;box-shadow:0 2px 10px rgba(15,23,42,.06)}' +
    '.cr-ok b{font-size:14.5px}' +
    '.cr-load{color:#64748b;text-align:center;padding:40px 0}' +
    '#crMgrBtn .badge:empty{display:none}#crMgrBtn .badge{background:#dc2626;color:#fff;border-radius:99px;padding:0 7px;font-size:11px;margin-inline-start:6px}' +
    '@media (max-width:520px){.cr-h{gap:9px;padding:11px 11px}.cr-ic{font-size:21px;width:26px}.cr-v{font-size:16px}.cr-tx b{font-size:14px}}' +
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
      document.body.insertAdjacentHTML('beforeend', '<div id="crOv" class="hidden"><div class="cr-top"><h2>🚦 חדר בקרה</h2><span class="t" id="crAt"></span><span class="sp"></span>' +
        '<button id="crRe">↻ רענון</button><button id="crX">✕ סגירה</button></div><div class="cr-body" id="crBody"></div></div>');
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
    $('crBody').innerHTML = '<div class="cr-load">⏳ בודק את כל המערכות…</div>';
    const [c, m, p] = await Promise.all([fetchControl(), fetchMqi(), fetchPromos()]);
    busy = false;
    if (!c) { $('crBody').innerHTML = '<div class="cr-load">לא הצלחתי לטעון את הנתונים. נסה שוב בעוד רגע.</div>'; return; }
    C = c; M = m; at = Date.now();
    cards = build(c, m, p);
    setBadge(cards);
    draw();
  }

  function draw() {
    $('crAt').textContent = 'נבדק ב-' + hm(new Date(at));
    const n = (l) => cards.filter((x) => x.level === l).length;
    const todo = cards.filter((x) => x.level !== 'ok'), ok = cards.filter((x) => x.level === 'ok');
    let h = '<div class="cr-sum">' +
      (n('red') ? '<span style="background:#fee2e2;color:#b91c1c">🔴 ' + n('red') + ' לטיפול עכשיו</span>' : '') +
      (n('amber') ? '<span style="background:#fef3c7;color:#92400e">🟠 ' + n('amber') + ' לבדיקה</span>' : '') +
      (n('info') ? '<span style="background:#dbeafe;color:#1e40af">🔵 ' + n('info') + ' כדאי לדעת</span>' : '') +
      '<span style="background:#dcfce7;color:#166534">✓ ' + ok.length + ' תקינים</span></div>';
    if (!n('red') && !n('amber')) h += '<div class="cr-ok" style="margin-bottom:10px;color:#0f172a"><b>✓ הכול תקין.</b> אין משהו שדורש טיפול עכשיו.</div>';
    todo.forEach((x, i) => {
      h += '<div class="cr-card ' + x.level + (openKey === x.key ? ' open' : '') + '" data-k="' + x.key + '"><div class="cr-h" role="button" tabindex="0"><span class="cr-ic">' + x.ic + '</span>' +
        '<span class="cr-tx"><b>' + e(x.title) + '</b>' + (x.sub && !(x.rows || x.acts) ? '<small>' + e(x.sub) + '</small>' : '') + '</span>' +
        '<span class="cr-v">' + e(x.value) + '</span>' + (x.rows || x.acts ? '<span class="cr-ar">◀</span>' : '') + '</div>' +
        (x.rows || x.acts ? '<div class="cr-d">' + (x.sub ? '<div class="cr-note" style="margin:0 0 8px">' + e(x.sub) + '</div>' : '') +
          (x.rows ? '<div class="cr-list"><table><tr>' + x.head.map((t, j) => '<th' + (j ? ' class="n"' : '') + '>' + e(t) + '</th>').join('') + '</tr>' +
            x.rows.map((r) => '<tr>' + r.map((t, j) => '<td' + (j ? ' class="n"' : '') + '>' + e(t) + '</td>').join('') + '</tr>').join('') + '</table></div>' : '') +
          (x.acts ? '<div class="cr-acts">' + x.acts.map((a, j) => '<button data-a="' + i + ':' + j + '"' + (a[2] ? ' class="pri"' : '') + '>' + e(a[0]) + '</button>').join('') + '</div>' : '') +
        '</div>' : '') + '</div>';
    });
    if (ok.length) h += '<div class="cr-ok">' + ok.map((x) => '<div>' + e(x.okText) + '</div>').join('') + '</div>';
    h += '<div class="cr-note">הנתונים מתעדכנים מהקופות כל 15 דקות (בקומקס רק קוראים). מדד היעילות — של החודש השלם האחרון.</div>';
    const body = $('crBody');
    body.innerHTML = h;
    body.querySelectorAll('.cr-card').forEach((card) => {
      const hd = card.querySelector('.cr-h');
      const t = () => { if (!card.querySelector('.cr-d')) return; const on = !card.classList.contains('open'); body.querySelectorAll('.cr-card.open').forEach((x) => x.classList.remove('open')); card.classList.toggle('open', on); openKey = on ? card.dataset.k : ''; };
      hd.addEventListener('click', t);
      hd.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); t(); } });
    });
    body.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => { const [i, j] = b.dataset.a.split(':').map(Number); todo[i].acts[j][1](); }));
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
