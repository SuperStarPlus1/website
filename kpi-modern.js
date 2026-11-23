// 🎨 עיצוב KPI מודרני (23/11/2026, the owner: "redesign the sales dashboard, the optimizer and the control room in a
// modern KPI style instead of the simple screen — keep the current design in case I want to go back").
// One layer of styles over the three screens (sales-dash.js #sdOv, assortment.js #asOv, control.js #crOv), active while
// <html> has the class kpi2. Nothing in the screens' own styles changed — without kpi2 they look exactly as before
// (a copy of the three files as they were: ארכיון/עיצוב קלאסי - לוחות 23-11-2026).
// The switch: "🎨 קלאסי" / "🎨 מודרני" in each screen's top bar; remembered on this device (localStorage kpiTheme),
// the modern one by default.
(function () {
  'use strict';
  const KEY = 'kpiTheme';
  const get = () => { try { return localStorage.getItem(KEY) || 'modern'; } catch (_) { return 'modern'; } };
  const set = (v) => { try { localStorage.setItem(KEY, v); } catch (_) {} };
  const apply = () => { document.documentElement.classList.toggle('kpi2', get() !== 'classic'); syncBtns(); };

  // tokens: one neutral surface, white cards with a hairline border, slate ink, one accent (indigo); status colors only
  // for good / bad (deltas, alerts) — always with ▲/▼ or an icon, never color alone
  const S = ['#sdOv', '#asOv', '#crOv'];
  const all = (sel) => S.map((o) => sel.split(',').map((x) => 'html.kpi2 ' + o + ' ' + x.trim()).join(',')).join(',');
  const css =
    // the surface and the type
    S.map((o) => 'html.kpi2 ' + o).join(',') + '{background:#f5f7fb!important;color:#101828;font-feature-settings:"tnum" 1}' +
    // the top bars: white, sticky, blurred, one line
    'html.kpi2 .sd-top,html.kpi2 .ff-top,html.kpi2 .cr-top{background:rgba(255,255,255,.86)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#101828!important;box-shadow:none!important;border-bottom:1px solid #e6eaf2!important;padding:10px 18px!important}' +
    'html.kpi2 .sd-top h2,html.kpi2 .ff-top h2,html.kpi2 .cr-top h2{font-size:18px!important;font-weight:800!important;letter-spacing:-.2px;color:#101828}' +
    'html.kpi2 .ff-top h2 .acc{color:#4f46e5!important}html.kpi2 .ff-top .sub,html.kpi2 .sd-top .fresh{color:#667085;opacity:1!important}' +
    'html.kpi2 .sd-top button,html.kpi2 .ff-top button,html.kpi2 .cr-top button{background:#fff!important;color:#344054!important;border:1px solid #d0d5dd!important;border-radius:10px!important;padding:7px 13px!important;font-weight:700!important;box-shadow:0 1px 2px rgba(16,24,40,.05)}' +
    'html.kpi2 .sd-top button:hover,html.kpi2 .ff-top button:hover,html.kpi2 .cr-top button:hover{background:#f9fafb!important}' +
    'html.kpi2 .ff-pill{background:#eef2ff!important;color:#3730a3!important;border-radius:99px!important}' +
    // the cards
    all('.sd-card, .ff-c, .sd-empty') + '{background:#fff!important;border:1px solid #e6eaf2!important;border-radius:16px!important;box-shadow:0 1px 2px rgba(16,24,40,.04),0 1px 3px rgba(16,24,40,.06)!important}' +
    all('.sd-card h3, .ff-c h3') + '{font-size:14.5px!important;font-weight:800!important;color:#101828!important;letter-spacing:-.1px}' +
    all('.sd-card h3 small, .ff-c h3 small') + '{color:#667085!important;font-weight:500!important}' +
    // the KPI tiles (sales): white, the number big, the icon in a tinted square, a thin color line on top
    'html.kpi2 .sd-kpis{gap:12px!important}' +
    'html.kpi2 .sd-kpi{background:#fff!important;color:#101828!important;border:1px solid #e6eaf2;border-radius:16px!important;box-shadow:0 1px 2px rgba(16,24,40,.04),0 1px 3px rgba(16,24,40,.06)!important;padding:14px 16px 12px!important;min-height:112px!important}' +
    'html.kpi2 .sd-kpi::before{content:"";position:absolute;inset:0 0 auto 0;height:3px;background:var(--g,#4f46e5)}' +
    'html.kpi2 .sd-kpi .ic{position:static!important;display:grid;place-items:center;width:34px;height:34px;border-radius:10px;font-size:17px!important;opacity:1!important;background:#f2f4f7;margin-bottom:8px}' +
    'html.kpi2 .sd-kpi .l{font-size:12.5px!important;font-weight:600!important;color:#667085;opacity:1!important}' +
    'html.kpi2 .sd-kpi .v{font-size:28px!important;font-weight:800!important;letter-spacing:-.6px!important;color:#101828;margin-top:2px!important;font-variant-numeric:tabular-nums}' +
    'html.kpi2 .sd-kpi .d{background:#f2f4f7!important;color:#475467;font-weight:700!important;font-size:11.5px!important;margin-top:6px!important}' +
    'html.kpi2 .sd-kpi .d.up{background:#ecfdf3!important;color:#027a48}html.kpi2 .sd-kpi .d.dn{background:#fef3f2!important;color:#b42318}' +
    '@media (max-width:520px){html.kpi2 .sd-kpi{min-height:100px!important}html.kpi2 .sd-kpi .v{font-size:22px!important}}' +
    // filters: a segmented row
    'html.kpi2 .sd-chip{border:1px solid #d0d5dd!important;background:#fff!important;color:#344054!important;border-radius:10px!important;padding:6px 12px!important;font-weight:600!important}' +
    'html.kpi2 .sd-chip.on{background:#101828!important;color:#fff!important;border-color:#101828!important}' +
    all('.sd-bar select, .sd-bar input, .ff-search') + '{border:1px solid #d0d5dd!important;border-radius:10px!important;background:#fff!important}' +
    all('.ff-tabs') + '{border-bottom:1px solid #e6eaf2!important}' +
    all('.ff-tabs button') + '{background:transparent!important;border:0!important;border-bottom:2px solid transparent!important;border-radius:0!important;color:#667085!important;font-weight:700!important;padding:6px 10px!important}' +
    all('.ff-tabs button.on') + '{color:#4f46e5!important;border-bottom-color:#4f46e5!important;background:transparent!important}' +
    // tables
    all('.sd-tbl th, .cr-d th') + '{color:#667085!important;font-weight:600!important;font-size:11.5px!important;background:#f9fafb!important;border-bottom:1px solid #e6eaf2!important}' +
    all('.sd-tbl td, .cr-d td') + '{border-bottom:1px solid #f2f4f7!important}' +
    all('.sd-tbl tr.click:hover td, .cr-d tr:hover td') + '{background:#f5f8ff!important}' +
    all('.sd-up') + '{color:#027a48!important}' + all('.sd-dn') + '{color:#b42318!important}' +
    all('.sd-warn') + '{background:#fffaeb!important;border:1px solid #fedf89!important;color:#93370d!important;border-radius:12px!important}' +
    // the optimizer's KPI cards: the title small and grey, the number big and dark (its color stays — it says the kind)
    'html.kpi2 .ff-kt{font-size:12.5px!important;font-weight:600!important;color:#667085;text-align:start!important}' +
    'html.kpi2 .ff-kv{font-size:34px!important;font-weight:800!important;letter-spacing:-.8px!important;text-align:start!important}' +
    'html.kpi2 .ff-ks,html.kpi2 .ff-kd{text-align:start!important}' +
    'html.kpi2 .ff-go{background:#fff!important;color:#4f46e5!important;border-top:1px solid #f2f4f7!important;text-align:start;padding:9px 14px!important}html.kpi2 .ff-go:hover{background:#f5f8ff!important}' +
    'html.kpi2 .ff-bl .hd{background:#101828!important;font-size:14px!important}' +
    'html.kpi2 .ff-btn{background:#4f46e5!important;border-radius:10px!important}html.kpi2 .ff-btn:hover{background:#4338ca!important}' +
    'html.kpi2 .ff-sim div,html.kpi2 .ff-act li{background:#f9fafb!important;border:1px solid #eaecf0!important;border-radius:12px!important}' +
    'html.kpi2 #asOv input[type=range]{accent-color:#4f46e5!important}' +
    // the control room: the hero calmer (one deep blue), the KPI tiles like the others
    'html.kpi2 .cr-hero{background:linear-gradient(160deg,#0f1b3d,#1e2a5a)!important}html.kpi2 .cr-hero::after{opacity:.5}' +
    'html.kpi2 .cr-kpi{border:1px solid #e6eaf2!important;border-radius:16px!important;box-shadow:0 1px 2px rgba(16,24,40,.04),0 4px 12px -4px rgba(16,24,40,.08)!important}' +
    'html.kpi2 .cr-kpi::before{height:3px!important}' +
    'html.kpi2 .cr-kpi span{color:#667085!important;font-weight:600!important}' +
    'html.kpi2 .cr-card,html.kpi2 .cr-okc{border:1px solid #e6eaf2;border-radius:16px!important;box-shadow:0 1px 2px rgba(16,24,40,.04),0 1px 3px rgba(16,24,40,.06)!important}' +
    'html.kpi2 .cr-sec{color:#475467!important;font-weight:700!important;letter-spacing:.1px}' +
    'html.kpi2 .cr-acts button{border:1px solid #d0d5dd!important;border-radius:10px!important}' +
    'html.kpi2 .cr-acts button.pri{background:#4f46e5!important;border-color:#4f46e5!important;box-shadow:none!important}' +
    // the switch
    '.kpi-sw{white-space:nowrap}';

  function injectCss() {
    if (document.getElementById('kpi2Css')) return;
    const st = document.createElement('style'); st.id = 'kpi2Css'; st.textContent = css; document.head.appendChild(st);
  }
  function syncBtns() {
    const modern = get() !== 'classic';
    document.querySelectorAll('.kpi-sw').forEach((b) => {
      const t = modern ? '🎨 עיצוב קלאסי' : '🎨 עיצוב מודרני';
      if (b.textContent !== t) b.textContent = t;   // only when it changes (an observer must not loop)
      b.title = modern ? 'חזרה לעיצוב הקודם של המסך' : 'העיצוב החדש — כרטיסי KPI';
    });
  }
  // a switch in each screen's top bar, before its close button
  function addBtns() {
    [['sdOv', '.sd-top', 'sdClose'], ['asOv', '.ff-top', 'asXls'], ['crOv', '.cr-top', 'crRe']].forEach(([ov, top, before]) => {
      const o = document.getElementById(ov);
      if (!o || o.querySelector('.kpi-sw')) return;
      const bar = o.querySelector(top), ref = document.getElementById(before);
      if (!bar) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'kpi-sw';
      b.addEventListener('click', () => { set(get() === 'classic' ? 'modern' : 'classic'); apply(); });
      if (ref && ref.parentNode === bar) bar.insertBefore(b, ref); else bar.appendChild(b);
    });
    syncBtns();
  }
  function start() {
    injectCss(); apply(); addBtns();
    new MutationObserver(addBtns).observe(document.body, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
