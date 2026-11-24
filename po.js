// 📝 הזמנות (24/11/2026, the owner): "a new order requires a barcode and a quantity — at this stage without prices; an
// item that does not exist in the catalog requires marking it as a new item and an agreed price, before VAT or including
// VAT". Every employee (📅 סידור עבודה ונוכחות ▸ 📝 הזמנות) and manager (💼 ▸ תפעול ▸ 📝 הזמנות).
//   the list     ➕ a new order (the supplier — Comax's list, searched; or typed); 🟢 being built (anyone adds),
//                📤 sent (waiting for the delivery), ✓ received (30 days); 🗄 older / the archive
//   the order    scan (ScanCam / a scanner / the last 6 digits) → a known item: its name, what is already in the order →
//                the quantity → ✓. NOT in the catalog: "🆕 פריט חדש" must be ticked + the product's name + the agreed
//                price + לפני מע"מ / כולל מע"מ (all required). Lines wait on the phone without a connection (clientId).
//                📤 סיום ושליחה → the order is locked ("sent"); a manager can open it again until it is received.
//   the summary  one row per barcode, the new items with their price; 📤 to the supplier (the share sheet / WhatsApp —
//                the list as text), ⬇ the file for the supplier, ⬇ the file for Comax (the invoices' "SAP מערכת"
//                template, the price empty, catalog items only), ⬇ the full report; the goods receipts made against it.
// The goods receipt (rcv.js) links itself to a sent order of the same supplier and shows ordered vs received; when that
// receipt is finished the order becomes "received".
// Server: api po* (purchase-orders.ts; migration 20261124110000_purchase_orders.sql). Comax is never written to.
// Uses the app's globals: apiPost, anyAuth/mgrAuth, state, toast; the .iv-* / .gr-* styles (inv-count.js, rcv.js); ScanCam.
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
  const money = (v) => (v == null ? '—' : Number(v).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₪');
  const dm = (s) => (s ? String(new Date(s).getDate()).padStart(2, '0') + '/' + String(new Date(s).getMonth() + 1).padStart(2, '0') : '');
  const hm = (s) => { const d = new Date(s); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const when = (s) => (s ? dm(s) + '/' + new Date(s).getFullYear() + ' ' + hm(s) : '');
  const IMG = 'https://otjhhljgdevazanrretx.supabase.co/storage/v1/object/public/products/';
  const pic = (bc, size) => '<img class="iv-pic" src="' + IMG + encodeURIComponent(bc) + '.webp" alt="" loading="lazy" width="' + size + '" height="' + size + '" onerror="this.remove()">';
  const fine = () => window.matchMedia && matchMedia('(pointer:fine)').matches;
  const XS_URL = '/vendor/xlsx-js-style-1.2.0.min.js';
  const QTY_MAX = 5000, PEND = 'poPend';
  const gs1Ok = (d) => { let sum = 0; for (let i = d.length - 2, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(d[i]) * w; return (10 - (sum % 10)) % 10 === Number(d[d.length - 1]); };
  const upcE2A = (e8) => { const m = e8.slice(1, 7), x = m[5]; return e8[0] + (x <= '2' ? m.slice(0, 2) + x + '0000' + m.slice(2, 5) : x === '3' ? m.slice(0, 3) + '00000' + m.slice(3, 5) : x === '4' ? m.slice(0, 4) + '00000' + m[4] : m.slice(0, 5) + '0000' + x) + e8[7]; };
  const bcCheck = (b) => !/^\d+$/.test(b) ? 'confirm' : [12, 13, 14].includes(b.length) ? (gs1Ok(b) ? 'ok' : 'bad') : b.length === 8 ? (gs1Ok(b) || (/^[01]/.test(b) && gs1Ok(upcE2A(b))) ? 'ok' : 'bad') : 'confirm';
  const oname = (o) => 'הזמנה ' + o.id + ' · ' + (o.supplier_name || 'ספק');
  const vatTxt = (v) => (v === true ? 'כולל מע"מ' : v === false ? 'לפני מע"מ' : '');
  const ST = { open: ['בהכנה', '#dcfce7', '#166534'], sent: ['נשלחה — מחכה לסחורה', '#e0f2fe', '#0369a1'], received: ['התקבלה', '#f1f5f9', '#475569'] };

  let view = 'list', L = null, cur = null, lines = [], item = null, sum = null, sQ = '', camWanted = false, busy = false, sups = null, kt = [];
  let pend = []; try { pend = JSON.parse(store.get(PEND) || '[]'); } catch (_) { pend = []; }
  const savePend = () => store.set(PEND, JSON.stringify(pend));

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#poOv{position:fixed;inset:0;z-index:9000;background:#eef2f7;overflow:auto;direction:rtl;font-family:inherit;color:#0f172a}#poOv.hidden{display:none}' +
    '.po-new{background:#f5f3ff!important;border:2px solid #8b5cf6!important}.po-new .nm{color:#6d28d9}' +
    '.po-chk{display:flex;align-items:center;gap:10px;background:#fff;border:2px solid #c4b5fd;border-radius:12px;padding:10px 12px;font-weight:900;font-size:15px;margin-top:10px;cursor:pointer}' +
    '.po-chk input{width:22px;height:22px;accent-color:#7c3aed}' +
    '.po-vat{display:flex;gap:6px;margin-top:8px}.po-vat button{flex:1;border:2px solid #cbd5e1;background:#fff;border-radius:12px;padding:10px 0;font:inherit;font-size:14.5px;font-weight:900;cursor:pointer;color:#334155}' +
    '.po-vat button.on{background:#7c3aed;border-color:#7c3aed;color:#fff}' +
    '.iv-ln.nw{background:#f5f3ff}.iv-ln.nw .t b{color:#6d28d9}.iv-tbl tr.nw td{background:#f5f3ff}' +
    '</style>');

  /* ================= the shell ================= */
  function open() {
    if (!canUse()) return;
    if (!$('poOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="poOv" class="hidden"><div class="iv-top"><button id="poBack" hidden>→</button><h2 id="poTitle">📝 הזמנות</h2><span class="sp"></span>' +
        '<button id="poX">✕ סגירה</button></div><div class="iv-body" id="poBody"></div></div>');
      $('poX').addEventListener('click', close);
      $('poBack').addEventListener('click', () => { camOff(); if (view === 'sum' && cur && cur.status === 'open') startOrd(cur); else showList(); });
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('poOv') && !$('poOv').classList.contains('hidden') && !(window.ScanCam && ScanCam.on())) close(); });
      window.addEventListener('online', flush);
    }
    $('poOv').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    showList();
    flush();
  }
  function close() { camOff(); $('poOv').classList.add('hidden'); document.body.style.overflow = ''; }
  function head(t, back) { $('poTitle').textContent = t; $('poBack').hidden = !back; }
  function camOff() { camWanted = false; if (window.ScanCam) ScanCam.stop(); }

  /* ================= the list ================= */
  async function showList(old) {
    view = 'list'; head(old ? '🗄 הזמנות ישנות וארכיון' : '📝 הזמנות', !!old);
    $('poBody').innerHTML = '<div class="iv-mut" style="text-align:center;padding:30px">טוען…</div>';
    const r = await api('poList', old ? { old: true } : {});
    if (view !== 'list') return;
    if (!r.ok) { $('poBody').innerHTML = '<div class="iv-card">' + e(r.error) + '<div class="iv-acts"><button class="iv-btn" id="poRe">↻ שוב</button></div></div>'; $('poRe').onclick = () => showList(old); return; }
    L = r;
    const g = (s) => r.docs.filter((d) => d.status === s);
    let h = pendBar();
    if (!old) h += '<div class="iv-card" style="background:linear-gradient(135deg,#f5f3ff,#eff6ff)"><h3>➕ הזמנה חדשה</h3><div class="iv-mut">בוחרים ספק, ואז סורקים ברקוד וכמות — בלי מחירים. פריט שלא בקטלוג: מסמנים "פריט חדש" עם מחיר מוסכם.</div>' +
      '<input class="iv-in" id="poSupQ" style="margin-top:10px;font-size:15px" placeholder="🔎 ספק — הקלידו חלק מהשם" autocomplete="off"><div class="gr-sup" id="poSupL"><div class="iv-mut" style="padding:10px">טוען ספקים…</div></div>' +
      '<input class="iv-in" id="poNote" style="margin-top:8px;font-size:14px" placeholder="הערה (לא חובה) — למשל: לאספקה ביום חמישי" maxlength="200">' +
      '<div class="iv-acts"><button class="iv-btn iv-pri" id="poNew" style="flex:1" disabled>פתיחת הזמנה</button></div></div>';
    if (g('open').length) h += '<div class="iv-h">🟢 בהכנה — אפשר להוסיף פריטים</div>' + g('open').map(card).join('');
    if (g('sent').length) h += '<div class="iv-h">📤 נשלחו — מחכות לסחורה</div>' + g('sent').map(card).join('');
    if (g('received').length) h += '<div class="iv-h">' + (old ? 'ישנות וארכיון' : '✓ התקבלו (30 יום)') + '</div>' + g('received').map(card).join('');
    if (!r.docs.length) h += '<div class="iv-mut" style="text-align:center;padding:20px">' + (old ? 'אין הזמנות ישנות.' : 'עוד אין הזמנות — פותחים אחת למעלה.') + '</div>';
    if (!old) h += '<div class="iv-acts" style="justify-content:center;margin-top:16px"><button class="iv-btn" id="poOld">🗄 הזמנות ישנות וארכיון</button></div>';
    $('poBody').innerHTML = h;
    if (!old) { $('poOld').onclick = () => showList(true); supPicker(); }
    $('poBody').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => startOrd(r.docs.find((d) => String(d.id) === b.dataset.go))));
    $('poBody').querySelectorAll('[data-sum]').forEach((b) => b.addEventListener('click', () => showSum(r.docs.find((d) => String(d.id) === b.dataset.sum))));
    $('poBody').querySelectorAll('[data-arc]').forEach((b) => b.addEventListener('click', async () => {
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'בטוח? לחצו שוב'; return; }
      const x = await api('poArchive', { orderId: Number(b.dataset.arc), back: b.dataset.back === '1' }); if (!x.ok) say(x.error, 'err'); showList(old);
    }));
  }
  function card(d) {
    const s = ST[d.status] || ST.open;
    return '<div class="iv-card"><h3>📝 ' + e(oname(d)) + '<span class="iv-badge" style="background:' + s[1] + ';color:' + s[2] + '">' + s[0] + '</span>' +
      (d.archived ? '<span class="iv-badge" style="background:#f1f5f9;color:#64748b">🗄 ארכיון</span>' : '') + '</h3>' +
      '<div class="iv-mut">👤 ' + e(d.opened_by || '') + ' · נפתחה ' + when(d.opened_at) + (d.sent_at ? ' · נשלחה ' + when(d.sent_at) : '') + (d.received_at ? ' · התקבלה ' + when(d.received_at) : '') + (d.note ? ' · ' + e(d.note) : '') + '</div>' +
      '<div class="iv-pills"><span>' + fmt(d.items) + ' פריטים</span><span>' + fmt(d.units) + ' יחידות</span>' + (d.new_items ? '<span style="background:#f5f3ff;color:#6d28d9">🆕 ' + d.new_items + ' פריטים חדשים</span>' : '') + '</div>' +
      '<div class="iv-acts">' + (d.status === 'open' ? '<button class="iv-btn iv-pri" data-go="' + d.id + '">▶ להוסיף פריטים</button>' : '') + '<button class="iv-btn" data-sum="' + d.id + '">📊 סיכום ושליחה</button>' +
      (L.admin ? '<button class="iv-btn" data-arc="' + d.id + '" data-back="' + (d.archived ? '1' : '0') + '" style="margin-inline-start:auto;color:#64748b">' + (d.archived ? '↩ החזרה מהארכיון' : '🗄 לארכיון') + '</button>' : '') + '</div></div>';
  }
  async function supPicker() {
    let chosen = null;
    const draw = () => {
      const qv = $('poSupQ').value.trim(), list = sups || [];
      const hit = qv ? list.filter((s) => s.name.includes(qv) || String(s.code) === qv) : list.slice(0, 12);
      $('poSupL').innerHTML = (sups ? '' : '<div class="iv-mut" style="padding:10px">טוען ספקים…</div>') +
        hit.slice(0, 40).map((s) => '<button type="button" data-c="' + s.code + '"' + (chosen && chosen.code === s.code ? ' class="on"' : '') + '><span>' + e(s.name) + '</span><small>' + (s.items ? s.items + ' פריטים' : '') + '</small></button>').join('') +
        (qv && sups ? '<button type="button" data-free="1"' + (chosen && !chosen.code ? ' class="on"' : '') + '><span>✍ ספק שלא ברשימה: "' + e(qv) + '"</span><small>ידני</small></button>' : '') +
        (!qv && sups ? '<div class="iv-mut" style="padding:8px 12px">מוצגים הספקים עם הכי הרבה פריטים — הקלידו כדי לחפש בכל ' + sups.length + ' הספקים.</div>' : '');
      $('poSupL').querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { chosen = sups.find((s) => String(s.code) === b.dataset.c); $('poSupQ').value = chosen.name; draw(); $('poNew').disabled = false; }));
      const fr = $('poSupL').querySelector('[data-free]');
      if (fr) fr.addEventListener('click', () => { chosen = { code: 0, name: $('poSupQ').value.trim() }; draw(); $('poNew').disabled = false; });
    };
    $('poSupQ').addEventListener('input', () => { if (chosen && $('poSupQ').value.trim() !== chosen.name) { chosen = null; $('poNew').disabled = true; } draw(); });
    draw();
    $('poNew').onclick = async () => {
      if (!chosen) return say('בחרו ספק מהרשימה', 'err');
      const b = $('poNew'); b.disabled = true;
      const x = await api('poOpen', { supplier: chosen.code, supplierName: chosen.name, note: $('poNote').value.trim() });
      b.disabled = false;
      if (!x.ok) return say(x.error, 'err');
      startOrd(x.doc);
    };
    if (!sups) { const r = await api('rcvSuppliers'); if (r.ok) { sups = r.suppliers; if ($('poSupL')) draw(); } }
  }
  function pendBar() {
    if (!pend.length) return '';
    const errs = pend.filter((p) => p.err).length;
    return '<div class="iv-pend">⏳ ' + pend.length + ' שורות מחכות לשליחה' + (errs ? ' (' + errs + ' עם בעיה — ראו בהזמנה)' : ' — יישלחו כשיחזור החיבור') + '</div>';
  }

  /* ================= the order ================= */
  function startOrd(d) {
    if (!d) return;
    view = 'ord'; cur = d; item = null; head('📝 ' + oname(d), true);
    $('poBody').innerHTML = '<div id="poPendBar"></div><div class="iv-mut" style="margin:0 4px 8px;font-weight:800">👤 מזמין/ה: <span style="color:#0f172a">' + e(myName()) + '</span> · 📝 ' + e(oname(d)) + '</div><div class="iv-scan">' +
      '<div id="poCamBox"></div>' +
      '<form class="iv-row" id="poBcF" action="#" autocomplete="off"><input class="iv-in" id="poBc" inputmode="numeric" enterkeyhint="search" autocomplete="off" placeholder="ברקוד, 6 ספרות אחרונות או שם" dir="auto" style="text-align:right">' +
      '<button type="submit" class="iv-btn" title="חיפוש" style="font-size:18px;padding:9px 12px">🔎</button><button type="button" class="iv-btn" id="poAbc" title="חיפוש לפי שם — מקלדת אותיות" style="font-size:14px;padding:9px 10px">אבג</button><button type="button" class="iv-btn iv-pri" id="poCam" title="סריקה במצלמה" style="font-size:18px;padding:9px 12px">📷</button></form>' +
      '<div id="poItem"></div></div>' +
      '<div class="iv-h" id="poLinesH">בהזמנה</div><div class="iv-card" id="poLines" style="padding:6px 14px"><div class="iv-mut" style="padding:10px 0">טוען…</div></div>' +
      '<div class="iv-acts"><button class="iv-btn iv-ok" id="poSend">📤 סיום ושליחת ההזמנה</button><button class="iv-btn" id="poToSum">📊 סיכום</button></div>' +
      '<div class="iv-mut" style="margin:6px 4px">אחרי "סיום ושליחה" ההזמנה ננעלת, ואפשר לשלוח אותה לספק ולייצא לקומקס.</div>';
    const goBc = () => {
      const raw = $('poBc').value.trim(), v = /[\u0590-\u05FFA-Za-z]/.test(raw) ? raw.replace(/\s+/g, ' ') : raw.replace(/\s+/g, '');
      const fast = kt.length >= 6 && kt.length >= v.length - 1 && (kt[kt.length - 1] - kt[0]) / (kt.length - 1) < 35;
      kt = [];
      if (v) { $('poBc').blur(); lookup(v, fast ? 'scan' : 'typed'); } else say('הקלידו ברקוד או 6 ספרות אחרונות', 'err');
    };
    $('poBc').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); goBc(); } else if (ev.key.length === 1) kt.push(performance.now()); });
    $('poBcF').addEventListener('submit', (ev) => { ev.preventDefault(); goBc(); });
    $('poBc').addEventListener('input', () => { if (!$('poBc').value) kt = []; });
    $('poBc').addEventListener('paste', () => { kt = []; });
    $('poAbc').onclick = () => { const i = $('poBc'), t = i.inputMode !== 'text'; i.inputMode = t ? 'text' : 'numeric'; i.placeholder = t ? 'שם המוצר — למשל עגבניה' : 'ברקוד, 6 ספרות אחרונות או שם'; $('poAbc').textContent = t ? '123' : 'אבג'; i.blur(); setTimeout(() => i.focus(), 50); };
    $('poCam').onclick = () => (window.ScanCam && ScanCam.on() ? camOff() : cam());
    $('poToSum').onclick = () => { camOff(); showSum(cur); };
    $('poSend').onclick = () => sendOrder($('poSend'));
    if (fine()) $('poBc').focus();
    loadLines();
  }
  async function sendOrder(b) {
    if (pend.some((p) => p.orderId === cur.id && !p.err)) return say('יש שורות שעוד לא נשלחו — חכו לחיבור', 'err');
    if (!b.classList.contains('sure')) { b.classList.add('sure'); const t = b.textContent; b.textContent = 'לסיים ולנעול את ההזמנה? לחצו שוב'; setTimeout(() => { if (b.isConnected) { b.classList.remove('sure'); b.textContent = t; } }, 4000); return; }
    const x = await api('poSend', { orderId: cur.id }); if (!x.ok) return say(x.error, 'err');
    camOff(); say('✓ ההזמנה הסתיימה — עכשיו שולחים לספק'); showSum(cur);
  }
  function cam() {
    camWanted = true;
    if (!window.ScanCam) return say('רכיב המצלמה לא נטען — רעננו את הדף', 'err');
    ScanCam.start($('poCamBox'), (t) => lookup(t, 'scan', true), (m) => { camWanted = false; say(m, 'err'); });
  }
  async function loadLines() { const r = await api('poLines', { orderId: cur.id }); if (r.ok) lines = r.lines; drawLines(); }
  function drawLines() {
    if (view !== 'ord' || !$('poLines')) return;
    $('poPendBar').innerHTML = pendBar();
    const pp = pend.filter((p) => p.orderId === cur.id && (!p.by || p.by === myName()));
    const all = pp.map((p) => ({ ...p, p: true, mine: true, new_name: p.newName, price_vat: p.priceVat })).concat(lines);
    const units = all.reduce((s, x) => s + Number(x.qty || 0), 0), nw = new Set(all.filter((x) => x.known === false).map((x) => x.barcode)).size;
    $('poLinesH').innerHTML = 'בהזמנה — ' + all.length + ' שורות · ' + fmt(units) + ' יחידות' + (nw ? ' · <span style="color:#6d28d9">🆕 ' + nw + ' פריטים חדשים</span>' : '');
    if (!all.length) { $('poLines').innerHTML = '<div class="iv-mut" style="padding:10px 0">ההזמנה ריקה. סרקו ברקוד כדי להוסיף.</div>'; return; }
    const canEd = (l) => l.p || l.mine || (appState() && appState().mgr);
    $('poLines').innerHTML = all.slice(0, 300).map((l) => '<div class="iv-ln' + (l.p ? ' p' : '') + (l.err ? ' err' : '') + (l.known === false ? ' nw' : '') + '" data-id="' + (l.p ? 'p:' + l.clientId : l.id) + '">' + (l.known !== false ? pic(l.barcode, 38) : '') +
      '<div class="t"><b>' + e(l.known === false ? '🆕 ' + (l.new_name || 'פריט חדש') : l.name || l.barcode) + '</b><small dir="ltr">' + e(l.barcode) + '</small><small> · 🕒 ' + hm(l.at) + (l.by_name && l.by_name !== myName() ? ' · 👤' + e(l.by_name) : '') +
      (l.known === false ? ' · ' + money(l.price) + ' ' + vatTxt(l.price_vat) : '') + (l.p ? ' · ' + (l.err ? '⚠ ' + e(l.err) : '⏳ מחכה לשליחה') : '') + (l.note ? ' · ' + e(l.note) : '') + '</small></div>' +
      '<span class="q">' + fmt(l.qty) + '</span>' + (canEd(l) && !(l.p && !l.err) ? '<button class="ed">✎</button><button class="del">✕</button>' : '') + '</div>').join('');
    $('poLines').querySelectorAll('.iv-ln').forEach((row) => {
      const id = row.dataset.id, ed = row.querySelector('.ed'), del = row.querySelector('.del');
      if (del) del.onclick = async () => {
        if (!del.classList.contains('sure')) { del.classList.add('sure'); del.textContent = 'למחוק?'; setTimeout(() => { del.classList.remove('sure'); del.textContent = '✕'; }, 3000); return; }
        if (id.startsWith('p:')) { pend = pend.filter((p) => 'p:' + p.clientId !== id); savePend(); drawLines(); return; }
        const r = await api('poDel', { id: Number(id) }); if (!r.ok) return say(r.error, 'err');
        lines = lines.filter((x) => String(x.id) !== id); drawLines();
      };
      if (ed) ed.onclick = () => editRow(row, id);
    });
  }
  function editRow(row, id) {
    const p = id.startsWith('p:') ? pend.find((x) => 'p:' + x.clientId === id) : null, l = p || lines.find((x) => String(x.id) === id);
    if (!l) return;
    const isNew = l.known === false, nm0 = p ? p.newName : l.new_name, pr0 = p ? p.price : l.price;
    let vat = p ? p.priceVat : l.price_vat;
    row.innerHTML = '<div class="t" style="display:flex;gap:6px;flex-wrap:wrap"><input class="iv-in" style="width:80px;font-size:15px;padding:7px" inputmode="decimal" value="' + e(l.qty) + '" title="כמות">' +
      (isNew ? '<input class="iv-in nn" style="flex:1;min-width:120px;font-size:14px;padding:7px" placeholder="שם המוצר" value="' + e(nm0 || '') + '"><input class="iv-in pr" style="width:90px;font-size:14px;padding:7px" inputmode="decimal" placeholder="מחיר" value="' + e(pr0 == null ? '' : pr0) + '">' +
        '<div class="po-vat" style="width:100%;margin-top:0"><button type="button" data-vat="0"' + (vat === false ? ' class="on"' : '') + '>לפני מע"מ</button><button type="button" data-vat="1"' + (vat === true ? ' class="on"' : '') + '>כולל מע"מ</button></div>' : '') +
      '<input class="iv-in nt" style="flex:1;min-width:120px;font-size:14px;padding:7px" placeholder="הערה" value="' + e(l.note || '') + '"></div><button class="sv" style="background:#16a34a;color:#fff">💾</button>';
    row.querySelectorAll('[data-vat]').forEach((b) => b.addEventListener('click', () => { vat = b.dataset.vat === '1'; row.querySelectorAll('[data-vat]').forEach((x) => x.classList.toggle('on', x === b)); }));
    const qi = row.querySelector('input'); qi.focus(); qi.select();
    row.querySelector('.sv').onclick = async () => {
      const qv = Number(String(qi.value).replace(',', '.')), note = row.querySelector('.nt').value.trim();
      if (!Number.isFinite(qv) || qv <= 0 || qv > 1e6) return say('כמות לא תקינה', 'err');
      if (qv > QTY_MAX) return say('כמות מעל 5,000 — מחקו את השורה והוסיפו אותה שוב עם אישור', 'err');
      const extra = {};
      if (isNew) {
        const nn = row.querySelector('.nn').value.trim(), pr = Number(String(row.querySelector('.pr').value).replace(',', '.'));
        if (!nn) return say('פריט חדש — כתבו את שם המוצר', 'err');
        if (!(pr > 0)) return say('פריט חדש — חובה מחיר מוסכם', 'err');
        if (typeof vat !== 'boolean') return say('סמנו אם המחיר לפני מע"מ או כולל מע"מ', 'err');
        Object.assign(extra, { newName: nn, price: pr, priceVat: vat });
      }
      if (p) { Object.assign(p, { qty: qv, note, err: '' }, extra); savePend(); drawLines(); flush(); return; }
      const r = await api('poEdit', { id: Number(id), qty: qv, note, ...extra }); if (!r.ok) return say(r.error, 'err');
      Object.assign(l, { qty: qv, note }); if (isNew) Object.assign(l, { new_name: extra.newName, price: extra.price, price_vat: extra.priceVat }); drawLines();
    };
  }

  const big = (b) => '<div class="bc" style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:1.5px">' + e(b) + '</div>';
  function stopMsg(msg) {
    item = null;
    $('poItem').innerHTML = '<div class="iv-item u">' + msg + '<div class="iv-acts"><button class="iv-btn" id="poSkip">ביטול</button></div></div>';
    $('poSkip').onclick = next; beep(220, 0.18);
  }
  async function lookup(code, src, exact) {
    code = /[\u0590-\u05FFA-Za-z]/.test(String(code)) ? String(code).trim().replace(/\s+/g, ' ') : String(code).replace(/\s+/g, '');
    $('poBc').value = code;
    $('poItem').innerHTML = '<div class="iv-mut" style="padding:12px 2px">🔎 מחפש ' + e(code) + '…</div>';
    const r = await api('poLookup', { barcode: code, orderId: cur.id, exact: exact || src === 'scan' });
    if (view !== 'ord') return;
    if (!r.ok && !r.net) { $('poItem').innerHTML = '<div class="iv-warn">' + e(r.error) + '</div>'; return; }
    if (r.tooMany) return stopMsg('<div class="nm">🔎 יותר מדי מוצרים מסתיימים ב-' + e(code) + '</div><div class="iv-mut">הקלידו עוד ספרות מהסוף, או את הברקוד המלא.</div>');
    if (r.byName && !r.multi.length) return stopMsg('<div class="nm">🔎 לא נמצא מוצר בשם "' + e(code) + '"</div><div class="iv-mut">נסו מילה אחרת או חלק מהשם (למשל "עגב"), או סרקו ברקוד.</div>');
    if (r.multi) {
      item = null; beep(880, 0.06);
      $('poItem').innerHTML = '<div class="iv-item k"><div class="nm">' + (r.byName ? 'נמצאו ' + r.multi.length + (r.multi.length === 30 ? '+' : '') + ' מוצרים בשם "' + e(code) + '" — בחרו:' : 'נמצאו ' + r.multi.length + ' מוצרים שמסתיימים ב-' + e(code) + ' — בחרו:') + '</div>' +
        r.multi.map((x) => '<button type="button" class="iv-btn iv-head" data-pick="' + e(x.barcode) + '" style="width:100%;text-align:right;margin-top:8px">' + (x.img ? pic(x.barcode, 52) : '') + '<div><b>' + e(x.name) + '</b>' +
          (x.mine ? ' <span class="iv-badge" style="background:#dcfce7;color:#166534">של הספק</span>' : '') + (x.archived ? ' <span class="iv-badge" style="background:#f1f5f9;color:#64748b">ארכיון</span>' : '') +
          '<div class="bc">' + (r.byName ? e(x.barcode) : e(x.barcode.slice(0, -code.length)) + '<b style="color:#0076DA">' + e(x.barcode.slice(-code.length)) + '</b>') + '</div></div></button>').join('') +
        '<div class="iv-acts"><button class="iv-btn" id="poSkip">ביטול</button></div></div>';
      $('poItem').querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => lookup(b.dataset.pick, 'pick', true)));
      $('poSkip').onclick = next;
      return;
    }
    if (!r.ok) return stopMsg('<div class="nm">📡 אין חיבור</div><div class="iv-mut">כדי לבדוק אם הפריט בקטלוג צריך חיבור. נסו שוב בעוד רגע.</div>');
    item = r; item.src = src; item.needConfirm = false;
    if (!item.known && src !== 'scan') {
      if (item.check === 'bad') return stopMsg('<div class="nm">⚠ הברקוד לא תקין</div>' + big(item.barcode) + '<div class="iv-warn">הספרה האחרונה (ספרת הביקורת) לא מתאימה — כנראה טעות הקלדה. בדקו את המספר, או סרקו אותו.</div>');
      item.needConfirm = item.check !== 'ok';
    }
    if (r.short) item.shortMiss = true;
    if (!r.known) beep(330, 0.2); else beep(1100, 0.07);
    const pp = pend.filter((p) => p.orderId === cur.id && p.barcode === item.barcode);
    const already = (item.already || 0) + pp.reduce((s, p) => s + Number(p.qty || 0), 0), times = (item.times || 0) + pp.length;
    const seen = times ? '<div class="iv-nums"><div><small>כבר בהזמנה</small><b>' + fmt(already) + '</b></div><div><small>כמה שורות</small><b>' + times + '</b></div></div>' : '';
    const conf = item.needConfirm ? '<div class="iv-mut" style="margin-top:8px;font-weight:700;color:#0f172a">' +
      (item.shortMiss ? 'אין בקטלוג מוצר שמסתיים ב-' + e(item.barcode) + '. סרקו אותו או הקלידו את הברקוד המלא (בדרך כלל 13 ספרות). ואם זה באמת הברקוד המלא — הקלידו אותו שוב:'
        : 'לברקוד באורך ' + item.barcode.length + ' ספרות אין ספרת ביקורת — הקלידו אותו שוב לאישור:') +
      '</div><input class="iv-in" id="poConf" inputmode="numeric" autocomplete="off" dir="ltr" style="text-align:right;margin-top:6px" placeholder="הברקוד שוב">' : '';
    const pv = item.prevNew || {};
    let vat = typeof pv.priceVat === 'boolean' ? pv.priceVat : null;
    let h;
    if (item.known) h = '<div class="iv-item k"><div class="iv-head">' + (item.img ? pic(item.barcode, 96) : '') + '<div><div class="nm">' + e(item.name) + '</div><div class="bc">' + e(item.barcode) + '</div></div></div>' +
      (item.archived ? '<div class="gr-soft">🗄 הפריט בארכיון בקומקס</div>' : '') + (item.otherSupplier ? '<div class="gr-soft">ℹ בקומקס הפריט רשום אצל ספק אחר: ' + e(item.otherSupplier) + '</div>' : '') + seen;
    else h = '<div class="iv-item po-new"><div class="nm">🆕 פריט לא בקטלוג</div>' + big(item.barcode) + conf +
      '<label class="po-chk"><input type="checkbox" id="poIsNew"' + (pv.name ? ' checked' : '') + '>🆕 זה פריט חדש (חובה לסמן)</label>' +
      '<input class="iv-in" id="poNewName" style="margin-top:8px;font-size:15px" placeholder="שם המוצר — למשל: במבה 80 גרם אסם" maxlength="120" value="' + e(pv.name || '') + '">' +
      '<input class="iv-in" id="poPrice" style="margin-top:8px;font-size:16px" inputmode="decimal" placeholder="מחיר מוסכם ליחידה (₪)" autocomplete="off" value="' + e(pv.price || '') + '">' +
      '<div class="po-vat"><button type="button" data-vat="0"' + (vat === false ? ' class="on"' : '') + '>לפני מע"מ</button><button type="button" data-vat="1"' + (vat === true ? ' class="on"' : '') + '>כולל מע"מ</button></div>' + seen;
    h += '<input class="iv-in iv-qty" id="poQty" inputmode="decimal" enterkeyhint="done" placeholder="כמות" autocomplete="off" style="margin-top:10px">' +
      '<div class="iv-quick">' + [1, 6, 12, 24, 48].map((n) => '<button type="button" data-q="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<input class="iv-in" id="poNote2" style="margin-top:8px;font-size:14px;padding:9px 10px;display:none" placeholder="הערה (לא חובה)" maxlength="200">' +
      '<div class="iv-acts"><button type="button" class="iv-btn" id="poNoteBtn" style="font-size:13px">+ הערה</button>' +
      '<button type="submit" class="iv-btn iv-ok" style="flex:1;font-size:16px">✓ הוספה להזמנה</button><button type="button" class="iv-btn" id="poSkip">ביטול</button></div></div>';
    $('poItem').innerHTML = '<form id="poItemF" action="#" autocomplete="off">' + h + '</form>';
    $('poItem').querySelectorAll('[data-vat]').forEach((b) => b.addEventListener('click', () => { vat = b.dataset.vat === '1'; item.vat = vat; $('poItem').querySelectorAll('[data-vat]').forEach((x) => x.classList.toggle('on', x === b)); }));
    item.vat = vat;
    $('poItemF').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const a = document.activeElement;
      if (a && a.id === 'poConf') return (item.known ? $('poQty') : $('poNewName')).focus();
      if (a && a.id === 'poNewName') return $('poPrice').focus();
      if (a && a.id === 'poPrice') return $('poQty').focus();
      save();
    });
    if ($('poConf')) $('poConf').focus(); else if (!item.known && !pv.name) $('poNewName').focus(); else $('poQty').focus();
    $('poItem').querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { $('poQty').value = b.dataset.q; $('poQty').focus(); }));
    $('poNoteBtn').onclick = () => { $('poNote2').style.display = ''; $('poNoteBtn').remove(); $('poNote2').focus(); };
    $('poSkip').onclick = next;
  }
  function next() {
    item = null; $('poItem').innerHTML = ''; $('poBc').value = '';
    if (camWanted) cam(); else if (fine()) $('poBc').focus();
  }
  function save() {
    if (!item) return;
    const qv = Number(String($('poQty').value).replace(',', '.').trim()), note = $('poNote2').value.trim();
    if ($('poQty').value.trim() === '' || !Number.isFinite(qv) || qv <= 0 || qv > 1e6) { say('הקלידו כמות', 'err'); $('poQty').focus(); return; }
    if (qv > QTY_MAX) {
      if (!$('poQty2')) {
        $('poQty').insertAdjacentHTML('afterend', '<div class="iv-warn" style="margin-top:8px">⚠ כמות מעל 5,000 — אם היא נכונה, הקלידו אותה שוב:</div><input class="iv-in iv-qty" id="poQty2" inputmode="decimal" autocomplete="off" placeholder="הכמות שוב">');
        beep(220, 0.18); $('poQty2').focus(); return;
      }
      if (Number(String($('poQty2').value).replace(',', '.').trim()) !== qv) { say('הכמות שהוקלדה שוב לא זהה', 'err'); $('poQty2').focus(); return; }
    }
    if (item.needConfirm && ($('poConf').value || '').replace(/\s+/g, '') !== item.barcode) { say('הברקוד שהוקלד שוב לא זהה — בדקו את המספר', 'err'); $('poConf').focus(); return; }
    const row = { clientId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), orderId: cur.id, by: myName(), at: new Date().toISOString(), barcode: item.barcode, qty: qv, note,
      name: item.known ? item.name : null, known: !!item.known, src: item.src, confirmed: !!item.needConfirm, bigOk: qv > QTY_MAX };
    if (!item.known) {
      const nn = $('poNewName').value.trim(), pr = Number(String($('poPrice').value).replace(',', '.').trim());
      if (!$('poIsNew').checked) { say('פריט שלא בקטלוג — סמנו "זה פריט חדש"', 'err'); $('poIsNew').focus(); return; }
      if (!nn) { say('פריט חדש — כתבו את שם המוצר', 'err'); $('poNewName').focus(); return; }
      if (!(pr > 0) || pr > 1e5) { say('פריט חדש — חובה מחיר מוסכם', 'err'); $('poPrice').focus(); return; }
      if (typeof item.vat !== 'boolean') { say('סמנו אם המחיר לפני מע"מ או כולל מע"מ', 'err'); return; }
      Object.assign(row, { newItem: true, newName: nn, price: pr, priceVat: item.vat });
    }
    pend.push(row); savePend();
    say('✓ נוסף: ' + (item.name || row.newName || item.barcode) + ' × ' + fmt(qv));
    if (navigator.vibrate) navigator.vibrate(40);
    next(); drawLines(); flush();
  }
  async function flush() {
    if (busy || !pend.length) return;
    busy = true;
    for (const p of pend.slice()) {
      if (p.err || (p.by && p.by !== myName())) continue;
      const r = await api('poAdd', p);
      if (r.net) break;
      if (r.ok) {
        pend = pend.filter((x) => x.clientId !== p.clientId);
        if (cur && p.orderId === cur.id && !r.dup) lines.unshift({ ...r.line, name: r.line.name || p.name, known: r.line.known, mine: true });
      } else p.err = r.error || 'לא נשמר';
      savePend();
    }
    busy = false;
    if (view === 'ord') drawLines();
    if (pend.some((p) => !p.err)) setTimeout(flush, 15000);
  }
  let ac = null;
  function beep(f, d) { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch (_) {} }

  /* ================= the summary ================= */
  async function showSum(d) {
    if (!d) return;
    view = 'sum'; cur = d; sQ = ''; head('📊 ' + oname(d), true);
    $('poBody').innerHTML = '<div class="iv-mut" style="text-align:center;padding:30px">טוען…</div>';
    const r = await api('poSum', { orderId: d.id });
    if (view !== 'sum') return;
    if (!r.ok) { $('poBody').innerHTML = '<div class="iv-card">' + e(r.error) + '</div>'; return; }
    sum = r; cur = r.doc;
    drawSum();
  }
  function drawSum() {
    const R = sum.rows, d = sum.doc, nw = R.filter((x) => !x.known), s = ST[d.status] || ST.open;
    const units = R.reduce((t, x) => t + x.qty, 0);
    let h = '<div class="iv-card" style="padding:12px 16px"><h3>📝 ' + e(oname(d)) + '<span class="iv-badge" style="background:' + s[1] + ';color:' + s[2] + '">' + s[0] + '</span></h3>' +
      '<div class="iv-mut">👤 ' + e(d.opened_by || '') + ' · נפתחה ' + when(d.opened_at) + (d.sent_at ? ' · נשלחה ' + when(d.sent_at) + (d.sent_by ? ' (' + e(d.sent_by) + ')' : '') : '') + (d.note ? ' · ' + e(d.note) : '') + '</div>' +
      (sum.receipts.length ? '<div class="iv-mut" style="margin-top:4px">📥 קבלות סחורה לפי ההזמנה: ' + sum.receipts.map((x) => when(x.opened_at) + (x.doc_no ? ' (ת.מ. ' + e(x.doc_no) + ')' : '') + (x.status === 'open' ? ' — פתוחה' : '')).join(' · ') + '</div>' : '') + '</div>' +
      '<div class="iv-kpis"><div class="iv-kpi"><b>' + fmt(R.length) + '</b><span>פריטים</span></div><div class="iv-kpi"><b>' + fmt(units) + '</b><span>יחידות</span></div>' +
      '<div class="iv-kpi"><b style="color:' + (nw.length ? '#6d28d9' : '#16a34a') + '">' + nw.length + '</b><span>פריטים חדשים</span></div><div class="iv-kpi"><b>' + (sum.receipts.length) + '</b><span>קבלות סחורה</span></div></div>';
    if (nw.length) h += '<div class="iv-card po-new" style="padding:12px 16px"><h3 style="color:#6d28d9">🆕 ' + nw.length + ' פריטים חדשים</h3><div class="iv-mut">לא קיימים בקטלוג — להקים בקומקס (עם המחיר המוסכם) לפני קבלת הסחורה והחשבונית. הם לא נכנסים לקובץ לקומקס.</div>' +
      '<table class="iv-tbl" style="min-width:0;margin-top:6px"><thead><tr><th>פריט</th><th class="n">כמות</th><th class="n">מחיר מוסכם</th></tr></thead><tbody>' +
      nw.map((x) => '<tr class="nw"><td><b>' + e(x.new_name || 'פריט חדש') + '</b><span class="bc">' + e(x.barcode) + '</span></td><td class="n">' + fmt(x.qty) + '</td><td class="n">' + money(x.price) + '<br><small class="iv-mut">' + vatTxt(x.price_vat) + '</small></td></tr>').join('') + '</tbody></table></div>';
    h += '<div class="iv-card"><h3>' + (d.status === 'open' ? '📤 סיום ושליחה' : '📤 שליחה וייצוא') + '</h3>' +
      (d.status === 'open' ? '<div class="iv-mut">ההזמנה עוד בהכנה. בסיום היא ננעלת, ואז שולחים לספק.</div><div class="iv-acts"><button class="iv-btn" id="poGo">▶ להוסיף פריטים</button><button class="iv-btn iv-ok" id="poSend2">📤 סיום ושליחת ההזמנה</button></div>'
        : '<div class="iv-mut">לספק: רשימת הפריטים כהודעה (וואטסאפ / מייל) או כקובץ. לקומקס: בתבנית של החשבוניות ("SAP מערכת") — המחיר ריק, רק פריטים מהקטלוג.</div>' +
          '<div class="iv-acts"><button class="iv-btn iv-pri" id="poShare">📤 שליחה לספק</button><button class="iv-btn" id="poXs">⬇ קובץ לספק</button><button class="iv-btn" id="poXc">⬇ קובץ לקומקס</button><button class="iv-btn" id="poXf">⬇ דוח מלא</button>' +
          (d.status === 'sent' && sum.mgr ? '<button class="iv-btn" id="poReopen">↩ פתיחה מחדש</button>' : '') + '</div>') + '</div>' +
      '<div class="iv-card"><input class="iv-in" id="poQ" style="font-size:14px;padding:8px 10px" placeholder="🔎 חיפוש שם או ברקוד">' +
      '<div class="iv-wrap" style="margin-top:8px"><table class="iv-tbl" style="min-width:0"><thead><tr><th>פריט</th><th class="n">כמות</th></tr></thead><tbody id="poRows"></tbody></table></div></div>';
    $('poBody').innerHTML = h;
    sRows();
    $('poQ').addEventListener('input', () => { sQ = $('poQ').value.trim(); sRows(); });
    if ($('poGo')) $('poGo').onclick = () => startOrd(d);
    if ($('poSend2')) $('poSend2').onclick = () => sendOrder($('poSend2'));
    if ($('poShare')) $('poShare').onclick = share;
    if ($('poXs')) $('poXs').onclick = () => xlsx('sup');
    if ($('poXc')) $('poXc').onclick = () => xlsx('comax');
    if ($('poXf')) $('poXf').onclick = () => xlsx('full');
    if ($('poReopen')) $('poReopen').onclick = async () => {
      const b = $('poReopen');
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'לפתוח מחדש? לחצו שוב'; return; }
      const x = await api('poSend', { orderId: d.id, reopen: true }); if (!x.ok) return say(x.error, 'err');
      say('✓ ההזמנה נפתחה מחדש'); d.status = 'open'; startOrd(d);
    };
  }
  const sorted = () => sum.rows.slice().sort((a, b) => String(a.name || a.new_name || '').localeCompare(String(b.name || b.new_name || ''), 'he'));
  function sRows() {
    let R = sorted();
    if (sQ) { const k = sQ.toLowerCase(); R = R.filter((x) => String(x.barcode).includes(k) || String(x.name || x.new_name || '').toLowerCase().includes(k)); }
    $('poRows').innerHTML = R.slice(0, 1500).map((x) => '<tr' + (x.known ? '' : ' class="nw"') + '><td><b>' + e(x.known ? x.name : '🆕 ' + (x.new_name || 'פריט חדש')) + '</b><span class="bc">' + e(x.barcode) + '</span>' +
      (x.notes ? '<small class="iv-mut">' + e(x.notes) + '</small>' : '') + (x.people ? '<small class="iv-mut"> 👤' + e(x.people) + '</small>' : '') + '</td><td class="n">' + fmt(x.qty) + '</td></tr>').join('') +
      (!R.length ? '<tr><td colspan="2" class="iv-mut">אין שורות</td></tr>' : '');
  }
  // the order as a message to the supplier: name · barcode · quantity (a new item: + the agreed price)
  function text() {
    const d = sum.doc;
    return 'הזמנה ' + d.id + ' — סופרסטאר פלוס\nספק: ' + (d.supplier_name || '') + '\nתאריך: ' + when(d.sent_at || d.opened_at) + (d.note ? '\nהערה: ' + d.note : '') + '\n\n' +
      sorted().map((x, i) => (i + 1) + '. ' + (x.known ? x.name : x.new_name + ' (פריט חדש · ' + money(x.price) + ' ' + vatTxt(x.price_vat) + ')') + '\n   ברקוד ' + x.barcode + ' · כמות ' + fmt(x.qty)).join('\n') +
      '\n\nסה"כ ' + sum.rows.length + ' פריטים';
  }
  async function share() {
    const t = text();
    if (navigator.share) { try { await navigator.share({ title: 'הזמנה ' + sum.doc.id, text: t }); api('poSum', { orderId: sum.doc.id, markExported: true }); return; } catch (x) { if (/Abort/i.test(String(x && x.name))) return; } }
    try { await navigator.clipboard.writeText(t); say('✓ ההזמנה הועתקה — הדביקו בוואטסאפ או במייל לספק'); }
    catch (_) { window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank'); }
  }
  async function xlsx(kind) {
    let X = window.XLSX;
    try { const prev = window.XLSX; await new Promise((res, rej) => { const s = document.createElement('script'); s.src = XS_URL; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); X = window.XLSX; if (prev) window.XLSX = prev; }
    catch (_) { if (!X) return say('לא הצלחתי לטעון את רכיב האקסל', 'err'); }
    const d = sum.doc, R = sorted(), wb = X.utils.book_new();
    const txt = (v) => ({ t: 's', v: String(v) }), nm = (v) => (v == null ? '' : { t: 'n', v: Number(v) });
    const hd = (a) => a.map((v) => ({ t: 's', v, s: { font: { bold: true }, fill: { fgColor: { rgb: 'E2E8F0' } } } }));
    const stamp = new Date(d.sent_at || d.opened_at).toISOString().slice(0, 10).split('-').reverse().join('-');
    const base = 'הזמנה ' + d.id + ' - ' + (d.supplier_name || 'ספק').replace(/[\\/:*?"<>|]/g, ' ').trim() + ' ' + stamp;
    if (kind === 'comax') {
      const ws = X.utils.aoa_to_sheet([['מספר שורה', 'ברקוד', 'שם פריט', 'כמות', '', '', 'מחיר קניה']].concat(R.filter((x) => x.known).map((x, i) => [nm(i + 1), txt(x.barcode), x.name || '', nm(x.qty), '', '', ''])));
      ws['!cols'] = [{ wch: 9 }, { wch: 16 }, { wch: 34 }, { wch: 9 }, { wch: 4 }, { wch: 4 }, { wch: 10 }];
      X.utils.book_append_sheet(wb, ws, 'הזמנה');
      X.writeFile(wb, base + ' - לקומקס.xlsx');
    } else if (kind === 'sup') {
      const ws = X.utils.aoa_to_sheet([hd(['#', 'שם פריט', 'ברקוד', 'כמות', 'פריט חדש — מחיר מוסכם', 'מע"מ'])].concat(R.map((x, i) => [nm(i + 1), x.known ? x.name || '' : x.new_name || '', txt(x.barcode), nm(x.qty), x.known ? '' : nm(x.price), x.known ? '' : vatTxt(x.price_vat)])));
      ws['!cols'] = [{ wch: 5 }, { wch: 36 }, { wch: 16 }, { wch: 8 }, { wch: 20 }, { wch: 11 }]; ws['!views'] = [{ RTL: true }];
      X.utils.book_append_sheet(wb, ws, 'הזמנה');
      X.writeFile(wb, base + '.xlsx');
    } else {
      const s1 = X.utils.aoa_to_sheet([hd(['ברקוד', 'שם', 'כמות', 'שורות', 'מי הוסיף', 'הערות'])].concat(R.filter((x) => x.known).map((x) => [txt(x.barcode), x.name || '', nm(x.qty), nm(x.lines), x.people || '', x.notes || ''])));
      s1['!cols'] = [{ wch: 16 }, { wch: 34 }, { wch: 9 }, { wch: 7 }, { wch: 18 }, { wch: 24 }]; s1['!views'] = [{ RTL: true }];
      X.utils.book_append_sheet(wb, s1, 'סיכום');
      const s2 = X.utils.aoa_to_sheet([hd(['ברקוד', 'שם המוצר', 'כמות', 'מחיר מוסכם', 'מע"מ', 'מי הוסיף'])].concat(R.filter((x) => !x.known).map((x) => [txt(x.barcode), x.new_name || '', nm(x.qty), nm(x.price), vatTxt(x.price_vat), x.people || ''])));
      s2['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 9 }, { wch: 12 }, { wch: 11 }, { wch: 18 }]; s2['!views'] = [{ RTL: true }];
      X.utils.book_append_sheet(wb, s2, 'פריטים חדשים');
      const all = await api('poLines', { orderId: d.id });
      if (all.ok) {
        const s3 = X.utils.aoa_to_sheet([hd(['תאריך ושעה', 'ברקוד', 'שם', 'כמות', 'מי הוסיף', 'הערה'])].concat(all.lines.slice().reverse().map((x) => [when(x.at), txt(x.barcode), x.known ? x.name : '🆕 ' + (x.new_name || ''), nm(x.qty), x.by_name || '', x.note || ''])));
        s3['!cols'] = [{ wch: 17 }, { wch: 16 }, { wch: 34 }, { wch: 8 }, { wch: 18 }, { wch: 24 }]; s3['!views'] = [{ RTL: true }];
        X.utils.book_append_sheet(wb, s3, 'כל השורות');
      }
      X.writeFile(wb, base + ' - דוח מלא.xlsx');
    }
    api('poSum', { orderId: d.id, markExported: true });
  }

  /* ================= the menu items ================= */
  function start() {
    const drop = $('menuOpsDrop') || $('menuSchedDrop');
    if (drop && !$('poMgrBtn')) {
      const after = $('rcvMgrBtn') || $('invMgrBtn'), html = '<button id="poMgrBtn">📝 הזמנות</button>';
      if (after) after.insertAdjacentHTML('beforebegin', html); else drop.insertAdjacentHTML('beforeend', html);
      $('poMgrBtn').addEventListener('click', open);
    }
    empItem();
  }
  function empItem() {
    const d = $('emSchedDrop');
    if (!d || $('poEmpBtn')) return;
    const after = $('rcvEmpBtn') || $('invEmpBtn'), html = '<button type="button" id="poEmpBtn" role="menuitem">📝 הזמנות</button>';
    if (after) after.insertAdjacentHTML('beforebegin', html); else d.insertAdjacentHTML('beforeend', html);
    $('poEmpBtn').addEventListener('click', open);
  }
  new MutationObserver(() => { if (!$('poEmpBtn') && $('emSchedDrop')) empItem(); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openPo = open;
})();
