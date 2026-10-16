// The customer club's SMS sending page (club-send.html) — on the marketing site, apart from the management system.
//   in:            an allowed e-mail address → a one-time code by e-mail → a 12-hour session (kept in this tab only)
//   📤 new sending: an Excel of customers (phone, ID number, first / last name — the columns found by their headings, or
//      chosen) → checked and previewed → the message ({שם} = the first name; the personal link "לעדכון/הסרה" is added at
//      the end) → a test to my phone → "יצירת השליחה" (clubInvitesImport: each customer his own link club?i=…, skipping
//      who asked for no messages and — by choice — who already updated).
//   📊 sendings: each with its numbers (sent / delivered / opened / filled), "▶ שליחה עכשיו" — 60 at a time until done —
//      or "⏰ תזמון" to a date and time (Israel): the server sends it then by itself (within 5 minutes), the page may be closed.
//   🖼 the deals page: pick the week's images → in the order of their names (as Publish-Mivtzaim.ps1) → shrunk to JPEG →
//      published to www.superstar-plus.co.il/mivtzaim (club-miv.ts: GitHub, one commit; the page live in about a minute).
//   📣 mailings: a deal / news message in one language, by SMS and / or e-mail, to the members who chose that language
//      (club-campaigns.ts) — "פרסומת" and the member's unsubscribe link added by the server; test, send, schedule.
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
  const DEFAULT_MSG = '{שם}, עדכנו פרטים במועדון סופרסטאר וקבלו מבצעים והטבות בלעדיות!';   // 16/10/2026: no birthday gift yet
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

  let tab = 'send', sendMode = 'mail', info = null, rows = [], head = [], map = {}, stop = false;
  async function open() {
    $('who').textContent = me; $('out').hidden = false;
    $('app').innerHTML = '<p class="note">טוען…</p>';
    info = await api({ action: 'clubBatches' });
    if (!info.ok) { if (ct) $('app').innerHTML = '<p class="bad">' + e(info.error || 'שגיאה') + '</p>'; return; }
    draw();
  }
  function draw() {
    const b = $('app');
    if (tab === 'new' || tab === 'mail') { sendMode = tab; tab = 'send'; }
    b.innerHTML = '<div class="tabs"><button data-t="send">📣 שליחת הודעות</button><button data-t="list">📊 הזמנות שנשלחו (' + info.batches.length + ')</button><button data-t="auto">🔄 לקוחות חדשים</button><button data-t="miv">🖼 דף המבצעים</button><button data-t="bday">🎂 ברכות</button><button data-t="coupons">🎟 קופונים</button><button data-t="members">👤 חברי מועדון</button><button data-t="who">👥 מורשים</button></div>' +
      (info.smsReady ? '' : '<div class="warn">⚠ שליחת SMS עוד לא הופעלה (חסר חיבור לספק ה-SMS). אפשר כבר להכין שליחות — השליחה עצמה תיפתח עם ההפעלה.</div>') +
      '<div id="csMode"></div><div id="csP"></div>';
    b.querySelectorAll('[data-t]').forEach((x) => { x.classList.toggle('on', x.dataset.t === tab); x.addEventListener('click', () => { tab = x.dataset.t; draw(); }); });
    if (tab === 'send') {
      // 16/10/2026: ONE place to send — two kinds that were two separate tabs (and looked the same)
      $('csMode').innerHTML = '<div class="box" style="padding:10px 12px"><div class="tabs" style="margin:0"><button data-sm="mail">👥 לחברי המועדון — מבצע, הודעה או ברכה</button><button data-sm="new">📨 הזמנה להצטרפות — מקובץ Excel</button></div>' +
        '<div class="note" style="margin-top:6px">' + (sendMode === 'mail' ? 'נשלח רק לחברי מועדון שמילאו את הטופס ואישרו דיוור, בשפה שבחרו.' : 'לקוחות מהקופה שעוד לא בחברי המועדון: הודעת SMS עם קישור אישי לטופס.') + '</div></div>';
      $('csMode').querySelectorAll('[data-sm]').forEach((x) => { x.classList.toggle('on', x.dataset.sm === sendMode); x.addEventListener('click', () => { sendMode = x.dataset.sm; draw(); }); });
      if (sendMode === 'new') drawNew(); else drawMail();
    } else if (tab === 'list') drawList(); else if (tab === 'auto') drawAuto(); else if (tab === 'miv') drawMiv(); else if (tab === 'bday') drawBday(); else if (tab === 'coupons') drawCoupons(); else if (tab === 'members') drawMembers(); else drawWho();
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

  /* ---------- 🔄 new customers from Comax — invited automatically (club-comax.ts) ---------- */
  async function drawAuto() {
    const p = $('csP');
    p.innerHTML = '<p class="note">טוען…</p>';
    const r = await api({ action: 'clubComaxInfo' });
    if (!r.ok) { p.innerHTML = '<p class="bad">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const day = (d) => ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][new Date(d + 'T12:00:00Z').getUTCDay()] + ' ' + dmy(d);
    const stale = !r.last || Date.now() - new Date(r.last.at).getTime() > 3 * 3600000;
    p.innerHTML = '<div class="box"><h4>🔄 שליחה אוטומטית ללקוחות חדשים מקומקס</h4>' +
      '<div class="note">מחשב החנות בודק כל שעה את רשימת הלקוחות בקומקס (קריאה בלבד). לקוח חדש — עם נייד ות.ז. תקינים, שלא ביקש בקופה לא לקבל דיוור ושלא חסום — מקבל SMS עם טופס העדכון <b>למחרת ב-09:00</b> (מי שהצטרף ביום שישי או בשבת — ביום ראשון).</div>' +
      '<div class="row" style="margin-top:10px"><label style="font-size:14px"><input type="checkbox" id="auOn"' + (r.on ? ' checked' : '') + '> <b>שליחה אוטומטית פעילה</b></label></div>' +
      '<label class="c" style="display:block;margin-top:8px">נוסח ההודעה (הקישור האישי מתווסף בסוף)<textarea id="auMsg" rows="3" style="width:100%">' + e(r.message) + '</textarea></label>' +
      '<div class="row" style="margin-top:6px"><button class="btn primary" id="auSave">שמירת הנוסח</button><span class="note">השליחה הבאה: ' + e(day(r.nextDay)) + ' ב-09:00</span></div>' +
      '<div class="note" style="margin-top:8px">' + (r.last ? 'בדיקה אחרונה ממחשב החנות: ' + e(dt(r.last.at)) + ' · ' + r.last.total + ' לקוחות בקומקס' : 'מחשב החנות עוד לא שלח נתונים — יש להפעיל בו פעם אחת את "התקנת סנכרון לקוחות קומקס"') +
        (r.last && stale ? ' <span class="bad">⚠ לא התקבלה בדיקה ב-3 השעות האחרונות — לוודא שמחשב החנות דולק</span>' : '') + (r.last && !r.baselineDone ? ' · טעינה ראשונה' : '') + '</div></div>' +
      (r.batches.length ? '<div class="box"><h4>השליחות האוטומטיות</h4><table><tr><th>יום</th><th>לקוחות</th><th>נשלחו</th></tr>' +
        r.batches.map((b) => '<tr><td>' + e(day(b.day)) + ' 09:00</td><td>' + (b.total || 0) + '</td><td>' + (b.sent || 0) + '</td></tr>').join('') + '</table><p class="note">הפרטים המלאים (נמסרו / פתחו / עדכנו) — בלשונית 📊 שליחות.</p></div>' : '') +
      '<div class="box"><h4>לקוחות חדשים ב-8 הימים האחרונים</h4>' + (r.fresh.length ? '<table><tr><th>כרטיס</th><th>שם</th><th>טלפון</th><th>נוסף</th><th>הזמנה</th></tr>' +
        r.fresh.map((c) => '<tr><td dir="ltr" class="note">' + e(c.kod) + '</td><td>' + e(c.name || '—') + '</td><td dir="ltr">' + e(c.phone || '—') + '</td><td class="note">' + e(dt(c.at)) + '</td><td>' +
          (c.invited ? '<span class="ok">✓ תוזמנה</span>' : '<span class="note">' + e(c.why || '—') + '</span>') + '</td></tr>').join('') + '</table>' : '<p class="note">אין עדיין.</p>') + '</div>';
    $('auOn').addEventListener('change', async () => {
      const x = await api({ action: 'clubComaxAuto', on: $('auOn').checked });
      say(x.ok ? (x.on ? 'השליחה האוטומטית פעילה ✓' : 'השליחה האוטומטית כובתה') : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err');
    });
    $('auSave').addEventListener('click', async () => {
      const x = await api({ action: 'clubComaxAuto', message: $('auMsg').value });
      say(x.ok ? 'הנוסח נשמר ✓' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err');
    });
  }

  /* ---------- 🖼 the deals page ---------- */
  let mivFiles = [];
  // the order of the script: names that are numbers — by number; else by name
  const byName = (a, b) => { const x = a.name.replace(/\.[^.]+$/, ''), y = b.name.replace(/\.[^.]+$/, ''); return /^\d+$/.test(x) && /^\d+$/.test(y) ? Number(x) - Number(y) : x.localeCompare(y, 'he', { numeric: true }); };
  /** a picture → JPEG, at most 1600px wide (the page shows them small; the repository stays light) */
  const toJpeg = (file) => new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const w = Math.min(1600, img.naturalWidth), h = Math.round(img.naturalHeight * w / img.naturalWidth);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.86).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('לא תמונה: ' + file.name)); };
    img.src = url;
  });
  async function drawMiv() {
    const p = $('csP');
    p.innerHTML = '<div class="box"><h4>🖼 דף המבצעים — <a href="https://www.superstar-plus.co.il/mivtzaim" target="_blank" rel="noopener">superstar-plus.co.il/mivtzaim</a></h4><div class="note" id="mvInfo">טוען…</div></div>' +
      '<div class="box"><h4>העלאת המבצעים של השבוע</h4><div class="note">בוחרים את כל התמונות (או תיקייה). הסדר בדף — לפי שמות הקבצים (1, 2, 3… / 01, 02…), כמו הסקריפט. התמונה הראשונה — התמונה הראשית (וגם התמונה בשיתוף בוואטסאפ). התמונות הקיימות בדף מוחלפות.</div>' +
      '<div class="row" style="margin-top:8px"><label class="c">תמונות<input type="file" id="mvFiles" accept="image/jpeg,image/png,image/webp" multiple></label><label class="c">או תיקייה שלמה<input type="file" id="mvDir" webkitdirectory></label></div>' +
      '<div id="mvPrev"></div><div class="row" style="margin-top:10px"><button class="btn primary" id="mvGo" disabled>🚀 פרסום לדף המבצעים</button><span class="note" id="mvProg"></span></div><div class="bar"><i id="mvBar"></i></div></div>';
    api({ action: 'clubMivInfo' }).then((r) => {
      $('mvInfo').textContent = r.ok ? 'כרגע בדף: ' + r.live + ' תמונות' + (r.last ? ' · עודכן לאחרונה ' + dt(r.last.at) : '') : 'לא הצלחתי לבדוק את הדף: ' + (r.error || '');
    });
    const pick = (list) => {
      mivFiles = [...list].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type)).sort(byName);
      $('mvPrev').innerHTML = mivFiles.length ? '<div class="note" style="margin:8px 0 4px">' + mivFiles.length + ' תמונות, בסדר הזה:</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px">' +
        mivFiles.map((f, i) => '<figure style="margin:0;text-align:center;font-size:11.5px"><img data-mv="' + i + '" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:8px;border:' + (i ? '1px solid #e5e7eb' : '3px solid #0076DA') + '"><figcaption>' +
          String(i + 1).padStart(2, '0') + (i ? '' : ' ⭐ ראשית') + '<br><span class="note">' + e(f.name.slice(0, 18)) + '</span></figcaption></figure>').join('') + '</div>' : '<p class="bad">לא נמצאו תמונות (JPEG / PNG / WEBP).</p>';
      mivFiles.forEach((f, i) => { const u = URL.createObjectURL(f); const im = $('mvPrev').querySelector('[data-mv="' + i + '"]'); im.onload = () => URL.revokeObjectURL(u); im.src = u; });
      $('mvGo').disabled = !mivFiles.length || mivFiles.length > 99;
    };
    $('mvFiles').addEventListener('change', () => pick($('mvFiles').files));
    $('mvDir').addEventListener('change', () => pick($('mvDir').files));
    $('mvGo').addEventListener('click', async () => {
      if (!confirm('לפרסם ' + mivFiles.length + ' תמונות לדף המבצעים? התמונות הנוכחיות בדף יוחלפו.')) return;
      $('mvGo').disabled = true;
      const shas = [];
      try {
        for (let i = 0; i < mivFiles.length; i++) {
          $('mvProg').textContent = 'מעלה ' + (i + 1) + '/' + mivFiles.length + '…'; $('mvBar').style.width = Math.round(i * 90 / mivFiles.length) + '%';
          const x = await api({ action: 'clubMivBlob', data: await toJpeg(mivFiles[i]) });
          if (!x.ok) throw new Error(mivFiles[i].name + ': ' + (x.error || 'שגיאה'));
          shas.push(x.sha);
        }
        $('mvProg').textContent = 'מפרסם…';
        const x = await api({ action: 'clubMivPublish', shas });
        if (!x.ok) throw new Error(x.error || 'שגיאה');
        $('mvBar').style.width = '100%';
        $('mvProg').innerHTML = '✓ פורסם — ' + x.images + ' תמונות. הדף יתעדכן בתוך כדקה: <a href="https://www.superstar-plus.co.il/mivtzaim" target="_blank" rel="noopener">לצפייה</a>';
        say('דף המבצעים פורסם ✓', 'ok');
      } catch (err) { $('mvProg').innerHTML = '<span class="bad">' + e(err.message) + '</span>'; $('mvGo').disabled = false; }
    });
  }

  /* ---------- 📣 mailings ---------- */
  const AD = { he: 'פרסומת', ar: 'إعلان' }, OUT = { he: 'להסרה: ', ar: 'للإزالة: ' };
  const MIV = 'https://www.superstar-plus.co.il/mivtzaim';
  const smsPreview = (lang, text, link) => AD[lang] + ': ' + text.trim() + (link ? '\n' + link.replace(/^https?:\/\/(www\.)?/, '') : '') + '\n' + OUT[lang] + 'superstar-plus.co.il/club-unsub?s=xxxxxxxx';
  let mlang = 'he';
  async function drawMail() {
    const p = $('csP');
    p.innerHTML = '<p class="note">טוען…</p>';
    const r = await api({ action: 'clubCampaigns' });
    if (!r.ok) { p.innerHTML = '<p class="bad">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const A = r.audience;
    p.innerHTML = '<div class="box"><h4>👥 מי יקבל</h4><div class="note">רק חברי מועדון שמילאו את הטופס ובחרו שפה; לכל ערוץ — רק מי שאישר אותו, ו-SMS לא נשלח למספר חסום.</div>' +
      '<div class="stats"><span>עברית: SMS <b>' + A.he.sms + '</b> · מייל <b>' + A.he.email + '</b></span><span>ערבית: SMS <b>' + A.ar.sms + '</b> · מייל <b>' + A.ar.email + '</b></span></div></div>' +
      '<div class="box"><h4>✉️ הודעה חדשה לחברי המועדון</h4>' +
      '<div class="row" style="gap:16px;margin-bottom:6px"><label style="display:flex;gap:6px;align-items:center"><input type="radio" name="cmKind" value="promo" checked> 🏷️ מבצע / הודעה</label>' +
        '<label style="display:flex;gap:6px;align-items:center"><input type="radio" name="cmKind" value="greeting"> 🎉 ברכה (חג, אירוע — טקסט חופשי)</label>' +
        '<label class="c" style="flex:0 1 200px">להציג באזור האישי (ימים)<input type="number" id="cmArea" min="0" max="30" value="0"></label></div>' +
      '<div class="note" id="cmKindNote"></div>' +
      '<div class="row"><label class="c">שם (לזיהוי)<input type="text" id="cmName" value="מבצעי השבוע — ' + new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + '"></label>' +
        '<label class="c" style="flex:0 1 220px">שפה — נשלח רק למי שבחר אותה<select id="cmLang"><option value="he">עברית</option><option value="ar">ערבית</option></select></label></div>' +
      '<div class="row" style="margin-top:8px;gap:16px"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cmSms" checked> SMS</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cmMail"> מייל</label>' +
        '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cmLinkOn" checked> קישור לדף המבצעים</label></div>' +
      '<label class="c" style="margin-top:8px">קישור<input type="text" id="cmLink" dir="ltr" value="' + MIV + '"></label>' +
      '<div id="cmSmsBox"><label class="c" style="margin-top:8px">נוסח ה-SMS<textarea id="cmSmsText" rows="3" maxlength="300"></textarea></label>' +
        '<div class="note">כך תיראה ההודעה (המערכת מוסיפה לבד את "פרסומת" בהתחלה ואת קישור ההסרה האישי בסוף — חובה לפי חוק):</div><pre id="cmSmsPrev" style="white-space:pre-wrap;background:#f1f5f9;border-radius:8px;padding:8px;font:inherit;font-size:13px;margin:4px 0"></pre><div class="note" id="cmSmsLen"></div></div>' +
      '<div id="cmMailBox" hidden><label class="c" style="margin-top:8px">נושא המייל (יתחיל ב"פרסומת:")<input type="text" id="cmSubj" maxlength="150"></label>' +
        '<label class="c" style="margin-top:8px">תוכן המייל<textarea id="cmMailText" rows="5" maxlength="5000"></textarea></label>' +
        '<label class="c" style="margin-top:8px">תמונה במייל (כתובת; ברירת המחדל — התמונה הראשית של דף המבצעים)<input type="text" id="cmImg" dir="ltr" value="' + MIV + '/images/01.jpg"></label>' +
        '<div class="note">בתחתית כל מייל: פרטי העסק וקישור הסרה אישי.</div></div>' +
      '<div class="row" style="margin-top:10px"><label class="c">בדיקה — טלפון<input type="tel" id="cmTPh" dir="ltr" placeholder="05X-XXXXXXX"></label><label class="c">בדיקה — מייל<input type="email" id="cmTMail" dir="ltr" placeholder="name@example.com"></label>' +
        '<button class="btn" id="cmTest">🧪 שליחת בדיקה</button></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn primary" id="cmCreate">יצירת הדיוור</button><span class="note" id="cmAud"></span></div></div>' +
      '<div id="cmList"></div>';
    const kindNow = () => (document.querySelector('[name=cmKind]:checked') || {}).value || 'promo';
    document.querySelectorAll('[name=cmKind]').forEach((x) => x.addEventListener('change', () => {
      const g = kindNow() === 'greeting';
      $('cmArea').value = g ? 5 : 0;
      if (g) { $('cmLinkOn').checked = false; $('cmImg').value = ''; if (/^מבצעי השבוע/.test($('cmName').value)) $('cmName').value = 'ברכת חג — ' + new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }); }
      $('cmKindNote').textContent = g ? 'ברכה: במייל — כותרת גדולה (נושא המייל) ומעוצבת; באזור האישי — כרטיס ברכה בימים שנבחרו. {שם} בטקסט יוחלף בשם הלקוח. גם ברכה נשלחת עם "פרסומת" וקישור הסרה (חובה לפי חוק).' : '';
      refresh();
    }));
    const vals = () => ({ kind: kindNow(), areaDays: Number($('cmArea').value) || 0, name: $('cmName').value.trim(), lang: $('cmLang').value, sendSms: $('cmSms').checked, sendEmail: $('cmMail').checked,
      smsText: $('cmSmsText').value.trim(), emailSubject: $('cmSubj').value.trim(), emailText: $('cmMailText').value.trim(),
      linkUrl: $('cmLinkOn').checked ? $('cmLink').value.trim() : '', imageUrl: $('cmImg').value.trim() });
    const refresh = () => {
      const v = vals();
      $('cmSmsBox').hidden = !v.sendSms; $('cmMailBox').hidden = !v.sendEmail; $('cmLink').disabled = !$('cmLinkOn').checked;
      const t = smsPreview(v.lang, v.smsText || '…', v.linkUrl), n = parts(t);
      $('cmSmsPrev').textContent = t; $('cmSmsPrev').dir = 'rtl';
      $('cmSmsLen').textContent = t.length + ' תווים · ' + n + ' ' + (n === 1 ? 'מקטע' : 'מקטעים') + ' להודעה';
      const a = A[v.lang];
      $('cmAud').textContent = 'יישלח ל: ' + [v.sendSms ? a.sms + ' ב-SMS' : '', v.sendEmail ? a.email + ' במייל' : ''].filter(Boolean).join(' · ') + ' (' + (v.lang === 'ar' ? 'ערבית' : 'עברית') + ')';
    };
    ['cmLang', 'cmSms', 'cmMail', 'cmLinkOn', 'cmLink', 'cmSmsText'].forEach((id) => { $(id).addEventListener('input', refresh); $(id).addEventListener('change', refresh); });
    refresh();
    $('cmTest').addEventListener('click', async () => {
      const x = await api({ action: 'clubCampaignTest', ...vals(), phone: $('cmTPh').value.trim(), email: $('cmTMail').value.trim() });
      say(x.ok ? 'בדיקה: ' + x.result : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err');
    });
    $('cmCreate').addEventListener('click', async () => {
      const x = await api({ action: 'clubCampaignCreate', ...vals() });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      say('הדיוור נוצר ✓ — אפשר לשלוח או לתזמן', 'ok'); drawMail();
    });
    // the mailings
    const lst = $('cmList');
    if (!r.campaigns.length) { lst.innerHTML = ''; return; }
    lst.innerHTML = r.campaigns.map((c) => '<div class="box"><div class="row" style="justify-content:space-between"><b>' + e(c.name) + '</b><span class="note">' + (c.lang === 'ar' ? 'ערבית' : 'עברית') +
        ' · ' + [c.send_sms ? 'SMS' : '', c.send_email ? 'מייל' : ''].filter(Boolean).join(' + ') + ' · ' + e(new Date(c.created_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '</span></div>' +
      (c.prepared_at ? '<div class="stats"><span>' + c.total + ' הודעות (' + c.sms + ' SMS, ' + c.email + ' מייל)</span><span>נשלחו ' + c.sent + '</span><span class="ok">נמסרו ' + c.delivered + '</span>' +
          (c.notDelivered ? '<span class="bad">לא נמסרו ' + c.notDelivered + '</span>' : '') + (c.failed ? '<span class="bad">נכשלו ' + c.failed + '</span>' : '') + (c.skipped ? '<span>דולגו ' + c.skipped + '</span>' : '') +
          (c.waiting ? '<span>ממתינות ' + c.waiting + '</span>' : '') + '</div>' : '<div class="note">עוד לא נשלח.</div>') +
      (c.send_sms ? '<pre style="white-space:pre-wrap;background:#f1f5f9;border-radius:8px;padding:6px 8px;font:inherit;font-size:12.5px;margin:6px 0" dir="rtl">' + e(c.preview) + '</pre>' : '') +
      (c.send_email ? '<div class="note">מייל: ' + e(AD[c.lang] + ': ' + (c.email_subject || '')) + '</div>' : '') +
      (c.scheduled_at && (!c.prepared_at || c.waiting) ? '<div class="sched">⏰ מתוזמן ל-<b>' + e(whenIL(c.scheduled_at)) + '</b> <button class="btn" data-cun="' + c.id + '" style="padding:2px 10px">ביטול תזמון</button></div>' : '') +
      (!c.prepared_at || c.waiting ? '<div class="row" style="margin-top:8px"><button class="btn primary" data-csend="' + c.id + '">▶ שליחה עכשיו</button>' +
          '<label class="c" style="flex:0 1 210px">או תזמון<input type="datetime-local" data-cat="' + c.id + '"></label><button class="btn" data-csched="' + c.id + '">⏰ תזמון</button>' +
          (!c.prepared_at ? '<button class="btn" data-cdel="' + c.id + '" style="color:#b91c1c">מחיקה</button>' : '') + '<span class="note" data-cprog="' + c.id + '"></span></div><div class="note" data-chint="' + c.id + '"></div>' : '') +
      '</div>').join('');
    lst.querySelectorAll('[data-cat]').forEach((inp) => {
      inp.value = localInput(new Date(Date.now() + 3600000)); inp.min = localInput(new Date());
      const hint = () => { lst.querySelector('[data-chint="' + inp.dataset.cat + '"]').textContent = offHours(inp.value); };
      inp.addEventListener('input', hint); hint();
    });
    lst.querySelectorAll('[data-csend]').forEach((b) => b.addEventListener('click', async () => {
      const id = Number(b.dataset.csend), c = r.campaigns.find((x) => x.id === id);
      if (!confirm('לשלוח עכשיו את "' + c.name + '"?')) return;
      b.disabled = true; const prog = lst.querySelector('[data-cprog="' + id + '"]');
      let sent = 0, left = 1;
      while (left > 0) {
        const x = await api({ action: 'clubCampaignSend', id });
        if (!x.ok) { say(x.error || 'שגיאה', 'err'); break; }
        sent += x.sent; left = x.remaining; prog.textContent = 'נשלחו ' + sent + ' · נותרו ' + left;
        if (!x.sent && !x.failed && !x.skipped) break;
      }
      say('נשלחו ' + sent + ' הודעות', 'ok'); drawMail();
    }));
    lst.querySelectorAll('[data-csched]').forEach((b) => b.addEventListener('click', async () => {
      const id = Number(b.dataset.csched), at = lst.querySelector('[data-cat="' + id + '"]').value, w = offHours(at);
      if (!at || !confirm('לתזמן ל-' + whenIL(at) + '?' + (w ? '\n\n' + w : ''))) return;
      const x = await api({ action: 'clubCampaignSchedule', id, at });
      say(x.ok ? 'תוזמן ✓' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); drawMail();
    }));
    lst.querySelectorAll('[data-cun]').forEach((b) => b.addEventListener('click', async () => {
      const x = await api({ action: 'clubCampaignSchedule', id: Number(b.dataset.cun), at: null }); say(x.ok ? 'התזמון בוטל' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); drawMail();
    }));
    lst.querySelectorAll('[data-cdel]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('למחוק את הדיוור?')) return;
      const x = await api({ action: 'clubCampaignDelete', id: Number(b.dataset.cdel) }); say(x.ok ? 'נמחק' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); drawMail();
    }));
  }

  /* ---------- 🎂 the birthday greeting, automatic (club-greetings.ts) ---------- */
  async function drawBday() {
    const p = $('csP');
    p.innerHTML = '<p class="note">טוען…</p>';
    const r = await api({ action: 'clubBdaySettings' });
    if (!r.ok) { p.innerHTML = '<p class="bad">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const S = r.settings, ta = (id, label, rows, max) => '<label class="c" style="margin-top:8px">' + label + '<textarea id="' + id + '" rows="' + rows + '" maxlength="' + max + '">' + e(S[id]) + '</textarea></label>';
    const inp = (id, label) => '<label class="c" style="margin-top:8px">' + label + '<input type="text" id="' + id + '" maxlength="150" value="' + e(S[id]) + '"></label>';
    p.innerHTML = '<div class="box" style="border:2px solid #f59e0b"><h4>🎁 מתנת יום הולדת</h4>' +
      '<div class="note">פעם אחת בחודש יום ההולדת: הנחה בסכום קבוע בקנייה מעל סכום מינימום (₪50 מעל ₪500 = 10%). קנייה מתחת למינימום — בלי מתנה. ' +
        'כשההטבה פעילה: מוצגת לחבר באזור האישי כל חודש יום ההולדת, ומוזכרת בברכה. כדי שהקופה תיתן אותה — להגדיר בקומקס את מתנת יום ההולדת בקבוצת המועדון ("סל קניות 41" / "מועדון סופר סטאר") באותם סכומים.</div>' +
      '<label style="display:flex;gap:8px;align-items:center;margin:10px 0;font-weight:700"><input type="checkbox" id="bgOn"' + (S.club_bgift_on === 'on' ? ' checked' : '') + '> ההטבה פעילה</label>' +
      '<div class="row"><label class="c" style="flex:0 1 180px">סכום המתנה (₪)<input type="number" id="bgAmt" min="1" max="10000" value="' + e(S.club_bgift_amount) + '"></label>' +
        '<label class="c" style="flex:0 1 220px">בקנייה מעל (₪)<input type="number" id="bgMin" min="1" max="10000" value="' + e(S.club_bgift_min) + '"></label>' +
        '<button class="btn primary" id="bgSave">💾 שמירה</button></div>' +
      '<div class="note" id="bgPrev" style="margin-top:6px"></div></div>' +
      '<div class="box"><h4>🎂 ברכת יום הולדת אוטומטית</h4>' +
      '<div class="note">כל יום מ-09:00 — לחברי המועדון שיום ההולדת שלהם היום ואישרו דיוור: SMS (למי שאישר SMS) ומייל מעוצב (למי שאישר מייל), פעם בשנה, בשפה שבחרו. עם "פרסומת" וקישור הסרה. באזור האישי הברכה מוצגת כל חודש יום ההולדת. {שם} = השם הפרטי. החודש: <b>' + r.thisMonth + '</b> חוגגים שאישרו דיוור.</div>' +
      '<label style="display:flex;gap:8px;align-items:center;margin:10px 0;font-weight:700"><input type="checkbox" id="bdOn"' + (S.club_bday_on === 'on' ? ' checked' : '') + '> שליחה אוטומטית פעילה</label>' +
      '<div class="row" style="gap:14px;align-items:flex-start"><div class="c" style="flex:1 1 300px"><b>עברית</b>' + ta('club_bday_sms_he', 'SMS', 3, 300) + inp('club_bday_subject_he', 'כותרת המייל וכרטיס הברכה') + ta('club_bday_mail_he', 'תוכן המייל וכרטיס הברכה', 4, 2000) + '</div>' +
        '<div class="c" style="flex:1 1 300px"><b>ערבית</b>' + ta('club_bday_sms_ar', 'SMS', 3, 300) + inp('club_bday_subject_ar', 'כותרת המייל וכרטיס הברכה') + ta('club_bday_mail_ar', 'תוכן המייל וכרטיס הברכה', 4, 2000) + '</div></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn primary" id="bdSave">💾 שמירה</button></div>' +
      '<div class="row" style="margin-top:10px"><label class="c">בדיקה — טלפון<input type="tel" id="bdTPh" dir="ltr" placeholder="05X-XXXXXXX"></label><label class="c">בדיקה — מייל<input type="email" id="bdTMail" dir="ltr"></label>' +
        '<label class="c" style="flex:0 1 140px">שפה<select id="bdTLang"><option value="he">עברית</option><option value="ar">ערבית</option></select></label><button class="btn" id="bdTest">🧪 שליחת בדיקה</button></div></div>' +
      '<div class="box"><h4>נשלחו השנה (' + r.sent.length + ')</h4>' + (r.sent.length ? '<table><tr><th>חבר/ה</th><th>מתי</th><th>SMS</th><th>מייל</th></tr>' + r.sent.map((x) => '<tr><td>' + e(x.name) + '</td><td>' + e(new Date(x.at).toLocaleDateString('he-IL')) + '</td><td>' + e(x.sms || '') + '</td><td>' + e(x.email || '') + '</td></tr>').join('') + '</table>' : '<p class="note">עוד לא נשלחו.</p>') + '</div>';
    const vals = () => { const o = { club_bday_on: $('bdOn').checked ? 'on' : 'off' }; ['club_bday_sms_he', 'club_bday_sms_ar', 'club_bday_subject_he', 'club_bday_subject_ar', 'club_bday_mail_he', 'club_bday_mail_ar'].forEach((k) => { o[k] = $(k).value.trim(); }); return o; };
    const bgPrev = () => { $('bgPrev').textContent = 'יוצג ללקוח: "🎁 מחכה לך מתנה: ₪' + $('bgAmt').value + ' הנחה בקנייה מעל ₪' + $('bgMin').value + ' — פעם אחת בחודש יום ההולדת."' + ($('bgOn').checked ? '' : ' (כבוי — לא מוצג)'); };
    ['bgOn', 'bgAmt', 'bgMin'].forEach((id) => $(id).addEventListener('input', bgPrev)); bgPrev();
    $('bgSave').addEventListener('click', async () => {
      if ($('bgOn').checked && !confirm('להפעיל את מתנת יום ההולדת? היא תוצג ללקוחות באזור האישי ובברכה — ודא/י שהיא מוגדרת גם בקומקס.')) return;
      const x = await api({ action: 'clubBdaySave', club_bgift_on: $('bgOn').checked ? 'on' : 'off', club_bgift_amount: $('bgAmt').value, club_bgift_min: $('bgMin').value });
      say(x.ok ? 'נשמר ✓' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err');
    });
    $('bdSave').addEventListener('click', async () => { const x = await api({ action: 'clubBdaySave', ...vals() }); say(x.ok ? 'נשמר ✓' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); });
    $('bdTest').addEventListener('click', async () => {
      const x = await api({ action: 'clubBdayTest', ...vals(), lang: $('bdTLang').value, phone: $('bdTPh').value.trim(), email: $('bdTMail').value.trim() });
      say(x.ok ? 'בדיקה — SMS: ' + x.sms + ' · מייל: ' + x.email : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err');
    });
  }

  /* ---------- 🎟 the coupons (club-coupons.ts) ---------- */
  async function drawCoupons() {
    const p = $('csP');
    p.innerHTML = '<p class="note">טוען…</p>';
    const r = await api({ action: 'clubCoupons' });
    if (!r.ok) { p.innerHTML = '<p class="bad">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const ST = { pending: '⏳ ממתין לפתיחה בקומקס', active: '✅ פעיל', used: '🛒 נוצל', expired: '⌛ פג', cancelled: '✖ בוטל' };
    const why = { return: 'מוצר שקונה הרבה', winback: 'לא קנה ' + r.winbackDays + ' יום — חלון + SMS', manual: 'ידני' };
    const row = (c) => '<tr><td>' + e(c.member) + '<div class="note">' + e(c.card || '') + '</div></td><td><b>' + e(c.name) + '</b><div class="note" dir="ltr">' + e(c.barcode) + '</div></td><td>' + e(c.percent) + '%</td><td>' + e(why[c.reason] || c.reason) + '</td>' +
      '<td>' + e(ST[c.status] || c.status) + (c.valid_to ? '<div class="note">עד ' + e(c.valid_to.split('-').reverse().join('/')) + '</div>' : '') + (c.sms_status ? '<div class="note">SMS: ' + e(c.sms_status) + '</div>' : '') + '</td><td>' +
      (c.status === 'pending' ? '<input type="text" placeholder="מס׳ מבצע בקומקס" data-cx="' + c.id + '" style="width:120px"> <button class="btn primary" data-act="' + c.id + '">נפתח בקומקס ✓</button> ' : '') +
      (c.status === 'pending' || c.status === 'active' ? '<button class="btn" data-cancel="' + c.id + '">ביטול</button>' : '') + '</td></tr>';
    const pend = r.coupons.filter((c) => c.status === 'pending'), rest = r.coupons.filter((c) => c.status !== 'pending');
    p.innerHTML = '<div class="box"><h4>🎟 קופונים לחברי המועדון</h4><div class="note">' + r.percent + '% על מוצר אחד שהלקוח קונה (לא מוצר שכבר במבצע), ' + r.days + ' ימים. המערכת מציעה כל בוקר; כדי שהקופה תכבד — פותחים בקומקס מבצע לקבוצת הלקוחות של הלקוח על המוצר, ומסמנים כאן "נפתח בקומקס" — רק אז הלקוח רואה את הקופון באזור האישי (ולקוח שלא קנה ' + r.winbackDays + ' יום מקבל גם חלון קופץ ו-SMS).</div>' +
      '<div class="row" style="margin-top:8px"><label class="c">בפיילוט — מספרי ת"ז (פסיק בין מספרים)<input type="text" id="cpPilot" dir="ltr" value="' + e(r.pilot || '') + '"></label><button class="btn" id="cpSave">💾 שמירה והרצה עכשיו</button></div></div>' +
      '<div class="box"><h4>➕ קופון ידני</h4><div class="note">לחבר/ת מועדון (שמילא/ה את הטופס): ת"ז או נייד, ברקוד המוצר (השם מהקטלוג), אחוז הנחה וימי תוקף. כמו כל קופון — כדי שהקופה תכבד יש לפתוח אותו בקומקס כמבצע לקבוצת הלקוחות; אם כבר נפתח — לסמן "נפתח בקומקס" והקופון פעיל ומוצג ללקוח מיד.</div>' +
        '<div class="row" style="margin-top:8px"><label class="c" style="flex:0 1 170px">ת"ז<input type="text" id="cmId" dir="ltr" inputmode="numeric"></label><label class="c" style="flex:0 1 170px">או נייד<input type="tel" id="cmPh" dir="ltr"></label>' +
        '<label class="c" style="flex:0 1 190px">ברקוד המוצר<input type="text" id="cmBc" dir="ltr" inputmode="numeric"></label><label class="c" style="flex:0 1 100px">% הנחה<input type="number" id="cmPct" min="1" max="100" value="' + r.percent + '"></label>' +
        '<label class="c" style="flex:0 1 100px">ימי תוקף<input type="number" id="cmDays" min="1" max="90" value="' + r.days + '"></label></div>' +
        '<div class="row" style="margin-top:8px"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cmNow"> כבר נפתח בקומקס — להפעיל מיד</label><label class="c" style="flex:0 1 180px">מס׳ מבצע בקומקס<input type="text" id="cmCx"></label>' +
        '<button class="btn primary" id="cmAdd">➕ יצירת הקופון</button></div></div>' +
      '<div class="box"><h4>⏳ לפתוח בקומקס (' + pend.length + ')</h4>' + (pend.length ? '<table><tr><th>לקוח</th><th>מוצר</th><th>הנחה</th><th>למה</th><th>מצב</th><th></th></tr>' + pend.map(row).join('') + '</table>' : '<p class="note">אין קופונים שממתינים.</p>') + '</div>' +
      '<div class="box"><h4>קופונים (' + rest.length + ')</h4>' + (rest.length ? '<table><tr><th>לקוח</th><th>מוצר</th><th>הנחה</th><th>למה</th><th>מצב</th><th></th></tr>' + rest.map(row).join('') + '</table>' : '<p class="note">עוד אין.</p>') + '</div>';
    $('cmAdd').addEventListener('click', async () => {
      const x = await api({ action: 'clubCouponCreate', idNumber: $('cmId').value.trim(), phone: $('cmPh').value.trim(), barcode: $('cmBc').value.trim(),
        percent: Number($('cmPct').value), days: Number($('cmDays').value), activeNow: $('cmNow').checked, comaxCode: $('cmCx').value.trim() });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      say('נוצר קופון ל' + x.member + ' על ' + x.product + (x.status === 'active' ? ' — פעיל עד ' + String(x.validTo).split('-').reverse().join('/') : ' — ממתין לפתיחה בקומקס'), 'ok'); drawCoupons();
    });
    $('cpSave').addEventListener('click', async () => { const x = await api({ action: 'clubCouponPilot', ids: $('cpPilot').value, runNow: true }); say(x.ok ? 'נשמר ✓' + (x.run ? ' · נוצרו ' + x.run.created : '') : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); drawCoupons(); });
    p.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      const cx = (p.querySelector('[data-cx="' + b.dataset.act + '"]') || {}).value || '';
      if (!confirm('לסמן שהמבצע נפתח בקומקס? הקופון יוצג ללקוח מיד, לתוקף 7 ימים' + '.')) return;
      const x = await api({ action: 'clubCouponActivate', id: Number(b.dataset.act), comaxCode: cx });
      say(x.ok ? 'הקופון פעיל עד ' + x.validTo.split('-').reverse().join('/') + (x.sms ? ' · SMS: ' + x.sms : '') : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); drawCoupons();
    }));
    p.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('לבטל את הקופון?')) return;
      await api({ action: 'clubCouponCancel', id: Number(b.dataset.cancel) }); drawCoupons();
    }));
  }

  /* ---------- 👤 the members ---------- */
  let mq = '', mpage = 0, mmode = 'members';   // members (updated their details) | all | waiting | blocked — every customer from the file
  const KIND = { terms: 'תקנון', privacy: 'מדיניות פרטיות', marketing_email: 'דיוור במייל', marketing_sms: 'דיוור ב-SMS' };
  const CHANNEL = { landing: 'טופס המועדון', unsubscribe_link: 'קישור הסרה', invite_link: 'קישור ההזמנה', sms_reply: 'תשובת SMS', office: 'במשרד' };
  const LANG = { he: 'עברית', ar: 'ערבית' };
  const dt = (v) => (v ? new Date(v).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const dmy = (v) => (v ? String(v).slice(8, 10) + '/' + String(v).slice(5, 7) + '/' + String(v).slice(0, 4) : '');
  const yes = (b) => (b ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>');
  async function drawMembers() {
    const p = $('csP');
    p.innerHTML = '<div class="box"><div class="row"><label class="c" style="flex:1 1 220px">חיפוש — שם, טלפון, ת.ז., מייל או עיר<input type="text" id="mQ" value="' + e(mq) + '"></label>' +
      '<button class="btn" id="mGo">🔍 חיפוש</button><button class="btn primary" id="mExp">📥 ייצוא לאקסל</button></div>' +
      '<div class="tabs" style="margin:10px 0 0" id="mModes"><button data-mm="members">✓ עדכנו פרטים</button><button data-mm="all">📋 כל הלקוחות</button><button data-mm="waiting">⏳ טרם עדכנו</button><button data-mm="blocked">🚫 חסומים לדיוור</button></div>' +
      '<div id="mStats" class="note" style="margin-top:6px"></div></div><div id="mList"><p class="note">טוען…</p></div>';
    $('mModes').querySelectorAll('[data-mm]').forEach((b) => { b.classList.toggle('on', b.dataset.mm === mmode); b.addEventListener('click', () => { mmode = b.dataset.mm; mpage = 0; drawMembers(); }); });
    const go = () => { mq = $('mQ').value.trim(); mpage = 0; list(); };
    $('mGo').addEventListener('click', go);
    $('mQ').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
    $('mExp').addEventListener('click', exportXlsx);
    list();
  }
  async function list() {
    if (mmode !== 'members') return listCustomers();
    const r = await api({ action: 'clubMembers', q: mq, page: mpage });
    if (!r.ok) { $('mList').innerHTML = '<p class="bad">' + e(r.error || 'שגיאה') + '</p>'; return; }
    $('mStats').innerHTML = '<b>' + r.all + '</b> חברי מועדון · מאשרים דיוור במייל: <b>' + r.mailOk + '</b> · ב-SMS: <b>' + r.smsOk + '</b>' + (mq ? ' · נמצאו ' + r.total : '') +
      ' · 🚫 מספרים חסומים לדיוור (כולל מי שעוד לא עדכן): <b>' + (r.blockedAll || 0) + '</b> <button class="btn" id="mSync" style="padding:2px 10px;font-size:12.5px">↻ סנכרון חסומים מ-UP Send</button>';
    $('mSync').addEventListener('click', async () => {
      $('mSync').disabled = true; $('mSync').textContent = 'מסנכרן…';
      const x = await api({ action: 'clubBlockSyncNow' });
      say(x.ok ? 'סונכרן ✓ — חדשים: ' + x.added + ', הוסרו: ' + x.removed : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err');
      list();
    });
    if (!r.members.length) { $('mList').innerHTML = '<p class="note">' + (mq ? 'לא נמצאו חברים.' : 'עוד אין חברי מועדון.') + '</p>'; return; }
    const pages = Math.ceil(r.total / 50);
    $('mList').innerHTML = '<div class="box" style="overflow-x:auto"><table><tr><th>כרטיס</th><th>שם</th><th>טלפון</th><th>עיר</th><th>ת.ז.</th><th>שפה</th><th>מייל</th><th>SMS</th><th>עודכן</th></tr>' +
      r.members.map((m) => '<tr data-m="' + m.id + '" style="cursor:pointer"><td dir="ltr" class="note">' + e(m.cardNo || '—') + '</td><td><b>' + e(m.name) + '</b></td><td dir="ltr">' + e(m.phone) + '</td><td>' + e(m.city) + '</td><td dir="ltr">' + e(m.id3) + '</td><td>' + (LANG[m.language] || '') +
        '</td><td>' + yes(m.mail) + '</td><td>' + (m.blocked ? '<span class="bad" title="חסם קבלת דיוור">🚫 חסום</span>' : yes(m.sms)) + '</td><td class="note">' + e(dt(m.updated)) + '</td></tr>').join('') + '</table>' +
      (pages > 1 ? '<div class="row" style="margin-top:8px;justify-content:center"><button class="btn" id="mPrev"' + (mpage ? '' : ' disabled') + '>→ הקודם</button><span class="note">עמוד ' + (mpage + 1) + ' מתוך ' + pages + '</span><button class="btn" id="mNext"' + (mpage + 1 < pages ? '' : ' disabled') + '>הבא ←</button></div>' : '') +
      '<p class="note">לחיצה על שורה — כרטיס החבר עם כל ההסכמות.</p></div><div id="mCard"></div>';
    $('mList').querySelectorAll('[data-m]').forEach((tr) => tr.addEventListener('click', () => card(Number(tr.dataset.m))));
    if ($('mPrev')) $('mPrev').addEventListener('click', () => { mpage--; list(); });
    if ($('mNext')) $('mNext').addEventListener('click', () => { mpage++; list(); });
  }
  /** every customer from the file — with the details as they came from Comax, updated or not, blocked or not */
  async function listCustomers() {
    const r = await api({ action: 'clubCustomers', q: mq, page: mpage, filter: mmode });
    if (!r.ok) { $('mList').innerHTML = '<p class="bad">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const C = r.counts;
    $('mStats').innerHTML = '<b>' + C.all + '</b> לקוחות מהקובץ · עדכנו פרטים: <b>' + C.updated + '</b> · טרם עדכנו: <b>' + C.waiting + '</b> · 🚫 חסומים לדיוור: <b>' + C.blocked + '</b>' + (mq ? ' · נמצאו ' + r.total : '') +
      ' <button class="btn" id="mSync" style="padding:2px 10px;font-size:12.5px">↻ סנכרון חסומים מ-UP Send</button>';
    $('mSync').addEventListener('click', async () => {
      $('mSync').disabled = true; $('mSync').textContent = 'מסנכרן…';
      const x = await api({ action: 'clubBlockSyncNow' });
      say(x.ok ? 'סונכרן ✓ — חדשים: ' + x.added + ', הוסרו: ' + x.removed : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); list();
    });
    if (!r.customers.length) { $('mList').innerHTML = '<p class="note">לא נמצאו לקוחות.</p>'; return; }
    const SRC = { upsend: 'ספק ה-SMS', site: 'באתר', office: 'במשרד' };
    const inv = (c) => c.delivery === 'delivered' ? '<span class="ok">נמסר</span>' : c.sms === 'sent' ? 'נשלח' : c.sms === 'skipped' ? '<span class="note">דולג</span>' : c.sms === 'failed' ? '<span class="bad">נכשל</span>' : '<span class="note">—</span>';
    const pages = Math.ceil(r.total / 50);
    $('mList').innerHTML = '<div class="box" style="overflow-x:auto"><table><tr><th>כרטיס</th><th>שם</th><th>טלפון</th><th>ת.ז.</th><th>הזמנה</th><th>עדכן</th><th>דיוור</th></tr>' +
      r.customers.map((c, i) => '<tr><td dir="ltr" class="note">' + e(c.cardNo || '—') + '</td><td>' + (c.memberId ? '<a href="#" data-mc="' + c.memberId + '"><b>' + e(c.name || '—') + '</b></a>' : e(c.name || '—')) +
        '</td><td dir="ltr">' + e(c.phone) + '</td><td dir="ltr" class="note">' + e(c.id3) + '</td><td>' + inv(c) + '</td><td>' + (c.memberId ? '<span class="ok">✓</span>' : c.opened ? '<span class="note">פתח</span>' : '') + '</td><td>' +
        (c.blocked ? '<span class="bad" title="' + e(c.blockNote || '') + '">🚫 חסום</span> <span class="note">' + e(SRC[c.blockSource] || '') + (c.blockedAt ? ' · ' + e(dmy(String(c.blockedAt).slice(0, 10))) : '') + '</span> <button class="btn" data-unb="' + i + '" style="padding:1px 8px;font-size:12px">הסרת חסימה</button>'
          : '<span class="ok">פעיל</span> <button class="btn" data-blk="' + i + '" style="padding:1px 8px;font-size:12px">חסימה</button>') + '</td></tr>').join('') + '</table>' +
      (pages > 1 ? '<div class="row" style="margin-top:8px;justify-content:center"><button class="btn" id="mPrev"' + (mpage ? '' : ' disabled') + '>→ הקודם</button><span class="note">עמוד ' + (mpage + 1) + ' מתוך ' + pages + '</span><button class="btn" id="mNext"' + (mpage + 1 < pages ? '' : ' disabled') + '>הבא ←</button></div>' : '') +
      '<p class="note">פרטי הלקוחות כפי שהגיעו מקומקס. שם מודגש — עדכן פרטים (לחיצה — הכרטיס המלא).</p></div><div id="mCard"></div>';
    $('mList').querySelectorAll('[data-mc]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); card(Number(a.dataset.mc)); }));
    $('mList').querySelectorAll('[data-unb]').forEach((b) => b.addEventListener('click', async () => {
      const c = r.customers[Number(b.dataset.unb)];
      const note = prompt('הסרת החסימה של ' + (c.name || c.phone) + ' (' + c.phone + ') — גם אצל ספק ה-SMS.\n\nלפי החוק — רק בהסכמה מחודשת של הלקוח/ה. כתבו מתי ואיך ביקש/ה לחזור לקבל הודעות:', '');
      if (note === null) return;
      if (note.trim().length < 5) { say('יש לכתוב הערה (לפחות 5 תווים)', 'err'); return; }
      const x = await api({ action: 'clubUnblock', phone: c.phone, note: note.trim() });
      say(x.ok ? 'החסימה הוסרה ✓ (גם ב-UP Send)' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); if (x.ok) list();
    }));
    $('mList').querySelectorAll('[data-blk]').forEach((b) => b.addEventListener('click', async () => {
      const c = r.customers[Number(b.dataset.blk)];
      const note = prompt('לחסום את ' + (c.name || c.phone) + ' (' + c.phone + ') לקבלת דיוור ב-SMS? (גם אצל ספק ה-SMS)\nסיבה (לא חובה):', '');
      if (note === null) return;
      const x = await api({ action: 'clubBlock', phone: c.phone, note: note.trim() });
      say(x.ok ? 'נחסם ✓' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); if (x.ok) list();
    }));
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
      (r.blocked ? '<div class="warn" style="margin-top:10px">🚫 <b>הלקוח/ה חסם/ה קבלת דיוור</b> — ' + e({ upsend: 'ברשימת החסומים של ספק ה-SMS', site: 'ביקש/ה באתר', office: 'נחסם/ה במשרד' }[r.blocked.source] || r.blocked.source) +
          ', מ-' + e(dt(r.blocked.blocked_at)) + (r.blocked.note ? ' (' + e(r.blocked.note) + ')' : '') + '. לא יישלחו אליו/ה הודעות. פרטי המועדון נשמרים כפי שהם.' +
          '<div class="row" style="margin-top:6px"><label class="c" style="flex:1 1 260px">הסרת החסימה — רק בהסכמה מחודשת של הלקוח/ה (חובה לכתוב מתי ואיך)<input type="text" id="mUnNote" maxlength="300" placeholder="למשל: ביקש/ה בטלפון ב-15/10 לחזור לקבל הודעות"></label>' +
          '<button class="btn" id="mUnblock">הסרת חסימה</button></div></div>'
        : '<div class="row" style="margin-top:10px"><label class="c" style="flex:1 1 260px">חסימת דיוור ב-SMS (גם אצל ספק ה-SMS)<input type="text" id="mBlNote" maxlength="300" placeholder="סיבה (לא חובה)"></label><button class="btn" id="mBlock">🚫 חסימה</button></div>') +
      (r.blockLog && r.blockLog.length ? '<h4 style="margin:14px 0 6px">🚫 חסימות והסרות חסימה (' + r.blockLog.length + ')</h4><table><tr><th>מתי</th><th>פעולה</th><th>מקור</th><th>הערה</th><th>ע״י</th></tr>' +
          r.blockLog.map((b) => '<tr><td class="note">' + e(dt(b.at)) + '</td><td>' + (b.action === 'block' ? '<span class="bad">חסימה</span>' : '<span class="ok">הסרת חסימה</span>') + '</td><td>' +
            e({ upsend: 'ספק ה-SMS', site: 'האתר', office: 'משרד' }[b.source] || b.source) + '</td><td>' + e(b.note || '') + '</td><td class="note">' + e(b.by_who || '') + '</td></tr>').join('') + '</table>' : '') +
      '<h4 style="margin:14px 0 6px">📜 הסכמות והסרות (' + r.consents.length + ')</h4><div style="overflow-x:auto"><table><tr><th>מתי</th><th>מה</th><th>החלטה</th><th>היכן</th><th>גרסה</th><th>IP</th></tr>' +
        r.consents.map((c) => '<tr title="' + e(c.text_shown) + '"><td class="note">' + e(dt(c.at)) + '</td><td>' + (KIND[c.kind] || c.kind) + '</td><td>' + (c.granted ? '<span class="ok">אישר/ה</span>' : '<span class="bad">ביטל/ה</span>') +
          '</td><td>' + (CHANNEL[c.channel] || e(c.channel)) + '</td><td class="note">' + e(c.doc_version ? c.doc_version + ' · ' + String(c.doc_sha256 || '').slice(0, 8) : '') + '</td><td dir="ltr" class="note">' + e(c.ip || '') + '</td></tr>').join('') + '</table></div>' +
      '<p class="note">מעבר עם העכבר על שורה — הנוסח המדויק שהוצג. הרישום לא ניתן לשינוי או למחיקה.</p>' +
      '<h4 style="margin:14px 0 6px">📝 טפסים שנשלחו (' + r.submissions.length + ')</h4><table><tr><th>מתי</th><th>שפת הדף</th><th>IP</th><th>מכשיר</th></tr>' +
        r.submissions.map((s) => '<tr><td class="note">' + e(dt(s.at)) + '</td><td>' + (LANG[s.ui_lang] || '') + '</td><td dir="ltr" class="note">' + e(s.ip || '') + '</td><td class="note" dir="ltr" style="text-align:right">' + e(String(s.user_agent || '').slice(0, 60)) + '</td></tr>').join('') + '</table></div>';
    $('mClose').addEventListener('click', () => { box.innerHTML = ''; });
    if ($('mUnblock')) $('mUnblock').addEventListener('click', async () => {
      const note = $('mUnNote').value.trim();
      if (note.length < 5) { say('יש לכתוב מתי ואיך הלקוח/ה ביקש/ה לחזור לקבל הודעות', 'err'); $('mUnNote').focus(); return; }
      if (!confirm('להסיר את החסימה של ' + m.phone + '? ההסרה תבוצע גם אצל ספק ה-SMS, ותירשם כהסכמה מחודשת עם ההערה.')) return;
      const x = await api({ action: 'clubUnblock', phone: m.phone, note });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      say('החסימה הוסרה ✓', 'ok'); card(id); list();
    });
    if ($('mBlock')) $('mBlock').addEventListener('click', async () => {
      if (!confirm('לחסום את ' + m.phone + ' לקבלת דיוור ב-SMS? החסימה תבוצע גם אצל ספק ה-SMS.')) return;
      const x = await api({ action: 'clubBlock', phone: m.phone, note: $('mBlNote').value.trim() });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      say('נחסם ✓', 'ok'); card(id); list();
    });
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
