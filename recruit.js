// Recruitment (same file in the Sidurit template web/app/ and on the Superstar site; server: _shared/recruit-handlers.ts,
// rules: _shared/recruit-core.ts):
//   ⚙ ניהול ← 🧲 גיוס עובדים   משרות (criteria with weights, a public apply link) · מועמדים (add with a CV, a returning
//                              person found by phone / e-mail / ID, the criteria met → score, status — "לא מתאים" with
//                              a reason, history, "התקבל/ה" → terms + the employer's signature → the employee's account
//                              and the contract) · הסכמי העסקה
//   the employee:  a pending contract → a banner on the home screen and "📝 הסכם העסקה" — read, agree, sign on screen
//   the documents list (renderEmployeeDocs) — contract, CV, payslips, 101, 106, HR letters: a tab of the full employee
//   card (hr.js)
// Uses the app's own globals: apiPost, mgrAuth, state, toast, openBlobFile.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const isMgr = () => !!(appState() && appState().mgr);
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const empAuth = () => { const s = appState(); return s && s.emp ? { username: s.emp.username, password: s.emp.pw } : {}; };
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dmy = (d) => /^\d{4}-\d{2}-\d{2}/.test(d || '') ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : (d || '');
  const when = (d) => { if (!d) return ''; const t = new Date(d); return isNaN(t) ? String(d) : t.toLocaleDateString('he-IL') + ' ' + t.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); };
  const openFile = (b64, name, mime) => { if (typeof openBlobFile === 'function') openBlobFile(b64, name, mime); };
  const fileToB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
  const CV_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
  const STATUS_CLS = { new: '#e0e7ff;#3730a3', screening: '#fef9c3;#854d0e', interview: '#dbeafe;#1e40af', offer: '#ede9fe;#5b21b6', hired: '#dcfce7;#166534', unsuitable: '#fee2e2;#991b1b', withdrawn: '#f3f4f6;#4b5563' };
  const chip = (s, he) => { const [bg, fg] = (STATUS_CLS[s] || '#f3f4f6;#374151').split(';'); return '<span class="rc-st" style="background:' + bg + ';color:' + fg + '">' + e(he || s) + '</span>'; };
  const scoreBar = (n) => '<span class="rc-score"><i style="width:' + n + '%;background:' + (n >= 75 ? '#16a34a' : n >= 50 ? '#ca8a04' : '#dc2626') + '"></i></span><b>' + n + '%</b>';

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.rc-tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}.rc-tabs button{border:1.5px solid #d1d5db;background:#fff;border-radius:99px;padding:6px 14px;font:inherit;font-weight:700;cursor:pointer}' +
    '.rc-tabs button.on{background:#1b2a4a;color:#fff;border-color:#1b2a4a}' +
    '.rc-card{border:1px solid #e5e7eb;border-radius:12px;padding:9px 12px;margin-bottom:7px;cursor:pointer;background:#fff}.rc-card:hover{border-color:#94a3b8}' +
    '.rc-card .t{font-weight:800}.rc-meta{color:#6b7280;font-size:12.5px}' +
    '.rc-st{display:inline-block;border-radius:99px;padding:2px 9px;font-size:12px;font-weight:700}' +
    '.rc-score{display:inline-block;width:70px;height:7px;border-radius:9px;background:#e5e7eb;overflow:hidden;vertical-align:middle;margin-inline-end:5px}.rc-score i{display:block;height:100%}' +
    '.rc-f{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rc-f label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:700;color:#374151}' +
    '.rc-f input,.rc-f select,.rc-f textarea,.rc-in{border:1.5px solid #d1d5db;border-radius:8px;padding:6px 9px;font:inherit;font-weight:400;width:100%;box-sizing:border-box}' +
    '.rc-f .wide{grid-column:1/-1}@media(max-width:560px){.rc-f{grid-template-columns:1fr}}' +
    '.rc-crit{display:grid;grid-template-columns:1fr 92px auto auto;gap:6px;align-items:center;margin-bottom:5px}' +
    '.rc-chk{display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px dashed #eef0f4}.rc-chk .w{color:#6b7280;font-size:12px;margin-inline-start:auto}' +
    '.rc-req{color:#b91c1c;font-size:11.5px;font-weight:700}' +
    '.rc-ev{font-size:12.5px;padding:4px 0;border-bottom:1px solid #f1f5f9}.rc-ev b{margin-inline-end:5px}' +
    '.rc-warn{background:#fef3c7;color:#92400e;border-radius:10px;padding:8px 11px;margin:6px 0;font-size:13px}' +
    '.rc-sig{border:1.5px dashed #94a3b8;border-radius:10px;background:#fff;touch-action:none;width:100%;height:150px;display:block}' +
    '.rc-doc{display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid #f1f5f9}.rc-doc span{flex:1}' +
    '.rc-tb{display:grid;grid-template-columns:1fr 1fr;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:8px 0}.rc-tb div{padding:5px 9px;border-bottom:1px solid #eef0f4;display:flex;flex-direction:column}' +
    '.rc-tb span{color:#6b7280;font-size:11.5px}.rc-tb b{font-size:13.5px;font-weight:600}@media(max-width:560px){.rc-tb{grid-template-columns:1fr}}' +
    '.rc-ct h4{margin:12px 0 4px}.rc-ct p{margin:3px 0;font-size:13.5px;line-height:1.55}' +
    '#rcBanner{background:#fef3c7;border:1px solid #fcd34d;color:#92400e;border-radius:12px;padding:10px 12px;margin:10px 0;font-weight:700;cursor:pointer}' +
    '</style>');

  function overlay(id, title, sub, wide) {
    if (!$(id)) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="' + id + '"><div class="modal" style="max-width:' + (wide || 760) + 'px">' +
        '<header><h3 id="' + id + 'T"></h3><p id="' + id + 'S"></p></header>' +
        '<div class="mbody" id="' + id + 'B"></div><div class="merr" id="' + id + 'E" style="padding:0 18px"></div>' +
        '<div class="mfoot" id="' + id + 'F"></div></div></div>');
    }
    $(id + 'T').textContent = title; $(id + 'S').textContent = sub || ''; $(id + 'E').textContent = '';
    $(id + 'F').innerHTML = '<span class="spacer"></span><button class="btn plain" data-close>סגירה</button>';
    $(id + 'F').querySelector('[data-close]').addEventListener('click', () => $(id).classList.add('hidden'));
    $(id).classList.remove('hidden');
    return $(id + 'B');
  }
  const foot = (id, html) => { $(id + 'F').insertAdjacentHTML('afterbegin', html); };
  const close = (id) => $(id) && $(id).classList.add('hidden');

  /* ---------- the signature pad ---------- */
  function sigPad(canvas) {
    const ctx = canvas.getContext('2d');
    let drawn = false, down = false, last = null;
    const fit = () => { const r = canvas.getBoundingClientRect(); canvas.width = Math.max(300, Math.round(r.width * 2)); canvas.height = Math.round(r.height * 2);
      ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0f172a'; drawn = false; };
    const pt = (ev) => { const r = canvas.getBoundingClientRect(); return [(ev.clientX - r.left) * canvas.width / r.width, (ev.clientY - r.top) * canvas.height / r.height]; };
    canvas.addEventListener('pointerdown', (ev) => { down = true; last = pt(ev); canvas.setPointerCapture(ev.pointerId); ev.preventDefault(); });
    canvas.addEventListener('pointermove', (ev) => { if (!down) return; const p = pt(ev); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; drawn = true; });
    const up = () => { down = false; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    setTimeout(fit, 0);
    return { clear: fit, value: () => (drawn ? canvas.toDataURL('image/png') : '') };
  }
  const sigHtml = (id) => '<canvas class="rc-sig" id="' + id + '"></canvas><button type="button" class="btn plain" id="' + id + 'Clr" style="font-size:12px;padding:3px 10px;margin-top:4px">ניקוי החתימה</button>';
  const mountSig = (id) => { const p = sigPad($(id)); $(id + 'Clr').addEventListener('click', p.clear); return p; };

  /* ================= managers ================= */
  let A = null, tab = 'cands', filt = { jobId: '', status: '', q: '' };
  async function openMgr() {
    if (!isMgr()) return;
    const body = overlay('rcOverlay', '🧲 גיוס עובדים', 'משרות, מועמדים, קבלה לעבודה והסכם העסקה', 860);
    body.innerHTML = '<p class="rc-meta">טוען…</p>';
    const r = await apiPost({ action: 'recruitAdmin', ...mAuth() });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    A = r;
    body.innerHTML = '<div class="rc-tabs"><button data-t="cands">👤 מועמדים</button><button data-t="jobs">💼 משרות</button><button data-t="contracts">📝 הסכמי העסקה</button></div><div id="rcPane"></div>';
    body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; drawTab(); }));
    drawTab();
  }
  function drawTab() {
    document.querySelectorAll('#rcOverlayB [data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    if (tab === 'jobs') drawJobs(); else if (tab === 'contracts') drawContracts(); else drawCands();
  }
  const reload = async () => { const r = await apiPost({ action: 'recruitAdmin', ...mAuth() }); if (r.ok) A = r; };
  const statusHe = (s) => (A.statuses.find((x) => x[0] === s) || [s, s])[1];
  function applyLink(job) {
    const c = window.APP_CONFIG;
    if (c && c.APP_BASE_URL) return c.APP_BASE_URL.replace(/\/$/, '') + '/app/apply.html?c=' + encodeURIComponent(window.COMPANY || '') + '&job=' + job.token;
    return location.origin + '/apply.html?job=' + job.token;
  }

  /* ---------- jobs ---------- */
  function drawJobs() {
    const pane = $('rcPane');
    pane.innerHTML = '<button class="btn primary" id="rcNewJob">➕ משרה חדשה</button><div style="margin-top:10px">' +
      (A.jobs.length ? A.jobs.map((j) => {
        const total = Object.values(j.counts).reduce((s, n) => s + n, 0);
        return '<div class="rc-card" data-j="' + j.id + '"><div class="t">' + e(j.title) + ' ' + (j.status === 'closed' ? chip('withdrawn', 'סגורה') : chip('hired', 'פתוחה')) + '</div>' +
          '<div class="rc-meta">' + e(j.department) + ' · ' + e(j.branch) + ' · ' + j.criteria.length + ' קריטריונים · ' + total + ' מועמדים' +
          (j.counts.new ? ' · <b style="color:#3730a3">' + j.counts.new + ' חדשים</b>' : '') + '</div></div>';
      }).join('') : '<p class="rc-meta">עדיין אין משרות. פותחים משרה, מגדירים קריטריונים — ואז מוסיפים מועמדים או שולחים את הקישור להגשה.</p>') + '</div>';
    $('rcNewJob').addEventListener('click', () => editJob(null));
    pane.querySelectorAll('[data-j]').forEach((c) => c.addEventListener('click', () => editJob(A.jobs.find((j) => j.id === Number(c.dataset.j)))));
  }
  function editJob(job) {
    const j = job || { title: '', branch: A.branches[0] || '', department: '', description: '', criteria: [], status: 'open' };
    let crit = j.criteria.map((c) => ({ ...c }));
    const pane = $('rcPane');
    const depts = (b) => (A.departments[b] || []).map((d) => '<option' + (d === j.department ? ' selected' : '') + '>' + e(d) + '</option>').join('');
    pane.innerHTML = '<button class="btn plain" id="rcBack" style="font-size:12.5px">→ חזרה למשרות</button>' +
      '<div class="rc-f" style="margin-top:8px">' +
      '<label class="wide">שם המשרה<input id="rjTitle" value="' + e(j.title) + '" maxlength="80" placeholder="למשל: קופאי/ת משמרת ערב"></label>' +
      '<label>סניף<select id="rjBranch">' + A.branches.map((b) => '<option' + (b === j.branch ? ' selected' : '') + '>' + e(b) + '</option>').join('') + '</select></label>' +
      '<label>מחלקה<select id="rjDept">' + depts(j.branch) + '</select></label>' +
      '<label class="wide">תיאור (מוצג גם בדף ההגשה)<textarea id="rjDesc" rows="3" maxlength="4000">' + e(j.description) + '</textarea></label>' +
      '<label>סטטוס<select id="rjStatus"><option value="open">פתוחה — מקבלת מועמדים</option><option value="closed"' + (j.status === 'closed' ? ' selected' : '') + '>סגורה</option></select></label></div>' +
      '<h4 style="margin:14px 0 4px">קריטריונים להתאמה</h4><p class="rc-meta" style="margin:0 0 6px">משקל 1–5: כמה הקריטריון חשוב. ציון ההתאמה = סכום המשקלים שהמועמד עומד בהם מתוך הכול. "חובה" — מסומן אם חסר.</p>' +
      '<div id="rjCrit"></div><button type="button" class="btn plain" id="rjAdd" style="font-size:12.5px">➕ קריטריון</button>' +
      (job ? '<h4 style="margin:14px 0 4px">קישור להגשת מועמדות</h4><div style="display:flex;gap:6px"><input class="rc-in" id="rjLink" readonly value="' + e(applyLink(job)) + '" dir="ltr"><button type="button" class="btn plain" id="rjCopy">📋 העתקה</button></div>' +
        '<p class="rc-meta">שולחים בוואטסאפ, מפרסמים ברשתות — מי שממלא נכנס לרשימת המועמדים של המשרה (מקור: קישור).</p>' : '');
    const drawCrit = () => {
      $('rjCrit').innerHTML = crit.map((c, i) => '<div class="rc-crit" data-i="' + i + '"><input class="rc-in" data-k="label" value="' + e(c.label) + '" placeholder="למשל: ניסיון בקופה" maxlength="120">' +
        '<select class="rc-in" data-k="weight">' + [1, 2, 3, 4, 5].map((w) => '<option value="' + w + '"' + (w === Number(c.weight || 3) ? ' selected' : '') + '>משקל ' + w + '</option>').join('') + '</select>' +
        '<label style="font-size:12.5px;white-space:nowrap"><input type="checkbox" data-k="required"' + (c.required ? ' checked' : '') + '> חובה</label>' +
        '<button type="button" class="btn plain" data-del style="color:#b91c1c;padding:3px 8px">✕</button></div>').join('') || '<p class="rc-meta">אין קריטריונים — הציון יהיה 0.</p>';
      $('rjCrit').querySelectorAll('.rc-crit').forEach((row) => {
        const c = crit[Number(row.dataset.i)];
        row.querySelector('[data-k=label]').addEventListener('input', (ev) => { c.label = ev.target.value; });
        row.querySelector('[data-k=weight]').addEventListener('change', (ev) => { c.weight = Number(ev.target.value); });
        row.querySelector('[data-k=required]').addEventListener('change', (ev) => { c.required = ev.target.checked; });
        row.querySelector('[data-del]').addEventListener('click', () => { crit.splice(Number(row.dataset.i), 1); drawCrit(); });
      });
    };
    drawCrit();
    $('rjAdd').addEventListener('click', () => { crit.push({ id: 'c' + Date.now().toString(36), label: '', weight: 3, required: false }); drawCrit(); });
    $('rjBranch').addEventListener('change', () => { j.department = ''; $('rjDept').innerHTML = depts($('rjBranch').value); });
    $('rcBack').addEventListener('click', drawJobs);
    if (job) $('rjCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('rjLink').value); say('הקישור הועתק ✓', 'ok'); } catch (_) { $('rjLink').select(); } });
    $('rcOverlayF').querySelectorAll('[data-x]').forEach((b) => b.remove());
    foot('rcOverlay', '<button class="btn primary" data-x id="rjSave">💾 שמירת המשרה</button>');
    $('rjSave').addEventListener('click', async () => {
      $('rcOverlayE').textContent = 'שומר…';
      const r = await apiPost({ action: 'saveJob', ...mAuth(), job: { id: job ? job.id : undefined, title: $('rjTitle').value, branch: $('rjBranch').value, department: $('rjDept').value,
        description: $('rjDesc').value, status: $('rjStatus').value, criteria: crit.filter((c) => String(c.label).trim()) } });
      if (!r.ok) { $('rcOverlayE').textContent = r.error || 'שגיאה'; return; }
      $('rcOverlayE').textContent = ''; $('rjSave').remove();
      say('המשרה נשמרה ✓', 'ok'); await reload(); drawJobs();
    });
  }

  /* ---------- candidates ---------- */
  async function drawCands() {
    $('rcOverlayF').querySelectorAll('[data-x]').forEach((b) => b.remove());
    const pane = $('rcPane');
    pane.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn primary" id="rcNewCand">➕ מועמד/ת</button>' +
      '<select class="rc-in" id="rcFJob" style="width:auto"><option value="">כל המשרות</option>' + A.jobs.map((j) => '<option value="' + j.id + '"' + (String(j.id) === filt.jobId ? ' selected' : '') + '>' + e(j.title) + '</option>').join('') + '</select>' +
      '<select class="rc-in" id="rcFSt" style="width:auto"><option value="">כל הסטטוסים</option>' + A.statuses.map(([s, h]) => '<option value="' + s + '"' + (s === filt.status ? ' selected' : '') + '>' + e(h) + '</option>').join('') + '</select>' +
      '<input class="rc-in" id="rcFQ" placeholder="חיפוש שם / טלפון…" style="width:170px" value="' + e(filt.q) + '"></div><div id="rcList" style="margin-top:10px"><p class="rc-meta">טוען…</p></div>';
    $('rcNewCand').addEventListener('click', addCand);
    const go = async () => {
      filt = { jobId: $('rcFJob').value, status: $('rcFSt').value, q: $('rcFQ').value.trim() };
      const r = await apiPost({ action: 'recruitCandidates', ...mAuth(), jobId: filt.jobId || undefined, status: filt.status || undefined, q: filt.q || undefined });
      if (!$('rcList')) return;
      if (!r.ok) { $('rcList').innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
      $('rcList').innerHTML = r.items.length ? r.items.map((x) => '<div class="rc-card" data-c="' + x.candidateId + '"><div class="t">' + e(x.name) + ' ' + chip(x.status, x.statusHe) +
        (x.source === 'link' ? ' <span class="rc-meta">🔗 מהקישור</span>' : '') + (x.hasCv ? ' <span class="rc-meta">📎 קו"ח</span>' : '') +
        (x.rejectedBefore ? ' <span class="rc-st" style="background:#fee2e2;color:#991b1b">❌ נפסל/ה בעבר</span>' : '') +
        (x.former && x.status !== 'hired' ? ' <span class="rc-st" style="background:#fef3c7;color:#92400e">👷 ' + (x.former.active ? 'עובד/ת בחברה' : 'עובד/ת לשעבר') + '</span>' : '') + '</div>' +
        '<div class="rc-meta">' + e(x.job) + ' · ' + e(x.phone || x.email) + (x.city ? ' · ' + e(x.city) : '') + ' · ' + scoreBar(x.score) +
        (x.missingRequired.length ? ' <span class="rc-req">חסר חובה: ' + e(x.missingRequired.join(', ')) + '</span>' : '') +
        (x.reason ? '<br>סיבה: ' + e(x.reason) : '') + '</div></div>').join('')
        : '<p class="rc-meta">' + (A.jobs.length ? 'אין מועמדים לפי הסינון.' : 'קודם פותחים משרה (בלשונית "משרות").') + '</p>';
      $('rcList').querySelectorAll('[data-c]').forEach((c) => c.addEventListener('click', () => openCand(Number(c.dataset.c))));
    };
    $('rcFJob').addEventListener('change', go); $('rcFSt').addEventListener('change', go);
    let tm = 0; $('rcFQ').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(go, 350); });
    go();
  }

  function addCand() {
    const open = A.jobs.filter((j) => j.status === 'open');
    if (!open.length) { say('אין משרה פתוחה — פותחים משרה קודם', 'err'); return; }
    const pane = $('rcPane');
    pane.innerHTML = '<button class="btn plain" id="rcBack" style="font-size:12.5px">→ חזרה למועמדים</button><div class="rc-f" style="margin-top:8px">' +
      '<label class="wide">משרה<select id="ncJob">' + open.map((j) => '<option value="' + j.id + '"' + (String(j.id) === filt.jobId ? ' selected' : '') + '>' + e(j.title + ' · ' + j.department) + '</option>').join('') + '</select></label>' +
      '<label>שם מלא<input id="ncName" maxlength="80"></label><label>טלפון<input id="ncPhone" inputmode="tel" dir="ltr"></label>' +
      '<label>מייל<input id="ncEmail" type="email" dir="ltr"></label><label>ת.ז. (לא חובה)<input id="ncId" inputmode="numeric" dir="ltr"></label>' +
      '<label>עיר מגורים<input id="ncCity"></label><label>קורות חיים (PDF / Word / תמונה)<input id="ncCv" type="file" accept="' + CV_ACCEPT + '"></label>' +
      '<label class="wide">תקציר קורות חיים / התרשמות<textarea id="ncSum" rows="4" maxlength="4000"></textarea></label></div><div id="ncDup"></div>';
    $('rcBack').addEventListener('click', drawCands);
    foot('rcOverlay', '<button class="btn primary" data-x id="ncSave">💾 שמירת המועמד/ת</button>');
    const send = async (extra) => {
      $('rcOverlayE').textContent = 'שומר…';
      const f = $('ncCv').files[0];
      if (f && f.size > 6 * 1024 * 1024) { $('rcOverlayE').textContent = 'הקובץ גדול מדי (עד 6MB)'; return; }
      const cv = f ? { name: f.name, mime: f.type, data: await fileToB64(f) } : undefined;
      const r = await apiPost({ action: 'addCandidate', ...mAuth(), jobId: Number($('ncJob').value), cv, ...extra,
        candidate: { fullName: $('ncName').value, phone: $('ncPhone').value, email: $('ncEmail').value, idNumber: $('ncId').value, city: $('ncCity').value, summary: $('ncSum').value } });
      if (r.duplicate) { $('rcOverlayE').textContent = ''; showDup(r.duplicate, send); return; }
      if (!r.ok) { $('rcOverlayE').textContent = r.error || 'שגיאה'; return; }
      $('rcOverlayE').textContent = '';
      say(r.again ? 'כבר היה/תה מועמד/ת למשרה הזו — הפרטים עודכנו' : 'המועמד/ת נוסף/ה ✓', 'ok');
      await reload(); openCand(r.id);
    };
    $('ncSave').addEventListener('click', () => send({}));
  }
  function historyHtml(former, rejections) {
    return (former ? '<div class="rc-warn">👷 <b>' + (former.active ? 'עובד/ת בחברה כיום' : 'עבד/ה בחברה בעבר') + ': ' + e(former.name) + '</b> · ' + e(former.department) +
        (former.branch ? ' · ' + e(former.branch) : '') + (former.start ? ' · מ-' + e(dmy(former.start)) : '') + (former.end ? ' עד ' + e(dmy(former.end)) : '') +
        ' <span class="rc-meta">(זוהה לפי ' + e(former.by.join(', ')) + ')</span></div>' : '') +
      (rejections && rejections.length ? '<div class="rc-warn" style="background:#fee2e2;color:#991b1b"><b>❌ נפסל/ה בעבר' + (rejections.length > 1 ? ' (' + rejections.length + ' פעמים)' : '') + ':</b>' +
        rejections.map((r) => '<br>• ' + e(r.job) + (r.branch ? ' · ' + e(r.branch) : '') + ' — ' + e(r.reason || 'ללא סיבה') + ' <span class="rc-meta">' + e(when(r.at)) + '</span>').join('') + '</div>' : '');
  }
  function showDup(d, send) {
    const rej = d.applications.filter((a) => a.rejected);
    $('ncDup').innerHTML = '<div class="rc-warn"><b>⚠ ' + (d.id ? 'מועמד/ת חוזר/ת' : 'האדם כבר מוכר במערכת') + ' — ' + e(d.name) + '</b> (זוהה לפי ' + e(d.by.join(', ')) + ')' +
      (d.since ? '<br>במערכת הגיוס מאז ' + e(when(d.since)) : '') +
      (d.applications.some((a) => !a.rejected) ? '<ul style="margin:5px 0;padding-inline-start:18px">' + d.applications.filter((a) => !a.rejected).map((a) => '<li>' +
        e(a.job) + ' — ' + e(a.status) + ' · ' + e(when(a.at)) + '</li>').join('') + '</ul>' : '') + '</div>' +
      historyHtml(d.former, rej.map((a) => ({ job: a.job, reason: a.reason, at: a.at }))) +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
      (d.id ? '<button class="btn primary" id="dupJoin">צירוף לרשומה הקיימת</button><button class="btn plain" id="dupView">פתיחת הכרטיס הקיים</button>' +
        '<button class="btn plain" id="dupNew">זה אדם אחר — רשומה חדשה</button>'
        : '<button class="btn primary" id="dupNew">המשך — הוספת המועמד/ת</button>') + '</div>';
    if (d.id) { $('dupJoin').addEventListener('click', () => send({ existingId: d.id })); $('dupView').addEventListener('click', () => openCand(d.id)); }
    $('dupNew').addEventListener('click', () => send({ force: true }));
  }

  async function openCand(id) {
    $('rcOverlayF').querySelectorAll('[data-x]').forEach((b) => b.remove());
    const pane = $('rcPane');
    pane.innerHTML = '<p class="rc-meta">טוען…</p>';
    const r = await apiPost({ action: 'recruitCandidate', ...mAuth(), id });
    if (!r.ok) { pane.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const c = r.candidate;
    pane.innerHTML = '<button class="btn plain" id="rcBack" style="font-size:12.5px">→ חזרה למועמדים</button>' +
      '<h3 style="margin:8px 0 2px">' + e(c.fullName) + (c.employee ? ' <span class="rc-st" style="background:#dcfce7;color:#166534">👷 ' + e(c.employee) + '</span>' : '') + '</h3>' +
      '<div class="rc-meta">' + [c.phone, c.email, c.idNumber && 'ת.ז. ' + c.idNumber, c.city].filter(Boolean).map(e).join(' · ') + ' · במערכת מאז ' + e(when(c.createdAt)) + '</div>' +
      historyHtml(r.former && !(c.employee && r.former.name === c.employee && r.former.by[0] === 'התקבל/ה דרך הגיוס') ? r.former : null,
        (r.rejections || []).filter((x) => !r.applications.some((a) => a.appId === x.appId && a.status === 'unsuitable'))) +
      (c.hasCv ? '<button class="btn plain" id="rcCv" style="margin-top:6px;font-size:12.5px">📎 ' + e(c.cvName || 'קורות חיים') + '</button>' : '') +
      (c.summary ? '<p style="white-space:pre-wrap;background:#f8fafc;border-radius:10px;padding:8px 10px;font-size:13.5px">' + e(c.summary) + '</p>' : '') +
      r.applications.map((a) => '<div class="rc-card" style="cursor:default" data-app="' + a.appId + '"><div class="t">' + e(a.job.title) + ' ' + chip(a.status, statusHe(a.status)) +
        ' <span class="rc-meta">' + e(a.job.department) + ' · ' + (a.source === 'link' ? '🔗 מהקישור' : 'הוזן ידנית') + '</span></div>' +
        '<div style="margin:6px 0" data-checks>' + (a.job.criteria.length ? a.job.criteria.map((k) => '<label class="rc-chk"><input type="checkbox" data-k="' + e(k.id) + '"' + (a.checks[k.id] ? ' checked' : '') +
          (a.status === 'hired' ? ' disabled' : '') + '> ' + e(k.label) + (k.required ? ' <span class="rc-req">חובה</span>' : '') + '<span class="w">משקל ' + k.weight + '</span></label>').join('') : '<p class="rc-meta">למשרה אין קריטריונים.</p>') + '</div>' +
        '<div>ציון התאמה: <span data-score>' + scoreBar(a.score) + '</span> <span class="rc-req" data-miss>' + (a.missingRequired.length ? 'חסר חובה: ' + e(a.missingRequired.join(', ')) : '') + '</span></div>' +
        (a.status === 'hired' ? '<p class="rc-meta">✅ התקבל/ה — ' + (a.terms ? (a.terms.type === 'monthly' ? 'חודשי ' : 'שעתי ') + a.terms.wage + ' ₪ · התחלה ' + e(dmy(a.terms.startDate)) : '') + '</p>' :
          '<div class="rc-f" style="margin-top:8px"><label>סטטוס<select data-status>' + A.statuses.filter(([s]) => s !== 'hired').map(([s, h]) => '<option value="' + s + '"' + (s === a.status ? ' selected' : '') + '>' + e(h) + '</option>').join('') + '</select></label>' +
          '<label data-rwrap' + (a.status === 'unsuitable' ? '' : ' style="display:none"') + '>מה חוסר ההתאמה (חובה)<input data-reason value="' + e(a.reason) + '" maxlength="1000"></label>' +
          '<label class="wide">הערה להיסטוריה (לא חובה)<input data-note maxlength="2000"></label></div>' +
          '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn primary" data-save>💾 שמירה</button><button class="btn plain" data-hire style="border-color:#16a34a;color:#166534">✅ התקבל/ה למשרה…</button></div>') + '</div>').join('') +
      '<h4 style="margin:14px 0 4px">היסטוריה</h4>' + (r.events.map((v) => '<div class="rc-ev"><span class="rc-meta">' + e(when(v.at)) + '</span> <b>' + e(v.kind) + '</b>' + (v.job ? e(v.job) + ' · ' : '') + e(v.details) + ' <span class="rc-meta">— ' + e(v.who) + '</span></div>').join('') || '<p class="rc-meta">—</p>');
    $('rcBack').addEventListener('click', drawCands);
    if ($('rcCv')) $('rcCv').addEventListener('click', async () => {
      const x = await apiPost({ action: 'candidateCv', ...mAuth(), id: c.id });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      openFile(x.data, x.filename, x.mime);
    });
    pane.querySelectorAll('[data-app]').forEach((box) => {
      const a = r.applications.find((x) => x.appId === Number(box.dataset.app));
      const checks = () => { const o = {}; box.querySelectorAll('[data-checks] input').forEach((i) => { o[i.dataset.k] = i.checked; }); return o; };
      box.querySelectorAll('[data-checks] input').forEach((i) => i.addEventListener('change', () => {
        const ch = checks(), crit = a.job.criteria, total = crit.reduce((s, k) => s + k.weight, 0);
        const score = total ? Math.round(crit.filter((k) => ch[k.id]).reduce((s, k) => s + k.weight, 0) / total * 100) : 0;
        const miss = crit.filter((k) => k.required && !ch[k.id]).map((k) => k.label);
        box.querySelector('[data-score]').innerHTML = scoreBar(score);
        box.querySelector('[data-miss]').textContent = miss.length ? 'חסר חובה: ' + miss.join(', ') : '';
      }));
      const st = box.querySelector('[data-status]');
      if (!st) return;
      st.addEventListener('change', () => { box.querySelector('[data-rwrap]').style.display = st.value === 'unsuitable' ? '' : 'none'; });
      box.querySelector('[data-save]').addEventListener('click', async () => {
        $('rcOverlayE').textContent = 'שומר…';
        const x = await apiPost({ action: 'updateApplication', ...mAuth(), appId: a.appId, checks: checks(), status: st.value, reason: box.querySelector('[data-reason]').value, note: box.querySelector('[data-note]').value });
        if (!x.ok) { $('rcOverlayE').textContent = x.error || 'שגיאה'; return; }
        $('rcOverlayE').textContent = ''; say('נשמר בהצלחה ✓', 'ok'); openCand(c.id);
      });
      box.querySelector('[data-hire]').addEventListener('click', () => hire(c, a));
    });
  }

  /* ---------- hiring: the terms + the employer's signature ---------- */
  function hire(c, a) {
    $('rcOverlayF').querySelectorAll('[data-x]').forEach((b) => b.remove());
    const pane = $('rcPane');
    const mgrName = (appState().mgr && appState().mgr.name) || '';
    pane.innerHTML = '<button class="btn plain" id="rcBack" style="font-size:12.5px">→ חזרה לכרטיס</button>' +
      '<h3 style="margin:8px 0 2px">✅ קבלה לעבודה — ' + e(c.fullName) + '</h3><p class="rc-meta">' + e(a.job.title) + ' · ' + e(a.job.department) + ' · ' + e(a.job.branch) +
      '. נפתח משתמש עובד במחלקה, ונוצר הסכם העסקה שהעובד/ת יחתום/תחתום עליו באפליקציה.</p>' +
      (!c.email && !c.phone ? '<p class="rc-warn">למועמד/ת אין מייל או טלפון — לא ניתן לפתוח משתמש.</p>' : '') +
      '<div class="rc-f"><label>שם העובד/ת במערכת<input id="hName" value="' + e(c.fullName) + '" maxlength="80"></label>' +
      '<label>ת.ז. (חובה להסכם)<input id="hId" value="' + e(c.idNumber) + '" inputmode="numeric" dir="ltr"></label>' +
      '<label>סוג העסקה<select id="hType"><option value="hourly">שעתי</option><option value="monthly">חודשי (משכורת)</option></select></label>' +
      '<label><span id="hWageL">שכר לשעה (₪)</span><input id="hWage" type="number" min="0" step="0.01" dir="ltr"></label>' +
      '<label>יום המנוחה / החופש המוסכם<select id="hRest"><option value="">— בחירה —</option>' + DAYS.map((d, i) => '<option value="' + i + '"' + (i === 6 ? ' selected' : '') + '>' + d + '</option>').join('') + '</select></label>' +
      '<label>תאריך תחילת עבודה<input id="hStart" type="date"></label>' +
      '<label>ימי עבודה בשבוע<select id="hDays"><option value="6">6</option><option value="5">5</option></select></label>' +
      '<label>שעות שבועיות<input id="hHours" type="number" min="1" max="80" value="42" dir="ltr"></label>' +
      '<label>תפקיד<input id="hTitle" value="' + e(a.job.title) + '" maxlength="80"></label>' +
      '<label>ממונה ישיר/ה<input id="hMgr" value="' + e(mgrName) + '" maxlength="80"></label>' +
      '<div class="wide"><b style="font-size:12.5px">חתימת המעסיק (' + e(mgrName) + ')</b>' + sigHtml('hSig') + '</div></div>';
    const pad = mountSig('hSig');
    $('hType').addEventListener('change', () => { $('hWageL').textContent = $('hType').value === 'monthly' ? 'שכר חודשי ברוטו (₪)' : 'שכר לשעה (₪)'; });
    $('rcBack').addEventListener('click', () => openCand(c.id));
    foot('rcOverlay', '<button class="btn primary" data-x id="hGo">✅ קבלה לעבודה וחתימה</button>');
    $('hGo').addEventListener('click', async () => {
      const sig = pad.value();
      if (!sig) { $('rcOverlayE').textContent = 'יש לחתום בשם המעסיק (בתיבת החתימה)'; return; }
      if (!confirm('לקבל את ' + $('hName').value + ' לעבודה? ייפתח משתמש עובד ויישלח מייל ברוכים הבאים.')) return;
      $('rcOverlayE').textContent = 'פותח עובד/ת ויוצר הסכם…';
      $('hGo').disabled = true;
      const r = await apiPost({ action: 'hireCandidate', ...mAuth(), appId: a.appId, employeeName: $('hName').value, idNumber: $('hId').value, signature: sig,
        terms: { type: $('hType').value, wage: $('hWage').value, restDay: $('hRest').value, startDate: $('hStart').value, daysPerWeek: $('hDays').value,
          weeklyHours: $('hHours').value, jobTitle: $('hTitle').value, manager: $('hMgr').value } });
      $('hGo').disabled = false;
      if (!r.ok) { $('rcOverlayE').textContent = r.error || 'שגיאה'; return; }
      $('rcOverlayE').textContent = ''; $('hGo').remove();
      pane.innerHTML = '<div class="rc-warn" style="background:#dcfce7;color:#166534"><b>✅ ' + e(r.employee) + ' התקבל/ה לעבודה.</b><br>' +
        'שם משתמש: <b dir="ltr">' + e(r.username) + '</b> · סיסמה זמנית: <b dir="ltr">' + e(r.tempPassword) + '</b> (תוחלף בכניסה הראשונה; נשלחה גם במייל אם יש)<br>' +
        'הסכם ההעסקה ממתין לחתימת העובד/ת — יופיע לו/לה בכניסה לאפליקציה.</div>' +
        '<button class="btn plain" id="hPdf">📄 טיוטת ההסכם</button> <button class="btn plain" id="hBack2">→ חזרה למועמדים</button>';
      $('hPdf').addEventListener('click', () => contractPdf(r.contractId));
      $('hBack2').addEventListener('click', drawCands);
      await reload();
      if (typeof window.reloadEmployees === 'function') window.reloadEmployees();
    });
  }
  async function contractPdf(id, asEmp) {
    const x = await apiPost({ action: 'contractPdf', ...(asEmp ? empAuth() : mAuth()), id });
    if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
    openFile(x.data, x.filename, 'application/pdf');
  }

  /* ---------- contracts ---------- */
  async function drawContracts() {
    $('rcOverlayF').querySelectorAll('[data-x]').forEach((b) => b.remove());
    const pane = $('rcPane');
    pane.innerHTML = '<p class="rc-meta">טוען…</p>';
    const r = await apiPost({ action: 'recruitContracts', ...mAuth() });
    if (!r.ok) { pane.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    pane.innerHTML = r.items.length ? r.items.map((k) => '<div class="rc-card" data-k="' + k.id + '"><div class="t">' + e(k.employee) + ' ' +
      (k.status === 'signed' ? chip('hired', 'נחתם') : k.status === 'pending' ? chip('screening', 'ממתין לחתימת העובד/ת') : chip('withdrawn', 'בוטל')) + '</div>' +
      '<div class="rc-meta">' + (k.type === 'monthly' ? 'חודשי' : 'שעתי') + ' · ' + e(k.wage) + ' ₪ · המעסיק: ' + e(k.employer) + ' ' + e(when(k.employerAt)) +
      (k.employeeAt ? ' · העובד/ת: ' + e(when(k.employeeAt)) : '') + '</div></div>').join('') : '<p class="rc-meta">עדיין אין הסכמי העסקה — הם נוצרים בקבלת מועמד/ת לעבודה.</p>';
    pane.querySelectorAll('[data-k]').forEach((c) => c.addEventListener('click', () => contractPdf(Number(c.dataset.k))));
  }

  /* ================= the employee: sign the contract ================= */
  let mine = [];
  async function fetchMine() {
    const s = appState();
    if (!s || !s.emp) return;
    try { const r = await apiPost({ action: 'myContracts', ...empAuth() }); if (r && r.ok) mine = r.items || []; } catch (_) { return; }
    const pend = mine.find((k) => k.status === 'pending');
    const home = $('empHome');
    if ($('rcBanner')) $('rcBanner').remove();
    if (home && pend) {
      const links = home.querySelector('.eh-links');
      (links || home).insertAdjacentHTML(links ? 'beforebegin' : 'afterbegin', '<div id="rcBanner">📝 הסכם ההעסקה שלך מחכה לחתימה — לחיצה לקריאה וחתימה</div>');
      $('rcBanner').addEventListener('click', () => openSign(pend));
    }
    if ($('ehContract')) $('ehContract').style.display = mine.length ? '' : 'none';
  }
  function contractHtml(c) {
    return '<div class="rc-ct"><h3 style="text-align:center;margin:4px 0">' + e(c.title) + '</h3><div class="rc-tb">' + c.table.map(([l, v]) => '<div><span>' + e(l) + '</span><b>' + e(v) + '</b></div>').join('') + '</div>' +
      c.sections.map(([t, lines]) => '<h4>' + e(t) + '</h4>' + lines.map((l) => '<p>' + e(l) + '</p>').join('')).join('') + '</div>';
  }
  function openMine() {
    if (!mine.length) { say('אין הסכם העסקה', 'err'); return; }
    const pend = mine.find((k) => k.status === 'pending');
    if (pend) { openSign(pend); return; }
    const body = overlay('rcSignOverlay', '📝 הסכם העסקה', '', 720);
    body.innerHTML = mine.map((k) => '<div class="rc-doc"><span>הסכם העסקה · נחתם ' + e(when(k.signedAt)) + '</span><button class="btn plain" data-pdf="' + k.id + '">📄 פתיחה</button></div>').join('');
    body.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', () => contractPdf(Number(b.dataset.pdf), true)));
  }
  function openSign(k) {
    const body = overlay('rcSignOverlay', '📝 הסכם העסקה — לחתימה', 'חתום/ה ע"י המעסיק: ' + k.employer + ' · ' + when(k.employerAt), 720);
    body.innerHTML = contractHtml(k.content) +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin:14px 0 8px;font-weight:700"><input type="checkbox" id="rsAgree" style="margin-top:4px"> קראתי והבנתי את ההסכם ואני מסכים/ה לתנאיו</label>' +
      '<b style="font-size:12.5px">החתימה שלי</b>' + sigHtml('rsSig');
    const pad = mountSig('rsSig');
    foot('rcSignOverlay', '<button class="btn primary" id="rsGo">✍ חתימה על ההסכם</button>');
    $('rsGo').addEventListener('click', async () => {
      if (!$('rsAgree').checked) { $('rcSignOverlayE').textContent = 'יש לאשר שקראת והבנת את ההסכם'; return; }
      const sig = pad.value();
      if (!sig) { $('rcSignOverlayE').textContent = 'יש לחתום בתיבת החתימה'; return; }
      $('rcSignOverlayE').textContent = 'חותם…'; $('rsGo').disabled = true;
      const r = await apiPost({ action: 'signContract', ...empAuth(), id: k.id, agree: true, signature: sig });
      $('rsGo').disabled = false;
      if (!r.ok) { $('rcSignOverlayE').textContent = r.error || 'שגיאה'; return; }
      close('rcSignOverlay'); say('ההסכם נחתם ✓ — עותק נשמר אצלך תחת "הסכם העסקה"', 'ok');
      fetchMine();
    });
  }

  /* ================= the employee card: every document (admin) ================= */
  const DOC_OPEN = {
    payslip: (d) => ({ action: 'getPayslip', fileId: d.fileId }),
    f101: (d) => ({ action: 'getF101File', fileId: d.fileId }),
    f106: (d, emp) => ({ action: 'getForm106', employee: emp, id: d.id }),
    contract: (d) => ({ action: 'contractPdf', id: d.id }),
    cv: (d) => ({ action: 'candidateCv', id: d.id }),
    hr: (d) => ({ action: 'hrDocPdf', id: d.id }),
  };
  const DOC_IC = { contract: '📝', cv: '📎', payslip: '🧾', f101: '📋', f106: '📄', hr: '⚖' };
  async function openDocs(emp, into) {
    const body = into || overlay('rcDocsOverlay', '📂 מסמכים — ' + emp, 'הסכם העסקה, קורות חיים, תלושים, טפסי 101 ו-106', 640);
    body.innerHTML = '<p class="rc-meta">טוען…</p>';
    const r = await apiPost({ action: 'employeeDocuments', ...mAuth(), employee: emp });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    body.innerHTML = r.docs.length ? r.docs.map((d, i) => '<div class="rc-doc"><span>' + (DOC_IC[d.kind] || '📄') + ' ' + e(d.title) + (d.date ? ' <span class="rc-meta">' + e(String(d.date).length > 10 ? when(d.date) : dmy(d.date)) + '</span>' : '') + '</span>' +
      '<button class="btn plain" data-i="' + i + '">פתיחה</button></div>').join('') : '<p class="rc-meta">אין מסמכים לעובד/ת.</p>';
    body.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', async () => {
      const d = r.docs[Number(b.dataset.i)];
      const x = await apiPost({ ...mAuth(), ...DOC_OPEN[d.kind](d, emp) });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      openFile(x.data, x.filename || x.fileName || d.title, x.mime || x.mimeType || 'application/pdf');
    }));
  }

  /* ================= wiring ================= */
  function start() {
    const drop = $('menuAdminDrop');
    if (drop && !$('rcMgrBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="rcMgrBtn">🧲 גיוס עובדים</button>');
      $('rcMgrBtn').addEventListener('click', openMgr);
    }
    const links = document.querySelector('#empHome .eh-links');
    if (links && !$('ehContract')) {
      links.insertAdjacentHTML('beforeend', '<button data-go="contract" id="ehContract" style="display:none"><span class="ic">📝</span>הסכם העסקה</button>');
      $('ehContract').addEventListener('click', openMine);
    }
    const home = $('empHome');
    if (home) {
      let shown = !home.classList.contains('hidden');
      if (shown) fetchMine();
      new MutationObserver(() => { const now = !home.classList.contains('hidden'); if (now && !shown) fetchMine(); shown = now; })
        .observe(home, { attributes: true, attributeFilter: ['class'] });
    }
  }
  window.openRecruit = openMgr;
  window.openEmployeeDocs = openDocs;
  window.renderEmployeeDocs = openDocs;
  window.rcSigPad = (canvasId) => mountSig(canvasId);   // hr.js: the same signature pad
  window.rcSigHtml = sigHtml;
  window.rcContentHtml = contractHtml;
  window.openMyContract = openMine;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
