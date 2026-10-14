// Customer club — the SMS sending page (admins; Superstar only). ⚙ ניהול ← "📣 מועדון — שליחת SMS".
//   📤 new sending: an Excel of customers (phone, ID number, first / last name — the columns found by their headings, or
//      chosen) → checked and previewed → the message ({שם} = the first name; the personal link "לעדכון/הסרה" is added
//      at the end) → a test to my phone → "יצירת השליחה" (clubInvitesImport: each customer his own link club?i=…,
//      skipping who asked for no messages and — by choice — who already updated).
//   📊 sendings: each with its numbers (sent / delivered / opened / filled) and "▶ שליחה" — 60 at a time until done.
// Server: supabase/functions/api/club.ts. The page the customer opens: club.html?i=<token>.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const isAdmin = () => { try { return state.mgr && state.mgr.role === 'אדמין'; } catch (x) { return false; } };
  const LINK = '\nלעדכון/הסרה: superstar-plus.co.il/club?i=xxxxxxxx';
  // short on purpose: with the link it stays 2 SMS parts (no emoji — one counts as two characters, and old phones show a box)
  const DEFAULT_MSG = '{שם}, עדכנו פרטים במועדון סופרסטאר וקבלו מבצעים, הטבות ומתנה ליום ההולדת!';
  const idOk = (raw) => {
    const d = String(raw || '').replace(/\D/g, ''); if (d.length < 5 || d.length > 9) return false;
    const id = d.padStart(9, '0'); let s = 0;
    for (let i = 0; i < 9; i++) { let n = +id[i] * ((i % 2) + 1); if (n > 9) n -= 9; s += n; }
    return s % 10 === 0 && id !== '000000000';
  };
  const phoneOk = (raw) => /^05\d{8}$/.test(String(raw || '').replace(/[^\d+]/g, '').replace(/^\+?972/, '0').replace(/^5/, '05'));
  const parts = (text) => { const latin = /^[\x20-\x7e\r\n]*$/.test(text), n = text.length; return latin ? (n <= 160 ? 1 : Math.ceil(n / 153)) : (n <= 70 ? 1 : Math.ceil(n / 67)); };   // UTF-16 units: an emoji = 2

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#csOv .modal{max-width:880px}#csOv .mbody{overflow-x:hidden}#csOv .row>label.c{flex:1 1 130px;min-width:0}#csOv .row select{width:100%}#csOv .tabs{display:flex;gap:6px;margin-bottom:12px}#csOv .tabs button{border:1.5px solid #d1d5db;background:#fff;border-radius:99px;padding:6px 14px;font:inherit;font-weight:700;cursor:pointer}' +
    '#csOv .tabs button.on{background:#1b2a4a;color:#fff;border-color:#1b2a4a}#csOv .box{border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-bottom:12px;background:#fff}' +
    '#csOv h4{margin:0 0 8px}#csOv .row{display:flex;gap:8px;flex-wrap:wrap;align-items:end}#csOv label.c{display:grid;gap:3px;font-size:13px;font-weight:700}' +
    '#csOv select,#csOv input[type=text],#csOv input[type=tel],#csOv textarea{border:1.5px solid #d1d5db;border-radius:8px;padding:6px 8px;font:inherit;font-size:13.5px}' +
    '#csOv textarea{width:100%;box-sizing:border-box}#csOv table{width:100%;border-collapse:collapse;font-size:12.5px}#csOv th,#csOv td{border-bottom:1px solid #f1f5f9;padding:4px 6px;text-align:right}' +
    '#csOv .bad{color:#b91c1c}#csOv .ok{color:#166534}#csOv .note{font-size:12.5px;color:#64748b}#csOv .warn{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 10px;font-size:13px;margin-bottom:10px}' +
    '#csOv .stats{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}#csOv .stats span{background:#f1f5f9;border-radius:99px;padding:2px 10px;font-size:12.5px}' +
    '#csOv .bar{height:8px;background:#e5e7eb;border-radius:99px;overflow:hidden;margin-top:6px}#csOv .bar i{display:block;height:100%;background:#0076DA;width:0}' +
    '</style>');

  function overlay() {
    if (!$('csOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div class="overlay hidden" id="csOv" style="z-index:2100"><div class="modal">' +
        '<header><h3>📣 מועדון לקוחות — שליחת SMS</h3><p>הזמנה אישית לעדכון פרטים — כל לקוח מקבל קישור משלו, והטופס נפתח עם הפרטים שכבר מוכרים</p></header>' +
        '<div class="mbody" id="csB"></div><div class="mfoot"><span class="spacer"></span><button class="btn plain" id="csClose">סגירה</button></div></div></div>');
      $('csClose').addEventListener('click', () => { stop = true; $('csOv').classList.add('hidden'); });
    }
    $('csOv').classList.remove('hidden');
    return $('csB');
  }

  let tab = 'new', info = null, rows = [], head = [], map = {}, stop = false;
  async function open() {
    const b = overlay();
    b.innerHTML = '<p class="note">טוען…</p>';
    info = await apiPost({ action: 'clubBatches', ...mAuth() });
    if (!info.ok) { b.innerHTML = '<p class="bad">' + e(info.error || 'שגיאה') + '</p>'; return; }
    draw();
  }
  function draw() {
    const b = $('csB');
    b.innerHTML = '<div class="tabs"><button data-t="new">📤 שליחה חדשה</button><button data-t="list">📊 שליחות (' + info.batches.length + ')</button></div>' +
      (info.smsReady ? '' : '<div class="warn">⚠ שליחת SMS עוד לא הופעלה במערכת (חסר חיבור לספק). אפשר כבר להכין שליחות — השליחה עצמה תיפתח עם ההפעלה.</div>') +
      '<div id="csP"></div>';
    b.querySelectorAll('[data-t]').forEach((x) => { x.classList.toggle('on', x.dataset.t === tab); x.addEventListener('click', () => { tab = x.dataset.t; draw(); }); });
    if (tab === 'new') drawNew(); else drawList();
  }

  /* ---------- 📤 a new sending ---------- */
  const ROLES = [['phone', 'טלפון *', /טלפון|נייד|פלאפון|סלולרי|phone|mobile|tel/i], ['id', 'ת.ז. *', /ת\.?\s*ז|תעודת|זהות|^id$|id ?number/i],
    ['first', 'שם פרטי', /שם פרטי|first/i], ['last', 'שם משפחה', /שם משפחה|משפחה|last|surname/i], ['full', 'שם מלא (אם אין פרטי/משפחה)', /^שם$|שם מלא|שם לקוח|^name$|full ?name/i]];
  function guess() {
    map = {};
    ROLES.forEach(([k, , re]) => { const i = head.findIndex((h, j) => re.test(String(h || '')) && !Object.values(map).includes(j)); if (i >= 0) map[k] = i; });
  }
  const cell = (r, k) => (map[k] === undefined || map[k] === '' ? '' : String(r[map[k]] == null ? '' : r[map[k]]).trim());
  function mapped() {
    return rows.map((r, i) => {
      let first = cell(r, 'first'), last = cell(r, 'last');
      if (!first && !last && cell(r, 'full')) { const p = cell(r, 'full').split(/\s+/); first = p.shift() || ''; last = p.join(' '); }
      let phone = cell(r, 'phone').replace(/[^\d+]/g, '');
      if (/^5\d{8}$/.test(phone)) phone = '0' + phone;   // Excel drops the leading 0
      let id = cell(r, 'id').replace(/\D/g, '');
      return { row: i + 2, phone, idNumber: id, firstName: first, lastName: last, okPhone: phoneOk(phone), okId: idOk(id) };
    });
  }
  function drawNew() {
    const p = $('csP');
    const today = new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
    p.innerHTML = '<div class="box"><h4>1. קובץ הלקוחות</h4><input type="file" id="csFile" accept=".xlsx,.xls,.csv">' +
      '<p class="note">אקסל עם שורת כותרות. חובה: טלפון נייד ותעודת זהות; רצוי: שם פרטי ושם משפחה (או שם מלא).</p><div id="csMap"></div></div>' +
      '<div class="box"><h4>2. ההודעה</h4><div class="row"><label class="c" style="flex:1">שם השליחה (לזיהוי)<input type="text" id="csName" value="עדכון פרטים — ' + today + '"></label></div>' +
      '<label class="c" style="margin-top:8px">נוסח ה-SMS — {שם} יוחלף בשם הפרטי<textarea id="csMsg" rows="3" maxlength="400"></textarea></label>' +
      '<div class="note" id="csLen"></div><div class="note">בסוף כל הודעה נוסף אוטומטית: <span dir="ltr">' + e(LINK.trim()) + '</span> — קישור אישי לכל לקוח.' +
      (info.sender ? ' שם השולח: <b dir="ltr">' + e(info.sender) + '</b> (משנים בגיוס עובדים ← 📱 SMS).' : '') + '</div>' +
      '<label style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:13px"><input type="checkbox" id="csSkip" checked> לדלג על לקוחות שכבר עדכנו פרטים במועדון</label>' +
      '<div class="row" style="margin-top:8px"><label class="c">בדיקה — לשלוח אליי<input type="tel" id="csTestPh" placeholder="05X-XXXXXXX" dir="ltr"></label><button class="btn plain" id="csTest"' + (info.smsReady ? '' : ' disabled') + '>📱 שליחת בדיקה</button></div></div>' +
      '<div class="box"><h4>3. יצירה</h4><div id="csSum" class="note">בוחרים קובץ כדי להמשיך.</div><button class="btn primary" id="csCreate" disabled style="margin-top:8px">יצירת השליחה</button><div id="csRes"></div></div>';
    $('csMsg').value = DEFAULT_MSG;
    const len = () => { const t = $('csMsg').value.replace(/\{שם\}/g, 'ישראל') + LINK; const n = parts(t); $('csLen').textContent = [...t].length + ' תווים עם הקישור · ' + n + ' ' + (n === 1 ? 'מקטע' : 'מקטעים') + ' להודעה'; summary(); };
    $('csMsg').addEventListener('input', len); len();
    $('csFile').addEventListener('change', async () => {
      const f = $('csFile').files[0]; if (!f) return;
      try {
        await loadScript(XLSX_URL);
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        const all = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }).filter((r) => r.some((c) => String(c).trim()));
        head = (all.shift() || []).map((h) => String(h).trim()); rows = all;
        guess(); drawMap();
      } catch (x) { $('csMap').innerHTML = '<p class="bad">לא הצלחתי לקרוא את הקובץ: ' + e(x.message) + '</p>'; }
    });
    $('csTest').addEventListener('click', async () => {
      const x = await apiPost({ action: 'clubTestSms', ...mAuth(), phone: $('csTestPh').value, message: $('csMsg').value });
      say(x.ok ? 'נשלחה הודעת בדיקה ✓' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err');
    });
    $('csCreate').addEventListener('click', create);
  }
  function drawMap() {
    const opts = (k) => '<option value="">—</option>' + head.map((h, i) => '<option value="' + i + '"' + (map[k] === i ? ' selected' : '') + '>' + e(h || 'עמודה ' + (i + 1)) + '</option>').join('');
    $('csMap').innerHTML = '<div class="row" style="margin-top:8px">' + ROLES.map(([k, l]) => '<label class="c">' + l + '<select data-k="' + k + '">' + opts(k) + '</select></label>').join('') + '</div><div id="csPrev"></div>';
    $('csMap').querySelectorAll('[data-k]').forEach((s) => s.addEventListener('change', () => { map[s.dataset.k] = s.value === '' ? undefined : Number(s.value); preview(); }));
    preview();
  }
  function preview() {
    const m = mapped();
    $('csPrev').innerHTML = '<table style="margin-top:8px"><tr><th>שורה</th><th>שם</th><th>טלפון</th><th>ת.ז.</th></tr>' + m.slice(0, 6).map((r) =>
      '<tr><td>' + r.row + '</td><td>' + e((r.firstName + ' ' + r.lastName).trim() || '—') + '</td><td dir="ltr" class="' + (r.okPhone ? '' : 'bad') + '">' + e(r.phone || '—') + '</td>' +
      '<td dir="ltr" class="' + (r.okId ? '' : 'bad') + '">' + e(r.idNumber ? '•••••' + r.idNumber.slice(-4) : '—') + '</td></tr>').join('') + '</table>';
    summary();
  }
  function summary() {
    if (!$('csSum')) return;
    if (!rows.length) { $('csSum').textContent = 'בוחרים קובץ כדי להמשיך.'; $('csCreate').disabled = true; return; }
    const m = mapped(), good = m.filter((r) => r.okPhone && r.okId).length, n = parts($('csMsg').value.replace(/\{שם\}/g, 'ישראל') + LINK);
    $('csSum').innerHTML = rows.length + ' שורות בקובץ · <span class="ok">' + good + ' תקינות</span>' + (good < rows.length ? ' · <span class="bad">' + (rows.length - good) + ' עם טלפון או ת.ז. לא תקינים (ידולגו)</span>' : '') +
      ' · עד ' + (good * n) + ' מקטעי SMS. השרת ידלג גם על כפולים ועל מי שביקש לא לקבל הודעות.';
    $('csCreate').disabled = !good || map.phone === undefined || map.id === undefined;
  }
  async function create() {
    const m = mapped().filter((r) => r.phone || r.idNumber);
    $('csCreate').disabled = true; $('csRes').innerHTML = '<p class="note">יוצר…</p>';
    const x = await apiPost({ action: 'clubInvitesImport', ...mAuth(), name: $('csName').value, message: $('csMsg').value, skipUpdated: $('csSkip').checked,
      rows: m.map(({ row, phone, idNumber, firstName, lastName }) => ({ row, phone, idNumber, firstName, lastName })) });
    const extra = x.invalidCount !== undefined ? '<p class="note">' + [x.invalidCount ? x.invalidCount + ' שורות לא תקינות' : '', x.dup ? x.dup + ' כפולים' : '', x.optout ? x.optout + ' ביקשו לא לקבל הודעות' : '',
      x.already ? x.already + ' כבר עדכנו פרטים' : ''].filter(Boolean).join(' · ') + (x.invalid && x.invalid.length ? '<br>שורות לא תקינות: ' + x.invalid.slice(0, 30).map((r) => r.row + ' (' + r.reason + ')').join(', ') : '') + '</p>' : '';
    if (!x.ok) { $('csRes').innerHTML = '<p class="bad">' + e(x.error || 'שגיאה') + '</p>' + extra; $('csCreate').disabled = false; return; }
    say('השליחה נוצרה ✓ — ' + x.created + ' לקוחות', 'ok');
    info = await apiPost({ action: 'clubBatches', ...mAuth() });
    tab = 'list'; rows = []; draw();
    $('csP').insertAdjacentHTML('afterbegin', '<div class="box ok">✓ נוצרה שליחה ל-' + x.created + ' לקוחות.' + extra + '</div>');
  }

  /* ---------- 📊 the sendings ---------- */
  function drawList() {
    const p = $('csP');
    if (!info.batches.length) { p.innerHTML = '<p class="note">עוד אין שליחות.</p>'; return; }
    const pct = (a, b) => (b ? Math.round(a * 100 / b) + '%' : '—');
    p.innerHTML = '<div style="text-align:left;margin-bottom:6px"><button class="btn plain" id="csRef">↻ רענון</button></div>' + info.batches.map((b) =>
      '<div class="box" data-b="' + b.id + '"><div class="row" style="justify-content:space-between"><b>' + e(b.name) + '</b><span class="note">' + e(new Date(b.at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + ' · ' + e(b.by || '') + '</span></div>' +
      '<div class="stats"><span>' + b.total + ' לקוחות</span><span>נשלחו ' + b.sent + '</span><span class="ok">נמסרו ' + b.delivered + '</span>' + (b.notDelivered ? '<span class="bad">לא נמסרו ' + b.notDelivered + '</span>' : '') +
        (b.failed ? '<span class="bad">נכשלו ' + b.failed + '</span>' : '') + (b.skipped ? '<span>דולגו ' + b.skipped + '</span>' : '') + '<span>פתחו ' + b.opened + ' (' + pct(b.opened, b.sent) + ')</span><span class="ok"><b>עדכנו ' + b.submitted + ' (' + pct(b.submitted, b.sent) + ')</b></span></div>' +
      '<div class="note" style="white-space:pre-wrap">' + e(b.message) + '</div>' +
      (b.waiting ? '<div class="row" style="margin-top:8px"><button class="btn primary" data-send="' + b.id + '"' + (info.smsReady ? '' : ' disabled') + '>▶ שליחה ל-' + b.waiting + ' שממתינים</button><span class="note" data-prog="' + b.id + '"></span></div><div class="bar"><i data-bar="' + b.id + '"></i></div>' : '') +
      '</div>').join('');
    $('csRef').addEventListener('click', async () => { info = await apiPost({ action: 'clubBatches', ...mAuth() }); if (info.ok) draw(); });
    p.querySelectorAll('[data-send]').forEach((btn) => btn.addEventListener('click', () => send(Number(btn.dataset.send), btn)));
  }
  async function send(id, btn) {
    const b = info.batches.find((x) => x.id === id);
    if (!confirm('לשלוח SMS ל-' + b.waiting + ' לקוחות בשליחה "' + b.name + '"?')) return;
    stop = false; btn.disabled = true;
    const prog = document.querySelector('[data-prog="' + id + '"]'), bar = document.querySelector('[data-bar="' + id + '"]');
    let sent = 0, failed = 0, left = b.waiting;
    while (left > 0 && !stop) {
      const x = await apiPost({ action: 'clubBatchSend', ...mAuth(), batchId: id, max: 60 });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); break; }
      sent += x.sent; failed += x.failed; left = x.remaining;
      prog.textContent = 'נשלחו ' + sent + (failed ? ' · נכשלו ' + failed : '') + ' · נותרו ' + left;
      bar.style.width = Math.round((b.waiting - left) * 100 / b.waiting) + '%';
      if (!x.sent && !x.failed && left) break;   // nothing moved — stop rather than loop
    }
    say('נשלחו ' + sent + ' הודעות' + (failed ? ', ' + failed + ' נכשלו' : ''), failed ? 'err' : 'ok');
    info = await apiPost({ action: 'clubBatches', ...mAuth() }); if (info.ok && $('csOv') && !$('csOv').classList.contains('hidden')) draw();
  }

  /* ---------- wiring: ⚙ ניהול (admins) ---------- */
  function start() {
    const drop = $('menuAdminDrop');
    if (drop && !$('csMgrBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="csMgrBtn" style="display:none">📣 מועדון — שליחת SMS</button>');
      $('csMgrBtn').addEventListener('click', open);
    }
    const sync = () => { if ($('csMgrBtn')) $('csMgrBtn').style.display = isAdmin() ? '' : 'none'; };
    sync(); setInterval(sync, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
