// Document management (same file in the Sidurit template web/app/ and on the Superstar site; server:
// _shared/docs-handlers.ts; the viewer every link opens: doc.html):
//   📁 טפסים ותלושים ← 📂 ניהול מסמכים   (any manager)
//     🏢 מסמכי החברה / 🔒 המסמכים שלי (only the manager who uploaded sees them) · folders · search · archive
//     a document: preview · a new version (the links stay, the readers see the new one) · rename / folder · archive / delete
//       👥 שליחה לעובדים — a personal link per employee (push, SMS optional), "read and understood" with a signature,
//          a reminder to whoever has not confirmed
//       🔗 קישור חיצוני — to anyone: a code by SMS / e-mail, an expiry, download or not, a watermark with his name,
//          "tell me when it is opened"; sent by SMS / e-mail or copied
//       per link: opened / how many times / reading time / how far (%) / confirmed + signature; time per page over all
//   the employee: "📂 מסמכים לקריאה" on the home screen, a banner while one waits for his confirmation; opens inside the app
// Uses the app's own globals: apiPost, mgrAuth, state, toast, openBlobFile.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isMgr = () => !!(appState() && appState().mgr);
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const empAuth = () => { const s = appState(); return s && s.emp ? { username: s.emp.username, password: s.emp.pw } : {}; };
  const when = (d) => { if (!d) return ''; const t = new Date(d); return isNaN(t) ? String(d) : t.toLocaleDateString('he-IL') + ' ' + t.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); };
  const dur = (s) => { s = Math.round(Number(s) || 0); if (!s) return '—'; if (s < 60) return s + ' שנ\''; const m = Math.floor(s / 60); return m < 60 ? m + ':' + String(s % 60).padStart(2, '0') + ' דק\'' : Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ' שע\''; };
  const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';
  const fileToB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
  const PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const ST = { sent: ['נשלח, לא נפתח', '#f3f4f6;#4b5563'], opened: ['נפתח', '#dbeafe;#1e40af'], acked: ['✓ אושר בחתימה', '#dcfce7;#166534'],
    expired: ['פג תוקף', '#fef9c3;#854d0e'], revoked: ['בוטל', '#fee2e2;#991b1b'] };
  const chip = (s) => { const [t, c] = ST[s] || [s, '#f3f4f6;#374151']; const [bg, fg] = c.split(';'); return '<span class="ds-st" style="background:' + bg + ';color:' + fg + '">' + t + '</span>'; };

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.ds-top{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.ds-top .ds-in{flex:1;min-width:140px}' +
    '.ds-tabs{display:flex;gap:6px;flex-wrap:wrap}.ds-tabs button{border:1.5px solid #d1d5db;background:#fff;border-radius:99px;padding:6px 14px;font:inherit;font-weight:700;cursor:pointer}' +
    '.ds-tabs button.on{background:#1b2a4a;color:#fff;border-color:#1b2a4a}' +
    '.ds-in{border:1.5px solid #d1d5db;border-radius:8px;padding:6px 9px;font:inherit;width:100%;box-sizing:border-box}' +
    '.ds-card{display:flex;gap:10px;align-items:center;border:1px solid #e5e7eb;border-radius:12px;padding:9px 12px;margin-bottom:7px;cursor:pointer;background:#fff}.ds-card:hover{border-color:#94a3b8}' +
    '.ds-card .ic{font-size:24px}.ds-card .t{font-weight:800}.ds-meta{color:#6b7280;font-size:12.5px}' +
    '.ds-st{display:inline-block;border-radius:99px;padding:2px 9px;font-size:12px;font-weight:700;white-space:nowrap}' +
    '.ds-fold{display:inline-block;background:#eef2ff;color:#3730a3;border-radius:6px;padding:0 7px;font-size:12px;font-weight:700;margin-inline-start:6px}' +
    '.ds-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:10px 0}.ds-tile{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px}' +
    '.ds-tile b{display:block;font-size:20px}.ds-tile span{color:#6b7280;font-size:12px}' +
    '.ds-acts{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.ds-acts .btn{font-size:12.5px;padding:6px 11px}' +
    '.ds-tbl{width:100%;border-collapse:collapse;font-size:13px}.ds-tbl th{text-align:start;color:#6b7280;font-weight:700;border-bottom:1.5px solid #e5e7eb;padding:5px 4px}' +
    '.ds-tbl td{border-bottom:1px solid #f1f5f9;padding:6px 4px;vertical-align:middle}.ds-tbl button{font:inherit;font-size:12px;border:1px solid #d1d5db;background:#fff;border-radius:7px;padding:2px 7px;cursor:pointer;margin:1px}' +
    '.ds-wrap{overflow-x:auto}' +
    '.ds-bar{display:grid;grid-template-columns:52px 1fr 140px;gap:8px;align-items:center;font-size:12.5px;margin:2px 0}.ds-bar i{display:block;height:12px;border-radius:4px;background:#3b82f6;min-width:2px}' +
    '.ds-f{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ds-f label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:700;color:#374151}' +
    '.ds-f .full{grid-column:1/-1}.ds-chk{display:flex!important;flex-direction:row!important;align-items:center;gap:7px;font-weight:600!important}' +
    '.ds-chk input{width:auto}.ds-emps{max-height:44vh;overflow:auto;border:1px solid #e5e7eb;border-radius:10px;padding:6px 8px;margin-top:6px}' +
    '.ds-emps label{display:flex;gap:7px;align-items:center;padding:3px 0;font-size:13.5px}.ds-emps h5{margin:8px 0 2px;color:#6b7280;font-size:12px}' +
    '.ds-link{display:flex;gap:6px;margin-top:10px}.ds-link input{flex:1;direction:ltr}' +
    '#dsBanner{background:#fef3c7;border:1px solid #fcd34d;color:#92400e;border-radius:12px;padding:10px 12px;margin:10px 0;font-weight:700;cursor:pointer}' +
    '#dsViewer .modal{max-width:980px!important;width:100%;height:92vh;display:flex;flex-direction:column}#dsViewer .mbody{flex:1;padding:0!important;overflow:hidden}' +
    '#dsViewer iframe{width:100%;height:100%;border:0;display:block}' +
    '@media (max-width:600px){.ds-f{grid-template-columns:1fr}.ds-hide-m{display:none}}' +
    '</style>');

  function overlay(id, title, sub, wide) {
    if (!$(id)) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="' + id + '"><div class="modal" style="max-width:' + (wide || 860) + 'px">' +
        '<header><h3 id="' + id + 'T"></h3><p id="' + id + 'S"></p></header>' +
        '<div class="mbody" id="' + id + 'B"></div><div class="merr" id="' + id + 'E" style="padding:0 18px"></div>' +
        '<div class="mfoot"><span class="spacer"></span><button class="btn plain" data-close>סגירה</button></div></div></div>');
      $(id).querySelector('[data-close]').addEventListener('click', () => { $(id).classList.add('hidden'); if (id === 'dsViewer') $('dsViewerB').innerHTML = ''; });
    }
    $(id + 'T').textContent = title; $(id + 'S').textContent = sub || ''; $(id + 'E').textContent = '';
    $(id).classList.remove('hidden');
    return $(id + 'B');
  }
  const err = (id, t) => { if ($(id + 'E')) $(id + 'E').textContent = t || ''; };
  async function call(body) {
    try { return await apiPost(Object.assign({}, mAuth(), body)); } catch (_) { return { ok: false, error: 'אין חיבור לשרת' }; }
  }
  async function pdfPages(b64) {
    try {
      if (!window.pdfjsLib) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = PDF_URL; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
      const bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return (await window.pdfjsLib.getDocument({ data: bytes }).promise).numPages;
    } catch (_) { return 1; }
  }
  async function readFile(f) {
    if (!f) return { error: 'יש לבחור קובץ' };
    const mime = (f.type || '').toLowerCase() || (/\.pdf$/i.test(f.name) ? 'application/pdf' : '');
    if (!/^(application\/pdf|image\/jpeg|image\/png)$/.test(mime)) return { error: 'אפשר להעלות PDF או תמונה (JPG / PNG)' };
    if (f.size > 15 * 1024 * 1024) return { error: 'הקובץ גדול מדי (עד 15MB)' };
    const data = await fileToB64(f);
    return { mime, data, fileName: f.name, pages: mime === 'application/pdf' ? await pdfPages(data) : 1 };
  }

  /* ================= the library ================= */
  let L = null, tab = 'co', q = '', folder = '', showArch = false;
  async function openLib() {
    if (!isMgr()) return;
    const body = overlay('dsOverlay', '📂 ניהול מסמכים', 'שיתוף מסמכים בקישור אישי · מי פתח, כמה זמן קרא, עד איזה עמוד · אישור קריאה בחתימה', 980);
    body.innerHTML = '<p class="ds-meta">טוען…</p>';
    const r = await call({ action: 'docsList', archived: showArch });
    if (!r.ok) { body.innerHTML = ''; err('dsOverlay', r.error); return; }
    L = r; drawLib();
  }
  function drawLib() {
    const body = $('dsOverlayB');
    const files = L.files.filter((f) => (tab === 'me') === f.personal && (!folder || f.folder === folder) && (!q || (f.title + ' ' + f.folder + ' ' + f.fileName).includes(q)) && (showArch || !f.archived));
    body.innerHTML = '<div class="ds-top"><div class="ds-tabs"><button data-t="co">🏢 מסמכי החברה</button><button data-t="me">🔒 המסמכים שלי</button></div>' +
      '<input class="ds-in" id="dsQ" placeholder="חיפוש…" value="' + e(q) + '">' +
      '<select class="ds-in" id="dsFold" style="flex:0 1 160px"><option value="">כל התיקיות</option>' + L.folders.map((x) => '<option' + (x === folder ? ' selected' : '') + '>' + e(x) + '</option>').join('') + '</select>' +
      '<button class="btn primary" id="dsUp">➕ העלאת מסמך</button></div>' +
      '<p class="ds-meta" style="margin:0 0 8px">' + (tab === 'me' ? '🔒 מסמכים אישיים — רק את/ה רואה אותם. אפשר לשתף אותם בקישור כמו כל מסמך.' : '🏢 מסמכי החברה — כל המנהלים רואים. רק מי שהעלה או אדמין משנים ומשתפים.') + '</p>' +
      '<div id="dsList">' + (files.map(cardHtml).join('') || '<p class="ds-meta" style="text-align:center;padding:24px 0">אין מסמכים' + (q || folder ? ' שמתאימים לחיפוש' : ' עדיין — "➕ העלאת מסמך" כדי להתחיל') + '</p>') + '</div>' +
      '<label class="ds-chk ds-meta" style="margin-top:8px"><input type="checkbox" id="dsArch"' + (showArch ? ' checked' : '') + '> הצגת מסמכים בארכיון</label>';
    body.querySelectorAll('[data-t]').forEach((b) => { b.classList.toggle('on', b.dataset.t === tab); b.addEventListener('click', () => { tab = b.dataset.t; drawLib(); }); });
    $('dsQ').addEventListener('input', (ev) => { q = ev.target.value.trim(); const p = ev.target.selectionStart; drawLib(); $('dsQ').focus(); $('dsQ').setSelectionRange(p, p); });
    $('dsFold').addEventListener('change', (ev) => { folder = ev.target.value; drawLib(); });
    $('dsArch').addEventListener('change', (ev) => { showArch = ev.target.checked; openLib(); });
    $('dsUp').addEventListener('click', () => uploadForm());
    body.querySelectorAll('[data-f]').forEach((c) => c.addEventListener('click', () => openFile(Number(c.dataset.f))));
  }
  function cardHtml(f) {
    const ic = f.mime === 'application/pdf' ? '📄' : '🖼';
    const meta = [f.pages + ' עמ\'', 'גרסה ' + f.version, kb(f.size)];
    const act = [];
    if (f.employees) act.push(f.employees + ' עובדים · ' + f.empOpened + ' פתחו' + (f.needAck ? ' · ' + f.empAcked + ' אישרו' : ''));
    if (f.links - f.employees > 0) act.push((f.links - f.employees) + ' קישורים חיצוניים');
    if (f.opens) act.push(f.opens + ' פתיחות · ' + dur(f.seconds) + ' קריאה');
    return '<div class="ds-card" data-f="' + f.id + '"><span class="ic">' + ic + '</span><div style="flex:1;min-width:0"><span class="t">' + e(f.title) + '</span>' +
      (f.folder ? '<span class="ds-fold">' + e(f.folder) + '</span>' : '') + (f.archived ? ' <span class="ds-st" style="background:#f3f4f6;color:#6b7280">ארכיון</span>' : '') +
      '<div class="ds-meta">' + meta.join(' · ') + (act.length ? ' — ' + act.join(' · ') : ' — עוד לא שותף') + '</div></div>' +
      '<span class="ds-meta ds-hide-m">' + (f.lastOpenAt ? 'נפתח ' + e(when(f.lastOpenAt)) : e(f.owner)) + '</span></div>';
  }

  function uploadForm(file) {
    const replace = !!file;
    const body = overlay('dsForm', replace ? '🔄 גרסה חדשה — ' + file.title : '➕ העלאת מסמך', replace ? 'כל הקישורים שכבר נשלחו ימשיכו לעבוד ויציגו את הגרסה החדשה' : 'PDF או תמונה, עד 15MB', 560);
    body.innerHTML = '<div class="ds-f">' + (replace ? '' :
      '<label class="full">כותרת<input class="ds-in" id="dfTitle" maxlength="150" placeholder="למשל: נוהל בטיחות במחסן"></label>' +
      '<label>תיקייה<input class="ds-in" id="dfFold" maxlength="60" list="dfFolds" placeholder="ללא" value="' + e(folder) + '"><datalist id="dfFolds">' + (L ? L.folders.map((x) => '<option value="' + e(x) + '">').join('') : '') + '</datalist></label>' +
      '<label class="ds-chk" style="align-self:end"><input type="checkbox" id="dfPers"' + (tab === 'me' ? ' checked' : '') + '> 🔒 מסמך אישי (רק אני רואה)</label>') +
      '<label class="full">קובץ<input class="ds-in" type="file" id="dfFile" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"></label></div>' +
      '<div style="margin-top:12px"><button class="btn primary" id="dfGo">' + (replace ? '🔄 העלאת הגרסה' : '⬆ העלאה') + '</button></div>';
    $('dfFile').addEventListener('change', () => { const f = $('dfFile').files[0]; if (f && $('dfTitle') && !$('dfTitle').value) $('dfTitle').value = f.name.replace(/\.[^.]+$/, ''); });
    $('dfGo').addEventListener('click', async (ev) => {
      const b = ev.currentTarget; err('dsForm', '');
      const rf = await readFile($('dfFile').files[0]);
      if (rf.error) { err('dsForm', rf.error); return; }
      b.disabled = true; b.textContent = 'מעלה…';
      const r = replace ? await call({ action: 'docsReplace', id: file.id, ...rf })
        : await call({ action: 'docsUpload', title: $('dfTitle').value.trim(), folder: $('dfFold').value.trim(), personal: $('dfPers').checked, ...rf });
      b.disabled = false; b.textContent = replace ? '🔄 העלאת הגרסה' : '⬆ העלאה';
      if (!r.ok) { err('dsForm', r.error); return; }
      $('dsForm').classList.add('hidden');
      say(replace ? 'הגרסה החדשה עלתה (גרסה ' + r.version + ')' : 'המסמך הועלה', 'ok');
      if (!replace && $('dfPers') && $('dfPers').checked) tab = 'me';
      await openLib();
      openFile(replace ? file.id : r.id);
    });
  }

  /* ================= one document ================= */
  let F = null;
  async function openFile(id) {
    const body = overlay('dsFile', '📄', '', 980);
    body.innerHTML = '<p class="ds-meta">טוען…</p>';
    const r = await call({ action: 'docsLinks', id });
    if (!r.ok) { body.innerHTML = ''; err('dsFile', r.error); return; }
    F = r; drawFile();
  }
  function drawFile() {
    const f = F.file, body = $('dsFileB');
    $('dsFileT').textContent = (f.mime === 'application/pdf' ? '📄 ' : '🖼 ') + f.title;
    $('dsFileS').textContent = (f.personal ? '🔒 אישי · ' : '') + (f.folder ? f.folder + ' · ' : '') + f.pages + ' עמ\' · גרסה ' + f.version + ' · הועלה ע"י ' + f.owner + ' · עודכן ' + when(f.updatedAt);
    const emp = F.links.filter((l) => l.audience === 'employee' && !l.revoked), pend = emp.filter((l) => !l.ackAt && (l.needAck || !l.opens));
    const maxS = Math.max(1, ...F.pages.map((p) => p.seconds));
    body.innerHTML =
      '<div class="ds-acts">' + (f.canEdit && !f.archived ? '<button class="btn primary" id="dsShE">👥 שליחה לעובדים</button><button class="btn primary" id="dsShX">🔗 קישור חיצוני</button>' : '') +
      '<button class="btn plain" id="dsPrev">👁 תצוגה</button>' +
      (f.canEdit ? '<button class="btn plain" id="dsVer">🔄 גרסה חדשה</button><button class="btn plain" id="dsEdit">✏ שם / תיקייה</button>' +
        '<button class="btn plain" id="dsArc">' + (f.archived ? '♻ החזרה מהארכיון' : '🗄 לארכיון') + '</button><button class="btn plain" id="dsDel" style="color:#b91c1c">🗑 מחיקה</button>' : '') + '</div>' +
      '<div class="ds-tiles"><div class="ds-tile"><b>' + F.links.length + '</b><span>קישורים</span></div><div class="ds-tile"><b>' + F.opened + '</b><span>נפתחו</span></div>' +
      '<div class="ds-tile"><b>' + f.opens + '</b><span>פתיחות</span></div><div class="ds-tile"><b>' + dur(f.seconds) + '</b><span>זמן קריאה כולל</span></div>' +
      (emp.length ? '<div class="ds-tile"><b>' + f.empAcked + '/' + emp.length + '</b><span>עובדים אישרו</span></div>' : '') + '</div>' +
      (pend.length && f.canEdit ? '<div class="ds-acts" style="align-items:center"><span class="ds-meta">' + pend.length + ' עובדים עוד לא ' + (emp.some((l) => l.needAck) ? 'אישרו' : 'פתחו') + '</span>' +
        '<button class="btn plain" id="dsRem">⏰ תזכורת (Push)</button><button class="btn plain" id="dsRemS">⏰ תזכורת + SMS</button></div>' : '') +
      '<h4 style="margin:12px 0 4px">מי קיבל ומה עשה</h4>' +
      (F.links.length ? '<div class="ds-wrap"><table class="ds-tbl"><thead><tr><th>נמען</th><th>מצב</th><th>פתיחות</th><th>זמן</th><th>הגיע/ה עד</th><th class="ds-hide-m">פתיחה אחרונה</th><th></th></tr></thead><tbody>' +
        F.links.map((l) => '<tr><td><b>' + e(l.recipient) + '</b><div class="ds-meta">' + (l.audience === 'employee' ? '👤 עובד/ת' : '🔗 ' + e(l.phone || l.email || 'קישור')) +
          (l.needCode ? ' · 🔐 קוד' : '') + (l.expiresAt ? ' · עד ' + e(when(l.expiresAt).split(' ')[0]) : '') + (l.allowDownload ? ' · ⬇' : '') + '</div></td>' +
          '<td>' + chip(l.status) + (l.ackAt ? '<div class="ds-meta">' + e(l.ackName) + ' · ' + e(when(l.ackAt)) + '</div>' : '') + '</td><td>' + l.opens + '</td><td>' + dur(l.seconds) + '</td>' +
          '<td>' + (l.opens ? l.maxPage + '/' + f.pages + ' (' + l.done + '%)' : '—') + '</td><td class="ds-hide-m">' + e(when(l.lastOpenAt)) + '</td><td style="white-space:nowrap">' +
          (l.audience === 'external' && !l.revoked ? '<button data-cp="' + l.id + '" title="העתקת הקישור">📋</button>' : '') + (l.opens ? '<button data-v="' + l.id + '" title="כל הפתיחות">📊</button>' : '') +
          (l.hasSig ? '<button data-sg="' + l.id + '" title="החתימה">✍</button>' : '') +
          (f.canEdit ? (l.revoked ? '<button data-un="' + l.id + '" title="החזרת הגישה">♻</button>' : '<button data-rv="' + l.id + '" title="ביטול הגישה">⛔</button>') : '') + '</td></tr>').join('') +
        '</tbody></table></div>' : '<p class="ds-meta">המסמך עוד לא שותף. "👥 שליחה לעובדים" או "🔗 קישור חיצוני".</p>') +
      (F.opened && f.pages > 1 ? '<h4 style="margin:14px 0 4px">זמן קריאה לפי עמוד</h4><p class="ds-meta" style="margin:0 0 6px">כמה זמן קראו בכל עמוד (כל הקוראים יחד), וכמה קוראים הגיעו אליו — כאן רואים איפה מפסיקים לקרוא</p>' +
        F.pages.slice(0, 80).map((p) => '<div class="ds-bar"><span>עמ\' ' + p.page + '</span><i style="width:' + Math.round(100 * p.seconds / maxS) + '%"></i><span class="ds-meta">' + dur(p.seconds) + ' · ' + p.readers + ' קוראים</span></div>').join('') : '');
    const on = (id, fn) => { if ($(id)) $(id).addEventListener('click', fn); };
    on('dsShE', shareEmployees); on('dsShX', shareExternal); on('dsVer', () => uploadForm(f));
    on('dsPrev', async () => { const x = await call({ action: 'docsFile', id: f.id }); if (!x.ok) { err('dsFile', x.error); return; } if (typeof openBlobFile === 'function') openBlobFile(x.data, x.filename, x.mimeType); });
    on('dsEdit', editForm);
    on('dsArc', async () => { const x = await call({ action: 'docsUpdate', id: f.id, archived: !f.archived }); if (!x.ok) { err('dsFile', x.error); return; } say(f.archived ? 'הוחזר מהארכיון' : 'הועבר לארכיון — הקישורים לא נפתחים עד שיוחזר', 'ok'); openFile(f.id); openLib(); });
    on('dsDel', async () => {
      if (!confirm('למחוק את "' + f.title + '"? כל הקישורים יפסיקו לעבוד, והמעקב והחתימות יימחקו. אי אפשר לבטל.')) return;
      const x = await call({ action: 'docsDelete', id: f.id });
      if (!x.ok) { err('dsFile', x.error); return; }
      $('dsFile').classList.add('hidden'); say('המסמך נמחק', 'ok'); openLib();
    });
    const remind = async (sms) => { const x = await call({ action: 'docsRemind', id: f.id, sms }); if (!x.ok) { err('dsFile', x.error); return; } say('נשלחה תזכורת ל-' + x.reminded + ' עובדים' + (x.smsFail ? ' (' + x.smsFail + ' SMS לא נשלחו)' : ''), 'ok'); openFile(f.id); };
    on('dsRem', () => remind(false)); on('dsRemS', () => remind(true));
    const byId = (id) => F.links.find((l) => l.id === Number(id));
    body.querySelectorAll('[data-cp]').forEach((b) => b.addEventListener('click', () => copy(byId(b.dataset.cp).url)));
    body.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => views(byId(b.dataset.v))));
    body.querySelectorAll('[data-sg]').forEach((b) => b.addEventListener('click', async () => { const x = await call({ action: 'docsAckSig', linkId: Number(b.dataset.sg) }); if (x.ok && typeof openBlobFile === 'function') openBlobFile(x.data, x.filename, x.mimeType); else err('dsFile', x.error); }));
    const setRev = async (id, revoked) => { const x = await call({ action: 'docsLinkUpdate', linkId: Number(id), revoked }); if (!x.ok) { err('dsFile', x.error); return; } say(revoked ? 'הגישה בוטלה — הקישור לא ייפתח יותר' : 'הגישה הוחזרה', 'ok'); openFile(f.id); };
    body.querySelectorAll('[data-rv]').forEach((b) => b.addEventListener('click', () => { if (confirm('לבטל את הגישה של ' + byId(b.dataset.rv).recipient + '?')) setRev(b.dataset.rv, true); }));
    body.querySelectorAll('[data-un]').forEach((b) => b.addEventListener('click', () => setRev(b.dataset.un, false)));
  }
  async function copy(url) {
    try { await navigator.clipboard.writeText(url); say('הקישור הועתק', 'ok'); }
    catch (_) { prompt('העתקת הקישור:', url); }
  }
  function editForm() {
    const f = F.file;
    const body = overlay('dsForm', '✏ ' + f.title, '', 520);
    body.innerHTML = '<div class="ds-f"><label class="full">כותרת<input class="ds-in" id="deT" maxlength="150" value="' + e(f.title) + '"></label>' +
      '<label class="full">תיקייה<input class="ds-in" id="deF" maxlength="60" list="deFolds" value="' + e(f.folder) + '"><datalist id="deFolds">' + (L ? L.folders.map((x) => '<option value="' + e(x) + '">').join('') : '') + '</datalist></label></div>' +
      '<div style="margin-top:12px"><button class="btn primary" id="deGo">💾 שמירה</button></div>';
    $('deGo').addEventListener('click', async () => {
      const x = await call({ action: 'docsUpdate', id: f.id, title: $('deT').value.trim(), folder: $('deF').value.trim() });
      if (!x.ok) { err('dsForm', x.error); return; }
      $('dsForm').classList.add('hidden'); openFile(f.id); openLib();
    });
  }
  async function views(l) {
    const body = overlay('dsForm', '📊 ' + l.recipient, 'כל הפתיחות של הקישור', 640);
    body.innerHTML = '<p class="ds-meta">טוען…</p>';
    const x = await call({ action: 'docsViews', linkId: l.id });
    if (!x.ok) { body.innerHTML = ''; err('dsForm', x.error); return; }
    body.innerHTML = '<div class="ds-wrap"><table class="ds-tbl"><thead><tr><th>מתי</th><th>זמן</th><th>עד עמוד</th><th>מכשיר</th><th>גרסה</th></tr></thead><tbody>' +
      x.views.map((v) => '<tr><td>' + e(when(v.at)) + '</td><td>' + dur(v.seconds) + '</td><td>' + v.maxPage + '</td><td>' + e(v.device) + '</td><td>' + v.version + '</td></tr>').join('') + '</tbody></table></div>';
  }

  /* ---------- sharing ---------- */
  function shareEmployees() {
    const f = F.file, s = appState(), me = s && s.mgr;
    const had = new Set(F.links.filter((l) => l.audience === 'employee' && !l.revoked).map((l) => l.employee));
    const list = ((s && s.employees) || []).filter((x) => x.active !== false && (!me || me.role === 'אדמין' || !me.branch || !x.branch || x.branch === me.branch))
      .slice().sort((a, b) => String(a.branch || '').localeCompare(String(b.branch || ''), 'he') || String(a.name).localeCompare(String(b.name), 'he'));
    const body = overlay('dsForm', '👥 שליחה לעובדים — ' + f.title, 'כל עובד/ת מקבל/ת קישור אישי, הודעת Push והמסמך מופיע במסך הבית שלו/ה', 620);
    body.innerHTML = '<input class="ds-in" id="seQ" placeholder="חיפוש שם / מחלקה…"><div class="ds-acts"><button class="btn plain" id="seAll">בחירת כל המוצגים</button><button class="btn plain" id="seNone">ניקוי</button><span class="ds-meta" id="seCnt" style="align-self:center"></span></div>' +
      '<div class="ds-emps" id="seList"></div>' +
      '<div class="ds-f" style="margin-top:10px"><label class="ds-chk full"><input type="checkbox" id="seAck" checked> ✍ לבקש אישור "קראתי והבנתי" בחתימה</label>' +
      '<label class="ds-chk"><input type="checkbox" id="seWm" checked> סימן מים עם שם העובד/ת</label><label class="ds-chk"><input type="checkbox" id="seDl"> לאפשר הורדה</label>' +
      '<label class="ds-chk full"><input type="checkbox" id="seSms"> לשלוח גם SMS עם הקישור</label>' +
      '<label class="full">הודעה (לא חובה)<textarea class="ds-in" id="seMsg" rows="2" maxlength="400" placeholder="למשל: נא לקרוא עד יום חמישי"></textarea></label></div>' +
      '<div style="margin-top:12px"><button class="btn primary" id="seGo">📨 שליחה</button></div>';
    const pick = new Set();
    const draw = () => {
      const qq = $('seQ').value.trim();
      let last = null, html = '';
      list.filter((x) => !qq || (x.name + ' ' + (x.dept || '') + ' ' + (x.branch || '')).includes(qq)).forEach((x) => {
        const br = x.branch || '';
        if (br !== last) { html += br ? '<h5>' + e(br) + '</h5>' : ''; last = br; }
        html += '<label><input type="checkbox" data-n="' + e(x.name) + '"' + (pick.has(x.name) ? ' checked' : '') + (had.has(x.name) ? ' disabled' : '') + '> ' + e(x.name) +
          ' <span class="ds-meta">' + e(x.dept || (x.depts || []).join(', ') || '') + (had.has(x.name) ? ' · כבר קיבל/ה' : '') + '</span></label>';
      });
      $('seList').innerHTML = html || '<p class="ds-meta">לא נמצאו עובדים</p>';
      $('seList').querySelectorAll('[data-n]').forEach((c) => c.addEventListener('change', () => { c.checked ? pick.add(c.dataset.n) : pick.delete(c.dataset.n); cnt(); }));
      cnt();
    };
    const cnt = () => { $('seCnt').textContent = pick.size ? 'נבחרו ' + pick.size : ''; };
    $('seQ').addEventListener('input', draw);
    $('seAll').addEventListener('click', () => { $('seList').querySelectorAll('[data-n]:not(:disabled)').forEach((c) => pick.add(c.dataset.n)); draw(); });
    $('seNone').addEventListener('click', () => { pick.clear(); draw(); });
    draw();
    $('seGo').addEventListener('click', async (ev) => {
      if (!pick.size) { err('dsForm', 'לא נבחרו עובדים'); return; }
      const b = ev.currentTarget; b.disabled = true; b.textContent = 'שולח…';
      const x = await call({ action: 'docsShareEmployees', id: f.id, employees: [...pick], needAck: $('seAck').checked, watermark: $('seWm').checked, allowDownload: $('seDl').checked,
        sms: $('seSms').checked, message: $('seMsg').value.trim() });
      b.disabled = false; b.textContent = '📨 שליחה';
      if (!x.ok) { err('dsForm', x.error); return; }
      $('dsForm').classList.add('hidden');
      say('נשלח ל-' + x.made + ' עובדים' + (x.skipped ? ' (' + x.skipped + ' כבר קיבלו)' : '') + (x.smsFail ? ' · ' + x.smsFail + ' SMS לא נשלחו' : ''), 'ok');
      openFile(f.id); openLib();
    });
  }
  function shareExternal() {
    const f = F.file;
    const body = overlay('dsForm', '🔗 קישור חיצוני — ' + f.title, 'לכל אחד: ספק, רואה חשבון, עורך דין, לקוח או אדם פרטי. כל פתיחה נרשמת.', 600);
    body.innerHTML = '<div class="ds-f"><label class="full">שם הנמען<input class="ds-in" id="sxN" maxlength="80" placeholder="למשל: רו&quot;ח דוד כהן"></label>' +
      '<label>טלפון נייד<input class="ds-in" id="sxP" inputmode="tel" dir="ltr" placeholder="05X-XXXXXXX"></label><label>מייל<input class="ds-in" id="sxM" type="email" dir="ltr"></label>' +
      '<label class="ds-chk full"><input type="checkbox" id="sxCode"> 🔐 לדרוש קוד אימות בכניסה (נשלח לטלפון / למייל של הנמען — רק הוא יוכל לפתוח)</label>' +
      '<label>תוקף הקישור<select class="ds-in" id="sxExp"><option value="0">ללא הגבלה</option><option value="1">יום אחד</option><option value="7" selected>שבוע</option><option value="14">שבועיים</option><option value="30">חודש</option><option value="90">3 חודשים</option></select></label>' +
      '<label>שליחה<select class="ds-in" id="sxSend"><option value="none">רק ליצור קישור (להעתקה)</option><option value="sms">ב-SMS</option><option value="email">במייל</option></select></label>' +
      '<label class="ds-chk"><input type="checkbox" id="sxWm" checked> סימן מים עם שם הנמען</label><label class="ds-chk"><input type="checkbox" id="sxDl"> לאפשר הורדה והדפסה</label>' +
      '<label class="ds-chk"><input type="checkbox" id="sxNot" checked> 📧 לעדכן אותי במייל כשנפתח</label><label class="ds-chk"><input type="checkbox" id="sxAck"> ✍ לבקש אישור קריאה בחתימה</label>' +
      '<label class="full">הודעה (לא חובה)<textarea class="ds-in" id="sxMsg" rows="2" maxlength="400"></textarea></label></div>' +
      '<div style="margin-top:12px"><button class="btn primary" id="sxGo">🔗 יצירת קישור</button></div><div id="sxOut"></div>';
    $('sxGo').addEventListener('click', async (ev) => {
      const b = ev.currentTarget; err('dsForm', '');
      b.disabled = true;
      const x = await call({ action: 'docsShareExternal', id: f.id, recipient: $('sxN').value.trim(), phone: $('sxP').value.trim(), email: $('sxM').value.trim(),
        needCode: $('sxCode').checked, expiresDays: Number($('sxExp').value), send: $('sxSend').value, watermark: $('sxWm').checked, allowDownload: $('sxDl').checked,
        notifyOpen: $('sxNot').checked, needAck: $('sxAck').checked, message: $('sxMsg').value.trim() });
      b.disabled = false;
      if (!x.ok) { err('dsForm', x.error); return; }
      b.style.display = 'none';
      $('sxOut').innerHTML = '<div class="hr-legal" style="background:#ecfdf5;color:#065f46;border-radius:10px;padding:8px 11px;margin-top:10px">✓ הקישור נוצר' +
        ($('sxSend').value !== 'none' ? (x.sendError ? ' — אבל לא נשלח: ' + e(x.sendError) : ' ונשלח') : '') + '</div>' +
        '<div class="ds-link"><input class="ds-in" readonly value="' + e(x.url) + '"><button class="btn plain" id="sxCp">📋 העתקה</button></div>';
      $('sxCp').addEventListener('click', () => copy(x.url));
      openFile(f.id); openLib();
      $('dsForm').classList.remove('hidden');
    });
  }

  /* ================= the employee: documents to read ================= */
  let mine = [];
  async function fetchMine() {
    const s = appState();
    if (!s || !s.emp) return;
    try { const r = await apiPost({ action: 'myDocs', ...empAuth() }); if (r && r.ok) mine = r.items || []; else return; } catch (_) { return; }
    if ($('dsBanner')) $('dsBanner').remove();
    const wait = mine.filter((d) => d.needAck || !d.opened), home = $('empHome');
    if (home && wait.length) {
      const links = home.querySelector('.eh-links');
      (links || home).insertAdjacentHTML(links ? 'beforebegin' : 'afterbegin', '<div id="dsBanner">📂 ' + (wait.length === 1 ? e(wait[0].title) + ' ממתין לך' : wait.length + ' מסמכים ממתינים לך') +
        (wait.some((d) => d.needAck) ? ' — לקריאה ולאישור' : ' — לקריאה') + '</div>');
      $('dsBanner').addEventListener('click', () => (wait.length === 1 ? view(wait[0]) : openMine()));
    }
    if ($('ehDocs')) $('ehDocs').style.display = mine.length ? '' : 'none';
  }
  function openMine() {
    const body = overlay('dsMine', '📂 מסמכים לקריאה', '', 640);
    body.innerHTML = mine.map((d, i) => '<div class="ds-card" data-i="' + i + '"><span class="ic">📄</span><div style="flex:1"><span class="t">' + e(d.title) + '</span>' +
      '<div class="ds-meta">מאת ' + e(d.from) + ' · ' + e(when(d.at)) + (d.note ? ' · ' + e(d.note) : '') + '</div></div>' +
      (d.needAck ? '<span class="ds-st" style="background:#fef3c7;color:#92400e">ממתין לאישור</span>' : d.acked ? '<span class="ds-st" style="background:#dcfce7;color:#166534">✓ אושר</span>' : !d.opened ? '<span class="ds-st" style="background:#dbeafe;color:#1e40af">חדש</span>' : '') + '</div>').join('') ||
      '<p class="ds-meta">אין מסמכים</p>';
    body.querySelectorAll('[data-i]').forEach((c) => c.addEventListener('click', () => view(mine[Number(c.dataset.i)])));
  }
  function view(d) {
    const body = overlay('dsViewer', '📄 ' + d.title, d.note || '', 980);
    body.innerHTML = '<iframe src="' + e(d.url) + '" title="' + e(d.title) + '"></iframe>';
  }
  window.addEventListener('message', (ev) => { if (ev.data && ev.data.docAck) { say('האישור נשמר ✓', 'ok'); fetchMine(); } });

  /* ================= wiring ================= */
  function start() {
    const drop = $('menuAdminDrop');
    if (drop && !$('dsMgrBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="dsMgrBtn">📂 ניהול מסמכים</button>');
      $('dsMgrBtn').addEventListener('click', openLib);
    }
    const links = document.querySelector('#empHome .eh-links');
    if (links && !$('ehDocs')) {
      links.insertAdjacentHTML('beforeend', '<button data-go="docs" id="ehDocs" style="display:none"><span class="ic">📂</span>מסמכים לקריאה</button>');
      $('ehDocs').addEventListener('click', openMine);
    }
    const home = $('empHome');
    if (home) {
      let shown = !home.classList.contains('hidden');
      if (shown) fetchMine();
      new MutationObserver(() => { const now = !home.classList.contains('hidden'); if (now && !shown) fetchMine(); shown = now; })
        .observe(home, { attributes: true, attributeFilter: ['class'] });
    }
  }
  window.openDocsLibrary = openLib;
  window.openMyDocs = openMine;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
