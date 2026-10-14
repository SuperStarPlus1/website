// The customer club's SMS sending page (club-send.html) — on the marketing site, apart from the management system.
//   in:            an allowed e-mail address → a one-time code by e-mail → a 12-hour session (kept in this tab only)
//   📤 new sending: an Excel of customers (phone, ID number, first / last name — the columns found by their headings, or
//      chosen) → checked and previewed → the message ({שם} = the first name; the personal link "לעדכון/הסרה" is added at
//      the end) → a test to my phone → "יצירת השליחה" (clubInvitesImport: each customer his own link club?i=…, skipping
//      who asked for no messages and — by choice — who already updated).
//   📊 sendings: each with its numbers (sent / delivered / opened / filled), "▶ שליחה עכשיו" — 60 at a time until done —
//      or "⏰ תזמון" to a date and time (Israel): the server sends it then by itself (within 5 minutes), the page may be closed.
//   👤 members: the club's members — search, a card (details, every form, every consent / withdrawal), export to Excel.
//   👥 allowed: the addresses that may come in.
// Server: supabase/functions/api/club.ts. The page the customer opens: club.html?i=<token>.
(function () {
  'use strict';
  const API = 'https://otjhhljgdevazanrretx.supabase.co/functions/v1/api';
  const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k) { try { return sessionStorage.getItem(k) || ''; } catch (x) { return ''; } }, set(k, v) { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch (x) { /* private mode */ } } };
  let ct = store.get('clubSendToken'), me = store.get('clubSendEmail');
  const say = (m, c) => { const t = document.createElement('div'); t.className = 'toast' + (c === 'err' ? ' err' : ''); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); };
  const loadScript = (src) => new Promise((res, rej) => { if (document.querySelector('script[src="' + src + '"]')) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  async function api(body) {
    let r;
    try { r = await (await fetch(API, { method: 'POST', body: JSON.stringify({ ...body, ct }) })).json(); } catch (x) { r = { ok: false, error: 'אין חיבור — נסו שוב' }; }
    if (r && r.signIn) signOut(false);
    return r;
  }
  const LINK = '\nלעדכון/הסרה: superstar-plus.co.il/club?i=xxxxxxxx';
  // short on purpose: with the link it stays 2 SMS parts (no emoji — one counts as two characters, and old phones show a box)
  const DEFAULT_MSG = '{שם}, עדכנו פרטים במועדון סופרסטאר וקבלו מבצעים, הטבות ומתנה ליום ההולדת!';
  const idOk = (raw) => {
    const d = String(raw || '').replace(/\D/g, ''); if (d.length < 5 || d.length > 9) return false;
    const id = d.padStart(9, '0'); let s = 0;
    for (let i = 0; i < 9; i++) { let n = +id[i] * ((i % 2) + 1); if (n > 9) n -= 9; s += n; }
    return s % 10 === 0 && id !== '000000000';
  };
  // the schedule: a date-time input in Israel time ('yyyy-mm-ddThh:mm'), shown as dd/mm hh:mm
  const pad = (n) => String(n).padStart(2, '0');
  const localInput = (d) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value])); return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute; };
  const whenIL = (v) => { const s = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? v : localInput(new Date(v)); return ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][new Date(s.slice(0, 10) + 'T12:00:00').getDay()] + ' ' + s.slice(8, 10) + '/' + s.slice(5, 7) + ' ' + s.slice(11, 16); };
  /** a word of caution: messages at night, on Friday afternoon or on Saturday annoy (and a holiday is not checked) */
  const offHours = (v) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return '';
    const day = new Date(v.slice(0, 10) + 'T12:00:00').getDay(), h = Number(v.slice(11, 13));
    if (day === 6) return '⚠ שבת — לא מומלץ לשלוח הודעות שיווקיות בשבת.';
    if (day === 5 && h >= 14) return '⚠ יום שישי אחה"צ — לא מומלץ (כניסת שבת).';
    if (h < 9 || h >= 21) return '⚠ מחוץ לשעות 09:00–21:00 — לא מומלץ לשלוח הודעות בשעה הזו.';
    return '';
  };
  const phoneOk = (raw) => /^05\d{8}$/.test(String(raw || '').replace(/[^\d+]/g, '').replace(/^\+?972/, '0'));
  const parts = (text) => { const latin = /^[\x20-\x7e\r\n]*$/.test(text), n = text.length; return latin ? (n <= 160 ? 1 : Math.ceil(n / 153)) : (n <= 70 ? 1 : Math.ceil(n / 67)); };   // UTF-16 units: an emoji = 2

  /* ---------- in: an allowed address → a one-time code ---------- */
  function signOut(call) {
    if (call && ct) fetch(API, { method: 'POST', body: JSON.stringify({ action: 'clubSendLogout', ct }) }).catch(() => {});
    ct = ''; me = ''; store.set('clubSendToken', ''); store.set('clubSendEmail', '');
    login();
  }
  $('out').addEventListener('click', () => signOut(true));
  function login() {
    $('who').textContent = ''; $('out').hidden = true;
    $('app').innerHTML = '<div class="login"><h2>כניסה</h2><p>הדף מיועד לצוות המורשה בלבד. נשלח קוד חד-פעמי לכתובת המייל שלכם.</p>' +
      '<div id="lgStep1"><input type="email" id="lgEmail" placeholder="name@example.com" autocomplete="email"><button class="btn primary" id="lgSend">שליחת קוד</button></div>' +
      '<div id="lgStep2" hidden><p id="lgSent"></p><input class="code" id="lgCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••">' +
      '<button class="btn primary" id="lgGo">כניסה</button><p style="margin:10px 0 0"><button class="btn" id="lgBack" style="width:auto;padding:4px 10px;font-weight:400">כתובת אחרת / קוד חדש</button></p></div>' +
      '<div class="err" id="lgErr"></div></div>';
    $('lgEmail').focus();
    const send = async () => {
      $('lgErr').textContent = ''; $('lgSend').disabled = true;
      const r = await api({ action: 'clubSendCode', email: $('lgEmail').value.trim() });
      $('lgSend').disabled = false;
      if (!r.ok) { $('lgErr').textContent = r.error || 'שגיאה'; return; }
      $('lgStep1').hidden = true; $('lgStep2').hidden = false;
      $('lgSent').textContent = 'אם הכתובת ' + $('lgEmail').value.trim() + ' מורשית — נשלח אליה קוד בן 6 ספרות (בתוקף 10 דקות).';
      $('lgCode').focus();
    };
    let busy = false;
    const go = async () => {
      if (busy) return; busy = true;
      $('lgErr').textContent = ''; $('lgGo').disabled = true;
      const r = await api({ action: 'clubSendVerify', email: $('lgEmail').value.trim(), code: $('lgCode').value.trim() });
      $('lgGo').disabled = false; busy = false;
      if (!r.ok) { $('lgErr').textContent = r.error || 'שגיאה'; return; }
      ct = r.token; me = r.email; store.set('clubSendToken', ct); store.set('clubSendEmail', me);
      open();
    };
    $('lgSend').addEventListener('click', send);
    $('lgEmail').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') send(); });
    $('lgGo').addEventListener('click', go);
    $('lgCode').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
    $('lgCode').addEventListener('input', () => { if (/^\d{6}$/.test($('lgCode').value.trim())) go(); });
    $('lgBack').addEventListener('click', () => { $('lgStep2').hidden = true; $('lgStep1').hidden = false; $('lgCode').value = ''; });
  }

  let tab = 'new', info = null, rows = [], head = [], map = {}, stop = false;
  async function open() {
    $('who').textContent = me; $('out').hidden = false;
    $('app').innerHTML = '<p class="note">טוען…</p>';
    info = await api({ action: 'clubBatches' });
    if (!info.ok) { if (ct) $('app').innerHTML = '<p class="bad">' + e(info.error || 'שגיאה') + '</p>'; return; }
    draw();
  }
  function draw() {
    const b = $('app');
    b.innerHTML = '<div class="tabs"><button data-t="new">📤 שליחה חדשה</button><button data-t="list">📊 שליחות (' + info.batches.length + ')</button><button data-t="members">👤 חברי מועדון</button><button data-t="who">👥 מורשים</button></div>' +
      (info.smsReady ? '' : '<div class="warn">⚠ שליחת SMS עוד לא הופעלה (חסר חיבור לספק ה-SMS). אפשר כבר להכין שליחות — השליחה עצמה תיפתח עם ההפעלה.</div>') +
      '<div id="csP"></div>';
    b.querySelectorAll('[data-t]').forEach((x) => { x.classList.toggle('on', x.dataset.t === tab); x.addEventListener('click', () => { tab = x.dataset.t; draw(); }); });
    if (tab === 'new') drawNew(); else if (tab === 'list') drawList(); else if (tab === 'members') drawMembers(); else drawWho();
  }

  /* ---------- 📤 a new sending ---------- */
  const ROLES = [['phone', 'טלפון *', /טלפון|נייד|פלאפון|סלולרי|phone|mobile|tel/i], ['id', 'ת.ז. *', /ת\.?\s*ז|תעודת|זהות|^id$|id ?number/i],
    ['card', 'מס׳ כרטיס מועדון', /כרטיס|מועדון|card|member/i],
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
      const id = cell(r, 'id').replace(/\D/g, '');
      return { row: i + 2, phone, idNumber: id, firstName: first, lastName: last, cardNo: cell(r, 'card').replace(/\s+/g, ''), okPhone: phoneOk(phone), okId: idOk(id) };
    });
  }
  function drawNew() {
    const p = $('csP');
    const today = new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
    p.innerHTML = '<div class="box"><h4>1. קובץ הלקוחות</h4><input type="file" id="csFile" accept=".xlsx,.xls,.csv">' +
      '<p class="note">אקסל עם שורת כותרות. חובה: טלפון נייד ותעודת זהות; רצוי: מס׳ כרטיס מועדון (מוצג ללקוח בטופס, לא לעריכה — ומשמש לעדכון קומקס), שם פרטי ושם משפחה (או שם מלא).</p><div id="csMap"></div></div>' +
      '<div class="box"><h4>2. ההודעה</h4><div class="row"><label class="c">שם השליחה (לזיהוי)<input type="text" id="csName" value="עדכון פרטים — ' + today + '"></label></div>' +
      '<label class="c" style="margin-top:8px">נוסח ה-SMS — {שם} יוחלף בשם הפרטי<textarea id="csMsg" rows="3" maxlength="400"></textarea></label>' +
      '<div class="note" id="csLen"></div><div class="note">בסוף כל הודעה נוסף אוטומטית: <span dir="ltr">' + e(LINK.trim()) + '</span> — קישור אישי לכל לקוח.' +
      (info.sender ? ' שם השולח: <b dir="ltr">' + e(info.sender) + '</b>.' : '') + '</div>' +
      '<label style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:13px"><input type="checkbox" id="csSkip" checked> לדלג על לקוחות שכבר עדכנו פרטים במועדון</label>' +
      '<div class="row" style="margin-top:8px"><label class="c">בדיקה — לשלוח אליי<input type="tel" id="csTestPh" placeholder="05X-XXXXXXX" dir="ltr"></label><button class="btn" id="csTest"' + (info.smsReady ? '' : ' disabled') + '>📱 שליחת בדיקה</button></div></div>' +
      '<div class="box"><h4>3. יצירה</h4><div id="csSum" class="note">בוחרים קובץ כדי להמשיך.</div><button class="btn primary" id="csCreate" disabled style="margin-top:8px">יצירת השליחה</button><div id="csRes"></div></div>';
    $('csMsg').value = DEFAULT_MSG;
    const len = () => { const t = $('csMsg').value.replace(/\{שם\}/g, 'ישראל') + LINK; const n = parts(t); $('csLen').textContent = t.length + ' תווים עם הקישור · ' + n + ' ' + (n === 1 ? 'מקטע' : 'מקטעים') + ' להודעה'; summary(); };
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
      const x = await api({ action: 'clubTestSms', phone: $('csTestPh').value, message: $('csMsg').value });
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
    $('csPrev').innerHTML = '<table style="margin-top:8px"><tr><th>שורה</th><th>כרטיס</th><th>שם</th><th>טלפון</th><th>ת.ז.</th></tr>' + m.slice(0, 6).map((r) =>
      '<tr><td>' + r.row + '</td><td dir="ltr">' + e(r.cardNo || '—') + '</td><td>' + e((r.firstName + ' ' + r.lastName).trim() || '—') + '</td><td dir="ltr" class="' + (r.okPhone ? '' : 'bad') + '">' + e(r.phone || '—') + '</td>' +
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
    const x = await api({ action: 'clubInvitesImport', name: $('csName').value, message: $('csMsg').value, skipUpdated: $('csSkip').checked,
      rows: m.map(({ row, phone, idNumber, firstName, lastName, cardNo }) => ({ row, phone, idNumber, firstName, lastName, cardNo })) });
    const extra = x.invalidCount !== undefined ? '<p class="note">' + [x.invalidCount ? x.invalidCount + ' שורות לא תקינות' : '', x.dup ? x.dup + ' כפולים' : '', x.optout ? x.optout + ' ביקשו לא לקבל הודעות' : '',
      x.already ? x.already + ' כבר עדכנו פרטים' : ''].filter(Boolean).join(' · ') + (x.invalid && x.invalid.length ? '<br>שורות לא תקינות: ' + x.invalid.slice(0, 30).map((r) => r.row + ' (' + r.reason + ')').join(', ') : '') + '</p>' : '';
    if (!x.ok) { $('csRes').innerHTML = '<p class="bad">' + e(x.error || 'שגיאה') + '</p>' + extra; $('csCreate').disabled = false; return; }
    say('השליחה נוצרה ✓ — ' + x.created + ' לקוחות', 'ok');
    info = await api({ action: 'clubBatches' });
    tab = 'list'; rows = []; draw();
    $('csP').insertAdjacentHTML('afterbegin', '<div class="box ok">✓ נוצרה שליחה ל-' + x.created + ' לקוחות.' + extra + '</div>');
  }

  /* ---------- 📊 the sendings ---------- */
  function drawList() {
    const p = $('csP');
    if (!info.batches.length) { p.innerHTML = '<p class="note">עוד אין שליחות.</p>'; return; }
    const pct = (a, b) => (b ? Math.round(a * 100 / b) + '%' : '—');
    p.innerHTML = '<div style="text-align:left;margin-bottom:6px"><button class="btn" id="csRef">↻ רענון</button></div>' + info.batches.map((b) =>
      '<div class="box" data-b="' + b.id + '"><div class="row" style="justify-content:space-between"><b>' + e(b.name) + '</b><span class="note">' + e(new Date(b.at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + ' · ' + e(b.by || '') + '</span></div>' +
      '<div class="stats"><span>' + b.total + ' לקוחות</span><span>נשלחו ' + b.sent + '</span><span class="ok">נמסרו ' + b.delivered + '</span>' + (b.notDelivered ? '<span class="bad">לא נמסרו ' + b.notDelivered + '</span>' : '') +
        (b.failed ? '<span class="bad">נכשלו ' + b.failed + '</span>' : '') + (b.skipped ? '<span>דולגו ' + b.skipped + '</span>' : '') + '<span>פתחו ' + b.opened + ' (' + pct(b.opened, b.sent) + ')</span><span class="ok"><b>עדכנו ' + b.submitted + ' (' + pct(b.submitted, b.sent) + ')</b></span></div>' +
      '<div class="note" style="white-space:pre-wrap">' + e(b.message) + '</div>' +
      (b.waiting ? (b.scheduledAt ? '<div class="sched">⏰ מתוזמנת ל-<b>' + e(whenIL(b.scheduledAt)) + '</b>' + (new Date(b.scheduledAt) <= new Date() ? ' — נשלחת עכשיו ברקע' : '') +
          ' <button class="btn" data-unsched="' + b.id + '" style="padding:2px 10px">ביטול תזמון</button></div>' : '') +
        '<div class="row" style="margin-top:8px"><button class="btn primary" data-send="' + b.id + '"' + (info.smsReady ? '' : ' disabled') + '>▶ שליחה עכשיו ל-' + b.waiting + ' שממתינים</button>' +
        '<label class="c" style="flex:0 1 210px">או תזמון<input type="datetime-local" data-at="' + b.id + '" value="' + e(b.scheduledAt ? localInput(new Date(b.scheduledAt)) : '') + '"></label>' +
        '<button class="btn" data-sched="' + b.id + '"' + (info.smsReady ? '' : ' disabled') + '>⏰ ' + (b.scheduledAt ? 'עדכון' : 'תזמון') + '</button>' +
        '<button class="btn" data-stop="' + b.id + '" hidden>⏸ עצירה</button><span class="note" data-prog="' + b.id + '"></span></div><div class="note" data-hint="' + b.id + '"></div><div class="bar"><i data-bar="' + b.id + '"></i></div>' : '') +
      '</div>').join('');
    $('csRef').addEventListener('click', async () => { info = await api({ action: 'clubBatches' }); if (info.ok) draw(); });
    p.querySelectorAll('[data-send]').forEach((btn) => btn.addEventListener('click', () => send(Number(btn.dataset.send), btn)));
    p.querySelectorAll('[data-stop]').forEach((btn) => btn.addEventListener('click', () => { stop = true; }));
    p.querySelectorAll('[data-at]').forEach((inp) => {
      if (!inp.value) inp.value = localInput(new Date(Date.now() + 3600000));
      inp.min = localInput(new Date());
      const hint = () => { document.querySelector('[data-hint="' + inp.dataset.at + '"]').textContent = offHours(inp.value); };
      inp.addEventListener('input', hint); hint();
    });
    p.querySelectorAll('[data-sched]').forEach((btn) => btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.sched), at = document.querySelector('[data-at="' + id + '"]').value;
      if (!at) { say('בחרו תאריך ושעה', 'err'); return; }
      const b = info.batches.find((x) => x.id === id), warn = offHours(at);
      if (!confirm('לתזמן שליחה ל-' + b.waiting + ' לקוחות ב-' + whenIL(at) + '?' + (warn ? '\n\n' + warn : '') + '\n\nהשרת ישלח לבד (עד 5 דקות מהמועד) — אפשר לסגור את הדף.')) return;
      const x = await api({ action: 'clubBatchSchedule', batchId: id, at });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      say('תוזמן ✓', 'ok'); info = await api({ action: 'clubBatches' }); if (info.ok) draw();
    }));
    p.querySelectorAll('[data-unsched]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('לבטל את התזמון? (מה שכבר נשלח — נשאר)')) return;
      const x = await api({ action: 'clubBatchSchedule', batchId: Number(btn.dataset.unsched), at: null });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      say('התזמון בוטל', 'ok'); info = await api({ action: 'clubBatches' }); if (info.ok) draw();
    }));
  }
  async function send(id, btn) {
    const b = info.batches.find((x) => x.id === id);
    if (!confirm('לשלוח SMS ל-' + b.waiting + ' לקוחות בשליחה "' + b.name + '"?')) return;
    stop = false; btn.disabled = true;
    const st = document.querySelector('[data-stop="' + id + '"]'); st.hidden = false;
    const prog = document.querySelector('[data-prog="' + id + '"]'), bar = document.querySelector('[data-bar="' + id + '"]');
    let sent = 0, failed = 0, left = b.waiting;
    while (left > 0 && !stop) {
      const x = await api({ action: 'clubBatchSend', batchId: id, max: 60 });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); break; }
      sent += x.sent; failed += x.failed; left = x.remaining;
      prog.textContent = 'נשלחו ' + sent + (failed ? ' · נכשלו ' + failed : '') + ' · נותרו ' + left;
      bar.style.width = Math.round((b.waiting - left) * 100 / b.waiting) + '%';
      if (!x.sent && !x.failed && left) break;   // nothing moved — stop rather than loop
    }
    say('נשלחו ' + sent + ' הודעות' + (failed ? ', ' + failed + ' נכשלו' : ''), failed ? 'err' : 'ok');
    info = await api({ action: 'clubBatches' }); if (info.ok) draw();
  }

  /* ---------- 👤 the members ---------- */
  let mq = '', mpage = 0;
  const KIND = { terms: 'תקנון', privacy: 'מדיניות פרטיות', marketing_email: 'דיוור במייל', marketing_sms: 'דיוור ב-SMS' };
  const CHANNEL = { landing: 'טופס המועדון', unsubscribe_link: 'קישור הסרה', invite_link: 'קישור ההזמנה', sms_reply: 'תשובת SMS', office: 'במשרד' };
  const LANG = { he: 'עברית', ar: 'ערבית' };
  const dt = (v) => (v ? new Date(v).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const dmy = (v) => (v ? String(v).slice(8, 10) + '/' + String(v).slice(5, 7) + '/' + String(v).slice(0, 4) : '');
  const yes = (b) => (b ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>');
  async function drawMembers() {
    const p = $('csP');
    p.innerHTML = '<div class="box"><div class="row"><label class="c" style="flex:1 1 220px">חיפוש — שם, טלפון, ת.ז., מייל או עיר<input type="text" id="mQ" value="' + e(mq) + '"></label>' +
      '<button class="btn" id="mGo">🔍 חיפוש</button><button class="btn primary" id="mExp">📥 ייצוא לאקסל</button></div><div id="mStats" class="note" style="margin-top:6px"></div></div><div id="mList"><p class="note">טוען…</p></div>';
    const go = () => { mq = $('mQ').value.trim(); mpage = 0; list(); };
    $('mGo').addEventListener('click', go);
    $('mQ').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
    $('mExp').addEventListener('click', exportXlsx);
    list();
  }
  async function list() {
    const r = await api({ action: 'clubMembers', q: mq, page: mpage });
    if (!r.ok) { $('mList').innerHTML = '<p class="bad">' + e(r.error || 'שגיאה') + '</p>'; return; }
    $('mStats').innerHTML = '<b>' + r.all + '</b> חברי מועדון · מאשרים דיוור במייל: <b>' + r.mailOk + '</b> · ב-SMS: <b>' + r.smsOk + '</b>' + (mq ? ' · נמצאו ' + r.total : '');
    if (!r.members.length) { $('mList').innerHTML = '<p class="note">' + (mq ? 'לא נמצאו חברים.' : 'עוד אין חברי מועדון.') + '</p>'; return; }
    const pages = Math.ceil(r.total / 50);
    $('mList').innerHTML = '<div class="box" style="overflow-x:auto"><table><tr><th>כרטיס</th><th>שם</th><th>טלפון</th><th>עיר</th><th>ת.ז.</th><th>שפה</th><th>מייל</th><th>SMS</th><th>עודכן</th></tr>' +
      r.members.map((m) => '<tr data-m="' + m.id + '" style="cursor:pointer"><td dir="ltr" class="note">' + e(m.cardNo || '—') + '</td><td><b>' + e(m.name) + '</b></td><td dir="ltr">' + e(m.phone) + '</td><td>' + e(m.city) + '</td><td dir="ltr">' + e(m.id3) + '</td><td>' + (LANG[m.language] || '') +
        '</td><td>' + yes(m.mail) + '</td><td>' + yes(m.sms) + '</td><td class="note">' + e(dt(m.updated)) + '</td></tr>').join('') + '</table>' +
      (pages > 1 ? '<div class="row" style="margin-top:8px;justify-content:center"><button class="btn" id="mPrev"' + (mpage ? '' : ' disabled') + '>→ הקודם</button><span class="note">עמוד ' + (mpage + 1) + ' מתוך ' + pages + '</span><button class="btn" id="mNext"' + (mpage + 1 < pages ? '' : ' disabled') + '>הבא ←</button></div>' : '') +
      '<p class="note">לחיצה על שורה — כרטיס החבר עם כל ההסכמות.</p></div><div id="mCard"></div>';
    $('mList').querySelectorAll('[data-m]').forEach((tr) => tr.addEventListener('click', () => card(Number(tr.dataset.m))));
    if ($('mPrev')) $('mPrev').addEventListener('click', () => { mpage--; list(); });
    if ($('mNext')) $('mNext').addEventListener('click', () => { mpage++; list(); });
  }
  async function card(id) {
    const box = $('mCard'); box.innerHTML = '<p class="note">טוען…</p>';
    const r = await api({ action: 'clubMember', id });
    if (!r.ok) { box.innerHTML = '<p class="bad">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const m = r.member, row = (k, v, ltr) => '<tr><td class="note" style="width:130px">' + k + '</td><td' + (ltr ? ' dir="ltr" style="text-align:right"' : '') + '><b>' + e(v) + '</b></td></tr>';
    box.innerHTML = '<div class="box"><div class="row" style="justify-content:space-between"><h4 style="margin:0">👤 ' + e(m.first_name + ' ' + m.last_name) + '</h4><button class="btn" id="mClose">סגירה</button></div>' +
      '<table style="margin-top:8px">' + row('מס׳ כרטיס מועדון', m.card_no || '—', 1) + row('ת.ז.', m.id_number, 1) + row('טלפון', m.phone, 1) + row('מייל', m.email, 1) + row('תאריך לידה', dmy(m.birth_date)) +
        row('כתובת', m.street + ' ' + m.house_no + ', ' + m.city) + row('שפת דיוור', LANG[m.language] || m.language) +
        '<tr><td class="note">דיוור כעת</td><td>מייל ' + yes(m.marketing_email) + ' · SMS ' + yes(m.marketing_sms) + '</td></tr>' + row('הצטרף/ה', dt(m.created_at)) + row('עודכן', dt(m.updated_at)) + '</table>' +
      '<h4 style="margin:14px 0 6px">📜 הסכמות והסרות (' + r.consents.length + ')</h4><div style="overflow-x:auto"><table><tr><th>מתי</th><th>מה</th><th>החלטה</th><th>היכן</th><th>גרסה</th><th>IP</th></tr>' +
        r.consents.map((c) => '<tr title="' + e(c.text_shown) + '"><td class="note">' + e(dt(c.at)) + '</td><td>' + (KIND[c.kind] || c.kind) + '</td><td>' + (c.granted ? '<span class="ok">אישר/ה</span>' : '<span class="bad">ביטל/ה</span>') +
          '</td><td>' + (CHANNEL[c.channel] || e(c.channel)) + '</td><td class="note">' + e(c.doc_version ? c.doc_version + ' · ' + String(c.doc_sha256 || '').slice(0, 8) : '') + '</td><td dir="ltr" class="note">' + e(c.ip || '') + '</td></tr>').join('') + '</table></div>' +
      '<p class="note">מעבר עם העכבר על שורה — הנוסח המדויק שהוצג. הרישום לא ניתן לשינוי או למחיקה.</p>' +
      '<h4 style="margin:14px 0 6px">📝 טפסים שנשלחו (' + r.submissions.length + ')</h4><table><tr><th>מתי</th><th>שפת הדף</th><th>IP</th><th>מכשיר</th></tr>' +
        r.submissions.map((s) => '<tr><td class="note">' + e(dt(s.at)) + '</td><td>' + (LANG[s.ui_lang] || '') + '</td><td dir="ltr" class="note">' + e(s.ip || '') + '</td><td class="note" dir="ltr" style="text-align:right">' + e(String(s.user_agent || '').slice(0, 60)) + '</td></tr>').join('') + '</table></div>';
    $('mClose').addEventListener('click', () => { box.innerHTML = ''; });
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function exportXlsx() {
    const btn = $('mExp'); btn.disabled = true; btn.textContent = 'מכין…';
    try {
      const r = await api({ action: 'clubMembersExport' });
      if (!r.ok) { say(r.error || 'שגיאה', 'err'); return; }
      await loadScript(XLSX_URL);
      const head = ['מס׳ כרטיס מועדון', 'שם פרטי', 'שם משפחה', 'ת.ז.', 'טלפון', 'מייל', 'תאריך לידה', 'עיר', 'רחוב', 'מספר בית', 'שפת דיוור', 'דיוור במייל', 'דיוור ב-SMS', 'הצטרף/ה', 'עודכן'];
      const rows = r.members.map((m) => [m.card_no || '', m.first_name, m.last_name, m.id_number, m.phone, m.email, dmy(m.birth_date), m.city, m.street, m.house_no, LANG[m.language] || m.language,
        m.marketing_email ? 'כן' : 'לא', m.marketing_sms ? 'כן' : 'לא', dt(m.created_at), dt(m.updated_at)]);
      const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
      ws['!cols'] = head.map((h, i) => ({ wch: [12, 10, 12, 11, 12, 26, 11, 14, 18, 8, 9, 10, 10, 17, 17][i] }));
      for (let i = 1; i <= rows.length; i++) for (const c of ['A', 'D', 'E']) { const cell = ws[c + (i + 1)]; if (cell) { cell.t = 's'; cell.z = '@'; } }   // card, ID, phone as text: the leading 0 stays
      const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, ws, 'חברי מועדון');
      XLSX.writeFile(wb, 'חברי מועדון סופרסטאר ' + new Date().toISOString().slice(0, 10) + '.xlsx');
      say('יוצאו ' + rows.length + ' חברים ✓', 'ok');
    } finally { btn.disabled = false; btn.textContent = '📥 ייצוא לאקסל'; }
  }

  /* ---------- 👥 who may come in ---------- */
  async function drawWho() {
    const p = $('csP');
    p.innerHTML = '<p class="note">טוען…</p>';
    const r = await api({ action: 'clubSenders' });
    if (!r.ok) { p.innerHTML = '<p class="bad">' + e(r.error || 'שגיאה') + '</p>'; return; }
    p.innerHTML = '<div class="box"><h4>👥 כתובות מורשות</h4><p class="note">רק כתובת מהרשימה מקבלת קוד כניסה לדף הזה. הדף נפרד ממערכת הניהול.</p>' +
      '<table><tr><th>מייל</th><th>נוסף ע"י</th><th></th></tr>' + r.senders.map((s) => '<tr><td dir="ltr">' + e(s.email) + '</td><td class="note">' + e(s.added_by || '') + '</td><td>' +
        (s.email === me ? '<span class="note">(את/ה)</span>' : '<button class="btn" data-rm="' + e(s.email) + '" style="padding:2px 10px">הסרה</button>') + '</td></tr>').join('') + '</table>' +
      '<div class="row" style="margin-top:10px"><label class="c">הוספת כתובת<input type="email" id="whoAdd" placeholder="name@example.com" dir="ltr"></label><button class="btn primary" id="whoGo">הוספה</button></div></div>';
    $('whoGo').addEventListener('click', async () => {
      const x = await api({ action: 'clubSenderAdd', email: $('whoAdd').value.trim() });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; } say('נוסף ✓', 'ok'); drawWho();
    });
    p.querySelectorAll('[data-rm]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('להסיר את ' + btn.dataset.rm + '?')) return;
      const x = await api({ action: 'clubSenderRemove', email: btn.dataset.rm });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; } drawWho();
    }));
  }

  if (ct) open(); else login();
})();
