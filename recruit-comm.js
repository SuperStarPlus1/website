// Recruitment — the interviews' calendar and the correspondence with a candidate (same file in Superstar and Sidurit).
// Server: _shared/recruit-comm.ts. Hooks used by recruit.js:
//   rcCalendar(pane)              the "📅 יומן ראיונות" tab: a week, its interviews, + a new one
//   rcCommCard(cand, jobs, box)   in a candidate's card: his interviews (📅 קביעת ראיון) and the 💬 correspondence —
//                                 e-mail (subject, text, files) or SMS; each message with its own id (M-…)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const addD = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const dm = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
  const at = (v) => { const t = new Date(v); return isNaN(t) ? '' : t.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' + t.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); };
  const fileToB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
  const download = (b64, name, mime) => {
    if (typeof openBlobFile === 'function') { openBlobFile(b64, name, mime); return; }
    const a = document.createElement('a'); a.href = 'data:' + mime + ';base64,' + b64; a.download = name; a.click();
  };
  const MODE_IC = { frontal: '🤝', phone: '📞', video: '🎥' };
  const ST_CLS = { scheduled: '#dbeafe;#1e40af', done: '#dcfce7;#166534', cancelled: '#f3f4f6;#6b7280', no_show: '#fee2e2;#991b1b' };
  const stChip = (s, he) => { const [bg, fg] = (ST_CLS[s] || '#f3f4f6;#374151').split(';'); return '<span class="rc-st" style="background:' + bg + ';color:' + fg + '">' + e(he || s) + '</span>'; };

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.cal-nav{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.cal-nav b{min-width:150px;text-align:center}' +
    '.cal-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}@media(max-width:760px){.cal-week{grid-template-columns:1fr}}' +
    '.cal-day{border:1px solid #e5e7eb;border-radius:10px;min-height:90px;background:#fff;display:flex;flex-direction:column}' +
    '.cal-day.today{border-color:#1b2a4a;box-shadow:0 0 0 1px #1b2a4a}.cal-day h5{margin:0;padding:5px 8px;font-size:12.5px;background:#f8fafc;border-radius:10px 10px 0 0;display:flex;justify-content:space-between}' +
    '.cal-day .add{border:0;background:none;color:#64748b;cursor:pointer;font:inherit;font-size:15px;line-height:1}' +
    '.cal-iv{margin:5px;padding:5px 7px;border-radius:8px;background:#eff6ff;border-inline-start:3px solid #2563eb;font-size:12px;cursor:pointer;line-height:1.35}' +
    '.cal-iv.cancelled{opacity:.5;text-decoration:line-through;border-color:#9ca3af;background:#f3f4f6}.cal-iv.done{background:#f0fdf4;border-color:#16a34a}.cal-iv.no_show{background:#fef2f2;border-color:#dc2626}' +
    '.cal-iv b{display:block;font-size:12.5px}' +
    '.rcm-box{border:1px solid #e5e7eb;border-radius:12px;padding:10px;margin-top:12px;background:#fff}' +
    '.rcm-thread{display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto;padding:4px}' +
    '.rcm-msg{max-width:88%;border-radius:12px;padding:7px 10px;font-size:13.5px;white-space:pre-wrap;word-break:break-word}' +
    '.rcm-msg.out{align-self:flex-start;background:#eef2ff}.rcm-msg.in{align-self:flex-end;background:#f0fdf4;border:1px solid #bbf7d0}' +
    '.rcm-msg.failed{background:#fef2f2}.rcm-msg .h{font-size:11.5px;color:#6b7280;margin-bottom:3px;white-space:normal}.rcm-msg .s{font-weight:700}' +
    '.rcm-msg .more{border:0;background:none;color:#2563eb;cursor:pointer;font:inherit;font-size:12px;padding:0}' +
    '.rcm-files{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.rcm-files button{border:1px solid #d1d5db;background:#fff;border-radius:8px;padding:2px 8px;font:inherit;font-size:12px;cursor:pointer}' +
    '.rcm-compose{display:grid;gap:6px;margin-top:8px}.rcm-compose textarea,.rcm-compose input,.rcm-compose select{border:1.5px solid #d1d5db;border-radius:8px;padding:6px 8px;font:inherit;font-size:13.5px;width:100%;box-sizing:border-box}' +
    '.rcm-ch{display:flex;gap:6px}.rcm-ch button{border:1.5px solid #d1d5db;background:#fff;border-radius:99px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}.rcm-ch button.on{background:#1b2a4a;color:#fff;border-color:#1b2a4a}' +
    '.rcm-note{font-size:12px;color:#6b7280}.rcm-ivs .cal-iv{display:inline-block;min-width:200px}' +
    '#rcIvOv .rcf{display:grid;grid-template-columns:1fr 1fr;gap:8px}#rcIvOv .rcf .wide{grid-column:1/-1}@media(max-width:560px){#rcIvOv .rcf{grid-template-columns:1fr}}' +
    '#rcIvOv label{display:grid;gap:3px;font-weight:700;font-size:13px}#rcIvOv input,#rcIvOv select,#rcIvOv textarea{border:1.5px solid #d1d5db;border-radius:8px;padding:6px 8px;font:inherit;font-size:13.5px}' +
    '</style>');

  function overlay(id, title) {
    if (!$(id)) {
      document.body.insertAdjacentHTML('beforeend', '<div class="overlay hidden" id="' + id + '" style="z-index:2100"><div class="modal" style="max-width:640px">' +
        '<header><h3 id="' + id + 'T"></h3><p id="' + id + 'S"></p></header><div class="mbody" id="' + id + 'B"></div><div class="merr" id="' + id + 'E" style="padding:0 18px"></div>' +
        '<div class="mfoot" id="' + id + 'F"></div></div></div>');
    }
    $(id + 'T').textContent = title; $(id + 'S').textContent = ''; $(id + 'E').textContent = '';
    $(id + 'F').innerHTML = '<span class="spacer"></span><button class="btn plain" data-close>סגירה</button>';
    $(id + 'F').querySelector('[data-close]').addEventListener('click', () => $(id).classList.add('hidden'));
    $(id).classList.remove('hidden');
    return $(id + 'B');
  }

  /* ================= the calendar ================= */
  let weekStart = '', cal = null, calPane = null;
  const sunday = (s) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); return iso(d); };
  async function rcCalendar(pane) {
    calPane = pane;
    weekStart = weekStart || sunday(iso(new Date()));
    pane.innerHTML = '<div class="cal-nav"><button class="btn plain" id="calPrev">→ שבוע קודם</button><b id="calLbl"></b><button class="btn plain" id="calNext">שבוע הבא ←</button>' +
      '<button class="btn plain" id="calToday">היום</button><span style="flex:1"></span><button class="btn primary" id="calNew">➕ ראיון</button></div><div id="calBody"><p class="rc-meta">טוען…</p></div>';
    $('calPrev').addEventListener('click', () => { weekStart = addD(weekStart, -7); rcCalendar(pane); });
    $('calNext').addEventListener('click', () => { weekStart = addD(weekStart, 7); rcCalendar(pane); });
    $('calToday').addEventListener('click', () => { weekStart = sunday(iso(new Date())); rcCalendar(pane); });
    $('calLbl').textContent = dm(weekStart) + ' – ' + dm(addD(weekStart, 6));
    const r = await apiPost({ action: 'recruitInterviews', ...mAuth(), from: weekStart, to: addD(weekStart, 6) });
    if (!$('calBody')) return;
    if (!r.ok) { $('calBody').innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    cal = r;
    $('calNew').addEventListener('click', () => editIv(null, { date: iso(new Date()) >= weekStart && iso(new Date()) <= addD(weekStart, 6) ? iso(new Date()) : weekStart }));
    const today = iso(new Date());
    $('calBody').innerHTML = '<div class="cal-week">' + [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = addD(weekStart, i), list = r.interviews.filter((x) => x.local.slice(0, 10) === d);
      return '<div class="cal-day' + (d === today ? ' today' : '') + '"><h5><span>' + DAYS[i] + ' ' + dm(d) + '</span><button class="add" data-add="' + d + '" title="ראיון ביום הזה">＋</button></h5>' +
        list.map((x) => '<div class="cal-iv ' + x.status + '" data-iv="' + x.id + '"><b>' + x.local.slice(11) + ' ' + (MODE_IC[x.mode] || '') + ' ' + e(x.candidate) + '</b>' +
          e(x.job || '') + (x.interviewer ? '<br>' + e(x.interviewer) : '') + (x.status !== 'scheduled' ? '<br>' + e(r.statuses[x.status]) : '') + '</div>').join('') + '</div>';
    }).join('') + '</div>' +
      (r.interviews.length ? '' : '<p class="rc-meta" style="margin-top:8px">אין ראיונות בשבוע הזה. ＋ ביום — ראיון חדש; אפשר גם מכרטיס המועמד/ת.</p>');
    $('calBody').querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => editIv(null, { date: b.dataset.add })));
    $('calBody').querySelectorAll('[data-iv]').forEach((b) => b.addEventListener('click', () => editIv(r.interviews.find((x) => x.id === Number(b.dataset.iv)))));
  }

  /* ---------- one interview ---------- */
  /** iv: an existing one, or null; o: {date, candidate:{id,name,email,phone}, jobs:[{id,title}], after} */
  async function editIv(iv, o) {
    o = o || {};
    if (!cal) { const r = await apiPost({ action: 'recruitInterviews', ...mAuth() }); if (!r.ok) { say(r.error || 'שגיאה', 'err'); return; } cal = r; }
    const body = overlay('rcIvOv', iv ? '📅 ראיון — ' + iv.candidate : '📅 ראיון חדש');
    const fixed = o.candidate || (iv ? { id: iv.candidateId, name: iv.candidate, email: iv.email, phone: iv.phone } : null);
    const candList = cal.candidates.slice();
    if (fixed && !candList.some((c) => c.id === fixed.id)) candList.unshift({ ...fixed, jobs: o.jobs || (iv && iv.jobId ? [{ id: iv.jobId, title: iv.job }] : []) });
    const local = iv ? iv.local : (o.date || iso(new Date())) + 'T10:00';
    body.innerHTML = '<div class="rcf">' +
      '<label class="wide">מועמד/ת' + (fixed ? '<input value="' + e(fixed.name) + '" disabled>' : '<input id="ivQ" placeholder="חיפוש…" list="ivCands"><datalist id="ivCands">' +
        candList.map((c) => '<option value="' + e(c.name) + '">').join('') + '</datalist>') + '</label>' +
      '<label class="wide">משרה<select id="ivJob"></select></label>' +
      '<label>תאריך<input type="date" id="ivDate" value="' + local.slice(0, 10) + '"></label>' +
      '<label>שעה<input type="time" id="ivTime" value="' + local.slice(11) + '" step="300"></label>' +
      '<label>משך<select id="ivMin">' + [15, 20, 30, 45, 60, 90, 120].map((n) => '<option value="' + n + '"' + (n === (iv ? iv.minutes : 30) ? ' selected' : '') + '>' + n + ' דקות</option>').join('') + '</select></label>' +
      '<label>סוג<select id="ivMode">' + Object.entries(cal.modes).map(([k, v]) => '<option value="' + k + '"' + (k === (iv ? iv.mode : 'frontal') ? ' selected' : '') + '>' + MODE_IC[k] + ' ' + e(v) + '</option>').join('') + '</select></label>' +
      '<label class="wide"><span id="ivLocL"></span><input id="ivLoc" maxlength="300" value="' + e(iv ? iv.location : '') + '"></label>' +
      '<label>מראיין/ת<input id="ivWho" list="ivWhoL" maxlength="80" value="' + e(iv ? iv.interviewer : ((typeof state !== 'undefined' && state.mgr && state.mgr.name) || '')) + '"><datalist id="ivWhoL">' +
        cal.interviewers.map((n) => '<option value="' + e(n) + '">').join('') + '</datalist></label>' +
      (iv ? '<label>מצב<select id="ivSt">' + Object.entries(cal.statuses).map(([k, v]) => '<option value="' + k + '"' + (k === iv.status ? ' selected' : '') + '>' + e(v) + '</option>').join('') + '</select></label>' : '<span></span>') +
      '<label class="wide">הערות פנימיות<textarea id="ivNotes" rows="2" maxlength="2000">' + e(iv ? iv.notes : '') + '</textarea></label>' +
      (iv ? '<label class="wide">סיכום / תוצאה<textarea id="ivOut" rows="2" maxlength="2000">' + e(iv.outcome) + '</textarea></label>' : '') +
      '<label class="wide">' + (iv ? 'לעדכן את המועמד/ת (כשהמועד, המקום או המצב השתנו)' : 'לשלוח הזמנה למועמד/ת') + '<select id="ivNotify">' +
        '<option value="none">לא לשלוח</option><option value="email"' + (iv ? '' : ' selected') + '>📧 מייל (עם קובץ ליומן)</option>' +
        '<option value="sms"' + (cal.smsReady ? '' : ' disabled') + '>📱 SMS' + (cal.smsReady ? '' : ' — עוד לא הופעל') + '</option>' +
        '<option value="both"' + (cal.smsReady ? '' : ' disabled') + '>📧 + 📱 מייל ו-SMS</option></select></label>' +
      '<label class="wide">שורה אישית בהודעה (לא חובה)<input id="ivNote" maxlength="500" placeholder="למשל: נא להביא תעודת זהות"></label></div>';
    const pickJobs = () => {
      const c = fixed ? candList.find((x) => x.id === fixed.id) : candList.find((x) => x.name === ($('ivQ') ? $('ivQ').value.trim() : ''));
      const jobs = (c && c.jobs) || [];
      const cur = iv ? iv.jobId : (jobs[0] && jobs[0].id);
      $('ivJob').innerHTML = (jobs.length ? '' : '<option value="">—</option>') + jobs.map((j) => '<option value="' + j.id + '"' + (j.id === cur ? ' selected' : '') + '>' + e(j.title) + '</option>').join('');
      return c;
    };
    const locLabel = () => { $('ivLocL').textContent = { frontal: 'כתובת / חדר', phone: 'מספר הטלפון שאליו נתקשר', video: 'קישור לשיחת הווידאו' }[$('ivMode').value]; };
    if ($('ivQ')) $('ivQ').addEventListener('input', pickJobs);
    $('ivMode').addEventListener('change', locLabel);
    pickJobs(); locLabel();
    if (!iv && fixed && !$('ivLoc').value && $('ivMode').value === 'phone') $('ivLoc').value = fixed.phone || '';
    $('ivMode').addEventListener('change', () => { if ($('ivMode').value === 'phone' && !$('ivLoc').value) { const c = pickJobs(); if (c) $('ivLoc').value = c.phone || ''; } });
    $('rcIvOvF').insertAdjacentHTML('afterbegin', '<button class="btn primary" id="ivSave">💾 שמירה</button>' + (iv ? '<button class="btn plain" id="ivDel" style="color:#991b1b">מחיקה</button>' : ''));
    const save = async (force) => {
      const c = pickJobs();
      if (!c) { $('rcIvOvE').textContent = 'יש לבחור מועמד/ת מהרשימה'; return; }
      $('rcIvOvE').textContent = 'שומר…';
      const r = await apiPost({ action: 'saveInterview', ...mAuth(), force: force === true, notify: $('ivNotify').value, note: $('ivNote').value.trim(),
        interview: { id: iv ? iv.id : 0, candidateId: c.id, jobId: Number($('ivJob').value) || null, local: $('ivDate').value + 'T' + $('ivTime').value, minutes: Number($('ivMin').value),
          mode: $('ivMode').value, location: $('ivLoc').value.trim(), interviewer: $('ivWho').value.trim(), notes: $('ivNotes').value.trim(),
          status: $('ivSt') ? $('ivSt').value : 'scheduled', outcome: $('ivOut') ? $('ivOut').value.trim() : '' } });
      if (!r.ok && r.clash) { $('rcIvOvE').textContent = ''; if (confirm(r.error + '\n\nלשמור בכל זאת?')) save(true); return; }
      if (!r.ok) { $('rcIvOvE').textContent = r.error || 'שגיאה'; return; }
      $('rcIvOv').classList.add('hidden');
      say('הראיון נשמר ✓' + (r.sent ? ' · נשלחה הודעה למועמד/ת' : '') + (r.warning ? ' · ⚠ ' + r.warning : ''), r.warning ? 'err' : 'ok');
      refresh(o);
    };
    $('ivSave').addEventListener('click', () => save(false));
    if (iv) $('ivDel').addEventListener('click', async () => {
      if (!confirm('למחוק את הראיון? (ראיון שבוטל — עדיף לסמן "בוטל", כדי שיישאר בהיסטוריה)')) return;
      const r = await apiPost({ action: 'deleteInterview', ...mAuth(), id: iv.id });
      if (!r.ok) { $('rcIvOvE').textContent = r.error || 'שגיאה'; return; }
      $('rcIvOv').classList.add('hidden'); refresh(o);
    });
  }
  const refresh = (o) => {
    if (o && o.after) o.after();
    if (calPane && document.body.contains(calPane) && $('calBody')) rcCalendar(calPane);
  };

  /* ================= a candidate's interviews + correspondence ================= */
  const TEMPLATES = [
    ['', '— נוסח מוכן —', ''],
    ['docs', 'בקשת מסמכים', 'שלום {name},\n\nכדי להתקדם, נשמח לקבל ממך: \n\nאפשר להשיב למייל הזה ולצרף את הקבצים.\n\nתודה,\n{company}'],
    ['offer', 'הצעת עבודה', 'שלום {name},\n\nשמחים לבשר שהחלטנו להציע לך את התפקיד. נשמח לתאם שיחה קצרה על הפרטים.\n\n{company}'],
    ['reject', 'תודה, לא נמשיך', 'שלום {name},\n\nתודה על הזמן ועל ההתעניינות. לאחר שבחנו את המועמדות, החלטנו שלא להמשיך בתהליך בשלב זה.\nנשמור את פרטיך לתפקידים מתאימים בעתיד.\n\nבהצלחה,\n{company}'],
  ];
  async function rcCommCard(cand, jobs, box) {
    box.innerHTML = '<div class="rcm-box"><p class="rc-meta">טוען התכתבות…</p></div>';
    const r = await apiPost({ action: 'recruitMessages', ...mAuth(), candidateId: cand.id });
    if (!r.ok) { box.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const again = () => rcCommCard(cand, jobs, box);
    const company = r.company || '';
    let ch = r.email ? 'email' : 'sms';
    box.innerHTML = '<div class="rcm-box"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b>📅 ראיונות</b><span style="flex:1"></span>' +
        '<button class="btn plain" id="rcmIv" style="font-size:12.5px">📅 קביעת ראיון</button></div>' +
        '<div class="rcm-ivs">' + (r.interviews.length ? r.interviews.map((x) => '<div class="cal-iv ' + x.status + '" data-iv="' + x.id + '"><b>' + e(x.local.slice(8, 10) + '/' + x.local.slice(5, 7) + ' ' + x.local.slice(11)) +
          ' ' + (MODE_IC[x.mode] || '') + ' ' + stChip(x.status, { scheduled: 'מתוכנן', done: 'התקיים', cancelled: 'בוטל', no_show: 'לא הגיע/ה' }[x.status]) + '</b>' + e(x.job) + (x.interviewer ? ' · ' + e(x.interviewer) : '') +
          (x.outcome ? '<br>' + e(x.outcome) : '') + '</div>').join('') : '<p class="rc-meta">עוד לא נקבע ראיון.</p>') + '</div></div>' +
      '<div class="rcm-box"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b>💬 התכתבות</b>' + (r.token ? ' <span class="rc-meta" title="המזהה של המועמד/ת — בכתובת המענה ובנושא כל מייל">מזהה: #' + e(r.token) + '</span>' : '') + '</div>' +
        (r.inboundReady ? '' : '<p class="rcm-note">ℹ תשובות במייל עדיין לא נקלטות כאן אוטומטית — הן מגיעות לכתובת המענה הרגילה של החברה. (הפעלה בהקמת המערכת)</p>') +
        '<div class="rcm-thread" id="rcmThread">' + (r.messages.length ? r.messages.map((m) => {
          const icon = m.channel === 'sms' ? '📱' : m.channel === 'web' ? '🔗' : '📧';
          // an SMS: the delivery report from the phone company (✓ delivered / ✗ not delivered / blocked; until then "sent")
          const dlv = m.channel === 'sms' && m.direction === 'out' && m.status === 'sent' ? ({ delivered: '<span style="color:#166534">✓ נמסר</span>',
            not_delivered: '<span style="color:#b91c1c" title="' + e(m.deliveryNote) + '">✗ לא נמסר' + (m.deliveryNote ? ' (' + e(m.deliveryNote) + ')' : '') + '</span>',
            blocked: '<span style="color:#b91c1c">✗ נחסם</span>' }[m.delivery] || '') : '';
          const st = m.direction === 'in' ? 'התקבל' : dlv || (m.status === 'sent' ? 'נשלח' : m.status === 'failed' ? '⚠ נכשל' : 'לא נשלח');
          const more = m.direction === 'in' && m.short !== m.body;
          return '<div class="rcm-msg ' + m.direction + (m.status === 'failed' ? ' failed' : '') + '"><div class="h">' + icon + ' ' + (m.direction === 'in' ? 'מ: ' + e(m.from) : e(m.by) + ' ← ' + e(m.to)) +
            ' · ' + e(at(m.at)) + ' · ' + st + (m.channel === 'sms' && m.segments > 1 ? ' · ' + m.segments + ' מקטעים' : '') + ' · <span title="מזהה ההודעה">' + e(m.ref) + '</span>' + (m.error ? '<br>' + e(m.error) : '') + '</div>' +
            (m.subject ? '<div class="s">' + e(m.subject.replace(/\s*\[#[a-z2-9]{10}\]$/, '')) + '</div>' : '') +
            '<div data-txt>' + e(more ? m.short : m.body) + '</div>' + (more ? '<button class="more" data-full="' + m.id + '">הצג את כל ההודעה</button>' : '') +
            (m.files.length ? '<div class="rcm-files">' + m.files.map((f) => '<button data-file="' + m.id + ':' + f.i + '">📎 ' + e(f.name) + '</button>').join('') + '</div>' : '') + '</div>';
        }).join('') : '<p class="rc-meta">אין עדיין הודעות.</p>') + '</div>' +
        '<div class="rcm-compose"><div class="rcm-ch"><button data-ch="email"' + (r.email ? '' : ' disabled title="אין מייל"') + '>📧 מייל</button>' +
          '<button data-ch="sms"' + (r.smsReady && r.phone ? '' : ' disabled title="' + (r.smsReady ? 'אין טלפון' : 'SMS עוד לא הופעל') + '"') + '>📱 SMS' + (r.smsReady ? '' : ' (בקרוב)') + '</button>' +
          '<select id="rcmTpl" style="width:auto">' + TEMPLATES.map((t) => '<option value="' + t[0] + '">' + e(t[1]) + '</option>').join('') + '</select></div>' +
          '<input id="rcmSubj" maxlength="160" placeholder="נושא">' +
          '<textarea id="rcmText" rows="4" placeholder="תוכן ההודעה"></textarea>' +
          '<div id="rcmFilesRow"><input type="file" id="rcmFiles" multiple style="border:0;padding:0"><span class="rcm-note"> עד 3 קבצים, 8MB כל אחד</span></div>' +
          '<div style="display:flex;gap:8px;align-items:center"><button class="btn primary" id="rcmSend">📨 שליחה</button><span class="merr" id="rcmErr"></span></div></div></div>';
    if (!r.email && !(r.smsReady && r.phone)) box.querySelector('.rcm-compose').innerHTML = '<p class="rcm-note">למועמד/ת אין מייל' + (r.smsReady ? ' או טלפון' : '') + ' — אפשר להוסיף בפרטי המועמד/ת.</p>';
    const setCh = (c) => {
      ch = c;
      box.querySelectorAll('[data-ch]').forEach((b) => b.classList.toggle('on', b.dataset.ch === c));
      if ($('rcmSubj')) { $('rcmSubj').style.display = c === 'email' ? '' : 'none'; $('rcmFilesRow').style.display = c === 'email' ? '' : 'none'; $('rcmText').maxLength = c === 'sms' ? 480 : 20000; smsLen(); }
    };
    // an SMS: how many characters and parts (70 Hebrew / 160 Latin a part; longer — 67 / 153 each) — billed by parts
    function smsLen() {
      const t = $('rcmText'); if (!t) return;
      let n = $('rcmSmsLen');
      if (!n) { t.insertAdjacentHTML('afterend', '<span class="rcm-note" id="rcmSmsLen"></span>'); n = $('rcmSmsLen'); t.addEventListener('input', smsLen); }
      if (ch !== 'sms') { n.textContent = ''; return; }
      const v = t.value + (r.smsSuffix || ''), len = [...v].length, latin = /^[\x20-\x7e\r\n]*$/.test(v);   // + the reply link, added to every SMS
      const u = v.length;   // Hebrew (UCS-2): UTF-16 units — an emoji takes 2
      const parts = !len ? 0 : latin ? (len <= 160 ? 1 : Math.ceil(len / 153)) : (u <= 70 ? 1 : Math.ceil(u / 67));
      n.textContent = len + ' תווים · ' + parts + ' ' + (parts === 1 ? 'מקטע' : 'מקטעים') + (latin ? '' : ' (עברית: 70 תווים למקטע)') +
        (r.smsSuffix ? ' · כולל קישור התשובה האישי שנוסף בסוף' : '');
    }
    box.querySelectorAll('[data-ch]').forEach((b) => b.addEventListener('click', () => setCh(b.dataset.ch)));
    setCh(ch);
    $('rcmIv').addEventListener('click', () => editIv(null, { candidate: { id: cand.id, name: cand.fullName, email: cand.email, phone: cand.phone }, jobs, after: again }));
    box.querySelectorAll('.rcm-ivs [data-iv]').forEach((b) => b.addEventListener('click', () => editIv(r.interviews.find((x) => x.id === Number(b.dataset.iv)),
      { candidate: { id: cand.id, name: cand.fullName, email: cand.email, phone: cand.phone }, jobs, after: again })));
    box.querySelectorAll('[data-full]').forEach((b) => b.addEventListener('click', () => {
      const m = r.messages.find((x) => x.id === Number(b.dataset.full));
      b.previousElementSibling.textContent = m.body; b.remove();
    }));
    box.querySelectorAll('[data-file]').forEach((b) => b.addEventListener('click', async () => {
      const [id, i] = b.dataset.file.split(':').map(Number);
      const x = await apiPost({ action: 'messageAttachment', ...mAuth(), id, index: i });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      download(x.data, x.filename, x.mime);
    }));
    const th = $('rcmThread'); if (th) th.scrollTop = th.scrollHeight;
    if (!$('rcmSend')) return;
    $('rcmTpl').addEventListener('change', () => {
      const t = TEMPLATES.find((x) => x[0] === $('rcmTpl').value);
      if (!t || !t[0]) return;
      $('rcmText').value = t[2].replace('{name}', (cand.fullName || '').split(' ')[0]).replace('{company}', company);
      if (!$('rcmSubj').value) $('rcmSubj').value = t[1];
    });
    $('rcmSend').addEventListener('click', async () => {
      const err = $('rcmErr'); err.textContent = '';
      const fl = ch === 'email' ? [...$('rcmFiles').files] : [];
      if (fl.length > 3) { err.textContent = 'עד 3 קבצים'; return; }
      if (fl.some((f) => f.size > 8 * 1024 * 1024)) { err.textContent = 'קובץ גדול מדי (עד 8MB)'; return; }
      $('rcmSend').disabled = true; err.textContent = 'שולח…';
      try {
        const files = [];
        for (const f of fl) files.push({ name: f.name, mime: f.type || 'application/octet-stream', data: await fileToB64(f) });
        const x = await apiPost({ action: 'sendCandidateMessage', ...mAuth(), candidateId: cand.id, channel: ch, subject: $('rcmSubj').value.trim(), text: $('rcmText').value.trim(), files });
        if (!x.ok && !x.message) { err.textContent = x.error || 'שגיאה'; return; }
        say(x.ok ? 'נשלח ✓ · ' + x.message.ref : '⚠ ' + x.error, x.ok ? 'ok' : 'err');
        again();
      } catch (x) { err.textContent = 'שגיאה: ' + x.message; }
      finally { if ($('rcmSend')) $('rcmSend').disabled = false; }
    });
  }

  window.rcCalendar = rcCalendar;
  window.rcCommCard = rcCommCard;
  window.rcEditInterview = editIv;
})();
