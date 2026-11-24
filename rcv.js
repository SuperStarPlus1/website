// 📥 קבלת סחורה (24/11/2026, the owner): "a goods-receiving area — scan a barcode and a quantity. An item that does not
// exist is marked red as not in the assortment and needs to be opened in Comax before the invoice is entered (a mark
// only — it does not block the receiving). The storekeeper must write the product's name in the notes."
// Open to every employee (📅 סידור עבודה ונוכחות ▸ 📥 קבלת סחורה) and every manager (💼 ▸ תפעול ▸ 📥 קבלת סחורה).
//   the list     ➕ a new receipt: the supplier (Comax's list, searched; or typed), the delivery note's number, a note
//                the open receipts — anyone joins (several people unload one truck; every line carries who scanned it)
//                the closed ones of 30 days; 🗄 older / the archive
//   receiving    scan (the camera — scan-cam.js; a scanner; or the last 6 digits typed) → a known item: its name, photo,
//                what was already received here; another supplier in Comax = a soft hint; NOT in the catalog: red
//                "⛔ לא במגוון — להקים בקומקס" + the product's name in the notes (required) — it is still received
//                → the quantity → ✓. Lines wait on the phone without a connection (never doubled — clientId).
//   the summary  one row per barcode; the red ones on top; ⬇ the file for Comax (the invoices' "SAP מערכת" template:
//                serial / barcode / name / qty / blank / blank / price — the price empty; catalog items only)
//                ⬇ the full report (the summary, "להקמה בקומקס", every line)
// 24/11 (📝 הזמנות, po.js): a new receipt offers the chosen supplier's sent orders (🔗 לקבל לפי הזמנה); linked —
// the item card says how many were ordered / are still missing, the summary compares ordered vs received
// (❌ לא הגיע / ⚠ חלקית / ➕ עודף), and the full report has a sheet for it. Finishing the receipt marks the order received.
// Server: api rcv* (goods-receiving.ts; migration 20261124100000_goods_receiving.sql). Comax is never written to.
// Uses the app's globals: apiPost, anyAuth/mgrAuth, state, toast; the .iv-* styles of inv-count.js; ScanCam (scan-cam.js).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const canUse = () => !!(appState() && (appState().mgr || appState().emp));
  const mAuth = () => (typeof anyAuth === 'function' ? anyAuth() : typeof mgrAuth === 'function' ? mgrAuth() : {});
  const myName = () => { const s = appState(); return (s && (s.mgr ? s.mgr.name : s.emp && s.emp.name)) || ''; };
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); };
  const api = (action, extra) => apiPost({ action, ...mAuth(), ...(extra || {}) }).catch(() => ({ ok: false, net: true, error: 'אין חיבור לשרת' }));
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  const fmt = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('he-IL', { maximumFractionDigits: 3 }));
  const dm = (s) => (s ? String(new Date(s).getDate()).padStart(2, '0') + '/' + String(new Date(s).getMonth() + 1).padStart(2, '0') : '');
  const hm = (s) => { const d = new Date(s); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const when = (s) => (s ? dm(s) + '/' + new Date(s).getFullYear() + ' ' + hm(s) : '');
  const IMG = 'https://otjhhljgdevazanrretx.supabase.co/storage/v1/object/public/products/';
  const pic = (bc, size) => '<img class="iv-pic" src="' + IMG + encodeURIComponent(bc) + '.webp" alt="" loading="lazy" width="' + size + '" height="' + size + '" onerror="this.remove()">';
  const fine = () => window.matchMedia && matchMedia('(pointer:fine)').matches;
  const XS_URL = '/vendor/xlsx-js-style-1.2.0.min.js';
  const QTY_MAX = 5000, PEND = 'rcvPend';
  const gs1Ok = (d) => { let sum = 0; for (let i = d.length - 2, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(d[i]) * w; return (10 - (sum % 10)) % 10 === Number(d[d.length - 1]); };
  const upcE2A = (e8) => { const m = e8.slice(1, 7), x = m[5]; return e8[0] + (x <= '2' ? m.slice(0, 2) + x + '0000' + m.slice(2, 5) : x === '3' ? m.slice(0, 3) + '00000' + m.slice(3, 5) : x === '4' ? m.slice(0, 4) + '00000' + m[4] : m.slice(0, 5) + '0000' + x) + e8[7]; };
  const bcCheck = (b) => !/^\d+$/.test(b) ? 'confirm' : [12, 13, 14].includes(b.length) ? (gs1Ok(b) ? 'ok' : 'bad') : b.length === 8 ? (gs1Ok(b) || (/^[01]/.test(b) && gs1Ok(upcE2A(b))) ? 'ok' : 'bad') : 'confirm';
  const dname = (d) => (d.supplier_name || 'ספק') + (d.doc_no ? ' · ת.מ. ' + d.doc_no : '');
  const NOT_IN = '⛔ לא במגוון — להקים בקומקס';

  let view = 'list', L = null, cur = null, lines = [], item = null, sum = null, sFilter = 'all', sQ = '', camWanted = false, busy = false, sups = null, kt = [];
  let pend = []; try { pend = JSON.parse(store.get(PEND) || '[]'); } catch (_) { pend = []; }
  const savePend = () => store.set(PEND, JSON.stringify(pend));

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#grOv{position:fixed;inset:0;z-index:9000;background:#eef2f7;overflow:auto;direction:rtl;font-family:inherit;color:#0f172a}#grOv.hidden{display:none}' +
    '.gr-red{background:#fef2f2!important;border:2px solid #ef4444!important}.gr-red .nm{color:#b91c1c}' +
    '.gr-tag{display:inline-block;background:#dc2626;color:#fff;border-radius:8px;padding:3px 9px;font-size:12.5px;font-weight:900;margin:6px 0}' +
    '.gr-soft{background:#f1f5f9;color:#475569;border-radius:10px;padding:6px 10px;font-size:13px;font-weight:700;margin-top:8px}' +
    '.gr-sup{max-height:240px;overflow:auto;margin-top:6px;border:1.5px solid #e2e8f0;border-radius:12px}' +
    '.gr-sup button{display:flex;justify-content:space-between;gap:8px;width:100%;text-align:right;background:#fff;border:0;border-bottom:1px solid #f1f5f9;padding:10px 12px;font:inherit;font-size:14.5px;font-weight:700;cursor:pointer;color:#0f172a}' +
    '.gr-sup button small{color:#94a3b8;font-weight:600;white-space:nowrap}.gr-sup button.on{background:#eef2ff;color:#3730a3}' +
    '.iv-tbl tr.rr td{background:#fef2f2}.iv-ln.rr{background:#fef2f2}.iv-ln.rr .t b{color:#b91c1c}' +
    '</style>');

  /* ================= the shell ================= */
  function open() {
    if (!canUse()) return;
    if (!$('grOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="grOv" class="hidden"><div class="iv-top"><button id="grBack" hidden>→</button><h2 id="grTitle">📥 קבלת סחורה</h2><span class="sp"></span>' +
        '<button id="grX">✕ סגירה</button></div><div class="iv-body" id="grBody"></div></div>');
      $('grX').addEventListener('click', close);
      $('grBack').addEventListener('click', () => { camOff(); if (view === 'sum' && cur && cur.status === 'open' && sum && sum.fromDoc) startDoc(cur); else showList(); });
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('grOv') && !$('grOv').classList.contains('hidden') && !(window.ScanCam && ScanCam.on())) close(); });
      window.addEventListener('online', flush);
    }
    $('grOv').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    showList();
    flush();
  }
  function close() { camOff(); $('grOv').classList.add('hidden'); document.body.style.overflow = ''; }
  function head(t, back) { $('grTitle').textContent = t; $('grBack').hidden = !back; }
  function camOff() { camWanted = false; if (window.ScanCam) ScanCam.stop(); }

  /* ================= the list ================= */
  async function showList(old) {
    view = 'list'; head(old ? '🗄 קבלות ישנות וארכיון' : '📥 קבלת סחורה', !!old);
    $('grBody').innerHTML = '<div class="iv-mut" style="text-align:center;padding:30px">טוען…</div>';
    const r = await api('rcvList', old ? { old: true } : {});
    if (view !== 'list') return;
    if (!r.ok) { $('grBody').innerHTML = '<div class="iv-card">' + e(r.error) + '<div class="iv-acts"><button class="iv-btn" id="grRe">↻ שוב</button></div></div>'; $('grRe').onclick = () => showList(old); return; }
    L = r;
    const openD = r.docs.filter((d) => d.status === 'open'), done = r.docs.filter((d) => d.status !== 'open');
    let h = pendBar();
    if (!old) h += '<div class="iv-card" style="background:linear-gradient(135deg,#ecfdf5,#eff6ff)"><h3>➕ קבלה חדשה</h3><div class="iv-mut">משאית / משלוח אחד = קבלה אחת. בוחרים ספק, ואם יש — מספר תעודת המשלוח.</div>' +
      '<input class="iv-in" id="grSupQ" style="margin-top:10px;font-size:15px" placeholder="🔎 ספק — הקלידו חלק מהשם" autocomplete="off"><div class="gr-sup" id="grSupL"><div class="iv-mut" style="padding:10px">טוען ספקים…</div></div><div id="grOrd"></div>' +
      '<div class="iv-row" style="margin-top:8px"><input class="iv-in" id="grDocNo" style="font-size:15px" inputmode="numeric" placeholder="מספר תעודת משלוח (לא חובה)"></div>' +
      '<input class="iv-in" id="grNote" style="margin-top:8px;font-size:14px" placeholder="הערה (לא חובה)" maxlength="200">' +
      '<div class="iv-acts"><button class="iv-btn iv-pri" id="grNew" style="flex:1" disabled>פתיחת קבלה</button></div></div>';
    if (openD.length) h += '<div class="iv-h">🟢 קבלות פתוחות — אפשר להצטרף ולסרוק</div>' + openD.map(card).join('');
    if (done.length) h += '<div class="iv-h">' + (old ? 'קבלות ישנות וארכיון' : '✓ קבלות שהסתיימו (30 יום)') + '</div>' + done.map(card).join('');
    if (!r.docs.length) h += '<div class="iv-mut" style="text-align:center;padding:20px">' + (old ? 'אין קבלות ישנות.' : 'עוד אין קבלות — פותחים אחת למעלה.') + '</div>';
    if (!old) h += '<div class="iv-acts" style="justify-content:center;margin-top:16px"><button class="iv-btn" id="grOld">🗄 קבלות ישנות וארכיון</button></div>';
    $('grBody').innerHTML = h;
    if (!old) { $('grOld').onclick = () => showList(true); supPicker(); }
    $('grBody').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => startDoc(r.docs.find((d) => String(d.id) === b.dataset.go))));
    $('grBody').querySelectorAll('[data-sum]').forEach((b) => b.addEventListener('click', () => showSum(r.docs.find((d) => String(d.id) === b.dataset.sum))));
    $('grBody').querySelectorAll('[data-arc]').forEach((b) => b.addEventListener('click', async () => {
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'בטוח? לחצו שוב'; return; }
      const x = await api('rcvArchive', { docId: Number(b.dataset.arc), back: b.dataset.back === '1' }); if (!x.ok) say(x.error, 'err'); showList(old);
    }));
  }
  function card(d) {
    const o = d.status === 'open';
    return '<div class="iv-card"><h3>🚚 ' + e(dname(d)) + (o ? '<span class="iv-badge" style="background:#dcfce7;color:#166534">פתוחה</span>' : '<span class="iv-badge" style="background:#f1f5f9;color:#475569">הסתיימה ' + dm(d.closed_at) + ' ' + hm(d.closed_at) + '</span>') +
      (d.exported_at ? '<span class="iv-badge" style="background:#eef2ff;color:#4338ca">יוצאה ' + dm(d.exported_at) + '</span>' : '') + (d.archived ? '<span class="iv-badge" style="background:#f1f5f9;color:#64748b">🗄 ארכיון</span>' : '') + '</h3>' +
      '<div class="iv-mut">👤 ' + e(d.opened_by || '') + ' · נפתחה ' + when(d.opened_at) + (d.order_id ? ' · 🔗 לפי הזמנה ' + d.order_id : '') + (d.note ? ' · ' + e(d.note) : '') + '</div>' +
      '<div class="iv-pills"><span>' + fmt(d.items) + ' פריטים</span><span>' + fmt(d.units) + ' יחידות</span>' + (d.people > 1 ? '<span>' + d.people + ' סורקים</span>' : '') +
      (d.unknown ? '<span style="background:#fef2f2;color:#b91c1c">⛔ ' + d.unknown + ' לא במגוון</span>' : '') + '</div>' +
      '<div class="iv-acts">' + (o ? '<button class="iv-btn iv-pri" data-go="' + d.id + '">▶ לסרוק לקבלה</button>' : '') + '<button class="iv-btn" data-sum="' + d.id + '">📊 סיכום וייצוא</button>' +
      (L.admin ? '<button class="iv-btn" data-arc="' + d.id + '" data-back="' + (d.archived ? '1' : '0') + '" style="margin-inline-start:auto;color:#64748b">' + (d.archived ? '↩ החזרה מהארכיון' : '🗄 לארכיון') + '</button>' : '') + '</div></div>';
  }
  async function supPicker() {
    let chosen = null, ordSel = 0, ordSeq = 0;
    // 📝 the chosen supplier's sent orders: the delivery is received against one of them (or without an order)
    const orders = async () => {
      ordSel = 0; const box = $('grOrd'); if (!box) return;
      box.innerHTML = '';
      if (!chosen) return;
      const my = ++ordSeq, r = await api('poForSup', { supplier: chosen.code, supplierName: chosen.name });
      if (my !== ordSeq || !$('grOrd') || !r.ok || !r.orders.length) return;
      if (r.orders.length === 1) ordSel = r.orders[0].id;
      const drawO = () => {
        box.innerHTML = '<div class="iv-mut" style="margin:10px 2px 4px;font-weight:800;color:#0f172a">🔗 לקבל לפי הזמנה?</div><div class="gr-sup" style="max-height:none">' +
          r.orders.map((o) => '<button type="button" data-o="' + o.id + '"' + (ordSel === o.id ? ' class="on"' : '') + '><span>' + (ordSel === o.id ? '✓ ' : '') + '📝 הזמנה ' + o.id + ' · נשלחה ' + when(o.sent_at) + '</span><small>' + fmt(o.items) + ' פריטים</small></button>').join('') +
          '<button type="button" data-o="0"' + (!ordSel ? ' class="on"' : '') + '><span>' + (!ordSel ? '✓ ' : '') + 'בלי הזמנה</span><small></small></button></div>';
        box.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => { ordSel = Number(b.dataset.o); drawO(); }));
      };
      drawO();
    };
    const draw = () => {
      const qv = $('grSupQ').value.trim();
      const list = sups || [];
      const hit = qv ? list.filter((s) => s.name.includes(qv) || String(s.code) === qv) : list.slice(0, 12);
      $('grSupL').innerHTML = (sups ? '' : '<div class="iv-mut" style="padding:10px">טוען ספקים…</div>') +
        hit.slice(0, 40).map((s) => '<button type="button" data-c="' + s.code + '"' + (chosen && chosen.code === s.code ? ' class="on"' : '') + '><span>' + e(s.name) + '</span><small>' + (s.items ? s.items + ' פריטים' : '') + '</small></button>').join('') +
        (qv && sups ? '<button type="button" data-free="1"' + (chosen && !chosen.code ? ' class="on"' : '') + '><span>✍ ספק שלא ברשימה: "' + e(qv) + '"</span><small>ידני</small></button>' : '') +
        (!qv && sups ? '<div class="iv-mut" style="padding:8px 12px">מוצגים הספקים עם הכי הרבה פריטים — הקלידו כדי לחפש בכל ' + sups.length + ' הספקים.</div>' : '');
      $('grSupL').querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { chosen = sups.find((s) => String(s.code) === b.dataset.c); $('grSupQ').value = chosen.name; draw(); $('grNew').disabled = false; orders(); }));
      const fr = $('grSupL').querySelector('[data-free]');
      if (fr) fr.addEventListener('click', () => { chosen = { code: 0, name: $('grSupQ').value.trim() }; draw(); $('grNew').disabled = false; orders(); });
    };
    $('grSupQ').addEventListener('input', () => { if (chosen && $('grSupQ').value.trim() !== chosen.name) { chosen = null; $('grNew').disabled = true; orders(); } draw(); });
    draw();
    $('grNew').onclick = async () => {
      if (!chosen) return say('בחרו ספק מהרשימה', 'err');
      const b = $('grNew'); b.disabled = true;
      const x = await api('rcvOpen', { supplier: chosen.code, supplierName: chosen.name, docNo: $('grDocNo').value.trim(), note: $('grNote').value.trim(), orderId: ordSel || undefined });
      b.disabled = false;
      if (!x.ok) return say(x.error, 'err');
      startDoc(x.doc);
    };
    if (!sups) { const r = await api('rcvSuppliers'); if (r.ok) { sups = r.suppliers; if ($('grSupL')) draw(); } }
  }
  function pendBar() {
    if (!pend.length) return '';
    const errs = pend.filter((p) => p.err).length;
    return '<div class="iv-pend">⏳ ' + pend.length + ' שורות מחכות לשליחה' + (errs ? ' (' + errs + ' עם בעיה — ראו בקבלה)' : ' — יישלחו כשיחזור החיבור') + '</div>';
  }

  /* ================= receiving ================= */
  function startDoc(d) {
    if (!d) return;
    view = 'doc'; cur = d; item = null; head('📥 ' + dname(d), true);
    $('grBody').innerHTML = '<div id="grPendBar"></div><div class="iv-mut" style="margin:0 4px 8px;font-weight:800">👤 סורק/ת: <span style="color:#0f172a">' + e(myName()) + '</span> · 🚚 ' + e(dname(d)) + '</div><div class="iv-scan">' +
      '<div id="grCamBox"></div>' +
      '<form class="iv-row" id="grBcF" action="#" autocomplete="off"><input class="iv-in" id="grBc" inputmode="numeric" enterkeyhint="search" autocomplete="off" placeholder="ברקוד מלא או 6 ספרות אחרונות" dir="ltr" style="text-align:right">' +
      '<button type="submit" class="iv-btn" title="חיפוש" style="font-size:18px;padding:9px 12px">🔎</button><button type="button" class="iv-btn iv-pri" id="grCam" title="סריקה במצלמה" style="font-size:18px;padding:9px 12px">📷</button></form>' +
      '<div id="grItem"></div></div>' +
      '<div class="iv-h" id="grLinesH">מה התקבל</div><div class="iv-card" id="grLines" style="padding:6px 14px"><div class="iv-mut" style="padding:10px 0">טוען…</div></div>' +
      '<div class="iv-acts"><button class="iv-btn iv-ok" id="grFinish">✓ סיום הקבלה</button><button class="iv-btn" id="grToSum">📊 סיכום וייצוא</button></div>' +
      '<div class="iv-mut" style="margin:6px 4px">פריט באדום = לא במגוון. הוא נקלט, אבל צריך להקים אותו בקומקס לפני הזנת החשבונית.</div>';
    const goBc = () => {
      const v = $('grBc').value.replace(/\s+/g, '');
      const fast = kt.length >= 6 && kt.length >= v.length - 1 && (kt[kt.length - 1] - kt[0]) / (kt.length - 1) < 35;
      kt = [];
      if (v) { $('grBc').blur(); lookup(v, fast ? 'scan' : 'typed'); } else say('הקלידו ברקוד או 6 ספרות אחרונות', 'err');
    };
    $('grBc').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); goBc(); } else if (ev.key.length === 1) kt.push(performance.now()); });
    $('grBcF').addEventListener('submit', (ev) => { ev.preventDefault(); goBc(); });
    $('grBc').addEventListener('input', () => { if (!$('grBc').value) kt = []; });
    $('grBc').addEventListener('paste', () => { kt = []; });
    $('grCam').onclick = () => (window.ScanCam && ScanCam.on() ? camOff() : cam());
    $('grToSum').onclick = () => { camOff(); showSum(cur, true); };
    $('grFinish').onclick = async () => {
      const b = $('grFinish');
      if (pend.some((p) => p.docId === cur.id && !p.err)) return say('יש שורות שעוד לא נשלחו — חכו לחיבור ואז סיימו', 'err');
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'לסיים את הקבלה? לחצו שוב'; setTimeout(() => { if (b.isConnected) { b.classList.remove('sure'); b.textContent = '✓ סיום הקבלה'; } }, 4000); return; }
      const x = await api('rcvClose', { docId: cur.id }); if (!x.ok) return say(x.error, 'err');
      camOff(); say('✓ הקבלה הסתיימה'); cur.status = 'closed'; showSum(cur);
    };
    if (fine()) $('grBc').focus();
    loadLines();
  }
  function cam() {
    camWanted = true;
    if (!window.ScanCam) return say('רכיב המצלמה לא נטען — רעננו את הדף', 'err');
    ScanCam.start($('grCamBox'), (t) => lookup(t, 'scan', true), (m) => { camWanted = false; say(m, 'err'); });
  }
  async function loadLines() {
    const r = await api('rcvLines', { docId: cur.id });
    if (r.ok) lines = r.lines;
    drawLines();
  }
  function drawLines() {
    if (view !== 'doc' || !$('grLines')) return;
    $('grPendBar').innerHTML = pendBar();
    const pp = pend.filter((p) => p.docId === cur.id && (!p.by || p.by === myName()));
    const all = pp.map((p) => ({ ...p, p: true, mine: true })).concat(lines);
    const units = all.reduce((s, x) => s + Number(x.qty || 0), 0), red = new Set(all.filter((x) => x.known === false).map((x) => x.barcode)).size;
    $('grLinesH').innerHTML = 'מה התקבל — ' + all.length + ' שורות · ' + fmt(units) + ' יחידות' + (red ? ' · <span style="color:#b91c1c">⛔ ' + red + ' לא במגוון</span>' : '');
    if (!all.length) { $('grLines').innerHTML = '<div class="iv-mut" style="padding:10px 0">עוד לא נסרק כלום. סרקו ברקוד כדי להתחיל.</div>'; return; }
    const canEd = (l) => l.p || l.mine || (appState() && appState().mgr);
    $('grLines').innerHTML = all.slice(0, 300).map((l) => '<div class="iv-ln' + (l.p ? ' p' : '') + (l.err ? ' err' : '') + (l.known === false ? ' rr' : '') + '" data-id="' + (l.p ? 'p:' + l.clientId : l.id) + '">' + (l.known !== false ? pic(l.barcode, 38) : '') +
      '<div class="t"><b>' + e(l.known === false ? '⛔ ' + (l.note || 'לא במגוון') : l.name || l.barcode) + '</b><small dir="ltr">' + e(l.barcode) + '</small><small> · 🕒 ' + hm(l.at) + (l.by_name && l.by_name !== myName() ? ' · 👤' + e(l.by_name) : '') +
      (l.p ? ' · ' + (l.err ? '⚠ ' + e(l.err) : '⏳ מחכה לשליחה') : '') + (l.known === false ? ' · להקים בקומקס' : l.note ? ' · ' + e(l.note) : '') + '</small></div>' +
      '<span class="q">' + fmt(l.qty) + '</span>' + (canEd(l) && !(l.p && !l.err) ? '<button class="ed">✎</button><button class="del">✕</button>' : '') + '</div>').join('');
    $('grLines').querySelectorAll('.iv-ln').forEach((row) => {
      const id = row.dataset.id, ed = row.querySelector('.ed'), del = row.querySelector('.del');
      if (del) del.onclick = async () => {
        if (!del.classList.contains('sure')) { del.classList.add('sure'); del.textContent = 'למחוק?'; setTimeout(() => { del.classList.remove('sure'); del.textContent = '✕'; }, 3000); return; }
        if (id.startsWith('p:')) { pend = pend.filter((p) => 'p:' + p.clientId !== id); savePend(); drawLines(); return; }
        const r = await api('rcvDel', { id: Number(id) }); if (!r.ok) return say(r.error, 'err');
        lines = lines.filter((x) => String(x.id) !== id); drawLines();
      };
      if (ed) ed.onclick = () => editRow(row, id);
    });
  }
  function editRow(row, id) {
    const p = id.startsWith('p:') ? pend.find((x) => 'p:' + x.clientId === id) : null, l = p || lines.find((x) => String(x.id) === id);
    if (!l) return;
    row.innerHTML = '<div class="t" style="display:flex;gap:6px;flex-wrap:wrap"><input class="iv-in" style="width:90px;font-size:15px;padding:7px" inputmode="decimal" value="' + e(l.qty) + '">' +
      '<input class="iv-in" style="flex:1;min-width:120px;font-size:14px;padding:7px" placeholder="' + (l.known === false ? 'שם המוצר (חובה)' : 'הערה') + '" value="' + e(l.note || '') + '"></div><button class="sv" style="background:#16a34a;color:#fff">💾</button>';
    const [qi, ni] = row.querySelectorAll('input'); qi.focus(); qi.select();
    row.querySelector('.sv').onclick = async () => {
      const qv = Number(String(qi.value).replace(',', '.'));
      if (!Number.isFinite(qv) || qv <= 0 || qv > 1e6) return say('כמות לא תקינה', 'err');
      if (l.known === false && !ni.value.trim()) return say('פריט לא במגוון — חובה לכתוב את שם המוצר', 'err');
      if (qv > QTY_MAX) {
        let q2 = row.querySelector('.q2');
        if (!q2) { qi.insertAdjacentHTML('afterend', '<input class="iv-in q2" style="width:90px;font-size:15px;padding:7px;border-color:#f59e0b" inputmode="decimal" placeholder="שוב">'); q2 = row.querySelector('.q2'); q2.focus(); return say('כמות מעל 5,000 — הקלידו אותה שוב לאישור', 'err'); }
        if (Number(String(q2.value).replace(',', '.')) !== qv) { q2.focus(); return say('הכמות שהוקלדה שוב לא זהה', 'err'); }
      }
      if (p) { p.qty = qv; p.note = ni.value.trim(); p.err = ''; p.bigOk = qv > QTY_MAX; savePend(); drawLines(); flush(); return; }
      const r = await api('rcvEdit', { id: Number(id), qty: qv, note: ni.value.trim(), bigOk: qv > QTY_MAX }); if (!r.ok) return say(r.error, 'err');
      l.qty = qv; l.note = ni.value.trim(); drawLines();
    };
  }

  const big = (b) => '<div class="bc" style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:1.5px">' + e(b) + '</div>';
  function stopMsg(msg) {
    item = null;
    $('grItem').innerHTML = '<div class="iv-item u">' + msg + '<div class="iv-acts"><button class="iv-btn" id="grSkip">ביטול</button></div></div>';
    $('grSkip').onclick = next; beep(220, 0.18);
  }
  async function lookup(code, src, exact) {
    code = String(code).replace(/\s+/g, '');
    $('grBc').value = code;
    $('grItem').innerHTML = '<div class="iv-mut" style="padding:12px 2px">🔎 מחפש ' + e(code) + '…</div>';
    const r = await api('rcvLookup', { barcode: code, docId: cur.id, exact: exact || src === 'scan' });
    if (view !== 'doc') return;
    if (!r.ok && !r.net) { $('grItem').innerHTML = '<div class="iv-warn">' + e(r.error) + '</div>'; return; }
    if (r.tooMany) return stopMsg('<div class="nm">🔎 יותר מדי מוצרים מסתיימים ב-' + e(code) + '</div><div class="iv-mut">הקלידו עוד ספרות מהסוף, או את הברקוד המלא.</div>');
    if (r.multi) {
      item = null; beep(880, 0.06);
      $('grItem').innerHTML = '<div class="iv-item k"><div class="nm">נמצאו ' + r.multi.length + ' מוצרים שמסתיימים ב-' + e(code) + ' — בחרו:</div>' +
        r.multi.map((x) => '<button type="button" class="iv-btn iv-head" data-pick="' + e(x.barcode) + '" style="width:100%;text-align:right;margin-top:8px">' + (x.img ? pic(x.barcode, 52) : '') + '<div><b>' + e(x.name) + '</b>' +
          (x.mine ? ' <span class="iv-badge" style="background:#dcfce7;color:#166534">של הספק</span>' : '') + (x.archived ? ' <span class="iv-badge" style="background:#f1f5f9;color:#64748b">ארכיון</span>' : '') +
          '<div class="bc">' + e(x.barcode.slice(0, -code.length)) + '<b style="color:#0076DA">' + e(x.barcode.slice(-code.length)) + '</b></div></div></button>').join('') +
        '<div class="iv-acts"><button class="iv-btn" id="grSkip">ביטול</button></div></div>';
      $('grItem').querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => lookup(b.dataset.pick, 'pick', true)));
      $('grSkip').onclick = next;
      return;
    }
    if (!r.ok && /^\d{4,7}$/.test(code) && src !== 'scan') return stopMsg('<div class="nm">📡 אין חיבור</div><div class="iv-mut">חיפוש לפי הספרות האחרונות צריך חיבור. סרקו את המוצר או הקלידו את הברקוד המלא.</div>');
    item = r.ok ? r : { barcode: code, offline: true, check: bcCheck(code) };
    item.src = src; item.needConfirm = false;
    if (!item.known && src !== 'scan') {
      if (item.check === 'bad') return stopMsg('<div class="nm">⚠ הברקוד לא תקין</div>' + big(item.barcode) + '<div class="iv-warn">הספרה האחרונה (ספרת הביקורת) לא מתאימה — כנראה טעות הקלדה. בדקו את המספר על האריזה, או סרקו אותו.</div>');
      item.needConfirm = item.check !== 'ok';
    }
    if (r.ok && r.short) item.shortMiss = true;
    if (r.ok && !r.known) beep(220, 0.25); else beep(1100, 0.07);
    const pp = pend.filter((p) => p.docId === cur.id && p.barcode === item.barcode);
    const already = (item.already || 0) + pp.reduce((s, p) => s + Number(p.qty || 0), 0), times = (item.times || 0) + pp.length;
    // 📝 against the order: how many were ordered and how many are still missing; not in the order — a soft note
    const ord = !item.linked ? '' : item.ordered == null ? '<div class="gr-soft" style="background:#fff7ed;color:#c2410c">📝 הפריט לא בהזמנה (יסומן כעודף)</div>'
      : '<div class="iv-nums"><div><small>📝 הוזמן</small><b>' + fmt(item.ordered) + '</b></div><div><small>' + (item.ordered - already > 0 ? 'עוד חסר' : item.ordered - already < 0 ? 'עודף עד עכשיו' : 'הושלם') + '</small><b style="color:' + (item.ordered - already > 0 ? '#c2410c' : item.ordered - already < 0 ? '#b91c1c' : '#16a34a') + '">' + fmt(Math.abs(item.ordered - already)) + '</b></div></div>';
    const seen = ord + (times ? '<div class="iv-nums"><div><small>כבר התקבל בקבלה הזו</small><b>' + fmt(already) + '</b></div><div><small>כמה שורות</small><b>' + times + '</b></div></div>' : '');
    const conf = item.needConfirm ? '<div class="iv-mut" style="margin-top:8px;font-weight:700;color:#0f172a">' +
      (item.shortMiss ? 'אין במגוון מוצר שמסתיים ב-' + e(item.barcode) + '. סרקו אותו או הקלידו את הברקוד המלא (בדרך כלל 13 ספרות). ואם זה באמת הברקוד המלא — הקלידו אותו שוב:'
        : 'לברקוד באורך ' + item.barcode.length + ' ספרות אין ספרת ביקורת — הקלידו אותו שוב לאישור:') +
      '</div><input class="iv-in" id="grConf" inputmode="numeric" autocomplete="off" dir="ltr" style="text-align:right;margin-top:6px" placeholder="הברקוד שוב">' : '';
    let h;
    if (item.offline) h = '<div class="iv-item u"><div class="nm">📡 אין חיבור — לא בדקתי במגוון</div>' + big(code) + '<div class="iv-mut">הכמות תישמר בטלפון ותישלח כשיחזור החיבור. כדאי לכתוב בהערות את שם המוצר.</div>' + conf;
    else if (item.known) h = '<div class="iv-item k"><div class="iv-head">' + (item.img ? pic(item.barcode, 96) : '') + '<div><div class="nm">' + e(item.name) + '</div><div class="bc">' + e(item.barcode) + '</div></div></div>' +
      (item.archived ? '<div class="gr-soft">🗄 הפריט בארכיון בקומקס</div>' : '') + (item.otherSupplier ? '<div class="gr-soft">ℹ בקומקס הפריט רשום אצל ספק אחר: ' + e(item.otherSupplier) + '</div>' : '') + seen;
    else h = '<div class="iv-item gr-red"><div class="nm">⛔ לא במגוון</div><span class="gr-tag">להקים בקומקס לפני הזנת החשבונית</span>' + big(item.barcode) + conf +
      '<div class="iv-warn" style="color:#b91c1c">כתבו את שם המוצר (שם, גודל, יצרן) — חובה. הפריט ייקלט כרגיל.</div>' + seen;
    h += '<input class="iv-in iv-qty" id="grQty" inputmode="decimal" enterkeyhint="done" placeholder="כמות" autocomplete="off">' +
      '<div class="iv-quick">' + [1, 6, 12, 24, 48].map((n) => '<button type="button" data-q="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<input class="iv-in" id="grNote2" style="margin-top:8px;font-size:14px;padding:9px 10px' + (item.known ? ';display:none' : ';border-color:#ef4444') + '" placeholder="' + (item.known ? 'הערה (לא חובה)' : 'שם המוצר — למשל: במבה 80 גרם אסם') + '" maxlength="200" value="' + e(!item.known && item.ordName ? item.ordName : '') + '">' +
      '<div class="iv-acts">' + (item.known ? '<button type="button" class="iv-btn" id="grNoteBtn" style="font-size:13px">+ הערה</button>' : '') +
      '<button type="submit" class="iv-btn iv-ok" style="flex:1;font-size:16px">✓ שמירה</button><button type="button" class="iv-btn" id="grSkip">ביטול</button></div></div>';
    $('grItem').innerHTML = '<form id="grItemF" action="#" autocomplete="off">' + h + '</form>';
    $('grItemF').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const a = document.activeElement;
      if (a && a.id === 'grConf') return $('grQty').focus();
      if (a && a.id === 'grQty' && item && !item.known && !$('grNote2').value.trim()) return $('grNote2').focus();
      save();
    });
    if ($('grConf')) $('grConf').focus(); else $('grQty').focus();
    $('grItem').querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { $('grQty').value = b.dataset.q; $('grQty').focus(); }));
    if ($('grNoteBtn')) $('grNoteBtn').onclick = () => { $('grNote2').style.display = ''; $('grNoteBtn').remove(); $('grNote2').focus(); };
    $('grSkip').onclick = next;
  }
  function next() {
    item = null; $('grItem').innerHTML = ''; $('grBc').value = '';
    if (camWanted) cam(); else if (fine()) $('grBc').focus();
  }
  function save() {
    if (!item) return;
    const qv = Number(String($('grQty').value).replace(',', '.').trim()), note = $('grNote2').value.trim();
    if ($('grQty').value.trim() === '' || !Number.isFinite(qv) || qv <= 0 || qv > 1e6) { say('הקלידו כמות', 'err'); $('grQty').focus(); return; }
    if (qv > QTY_MAX) {
      if (!$('grQty2')) {
        $('grQty').insertAdjacentHTML('afterend', '<div class="iv-warn" style="margin-top:8px">⚠ כמות מעל 5,000 — אם היא נכונה, הקלידו אותה שוב:</div><input class="iv-in iv-qty" id="grQty2" inputmode="decimal" autocomplete="off" placeholder="הכמות שוב">');
        beep(220, 0.18); $('grQty2').focus(); return;
      }
      if (Number(String($('grQty2').value).replace(',', '.').trim()) !== qv) { say('הכמות שהוקלדה שוב לא זהה', 'err'); $('grQty2').focus(); return; }
    }
    if (item.needConfirm && ($('grConf').value || '').replace(/\s+/g, '') !== item.barcode) { say('הברקוד שהוקלד שוב לא זהה — בדקו את המספר', 'err'); $('grConf').focus(); return; }
    if (item.known === false && !note) { say('פריט לא במגוון — כתבו את שם המוצר', 'err'); $('grNote2').focus(); return; }
    pend.push({ clientId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), docId: cur.id, by: myName(), at: new Date().toISOString(), barcode: item.barcode, qty: qv, note,
      name: item.known ? item.name : null, known: item.offline ? undefined : !!item.known, src: item.src, confirmed: !!item.needConfirm, bigOk: qv > QTY_MAX });
    savePend();
    say('✓ נקלט: ' + (item.name || note || item.barcode) + ' × ' + fmt(qv));
    if (navigator.vibrate) navigator.vibrate(40);
    next(); drawLines(); flush();
  }
  async function flush() {
    if (busy || !pend.length) return;
    busy = true;
    for (const p of pend.slice()) {
      if (p.err || (p.by && p.by !== myName())) continue;
      const r = await api('rcvAdd', p);
      if (r.net) break;
      if (r.ok) {
        pend = pend.filter((x) => x.clientId !== p.clientId);
        if (cur && p.docId === cur.id && !r.dup) lines.unshift({ ...r.line, name: r.line.name || p.name, known: r.line.known, mine: true });
      } else p.err = r.error || 'לא נשמר';
      savePend();
    }
    busy = false;
    if (view === 'doc') drawLines();
    if (pend.some((p) => !p.err)) setTimeout(flush, 15000);
  }
  let ac = null;
  function beep(f, d) { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch (_) {} }

  /* ================= the summary ================= */
  async function showSum(d, fromDoc) {
    if (!d) return;
    view = 'sum'; cur = d; sFilter = 'all'; sQ = ''; head('📊 ' + dname(d), true);
    $('grBody').innerHTML = '<div class="iv-mut" style="text-align:center;padding:30px">טוען…</div>';
    const r = await api('rcvSum', { docId: d.id });
    if (view !== 'sum') return;
    if (!r.ok) { $('grBody').innerHTML = '<div class="iv-card">' + e(r.error) + '</div>'; return; }
    sum = r; sum.fromDoc = !!fromDoc; cur = r.doc;
    drawSum();
  }
  function drawSum() {
    const R = sum.rows, d = sum.doc, red = R.filter((x) => !x.known), oth = R.filter((x) => x.other);
    const units = R.reduce((s, x) => s + x.qty, 0), o = d.status === 'open';
    let h = '<div class="iv-card" style="padding:12px 16px"><h3>🚚 ' + e(dname(d)) + (o ? '<span class="iv-badge" style="background:#dcfce7;color:#166534">פתוחה</span>' : '<span class="iv-badge" style="background:#f1f5f9;color:#475569">הסתיימה</span>') + '</h3>' +
      '<div class="iv-mut">👤 ' + e(d.opened_by || '') + ' · נפתחה ' + when(d.opened_at) + (d.closed_at ? ' · הסתיימה ' + when(d.closed_at) + (d.closed_by ? ' (' + e(d.closed_by) + ')' : '') : '') + (d.order_id ? ' · 🔗 לפי הזמנה ' + d.order_id : '') + (d.note ? ' · ' + e(d.note) : '') + '</div>' +
      (o ? '<div class="iv-warn" style="font-size:13px">הקבלה עדיין פתוחה — מה שייסרק מעכשיו לא נכלל כאן.</div>' : '') + '</div>' +
      '<div class="iv-kpis"><div class="iv-kpi"><b>' + fmt(R.length) + '</b><span>פריטים</span></div><div class="iv-kpi"><b>' + fmt(units) + '</b><span>יחידות</span></div>' +
      '<div class="iv-kpi"><b style="color:' + (red.length ? '#b91c1c' : '#16a34a') + '">' + red.length + '</b><span>לא במגוון</span></div><div class="iv-kpi"><b>' + oth.length + '</b><span>רשומים אצל ספק אחר</span></div></div>' +
      (red.length ? '<div class="iv-card gr-red" style="padding:12px 16px"><h3 style="color:#b91c1c">⛔ ' + red.length + ' פריטים לא במגוון</h3><div class="iv-mut">צריך להקים אותם בקומקס לפני הזנת החשבונית. הם לא נכנסים לקובץ לקומקס — אחרי ההקמה והעדכון הלילי הם יופיעו כרגילים, ואז מייצאים שוב.</div></div>' : '') + vsCard() +
      '<div class="iv-card"><h3>⬇ ייצוא</h3><div class="iv-mut">הקובץ לקומקס בתבנית של החשבוניות ("SAP מערכת"): מספר שורה, ברקוד, שם, כמות, (ריק), (ריק), מחיר — המחיר ריק בקבלת סחורה.</div>' +
      '<div class="iv-acts"><button class="iv-btn iv-pri" id="grXc">⬇ קובץ לקומקס</button><button class="iv-btn" id="grXf">⬇ דוח מלא</button>' +
      (o ? '<button class="iv-btn" id="grGo">▶ להמשיך לסרוק</button><button class="iv-btn iv-ok" id="grClose">✓ סיום הקבלה</button>' : (sum.mgr ? '<button class="iv-btn" id="grReopen">↩ פתיחה מחדש</button>' : '')) + '</div></div>' +
      '<div class="iv-card"><div class="iv-chips"><button data-f="all" class="on">הכול (' + R.length + ')</button><button data-f="red">⛔ לא במגוון (' + red.length + ')</button>' + (oth.length ? '<button data-f="oth">ספק אחר (' + oth.length + ')</button>' : '') + '</div>' +
      '<input class="iv-in" id="grQ" style="font-size:14px;padding:8px 10px" placeholder="🔎 חיפוש שם או ברקוד">' +
      '<div class="iv-wrap" style="margin-top:8px"><table class="iv-tbl" style="min-width:0"><thead><tr><th>פריט</th><th class="n">כמות</th><th class="n hide">שורות</th></tr></thead><tbody id="grRows"></tbody></table></div></div>';
    $('grBody').innerHTML = h;
    sRows(); vsRows();
    $('grBody').querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { vF = b.dataset.v; $('grBody').querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b)); vsRows(); }));
    $('grBody').querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { sFilter = b.dataset.f; $('grBody').querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b)); sRows(); }));
    $('grQ').addEventListener('input', () => { sQ = $('grQ').value.trim(); sRows(); });
    $('grXc').onclick = () => xlsx(false);
    $('grXf').onclick = () => xlsx(true);
    if ($('grGo')) $('grGo').onclick = () => startDoc(d);
    if ($('grClose')) $('grClose').onclick = async () => {
      const b = $('grClose');
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'לסיים? לחצו שוב'; return; }
      const x = await api('rcvClose', { docId: d.id }); if (!x.ok) return say(x.error, 'err');
      say('✓ הקבלה הסתיימה'); showSum(d);
    };
    if ($('grReopen')) $('grReopen').onclick = async () => {
      const b = $('grReopen');
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'לפתוח מחדש? לחצו שוב'; return; }
      const x = await api('rcvClose', { docId: d.id, reopen: true }); if (!x.ok) return say(x.error, 'err');
      say('✓ הקבלה נפתחה מחדש'); d.status = 'open'; startDoc(d);
    };
  }
  /* 📝 against the order (24/11): every barcode of the order or of the receipt — missing / partly / extra / as ordered */
  let vF = 'diff';
  const vsKind = (x) => (x.ordered > 0 && x.received === 0 ? 'miss' : x.received < x.ordered ? 'part' : x.received > x.ordered ? 'extra' : 'ok');
  const VS = { miss: ['❌ לא הגיע', '#b91c1c', '#fef2f2'], part: ['⚠ הגיע חלקית', '#c2410c', '#fff7ed'], extra: ['➕ עודף / לא הוזמן', '#7c3aed', '#f5f3ff'], ok: ['✓ כמו שהוזמן', '#166534', '#fff'] };
  function vsCard() {
    if (!sum.vs || !sum.order) return '';
    const n = { miss: 0, part: 0, extra: 0, ok: 0 }; sum.vs.forEach((x) => n[vsKind(x)]++);
    return '<div class="iv-card"><h3>📝 מול הזמנה ' + sum.order.id + '</h3><div class="iv-mut">ההזמנה של ' + e(sum.order.opened_by || '') + ' · ' + when(sum.order.opened_at) + (sum.doc.status === 'open' ? ' — הקבלה עוד פתוחה, ההשוואה מתעדכנת בכל כניסה.' : '') + '</div>' +
      '<div class="iv-pills"><span style="background:#fef2f2;color:#b91c1c">❌ ' + n.miss + ' לא הגיעו</span><span style="background:#fff7ed;color:#c2410c">⚠ ' + n.part + ' חלקית</span><span style="background:#f5f3ff;color:#7c3aed">➕ ' + n.extra + ' עודף</span><span style="background:#dcfce7;color:#166534">✓ ' + n.ok + ' תקין</span></div>' +
      '<div class="iv-chips"><button data-v="diff"' + (vF === 'diff' ? ' class="on"' : '') + '>רק הפרשים (' + (n.miss + n.part + n.extra) + ')</button><button data-v="all"' + (vF === 'all' ? ' class="on"' : '') + '>הכול (' + sum.vs.length + ')</button></div>' +
      '<div class="iv-wrap" style="max-height:340px"><table class="iv-tbl" style="min-width:0"><thead><tr><th>פריט</th><th class="n">הוזמן</th><th class="n">התקבל</th><th class="n">הפרש</th></tr></thead><tbody id="grVs"></tbody></table></div></div>';
  }
  function vsRows() {
    if (!$('grVs')) return;
    const order = { miss: 0, part: 1, extra: 2, ok: 3 };
    const R = sum.vs.filter((x) => vF === 'all' || vsKind(x) !== 'ok').sort((a, b) => order[vsKind(a)] - order[vsKind(b)]);
    $('grVs').innerHTML = R.map((x) => { const k = vsKind(x), d = x.received - x.ordered;
      return '<tr style="background:' + VS[k][2] + '"><td><b>' + e(x.known ? x.name : '⛔ ' + (x.new_name || 'לא במגוון')) + '</b><span class="bc">' + e(x.barcode) + '</span><small style="color:' + VS[k][1] + ';font-weight:800">' + VS[k][0] + '</small></td>' +
        '<td class="n">' + fmt(x.ordered) + '</td><td class="n">' + fmt(x.received) + '</td><td class="n" style="color:' + VS[k][1] + '">' + (d > 0 ? '+' : '') + fmt(d) + '</td></tr>'; }).join('') ||
      '<tr><td colspan="4" class="iv-mut">✓ הכול הגיע בדיוק כמו שהוזמן</td></tr>';
  }
  function sRows() {
    let R = sum.rows.slice().sort((a, b) => (a.known === b.known ? String(a.name || a.notes || '').localeCompare(String(b.name || b.notes || ''), 'he') : a.known ? 1 : -1));
    if (sFilter === 'red') R = R.filter((x) => !x.known);
    if (sFilter === 'oth') R = R.filter((x) => x.other);
    if (sQ) { const k = sQ.toLowerCase(); R = R.filter((x) => String(x.barcode).includes(k) || String(x.name || x.notes || '').toLowerCase().includes(k)); }
    $('grRows').innerHTML = R.slice(0, 1500).map((x) => '<tr' + (x.known ? '' : ' class="rr"') + '><td><b>' + e(x.known ? x.name : '⛔ ' + (x.notes || 'לא במגוון')) + '</b><span class="bc">' + e(x.barcode) + '</span>' +
      (!x.known ? '<small style="color:#b91c1c;font-weight:800">להקים בקומקס</small>' : '') + (x.other ? '<small class="iv-mut"> ℹ בקומקס אצל: ' + e(x.other) + '</small>' : '') +
      (x.known && x.notes ? '<small class="iv-mut"> · ' + e(x.notes) + '</small>' : '') + (x.people ? '<small class="iv-mut"> 👤' + e(x.people) + '</small>' : '') + '</td>' +
      '<td class="n">' + fmt(x.qty) + '</td><td class="n hide">' + x.lines + '</td></tr>').join('') + (!R.length ? '<tr><td colspan="3" class="iv-mut">אין שורות</td></tr>' : '');
  }
  async function xlsx(full) {
    let X = window.XLSX;
    try { const prev = window.XLSX; await new Promise((res, rej) => { const s = document.createElement('script'); s.src = XS_URL; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); X = window.XLSX; if (prev) window.XLSX = prev; }
    catch (_) { if (!X) return say('לא הצלחתי לטעון את רכיב האקסל', 'err'); }
    const d = sum.doc, R = sum.rows.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'he'));
    const wb = X.utils.book_new(), txt = (v) => ({ t: 's', v: String(v) }), nm = (v) => (v == null ? '' : { t: 'n', v: Number(v) });
    const hd = (a) => a.map((v) => ({ t: 's', v, s: { font: { bold: true }, fill: { fgColor: { rgb: 'E2E8F0' } } } }));
    const stamp = new Date(d.opened_at).toISOString().slice(0, 10).split('-').reverse().join('-');
    const base = (d.supplier_name || 'ספק').replace(/[\\/:*?"<>|]/g, ' ').trim() + (d.doc_no ? ' ' + String(d.doc_no).replace(/[\\/:*?"<>|]/g, '') : '') + ' ' + stamp;
    const known = R.filter((x) => x.known);
    if (!full) {
      // the invoices' "SAP מערכת" template — A serial · B barcode · C name · D qty · E/F blank · G price (empty here)
      const ws = X.utils.aoa_to_sheet([['מספר שורה', 'ברקוד', 'שם פריט', 'כמות', '', '', 'מחיר קניה']].concat(known.map((x, i) => [nm(i + 1), txt(x.barcode), x.name || '', nm(x.qty), '', '', ''])));
      ws['!cols'] = [{ wch: 9 }, { wch: 16 }, { wch: 34 }, { wch: 9 }, { wch: 4 }, { wch: 4 }, { wch: 10 }];
      X.utils.book_append_sheet(wb, ws, 'קבלה');
      X.writeFile(wb, 'קבלת סחורה לקומקס - ' + base + '.xlsx');
    } else {
      const s1 = X.utils.aoa_to_sheet([hd(['ברקוד', 'שם', 'כמות', 'שורות', 'מי סרק', 'הערות', 'בקומקס אצל ספק אחר'])].concat(known.map((x) => [txt(x.barcode), x.name || '', nm(x.qty), nm(x.lines), x.people || '', x.notes || '', x.other || ''])));
      s1['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 9 }, { wch: 7 }, { wch: 18 }, { wch: 24 }, { wch: 22 }]; s1['!views'] = [{ RTL: true }];
      X.utils.book_append_sheet(wb, s1, 'סיכום');
      const red = R.filter((x) => !x.known);
      const s2 = X.utils.aoa_to_sheet([hd(['ברקוד', 'שם המוצר (מההערות)', 'כמות', 'מי סרק'])].concat(red.map((x) => [txt(x.barcode), x.notes || '', nm(x.qty), x.people || ''])));
      s2['!cols'] = [{ wch: 16 }, { wch: 40 }, { wch: 9 }, { wch: 18 }]; s2['!views'] = [{ RTL: true }];
      X.utils.book_append_sheet(wb, s2, 'להקמה בקומקס');
      if (sum.vs) {
        const s4 = X.utils.aoa_to_sheet([hd(['ברקוד', 'שם', 'הוזמן', 'התקבל', 'הפרש', 'מצב'])].concat(sum.vs.map((x) => [txt(x.barcode), x.known ? x.name || '' : x.new_name || '', nm(x.ordered), nm(x.received), nm(x.received - x.ordered), VS[vsKind(x)][0]])));
        s4['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 18 }]; s4['!views'] = [{ RTL: true }];
        X.utils.book_append_sheet(wb, s4, 'מול הזמנה ' + sum.order.id);
      }
      const all = await api('rcvLines', { docId: d.id });
      if (all.ok) {
        const s3 = X.utils.aoa_to_sheet([hd(['תאריך ושעה', 'ברקוד', 'שם', 'כמות', 'מי סרק', 'הערה'])].concat(all.lines.slice().reverse().map((x) => [when(x.at), txt(x.barcode), x.known ? x.name : '⛔ ' + (x.note || ''), nm(x.qty), x.by_name || '', x.known ? x.note || '' : 'לא במגוון'])));
        s3['!cols'] = [{ wch: 17 }, { wch: 16 }, { wch: 34 }, { wch: 8 }, { wch: 18 }, { wch: 24 }]; s3['!views'] = [{ RTL: true }];
        X.utils.book_append_sheet(wb, s3, 'כל השורות');
      }
      X.writeFile(wb, 'קבלת סחורה - דוח מלא - ' + base + '.xlsx');
    }
    api('rcvSum', { docId: d.id, markExported: true });
  }

  /* ================= the menu items ================= */
  function start() {
    const drop = $('menuOpsDrop') || $('menuSchedDrop');
    if (drop && !$('rcvMgrBtn')) {
      const after = $('invMgrBtn');
      const html = '<button id="rcvMgrBtn">📥 קבלת סחורה</button>';
      if (after) after.insertAdjacentHTML('afterend', html); else drop.insertAdjacentHTML('beforeend', html);
      $('rcvMgrBtn').addEventListener('click', open);
    }
    empItem();
  }
  function empItem() {
    const d = $('emSchedDrop');
    if (!d || $('rcvEmpBtn')) return;
    const after = $('invEmpBtn'), html = '<button type="button" id="rcvEmpBtn" role="menuitem">📥 קבלת סחורה</button>';
    if (after) after.insertAdjacentHTML('afterend', html); else d.insertAdjacentHTML('beforeend', html);
    $('rcvEmpBtn').addEventListener('click', open);
  }
  new MutationObserver(() => { if (!$('rcvEmpBtn') && $('emSchedDrop')) empItem(); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openRcv = open;
})();
