// 📦 ספירת מלאי (15/11/2026, the owner): 💼 ניהול העסק ▸ תפעול ▸ 📦 ספירת מלאי (the managers) and
// 📅 סידור עבודה ונוכחות ▸ 📦 ספירת מלאי (every employee — "open to all the employees; the system knows who counted":
// the line's name comes from the sign-in, shown as "👤 סופר/ת"). The employees count; the merge / export / close — managers.
// 15/11 (the owner): no Comax stock anywhere — the catalog only names the barcode; instead "how many times it was counted"
// and the time of each count (the phone's time of the scan, also when the line was sent later). The camera: html5-qrcode
// 2.3.8 from cdnjs (the page's security policy allows cdnjs only — ZXing from jsdelivr was blocked, so the camera did not
// open on phones without the browser's own BarcodeDetector, e.g. iPhones); it uses BarcodeDetector where there is one.
// 15/11 (the owner): typing the last 6 digits (4–7) finds the item — several → a list to choose. An item NOT in the
// catalog needs its full barcode, and a typed one is checked: 8 / 12 / 13 / 14 digits — the check digit (GS1); another
// length — typed a second time. A scanned one (the camera, or a scanner — its keys come < 35 ms apart) is trusted.
// 15/11 (the owner): EVERY COUNT IS INDEPENDENT — one person's, its own unique date and time; nobody joins another's count,
// a finished count is never reopened; the managers tick any counts and the merge makes the summaries (per count + all).
// A quantity above 5,000 is refused until it is typed a second time (a pallet: 182 cartons × 24 = 4,368).
// 15/11 (the owner: "the camera opens but does not scan; typing by hand — the keyboard has no Enter, only ✓, and nothing
// happens"): the video is no longer stretched (object-fit:cover over a fixed frame moved the picture away from the area
// html5-qrcode decodes); a sharper picture (1920×1080 ideal, continuous focus) and a wide box for 1-D barcodes;
// "📸 צילום" — a photo of the barcode decoded (scanFile, made ≤ 1600 px) when the live picture does not catch it.
// The barcode field and the item card are <form>s: the phone keyboard's ✓ / Go submits them (it sends no Enter key);
// a 🔎 button next to the field.
//   the list   the open counts (+ ספירה חדשה), the closed ones of 60 days; tick several → one merge
//   counting   scan (the phone's camera, or a scanner / typing + Enter) → a known item shows its name, how many times and
//              what was already counted here; an unknown one: "פריט לא קיים בקטלוג" + its name in the notes (required)
//              → the quantity → ✓. Each person counts into his own count; "where" (a shelf / an aisle) is
//              optional. Each line goes to the server at once; without a connection it waits on the phone and is sent
//              later (the same line is never doubled — clientId). My lines: fix the quantity / the note, delete.
//   the merge  one row per barcode over the chosen counts: the quantity, how many times, when; the unknown ones
//              with their notes → ⬇ the file for Comax (barcode + quantity, the catalog's items) · ⬇ the full report
// Server: api inv* (inventory-count.ts; migration 20261115100000_inventory_count.sql). Comax is never written to.
// Uses the app's globals: apiPost, mgrAuth, state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isMgr = () => !!(appState() && appState().mgr);
  const canUse = () => !!(appState() && (appState().mgr || appState().emp));
  const mAuth = () => (typeof anyAuth === 'function' ? anyAuth() : typeof mgrAuth === 'function' ? mgrAuth() : {});
  const myName = () => { const s = appState(); return (s && (s.mgr ? s.mgr.name : s.emp && s.emp.name)) || ''; };
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); };
  const api = (action, extra) => apiPost({ action, ...mAuth(), ...(extra || {}) }).catch(() => ({ ok: false, net: true, error: 'אין חיבור לשרת' }));
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  const fmt = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('he-IL', { maximumFractionDigits: 3 }));
  const dm = (s) => (s ? String(s).slice(8, 10) + '/' + String(s).slice(5, 7) : '');
  const hm = (s) => { const d = new Date(s); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const QTY_MAX = 5000;
  const when = (s) => (s ? dm(s) + '/' + new Date(s).getFullYear() + ' ' + hm(s) : '');
  const label = (c) => (c.title && c.title !== 'ספירה' ? c.title : '');
  const cname = (c) => '👤 ' + (c.opened_by || '') + ' · ' + when(c.opened_at);
  const today = () => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };
  const XS_URL = '/vendor/xlsx-js-style-1.2.0.min.js';
  const QR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
  const dt = (s) => (s ? dm(s) + '/' + new Date(s).getFullYear() + ' ' + hm(s) : '');
  const span = (a, b) => (!a ? '' : hm(a) === hm(b) || !b ? dm(a) + ' ' + hm(a) : dm(a) + ' ' + hm(a) + '–' + (dm(a) === dm(b) ? '' : dm(b) + ' ') + hm(b));
  const PEND = 'invPend';
  const fine = () => window.matchMedia && matchMedia('(pointer:fine)').matches;
  // the same check as the server (inventory-count.ts barcodeCheck): 'ok' / 'bad' (a wrong check digit) / 'confirm'
  const gs1Ok = (d) => { let sum = 0; for (let i = d.length - 2, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(d[i]) * w; return (10 - (sum % 10)) % 10 === Number(d[d.length - 1]); };
  const upcE2A = (e8) => { const m = e8.slice(1, 7), x = m[5]; return e8[0] + (x <= '2' ? m.slice(0, 2) + x + '0000' + m.slice(2, 5) : x === '3' ? m.slice(0, 3) + '00000' + m.slice(3, 5) : x === '4' ? m.slice(0, 4) + '00000' + m[4] : m.slice(0, 5) + '0000' + x) + e8[7]; };
  const bcCheck = (b) => !/^\d+$/.test(b) ? 'confirm' : [12, 13, 14].includes(b.length) ? (gs1Ok(b) ? 'ok' : 'bad') : b.length === 8 ? (gs1Ok(b) || (/^[01]/.test(b) && gs1Ok(upcE2A(b))) ? 'ok' : 'bad') : 'confirm';
  let kt = [];   // the barcode field's key times: a scanner types the whole code in a burst

  let view = 'list', L = null, cur = null, mine = [], item = null, merge = null, mIds = [], mFilter = 'all', mQ = '', camOn = false, busy = false;
  let pend = []; try { pend = JSON.parse(store.get(PEND) || '[]'); } catch (_) { pend = []; }
  const savePend = () => store.set(PEND, JSON.stringify(pend));

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#ivOv{position:fixed;inset:0;z-index:9000;background:#eef2f7;overflow:auto;direction:rtl;font-family:inherit;color:#0f172a}#ivOv.hidden{display:none}' +
    '.iv-top{position:sticky;top:0;z-index:3;background:linear-gradient(135deg,#0b1220,#13213d);color:#fff;padding:10px 14px;display:flex;align-items:center;gap:10px;box-shadow:0 6px 18px -8px rgba(15,23,42,.5)}' +
    '.iv-top h2{margin:0;font-size:17px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.iv-top .sp{flex:1}' +
    '.iv-top button{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:7px 12px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;white-space:nowrap}' +
    '.iv-body{max-width:760px;margin:0 auto;padding:14px 14px 60px}' +
    '.iv-card{background:#fff;border-radius:18px;padding:14px 16px;margin-bottom:10px;box-shadow:0 6px 20px -10px rgba(15,23,42,.18),0 1px 0 rgba(15,23,42,.04)}' +
    '.iv-card h3{margin:0 0 4px;font-size:16px;font-weight:900}.iv-mut{color:#64748b;font-size:13px;line-height:1.5}' +
    '.iv-btn{border:1.5px solid #e2e8f0;background:#fff;border-radius:12px;padding:9px 14px;font:inherit;font-size:14px;font-weight:800;color:#0f172a;cursor:pointer}' +
    '.iv-btn:active{transform:scale(.97)}.iv-btn:disabled{opacity:.5}' +
    '.iv-pri{background:linear-gradient(135deg,#0076DA,#4f46e5);color:#fff;border-color:transparent;box-shadow:0 6px 16px -6px rgba(79,70,229,.6)}' +
    '.iv-ok{background:linear-gradient(135deg,#22c55e,#0d9488);color:#fff;border-color:transparent}' +
    '.iv-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}' +
    '.iv-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.iv-pills span{background:#f1f5f9;border-radius:99px;padding:3px 10px;font-size:12.5px;font-weight:800;color:#334155}' +
    '.iv-pills span.w{background:#fff7ed;color:#c2410c}' +
    '.iv-h{font-size:13px;font-weight:900;color:#334155;margin:18px 4px 8px}' +
    '.iv-badge{display:inline-block;border-radius:99px;padding:2px 9px;font-size:11.5px;font-weight:900;vertical-align:middle;margin-inline-start:6px}' +
    '.iv-scan{background:#fff;border-radius:20px;padding:14px;box-shadow:0 10px 30px -12px rgba(15,23,42,.25)}' +
    '.iv-row{display:flex;gap:8px}.iv-row input{flex:1;min-width:0}' +
    '.iv-in{border:2px solid #cbd5e1;border-radius:14px;padding:11px 12px;font:inherit;font-size:17px;background:#fff;width:100%;box-sizing:border-box}' +
    '.iv-in:focus{outline:none;border-color:#0076DA;box-shadow:0 0 0 4px rgba(0,118,218,.15)}' +
    '.iv-cam{position:relative;border-radius:16px;overflow:hidden;background:#000;margin-bottom:10px}' +
    '.iv-cam video{display:block;width:100%!important;height:auto!important}.iv-cam>div[id^=ivReader]{width:100%;border:0!important}' +
    '.iv-camb{display:flex;gap:8px;justify-content:space-between;padding:8px;background:#0b1220}' +
    '.iv-camb button{background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:10px;padding:8px 12px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer}' +
    '.iv-cam .fr{position:absolute;inset:22% 10%;border:2.5px solid rgba(255,255,255,.85);border-radius:14px}' +

    '@keyframes ivScan{from{transform:translateY(-60px)}to{transform:translateY(60px)}}' +
    '.iv-item{margin-top:12px;border-radius:16px;padding:14px;animation:ivIn .25s ease}' +
    '.iv-item.k{background:linear-gradient(135deg,#eff6ff,#eef2ff);border:1.5px solid #c7d2fe}.iv-item.u{background:#fff7ed;border:1.5px solid #fdba74}' +
    '.iv-item .nm{font-size:18px;font-weight:900;line-height:1.3}.iv-item .bc{font-size:12.5px;color:#64748b;direction:ltr;text-align:right}' +
    '.iv-nums{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.iv-nums div{background:#fff;border-radius:12px;padding:8px 10px}' +
    '.iv-nums b{display:block;font-size:20px;font-weight:900}.iv-nums small{color:#64748b;font-size:12px;font-weight:700}' +
    '.iv-qty{font-size:26px;font-weight:900;text-align:center;letter-spacing:.5px}' +
    '.iv-quick{display:flex;gap:6px;margin-top:8px}.iv-quick button{flex:1;border:1.5px solid #e2e8f0;background:#fff;border-radius:10px;padding:7px 0;font:inherit;font-weight:900;cursor:pointer}' +
    '.iv-warn{color:#c2410c;font-weight:800;font-size:14px;margin:6px 0 8px}' +
    '.iv-ln{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid #f1f5f9;font-size:14px}' +
    '.iv-ln .t{flex:1;min-width:0}.iv-ln .t b{display:block;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.iv-ln .t small{color:#64748b;font-size:12px}' +
    '.iv-ln .q{font-weight:900;font-size:16px;min-width:44px;text-align:center}' +
    '.iv-ln button{border:0;background:#f1f5f9;border-radius:9px;padding:6px 9px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;color:#334155}' +
    '.iv-ln button.del.sure{background:#dc2626;color:#fff}.iv-ln.p{opacity:.7}.iv-ln.err{background:#fff1f2}' +
    '.iv-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}' +
    '.iv-kpi{background:#fff;border-radius:16px;padding:12px;box-shadow:0 6px 20px -12px rgba(15,23,42,.25)}.iv-kpi b{display:block;font-size:24px;font-weight:900}.iv-kpi span{font-size:12px;font-weight:800;color:#64748b}' +
    '.iv-chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.iv-chips button{border:1.5px solid #cbd5e1;background:#fff;border-radius:99px;padding:6px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;color:#334155}' +
    '.iv-chips button.on{background:#0f172a;border-color:#0f172a;color:#fff}' +
    '.iv-tbl{width:100%;border-collapse:collapse;font-size:13px}.iv-tbl th,.iv-tbl td{padding:8px 6px;border-bottom:1px solid #f1f5f9;text-align:right;vertical-align:top}' +
    '.iv-tbl th{color:#64748b;font-size:11.5px;font-weight:800;position:sticky;top:0;background:#fff}.iv-tbl td.n{text-align:left;white-space:nowrap;font-weight:800}' +
    '.iv-tbl tr.u td{background:#fff7ed}.iv-tbl .bc{direction:ltr;font-size:11.5px;color:#64748b;display:block;text-align:right}' +
    '.iv-wrap{max-height:60vh;overflow:auto}.iv-sel{width:20px;height:20px;accent-color:#4f46e5;flex:none}' +
    '.iv-pend{background:#fef3c7;color:#92400e;border-radius:12px;padding:8px 12px;font-size:13px;font-weight:800;margin-bottom:10px}' +
    '@keyframes ivIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){#ivOv *{animation:none!important}}' +
    '@media (max-width:560px){.iv-kpis{grid-template-columns:repeat(2,1fr)}.iv-tbl .hide{display:none}}' +
    '</style>');

  /* ================= the shell ================= */
  function open() {
    if (!canUse()) return;
    if (!$('ivOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="ivOv" class="hidden"><div class="iv-top"><button id="ivBack" hidden>→</button><h2 id="ivTitle">📦 ספירת מלאי</h2><span class="sp"></span>' +
        '<button id="ivX">✕ סגירה</button></div><div class="iv-body" id="ivBody"></div></div>');
      $('ivX').addEventListener('click', close);
      $('ivBack').addEventListener('click', () => { camStop(); showList(); });
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('ivOv') && !$('ivOv').classList.contains('hidden') && !camOn) close(); });
      window.addEventListener('online', flush);
    }
    $('ivOv').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    showList();
    flush();
  }
  function close() { camStop(); $('ivOv').classList.add('hidden'); document.body.style.overflow = ''; }
  function head(title, back) { $('ivTitle').textContent = title; $('ivBack').hidden = !back; }

  /* ================= the list ================= */
  async function showList() {
    view = 'list'; head('📦 ספירת מלאי', false);
    $('ivBody').innerHTML = '<div class="iv-mut" style="text-align:center;padding:30px">טוען…</div>';
    const r = await api('invList');
    if (view !== 'list') return;
    if (!r.ok) { $('ivBody').innerHTML = '<div class="iv-card">' + e(r.error) + '<div class="iv-acts"><button class="iv-btn" id="ivRe">↻ שוב</button></div></div>'; $('ivRe').onclick = showList; return; }
    L = r;
    const me = r.me, mineOpen = r.counts.filter((c) => c.status === 'open' && c.opened_by === me);
    const others = r.counts.filter((c) => !(c.status === 'open' && c.opened_by === me));
    let h = pendBar() + '<div class="iv-card" style="background:linear-gradient(135deg,#eff6ff,#f5f3ff)"><h3>➕ ספירה חדשה</h3><div class="iv-mut">כל ספירה עצמאית — שלכם בלבד, עם תאריך ושעה משלה. ' +
      (r.mgr ? 'בסוף מסמנים את הספירות ומאחדים אותן לסיכום ולאקסל לקומקס.' : 'כשמסיימים — "✓ סיום הספירה"; את האיחוד עושה המנהל.') + '</div>' +
      '<div class="iv-row" style="margin-top:10px"><input class="iv-in" id="ivNewT" style="font-size:15px" placeholder="מה סופרים / איפה (לא חובה)"><button class="iv-btn iv-pri" id="ivNew">פתיחה</button></div></div>';
    if (mineOpen.length) h += '<div class="iv-h">🟢 הספירה הפתוחה שלי</div>' + mineOpen.map(card).join('');
    if (others.length) h += '<div class="iv-h">' + (r.mgr ? '📋 כל הספירות (60 יום) — סמנו כדי לאחד' : '✓ הספירות שלי שהסתיימו') + '</div>' + others.map(card).join('') +
      (r.mgr ? '<div class="iv-acts" style="position:sticky;bottom:10px"><button class="iv-btn iv-pri" id="ivMergeSel" disabled>📊 סמנו ספירות לאיחוד</button></div>' : '');
    if (!mineOpen.length && !others.length) h += '<div class="iv-mut" style="text-align:center;padding:20px">עוד אין ספירות — פותחים אחת למעלה.</div>';
    $('ivBody').innerHTML = h;
    $('ivNew').onclick = async () => {
      const b = $('ivNew'); b.disabled = true;
      const x = await api('invOpen', { title: $('ivNewT').value.trim() });
      b.disabled = false;
      if (!x.ok) return say(x.error, 'err');
      startCount(x.count);
    };
    $('ivBody').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => startCount(r.counts.find((c) => String(c.id) === b.dataset.go))));
    $('ivBody').querySelectorAll('[data-mg]').forEach((b) => b.addEventListener('click', () => showMerge([Number(b.dataset.mg)])));
    $('ivBody').querySelectorAll('[data-arc]').forEach((b) => b.addEventListener('click', async () => {
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'בטוח? לחצו שוב'; return; }
      const x = await api('invArchive', { countId: Number(b.dataset.arc) }); if (!x.ok) say(x.error, 'err'); showList();
    }));
    const sel = () => [...$('ivBody').querySelectorAll('.iv-sel:checked')].map((x) => Number(x.value));
    $('ivBody').querySelectorAll('.iv-sel').forEach((c) => c.addEventListener('change', () => {
      const n = sel().length; $('ivMergeSel').disabled = !n;
      $('ivMergeSel').textContent = n ? '📊 איחוד ' + (n > 1 ? n + ' ספירות' : 'הספירה שסומנה') : '📊 סמנו ספירות לאיחוד';
    }));
    if ($('ivMergeSel')) $('ivMergeSel').onclick = () => showMerge(sel());
  }
  function card(c) {
    const o = c.status === 'open', own = c.opened_by === L.me;
    return '<div class="iv-card"><div style="display:flex;gap:10px;align-items:flex-start">' + (L.mgr ? '<input type="checkbox" class="iv-sel" value="' + c.id + '">' : '') +
      '<div style="flex:1;min-width:0"><h3>' + e(cname(c)) + (o ? '<span class="iv-badge" style="background:#dcfce7;color:#166534">' + (own ? 'פתוחה' : 'סופרים עכשיו') + '</span>' : '<span class="iv-badge" style="background:#f1f5f9;color:#475569">הסתיימה ' + hm(c.closed_at) + '</span>') +
      (c.exported_at ? '<span class="iv-badge" style="background:#eef2ff;color:#4338ca">יוצאה ' + dm(c.exported_at) + '</span>' : '') + '</h3>' +
      (label(c) ? '<div class="iv-mut" style="font-weight:700;color:#334155">' + e(label(c)) + '</div>' : '') +
      '<div class="iv-mut">' + (c.last_at ? 'שורה אחרונה ' + hm(c.last_at) : 'עוד אין שורות') + (!o && c.closed_at ? ' · הסתיימה ' + when(c.closed_at) : '') + '</div>' +
      '<div class="iv-pills"><span>' + fmt(c.lines) + ' סריקות</span><span>' + fmt(c.items) + ' פריטים</span><span>' + fmt(c.units) + ' יחידות</span>' + (c.unknown ? '<span class="w">⚠ ' + c.unknown + ' לא בקטלוג</span>' : '') + '</div>' +
      '<div class="iv-acts">' + (o && own ? '<button class="iv-btn iv-pri" data-go="' + c.id + '">▶ להמשיך לספור</button>' : '') + (L.mgr ? '<button class="iv-btn" data-mg="' + c.id + '">📊 סיכום</button>' : '') +
      (L.admin ? '<button class="iv-btn" data-arc="' + c.id + '" style="margin-inline-start:auto;color:#64748b">🗄 לארכיון</button>' : '') + '</div></div></div></div>';
  }
  function pendBar() {
    if (!pend.length) return '';
    const errs = pend.filter((p) => p.err).length;
    return '<div class="iv-pend">⏳ ' + pend.length + ' שורות מחכות לשליחה' + (errs ? ' (' + errs + ' עם בעיה — ראו "הספירה שלי")' : ' — יישלחו כשיחזור החיבור') + '</div>';
  }

  /* ================= counting ================= */
  async function startCount(c) {
    if (!c) return;
    view = 'count'; cur = c; item = null; head('📦 ' + (label(c) || 'ספירה') + ' · ' + when(c.opened_at), true);
    $('ivBody').innerHTML = '<div id="ivPendBar"></div><div class="iv-mut" style="margin:0 4px 8px;font-weight:800">👤 סופר/ת: <span style="color:#0f172a">' + e(myName()) + '</span> — השם נרשם על כל שורה</div><div class="iv-scan">' +
      '<div id="ivCamBox"></div>' +
      '<form class="iv-row" id="ivBcF" action="#" autocomplete="off"><input class="iv-in" id="ivBc" inputmode="numeric" enterkeyhint="search" autocomplete="off" placeholder="ברקוד מלא או 6 ספרות אחרונות" dir="ltr" style="text-align:right">' +
      '<button type="submit" class="iv-btn" title="חיפוש" style="font-size:18px;padding:9px 12px">🔎</button><button type="button" class="iv-btn iv-pri" id="ivCam" title="סריקה במצלמה" style="font-size:18px;padding:9px 12px">📷</button></form>' +
      '<div class="iv-row" style="margin-top:8px;align-items:center"><span class="iv-mut" style="white-space:nowrap">📍 איפה:</span><input class="iv-in" id="ivArea" style="font-size:14px;padding:8px 10px" placeholder="למשל מדף 4, מחסן (לא חובה)" value="' + e(store.get('invArea') || '') + '"></div>' +
      '<div id="ivItem"></div></div>' +
      '<div class="iv-h" id="ivMineH">הספירה שלי</div><div class="iv-card" id="ivMine" style="padding:6px 14px"><div class="iv-mut" style="padding:10px 0">טוען…</div></div>' +
      '<div class="iv-acts"><button class="iv-btn iv-ok" id="ivFinish">✓ סיום הספירה</button>' + (isMgr() ? '<button class="iv-btn" id="ivToMerge">📊 סיכום</button>' : '') + '</div>' +
      '<div class="iv-mut" style="margin:6px 4px">אחרי הסיום אי אפשר להוסיף לספירה הזו. לספור שוב — פותחים ספירה חדשה.</div>';
    $('ivArea').addEventListener('change', () => store.set('invArea', $('ivArea').value.trim()));
    const goBc = () => {
      const v = $('ivBc').value.replace(/\s+/g, '');
      const fast = kt.length >= 6 && kt.length >= v.length - 1 && (kt[kt.length - 1] - kt[0]) / (kt.length - 1) < 35;
      kt = [];
      if (v) { $('ivBc').blur(); lookup(v, fast ? 'scan' : 'typed'); } else say('הקלידו ברקוד או 6 ספרות אחרונות', 'err');
    };
    $('ivBc').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); goBc(); }
      else if (ev.key.length === 1) kt.push(performance.now());
    });
    $('ivBcF').addEventListener('submit', (ev) => { ev.preventDefault(); goBc(); });   // the phone keyboard's ✓ / Go
    $('ivBc').addEventListener('input', () => { if (!$('ivBc').value) kt = []; });
    $('ivBc').addEventListener('paste', () => { kt = []; });
    $('ivCam').onclick = () => (camOn ? camStop() : camStart());
    if ($('ivToMerge')) $('ivToMerge').onclick = () => { camStop(); showMerge([cur.id]); };
    $('ivFinish').onclick = async () => {
      const b = $('ivFinish');
      if (pend.some((p) => p.countId === cur.id)) return say('יש שורות שעוד לא נשלחו — חכו לחיבור ואז סיימו', 'err');
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'לסיים? לחצו שוב'; setTimeout(() => { if (b.isConnected) { b.classList.remove('sure'); b.textContent = '✓ סיום הספירה'; } }, 4000); return; }
      const x = await api('invClose', { countId: cur.id }); if (!x.ok) return say(x.error, 'err');
      camStop(); say('✓ הספירה הסתיימה'); showList();
    };
    if (fine()) $('ivBc').focus();
    loadMine();
  }
  async function loadMine() {
    const r = await api('invLines', { countId: cur.id });
    if (r.ok) mine = r.lines;
    drawMine();
  }
  function drawMine() {
    if (view !== 'count' || !$('ivMine')) return;
    $('ivPendBar').innerHTML = pendBar();
    const pp = pend.filter((p) => p.countId === cur.id && (!p.by || p.by === myName()));
    const all = pp.map((p) => ({ ...p, p: true })).concat(mine);
    const units = all.reduce((s, x) => s + Number(x.qty || 0), 0);
    $('ivMineH').textContent = 'הספירה שלי — ' + all.length + ' שורות · ' + fmt(units) + ' יחידות';
    if (!all.length) { $('ivMine').innerHTML = '<div class="iv-mut" style="padding:10px 0">עוד לא ספרתם כאן. סרקו ברקוד כדי להתחיל.</div>'; return; }
    $('ivMine').innerHTML = all.slice(0, 200).map((l) => '<div class="iv-ln' + (l.p ? ' p' : '') + (l.err ? ' err' : '') + '" data-id="' + (l.p ? 'p:' + l.clientId : l.id) + '">' +
      '<div class="t"><b>' + e(l.name || (l.known === false ? '⚠ ' + (l.note || 'לא בקטלוג') : l.barcode)) + '</b><small dir="ltr">' + e(l.barcode) + '</small><small> · ' +
      '🕒 ' + hm(l.at) + (l.p ? ' · ' + (l.err ? '⚠ ' + e(l.err) : '⏳ מחכה לשליחה') : '') + (l.area ? ' · 📍' + e(l.area) : '') + (l.note && l.known !== false ? ' · ' + e(l.note) : '') + '</small></div>' +
      '<span class="q">' + fmt(l.qty) + '</span>' + (l.p && !l.err ? '' : '<button class="ed">✎</button><button class="del">✕</button>') + '</div>').join('');
    $('ivMine').querySelectorAll('.iv-ln').forEach((row) => {
      const id = row.dataset.id, ed = row.querySelector('.ed'), del = row.querySelector('.del');
      if (del) del.onclick = async () => {
        if (!del.classList.contains('sure')) { del.classList.add('sure'); del.textContent = 'למחוק?'; setTimeout(() => { del.classList.remove('sure'); del.textContent = '✕'; }, 3000); return; }
        if (id.startsWith('p:')) { pend = pend.filter((p) => 'p:' + p.clientId !== id); savePend(); drawMine(); return; }
        const r = await api('invDel', { id: Number(id) }); if (!r.ok) return say(r.error, 'err');
        mine = mine.filter((x) => String(x.id) !== id); drawMine();
      };
      if (ed) ed.onclick = () => editRow(row, id);
    });
  }
  function editRow(row, id) {
    const p = id.startsWith('p:') ? pend.find((x) => 'p:' + x.clientId === id) : null, l = p || mine.find((x) => String(x.id) === id);
    if (!l) return;
    row.innerHTML = '<div class="t" style="display:flex;gap:6px;flex-wrap:wrap"><input class="iv-in" style="width:90px;font-size:15px;padding:7px" inputmode="decimal" value="' + e(l.qty) + '">' +
      '<input class="iv-in" style="flex:1;min-width:120px;font-size:14px;padding:7px" placeholder="הערה" value="' + e(l.note || '') + '"></div><button class="sv" style="background:#16a34a;color:#fff">💾</button>';
    const [qi, ni] = row.querySelectorAll('input'); qi.focus(); qi.select();
    row.querySelector('.sv').onclick = async () => {
      const qv = Number(String(qi.value).replace(',', '.'));
      if (!Number.isFinite(qv) || qv < 0 || qv > 1e6) return say('כמות לא תקינה', 'err');
      if (qv > QTY_MAX) {
        let q2 = row.querySelector('.q2');
        if (!q2) { qi.insertAdjacentHTML('afterend', '<input class="iv-in q2" style="width:90px;font-size:15px;padding:7px;border-color:#f59e0b" inputmode="decimal" placeholder="שוב">'); q2 = row.querySelector('.q2'); q2.focus(); return say('כמות מעל 5,000 — הקלידו אותה שוב לאישור', 'err'); }
        if (Number(String(q2.value).replace(',', '.')) !== qv) { q2.focus(); return say('הכמות שהוקלדה שוב לא זהה', 'err'); }
      }
      if (p) { p.qty = qv; p.note = ni.value.trim(); p.err = ''; p.bigOk = qv > QTY_MAX; savePend(); drawMine(); flush(); return; }
      const r = await api('invEdit', { id: Number(id), qty: qv, note: ni.value.trim(), bigOk: qv > QTY_MAX }); if (!r.ok) return say(r.error, 'err');
      l.qty = qv; l.note = ni.value.trim(); drawMine();
    };
  }

  const big = (b) => '<div class="bc" style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:1.5px">' + e(b) + '</div>';
  function stop(msg) {
    item = null;
    $('ivItem').innerHTML = '<div class="iv-item u">' + msg + '<div class="iv-acts"><button class="iv-btn" id="ivSkip">ביטול</button></div></div>';
    $('ivSkip').onclick = next;
    beep(220, 0.18);
  }
  async function lookup(code, src, exact) {
    code = String(code).replace(/\s+/g, '');
    src = src || 'typed';
    $('ivBc').value = code;
    $('ivItem').innerHTML = '<div class="iv-mut" style="padding:12px 2px">🔎 מחפש ' + e(code) + '…</div>';
    const r = await api('invLookup', { barcode: code, countId: cur.id, exact: exact || src === 'scan' });
    if (view !== 'count') return;
    if (!r.ok && !r.net) { $('ivItem').innerHTML = '<div class="iv-warn">' + e(r.error) + '</div>'; return; }
    // the last digits: several items end with them → choose
    if (r.tooMany) return stop('<div class="nm">🔎 יותר מדי מוצרים מסתיימים ב-' + e(code) + '</div><div class="iv-mut">הקלידו עוד ספרות מהסוף, או את הברקוד המלא.</div>');
    if (r.multi) {
      item = null; beep(880, 0.06);
      $('ivItem').innerHTML = '<div class="iv-item k"><div class="nm">נמצאו ' + r.multi.length + ' מוצרים שמסתיימים ב-' + e(code) + ' — בחרו:</div>' +
        r.multi.map((x) => '<button type="button" class="iv-btn" data-pick="' + e(x.barcode) + '" style="display:block;width:100%;text-align:right;margin-top:8px"><b>' + e(x.name) + '</b>' +
          (x.archived ? ' <span class="iv-badge" style="background:#f1f5f9;color:#64748b">ארכיון</span>' : '') + '<div class="bc">' + e(x.barcode.slice(0, -code.length)) + '<b style="color:#0076DA">' + e(x.barcode.slice(-code.length)) + '</b></div></button>').join('') +
        '<div class="iv-acts"><button class="iv-btn" id="ivSkip">ביטול</button></div></div>';
      $('ivItem').querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => lookup(b.dataset.pick, 'pick', true)));
      $('ivSkip').onclick = next;
      return;
    }
    if (!r.ok && /^\d{4,7}$/.test(code) && src !== 'scan') return stop('<div class="nm">📡 אין חיבור</div><div class="iv-mut">חיפוש לפי הספרות האחרונות צריך חיבור. סרקו את המוצר או הקלידו את הברקוד המלא.</div>');
    item = r.ok ? r : { barcode: code, offline: true, check: bcCheck(code) };
    item.src = src;
    // an item not in the catalog: its full barcode, checked (a scanned one is trusted)
    item.needConfirm = false;
    if (!item.known && src !== 'scan') {
      if (item.check === 'bad') return stop('<div class="nm">⚠ פריט לא בקטלוג — והברקוד לא תקין</div>' + big(item.barcode) +
        '<div class="iv-warn">הספרה האחרונה (ספרת הביקורת) לא מתאימה לשאר המספר — כנראה טעות הקלדה. בדקו את המספר על האריזה, או סרקו אותו.</div>');
      item.needConfirm = item.check !== 'ok';
    }
    if (r.ok && r.short) item.shortMiss = true;
    if (r.ok && !r.known) beep(220, 0.18); else beep(1100, 0.07);
    const pp = pend.filter((p) => p.countId === cur.id && p.barcode === item.barcode);
    const already = (item.already || 0) + pp.reduce((s, p) => s + Number(p.qty || 0), 0), times = (item.times || 0) + pp.length;
    const lastP = pp.length ? { at: pp[pp.length - 1].at, by: pp[pp.length - 1].by } : null, last = lastP || item.last;
    const seen = times ? '<div class="iv-nums"><div><small>כבר נספר בספירה הזו</small><b>' + fmt(already) + '</b></div><div><small>כמה פעמים נספר</small><b>' + times + (times === 1 ? ' פעם' : ' פעמים') + '</b></div></div>' +
      (last ? '<div class="iv-mut">אחרון: ' + hm(last.at) + (last.by ? ' · ' + e(last.by) : '') + '</div>' : '') : '<div class="iv-mut" style="margin:8px 0">עוד לא נספר בספירה הזו.</div>';
    let h;
    const conf = item.needConfirm ? '<div class="iv-mut" style="margin-top:8px;font-weight:700;color:#0f172a">' +
      (item.shortMiss ? 'אם זה פריט שלא בקטלוג — סרקו אותו או הקלידו את הברקוד המלא (בדרך כלל 13 ספרות). ואם ' + e(item.barcode) + ' הוא באמת הברקוד המלא שלו — הקלידו אותו שוב לאישור:'
        : 'לברקוד באורך ' + item.barcode.length + ' ספרות אין ספרת ביקורת — כדי לוודא שאין טעות, הקלידו אותו שוב:') +
      '</div><input class="iv-in" id="ivConf" inputmode="numeric" autocomplete="off" dir="ltr" style="text-align:right;margin-top:6px" placeholder="הברקוד שוב">' : '';
    const ok = !item.known && item.src !== 'scan' && item.check === 'ok' ? '<div class="iv-mut" style="color:#166534;font-weight:700">✓ הברקוד תקין (ספרת הביקורת מתאימה)</div>' : '';
    if (item.offline) h = '<div class="iv-item u"><div class="nm">📡 אין חיבור — לא בדקתי בקטלוג</div>' + big(code) + '<div class="iv-mut">הכמות תישמר בטלפון ותישלח כשיחזור החיבור. כדאי לכתוב בהערות מה המוצר.</div>' + ok + conf;
    else if (item.known) h = '<div class="iv-item k"><div class="nm">' + e(item.name) + '</div><div class="bc">' + e(item.barcode) + '</div>' + seen;
    else h = '<div class="iv-item u"><div class="nm">' + (item.shortMiss ? '🔎 לא נמצא מוצר שהברקוד שלו מסתיים ב-' + e(item.barcode) : '⚠ פריט לא קיים בקטלוג') + '</div>' + big(item.barcode) + ok + conf +
      '<div class="iv-warn">כתבו בהערות מה המוצר (שם, גודל, יצרן) — חובה.</div>' + seen;
    h += '<input class="iv-in iv-qty" id="ivQty" inputmode="decimal" enterkeyhint="done" placeholder="כמות" autocomplete="off">' +
      '<div class="iv-quick">' + [1, 2, 3, 6, 12, 24].map((n) => '<button type="button" data-q="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<input class="iv-in" id="ivNote" style="margin-top:8px;font-size:14px;padding:9px 10px' + (item.known ? ';display:none' : '') + '" placeholder="' + (item.known ? 'הערה (לא חובה)' : 'מה המוצר? למשל: במבה 80 גרם אסם') + '" maxlength="200">' +
      '<div class="iv-acts">' + (item.known ? '<button type="button" class="iv-btn" id="ivNoteBtn" style="font-size:13px">+ הערה</button>' : '') +
      '<button type="submit" class="iv-btn iv-ok" id="ivSave" style="flex:1;font-size:16px">✓ שמירה</button><button type="button" class="iv-btn" id="ivSkip">ביטול</button></div></div>';
    $('ivItem').innerHTML = '<form id="ivItemF" action="#" autocomplete="off">' + h + '</form>';
    $('ivItemF').addEventListener('submit', (ev) => {   // the keyboard's ✓ on any field, or ✓ שמירה
      ev.preventDefault();
      const a = document.activeElement;
      if (a && a.id === 'ivConf') return $('ivQty').focus();
      if (a && a.id === 'ivQty' && item && !item.known && !$('ivNote').value.trim()) return $('ivNote').focus();
      save();
    });
    if ($('ivConf')) $('ivConf').focus(); else $('ivQty').focus();
    if ($('ivConf')) $('ivConf').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); $('ivQty').focus(); } });
    $('ivQty').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); if (!item.known && !$('ivNote').value.trim()) $('ivNote').focus(); else save(); } });
    $('ivNote').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); save(); } });
    $('ivItem').querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { $('ivQty').value = b.dataset.q; $('ivQty').focus(); }));
    if ($('ivNoteBtn')) $('ivNoteBtn').onclick = () => { $('ivNote').style.display = ''; $('ivNoteBtn').remove(); $('ivNote').focus(); };
    $('ivSkip').onclick = next;
  }
  function next() {
    item = null; $('ivItem').innerHTML = ''; $('ivBc').value = '';
    if (camWanted) camStart(); else if (fine()) $('ivBc').focus();
  }
  function save() {
    if (!item) return;
    const qv = Number(String($('ivQty').value).replace(',', '.').trim()), note = $('ivNote').value.trim();
    if ($('ivQty').value.trim() === '' || !Number.isFinite(qv) || qv < 0) { say('הקלידו כמות', 'err'); $('ivQty').focus(); return; }
    if (qv > 1e6) { say('כמות לא תקינה', 'err'); $('ivQty').focus(); return; }
    if (qv > QTY_MAX) {
      if (!$('ivQty2')) {
        $('ivQty').insertAdjacentHTML('afterend', '<div class="iv-warn" style="margin-top:8px">⚠ כמות מעל 5,000 — בדקו את המספר. אם הוא נכון, הקלידו אותו שוב:</div><input class="iv-in iv-qty" id="ivQty2" inputmode="decimal" autocomplete="off" placeholder="הכמות שוב">');
        $('ivQty2').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); save(); } });
        beep(220, 0.18); say('כמות מעל 5,000 — בדקו והקלידו שוב לאישור', 'err'); $('ivQty2').focus(); return;
      }
      if (Number(String($('ivQty2').value).replace(',', '.').trim()) !== qv) { say('הכמות שהוקלדה שוב לא זהה — בדקו את המספר', 'err'); $('ivQty2').focus(); return; }
    }
    if (item.needConfirm && ($('ivConf').value || '').replace(/\s+/g, '') !== item.barcode) { say('הברקוד שהוקלד שוב לא זהה — בדקו את המספר', 'err'); $('ivConf').focus(); return; }
    if (item.known === false && !note) { say('פריט לא קיים בקטלוג — כתבו בהערות מה המוצר', 'err'); $('ivNote').focus(); return; }
    const area = $('ivArea').value.trim(); store.set('invArea', area);
    pend.push({ clientId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), countId: cur.id, by: myName(), at: new Date().toISOString(), barcode: item.barcode, qty: qv, note, area,
      name: item.known ? item.name : null, known: item.offline ? undefined : !!item.known, src: item.src, confirmed: !!item.needConfirm, bigOk: qv > QTY_MAX });
    savePend();
    say('✓ נשמר: ' + (item.name || item.barcode) + ' × ' + fmt(qv));
    if (navigator.vibrate) navigator.vibrate(40);
    next(); drawMine(); flush();
  }
  async function flush() {
    if (busy || !pend.length) return;
    busy = true;
    for (const p of pend.slice()) {
      if (p.err || (p.by && p.by !== myName())) continue;          // only the one who counted it sends it
      const r = await api('invAdd', p);
      if (r.net) break;                                          // still no connection — try again later
      if (r.ok) {
        pend = pend.filter((x) => x.clientId !== p.clientId);
        if (cur && p.countId === cur.id && !r.dup) mine.unshift({ ...r.line, name: r.line.name || p.name, known: r.line.known });
      } else p.err = r.error || 'לא נשמר';
      savePend();
    }
    busy = false;
    if (view === 'count') drawMine();
    if (pend.some((p) => !p.err)) setTimeout(flush, 15000);
  }

  /* ---------- the camera: html5-qrcode (cdnjs — allowed by the page; the browser's BarcodeDetector inside when there is one) ---------- */
  let hq = null, camWanted = false, camSeq = 0;
  async function camStart() {
    camWanted = true;
    if (camOn) return;
    const box = $('ivCamBox'); if (!box) return;
    const rid = 'ivReader' + (++camSeq);
    box.innerHTML = '<div class="iv-cam"><div id="' + rid + '"></div><div class="iv-camb"><button type="button" id="ivSnap">📸 לא נקלט? צלמו תמונה</button><button type="button" id="ivCamX">✕ סגירה</button></div></div>' +
      '<div class="iv-mut" style="margin:-4px 2px 8px">מחזיקים את הברקוד לרוחב, בתוך המסגרת, כ-15 ס״מ מהטלפון ובאור טוב.</div>';
    $('ivCamX').onclick = () => { camWanted = false; camStop(); };
    $('ivSnap').onclick = photoScan;
    camOn = true;
    try {
      await loadQR();
      if (!camOn) return;
      const me = new Html5Qrcode(rid, qrOpts());
      hq = me;
      const cfg = { fps: 10, disableFlip: true, qrbox: (w, h) => ({ width: Math.max(200, Math.floor(w * 0.9)), height: Math.max(100, Math.floor(Math.min(h * 0.6, w * 0.5))) }) };
      const onCode = (text) => { if (!camOn || hq !== me) return; camStop(true); lookup(text, 'scan', true); };
      try {   // a sharp picture: 1-D barcodes need resolution and focus
        await me.start({ facingMode: 'environment' }, Object.assign({}, cfg, { videoConstraints: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: 'continuous' }] } }), onCode, () => {});
      } catch (e1) {
        if (/NotAllowed|Permission|denied/i.test(String((e1 && (e1.name || e1.message)) || e1))) throw e1;
        await me.start({ facingMode: 'environment' }, cfg, onCode, () => {});   // a camera that refuses those — the plain way
      }
      if (!camOn || hq !== me) { try { await me.stop(); } catch (_) {} }
    } catch (err) {
      const m = String((err && (err.name || err.message)) || err || '');
      camStop();
      say(/NotAllowed|Permission|denied/i.test(m) ? 'צריך לאשר לאתר גישה למצלמה (בהגדרות הדפדפן ← הרשאות האתר ← מצלמה)'
        : /NotFound|Overconstrained|no camera/i.test(m) ? 'לא נמצאה מצלמה במכשיר — אפשר להקליד ברקוד'
        : /load/.test(m) ? 'לא הצלחתי לטעון את רכיב הסריקה — בדקו את החיבור ונסו שוב'
        : 'לא הצלחתי לפתוח את המצלמה — אפשר להקליד ברקוד או להשתמש בסורק', 'err');
    }
  }
  function loadQR() {
    if (window.Html5Qrcode) return Promise.resolve();
    return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = QR_URL; sc.onload = res; sc.onerror = () => rej(new Error('load')); document.head.appendChild(sc); });
  }
  function qrOpts() {
    const F = window.Html5QrcodeSupportedFormats;
    const fm = F ? [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE].filter((x) => x != null) : undefined;
    return { formatsToSupport: fm, experimentalFeatures: { useBarCodeDetectorIfSupported: true }, verbose: false };
  }
  // 📸 a photo of the barcode (the phone's own camera app — focused and sharp), made ≤ 1600 px and decoded
  function photoScan() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      $('ivItem').innerHTML = '<div class="iv-mut" style="padding:12px 2px">🔎 קורא את הברקוד מהתמונה…</div>';
      try {
        await loadQR();
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
        const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(img.src);
        const small = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.92));
        if (!$('ivPhotoR')) document.body.insertAdjacentHTML('beforeend', '<div id="ivPhotoR" style="display:none"></div>');
        const sc = new Html5Qrcode('ivPhotoR', qrOpts());
        let text = '';
        try { text = await sc.scanFile(new File([small], 'b.jpg', { type: 'image/jpeg' }), false); } finally { try { sc.clear(); } catch (_) {} }
        lookup(text, 'scan', true);
      } catch (_) {
        $('ivItem').innerHTML = '';
        say('לא הצלחתי לקרוא את הברקוד מהתמונה — צלמו קרוב יותר, ישר ובאור טוב, או הקלידו 6 ספרות אחרונות', 'err');
      }
    };
    camStop(true);   // the live camera off while the camera app takes the photo
    inp.click();
  }
  function camStop(keepWanted) {
    if (!keepWanted) camWanted = false;
    camOn = false;
    const h = hq; hq = null;
    const box = $('ivCamBox');
    if (h) { Promise.resolve().then(() => h.stop()).catch(() => {}).finally(() => { try { h.clear(); } catch (_) {} if (!camOn && box && box.isConnected && !hq) box.innerHTML = ''; }); }
    else if (box) box.innerHTML = '';
  }
  let ac = null;
  function beep(f, d) {
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch (_) {}
  }

  /* ================= the merge ================= */
  async function showMerge(ids) {
    view = 'merge'; mIds = ids; mFilter = 'all'; mQ = ''; head('📊 איחוד וייצוא', true);
    $('ivBody').innerHTML = '<div class="iv-mut" style="text-align:center;padding:30px">מאחד…</div>';
    const r = await api('invMerge', { ids });
    if (view !== 'merge') return;
    if (!r.ok) { $('ivBody').innerHTML = '<div class="iv-card">' + e(r.error) + '</div>'; return; }
    merge = r;
    for (const x of r.rows) { x.qty = Number(x.qty); x.lines = Number(x.lines) || 0; }
    drawMerge();
  }
  function drawMerge() {
    const R = merge.rows, unk = R.filter((x) => !x.known), dif = R.filter((x) => x.lines > 1);
    const units = R.reduce((s, x) => s + x.qty, 0), people = new Set(R.flatMap((x) => String(x.counters || '').split(', ').filter(Boolean))).size;
    const one = merge.counts.length === 1 ? merge.counts[0] : null;
    const openN = merge.counts.filter((c) => c.status === 'open').length;
    let h = '<div class="iv-card" style="padding:12px 16px"><h3>' + (merge.counts.length === 1 ? 'סיכום ספירה' : 'סיכום ' + merge.counts.length + ' ספירות') + '</h3>' +
      (openN ? '<div class="iv-warn" style="font-size:13px">' + (openN === 1 && one ? 'הספירה עדיין פתוחה — ' : openN + ' מהספירות עדיין פתוחות — ') + 'מה שייספר מעכשיו לא נכלל בסיכום הזה.</div>' : '') +
      '<div class="iv-wrap" style="max-height:220px"><table class="iv-tbl"><thead><tr><th>ספירה</th><th class="n">סריקות</th><th class="n">פריטים</th><th class="n">יחידות</th></tr></thead><tbody>' +
      merge.counts.map((c) => '<tr><td><b>' + e(cname(c)) + '</b>' + (label(c) ? '<small class="iv-mut"> · ' + e(label(c)) + '</small>' : '') + '<small class="iv-mut"> · ' + (c.status === 'open' ? 'פתוחה' : 'הסתיימה ' + hm(c.closed_at)) + '</small></td>' +
        '<td class="n">' + fmt(c.lines) + '</td><td class="n">' + fmt(c.items) + '</td><td class="n">' + fmt(c.units) + '</td></tr>').join('') + '</tbody></table></div></div>' +
      '<div class="iv-kpis"><div class="iv-kpi"><b>' + fmt(R.length) + '</b><span>פריטים</span></div><div class="iv-kpi"><b>' + fmt(units) + '</b><span>יחידות</span></div>' +
      '<div class="iv-kpi"><b style="color:' + (unk.length ? '#c2410c' : '#16a34a') + '">' + unk.length + '</b><span>לא בקטלוג</span></div><div class="iv-kpi"><b>' + people + '</b><span>סופרים</span></div></div>' +
      '<div class="iv-card"><h3>⬇ ייצוא</h3><div class="iv-mut">הקובץ לקומקס: עמודת ברקוד ועמודת כמות — כמות אחת לכל ברקוד (סכום כל הסופרים).' +
      (unk.length ? ' <b style="color:#c2410c">' + unk.length + ' פריטים שלא בקטלוג לא נכנסים לקובץ</b> — פתחו אותם בקומקס, ומחר (אחרי העדכון הלילי) ייצאו שוב והם ייכנסו.' : '') + '</div>' +
      '<div class="iv-acts"><button class="iv-btn iv-pri" id="ivXc">⬇ קובץ לקומקס (ברקוד + כמות)</button><button class="iv-btn" id="ivXf">⬇ דוח מלא</button>' +
      (one && one.status === 'open' ? '<button class="iv-btn iv-ok" id="ivClose">🔒 סיום הספירה</button>' : '') + '</div></div>' +
      '<div class="iv-card"><div class="iv-chips"><button data-f="all"' + (mFilter === 'all' ? ' class="on"' : '') + '>הכול (' + R.length + ')</button>' +
      '<button data-f="unk"' + (mFilter === 'unk' ? ' class="on"' : '') + '>⚠ לא בקטלוג (' + unk.length + ')</button><button data-f="dif"' + (mFilter === 'dif' ? ' class="on"' : '') + '>נספר יותר מפעם אחת (' + dif.length + ')</button></div>' +
      '<input class="iv-in" id="ivQ" style="font-size:14px;padding:8px 10px" placeholder="🔎 חיפוש שם או ברקוד" value="' + e(mQ) + '">' +
      '<div class="iv-wrap" style="margin-top:8px"><table class="iv-tbl"><thead><tr><th>פריט</th><th class="n">כמות</th><th class="n">פעמים</th><th class="n hide">מתי</th></tr></thead><tbody id="ivRows"></tbody></table></div></div>';
    $('ivBody').innerHTML = h;
    rows();
    $('ivBody').querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { mFilter = b.dataset.f; $('ivBody').querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b)); rows(); }));
    $('ivQ').addEventListener('input', () => { mQ = $('ivQ').value.trim(); rows(); });
    $('ivXc').onclick = () => xlsx(false);
    $('ivXf').onclick = () => xlsx(true);
    if ($('ivClose')) $('ivClose').onclick = async () => {
      const b = $('ivClose');
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'לסגור? אחרי זה אי אפשר להוסיף — לחצו שוב'; return; }
      const x = await api('invClose', { countId: one.id }); if (!x.ok) return say(x.error, 'err');
      say('✓ הספירה נסגרה'); one.status = 'closed'; drawMerge();
    };
  }
  function rows() {
    let R = merge.rows;
    if (mFilter === 'unk') R = R.filter((x) => !x.known);
    if (mFilter === 'dif') R = R.filter((x) => x.lines > 1).sort((a, b) => b.lines - a.lines);
    if (mQ) { const k = mQ.toLowerCase(); R = R.filter((x) => String(x.barcode).includes(k) || String(x.name || x.notes || '').toLowerCase().includes(k)); }
    $('ivRows').innerHTML = R.slice(0, 1500).map((x) => '<tr' + (x.known ? '' : ' class="u"') + '><td><b>' + e(x.known ? x.name : '⚠ ' + (x.notes || 'לא בקטלוג')) + '</b><span class="bc">' + e(x.barcode) + '</span>' +
      (x.known && x.notes ? '<small class="iv-mut">' + e(x.notes) + '</small>' : '') + (x.areas ? '<small class="iv-mut"> 📍' + e(x.areas) + '</small>' : '') +
      (x.counters ? '<small class="iv-mut"> 👤' + e(x.counters) + '</small>' : '') + '</td>' +
      '<td class="n">' + fmt(x.qty) + '</td><td class="n" style="color:' + (x.lines > 1 ? '#c2410c' : '#334155') + '">' + x.lines + '</td><td class="n hide" style="font-weight:600;font-size:12px">' + e(span(x.first_at, x.last_at)) + '</td></tr>').join('') + (R.length > 1500 ? '<tr><td colspan="4" class="iv-mut">מוצגות 1,500 שורות — כל השורות נמצאות בקבצים</td></tr>' : '') +
      (!R.length ? '<tr><td colspan="4" class="iv-mut">אין שורות</td></tr>' : '');
  }
  async function xlsx(full) {
    let X = window.XLSX;
    try { const prev = window.XLSX; await new Promise((res, rej) => { const s = document.createElement('script'); s.src = XS_URL; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); X = window.XLSX; if (prev) window.XLSX = prev; }
    catch (_) { if (!X) return say('לא הצלחתי לטעון את רכיב האקסל', 'err'); }
    const R = merge.rows, wb = X.utils.book_new();
    const txt = (v) => ({ t: 's', v: String(v) }), nm = (v) => (v == null ? '' : { t: 'n', v: Number(v) });
    const hd = (a) => a.map((v) => ({ t: 's', v, s: { font: { bold: true }, fill: { fgColor: { rgb: 'E2E8F0' } } } }));
    const stamp = new Date().toISOString().slice(0, 10).split('-').reverse().join('-');
    if (!full) {
      const ws = X.utils.aoa_to_sheet([['ברקוד', 'כמות']].concat(R.filter((x) => x.known).map((x) => [txt(x.barcode), nm(x.qty)])));
      ws['!cols'] = [{ wch: 18 }, { wch: 10 }];
      X.utils.book_append_sheet(wb, ws, 'ספירה');
      X.writeFile(wb, 'ספירת מלאי לקומקס ' + stamp + '.xlsx');
    } else {
      const all = await api('invAllLines', { ids: mIds });
      if (!all.ok) return say(all.error || 'לא הצלחתי להביא את השורות', 'err');
      const names = {}; R.forEach((x) => { names[x.barcode] = x.known ? x.name : '⚠ ' + (x.notes || 'לא בקטלוג'); });
      const a = [hd(['ברקוד', 'שם', 'כמות', 'כמה פעמים נספר', 'ספירה ראשונה', 'ספירה אחרונה', 'איפה', 'מי ספר', 'הערות'])].concat(R.filter((x) => x.known).map((x) =>
        [txt(x.barcode), x.name || '', nm(x.qty), nm(x.lines), dt(x.first_at), dt(x.last_at), x.areas || '', x.counters || '', x.notes || '']));
      const ws = X.utils.aoa_to_sheet(a); ws['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 9 }, { wch: 13 }, { wch: 17 }, { wch: 17 }, { wch: 16 }, { wch: 18 }, { wch: 28 }];
      ws['!views'] = [{ RTL: true }]; X.utils.book_append_sheet(wb, ws, 'סיכום');
      const cn = {}; merge.counts.forEach((c) => { cn[c.id] = (c.opened_by || '') + ' ' + dt(c.opened_at) + (label(c) ? ' (' + label(c) + ')' : ''); });
      const sc = [hd(['ספירה — מי ומתי נפתחה', 'מה / איפה', 'הסתיימה', 'סריקות', 'פריטים', 'יחידות', 'לא בקטלוג'])].concat(merge.counts.map((c) =>
        [(c.opened_by || '') + ' ' + dt(c.opened_at), label(c), c.status === 'open' ? 'פתוחה' : dt(c.closed_at), nm(c.lines), nm(c.items), nm(c.units), nm(c.unknown)]));
      const wsc = X.utils.aoa_to_sheet(sc); wsc['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 17 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 11 }]; wsc['!views'] = [{ RTL: true }];
      X.utils.book_append_sheet(wb, wsc, 'הספירות');
      const l = [hd(['תאריך ושעה', 'ספירה', 'ברקוד', 'שם', 'כמות', 'מי ספר', 'איפה', 'הערה'])].concat(all.lines.map((x) =>
        [dt(x.at), cn[x.count_id] || '', txt(x.barcode), names[x.barcode] || '', nm(x.qty), x.counted_by || '', x.area || '', x.note || '']));
      const wl = X.utils.aoa_to_sheet(l); wl['!cols'] = [{ wch: 17 }, { wch: 30 }, { wch: 16 }, { wch: 34 }, { wch: 8 }, { wch: 18 }, { wch: 16 }, { wch: 28 }]; wl['!views'] = [{ RTL: true }];
      X.utils.book_append_sheet(wb, wl, 'כל הספירות');
      const u = [hd(['ברקוד', 'מה המוצר (הערות)', 'כמות', 'כמה פעמים נספר', 'ספירה אחרונה', 'איפה', 'מי ספר'])].concat(R.filter((x) => !x.known).map((x) => [txt(x.barcode), x.notes || '', nm(x.qty), nm(x.lines), dt(x.last_at), x.areas || '', x.counters || '']));
      const wu = X.utils.aoa_to_sheet(u); wu['!cols'] = [{ wch: 16 }, { wch: 40 }, { wch: 9 }, { wch: 13 }, { wch: 17 }, { wch: 16 }, { wch: 18 }]; wu['!views'] = [{ RTL: true }];
      X.utils.book_append_sheet(wb, wu, 'לא בקטלוג');
      X.writeFile(wb, 'ספירת מלאי - דוח מלא ' + stamp + '.xlsx');
    }
    api('invMerge', { ids: mIds, export: true, markOnly: true });
  }

  /* ================= the menu item ================= */
  function start() {
    const drop = $('menuOpsDrop') || $('menuSchedDrop');
    if (drop && !$('invMgrBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="invMgrBtn">📦 ספירת מלאי</button>');
      $('invMgrBtn').addEventListener('click', open);
    }
    empItem();
  }
  // the employees: "📅 סידור עבודה ונוכחות" (employee-menus.js builds it after the sign-in)
  function empItem() {
    const d = $('emSchedDrop');
    if (!d || $('invEmpBtn')) return;
    d.insertAdjacentHTML('beforeend', '<hr style="border:0;border-top:1px solid #e5e7eb;margin:3px 0"><button type="button" id="invEmpBtn" role="menuitem">📦 ספירת מלאי</button>');
    $('invEmpBtn').addEventListener('click', open);
  }
  new MutationObserver(() => { if (!$('invEmpBtn') && $('emSchedDrop')) empItem(); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openInvCount = open;
})();
