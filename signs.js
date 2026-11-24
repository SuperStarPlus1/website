// 🏷️ שילוט (25/11/2026, the owner: "a shelf-sign printing system connected to Comax: a barcode scan pulls the item's
// name and price; an item with an active promotion — its description as on the site, with the dates and the limits.
// With the phone and its camera, no scanner; the network laser printer (Brother MFC-L5750DW, AirPrint), the manual
// feed tray"). Superstar only: 💼 ניהול העסק ▸ תפעול ▸ 🏷️ שילוט (the managers) and 📅 ▸ 🏷️ שילוט (the employees).
// The paper is the store's own, already printed (the logo, the frame, "מבצע!"): three kinds, A4 — a whole page (one
// sign), halves (two) and thirds (three). Only the text is printed, into the white frames (the places measured on the
// owner's paper and his Word / Publisher templates).
// 25/11/2026 (the owner): open to ALL the employees too — 📅 סידור עבודה ונוכחות ▸ 🏷️ שילוט (like the inventory count). Per sign, as on his printed samples:
//   the name     the promotion's description without its price part ("קופסת גבינת אלרוחה 700 גרם 35.90 ש"ח" → the name)
//   the price    big, the agorot small and underlined, ₪ at the left; a deal for a quantity reads right to left:
//                "2 ק"ג ב 15 ₪" — the quantity on the right, then ב, then the price
//   the lines    קוד / קודים: the last 6 digits of each barcode, "a / b"; more than 6 barcodes → "קודים שונים"
//                · מחיר רגיל ליח' / לק"ג · the limits (מוגבל ל-…, בקנייה מעל …) · בתוקף: from – to (the start date when
//                the store PC sends it — ValidFrom; else "בתוקף עד") · לחברי מועדון ומצטרפים חדשים (every promotion is
//                the club's)
//   no promotion the same paper: the name, the price and the code only
// Everything can be fixed by hand before printing. The data: the site's files (data/promos-he.json, products-he.json —
// from the main register every morning; Comax is never written to).
// Printing: a one-page A4 PDF (the sign drawn at 250 dpi) — opened or shared from the phone, then printed (AirPrint); 📐 כיול — a test page on plain paper, held
// over the printed paper against the light, and arrows that move the print (mm) and a size %, kept per paper kind on
// this device (localStorage signCal_<kind>).
// Uses the app's globals: state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const canUse = () => !!(appState() && (appState().mgr || appState().emp));   // managers and every signed-in employee
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); };
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };

  /* ---------- the papers: the white frames on A4, mm (x, y, width, height) ---------- */
  const PAPERS = {
    third: { name: 'שליש', icon: '▤', n: 3, img: 'img/signs/paper-third.jpg', slots: [[4, 3, 202, 70], [4, 105, 202, 66], [4, 203, 202, 66]] },
    half: { name: 'חצי', icon: '▥', n: 2, img: 'img/signs/paper-half.jpg', slots: [[3, 4, 202, 114], [3, 149, 202, 112]] },
    full: { name: 'דף שלם', icon: '▯', n: 1, img: 'img/signs/paper-full.jpg', slots: [[11, 74, 189, 186]] },
  };
  // the type per kind (mm): name, the big number, the lines
  const TYPE = { third: { nm: 11, big: 36, ln: 4.9 }, half: { nm: 14, big: 46, ln: 4.9 }, full: { nm: 20, big: 62, ln: 5.2 } };

  let kind = store.get('signPaper') || 'third';
  if (!PAPERS[kind]) kind = 'third';
  let slots = [], sel = 0, data = null, dataP = null, camOn = false;
  const cal = (k) => { try { const c = JSON.parse(store.get('signCal_' + k) || '{}'); return { dx: +c.dx || 0, dy: +c.dy || 0, sc: +c.sc || 100 }; } catch (_) { return { dx: 0, dy: 0, sc: 100 }; } };
  const setCal = (k, c) => store.set('signCal_' + k, JSON.stringify(c));

  /* ---------- the data: the site's catalog and promotions ---------- */
  const nb = (b) => String(b || '').replace(/\D/g, '').replace(/^0+/, '');
  function load() {
    if (data) return Promise.resolve(data);
    if (dataP) return dataP;
    const get = (f) => fetch('data/' + f + '?v=' + new Date().toISOString().slice(0, 13), { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    dataP = Promise.all([get('promos-he.json'), get('products-he.json')]).then(([pr, pp]) => {
      const obj = (f) => f.rows.map((r) => Object.fromEntries(f.cols.map((c, i) => [c, r[i] == null ? '' : String(r[i])])));
      const promos = obj(pr), prods = new Map();
      for (const p of obj(pp)) prods.set(nb(p.Barcode), p);
      for (const o of promos) { let a = []; try { a = JSON.parse(o.AllBarcodes || '[]'); } catch (_) { a = []; } o._bcs = (a.length ? a : [o.Barcode]).map(String).filter(Boolean); o._keys = new Set(o._bcs.map(nb)); }
      data = { promos, prods };
      return data;
    }).catch((x) => { dataP = null; throw x; });
    return dataP;
  }
  const findPromo = (bc) => data.promos.find((o) => o._keys.has(nb(bc)));
  // 25/11/2026 (the owner: "some items have more than one promotion — how do I choose which to print?"): all of them
  const promosFor = (bc) => data.promos.filter((o) => o._keys.has(nb(bc)));
  // "קופסת גבינת אלרוחה 700 גרם 35.90 ש"ח" / "תפוזים ברשת 4 ק"ג ב 10 ש"ח" / "... 2 ב 10" → the name, the quantity, the price
  const PRICE_RE = /\s*(?:(\d+(?:\.\d+)?)\s*(ק"ג|קג|ק״ג|יח'?|יח׳)?\s*ב[-\s]*)?(\d+(?:\.\d+)?)\s*(ש"ח|ש״ח|ש"|₪)?\s*$/;
  const money = (v) => { const n = Number(v); return isFinite(n) ? n.toFixed(2) : ''; };
  const codesLine = (bcs) => bcs.length > 6 ? 'קודים שונים' : (bcs.length > 1 ? 'קודים: ' : 'קוד: ') + bcs.map((b) => String(b).slice(-6)).join(' / ');
  function fromPromo(o, bc) {
    const desc = String(o.Discreption || o.Name || '').trim(), m = PRICE_RE.exec(desc);
    const priced = m && (m[1] || m[4]);   // a number at the end that is a price (ש"ח, or "X ב Y")
    const weight = Number(o.Quanity) > 0 && Number(o.Quanity) < 1;
    let name = priced ? desc.slice(0, m.index).trim() : desc, qty = '', unit = '', price = '';
    if (priced) { qty = m[1] || ''; unit = m[2] ? (/^ק/.test(m[2]) ? 'ק"ג' : '') : ''; price = m[3]; }
    else { price = Number(o.Quanity) > 1 ? o.PriceDiscount : (o.UnitPrice || o.PriceDiscount); qty = Number(o.Quanity) > 1 ? String(Number(o.Quanity)) : ''; }
    if (!name) name = o.Name || desc;
    const reg = data.prods.get(nb(o.Barcode)) || data.prods.get(nb(bc));
    const lines = [codesLine(o._bcs)];
    if (reg && Number(reg.Price) > 0) lines.push((weight ? 'מחיר רגיל לק"ג ' : "מחיר רגיל ליח' ") + money(reg.Price) + ' ₪');
    String(o.PromoNote || '').split('|').map((x) => x.trim()).filter((x) => x && !/9{4,}/.test(x)).forEach((x) => lines.push(x));
    if (o.Valid) lines.push(o.ValidFrom ? 'בתוקף: ' + o.ValidFrom + ' – ' + o.Valid : 'בתוקף עד: ' + o.Valid);
    lines.push('לחברי מועדון ומצטרפים חדשים');
    return { bc: String(bc), promo: true, name, qty, unit, price: money(price), per: '', lines: lines.join('\n') };
  }
  function fromProduct(p) {
    return { bc: p.Barcode, promo: false, name: p.Name, qty: '', unit: '', price: money(p.Price), per: String(p.Barcode).length <= 6 ? 'לק"ג' : '', lines: codesLine([p.Barcode]) };
  }

  /* ---------- one sign, in mm (the same HTML on the screen and on paper) ---------- */
  function signHtml(s, k, box) {
    const T = TYPE[k], [x, y, w, h] = box;
    if (!s) return '';
    const name = String(s.name || ''), L = name.length;
    const nm = k === 'full' ? (L > 24 ? 12 : L > 16 ? 15 : T.nm) : k === 'half' ? (L > 34 ? 9 : L > 24 ? 11 : T.nm) : (L > 36 ? 7.5 : L > 28 ? 9 : T.nm);
    const [sh, ag] = String(s.price || '0.00').split('.');
    const digits = sh.length + (s.qty ? String(s.qty).length : 0);
    const big = T.big * (digits >= 5 ? 0.62 : digits >= 4 ? 0.74 : digits >= 3 ? 0.86 : 1);
    const num = '<span style="direction:ltr;display:inline-flex;align-items:flex-start;font-size:' + big + 'mm;line-height:.8;letter-spacing:-.03em">' + e(sh) +
      (ag && ag !== '00' ? '<span style="font-size:' + (big * .31) + 'mm;line-height:1;border-bottom:' + (big * .028) + 'mm solid currentColor;margin-left:1mm;letter-spacing:0">' + e(ag) + '</span>' : '') + '</span>';
    const shek = '<span style="font-size:' + (big * .17) + 'mm;align-self:flex-end;margin:0 1.5mm 0 0;line-height:1;white-space:nowrap">₪' + (s.per ? ' ' + e(s.per) : '') + '</span>';
    const price = s.qty
      ? '<span style="display:inline-flex;align-items:flex-end;font-size:' + big + 'mm;line-height:.8">' + e(s.qty) + (s.unit ? '<small style="font-size:' + (big * .17) + 'mm;margin-right:1mm;line-height:1">' + e(s.unit) + '</small>' : '') + '</span>' +
        '<span style="font-size:' + (big * .33) + 'mm;align-self:flex-end;margin:0 2mm;line-height:1">ב</span>' + num + shek
      : num + shek;
    const lines = String(s.lines || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => '<div style="white-space:nowrap">' + e(l) + '</div>').join('');
    const full = k === 'full';
    return '<div class="sg-sign" style="position:absolute;left:' + x + 'mm;top:' + y + 'mm;width:' + w + 'mm;height:' + h + 'mm;color:#1f2937;font-family:Heebo,Arial,sans-serif;direction:rtl;display:grid;' +
      (full ? 'grid-template-columns:1fr;grid-template-rows:auto 1fr auto' : 'grid-template-columns:1fr auto;grid-template-rows:auto 1fr') + ';padding:3mm 6mm;box-sizing:border-box;overflow:hidden">' +
      '<div style="grid-column:1/-1;text-align:center;font-weight:800;font-size:' + nm + 'mm;line-height:1.1;margin-top:' + (full ? 10 : k === 'half' ? 8 : 3) + 'mm">' + e(name) + '</div>' +
      '<div style="' + (full ? 'grid-column:1;grid-row:2;justify-self:center' : 'grid-column:2;grid-row:2;margin-left:6mm') + ';align-self:center;display:flex;align-items:flex-end;font-weight:800">' + price + '</div>' +
      '<div style="' + (full ? 'grid-column:1;grid-row:3;padding:0 8mm 8mm 0' : 'grid-column:1;grid-row:2;padding-right:6mm') + ';align-self:center;font-size:' + T.ln + 'mm;line-height:1.4">' + lines + '</div></div>';
  }
  // the whole A4: the signs (or, for the test page, the frames' outlines), moved and sized by the calibration
  function pageHtml(k, list, c, test) {
    const P = PAPERS[k];
    const inner = test
      ? P.slots.map((b, i) => '<div style="position:absolute;left:' + b[0] + 'mm;top:' + b[1] + 'mm;width:' + b[2] + 'mm;height:' + b[3] + 'mm;border:.4mm dashed #111;border-radius:5mm;box-sizing:border-box;' +
          'font:700 6mm Heebo,Arial,sans-serif;display:grid;place-items:center;color:#111;direction:rtl">דף בדיקה — ' + e(P.name) + ' · מסגרת ' + (i + 1) +
          '<div style="position:absolute;left:50%;top:-3mm;height:6mm;border-left:.3mm solid #111"></div><div style="position:absolute;top:50%;right:-3mm;width:6mm;border-top:.3mm solid #111"></div></div>').join('')
      : P.slots.map((b, i) => signHtml(list[i], k, b)).join('');
    return '<div style="position:relative;width:210mm;height:297mm;overflow:hidden;background:transparent">' +
      '<div style="position:absolute;inset:0;transform:translate(' + c.dx + 'mm,' + c.dy + 'mm) scale(' + c.sc / 100 + ');transform-origin:0 0">' + inner + '</div></div>';
  }

  /* ---------- the screen ---------- */
  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#sgOv{position:fixed;inset:0;z-index:9000;background:#eef2f7;overflow:auto;direction:rtl;color:#0f172a}#sgOv.hidden{display:none}' +
    '.sg-top{position:sticky;top:0;z-index:3;background:linear-gradient(135deg,#0b1220,#13213d);color:#fff;padding:10px 14px;display:flex;align-items:center;gap:10px}' +
    '.sg-top h2{margin:0;font-size:17px;font-weight:900;flex:1}.sg-top button{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:7px 12px;font:inherit;font-size:13.5px;font-weight:800}' +
    '.sg-body{max-width:980px;margin:0 auto;padding:12px 12px 60px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,420px);gap:14px;align-items:start}' +
    '@media (max-width:820px){.sg-body{grid-template-columns:minmax(0,1fr)}}' +
    '.sg-card{background:#fff;border-radius:18px;padding:14px;box-shadow:0 6px 20px -10px rgba(15,23,42,.18)}' +
    '.sg-kinds{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.sg-kinds button{border:2px solid #e2e8f0;background:#fff;border-radius:14px;padding:10px 6px;font:inherit;font-weight:800;font-size:14px;color:#0f172a}' +
    '.sg-kinds button.on{border-color:#0076DA;background:#eff6ff;color:#0b4a8b}.sg-kinds small{display:block;font-weight:600;font-size:11.5px;color:#64748b}' +
    '.sg-paper{position:relative;width:100%;aspect-ratio:210/297;background:#fff center/100% 100% no-repeat;border-radius:6px;box-shadow:0 10px 30px -14px rgba(15,23,42,.45);overflow:hidden}' +
    '.sg-paper>.sg-scale{position:absolute;left:0;top:0;width:210mm;height:297mm;transform-origin:0 0}' +
    '.sg-hit{position:absolute;border:2.5px solid transparent;border-radius:10px;cursor:pointer}.sg-hit.on{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.25)}' +
    '.sg-hit .tag{position:absolute;top:4px;right:6px;background:#f59e0b;color:#fff;font-size:11px;font-weight:900;border-radius:99px;padding:1px 8px}' +
    '.sg-hit .empty{position:absolute;inset:0;display:grid;place-items:center;color:#94a3b8;font-weight:800;font-size:13px}' +
    '.sg-row{display:flex;gap:8px;align-items:center}.sg-row>*{min-width:0}.sg-row>.sg-in{flex:1}.sg-row>.sg-btn{flex:none}' +
    '.sg-in{border:2px solid #cbd5e1;border-radius:12px;padding:9px 11px;font:inherit;font-size:15px;background:#fff;width:100%;box-sizing:border-box}.sg-in:focus{outline:none;border-color:#0076DA}' +
    '.sg-lbl{font-size:12px;font-weight:800;color:#64748b;margin:10px 2px 4px;display:block}' +
    '.sg-btn{border:1.5px solid #e2e8f0;background:#fff;border-radius:12px;padding:9px 13px;font:inherit;font-size:14px;font-weight:800;color:#0f172a;white-space:nowrap}.sg-btn:disabled{opacity:.45}' +
    '.sg-pri{background:linear-gradient(135deg,#0076DA,#4f46e5);color:#fff;border-color:transparent}.sg-ok{background:linear-gradient(135deg,#22c55e,#0d9488);color:#fff;border-color:transparent}' +
    '.sg-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.sg-mut{color:#64748b;font-size:12.5px;line-height:1.5}' +
    '.sg-cam{position:relative;border-radius:14px;overflow:hidden;background:#000;margin-top:10px}.sg-cam video{display:block;width:100%}' +
    '.sg-cam .fr{position:absolute;inset:24% 10%;border:2.5px solid rgba(255,255,255,.85);border-radius:12px}' +
    '.sg-camb{display:flex;gap:8px;justify-content:space-between;padding:8px;background:#0b1220}.sg-camb button{background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:10px;padding:8px 12px;font:inherit;font-weight:800}' +
    '.sg-pick{display:block;width:100%;text-align:right;margin-top:6px}' +
    '.sg-badge{display:inline-block;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:900}.sg-badge.p{background:#fff7ed;color:#c2410c}.sg-badge.r{background:#f1f5f9;color:#334155}' +
    '.sg-cal{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:260px;margin:8px auto}.sg-cal button{padding:10px 0}' +
    '</style>');

  function open() {
    if (!canUse()) return say('צריך להיכנס למערכת', 'err');
    if (!$('sgOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="sgOv" class="hidden"><div class="sg-top"><h2>🏷️ שילוט</h2><button id="sgCalBtn">📐 כיול</button><button id="sgX">✕ סגירה</button></div><div class="sg-body" id="sgBody"></div></div>');
      $('sgX').addEventListener('click', close);
      $('sgCalBtn').addEventListener('click', showCal);
    }
    $('sgOv').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (!slots.length) slots = Array(PAPERS[kind].n).fill(null);
    draw();
    load().catch(() => say('לא הצלחתי לטעון את המחירים והמבצעים — בדקו חיבור', 'err'));
  }
  function close() { camStop(); $('sgOv').classList.add('hidden'); document.body.style.overflow = ''; }

  function setKind(k) {
    if (k === kind) return;
    const keep = slots.filter(Boolean);
    kind = k; store.set('signPaper', k);
    slots = Array(PAPERS[k].n).fill(null).map((_, i) => keep[i] || null);
    sel = Math.min(sel, slots.length - 1);
    draw();
  }

  function draw() {
    const P = PAPERS[kind];
    $('sgBody').innerHTML =
      '<div><div class="sg-card"><div class="sg-kinds">' + Object.keys(PAPERS).map((k) => '<button data-k="' + k + '" class="' + (k === kind ? 'on' : '') + '">' + PAPERS[k].icon + ' ' + PAPERS[k].name +
        '<small>' + (PAPERS[k].n === 1 ? 'שלט אחד' : PAPERS[k].n + ' שלטים בדף') + '</small></button>').join('') + '</div>' +
      '<div class="sg-paper" id="sgPaper" style="margin-top:12px;background-image:url(' + P.img + ')"><div class="sg-scale" id="sgScale">' + pageHtml(kind, slots, { dx: 0, dy: 0, sc: 100 }) + '</div>' +
      P.slots.map((b, i) => '<div class="sg-hit' + (i === sel ? ' on' : '') + '" data-i="' + i + '" style="left:' + (b[0] / 2.1) + '%;top:' + (b[1] / 2.97) + '%;width:' + (b[2] / 2.1) + '%;height:' + (b[3] / 2.97) + '%">' +
        (P.n > 1 ? '<span class="tag">' + (i + 1) + '</span>' : '') + (slots[i] ? '' : '<div class="empty">לחצו כאן ואז סרקו פריט</div>') + '</div>').join('') + '</div>' +
      '<div class="sg-acts"><button class="sg-btn sg-ok" id="sgPrintBtn" style="flex:1;font-size:16px"' + (slots.some(Boolean) ? '' : ' disabled') + '>🖨️ הדפסה</button>' +
      (P.n > 1 ? '<button class="sg-btn" id="sgFill"' + (slots[sel] ? '' : ' disabled') + '>⧉ אותו שלט בכל הדף</button>' : '') + '</div>' +
      '<div class="sg-mut" style="margin-top:8px">בהדפסה: נייר A4 במגש ההזנה הידנית, צד מודפס כמו בכיול. מסגרת ריקה לא מודפסת.</div></div></div>' +
      '<div class="sg-card" id="sgEdit"></div>';
    $('sgBody').querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => setKind(b.dataset.k)));
    $('sgBody').querySelectorAll('.sg-hit').forEach((h) => h.addEventListener('click', () => { sel = Number(h.dataset.i); draw(); }));
    $('sgPrintBtn').addEventListener('click', () => print(false));
    if ($('sgFill')) $('sgFill').addEventListener('click', () => { const s = slots[sel]; slots = slots.map(() => Object.assign({}, s)); draw(); say('אותו שלט בכל ' + P.n + ' המסגרות ✓', 'ok'); });
    fitPaper();
    drawEdit();
  }
  function fitPaper() {
    const p = $('sgPaper'), s = $('sgScale');
    if (!p || !s) return;
    const mm = 96 / 25.4;
    s.style.transform = 'scale(' + (p.clientWidth / (210 * mm)) + ')';
  }
  window.addEventListener('resize', fitPaper);
  function refreshPaper() { const s = $('sgScale'); if (s) s.innerHTML = pageHtml(kind, slots, { dx: 0, dy: 0, sc: 100 }); const pb = $('sgPrintBtn'); if (pb) pb.disabled = !slots.some(Boolean); }

  function drawEdit() {
    const s = slots[sel], P = PAPERS[kind];
    const where = P.n > 1 ? 'מסגרת ' + (sel + 1) + ' מתוך ' + P.n : 'השלט';
    let h = '<div class="sg-row" style="justify-content:space-between"><b style="font-size:15px">' + where + '</b>' +
      (s ? '<span class="sg-badge ' + (s.promo ? 'p">מבצע' : 'r">מחיר רגיל') + '</span>' : '') + '</div>' +
      '<form id="sgFind" class="sg-row" style="margin-top:10px" autocomplete="off"><input class="sg-in" id="sgBc" inputmode="numeric" enterkeyhint="search" dir="ltr" style="text-align:right" placeholder="ברקוד או 6 ספרות אחרונות">' +
      '<button type="submit" class="sg-btn">🔎</button><button type="button" class="sg-btn sg-pri" id="sgCam">📷 סריקה</button></form>' +
      '<div id="sgCamBox"></div><div id="sgRes"></div>';
    if (s) {
      h += '<label class="sg-lbl">שם</label><input class="sg-in" data-f="name" value="' + e(s.name) + '">' +
        '<div class="sg-row" style="margin-top:2px"><div style="flex:1"><label class="sg-lbl">כמות (במבצע "2 ב…")</label><input class="sg-in" data-f="qty" inputmode="decimal" value="' + e(s.qty) + '" placeholder="—"></div>' +
        '<div style="flex:1"><label class="sg-lbl">יחידה</label><select class="sg-in" data-f="unit">' + ['', 'ק"ג'].map((u) => '<option value="' + e(u) + '"' + (u === s.unit ? ' selected' : '') + '>' + (u || '—') + '</option>').join('') + '</select></div>' +
        '<div style="flex:1.2"><label class="sg-lbl">מחיר ₪</label><input class="sg-in" data-f="price" inputmode="decimal" value="' + e(s.price) + '"></div></div>' +
        (s.promo ? '' : '<label class="sg-lbl">ליד ה-₪</label><select class="sg-in" data-f="per">' + ['', 'לק"ג', "ליח'"].map((u) => '<option value="' + e(u) + '"' + (u === s.per ? ' selected' : '') + '>' + (u || '—') + '</option>').join('') + '</select>') +
        '<label class="sg-lbl">שורות הפרטים (שורה לכל פרט)</label><textarea class="sg-in" data-f="lines" rows="6" style="font-size:14px;line-height:1.45">' + e(s.lines) + '</textarea>' +
        '<div class="sg-acts">' + (data && s.bc && (promosFor(s.bc).length > 1 || (s.promo && data.prods.get(nb(s.bc))) || (!s.promo && promosFor(s.bc).length)) ?
          '<button class="sg-btn" id="sgAlt">🔁 מבצע אחר / מחיר רגיל</button>' : '') + '<button class="sg-btn" id="sgClear">🗑 ניקוי המסגרת</button>' +
        (P.n > 1 && sel < P.n - 1 ? '<button class="sg-btn sg-pri" id="sgNext" style="flex:1">למסגרת הבאה ←</button>' : '') + '</div>';
    } else {
      h += '<div class="sg-mut" style="margin-top:12px">סרקו את הברקוד של הפריט במצלמה, או הקלידו אותו (אפשר 6 ספרות אחרונות). פריט במבצע מקבל את פרטי המבצע; פריט בלי מבצע — שם, מחיר וקוד.</div>';
    }
    $('sgEdit').innerHTML = h;
    $('sgFind').addEventListener('submit', (ev) => { ev.preventDefault(); const v = $('sgBc').value.trim(); if (v) find(v, false); });
    $('sgCam').addEventListener('click', () => (camOn ? camStop() : camStart()));
    $('sgEdit').querySelectorAll('[data-f]').forEach((el) => el.addEventListener('input', () => {
      if (!slots[sel]) return;
      slots[sel][el.dataset.f] = el.dataset.f === 'price' ? el.value.replace(/[^\d.]/g, '') : el.value;
      refreshPaper();
    }));
    $('sgEdit').querySelectorAll('[data-f=price]').forEach((el) => el.addEventListener('change', () => { if (slots[sel] && slots[sel].price !== '') { slots[sel].price = money(slots[sel].price); el.value = slots[sel].price; refreshPaper(); } }));
    if ($('sgClear')) $('sgClear').addEventListener('click', () => { slots[sel] = null; draw(); });
    if ($('sgAlt')) $('sgAlt').addEventListener('click', () => choose(slots[sel].bc, true));
    if ($('sgNext')) $('sgNext').addEventListener('click', () => { sel++; draw(); });
  }

  async function find(code, scanned) {
    const box = $('sgRes');
    code = String(code).replace(/\s+/g, '');
    if (box) box.innerHTML = '<div class="sg-mut" style="margin-top:10px">🔎 מחפש ' + e(code) + '…</div>';
    try { await load(); } catch (_) { if (box) box.innerHTML = '<div class="sg-mut" style="color:#b91c1c;margin-top:10px">אין חיבור — לא הצלחתי לטעון את המחירים</div>'; return; }
    const k = nb(code);
    let hit = data.prods.get(k) ? [data.prods.get(k)] : [];
    let promo = findPromo(code);
    if (!hit.length && !promo && !scanned && /^\d{4,7}$/.test(code)) {   // the last digits
      hit = []; for (const [b, p] of data.prods) if (b.endsWith(k)) { hit.push(p); if (hit.length > 12) break; }
      if (hit.length === 1) promo = findPromo(hit[0].Barcode);
      else if (hit.length > 1) {
        box.innerHTML = '<div class="sg-mut" style="margin-top:10px;font-weight:800;color:#0f172a">' + (hit.length > 12 ? 'יותר מ-12' : hit.length) + ' פריטים מסתיימים ב-' + e(code) + ' — בחרו:</div>' +
          hit.slice(0, 12).map((p) => '<button class="sg-btn sg-pick" data-bc="' + e(p.Barcode) + '">' + e(p.Name) + ' <span class="sg-mut" dir="ltr">' + e(p.Barcode) + '</span>' + (findPromo(p.Barcode) ? ' <span class="sg-badge p">מבצע</span>' : '') + '</button>').join('');
        box.querySelectorAll('[data-bc]').forEach((b) => b.addEventListener('click', () => find(b.dataset.bc, true)));
        return;
      }
    }
    if (!hit.length && !promo) { if (box) box.innerHTML = '<div class="sg-mut" style="color:#b91c1c;font-weight:800;margin-top:10px">לא נמצא פריט עם הברקוד ' + e(code) + '</div>'; return; }
    const bc = hit[0] ? hit[0].Barcode : code;
    if (navigator.vibrate) try { navigator.vibrate(40); } catch (_) {}
    if (promosFor(bc).length > 1) return choose(bc, false);   // more than one promotion → the user chooses
    slots[sel] = promo ? fromPromo(promo, bc) : fromProduct(hit[0]);
    draw();
  }
  // the item's promotions to choose from (each with its price, dates and limits) + its regular price
  function choose(bc, again) {
    const box = $('sgRes'); if (!box) return;
    const list = promosFor(bc), prod = data.prods.get(nb(bc));
    const cur = slots[sel];
    box.innerHTML = '<div class="sg-mut" style="margin-top:10px;font-weight:800;color:#0f172a">' + (list.length > 1 ? 'לפריט יש ' + list.length + ' מבצעים — איזה להדפיס?' : 'מה להדפיס?') + '</div>' +
      list.map((o, i) => { const t = fromPromo(o, bc), on = again && cur && cur.promo && cur.name === t.name && cur.price === t.price;
        return '<button class="sg-btn sg-pick" data-o="' + i + '"' + (on ? ' style="border-color:#0076DA;background:#eff6ff"' : '') + '><span class="sg-badge p">מבצע</span> <b>' + e(o.Discreption) + '</b>' +
          '<div class="sg-mut">' + e((o.ValidFrom ? o.ValidFrom + ' – ' : 'עד ') + o.Valid) + (o.PromoNote ? ' · ' + e(o.PromoNote.replace(/\s*\|\s*/g, ' · ')) : '') + '</div></button>'; }).join('') +
      (prod ? '<button class="sg-btn sg-pick" data-o="reg"><span class="sg-badge r">מחיר רגיל</span> <b>' + e(prod.Name) + ' — ' + money(prod.Price) + ' ₪</b><div class="sg-mut">בלי פרטי מבצע</div></button>' : '') +
      (again ? '<button class="sg-btn" id="sgAltX" style="margin-top:8px">ביטול</button>' : '');
    box.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => {
      slots[sel] = b.dataset.o === 'reg' ? fromProduct(prod) : fromPromo(list[Number(b.dataset.o)], bc);
      draw();
    }));
    if ($('sgAltX')) $('sgAltX').addEventListener('click', () => { box.innerHTML = ''; });
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ---------- the camera (the same reader as the inventory count: zxing-wasm, self-hosted) ---------- */
  const ZX_JS = 'vendor/zxing-reader-3.1.6.js', ZX_WASM = '/vendor/zxing_reader-3.1.6.wasm';
  const ZX_OPTS = { formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128', 'ITF', 'Code39'], tryHarder: true, tryRotate: true, tryInvert: false, tryDownscale: true, maxNumberOfSymbols: 1 };
  const ZX_TURN = [25, 35, 45, 55, 65];
  let zxReady = null, stream = null, camSeq = 0;
  function zxLoad() {
    if (zxReady) return zxReady;
    zxReady = new Promise((res, rej) => {
      const go = () => { try { window.ZXingWASM.prepareZXingModule({ overrides: { locateFile: (p, pre) => (p.endsWith('.wasm') ? ZX_WASM : pre + p) }, fireImmediately: true }); } catch (_) {} res(window.ZXingWASM); };
      if (window.ZXingWASM) return go();
      const sc = document.createElement('script'); sc.src = ZX_JS; sc.onload = go; sc.onerror = () => rej(new Error('load')); document.head.appendChild(sc);
    }).catch((x) => { zxReady = null; throw x; });
    return zxReady;
  }
  function turned(src, deg) {
    const w = src.width, h = src.height, d = Math.ceil(Math.hypot(w, h)), k = Math.min(1, 1280 / d);
    const c = document.createElement('canvas'); c.width = c.height = Math.round(d * k);
    const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.translate(c.width / 2, c.height / 2); g.rotate(-deg * Math.PI / 180); g.scale(k, k); g.drawImage(src, -w / 2, -h / 2);
    return g.getImageData(0, 0, c.width, c.height);
  }
  async function zxRead(src) {
    const Z = await zxLoad();
    const r = await Z.readBarcodes(src, ZX_OPTS);
    const ok = (r || []).find((x) => x && x.isValid !== false && x.text);
    return ok ? String(ok.text).trim() : '';
  }
  async function camStart() {
    const box = $('sgCamBox'); if (!box) return;
    camOn = true;
    const seq = ++camSeq;
    box.innerHTML = '<div class="sg-cam"><video id="sgVid" playsinline muted autoplay></video><div class="fr"></div><div class="sg-camb"><button type="button" id="sgSnap">📸 לא נקלט? צלמו תמונה</button><button type="button" id="sgCamX">✕ סגירה</button></div></div>';
    $('sgCamX').onclick = camStop;
    $('sgSnap').onclick = photoScan;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no camera');
      const want = { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } };
      const [s] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: Object.assign({ advanced: [{ focusMode: 'continuous' }] }, want), audio: false })
          .catch((x) => { if (/NotAllowed|Permission|denied|Security/i.test(String(x && (x.name || x.message)))) throw x; return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }),
        zxLoad(), load().catch(() => null)]);
      stream = s;
      if (!camOn || seq !== camSeq) return closeStream();
      const v = $('sgVid'); v.srcObject = s; try { await v.play(); } catch (_) {}
      loop(v, seq);
    } catch (err) {
      const m = String((err && (err.name || err.message)) || err || '');
      camStop();
      say(/NotAllowed|Permission|denied|Security/i.test(m) ? 'צריך לאשר לאתר גישה למצלמה (הגדרות הדפדפן ← הרשאות האתר ← מצלמה)' : 'לא הצלחתי לפתוח את המצלמה — אפשר להקליד ברקוד', 'err');
    }
  }
  function loop(v, seq) {
    const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
    let n = 0, turn = 0;
    const tick = async () => {
      if (!camOn || seq !== camSeq) return;
      const W = v.videoWidth, H = v.videoHeight;
      if (W && H) {
        const full = (++n % 4) === 0;
        const sw = full ? W : Math.round(W * 0.86), sh = full ? H : Math.round(H * 0.62);
        const k = Math.min(1, 1280 / Math.max(sw, sh));
        cv.width = Math.round(sw * k); cv.height = Math.round(sh * k);
        g.drawImage(v, Math.round((W - sw) / 2), Math.round((H - sh) / 2), sw, sh, 0, 0, cv.width, cv.height);
        let text = '';
        try {
          text = await zxRead(g.getImageData(0, 0, cv.width, cv.height));
          for (let j = 0; j < 2 && !text && camOn && seq === camSeq; j++) text = await zxRead(turned(cv, ZX_TURN[(turn++) % ZX_TURN.length]));
        } catch (_) {}
        if (text && camOn && seq === camSeq) { camStop(); find(text, true); return; }
      }
      setTimeout(tick, 90);
    };
    tick();
  }
  function photoScan() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
        const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(img.src);
        let text = await zxRead(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height));
        for (const a of ZX_TURN) { if (text) break; text = await zxRead(turned(cv, a)); }
        if (!text) throw new Error('none');
        find(text, true);
      } catch (_) { say('לא הצלחתי לקרוא את הברקוד מהתמונה — צלמו קרוב יותר ובאור טוב, או הקלידו אותו', 'err'); }
    };
    camStop();
    inp.click();
  }
  function closeStream() { if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} }); stream = null; }
  function camStop() { camOn = false; camSeq++; closeStream(); const b = $('sgCamBox'); if (b) b.innerHTML = ''; }

  /* ---------- printing: a PDF ----------
   * 25/11/2026 (the owner: "pressing print does not print" → then "it shows the preview but no print dialog"): a page's
   * print() does nothing in the app installed on the phone. So the sign becomes a PDF, like the payslips that the phone
   * opens and prints: the A4 page is laid out by the browser (the same HTML as the preview), every text run and line is
   * drawn on a 250 dpi canvas at its exact place, and the picture goes into a one-page A4 PDF. Then "🖨️ פתיחה להדפסה"
   * (the phone's PDF viewer → share → print) or "📤 שיתוף" (the share sheet, with הדפסה on an iPhone). */
  const DPI = 250;
  function fontOf(cs) { return (cs.fontStyle !== 'normal' ? cs.fontStyle + ' ' : '') + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; }
  // the lines of one text node as laid out (a name may wrap): [{text, rect}]
  function textLines(node) {
    const r = document.createRange(), t = node.nodeValue;
    r.selectNodeContents(node);
    const rects = r.getClientRects();
    if (rects.length <= 1) return rects.length ? [{ text: t.trim(), rect: rects[0] }] : [];
    const lines = [], re = /\S+/g; let m;
    while ((m = re.exec(t))) {
      r.setStart(node, m.index); r.setEnd(node, m.index + m[0].length);
      const b = r.getBoundingClientRect();
      let L = lines.find((x) => Math.abs(x.top - b.top) < b.height / 2);
      if (!L) { L = { top: b.top, words: [], left: b.left, right: b.right, bottom: b.bottom }; lines.push(L); }
      L.words.push(m[0]); L.left = Math.min(L.left, b.left); L.right = Math.max(L.right, b.right); L.bottom = Math.max(L.bottom, b.bottom);
    }
    return lines.map((L) => ({ text: L.words.join(' '), rect: { left: L.left, right: L.right, top: L.top, bottom: L.bottom, height: L.bottom - L.top } }));
  }
  async function renderCanvas(k, test) {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-30000px;top:0;width:210mm;height:297mm;background:#fff;direction:rtl;pointer-events:none';
    host.innerHTML = pageHtml(k, slots, cal(k), test);
    document.body.appendChild(host);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const page = host.firstElementChild, pr = page.getBoundingClientRect();
      const W = Math.round(210 / 25.4 * DPI), H = Math.round(297 / 25.4 * DPI), K = W / pr.width;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.dir = 'rtl';
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      const X = (x) => (x - pr.left) * K, Y = (y) => (y - pr.top) * K;
      // lines: the agorot's underline (border-bottom), the test page's dashed frames and its marks
      for (const el of page.querySelectorAll('*')) {
        const cs = getComputedStyle(el), b = el.getBoundingClientRect();
        if (!b.width && !b.height) continue;
        const side = (w, st, col, x1, y1, x2, y2) => {
          const lw = parseFloat(w) * K; if (!(lw > 0) || st === 'none') return;
          g.save(); g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(st === 'dashed' ? [lw * 4, lw * 3] : []);
          g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore();
        };
        const l = X(b.left), r = X(b.right), t = Y(b.top), bt = Y(b.bottom);
        side(cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor, l, t, r, t);
        side(cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor, l, bt, r, bt);
        side(cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor, l, t, l, bt);
        side(cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor, r, t, r, bt);
      }
      // the text, run by run, each at its laid-out place and in its own direction
      const tw = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = tw.nextNode())) {
        if (!n.nodeValue.trim()) continue;
        const cs = getComputedStyle(n.parentElement);
        const px = parseFloat(cs.fontSize) * K;
        g.font = fontOf(cs).replace(cs.fontSize, px + 'px');
        g.fillStyle = cs.color;
        const rtl = cs.direction === 'rtl';
        g.direction = rtl ? 'rtl' : 'ltr';
        g.textAlign = rtl ? 'right' : 'left';
        g.textBaseline = 'alphabetic';
        if ('letterSpacing' in g) g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : (parseFloat(cs.letterSpacing) * K) + 'px';
        for (const ln of textLines(n)) {
          const mt = g.measureText(ln.text);
          const asc = mt.fontBoundingBoxAscent || px * 0.93, desc = mt.fontBoundingBoxDescent || px * 0.27;
          const top = Y(ln.rect.top), h = ln.rect.height * K;
          g.fillText(ln.text, rtl ? X(ln.rect.right) : X(ln.rect.left), top + (h - (asc + desc)) / 2 + asc);
        }
      }
      return cv;
    } finally { host.remove(); }
  }
  // a one-page A4 PDF around one JPEG
  async function pdfOf(cv) {
    const jpg = new Uint8Array(await (await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.95))).arrayBuffer());
    const enc = new TextEncoder(), parts = [], offs = [];
    let len = 0;
    const add = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (i, body, stream) => { offs[i] = len; add(i + ' 0 obj\n' + body + (stream ? '\nstream\n' : '\nendobj\n')); if (stream) { add(stream); add('\nendstream\nendobj\n'); } };
    const PW = 595.28, PH = 841.89, content = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q';
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    obj(4, '<< /Type /XObject /Subtype /Image /Width ' + cv.width + ' /Height ' + cv.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>', jpg);
    obj(5, '<< /Length ' + content.length + ' >>', enc.encode(content));
    const x = len;
    add('xref\n0 6\n0000000000 65535 f \n' + [1, 2, 3, 4, 5].map((i) => String(offs[i]).padStart(10, '0') + ' 00000 n \n').join('') +
      'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }
  let lastPdf = null;
  async function print(test, k) {
    k = k || kind;
    if (!test && !slots.some(Boolean)) return;
    camStop();
    const name = (test ? 'דף בדיקה' : 'שילוט') + ' - ' + PAPERS[k].name + '.pdf';
    showReady(null, name);
    let blob;
    try { blob = await pdfOf(await renderCanvas(k, test)); }
    catch (x) { closeReady(); return say('לא הצלחתי להכין את הקובץ להדפסה — נסו שוב', 'err'); }
    if (lastPdf) URL.revokeObjectURL(lastPdf.url);
    lastPdf = { blob, url: URL.createObjectURL(blob), name };
    showReady(lastPdf, name);
  }
  // the PDF is ready: open it (the phone's viewer → share → print) or share it (the share sheet has הדפסה)
  function showReady(pdf, name) {
    let d = $('sgReady');
    if (!d) {
      document.body.insertAdjacentHTML('beforeend', '<div id="sgReady" style="position:fixed;inset:0;z-index:9100;background:rgba(15,23,42,.55);display:grid;place-items:center;direction:rtl;padding:16px"><div class="sg-card" style="max-width:380px;width:100%" id="sgReadyIn"></div></div>');
      d = $('sgReady');
      d.addEventListener('click', (ev) => { if (ev.target === d) closeReady(); });
    }
    d.style.display = 'grid';
    const canShare = pdf && navigator.canShare && (() => { try { return navigator.canShare({ files: [new File([pdf.blob], pdf.name, { type: 'application/pdf' })] }); } catch (_) { return false; } })();
    $('sgReadyIn').innerHTML = !pdf ? '<b style="font-size:16px">🖨️ מכין את הקובץ להדפסה…</b><div class="sg-mut" style="margin-top:6px">רגע אחד.</div>'
      : '<b style="font-size:16px">🖨️ ' + e(name.replace(/\.pdf$/, '')) + ' — מוכן</b>' +
        '<div class="sg-mut" style="margin:6px 0 10px">בוחרים את מדפסת הלייזר, נייר A4, ומכניסים את הנייר המודפס למגש הידני.</div>' +
        (canShare ? '<button class="sg-btn sg-ok" id="sgShare" style="width:100%;font-size:16px">📤 שיתוף ← הדפסה</button>' : '') +
        '<button class="sg-btn ' + (canShare ? '' : 'sg-ok') + '" id="sgOpenPdf" style="width:100%;margin-top:8px;font-size:15px">📄 פתיחת הקובץ להדפסה</button>' +
        '<button class="sg-btn" id="sgReadyX" style="width:100%;margin-top:8px">סגירה</button>' +
        '<div class="sg-mut" style="margin-top:8px">באייפון: "שיתוף" ← <b>הדפסה</b>. בקובץ שנפתח — כפתור השיתוף ← הדפסה.</div>';
    if (!pdf) return;
    if ($('sgShare')) $('sgShare').addEventListener('click', async () => {
      try { await navigator.share({ files: [new File([pdf.blob], pdf.name, { type: 'application/pdf' })], title: pdf.name }); }
      catch (x) { if (!/Abort/i.test(String(x && x.name))) openPdf(pdf); }
    });
    $('sgOpenPdf').addEventListener('click', () => openPdf(pdf));
    $('sgReadyX').addEventListener('click', closeReady);
  }
  function closeReady() { const d = $('sgReady'); if (d) d.style.display = 'none'; }
  function openPdf(pdf) {
    const w = window.open(pdf.url, '_blank');
    if (!w) { const a = document.createElement('a'); a.href = pdf.url; a.download = pdf.name; document.body.appendChild(a); a.click(); a.remove(); }
  }

  /* ---------- 📐 the calibration, per paper kind ---------- */
  function showCal() {
    camStop();
    const k = kind, c = cal(k), P = PAPERS[k];
    const row = (lbl, val) => '<div class="sg-mut" style="text-align:center;font-weight:800;color:#0f172a">' + lbl + ': <span dir="ltr">' + val + '</span></div>';
    $('sgEdit').innerHTML = '<b style="font-size:15px">📐 כיול — ' + e(P.name) + '</b>' +
      '<ol class="sg-mut" style="padding-inline-start:18px;margin:8px 0">' +
      '<li>מדפיסים <b>דף בדיקה</b> על נייר לבן רגיל.</li><li>מניחים אותו על הנייר המודפס של ' + e(P.name) + ' מול האור (חלון / מנורה).</li>' +
      '<li>מזיזים בחצים עד שהקווים המקווקווים יושבים על המסגרות הלבנות, ומדפיסים שוב לבדיקה.</li><li>הנייר נכנס למגש הידני באותו כיוון כמו דף הבדיקה.</li></ol>' +
      row('הזזה', (c.dx > 0 ? '+' : '') + c.dx + ' / ' + (c.dy > 0 ? '+' : '') + c.dy + ' מ"מ') +
      '<div class="sg-cal"><span></span><button class="sg-btn" data-m="0,-1">⬆ למעלה</button><span></span>' +
      '<button class="sg-btn" data-m="1,0">➡ ימינה</button><button class="sg-btn" data-m="reset">איפוס</button><button class="sg-btn" data-m="-1,0">⬅ שמאלה</button>' +
      '<span></span><button class="sg-btn" data-m="0,1">⬇ למטה</button><span></span></div>' +
      row('גודל', c.sc.toFixed(1) + '%') +
      '<div class="sg-cal" style="grid-template-columns:1fr 1fr"><button class="sg-btn" data-s="-0.5">➖ קטן יותר</button><button class="sg-btn" data-s="0.5">➕ גדול יותר</button></div>' +
      '<div class="sg-acts"><button class="sg-btn sg-pri" id="sgTest" style="flex:1">🖨️ דף בדיקה</button><button class="sg-btn" id="sgCalDone">✓ סיום</button></div>' +
      '<div class="sg-mut" style="margin-top:8px">הכיול נשמר בטלפון הזה, לכל סוג נייר בנפרד. בדיאלוג ההדפסה: גודל A4, בלי התאמה לעמוד.</div>';
    $('sgEdit').querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      const n = cal(k);
      if (b.dataset.m === 'reset') { n.dx = 0; n.dy = 0; n.sc = 100; } else { const [x, y] = b.dataset.m.split(',').map(Number); n.dx = Math.round((n.dx + x) * 2) / 2; n.dy = Math.round((n.dy + y) * 2) / 2; }
      setCal(k, n); showCal();
    }));
    $('sgEdit').querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { const n = cal(k); n.sc = Math.max(90, Math.min(110, Math.round((n.sc + Number(b.dataset.s)) * 10) / 10)); setCal(k, n); showCal(); }));
    $('sgTest').addEventListener('click', () => print(true, k));
    $('sgCalDone').addEventListener('click', drawEdit);
  }

  /* ---------- the menu item ---------- */
  function start() {
    const drop = $('menuOpsDrop') || $('menuBizDrop');
    if (drop && !$('signsBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="signsBtn">🏷️ שילוט</button>');
      $('signsBtn').addEventListener('click', open);
    }
    empItem();
  }
  // the employees: "📅 סידור עבודה ונוכחות" (employee-menus.js builds it after the sign-in)
  function empItem() {
    const d = $('emSchedDrop');
    if (!d || $('signsEmpBtn')) return;
    d.insertAdjacentHTML('beforeend', '<button type="button" id="signsEmpBtn" role="menuitem">🏷️ שילוט</button>');
    $('signsEmpBtn').addEventListener('click', open);
  }
  new MutationObserver(() => { if (!$('signsEmpBtn') && $('emSchedDrop')) empItem(); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openSigns = open;
})();
