// 📦 ספירת מלאי (15/11/2026, the owner): 💼 ניהול העסק ▸ תפעול ▸ 📦 ספירת מלאי — any manager.
//   the list   the open counts (+ ספירה חדשה), the closed ones of 60 days; tick several → one merge
//   counting   scan (the phone's camera, or a scanner / typing + Enter) → a known item shows its name, Comax's stock and
//              what was already counted here; an unknown one: "פריט לא קיים בקטלוג" + its name in the notes (required)
//              → the quantity → ✓. Several people count into the same count at once; "where" (a shelf / an aisle) is
//              optional. Each line goes to the server at once; without a connection it waits on the phone and is sent
//              later (the same line is never doubled — clientId). My lines: fix the quantity / the note, delete.
//   the merge  one row per barcode over the chosen counts: counted, Comax's stock, the difference; the unknown ones
//              with their notes → ⬇ the file for Comax (barcode + quantity, the catalog's items) · ⬇ the full report
// Server: api inv* (inventory-count.ts; migration 20261115100000_inventory_count.sql). Comax is never written to.
// Uses the app's globals: apiPost, mgrAuth, state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isMgr = () => !!(appState() && appState().mgr);
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); };
  const api = (action, extra) => apiPost({ action, ...mAuth(), ...(extra || {}) }).catch(() => ({ ok: false, net: true, error: 'אין חיבור לשרת' }));
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  const fmt = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('he-IL', { maximumFractionDigits: 3 }));
  const dm = (s) => (s ? String(s).slice(8, 10) + '/' + String(s).slice(5, 7) : '');
  const hm = (s) => { const d = new Date(s); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const today = () => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };
  const XS_URL = '/vendor/xlsx-js-style-1.2.0.min.js';
  const ZX_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  const PEND = 'invPend';
  const fine = () => window.matchMedia && matchMedia('(pointer:fine)').matches;

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
    '.iv-cam{position:relative;border-radius:16px;overflow:hidden;background:#000;margin-bottom:10px;aspect-ratio:4/3;max-height:46vh}' +
    '.iv-cam video{width:100%;height:100%;object-fit:cover;display:block}' +
    '.iv-cam .ln{position:absolute;inset-inline:12%;top:50%;height:2px;background:#ef4444;box-shadow:0 0 12px #ef4444;animation:ivScan 1.6s ease-in-out infinite alternate}' +
    '.iv-cam .fr{position:absolute;inset:22% 10%;border:2.5px solid rgba(255,255,255,.85);border-radius:14px}' +
    '.iv-cam button{position:absolute;bottom:10px;inset-inline-start:10px;background:rgba(0,0,0,.55);color:#fff;border:0;border-radius:10px;padding:6px 11px;font:inherit;font-weight:800;cursor:pointer}' +
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
    if (!isMgr()) return;
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
    const open_ = r.counts.filter((c) => c.status === 'open'), done = r.counts.filter((c) => c.status !== 'open');
    let h = pendBar() + '<div class="iv-card" style="background:linear-gradient(135deg,#eff6ff,#f5f3ff)"><h3>➕ ספירה חדשה</h3><div class="iv-mut">כמה אנשים יכולים לספור לתוך אותה ספירה בבת אחת. בסוף — איחוד וייצוא לאקסל לקומקס.</div>' +
      '<div class="iv-row" style="margin-top:10px"><input class="iv-in" id="ivNewT" style="font-size:15px" value="ספירת מלאי ' + today() + '"><button class="iv-btn iv-pri" id="ivNew">פתיחה</button></div></div>';
    if (open_.length) h += '<div class="iv-h">🟢 ספירות פתוחות</div>' + open_.map(card).join('');
    if (done.length) h += '<div class="iv-h">✓ ספירות שנסגרו (60 יום) — סמנו כמה כדי לאחד אותן</div>' + done.map(card).join('') +
      '<div class="iv-acts"><button class="iv-btn iv-pri" id="ivMergeSel" disabled>📊 איחוד הספירות שסומנו</button></div>';
    if (!r.counts.length) h += '<div class="iv-mut" style="text-align:center;padding:20px">עוד אין ספירות.</div>';
    $('ivBody').innerHTML = h;
    $('ivNew').onclick = async () => {
      const b = $('ivNew'); b.disabled = true;
      const x = await api('invOpen', { title: $('ivNewT').value });
      b.disabled = false;
      if (!x.ok) return say(x.error, 'err');
      startCount(x.count);
    };
    $('ivBody').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => startCount(r.counts.find((c) => String(c.id) === b.dataset.go))));
    $('ivBody').querySelectorAll('[data-mg]').forEach((b) => b.addEventListener('click', () => showMerge([Number(b.dataset.mg)])));
    $('ivBody').querySelectorAll('[data-re]').forEach((b) => b.addEventListener('click', async () => { const x = await api('invClose', { countId: Number(b.dataset.re), reopen: true }); if (!x.ok) say(x.error, 'err'); showList(); }));
    $('ivBody').querySelectorAll('[data-arc]').forEach((b) => b.addEventListener('click', async () => {
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'בטוח? לחצו שוב'; return; }
      const x = await api('invArchive', { countId: Number(b.dataset.arc) }); if (!x.ok) say(x.error, 'err'); showList();
    }));
    const sel = () => [...$('ivBody').querySelectorAll('.iv-sel:checked')].map((x) => Number(x.value));
    $('ivBody').querySelectorAll('.iv-sel').forEach((c) => c.addEventListener('change', () => { $('ivMergeSel').disabled = !sel().length; $('ivMergeSel').textContent = '📊 איחוד ' + (sel().length > 1 ? sel().length + ' הספירות שסומנו' : 'הספירה שסומנה'); }));
    if ($('ivMergeSel')) $('ivMergeSel').onclick = () => showMerge(sel());
  }
  function card(c) {
    const o = c.status === 'open';
    return '<div class="iv-card"><div style="display:flex;gap:10px;align-items:flex-start">' + (o ? '' : '<input type="checkbox" class="iv-sel" value="' + c.id + '">') +
      '<div style="flex:1;min-width:0"><h3>' + e(c.title) + (o ? '<span class="iv-badge" style="background:#dcfce7;color:#166534">פתוחה</span>' : '<span class="iv-badge" style="background:#f1f5f9;color:#475569">נסגרה ' + dm(c.closed_at) + '</span>') +
      (c.exported_at ? '<span class="iv-badge" style="background:#eef2ff;color:#4338ca">יוצאה ' + dm(c.exported_at) + '</span>' : '') + '</h3>' +
      '<div class="iv-mut">נפתחה ' + dm(c.opened_at) + ' ' + hm(c.opened_at) + ' · ' + e(c.opened_by || '') + (c.last_at ? ' · שורה אחרונה ' + hm(c.last_at) : '') + '</div>' +
      '<div class="iv-pills"><span>' + fmt(c.items) + ' פריטים</span><span>' + fmt(c.units) + ' יחידות</span><span>' + fmt(c.people) + ' סופרים</span>' + (c.unknown ? '<span class="w">⚠ ' + c.unknown + ' לא בקטלוג</span>' : '') + '</div>' +
      '<div class="iv-acts">' + (o ? '<button class="iv-btn iv-pri" data-go="' + c.id + '">▶ לספור</button>' : '') + '<button class="iv-btn" data-mg="' + c.id + '">📊 איחוד וייצוא</button>' +
      (!o && (L.admin || c.opened_by === L.me) ? '<button class="iv-btn" data-re="' + c.id + '">🔓 לפתוח שוב</button>' : '') +
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
    view = 'count'; cur = c; item = null; head('📦 ' + c.title, true);
    $('ivBody').innerHTML = '<div id="ivPendBar"></div><div class="iv-scan">' +
      '<div id="ivCamBox"></div>' +
      '<div class="iv-row"><input class="iv-in" id="ivBc" inputmode="numeric" autocomplete="off" placeholder="ברקוד — סריקה או הקלדה + Enter" dir="ltr" style="text-align:right">' +
      '<button class="iv-btn iv-pri" id="ivCam" title="סריקה במצלמה">📷</button></div>' +
      '<div class="iv-row" style="margin-top:8px;align-items:center"><span class="iv-mut" style="white-space:nowrap">📍 איפה:</span><input class="iv-in" id="ivArea" style="font-size:14px;padding:8px 10px" placeholder="למשל מדף 4, מחסן (לא חובה)" value="' + e(store.get('invArea') || '') + '"></div>' +
      '<div id="ivItem"></div></div>' +
      '<div class="iv-h" id="ivMineH">הספירה שלי</div><div class="iv-card" id="ivMine" style="padding:6px 14px"><div class="iv-mut" style="padding:10px 0">טוען…</div></div>' +
      '<div class="iv-acts"><button class="iv-btn" id="ivToMerge">📊 איחוד וייצוא</button></div>';
    $('ivArea').addEventListener('change', () => store.set('invArea', $('ivArea').value.trim()));
    $('ivBc').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); const v = $('ivBc').value.trim(); if (v) lookup(v); } });
    $('ivCam').onclick = () => (camOn ? camStop() : camStart());
    $('ivToMerge').onclick = () => { camStop(); showMerge([cur.id]); };
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
    const pp = pend.filter((p) => p.countId === cur.id);
    const all = pp.map((p) => ({ ...p, p: true })).concat(mine);
    const units = all.reduce((s, x) => s + Number(x.qty || 0), 0);
    $('ivMineH').textContent = 'הספירה שלי — ' + all.length + ' שורות · ' + fmt(units) + ' יחידות';
    if (!all.length) { $('ivMine').innerHTML = '<div class="iv-mut" style="padding:10px 0">עוד לא ספרתם כאן. סרקו ברקוד כדי להתחיל.</div>'; return; }
    $('ivMine').innerHTML = all.slice(0, 200).map((l) => '<div class="iv-ln' + (l.p ? ' p' : '') + (l.err ? ' err' : '') + '" data-id="' + (l.p ? 'p:' + l.clientId : l.id) + '">' +
      '<div class="t"><b>' + e(l.name || (l.known === false ? '⚠ ' + (l.note || 'לא בקטלוג') : l.barcode)) + '</b><small dir="ltr">' + e(l.barcode) + '</small><small> · ' +
      (l.p ? (l.err ? '⚠ ' + e(l.err) : '⏳ מחכה לשליחה') : hm(l.at)) + (l.area ? ' · 📍' + e(l.area) : '') + (l.note && l.known !== false ? ' · ' + e(l.note) : '') + '</small></div>' +
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
      if (!Number.isFinite(qv) || qv < 0) return say('כמות לא תקינה', 'err');
      if (p) { p.qty = qv; p.note = ni.value.trim(); p.err = ''; savePend(); drawMine(); flush(); return; }
      const r = await api('invEdit', { id: Number(id), qty: qv, note: ni.value.trim() }); if (!r.ok) return say(r.error, 'err');
      l.qty = qv; l.note = ni.value.trim(); drawMine();
    };
  }

  async function lookup(code) {
    code = String(code).replace(/\s+/g, '');
    $('ivBc').value = code;
    $('ivItem').innerHTML = '<div class="iv-mut" style="padding:12px 2px">🔎 מחפש ' + e(code) + '…</div>';
    const r = await api('invLookup', { barcode: code, countId: cur.id });
    if (view !== 'count') return;
    if (!r.ok && !r.net) { $('ivItem').innerHTML = '<div class="iv-warn">' + e(r.error) + '</div>'; return; }
    item = r.ok ? r : { barcode: code, offline: true };
    if (r.ok && !r.known) beep(220, 0.18); else beep(1100, 0.07);
    const pAlready = pend.filter((p) => p.countId === cur.id && p.barcode === item.barcode).reduce((s, p) => s + Number(p.qty || 0), 0);
    const already = (item.already || 0) + pAlready;
    let h;
    if (item.offline) h = '<div class="iv-item u"><div class="nm">📡 אין חיבור — לא בדקתי בקטלוג</div><div class="bc">' + e(code) + '</div><div class="iv-mut">הכמות תישמר בטלפון ותישלח כשיחזור החיבור. כדאי לכתוב בהערות מה המוצר.</div>';
    else if (item.known) h = '<div class="iv-item k"><div class="nm">' + e(item.name) + '</div><div class="bc">' + e(item.barcode) + (item.archived ? ' · <b style="color:#c2410c">בארכיון בקומקס</b>' : '') + '</div>' +
      '<div class="iv-nums"><div><small>במלאי בקומקס</small><b>' + fmt(item.stock) + '</b></div><div><small>כבר נספר בספירה הזו</small><b>' + fmt(already) + '</b></div></div>';
    else h = '<div class="iv-item u"><div class="nm">⚠ פריט לא קיים בקטלוג</div><div class="bc">' + e(item.barcode) + '</div>' +
      '<div class="iv-warn">כתבו בהערות מה המוצר (שם, גודל, יצרן) — חובה.</div>' + (already ? '<div class="iv-mut">כבר נספר בספירה הזו: ' + fmt(already) + '</div>' : '');
    h += '<input class="iv-in iv-qty" id="ivQty" inputmode="decimal" placeholder="כמות" autocomplete="off">' +
      '<div class="iv-quick">' + [1, 2, 3, 6, 12, 24].map((n) => '<button type="button" data-q="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<input class="iv-in" id="ivNote" style="margin-top:8px;font-size:14px;padding:9px 10px' + (item.known ? ';display:none' : '') + '" placeholder="' + (item.known ? 'הערה (לא חובה)' : 'מה המוצר? למשל: במבה 80 גרם אסם') + '" maxlength="200">' +
      '<div class="iv-acts">' + (item.known ? '<button class="iv-btn" id="ivNoteBtn" style="font-size:13px">+ הערה</button>' : '') +
      '<button class="iv-btn iv-ok" id="ivSave" style="flex:1;font-size:16px">✓ שמירה</button><button class="iv-btn" id="ivSkip">ביטול</button></div></div>';
    $('ivItem').innerHTML = h;
    $('ivQty').focus();
    $('ivQty').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); if (!item.known && !$('ivNote').value.trim()) $('ivNote').focus(); else save(); } });
    $('ivNote').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); save(); } });
    $('ivItem').querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { $('ivQty').value = b.dataset.q; $('ivQty').focus(); }));
    if ($('ivNoteBtn')) $('ivNoteBtn').onclick = () => { $('ivNote').style.display = ''; $('ivNoteBtn').remove(); $('ivNote').focus(); };
    $('ivSave').onclick = save;
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
    if (item.known === false && !note) { say('פריט לא קיים בקטלוג — כתבו בהערות מה המוצר', 'err'); $('ivNote').focus(); return; }
    const area = $('ivArea').value.trim(); store.set('invArea', area);
    pend.push({ clientId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), countId: cur.id, barcode: item.barcode, qty: qv, note, area,
      name: item.known ? item.name : null, known: item.offline ? undefined : !!item.known });
    savePend();
    say('✓ נשמר: ' + (item.name || item.barcode) + ' × ' + fmt(qv));
    if (navigator.vibrate) navigator.vibrate(40);
    next(); drawMine(); flush();
  }
  async function flush() {
    if (busy || !pend.length) return;
    busy = true;
    for (const p of pend.slice()) {
      if (p.err) continue;
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

  /* ---------- the camera: the browser's own BarcodeDetector, or ZXing ---------- */
  let stream = null, det = null, zx = null, loopT = 0, camWanted = false;
  async function camStart() {
    camWanted = true;
    if (camOn) return;
    const box = $('ivCamBox'); if (!box) return;
    box.innerHTML = '<div class="iv-cam"><video id="ivVid" playsinline muted></video><div class="fr"></div><div class="ln"></div><button type="button" id="ivCamX">✕ בלי מצלמה</button></div>';
    $('ivCamX').onclick = () => { camWanted = false; camStop(); };
    camOn = true;
    const v = $('ivVid');
    try {
      if ('BarcodeDetector' in window) {
        const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];
        const sup = await BarcodeDetector.getSupportedFormats();
        det = new BarcodeDetector({ formats: want.filter((f) => sup.includes(f)) });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        if (!camOn) return camStop();
        v.srcObject = stream; await v.play();
        const tick = async () => {
          if (!camOn) return;
          try { const r = await det.detect(v); if (r && r.length) { const c = r[0].rawValue; camStop(true); lookup(c); return; } } catch (_) {}
          loopT = setTimeout(tick, 120);
        };
        tick();
      } else {
        if (!window.ZXing) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = ZX_URL; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
        if (!camOn) return camStop();
        zx = new ZXing.BrowserMultiFormatReader();
        await zx.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, v, (res) => { if (res && camOn) { const c = res.getText(); camStop(true); lookup(c); } });
      }
    } catch (err) {
      camStop();
      say('לא הצלחתי לפתוח את המצלמה — אפשר להקליד ברקוד או להשתמש בסורק', 'err');
    }
  }
  function camStop(keepWanted) {
    if (!keepWanted) camWanted = false;
    camOn = false; clearTimeout(loopT);
    if (zx) { try { zx.reset(); } catch (_) {} zx = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    const box = $('ivCamBox'); if (box) box.innerHTML = '';
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
    for (const x of r.rows) { x.qty = Number(x.qty); x.stock = x.stock == null ? null : Number(x.stock); x.diff = x.known && x.stock != null ? x.qty - x.stock : null; }
    drawMerge();
  }
  function drawMerge() {
    const R = merge.rows, unk = R.filter((x) => !x.known), dif = R.filter((x) => x.diff != null && Math.abs(x.diff) >= 0.001);
    const units = R.reduce((s, x) => s + x.qty, 0), people = new Set(R.flatMap((x) => String(x.counters || '').split(', ').filter(Boolean))).size;
    const one = merge.counts.length === 1 ? merge.counts[0] : null;
    let h = '<div class="iv-card" style="padding:12px 16px"><b>' + merge.counts.map((c) => e(c.title)).join(' + ') + '</b>' + (one && one.status === 'open' ? '<span class="iv-badge" style="background:#dcfce7;color:#166534">עדיין פתוחה</span>' : '') + '</div>' +
      '<div class="iv-kpis"><div class="iv-kpi"><b>' + fmt(R.length) + '</b><span>פריטים</span></div><div class="iv-kpi"><b>' + fmt(units) + '</b><span>יחידות</span></div>' +
      '<div class="iv-kpi"><b style="color:' + (unk.length ? '#c2410c' : '#16a34a') + '">' + unk.length + '</b><span>לא בקטלוג</span></div><div class="iv-kpi"><b>' + people + '</b><span>סופרים</span></div></div>' +
      '<div class="iv-card"><h3>⬇ ייצוא</h3><div class="iv-mut">הקובץ לקומקס: עמודת ברקוד ועמודת כמות — כמות אחת לכל ברקוד (סכום כל הסופרים).' +
      (unk.length ? ' <b style="color:#c2410c">' + unk.length + ' פריטים שלא בקטלוג לא נכנסים לקובץ</b> — פתחו אותם בקומקס, ומחר (אחרי העדכון הלילי) ייצאו שוב והם ייכנסו.' : '') + '</div>' +
      '<div class="iv-acts"><button class="iv-btn iv-pri" id="ivXc">⬇ קובץ לקומקס (ברקוד + כמות)</button><button class="iv-btn" id="ivXf">⬇ דוח מלא</button>' +
      (one && one.status === 'open' ? '<button class="iv-btn iv-ok" id="ivClose">🔒 סיום הספירה</button>' : '') + '</div></div>' +
      '<div class="iv-card"><div class="iv-chips"><button data-f="all"' + (mFilter === 'all' ? ' class="on"' : '') + '>הכול (' + R.length + ')</button>' +
      '<button data-f="unk"' + (mFilter === 'unk' ? ' class="on"' : '') + '>⚠ לא בקטלוג (' + unk.length + ')</button><button data-f="dif"' + (mFilter === 'dif' ? ' class="on"' : '') + '>פער מהמלאי (' + dif.length + ')</button></div>' +
      '<input class="iv-in" id="ivQ" style="font-size:14px;padding:8px 10px" placeholder="🔎 חיפוש שם או ברקוד" value="' + e(mQ) + '">' +
      '<div class="iv-wrap" style="margin-top:8px"><table class="iv-tbl"><thead><tr><th>פריט</th><th class="n">נספר</th><th class="n hide">במלאי</th><th class="n">פער</th></tr></thead><tbody id="ivRows"></tbody></table></div></div>';
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
    if (mFilter === 'dif') R = R.filter((x) => x.diff != null && Math.abs(x.diff) >= 0.001).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    if (mQ) { const k = mQ.toLowerCase(); R = R.filter((x) => String(x.barcode).includes(k) || String(x.name || x.notes || '').toLowerCase().includes(k)); }
    $('ivRows').innerHTML = R.slice(0, 1500).map((x) => '<tr' + (x.known ? '' : ' class="u"') + '><td><b>' + e(x.known ? x.name : '⚠ ' + (x.notes || 'לא בקטלוג')) + '</b><span class="bc">' + e(x.barcode) + '</span>' +
      (x.known && x.notes ? '<small class="iv-mut">' + e(x.notes) + '</small>' : '') + (x.areas ? '<small class="iv-mut"> 📍' + e(x.areas) + '</small>' : '') + '</td>' +
      '<td class="n">' + fmt(x.qty) + '</td><td class="n hide">' + (x.known ? fmt(x.stock) : '') + '</td><td class="n" dir="ltr" style="color:' + (x.diff == null ? '#94a3b8' : x.diff < 0 ? '#b91c1c' : x.diff > 0 ? '#1d4ed8' : '#16a34a') + '">' +
      (x.diff == null ? '' : (x.diff > 0 ? '+' : '') + fmt(x.diff)) + '</td></tr>').join('') + (R.length > 1500 ? '<tr><td colspan="4" class="iv-mut">מוצגות 1,500 שורות — כל השורות נמצאות בקבצים</td></tr>' : '') +
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
      const a = [hd(['ברקוד', 'שם', 'נספר', 'במלאי בקומקס', 'פער', 'איפה', 'מי ספר', 'הערות'])].concat(R.filter((x) => x.known).map((x) =>
        [txt(x.barcode), x.name || '', nm(x.qty), nm(x.stock), nm(x.diff), x.areas || '', x.counters || '', x.notes || '']));
      const ws = X.utils.aoa_to_sheet(a); ws['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 9 }, { wch: 12 }, { wch: 9 }, { wch: 16 }, { wch: 18 }, { wch: 28 }];
      ws['!views'] = [{ RTL: true }]; X.utils.book_append_sheet(wb, ws, 'סיכום');
      const u = [hd(['ברקוד', 'מה המוצר (הערות)', 'נספר', 'איפה', 'מי ספר'])].concat(R.filter((x) => !x.known).map((x) => [txt(x.barcode), x.notes || '', nm(x.qty), x.areas || '', x.counters || '']));
      const wu = X.utils.aoa_to_sheet(u); wu['!cols'] = [{ wch: 16 }, { wch: 40 }, { wch: 9 }, { wch: 16 }, { wch: 18 }]; wu['!views'] = [{ RTL: true }];
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
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openInvCount = open;
})();
