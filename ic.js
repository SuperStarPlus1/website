// 🧾 קליטת חשבונית (24/11/2026, the owner): "rebuild the invoice intake — instead of uploading from the computer, a scan
// with the phone's camera". Only people given the permission — managers and employees (the owner); the admin always,
// and the admin gives it here (👥 הרשאות). The menu item shows only to them (💼 ▸ תפעול / 📅 ▸ 🧾 קליטת חשבונית).
//   the list      ➕ a new invoice; the drafts; done (30 days); 🗄 older / the archive
//   the invoice   📷 a photo per page (the phone's camera; or 🖼 the gallery / a PDF) → kept + read by the server (the old
//                 comax-invoice-ocr reading, page by page) → the rows are added. The header (supplier, number, date,
//                 the stated totals) is filled from the reading and can be fixed. The old app's safety nets:
//                 EAN check digit · a short code expanded to the catalog's full barcode · the lines vs the stated subtotal
//                 (and "the lines include VAT" — ticked by itself once) · qty ↔ price swapped (one button) · promo rows
//                 ("*" or + מבצע) · a cost above the sale price · and the Comax cost (a soft note when it differs a lot).
//                 Options: the price from the line total ÷ qty · the qty in packs (× the pack) · the price includes VAT.
//                 🆕 items not in Comax: red; the export waits for "✓ הוקמו בקומקס" (the old app's rule).
//                 📥 the goods receipt of this supplier: charged but not received / received but not charged / other qty.
//   the end       ✓ סיום ← ⬇ the Comax file ("SAP מערכת": serial / barcode / name / qty / blank / blank / price before VAT).
// Server: api ic* (invoice-intake.ts; migration 20261124120000_invoice_intake.sql). Comax is never written to.
// Uses the app's globals: apiPost, anyAuth/mgrAuth, state, toast; the .iv-* / .gr-* styles (inv-count.js, rcv.js).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const signedIn = () => !!(appState() && (appState().mgr || appState().emp));
  const mAuth = () => (typeof anyAuth === 'function' ? anyAuth() : typeof mgrAuth === 'function' ? mgrAuth() : {});
  const myName = () => { const s = appState(); return (s && (s.mgr ? s.mgr.name : s.emp && s.emp.name)) || ''; };
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); };
  const api = (action, extra) => apiPost({ action, ...mAuth(), ...(extra || {}) }).catch(() => ({ ok: false, net: true, error: 'אין חיבור לשרת' }));
  const fmt = (v) => (v == null || v === '' || !isFinite(v) ? '—' : Number(v).toLocaleString('he-IL', { maximumFractionDigits: 2 }));
  const money = (v) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₪');
  const dm = (s) => (s ? String(new Date(s).getDate()).padStart(2, '0') + '/' + String(new Date(s).getMonth() + 1).padStart(2, '0') : '');
  const hm = (s) => { const d = new Date(s); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const when = (s) => (s ? dm(s) + '/' + new Date(s).getFullYear() + ' ' + hm(s) : '');
  const XS_URL = '/vendor/xlsx-js-style-1.2.0.min.js';
  const rid = () => Math.random().toString(36).slice(2, 10);

  // ---- the old app's arithmetic (סריקת חשבוניות/src/App.jsx) ----
  const toNum = (s) => {
    if (s == null) return NaN;
    let t = String(s).replace(/[^\d.,\-]/g, '');
    if (t.includes(',') && t.includes('.')) t = t.replace(/,/g, '');
    else if (t.includes(',')) { const a = t.split(',').pop(); t = a.length === 3 ? t.replace(/,/g, '') : t.replace(/,/g, '.'); }
    return parseFloat(t);
  };
  const eanStatus = (raw) => {
    const code = String(raw || '').replace(/\D/g, '');
    if (code.length !== 8 && code.length !== 13) return 'check';
    const d = code.split('').map(Number), c = d.pop(); let s = 0;
    d.reverse().forEach((x, i) => { s += x * (i % 2 === 0 ? 3 : 1); });
    return (10 - (s % 10)) % 10 === c ? 'valid' : 'invalid';
  };
  const effQty = (r, o) => { const q = toNum(r.qty); if (!isFinite(q)) return NaN; const p = o.packMode ? (toNum(r.pack) || 1) : 1; return Math.round(q * p * 1000) / 1000; };
  const unitBase = (r, o) => { if (o.priceFromTotal) { const t = toNum(r.total), u = effQty(r, o); if (isFinite(t) && u) return t / u; } return toNum(r.price); };
  const unitOut = (r, o) => { const b = unitBase(r, o); if (!isFinite(b)) return NaN; const v = o.vatIncluded ? b / (1 + (o.vatRate || 18) / 100) : b; return Math.round(v * 100) / 100; };
  const isInt = (v) => { const n = toNum(v); return isFinite(n) && Math.abs(n - Math.round(n)) < 0.005; };

  let view = 'list', D = null, rows = [], opts = {}, links = [], receipts = [], received = null, saveT = null, busy = false, ACC = null, vatAuto = false, rFilter = 'all';

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#icOv{position:fixed;inset:0;z-index:9000;background:#eef2f7;overflow:auto;direction:rtl;font-family:inherit;color:#0f172a}#icOv.hidden{display:none}' +
    '.ic-f{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ic-f label{font-size:12px;font-weight:800;color:#64748b;display:block}.ic-f .iv-in{font-size:15px;padding:9px 10px}' +
    '.ic-ban{border-radius:14px;padding:10px 12px;margin-bottom:8px;font-size:13.5px;font-weight:700;line-height:1.5}' +
    '.ic-ban.r{background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca}.ic-ban.o{background:#fff7ed;color:#9a3412;border:1.5px solid #fed7aa}' +
    '.ic-ban.g{background:#f0fdf4;color:#166534;border:1.5px solid #bbf7d0}.ic-ban.b{background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe}' +
    '.ic-row{background:#fff;border-radius:14px;padding:10px;margin-bottom:8px;border:1.5px solid #e2e8f0}.ic-row.nw{border-color:#ef4444;background:#fef2f2}' +
    '.ic-row .g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px}.ic-row .g.p4{grid-template-columns:1fr 1fr 1fr 1fr}' +
    '.ic-row input{border:1.5px solid #e2e8f0;border-radius:9px;padding:7px 8px;font:inherit;font-size:14px;width:100%;box-sizing:border-box;min-width:0}' +
    '.ic-row input.bc{direction:ltr;text-align:right;font-weight:800}.ic-row small{font-size:11px;color:#64748b;font-weight:700}' +
    '.ic-row .tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.ic-row .tags span{border-radius:99px;padding:2px 8px;font-size:11.5px;font-weight:800}' +
    '.ic-row .top{display:flex;gap:6px;align-items:center}.ic-row .top button{border:0;background:#f1f5f9;border-radius:9px;padding:6px 9px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:#334155;white-space:nowrap}' +
    '.ic-row .top button.on{background:#f59e0b;color:#fff}' +
    '.ic-pages{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}.ic-pages a{flex:none;width:64px;height:84px;border-radius:10px;overflow:hidden;border:1.5px solid #e2e8f0;background:#f8fafc;display:grid;place-items:center;font-size:22px;text-decoration:none}' +
    '.ic-pages img{width:100%;height:100%;object-fit:cover}' +
    '.ic-dt{display:flex;gap:8px;margin:0 0 10px}.ic-dt button{flex:1;padding:10px 8px;border-radius:12px;border:2px solid #e2e8f0;background:#fff;font:inherit;font-size:14.5px;font-weight:800;color:#475569;cursor:pointer}' +
    '.ic-dt button.on{border-color:#4f46e5;background:#eef2ff;color:#3730a3}.ic-dt button:disabled{cursor:default}' +
    '.ic-opt{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;margin-top:6px;cursor:pointer}.ic-opt input{width:20px;height:20px;accent-color:#4f46e5}' +
    '.ic-acc{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid #f1f5f9;font-size:14.5px;font-weight:700}.ic-acc input{width:22px;height:22px;accent-color:#16a34a}' +
    '</style>');

  /* ================= the shell ================= */
  function open() {
    if (!signedIn()) return;
    if (!$('icOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="icOv" class="hidden"><div class="iv-top"><button id="icBack" hidden>→</button><h2 id="icTitle">🧾 קליטת חשבונית</h2><span class="sp"></span>' +
        '<button id="icX">✕ סגירה</button></div><div class="iv-body" id="icBody"></div></div>');
      $('icX').addEventListener('click', close);
      $('icBack').addEventListener('click', () => { flushSave(); showList(); });
    }
    $('icOv').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    showList();
  }
  function close() { flushSave(); $('icOv').classList.add('hidden'); document.body.style.overflow = ''; }
  function head(t, back) { $('icTitle').textContent = t; $('icBack').hidden = !back; }

  /* ================= the list ================= */
  async function showList(old) {
    view = 'list'; D = null; head(old ? '🗄 חשבוניות ישנות וארכיון' : '🧾 קליטת חשבונית', !!old);
    $('icBody').ondragover = null; $('icBody').ondrop = null;   // a dropped file belongs to an open invoice only
    $('icBody').innerHTML = '<div class="iv-mut" style="text-align:center;padding:30px">טוען…</div>';
    const r = await api('icList', old ? { old: true } : {});
    if (view !== 'list') return;
    if (!r.ok) { $('icBody').innerHTML = '<div class="iv-card">' + e(r.error) + '</div>'; return; }
    const drafts = r.docs.filter((d) => d.status === 'draft'), done = r.docs.filter((d) => d.status !== 'draft');
    let h = '';
    if (!old) h += '<div class="iv-card" style="background:linear-gradient(135deg,#eff6ff,#f5f3ff)"><h3>➕ חשבונית חדשה</h3><div class="iv-mut">מצלמים כל עמוד בטלפון — ישר, באור טוב, כל הדף בתמונה. המערכת קוראת את הספק, המספר, התאריך והשורות; בודקים, מתקנים ומייצאים לקומקס.</div>' +
      '<div class="iv-acts"><button class="iv-btn iv-pri" id="icNew" style="flex:1">📷 חשבונית חדשה</button>' + (r.admin ? '<button class="iv-btn" id="icAcc">👥 הרשאות</button>' : '') + '</div></div>';
    if (drafts.length) h += '<div class="iv-h">✎ בעבודה</div>' + drafts.map(card).join('');
    if (done.length) h += '<div class="iv-h">' + (old ? 'ישנות וארכיון' : '✓ הסתיימו (30 יום)') + '</div>' + done.map(card).join('');
    if (!r.docs.length) h += '<div class="iv-mut" style="text-align:center;padding:20px">' + (old ? 'אין חשבוניות ישנות.' : 'עוד אין חשבוניות.') + '</div>';
    if (!old) h += '<div class="iv-acts" style="justify-content:center;margin-top:16px"><button class="iv-btn" id="icOld">🗄 חשבוניות ישנות וארכיון</button></div>';
    $('icBody').innerHTML = h;
    if ($('icOld')) $('icOld').onclick = () => showList(true);
    if ($('icAcc')) $('icAcc').onclick = showAccess;
    if ($('icNew')) $('icNew').onclick = async () => {
      const x = await api('icNew', {}); if (!x.ok) return say(x.error, 'err');
      showDoc(x.doc.id, true);
    };
    $('icBody').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => showDoc(Number(b.dataset.go))));
    $('icBody').querySelectorAll('[data-arc]').forEach((b) => b.addEventListener('click', async () => {
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'בטוח? לחצו שוב'; return; }
      const x = await api('icArchive', { docId: Number(b.dataset.arc), back: b.dataset.back === '1' }); if (!x.ok) say(x.error, 'err'); showList(old);
    }));
    function card(d) {
      return '<div class="iv-card"><h3>' + (d.doc_type === 'delivery' ? '📄 ' : '🧾 ') + e(d.supplier_name || d.ai_supplier || 'מסמך #' + d.id) + ' · ' + (d.doc_type === 'delivery' ? 'ת.מ.' : 'חשבונית') + (d.invoice_no ? ' ' + e(d.invoice_no) : '') +
        (d.status === 'draft' ? '<span class="iv-badge" style="background:#fef3c7;color:#92400e">בעבודה</span>' : '<span class="iv-badge" style="background:#dcfce7;color:#166534">הסתיימה</span>') +
        (d.exported_at ? '<span class="iv-badge" style="background:#eef2ff;color:#4338ca">יוצאה ' + dm(d.exported_at) + '</span>' : '') + (d.archived ? '<span class="iv-badge" style="background:#f1f5f9;color:#64748b">🗄 ארכיון</span>' : '') + '</h3>' +
        '<div class="iv-mut">👤 ' + e(d.created_by || '') + ' · ' + when(d.created_at) + (d.invoice_date ? ' · תאריך ' + e(d.invoice_date) : '') + '</div>' +
        '<div class="iv-pills"><span>' + d.pageCount + ' עמודים</span><span>' + d.lines + ' שורות</span>' + (d.total != null ? '<span>' + money(d.total) + '</span>' : '') + (d.receipt_id ? '<span>📥 מול קבלה</span>' : '') + '</div>' +
        '<div class="iv-acts"><button class="iv-btn ' + (d.status === 'draft' ? 'iv-pri' : '') + '" data-go="' + d.id + '">' + (d.status === 'draft' ? '▶ להמשיך' : '📄 פתיחה') + '</button>' +
        (r.admin ? '<button class="iv-btn" data-arc="' + d.id + '" data-back="' + (d.archived ? '1' : '0') + '" style="margin-inline-start:auto;color:#64748b">' + (d.archived ? '↩ החזרה מהארכיון' : '🗄 לארכיון') + '</button>' : '') + '</div></div>';
    }
  }

  /* ================= 👥 who may (the admin) ================= */
  async function showAccess() {
    view = 'acc'; head('👥 הרשאות לקליטת חשבוניות', true);
    $('icBody').innerHTML = '<div class="iv-mut" style="text-align:center;padding:30px">טוען…</div>';
    const r = await api('icAccess');
    if (!r.ok || !r.people) { $('icBody').innerHTML = '<div class="iv-card">' + e(r.error || 'לאדמין בלבד') + '</div>'; return; }
    const sec = (k, t) => '<div class="iv-h">' + t + '</div><div class="iv-card" style="padding:4px 14px">' + r.people.filter((p) => p.kind === k).map((p) =>
      '<label class="ic-acc"><input type="checkbox" data-k="' + k + '" data-n="' + e(p.name) + '"' + (p.on || p.admin ? ' checked' : '') + (p.admin ? ' disabled' : '') + '>' + e(p.name) + (p.admin ? ' <small class="iv-mut">(אדמין — תמיד)</small>' : '') + '</label>').join('') + '</div>';
    $('icBody').innerHTML = '<div class="iv-mut" style="margin:0 4px 6px">מסמנים מי יכול לצלם ולקלוט חשבוניות. מי שמסומן רואה בתפריט "🧾 קליטת חשבונית" (אחרי כניסה מחדש).</div>' +
      '<input class="iv-in" id="icAccQ" style="font-size:14px" placeholder="🔎 חיפוש שם">' + sec('mgr', '👔 מנהלים') + sec('emp', '👷 עובדים');
    $('icAccQ').addEventListener('input', () => { const q = $('icAccQ').value.trim(); $('icBody').querySelectorAll('.ic-acc').forEach((l) => { l.style.display = !q || l.textContent.includes(q) ? '' : 'none'; }); });
    $('icBody').querySelectorAll('input[data-k]').forEach((c) => c.addEventListener('change', async () => {
      const x = await api('icAccessSet', { kind: c.dataset.k, name: c.dataset.n, on: c.checked });
      if (!x.ok) { c.checked = !c.checked; return say(x.error, 'err'); }
      say(c.checked ? '✓ ' + c.dataset.n + ' קיבל/ה הרשאה' : 'ההרשאה של ' + c.dataset.n + ' הוסרה');
    }));
  }

  /* ================= the invoice ================= */
  async function showDoc(id, fresh) {
    view = 'doc'; vatAuto = false; rFilter = 'all'; head('🧾 חשבונית', true);
    $('icBody').innerHTML = '<div class="iv-mut" style="text-align:center;padding:30px">טוען…</div>';
    const r = await api('icGet', { docId: id });
    if (view !== 'doc') return;
    if (!r.ok) { $('icBody').innerHTML = '<div class="iv-card">' + e(r.error) + '</div>'; return; }
    D = r.doc; rows = D.rows || []; opts = Object.assign({ vatRate: 18 }, D.opts || {}); links = r.links || []; receipts = r.receipts || []; received = r.received; D.mgr = r.mgr; D.equiv = r.equiv || [];
    vatAuto = !!(D.opts && 'vatIncluded' in D.opts);
    draw();
    if (fresh && !links.length) setTimeout(() => $('icShot') && $('icShot').click(), 50);
  }
  const ro = () => D && D.status !== 'draft';
  // 25/11 (the owner): the scanned paper is an invoice or a delivery note — the reading guesses, the person decides
  const isDel = () => D && D.doc_type === 'delivery', tname = () => (isDel() ? 'תעודת משלוח' : 'חשבונית'), tno = () => (isDel() ? 'מספר תעודה' : 'מספר חשבונית');
  function draw() {
    head((isDel() ? '📄 ' : '🧾 ') + (D.supplier_name || D.ai_supplier || tname() + ' #' + D.id), true);
    const st = stats();
    let h = '';
    // pages
    h += '<div class="iv-card"><h3>📄 עמודים (' + links.length + ')</h3><div class="ic-pages">' + links.map((u, i) => u ? '<a href="' + e(u) + '" target="_blank" rel="noopener"><img src="' + e(u) + '" alt="עמוד ' + (i + 1) + '" onerror="this.replaceWith(\'📄\')"></a>' : '<a>📄</a>').join('') + '</div>' +
      (ro() ? '' : '<div class="iv-acts"><button class="iv-btn iv-pri" id="icShot" style="flex:1">📷 צילום עמוד' + (links.length ? ' נוסף' : '') + '</button><button class="iv-btn" id="icGal">📎 קובץ PDF / תמונה</button></div>' +
        '<div class="iv-mut" id="icProg" style="margin-top:6px">' + (links.length ? 'עמוד נוסף? מצלמים אותו — השורות שלו מתווספות.' : 'מצלמים את העמוד הראשון (דף שלם, ישר, באור טוב), או מעלים קובץ סרוק — PDF של כמה עמודים מתפצל לבד.') +
        (window.matchMedia && matchMedia('(pointer:fine)').matches ? ' במחשב אפשר גם לגרור את הקובץ לכאן.' : '') + '</div>') + '</div>';
    // header
    h += '<div class="iv-card"><h3>פרטי המסמך</h3>' +
      '<div class="ic-dt" id="icDt">' + [['invoice', '🧾 חשבונית'], ['delivery', '📄 תעודת משלוח']].map(([t, l]) => '<button type="button" data-t="' + t + '"' + ((D.doc_type || 'invoice') === t ? ' class="on"' : '') + (ro() ? ' disabled' : '') + '>' + l + '</button>').join('') + '</div>' +
      (ro() ? '' : '<div class="iv-acts" style="margin:0 0 6px"><button class="iv-btn" id="icSupBtn" style="font-size:13px">' + (D.supplier ? '🔄 החלפת ספק' : '🔎 בחירת הספק מקומקס') + '</button>' + (D.supplier ? '<span class="iv-mut" style="align-self:center">✓ מקושר לספק בקומקס</span>' : '<span class="iv-mut" style="align-self:center;color:#c2410c">הספק לא מקושר לקומקס — בחרו אותו כדי לראות את קבלות הסחורה</span>') + '</div><div id="icSupBox"></div>') + '<div class="ic-f">' +
      fld('ספק', 'supplier_name', D.supplier_name) + fld(tno(), 'invoice_no', D.invoice_no) + fld('תאריך', 'invoice_date', D.invoice_date) + fld('סה"כ נטו (חייב מע"מ)', 'subtotal', D.subtotal, 1) +
      fld('מע"מ', 'vat', D.vat, 1) + fld('סה"כ לתשלום', 'total', D.total, 1) + '</div>' +
      (D.ai_supplier && D.ai_supplier !== D.supplier_name ? '<div class="iv-mut" style="margin-top:6px">נקרא מהחשבונית: ' + e(D.ai_supplier) + (D.supplier ? '' : ' — לא נמצא ספק תואם בקומקס, אפשר לתקן את השם') + '</div>' : '') +
      '<label class="ic-opt"><input type="checkbox" id="icO1"' + (opts.priceFromTotal ? ' checked' : '') + (ro() ? ' disabled' : '') + '>מחיר ליחידה = סה"כ שורה ÷ כמות (מנטרל הנחות שורה)</label>' +
      '<label class="ic-opt"><input type="checkbox" id="icO2"' + (opts.packMode ? ' checked' : '') + (ro() ? ' disabled' : '') + '>הכמות במארזים (כמות × יחידות במארז)</label>' +
      '<label class="ic-opt"><input type="checkbox" id="icO3"' + (opts.vatIncluded ? ' checked' : '') + (ro() ? ' disabled' : '') + '>המחירים כוללים מע"מ (הייצוא יוריד מע"מ ' + (opts.vatRate || 18) + '%)</label></div>';
    // checks
    h += '<div id="icBans">' + bans(st) + '</div>';
    // receipt
    h += '<div class="iv-card"><h3>📥 מול קבלת הסחורה</h3>' + (receipts.length ? '<select class="iv-in" id="icRcv" style="font-size:14.5px"' + (ro() ? ' disabled' : '') + '><option value="">— בלי השוואה —</option>' +
      receipts.map((x) => '<option value="' + x.id + '"' + (Number(D.receipt_id) === x.id ? ' selected' : '') + '>קבלה ' + when(x.opened_at) + (x.doc_no ? (x.doc_type === 'invoice' ? ' · חשבונית ' : ' · ת.מ. ') + e(x.doc_no) : '') + (x.opened_by ? ' · ' + e(x.opened_by) : '') + (x.status === 'open' ? ' (פתוחה)' : '') + '</option>').join('') + '</select>'
      : '<div class="iv-mut">אין קבלות סחורה של הספק הזה מ-21 הימים האחרונים' + (D.supplier ? '' : ' (או שהספק לא זוהה בקומקס)') + '.</div>') + '<div id="icCmp"></div></div>';
    // rows
    h += '<div class="iv-card"><h3>שורות (' + rows.length + ')</h3><div class="iv-chips" id="icChips"></div><div id="icRows"></div>' + (ro() ? '' : '<div class="iv-acts"><button class="iv-btn" id="icAdd">+ שורה</button></div>') + '</div>';
    // the end
    h += '<div class="iv-card" id="icEnd"></div>';
    $('icBody').innerHTML = h;
    if (!ro()) {
      $('icShot').onclick = () => pick(true);
      $('icGal').onclick = () => pick(false);
      // a file dragged onto the invoice (on a computer)
      const zone = $('icBody');
      zone.ondragover = (ev) => { ev.preventDefault(); };
      zone.ondrop = (ev) => { ev.preventDefault(); const fs = [...((ev.dataTransfer && ev.dataTransfer.files) || [])].filter((f) => isPdf(f) || /^image\//.test(f.type)); if (fs.length) send(fs); else say('גררו קובץ PDF או תמונה', 'err'); };
      $('icAdd').onclick = () => { rows.push({ id: rid(), barcode: '', name: '', qty: '', price: '', total: '', pack: '1', promo: false, known: false }); drawRows(); queue(); };
      $('icBody').querySelectorAll('[data-f]').forEach((i) => i.addEventListener('input', () => { D[i.dataset.f] = i.value; if (i.dataset.f === 'supplier_name') D.supplier = null; queue(true); refresh(); }));
      [['icO1', 'priceFromTotal'], ['icO2', 'packMode'], ['icO3', 'vatIncluded']].forEach(([id, k]) => $(id).addEventListener('change', () => { opts[k] = $(id).checked; if (k === 'vatIncluded') vatAuto = true; queue(); refresh(); drawRows(); }));
    }
    if ($('icSupBtn')) $('icSupBtn').onclick = supPick;
    if (!ro()) $('icDt').querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', async () => {
      if ((D.doc_type || 'invoice') === b.dataset.t) return;
      D.doc_type = b.dataset.t; draw();
      const x = await api('icSave', { docId: D.id, doc_type: D.doc_type }); if (!x.ok) say(x.error, 'err');
    }));
    if ($('icRcv')) $('icRcv').onchange = async () => { D.receipt_id = Number($('icRcv').value) || null; await api('icSave', { docId: D.id, receiptId: D.receipt_id }); showDoc(D.id); };
    drawRows(); drawCmp(); drawEnd();
  }
  const fld = (l, k, v, n) => '<div><label>' + l + '</label><input class="iv-in" data-f="' + k + '"' + (n ? ' inputmode="decimal"' : '') + ' value="' + e(v == null ? '' : v) + '"' + (ro() ? ' disabled' : '') + (!v && v !== 0 && ['supplier_name', 'invoice_no', 'invoice_date'].includes(k) ? ' style="border-color:#f59e0b;background:#fffbeb"' : '') + '></div>';

  /* ---- the checks (the old app's) ---- */
  function stats() {
    const o = opts, R = rows;
    const lineSum = R.reduce((s, r) => { const n = toNum(r.total); return s + (isFinite(n) ? n : 0); }, 0);
    const sub = toNum(D.subtotal), vat = toNum(D.vat);
    const diff = isFinite(sub) ? Math.round((lineSum - sub) * 100) / 100 : null;
    const mismatch = isFinite(sub) && sub > 0 && Math.abs(diff) > 1;
    const vatInLines = mismatch && isFinite(vat) && vat > 0 && Math.abs(Math.abs(diff) - vat) < 1;
    const qp = R.filter((r) => r.qty !== '' && r.price !== '');
    const swapLook = qp.filter((r) => !isInt(r.qty) && isInt(r.price)).length, normLook = qp.filter((r) => isInt(r.qty) && !isInt(r.price)).length;
    return {
      lineSum, sub, diff, mismatch, vatInLines,
      swap: qp.length >= 5 && swapLook >= qp.length * 0.7 && swapLook > normLook,
      invalid: R.filter((r) => eanStatus(r.barcode) === 'invalid').length,
      nw: R.filter((r) => !r.known).length,
      promo: R.filter((r) => r.promo || String(r.name || '').trim().startsWith('*')).length,
      missing: R.filter((r) => !isFinite(effQty(r, o)) || !isFinite(unitOut(r, o))).length,
      over: R.filter(overSale).length,
      costDiff: R.filter(costOff).length,
      short: R.filter((r) => r.suffix).length,
    };
  }
  const overSale = (r) => r.known && r.salePrice > 0 && isFinite(unitOut(r, opts)) && unitOut(r, opts) > r.salePrice;
  // the Comax cost (before VAT): a soft note when the invoice's unit price is more than 20% away from it
  const costOff = (r) => { const u = unitOut(r, opts); return r.known && r.cost > 0 && isFinite(u) && u > 0 && Math.abs(u - r.cost) / r.cost > 0.2; };
  function bans(s) {
    if (!rows.length) return '';
    if (s.vatInLines && !opts.vatIncluded && !vatAuto) { opts.vatIncluded = true; vatAuto = true; queue(); setTimeout(() => { if ($('icO3')) $('icO3').checked = true; drawRows(); }, 0); }
    let h = '';
    if (isFinite(s.sub) && s.sub > 0) h += s.mismatch
      ? (s.vatInLines ? '<div class="ic-ban b">ℹ סכום השורות (' + money(s.lineSum) + ') שווה לסה"כ כולל מע"מ — המחירים בשורות כוללים מע"מ. סימנתי "המחירים כוללים מע"מ".</div>'
        : '<div class="ic-ban ' + (s.promo ? 'o' : 'r') + '">' + (s.promo ? '⚠ ' : '❌ ') + 'סכום השורות ' + money(s.lineSum) + ' ≠ סה"כ נטו בחשבונית ' + money(s.sub) + ' (הפרש ' + money(s.diff) + ').' +
          (s.promo ? ' יש ' + s.promo + ' פריטים במבצע — שם המחיר בשורה הוא המחיר המלא, כך שפער כזה צפוי.' : ' כנראה שורה חסרה או שנקראה לא נכון — השוו לתמונה.') + '</div>')
      : '<div class="ic-ban g">✓ סכום השורות (' + money(s.lineSum) + ') תואם לסה"כ נטו בחשבונית.</div>';
    else h += '<div class="ic-ban o">⚠ לא נקרא סה"כ נטו מהחשבונית — אין הצלבה. אפשר להקליד אותו בפרטי החשבונית.</div>';
    if (s.swap) h += '<div class="ic-ban o">⚠ נראה שהכמות והמחיר התחלפו (כמויות עם שברים, מחירים עגולים). <button class="iv-btn" id="icSwap" style="margin-top:6px">⇄ החלפת כמות ↔ מחיר בכל השורות</button></div>';
    if (s.invalid) h += '<div class="ic-ban r">❌ ' + s.invalid + ' ברקודים עם ספרת ביקורת שגויה — כנראה נקראו לא נכון. סמנתי אותם באדום.</div>';
    if (s.short) h += '<div class="ic-ban b">ℹ ' + s.short + ' קודים קצרים הושלמו לברקוד המלא מהקטלוג.</div>';
    if (s.over) h += '<div class="ic-ban o">⚠ ' + s.over + ' שורות שמחיר הקנייה בהן גבוה ממחיר המכירה בקומקס — כנראה מחיר של שורה אחרת.</div>';
    if (s.costDiff) h += '<div class="ic-ban b">ℹ ' + s.costDiff + ' שורות שהמחיר בהן שונה ביותר מ-20% מהעלות בקומקס — לבדיקה (שינוי מחיר / מבצע / מארז).</div>';
    if (s.missing) h += '<div class="ic-ban o">⚠ ' + s.missing + ' שורות בלי כמות או מחיר.</div>';
    if (s.nw) h += '<div class="ic-ban r">⛔ ' + s.nw + ' פריטים לא קיימים בקומקס — צריך להקים אותם לפני הייצוא (מסומנים באדום).</div>';
    return h;
  }
  function refresh() { const b = $('icBans'); if (b) { b.innerHTML = bans(stats()); if ($('icSwap')) $('icSwap').onclick = () => { rows.forEach((r) => { const q = r.qty; r.qty = r.price; r.price = q; }); queue(); refresh(); drawRows(); }; } drawCmp(); drawEnd(); }

  /* ---- the rows ---- */
  function drawRows() {
    const box = $('icRows'); if (!box) return;
    const s = stats(), o = opts;
    $('icChips').innerHTML = [['all', 'הכול (' + rows.length + ')'], ['bad', '⚠ לבדיקה'], ['nw', '⛔ לא בקומקס (' + s.nw + ')'], ['promo', 'מבצע (' + s.promo + ')']].map(([k, t]) => '<button data-r="' + k + '"' + (rFilter === k ? ' class="on"' : '') + '>' + t + '</button>').join('');
    $('icChips').querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { rFilter = b.dataset.r; drawRows(); });
    const flagged = (r) => eanStatus(r.barcode) === 'invalid' || overSale(r) || costOff(r) || !isFinite(effQty(r, o)) || !isFinite(unitOut(r, o));
    const show = rows.filter((r) => rFilter === 'all' || (rFilter === 'nw' && !r.known) || (rFilter === 'promo' && (r.promo || String(r.name).trim().startsWith('*'))) || (rFilter === 'bad' && flagged(r)));
    const dis = ro() ? ' disabled' : '';
    box.innerHTML = show.map((r) => {
      const st = eanStatus(r.barcode), u = unitOut(r, o), q = effQty(r, o), promo = r.promo || String(r.name).trim().startsWith('*');
      const tags = [];
      if (!r.known) tags.push(['⛔ לא בקומקס', '#fee2e2', '#991b1b']);
      if (st === 'invalid') tags.push(['❌ ברקוד לא תקין', '#fee2e2', '#991b1b']);
      if (r.suffix) tags.push(['הושלם מ-' + r.suffix + ' ספרות', '#e0f2fe', '#075985']);
      if (r.altOf) tags.push(['🔗 ברקוד נוסף ' + r.altOf + ' ← הראשי', '#e0f2fe', '#075985']);
      if (promo) tags.push(['מבצע', '#fef3c7', '#92400e']);
      if (overSale(r)) tags.push(['מעל מחיר המכירה ' + money(r.salePrice), '#ffedd5', '#9a3412']);
      if (costOff(r)) tags.push(['עלות בקומקס ' + money(r.cost), '#e0e7ff', '#3730a3']);
      if (r.archivedItem) tags.push(['בארכיון בקומקס', '#f1f5f9', '#475569']);
      return '<div class="ic-row' + (r.known ? '' : ' nw') + '" data-id="' + e(r.id) + '"><div class="top"><input class="bc" data-k="barcode" value="' + e(r.barcode) + '" inputmode="numeric" placeholder="ברקוד"' + dis + '>' +
        (ro() ? '' : '<button data-promo' + (r.promo ? ' class="on"' : '') + '>מבצע</button><button data-del>✕</button>') + '</div>' +
        '<input data-k="name" value="' + e(r.known && r.catName ? r.catName : r.name) + '" placeholder="שם" style="margin-top:6px"' + dis + (r.known && r.catName ? ' title="השם מהקטלוג"' : '') + '>' +
        '<div class="g' + (o.packMode ? ' p4' : '') + '"><div><small>כמות</small><input data-k="qty" value="' + e(r.qty) + '" inputmode="decimal"' + dis + '></div>' + (o.packMode ? '<div><small>במארז</small><input data-k="pack" value="' + e(r.pack) + '" inputmode="numeric"' + dis + '></div>' : '') +
        '<div><small>מחיר ליח׳</small><input data-k="price" value="' + e(r.price) + '" inputmode="decimal"' + dis + '></div><div><small>סה"כ שורה</small><input data-k="total" value="' + e(r.total) + '" inputmode="decimal"' + dis + '></div></div>' +
        '<div class="tags"><span style="background:#f1f5f9;color:#0f172a">לקומקס: ' + fmt(q) + ' × ' + money(u) + '</span>' + tags.map((t) => '<span style="background:' + t[1] + ';color:' + t[2] + '">' + t[0] + '</span>').join('') + '</div></div>';
    }).join('') || '<div class="iv-mut" style="padding:8px 0">' + (rows.length ? 'אין שורות בסינון הזה.' : 'עוד אין שורות — מצלמים עמוד.') + '</div>';
    if (ro()) return;
    box.querySelectorAll('.ic-row').forEach((el) => {
      const r = rows.find((x) => x.id === el.dataset.id); if (!r) return;
      el.querySelectorAll('input[data-k]').forEach((i) => i.addEventListener('input', () => {
        r[i.dataset.k] = i.value;
        if (i.dataset.k === 'name') r.catName = null;
        if (i.dataset.k === 'barcode') { r.known = false; r.suffix = 0; r.recheck = true; }
        queue(); refresh();
      }));
      el.querySelector('[data-promo]').onclick = () => { r.promo = !r.promo; queue(); refresh(); drawRows(); };
      el.querySelector('[data-del]').onclick = (ev) => { const b = ev.currentTarget; if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'למחוק?'; b.style.background = '#dc2626'; b.style.color = '#fff'; return; } rows = rows.filter((x) => x !== r); queue(); refresh(); drawRows(); };
    });
  }

  /* ---- 📥 the receipt: charged vs received ----
   * 24/11 (the owner): the Comax file is what was CHARGED (the invoice); the differences go out separately, to charge
   * the supplier. And "different barcodes for the same product" (milk 3% carton / the בד"ץ one; one supplier types one
   * code, another the other): a confirmed pair (🔗, ic_equiv) joins its barcodes into one product here — in this
   * comparison and in every later one. A charged-not-received line and a received-not-charged one with similar names
   * (or the same quantity) are offered as a pair to confirm. */
  const dg = (b) => String(b || '').replace(/\D/g, '');
  const words = (t) => new Set(String(t || '').replace(/["'״׳*.,()\-]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter((w) => w.length > 1));
  const like = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let n = 0; A.forEach((w) => { if (B.has(w)) n++; }); return n / Math.min(A.size, B.size); };
  function groups() {
    const par = {}, find = (x) => (par[x] === undefined || par[x] === x ? (par[x] = x) : (par[x] = find(par[x]))), join = (a, b) => { par[find(a)] = find(b); };
    (D.equiv || []).forEach((p) => join(p.a, p.b));
    const G = {};
    const g = (b) => { const k = find(b); return G[k] || (G[k] = { bcs: new Set(), iq: 0, rq: 0, money: 0, iname: '', rname: '' }); };
    rows.forEach((r) => { const b = dg(r.barcode); if (!b) return; const x = g(b), q = effQty(r, opts), u = unitOut(r, opts);
      x.bcs.add(b); if (isFinite(q)) { x.iq += q; if (isFinite(u)) x.money += q * u; } x.iname = x.iname || (r.catName || r.name); });
    (received || []).forEach((r) => { const b = dg(r.barcode); const x = g(b); x.bcs.add(b); x.rq += Number(r.qty) || 0; x.rname = x.rname || r.name; });
    return Object.values(G).map((x) => {
      const price = x.iq ? x.money / x.iq : null, k = x.iq && !x.rq ? 'ch' : x.rq && !x.iq ? 'rc' : Math.abs(x.iq - x.rq) > 0.001 ? 'df' : 'ok';
      return { ...x, bcs: [...x.bcs], linked: x.bcs.size > 1, price, k, name: x.iname || x.rname };
    });
  }
  function drawCmp() {
    const box = $('icCmp'); if (!box) return;
    if (!received) { box.innerHTML = ''; return; }
    const L = groups(), n = { ch: 0, rc: 0, df: 0, ok: 0 }; L.forEach((x) => n[x.k]++);
    const T = { ch: ['💸 חויב ולא התקבל', '#fef2f2', '#991b1b'], rc: ['📦 התקבל ולא חויב', '#f5f3ff', '#6d28d9'], df: ['⚠ כמות שונה', '#fff7ed', '#9a3412'], ok: ['✓', '#fff', '#166534'] };
    const bad = L.filter((x) => x.k !== 'ok'), claim = L.filter((x) => x.iq > x.rq + 0.001);
    const sumClaim = claim.reduce((t, x) => t + (x.price != null ? (x.iq - x.rq) * x.price : 0), 0);
    // 🔗 offers: a received-not-charged line ↔ a charged-not-received one (similar name, or the same quantity)
    const ch = L.filter((x) => x.k === 'ch'), rc = L.filter((x) => x.k === 'rc');
    const offer = (r) => ch.map((c) => ({ c, s: like(r.rname, c.iname) + (Math.abs(c.iq - r.rq) < 0.001 ? 0.35 : 0) })).sort((a, b) => b.s - a.s);
    const linked = L.filter((x) => x.linked);
    box.innerHTML = '<div class="iv-pills" style="margin-top:8px"><span style="background:#fef2f2;color:#991b1b">💸 ' + n.ch + ' חויבו ולא התקבלו</span><span style="background:#fff7ed;color:#9a3412">⚠ ' + n.df + ' כמות שונה</span><span style="background:#f5f3ff;color:#6d28d9">📦 ' + n.rc + ' התקבלו ולא חויבו</span><span style="background:#dcfce7;color:#166534">✓ ' + n.ok + ' תואמים</span></div>' +
      (bad.length ? '<div class="iv-wrap" style="max-height:340px;margin-top:6px"><table class="iv-tbl" style="min-width:0"><thead><tr><th>פריט</th><th class="n">חויב</th><th class="n">התקבל</th></tr></thead><tbody>' +
        bad.map((x) => '<tr style="background:' + T[x.k][1] + '"><td><b>' + e(x.name) + '</b><span class="bc">' + e(x.bcs.join(' = ')) + '</span><small style="color:' + T[x.k][2] + ';font-weight:800">' + T[x.k][0] + '</small>' +
          (x.k === 'rc' && ch.length && !ro() ? (() => { const o = offer(x); return '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><select class="iv-in" data-pair="' + e(x.bcs[0]) + '" style="flex:1;min-width:150px;font-size:13px;padding:6px">' +
            '<option value="">🔗 אותו מוצר כמו…</option>' + o.map((y, i) => '<option value="' + e(y.c.bcs[0]) + '"' + (i === 0 && y.s >= 0.5 ? ' selected' : '') + '>' + (i === 0 && y.s >= 0.5 ? '⭐ ' : '') + e(y.c.iname) + ' (' + e(y.c.bcs[0]) + ' · חויב ' + fmt(y.c.iq) + ')</option>').join('') +
            '</select><button class="iv-btn" data-pairgo="' + e(x.bcs[0]) + '" style="padding:6px 10px;font-size:13px">🔗 אישור</button></div>'; })() : '') +
          '</td><td class="n">' + fmt(x.iq) + '</td><td class="n">' + fmt(x.rq) + '</td></tr>').join('') + '</tbody></table></div>'
        : '<div class="ic-ban g" style="margin-top:6px">✓ החשבונית תואמת לקבלת הסחורה.</div>') +
      (linked.length ? '<div class="iv-mut" style="margin-top:6px">🔗 ברקודים זהים בהשוואה הזו: ' + linked.map((x) => e(x.bcs.join(' = ')) + (ro() ? '' : ' <button class="iv-btn" data-unpair="' + e(x.bcs.join(',')) + '" style="padding:2px 8px;font-size:12px">ביטול</button>')).join(' · ') + '</div>' : '') +
      (claim.length ? '<div class="ic-ban o" style="margin-top:8px">💸 לחיוב הספק: ' + claim.length + ' פריטים · ' + money(sumClaim) + ' לפני מע"מ<div class="iv-acts" style="margin-top:6px"><button class="iv-btn" id="icDiffX">⬇ קובץ הפרשים לחיוב</button><button class="iv-btn" id="icDiffS">📤 שליחה לספק</button></div></div>' : '') +
      '<div class="iv-mut" style="margin-top:4px">לקומקס נכנס מה שחויב (החשבונית). ההפרשים — בקובץ הנפרד. הכמות בחשבונית = כמות' + (opts.packMode ? ' × מארז' : '') + '.</div>';
    box.querySelectorAll('[data-pairgo]').forEach((b) => b.onclick = async () => {
      const sel = box.querySelector('select[data-pair="' + b.dataset.pairgo + '"]'), other = sel && sel.value;
      if (!other) return say('בחרו את הפריט שחויב', 'err');
      const x = await api('icEquiv', { a: b.dataset.pairgo, b: other, on: true }); if (!x.ok) return say(x.error, 'err');
      (D.equiv = D.equiv || []).push({ a: b.dataset.pairgo, b: other }); say('✓ נשמר — מעכשיו שני הברקודים נחשבים אותו מוצר'); drawCmp();
    });
    box.querySelectorAll('[data-unpair]').forEach((b) => b.onclick = async () => {
      const bcs = b.dataset.unpair.split(','), drop = (D.equiv || []).filter((p) => bcs.includes(p.a) && bcs.includes(p.b));
      for (const p of drop) { const x = await api('icEquiv', { a: p.a, b: p.b, on: false }); if (!x.ok) return say(x.error, 'err'); }
      D.equiv = (D.equiv || []).filter((p) => !drop.includes(p)); drawCmp();
    });
    if ($('icDiffX')) $('icDiffX').onclick = () => diffXlsx(L);
    if ($('icDiffS')) $('icDiffS').onclick = () => diffShare(L);
  }
  // 💸 the differences, to charge the supplier: charged more than received (the missing qty × the invoice's unit price)
  function diffText(L) {
    const c = L.filter((x) => x.iq > x.rq + 0.001);
    const tot = c.reduce((t, x) => t + (x.price != null ? (x.iq - x.rq) * x.price : 0), 0);
    return 'הפרשים ב' + tname() + ' ' + (D.invoice_no || '') + ' (' + (D.invoice_date || '') + ') — סופרסטאר פלוס\nספק: ' + (D.supplier_name || '') + '\n\n' +
      c.map((x, i) => (i + 1) + '. ' + x.name + ' — ברקוד ' + x.bcs.join(' / ') + '\n   חויב ' + fmt(x.iq) + ', התקבל ' + fmt(x.rq) + ', חסר ' + fmt(x.iq - x.rq) + (x.price != null ? ' × ' + money(x.price) + ' = ' + money((x.iq - x.rq) * x.price) : '')).join('\n') +
      '\n\nסה"כ לזיכוי: ' + money(tot) + ' לפני מע"מ';
  }
  async function diffShare(L) {
    const t = diffText(L);
    if (navigator.share) { try { await navigator.share({ title: 'הפרשים ב' + tname(), text: t }); return; } catch (x) { if (/Abort/i.test(String(x && x.name))) return; } }
    try { await navigator.clipboard.writeText(t); say('✓ ההפרשים הועתקו — הדביקו בוואטסאפ או במייל לספק'); } catch (_) { window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank'); }
  }
  async function diffXlsx(L) {
    let X = window.XLSX;
    try { const prev = window.XLSX; await new Promise((res, rej) => { const s = document.createElement('script'); s.src = XS_URL; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); X = window.XLSX; if (prev) window.XLSX = prev; }
    catch (_) { if (!X) return say('לא הצלחתי לטעון את רכיב האקסל', 'err'); }
    const t = (v) => ({ t: 's', v: String(v) }), n = (v) => (v == null || !isFinite(v) ? '' : { t: 'n', v: Math.round(Number(v) * 100) / 100 });
    const hd = (a) => a.map((v) => ({ t: 's', v, s: { font: { bold: true }, fill: { fgColor: { rgb: 'E2E8F0' } } } }));
    const c = L.filter((x) => x.iq > x.rq + 0.001), ex = L.filter((x) => x.rq > x.iq + 0.001);
    const tot = c.reduce((s2, x) => s2 + (x.price != null ? (x.iq - x.rq) * x.price : 0), 0);
    const a1 = [[t('ספק: ' + (D.supplier_name || '') + ' · ' + tname() + ' ' + (D.invoice_no || '') + ' · ' + (D.invoice_date || ''))], []]
      .concat([hd(['ברקוד', 'שם', 'חויב', 'התקבל', 'חסר', 'מחיר ליחידה (לפני מע"מ)', 'לזיכוי'])])
      .concat(c.map((x) => [t(x.bcs.join(' / ')), x.name, n(x.iq), n(x.rq), n(x.iq - x.rq), n(x.price), n(x.price != null ? (x.iq - x.rq) * x.price : null)]))
      .concat([[], ['', 'סה"כ לזיכוי (לפני מע"מ)', '', '', '', '', n(tot)]]);
    const ws = X.utils.aoa_to_sheet(a1); ws['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 12 }]; ws['!views'] = [{ RTL: true }];
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'לחיוב הספק');
    if (ex.length) {
      const w2 = X.utils.aoa_to_sheet([hd(['ברקוד', 'שם', 'חויב', 'התקבל', 'עודף'])].concat(ex.map((x) => [t(x.bcs.join(' / ')), x.name, n(x.iq), n(x.rq), n(x.rq - x.iq)])));
      w2['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 8 }, { wch: 8 }, { wch: 8 }]; w2['!views'] = [{ RTL: true }];
      X.utils.book_append_sheet(wb, w2, 'התקבל ולא חויב');
    }
    const clean = (s2) => String(s2 || '').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 40);
    X.writeFile(wb, 'הפרשים לחיוב - ' + (clean(D.supplier_name) || 'ספק') + ' - ' + (clean(D.invoice_no) || D.id) + '.xlsx');
  }

  /* ---- the supplier from Comax's list (the reading's guess may not match — then its receipts are not offered) ---- */
  let sups = null;
  async function supPick() {
    const box = $('icSupBox'); if (!box) return;
    if (box.innerHTML) { box.innerHTML = ''; return; }
    box.innerHTML = '<input class="iv-in" id="icSupQ" style="font-size:14px;margin-top:6px" placeholder="🔎 ספק — הקלידו חלק מהשם"><div class="gr-sup" id="icSupL"><div class="iv-mut" style="padding:10px">טוען ספקים…</div></div>';
    if (!sups) { const r = await api('rcvSuppliers'); sups = r.ok ? r.suppliers : []; }
    const draw = () => {
      const q2 = $('icSupQ').value.trim(), hit = q2 ? sups.filter((x) => x.name.includes(q2)) : sups.slice(0, 12);
      $('icSupL').innerHTML = hit.slice(0, 40).map((x) => '<button type="button" data-c="' + x.code + '"><span>' + e(x.name) + '</span><small>' + (x.items ? x.items + ' פריטים' : '') + '</small></button>').join('') || '<div class="iv-mut" style="padding:10px">לא נמצא</div>';
      $('icSupL').querySelectorAll('[data-c]').forEach((b) => b.onclick = async () => {
        const s2 = sups.find((x) => String(x.code) === b.dataset.c);
        await flushSave();
        const x = await api('icSupplier', { docId: D.id, supplier: s2.code, supplierName: s2.name }); if (!x.ok) return say(x.error, 'err');
        say('✓ הספק: ' + s2.name); showDoc(D.id);
      });
    };
    $('icSupQ').addEventListener('input', draw); draw(); $('icSupQ').focus();
  }

  /* ---- the end: done + export ---- */
  function drawEnd() {
    const box = $('icEnd'); if (!box) return;
    const s = stats(), metaMissing = !D.supplier_name || !D.invoice_no || !D.invoice_date;
    if (ro()) {
      box.innerHTML = '<h3>✓ החשבונית הסתיימה</h3><div class="iv-mut">' + (D.done_by ? 'על ידי ' + e(D.done_by) + ' · ' + when(D.done_at) : '') + '</div>' +
        '<div class="iv-acts"><button class="iv-btn iv-pri" id="icX1">⬇ קובץ לקומקס</button>' + (D.mgr ? '<button class="iv-btn" id="icReopen">↩ פתיחה מחדש</button>' : '') + '</div>';
      $('icX1').onclick = xlsx;
      if ($('icReopen')) $('icReopen').onclick = async (ev) => { const b = ev.currentTarget; if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'לפתוח מחדש? לחצו שוב'; return; } const x = await api('icDone', { docId: D.id, reopen: true }); if (!x.ok) return say(x.error, 'err'); showDoc(D.id); };
      return;
    }
    box.innerHTML = '<h3>✓ סיום וייצוא לקומקס</h3>' +
      (metaMissing ? '<div class="ic-ban o">⚠ חסר ' + [!D.supplier_name && 'ספק', !D.invoice_no && tno(), !D.invoice_date && 'תאריך'].filter(Boolean).join(', ') + ' — צריך אותם במסך הקליטה בקומקס.</div>' : '') +
      (s.nw ? '<label class="ic-opt" style="background:#fef2f2;border-radius:12px;padding:10px"><input type="checkbox" id="icConf"' + (opts.newConfirmed ? ' checked' : '') + '>✓ הקמתי בקומקס את ' + s.nw + ' הפריטים החדשים</label>' : '') +
      '<div class="iv-acts"><button class="iv-btn iv-ok" id="icDone" style="flex:1"' + (s.nw && !opts.newConfirmed ? ' disabled' : '') + '>✓ סיום ⬇ קובץ לקומקס</button></div>' +
      '<div class="iv-mut" style="margin-top:6px">הקובץ: מספר שורה, ברקוד, שם, כמות' + (opts.packMode ? ' (× מארז)' : '') + ', ריק, ריק, מחיר ליחידה' + (opts.vatIncluded ? ' אחרי הורדת מע"מ' : '') + '. בקומקס: קליטה ← "ללא הזמנות" ← ייבוא מאקסל ← תבנית "SAP מערכת".</div>';
    if ($('icConf')) $('icConf').onchange = () => { opts.newConfirmed = $('icConf').checked; queue(); drawEnd(); };
    $('icDone').onclick = async () => {
      if (rows.some((r) => !isFinite(effQty(r, opts)) || !isFinite(unitOut(r, opts)))) return say('יש שורות בלי כמות או מחיר — השלימו או מחקו אותן', 'err');
      await flushSave();
      const x = await api('icDone', { docId: D.id }); if (!x.ok) return say(x.error, 'err');
      say('✓ החשבונית הסתיימה'); D.status = 'done'; D.done_by = myName(); D.done_at = new Date().toISOString();
      await xlsx(); showDoc(D.id);
    };
  }
  async function xlsx() {
    let X = window.XLSX;
    try { const prev = window.XLSX; await new Promise((res, rej) => { const s = document.createElement('script'); s.src = XS_URL; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); X = window.XLSX; if (prev) window.XLSX = prev; }
    catch (_) { if (!X) return say('לא הצלחתי לטעון את רכיב האקסל', 'err'); }
    const t = (v) => ({ t: 's', v: String(v), z: '@' }), n = (v) => (isFinite(v) ? { t: 'n', v: Number(v) } : '');
    const aoa = [['מספר שורה', 'ברקוד', 'שם פריט', 'כמות', '', '', 'מחיר קניה']].concat(rows.map((r, i) => [n(i + 1), t(String(r.barcode).replace(/\s/g, '')), r.known && r.catName ? r.catName : r.name, n(effQty(r, opts)), '', '', n(unitOut(r, opts))]));
    const ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 34 }, { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 10 }];
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'חשבונית');
    const clean = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 40);
    X.writeFile(wb, tname() + ' לקומקס - ' + (clean(D.supplier_name) || 'ספק') + ' - ' + (clean(D.invoice_no) || D.id) + '.xlsx');
    api('icExported', { docId: D.id });
  }

  /* ---- saving: the whole invoice, a moment after the last change ---- */
  let dirty = false, metaDirty = false;
  function queue(meta) { dirty = true; if (meta) metaDirty = true; clearTimeout(saveT); saveT = setTimeout(flushSave, 1200); }
  async function flushSave() {
    clearTimeout(saveT);
    if (!dirty || !D || ro()) return;
    dirty = false;
    const body = { docId: D.id, rows: rows.map((r) => ({ id: r.id, barcode: r.barcode, raw: r.raw, name: r.known && r.catName ? r.catName : r.name, qty: r.qty, price: r.price, total: r.total, pack: r.pack, promo: r.promo, page: r.page })), opts };
    if (metaDirty) { Object.assign(body, { supplier_name: D.supplier_name, invoice_no: D.invoice_no, invoice_date: D.invoice_date, subtotal: D.subtotal, vat: D.vat, total: D.total, supplier: D.supplier || null }); metaDirty = false; }
    const x = await api('icSave', body);
    if (!x.ok) { dirty = true; say(x.error || 'השמירה נכשלה — אנסה שוב', 'err'); saveT = setTimeout(flushSave, 8000); }
    // a fixed barcode: its catalog check comes back with the next load
    // (only the catalog's fields are taken — what is being typed now is not overwritten)
    if (x.ok && rows.some((r) => r.recheck) && view === 'doc') {
      const r = await api('icGet', { docId: D.id });
      if (r.ok && view === 'doc') {
        const srv = new Map(r.doc.rows.map((x2) => [x2.id, x2]));
        for (const row of rows) {
          const s = srv.get(row.id); if (!s || !row.recheck || String(s.barcode).replace(/\D/g, '').slice(-String(row.barcode).replace(/\D/g, '').length) !== String(row.barcode).replace(/\D/g, '')) continue;
          Object.assign(row, { barcode: s.barcode, known: s.known, catName: s.catName, salePrice: s.salePrice, cost: s.cost, suffix: s.suffix, archivedItem: s.archivedItem, recheck: false });
        }
        drawRows(); refresh();
      }
    }
  }

  /* ---- 📷 the pages ---- */
  function pick(camera) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = camera ? 'image/*' : 'image/*,application/pdf,.pdf'; inp.multiple = !camera;
    if (camera) inp.setAttribute('capture', 'environment');
    inp.onchange = () => { const fs = [...(inp.files || [])]; if (fs.length) send(fs); };
    inp.click();
  }
  async function shrink(f) {
    if (isPdf(f)) return { mime: 'application/pdf', data: await b64(f) };
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
    const k = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(img.src);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.85));
    return { mime: 'image/jpeg', data: await b64(blob) };
  }
  const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  // 24/11 (the owner: "allow uploading a scanned PDF or an image too"): a PDF is split into its pages (pdf-lib, like the
  // old app — one request per page reads a dense invoice far better than one for the whole file)
  const PDFLIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
  async function pdfPages(f) {
    if (!window.PDFLib) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = PDFLIB; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const src = await window.PDFLib.PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
    const out = [];
    for (let i = 0; i < src.getPageCount(); i++) {
      const doc = await window.PDFLib.PDFDocument.create();
      const [pg] = await doc.copyPages(src, [i]); doc.addPage(pg);
      out.push(new Blob([await doc.save()], { type: 'application/pdf' }));
    }
    return out;
  }
  async function send(files) {
    if (busy) return;
    busy = true;
    await flushSave();
    const prog = (t) => { if ($('icProg')) $('icProg').innerHTML = t; };
    ['icShot', 'icGal'].forEach((id) => { if ($(id)) $(id).disabled = true; });
    let added = 0, fails = 0;
    // every file → its pages (a PDF: one per page; an image: itself)
    const pages = [];
    for (const f of files) {
      if (!isPdf(f)) { pages.push(f); continue; }
      prog('⏳ מפצל את ' + e(f.name || 'הקובץ') + ' לעמודים…');
      try { (await pdfPages(f)).forEach((b) => pages.push(b)); }
      catch (_) { pages.push(f); }   // could not split (an unusual PDF) — sent whole
    }
    for (let i = 0; i < pages.length; i++) {
      prog('⏳ קורא עמוד ' + (i + 1) + (pages.length > 1 ? ' מתוך ' + pages.length : '') + '… (עד דקה לעמוד צפוף)');
      try {
        const p = await shrink(pages[i]);
        if (p.data.length > 8e6) { fails++; say('עמוד ' + (i + 1) + ' גדול מדי (מעל 6MB) — סרקו ברזולוציה נמוכה יותר או צלמו אותו', 'err'); continue; }
        const x = await api('icPage', { docId: D.id, ...p });
        if (x.ok) added += x.added; else { fails++; say(x.error, 'err'); }
      } catch (_) { fails++; say('לא הצלחתי לקרוא את הקובץ', 'err'); }
    }
    busy = false;
    say(fails ? 'נקראו ' + added + ' שורות; ' + fails + ' עמודים נכשלו' : '✓ נקראו ' + added + ' שורות');
    if (view === 'doc') showDoc(D.id);
  }

  /* ================= the menu items (only who may) ================= */
  let checked = '';
  async function menus() {
    if (!signedIn()) return;
    const me = myName() + '|' + !!appState().mgr;
    if (checked === me && ACC !== null) return place();
    if (checked === me) return;
    checked = me; ACC = null;
    const r = await api('icAccess');
    ACC = !!(r.ok && r.allowed);
    place();
  }
  function place() {
    if (!ACC) return;
    const ops = $('menuOpsDrop') || $('menuSchedDrop');
    if (ops && appState().mgr && !$('icMgrBtn')) {
      const after = $('rcvMgrBtn'), html = '<button id="icMgrBtn">🧾 קליטת חשבונית</button>';
      if (after) after.insertAdjacentHTML('afterend', html); else ops.insertAdjacentHTML('beforeend', html);
      $('icMgrBtn').addEventListener('click', open);
    }
    const em = $('emSchedDrop');
    if (em && !$('icEmpBtn')) {
      const after = $('rcvEmpBtn'), html = '<button type="button" id="icEmpBtn" role="menuitem">🧾 קליטת חשבונית</button>';
      if (after) after.insertAdjacentHTML('afterend', html); else em.insertAdjacentHTML('beforeend', html);
      $('icEmpBtn').addEventListener('click', open);
    }
  }
  let mt = null;
  new MutationObserver(() => { if ((($('menuOpsDrop') || $('menuSchedDrop')) && !$('icMgrBtn')) || ($('emSchedDrop') && !$('icEmpBtn'))) { clearTimeout(mt); mt = setTimeout(menus, 400); } }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', menus); else menus();
  window.openIc = open;
})();
