// 🗂 תיק הסניף (14/11/2026, the owner — after boosty.ai: licences, contracts, certifications, equipment and faults; "the UI
// is very important — don't complicate it"). Same file in Sidurit (web/app/) and on the Superstar site. One menu item:
// 💼 ניהול העסק ▸ תפעול ▸ 🗂 תיק הסניף (menus.js), two tabs:
//   📅 מועדים ורישוי  a licence / permit / calibration / insurance / contract / an employee's certification: the due day,
//                    the days left (⛔ late · ⏳ within 30 days · ✓ valid), who is responsible, files, renewals kept.
//                    Empty: one-click templates. The admin adds / edits / renews / archives; the others see.
//   🔧 ציוד ותקלות   the open faults first (+ דיווח תקלה — any manager, with a photo; status, notes, photos), then the
//                    equipment (the admin: the price, the cost of its faults — "consider replacing" when a year's repairs
//                    reach half the price), then the closed faults (180 days)
// Reminders: the server, once a day (bfile-handlers.ts bfWatch; alert "bfile"). Server: api bf* (_shared/bfile-handlers.ts).
// Uses the app's globals: apiPost, mgrAuth, state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isMgr = () => !!(appState() && appState().mgr);
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); else alert(m); };
  const api = (action, extra) => apiPost({ action, ...mAuth(), ...(extra || {}) }).catch(() => ({ ok: false, error: 'אין חיבור לשרת' }));
  const dmy = (d) => (d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : '');
  const nis = (v) => '₪' + Math.round(Number(v || 0)).toLocaleString('he-IL');
  const ICON = { 'רישוי': '📜', 'בטיחות': '🧯', 'כיול ובדיקה': '⚖', 'ביטוח': '🛡', 'חוזה': '🤝', 'הסמכת עובד': '🎓', 'אחר': '📌' };
  const ST = { open: ['פתוחה', '#fee2e2', '#b91c1c'], wait: ['ממתינה לטכנאי', '#fef3c7', '#92400e'], closed: ['טופלה', '#dcfce7', '#166534'] };
  // one click to start — the common ones for a business (the reminder days before)
  const TEMPLATES = [['רישוי', 'רישיון עסק', 120], ['רישוי', 'היתר / אישור משרד הבריאות', 90], ['בטיחות', 'אישור כיבוי אש', 90], ['בטיחות', 'בדיקת מטפים', 30],
    ['כיול ובדיקה', 'כיול משקלות', 30], ['כיול ובדיקה', 'בדיקת מתקן חשמל', 60], ['ביטוח', 'ביטוח העסק', 60], ['חוזה', 'חוזה שכירות', 120],
    ['הסמכת עובד', 'קורס עזרה ראשונה', 30], ['הסמכת עובד', 'רישיון מלגזה', 30]];
  let D = null, tab = 'dl', filter = 'all', showArc = false, busy = false;

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#bfOv{position:fixed;inset:0;z-index:9000;background:#f1f5f9;overflow:auto;direction:rtl;font-family:inherit}#bfOv.hidden{display:none}' +
    '.bf-top{position:sticky;top:0;z-index:2;background:#1e293b;color:#fff;padding:10px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 4px 16px rgba(15,23,42,.25)}' +
    '.bf-top h2{margin:0;font-size:18px;font-weight:900}.bf-top .sp{flex:1}' +
    '.bf-seg{display:inline-flex;background:rgba(255,255,255,.1);border-radius:11px;padding:3px;gap:3px}' +
    '.bf-seg button{background:none;border:0;color:#cbd5e1;font:inherit;font-weight:800;font-size:13.5px;padding:7px 12px;border-radius:9px;cursor:pointer}' +
    '.bf-seg button.on{background:#fff;color:#0f172a}' +
    '.bf-x{background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:10px;padding:7px 12px;font:inherit;font-weight:800;cursor:pointer}' +
    '.bf-body{max-width:880px;margin:0 auto;padding:14px 14px 50px}' +
    '.bf-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}' +
    '.bf-chip{border:1.5px solid #cbd5e1;background:#fff;border-radius:99px;padding:6px 12px;font:inherit;font-size:13px;font-weight:800;color:#334155;cursor:pointer}' +
    '.bf-chip.on{background:#0f172a;border-color:#0f172a;color:#fff}' +
    '.bf-add{margin-inline-start:auto;background:#2563eb;color:#fff;border:0;border-radius:10px;padding:8px 14px;font:inherit;font-weight:800;font-size:13.5px;cursor:pointer}' +
    '.bf-row{display:flex;align-items:center;gap:12px;background:#fff;border-radius:13px;padding:11px 13px;margin-bottom:8px;box-shadow:0 1px 6px rgba(15,23,42,.06);cursor:pointer}' +
    '.bf-row:hover{background:#f8fafc}.bf-row .ic{font-size:22px;flex:none;width:28px;text-align:center}' +
    '.bf-row .tx{flex:1;min-width:0}.bf-row .tx b{display:block;font-size:14.5px;color:#0f172a}.bf-row .tx small{display:block;color:#64748b;font-size:12.5px;margin-top:2px}' +
    '.bf-days{flex:none;border-radius:10px;padding:5px 9px;font-weight:900;font-size:12.5px;text-align:center;min-width:64px}' +
    '.bf-h{font-size:14px;font-weight:900;color:#0f172a;margin:18px 2px 8px;display:flex;align-items:center;gap:8px}' +
    '.bf-empty{background:#fff;border-radius:14px;padding:18px;color:#334155;font-size:14px;line-height:1.7}' +
    '.bf-empty .bf-chip{margin:4px 0 0 6px}' +
    '.bf-note{color:#64748b;font-size:12.5px;line-height:1.6;margin-top:10px}' +
    '#bfDlg{position:fixed;inset:0;z-index:9100;background:rgba(15,23,42,.45);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:30px 10px}#bfDlg.hidden{display:none}' +
    '.bf-m{background:#fff;border-radius:16px;width:min(560px,100%);padding:16px 16px 14px;box-shadow:0 20px 50px rgba(15,23,42,.3);direction:rtl}' +
    '.bf-m h3{margin:0 0 12px;font-size:17px;font-weight:900;color:#0f172a}' +
    '.bf-f{display:grid;grid-template-columns:1fr 1fr;gap:10px}.bf-f .w{grid-column:1/-1}' +
    '.bf-f label{display:block;font-size:12.5px;font-weight:800;color:#475569}' +
    '.bf-f input,.bf-f select,.bf-f textarea{width:100%;box-sizing:border-box;margin-top:4px;border:1.5px solid #cbd5e1;border-radius:9px;padding:8px 9px;font:inherit;font-size:14px;background:#fff}' +
    '.bf-f textarea{min-height:64px;resize:vertical}' +
    '.bf-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}' +
    '.bf-acts button{border:1.5px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 13px;font:inherit;font-size:13.5px;font-weight:800;color:#0f172a;cursor:pointer}' +
    '.bf-acts button.pri{background:#2563eb;border-color:#2563eb;color:#fff}.bf-acts .sp{flex:1}' +
    '.bf-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:13.5px;color:#0f172a}.bf-kv span{color:#64748b;font-weight:700}' +
    '.bf-files a,.bf-files button.lnk{display:inline-block;margin:6px 0 0 8px;color:#2563eb;font-weight:700;font-size:13px;background:none;border:0;padding:0;cursor:pointer;font-family:inherit}' +
    '.bf-log{margin-top:10px;border-top:1px solid #f1f5f9;padding-top:8px;font-size:12.5px;color:#334155;max-height:180px;overflow:auto}.bf-log div{padding:3px 0}' +
    '.bf-log small{color:#94a3b8}' +
    '@media (max-width:520px){.bf-f{grid-template-columns:1fr}.bf-top h2{font-size:16px}.bf-seg button{padding:6px 9px;font-size:13px}}' +
    '</style>');

  /* ================= the screen ================= */
  function open() {
    if (!isMgr()) return;
    if (!$('bfOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="bfOv" class="hidden"><div class="bf-top"><h2>🗂 תיק הסניף</h2>' +
        '<div class="bf-seg"><button data-t="dl">📅 מועדים ורישוי</button><button data-t="eq">🔧 ציוד ותקלות</button></div><span class="sp"></span>' +
        '<button class="bf-x" id="bfX">✕ סגירה</button></div><div class="bf-body" id="bfBody"></div></div><div id="bfDlg" class="hidden"></div>');
      $('bfX').addEventListener('click', close);
      document.querySelectorAll('#bfOv .bf-seg button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; draw(); }));
      $('bfDlg').addEventListener('click', (ev) => { if (ev.target.id === 'bfDlg') dlgClose(); });
      document.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape' || !$('bfOv') || $('bfOv').classList.contains('hidden')) return;
        if (!$('bfDlg').classList.contains('hidden')) dlgClose(); else close();
      });
    }
    $('bfOv').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    load();
  }
  function close() { $('bfOv').classList.add('hidden'); dlgClose(); document.body.style.overflow = ''; }
  async function load() {
    if (busy) return;
    busy = true;
    if (!D) $('bfBody').innerHTML = '<div class="bf-note" style="text-align:center;padding:40px 0">⏳ טוען…</div>';
    const r = await api('bfData');
    busy = false;
    if (!r || !r.ok) { $('bfBody').innerHTML = '<div class="bf-empty">' + e((r && r.error) || 'שגיאה') + '</div>'; return; }
    D = r;
    draw();
  }
  function draw() {
    document.querySelectorAll('#bfOv .bf-seg button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    $('bfBody').innerHTML = tab === 'dl' ? dlView() : eqView();
    bind();
  }

  /* ================= 📅 the deadlines ================= */
  const state3 = (x) => (x.days < 0 ? 'late' : x.days <= 30 ? 'soon' : 'ok');
  const daysBadge = (x) => {
    if (x.days < 0) return '<span class="bf-days" style="background:#fee2e2;color:#b91c1c">⛔ פג<br>לפני ' + (-x.days) + ' ימים</span>';
    if (x.days === 0) return '<span class="bf-days" style="background:#fee2e2;color:#b91c1c">⚠ היום</span>';
    if (x.days <= 30) return '<span class="bf-days" style="background:#fef3c7;color:#92400e">⏳ עוד ' + x.days + '<br>ימים</span>';
    return '<span class="bf-days" style="background:#dcfce7;color:#166534">✓ עד<br>' + dmy(x.due).slice(0, 5) + '/' + x.due.slice(2, 4) + '</span>';
  };
  function dlView() {
    const all = D.deadlines.filter((x) => !x.archived), arc = D.deadlines.filter((x) => x.archived);
    const n = (s) => all.filter((x) => state3(x) === s).length;
    const list = (showArc ? arc : all).filter((x) => showArc || filter === 'all' || (filter === 'emp' ? x.kind === 'הסמכת עובד' : state3(x) === filter));
    let h = '<div class="bf-bar">' +
      [['all', 'הכול (' + all.length + ')'], ['late', '⛔ פג תוקף (' + n('late') + ')'], ['soon', '⏳ ב-30 יום (' + n('soon') + ')'], ['ok', '✓ בתוקף (' + n('ok') + ')'], ['emp', '🎓 עובדים']]
        .filter(([k]) => k === 'all' ? true : k === 'emp' ? all.some((x) => x.kind === 'הסמכת עובד') : n(k) > 0)
        .map(([k, l]) => '<button class="bf-chip' + (!showArc && filter === k ? ' on' : '') + '" data-f="' + k + '">' + l + '</button>').join('') +
      (D.isAdmin ? '<button class="bf-add" data-a="newDl">+ הוספה</button>' : '') + '</div>';
    if (!all.length && !showArc) {
      h += '<div class="bf-empty"><b>עוד אין כאן מועדים.</b> כאן שומרים כל מה שיש לו תאריך תפוגה — רישיונות, אישורים, כיולים, ביטוחים, חוזים והסמכות של עובדים — ' +
        'והמערכת מזכירה לפני שהם פגים.' + (D.isAdmin ? '<br>להתחלה מהירה — לחיצה על אחד מהם:<br>' + TEMPLATES.map((t, i) => '<button class="bf-chip" data-tpl="' + i + '">' + ICON[t[0]] + ' ' + e(t[1]) + '</button>').join('') : '') + '</div>';
    } else if (!list.length) h += '<div class="bf-empty">אין פריטים בסינון הזה.</div>';
    h += list.map((x) => '<div class="bf-row" data-dl="' + x.id + '"><span class="ic">' + (ICON[x.kind] || '📌') + '</span><span class="tx"><b>' + e(x.title) + (x.employee ? ' — ' + e(x.employee) : '') + '</b>' +
      '<small>' + [x.kind, x.party, x.owner ? 'אחראי: ' + x.owner : '', x.files.length ? '📎 ' + x.files.length : ''].filter(Boolean).map(e).join(' · ') + '</small></span>' + daysBadge(x) + '</div>').join('');
    if (D.isAdmin && arc.length) h += '<div class="bf-note"><button class="bf-chip" data-a="arc">' + (showArc ? '← חזרה לרשימה' : '🗄 בארכיון (' + arc.length + ')') + '</button></div>';
    h += '<div class="bf-note">תזכורת נשלחת למנהלים (Push ומייל) כמה ימים לפני — לפי מה שהוגדר לכל פריט — ושוב 30, 7 ויום אחד לפני, ביום עצמו, ואחר כך פעם בשבוע עד שמחדשים.</div>';
    return h;
  }
  function dlDetail(id) {
    const x = D.deadlines.find((d) => d.id === id);
    if (!x) return;
    const hist = x.history.slice().reverse();
    dlg('<h3>' + (ICON[x.kind] || '📌') + ' ' + e(x.title) + (x.employee ? ' — ' + e(x.employee) : '') + '</h3>' +
      '<div class="bf-kv"><span>בתוקף עד</span><b>' + dmy(x.due) + ' ' + (x.days < 0 ? '(פג לפני ' + (-x.days) + ' ימים)' : x.days === 0 ? '(היום)' : '(עוד ' + x.days + ' ימים)') + '</b>' +
      '<span>סוג</span><div>' + e(x.kind) + '</div>' + (x.party ? '<span>מול</span><div>' + e(x.party) + '</div>' : '') + (x.owner ? '<span>אחראי</span><div>' + e(x.owner) + '</div>' : '') +
      '<span>תזכורת</span><div>' + x.remindDays + ' ימים לפני</div>' + (x.branch && D.branches.length > 1 ? '<span>סניף</span><div>' + e(x.branch) + '</div>' : '') +
      (x.note ? '<span>הערות</span><div style="white-space:pre-wrap">' + e(x.note) + '</div>' : '') + '</div>' +
      '<div class="bf-files">' + (x.files.length ? x.files.map((f) => '<button class="lnk" data-file="' + e(f.path) + '">📎 ' + e(f.name) + '</button>' + (D.isAdmin ? ' <button class="lnk" style="color:#94a3b8" data-rmfile="' + e(f.path) + '" title="הסרה מהרשימה">✕</button>' : '')).join('') : '<span class="bf-note">אין קבצים.</span>') + '</div>' +
      (hist.length ? '<div class="bf-log"><b>חידושים קודמים</b>' + hist.map((h) => '<div>היה בתוקף עד ' + dmy(h.due) + ' <small>· חודש ב-' + e(h.renewedAt) + ' על ידי ' + e(h.by) + (h.note ? ' · ' + e(h.note) : '') + '</small></div>').join('') + '</div>' : '') +
      '<div class="bf-acts">' + (D.isAdmin ? (x.archived ? '<button class="pri" data-a="unarc">↩ החזרה מהארכיון</button>' :
        '<button class="pri" data-a="renew">🔄 חידוש</button><button data-a="edit">✏ עריכה</button><button data-a="file">📎 הוספת קובץ</button><button data-a="arcIt">🗄 לארכיון</button>') : '') +
      '<span class="sp"></span><button data-a="close">סגירה</button></div>');
    const d = $('bfDlg');
    d.querySelectorAll('[data-file]').forEach((b) => b.addEventListener('click', () => openFile({ id: x.id, path: b.dataset.file })));
    d.querySelectorAll('[data-rmfile]').forEach((b) => b.addEventListener('click', async () => {
      const r = await api('bfRemoveFile', { id: x.id, path: b.dataset.rmfile });
      if (!r.ok) return say(r.error, 'err');
      x.files = r.files; dlDetail(x.id);
    }));
    on('renew', () => renewForm(x)); on('edit', () => dlForm(x)); on('file', () => pickFile(async (name, b64) => {
      const r = await api('bfDeadlineFile', { id: x.id, name, b64 });
      if (!r.ok) return say(r.error, 'err');
      x.files = r.files; dlDetail(x.id); say('הקובץ נשמר ✓');
    }, true));
    on('arcIt', () => setArc(x, true)); on('unarc', () => setArc(x, false)); on('close', dlgClose);
  }
  async function setArc(x, arc) {
    const r = await api('bfArchiveDeadline', { id: x.id, archived: arc });
    if (!r.ok) return say(r.error, 'err');
    dlgClose(); say(arc ? 'הועבר לארכיון' : 'הוחזר מהארכיון'); load();
  }
  function renewForm(x) {
    const next = new Date(x.due + 'T12:00:00'); next.setFullYear(next.getFullYear() + 1);
    dlg('<h3>🔄 חידוש — ' + e(x.title) + '</h3><div class="bf-f"><div><label>בתוקף עד (חדש)<input type="date" id="bfNd" value="' + next.toISOString().slice(0, 10) + '"></label></div>' +
      '<div class="w"><label>הערה (לא חובה)<input id="bfNn" maxlength="300" placeholder="למשל: מספר אישור, עלות"></label></div></div>' +
      '<div class="bf-note">התאריך הקודם (' + dmy(x.due) + ') נשמר בהיסטוריה. כדאי לצרף גם את האישור החדש (📎).</div>' +
      '<div class="bf-acts"><button class="pri" data-a="save">שמירה</button><span class="sp"></span><button data-a="back">ביטול</button></div>');
    on('back', () => dlDetail(x.id));
    on('save', async () => {
      const r = await api('bfRenewDeadline', { id: x.id, due: $('bfNd').value, note: $('bfNn').value });
      if (!r.ok) return say(r.error, 'err');
      say('חודש ✓'); await load(); dlDetail(x.id);
    });
  }
  function dlForm(x, tpl) {
    x = x || { kind: tpl ? tpl[0] : 'רישוי', title: tpl ? tpl[1] : '', remindDays: tpl ? tpl[2] : 30, due: '', employee: '', party: '', owner: '', note: '', branch: '' };
    const opt = (list, v) => list.map((o) => '<option' + (o === v ? ' selected' : '') + '>' + e(o) + '</option>').join('');
    dlg('<h3>' + (x.id ? '✏ עריכה' : '+ מועד חדש') + '</h3><div class="bf-f">' +
      '<div><label>סוג<select id="bfK">' + opt(D.kinds, x.kind) + '</select></label></div>' +
      '<div><label>בתוקף עד<input type="date" id="bfD" value="' + e(x.due) + '"></label></div>' +
      '<div class="w"><label>מה זה<input id="bfT" maxlength="120" value="' + e(x.title) + '" placeholder="למשל: רישיון עסק"></label></div>' +
      '<div id="bfEmpW"' + (x.kind === 'הסמכת עובד' ? '' : ' style="display:none"') + '><label>עובד<select id="bfE"><option value="">—</option>' + opt(D.employees, x.employee) + '</select></label></div>' +
      '<div><label>מול מי (רשות / ספק / חברה)<input id="bfP" maxlength="120" value="' + e(x.party) + '"></label></div>' +
      '<div><label>אחראי<select id="bfO"><option value="">—</option>' + opt(D.managers, x.owner) + '</select></label></div>' +
      '<div><label>תזכורת — ימים לפני<input type="number" id="bfR" min="1" max="365" value="' + (x.remindDays || 30) + '"></label></div>' +
      (D.isAdmin && D.branches.length > 1 ? '<div><label>סניף<select id="bfB"><option value="">כל העסק</option>' + opt(D.branches, x.branch) + '</select></label></div>' : '') +
      '<div class="w"><label>הערות<textarea id="bfN" maxlength="2000">' + e(x.note) + '</textarea></label></div></div>' +
      '<div class="bf-acts"><button class="pri" data-a="save">שמירה</button><span class="sp"></span><button data-a="back">ביטול</button></div>');
    $('bfK').addEventListener('change', () => { $('bfEmpW').style.display = $('bfK').value === 'הסמכת עובד' ? '' : 'none'; });
    on('back', () => (x.id ? dlDetail(x.id) : dlgClose()));
    on('save', async () => {
      const item = { id: x.id || 0, kind: $('bfK').value, due: $('bfD').value, title: $('bfT').value, employee: $('bfK').value === 'הסמכת עובד' ? $('bfE').value : '',
        party: $('bfP').value, owner: $('bfO').value, remindDays: Number($('bfR').value), note: $('bfN').value, branch: $('bfB') ? $('bfB').value : '' };
      const r = await api('bfSaveDeadline', { item });
      if (!r.ok) return say(r.error, 'err');
      say('נשמר ✓'); filter = 'all'; showArc = false; await load(); dlDetail(r.id);
    });
  }

  /* ================= 🔧 the equipment and the faults ================= */
  const age = (t) => { const d = Math.floor((Date.now() - Date.parse(t)) / 864e5); return d <= 0 ? 'היום' : d === 1 ? 'אתמול' : 'לפני ' + d + ' ימים'; };
  const eqName = (id) => { const q = D.equipment.find((x) => x.id === id); return q ? q.name : ''; };
  const callRow = (c) => '<div class="bf-row" data-call="' + c.id + '"><span class="ic">' + (c.status === 'closed' ? '✅' : c.urgent ? '🚨' : '🔧') + '</span><span class="tx"><b>' + e(c.title) + '</b>' +
    '<small>' + [eqName(c.equipmentId), 'נפתחה ' + age(c.openedAt) + ' · ' + c.openedBy, c.photos.length ? '📷 ' + c.photos.length : '', D.isAdmin && c.cost != null ? nis(c.cost) : ''].filter(Boolean).map(e).join(' · ') + '</small></span>' +
    '<span class="bf-days" style="background:' + ST[c.status][1] + ';color:' + ST[c.status][2] + '">' + ST[c.status][0] + '</span></div>';
  function eqView() {
    const openC = D.calls.filter((c) => c.status !== 'closed'), closedC = D.calls.filter((c) => c.status === 'closed');
    const eqs = D.equipment.filter((x) => !x.archived);
    let h = '<div class="bf-bar"><span class="bf-h" style="margin:0">🔧 תקלות פתוחות (' + openC.length + ')</span><button class="bf-add" data-a="newCall">+ דיווח תקלה</button></div>';
    h += openC.length ? openC.map(callRow).join('') : '<div class="bf-empty">✓ אין תקלות פתוחות.</div>';
    h += '<div class="bf-bar" style="margin-top:20px"><span class="bf-h" style="margin:0">🧊 ציוד (' + eqs.length + ')</span>' + (D.isAdmin ? '<button class="bf-add" style="background:#fff;color:#2563eb;border:1.5px solid #2563eb" data-a="newEq">+ ציוד</button>' : '') + '</div>';
    if (!eqs.length) h += '<div class="bf-empty">' + (D.isAdmin ? 'אפשר לרשום כאן מקררים, מקפיאים, קופות, משקלות ומזגנים — עם הספק והמחיר. כל תקלה שתיפתח על מכשיר תיספר בעלות שלו, ותראו מתי כבר משתלם להחליף.' : 'עוד לא נרשם ציוד.') + '</div>';
    h += eqs.map((x) => {
      const n = openC.filter((c) => c.equipmentId === x.id).length, c = x.cost;
      const hint = D.isAdmin && x.price && c && c.year >= 0.5 * x.price;
      return '<div class="bf-row" data-eq="' + x.id + '"><span class="ic">🧊</span><span class="tx"><b>' + e(x.name) + '</b><small>' +
        [x.category, x.location, x.supplier, D.isAdmin && c && c.all ? 'תיקונים: ' + nis(c.all) + ' (' + c.calls + ')' : ''].filter(Boolean).map(e).join(' · ') + '</small></span>' +
        (hint ? '<span class="bf-days" style="background:#fef3c7;color:#92400e">💡 לשקול<br>החלפה</span>' : n ? '<span class="bf-days" style="background:#fee2e2;color:#b91c1c">' + n + ' פתוחות</span>' : '') + '</div>';
    }).join('');
    if (closedC.length) h += '<details style="margin-top:18px"><summary class="bf-h" style="cursor:pointer">✅ טופלו (' + closedC.length + ', חצי שנה אחרונה)</summary>' + closedC.map(callRow).join('') + '</details>';
    return h;
  }
  function callForm(eqId) {
    const eqs = D.equipment.filter((x) => !x.archived);
    dlg('<h3>+ דיווח תקלה</h3><div class="bf-f">' +
      '<div class="w"><label>מה התקלה<input id="bfCt" maxlength="120" placeholder="למשל: המקרר של החלב לא מקרר"></label></div>' +
      (eqs.length ? '<div class="w"><label>איזה מכשיר (לא חובה)<select id="bfCe"><option value="">—</option>' + eqs.map((x) => '<option value="' + x.id + '"' + (x.id === eqId ? ' selected' : '') + '>' + e(x.name) + (x.location ? ' · ' + e(x.location) : '') + '</option>').join('') + '</select></label></div>' : '') +
      '<div class="w"><label>פרטים<textarea id="bfCd" maxlength="2000"></textarea></label></div>' +
      '<div class="w"><label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#0f172a"><input type="checkbox" id="bfCu" style="width:auto;margin:0"> 🚨 דחוף — לא יכול לחכות</label></div>' +
      '<div class="w"><button class="bf-chip" id="bfCp" type="button">📷 צילום / תמונה</button> <span id="bfCpn" class="bf-note"></span></div></div>' +
      '<div class="bf-acts"><button class="pri" data-a="save">פתיחת תקלה</button><span class="sp"></span><button data-a="close">ביטול</button></div>');
    let photo = null;
    $('bfCp').addEventListener('click', () => pickFile((name, b64) => { photo = { name, b64 }; $('bfCpn').textContent = '✓ ' + name; }, false));
    on('close', dlgClose);
    on('save', async () => {
      const item = { title: $('bfCt').value, description: $('bfCd').value, urgent: $('bfCu').checked, equipmentId: $('bfCe') ? Number($('bfCe').value) || 0 : 0 };
      const r = await api('bfOpenCall', { item, ...(photo ? { name: photo.name, b64: photo.b64 } : {}) });
      if (!r.ok) return say(r.error, 'err');
      say('התקלה נפתחה — המנהלים קיבלו הודעה ✓'); dlgClose(); load();
    });
  }
  function callDetail(id) {
    const c = D.calls.find((x) => x.id === id);
    if (!c) return;
    const eqs = D.equipment.filter((x) => !x.archived);
    dlg('<h3>' + (c.urgent ? '🚨 ' : '🔧 ') + e(c.title) + '</h3>' +
      '<div class="bf-kv"><span>מצב</span><b style="color:' + ST[c.status][2] + '">' + ST[c.status][0] + '</b>' + (c.equipmentId ? '<span>מכשיר</span><div>' + e(eqName(c.equipmentId)) + '</div>' : '') +
      '<span>נפתחה</span><div>' + age(c.openedAt) + ' · ' + e(c.openedBy) + '</div>' + (c.closedAt ? '<span>טופלה</span><div>' + dmy(c.closedAt) + ' · ' + e(c.closedBy) + '</div>' : '') +
      (c.description ? '<span>פרטים</span><div style="white-space:pre-wrap">' + e(c.description) + '</div>' : '') + '</div>' +
      '<div class="bf-files">' + c.photos.map((f) => '<button class="lnk" data-photo="' + e(f.path) + '">📷 ' + e(f.name) + '</button>').join('') + ' <button class="lnk" data-a="addPhoto">+ תמונה</button></div>' +
      '<div class="bf-f" style="margin-top:12px"><div class="w"><label>עדכון / מה נעשה<textarea id="bfUn" maxlength="1000" placeholder="למשל: הטכנאי יגיע מחר ב-10"></textarea></label></div>' +
      (D.isAdmin ? '<div><label>עלות (₪)<input type="number" id="bfUc" min="0" value="' + (c.cost != null ? c.cost : '') + '"></label></div><div><label>ספק / טכנאי<input id="bfUs" maxlength="80" value="' + e(c.supplier) + '"></label></div>' +
        (eqs.length ? '<div class="w"><label>מכשיר<select id="bfUe"><option value="">—</option>' + eqs.map((x) => '<option value="' + x.id + '"' + (x.id === c.equipmentId ? ' selected' : '') + '>' + e(x.name) + '</option>').join('') + '</select></label></div>' : '') : '') + '</div>' +
      '<div class="bf-acts">' + (c.status !== 'closed' ? '<button class="pri" data-st="closed">✓ טופלה</button>' + (c.status !== 'wait' ? '<button data-st="wait">⏳ ממתינה לטכנאי</button>' : '') : '<button data-st="open">↩ פתיחה מחדש</button>') +
      '<button data-st="">💾 שמירת עדכון</button><span class="sp"></span><button data-a="close">סגירה</button></div>' +
      (c.log.length ? '<div class="bf-log">' + c.log.slice().reverse().map((l) => '<div>' + e(l.text) + ' <small>· ' + e(l.at) + ' · ' + e(l.by) + '</small></div>').join('') + '</div>' : ''));
    const d = $('bfDlg');
    d.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => openFile({ callId: c.id, path: b.dataset.photo })));
    on('addPhoto', () => pickFile(async (name, b64) => {
      const r = await api('bfCallPhoto', { id: c.id, name, b64 });
      if (!r.ok) return say(r.error, 'err');
      c.photos = r.photos; callDetail(c.id); say('התמונה נשמרה ✓');
    }, false));
    on('close', dlgClose);
    d.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', async () => {
      const extra = D.isAdmin ? { cost: $('bfUc').value === '' ? null : Number($('bfUc').value), supplier: $('bfUs').value, ...($('bfUe') ? { equipmentId: Number($('bfUe').value) || 0 } : {}) } : {};
      const r = await api('bfUpdateCall', { id: c.id, status: b.dataset.st, note: $('bfUn').value, ...extra });
      if (!r.ok) return say(r.error, 'err');
      say(b.dataset.st === 'closed' ? 'סומנה כטופלה ✓' : 'נשמר ✓'); await load(); if (b.dataset.st === 'closed') dlgClose(); else callDetail(c.id);
    }));
  }
  function eqDetail(id) {
    const x = D.equipment.find((q) => q.id === id);
    if (!x) return;
    const calls = D.calls.filter((c) => c.equipmentId === x.id), c = x.cost;
    dlg('<h3>🧊 ' + e(x.name) + '</h3><div class="bf-kv">' +
      [['סוג', x.category], ['מיקום', x.location], ['ספק', x.supplier], ['טלפון', x.supplierPhone], ['נקנה', dmy(x.bought)], ['אחריות עד', dmy(x.warranty)],
        ['מחיר', D.isAdmin && x.price != null ? nis(x.price) : ''], ['תיקונים', D.isAdmin && c ? nis(c.all) + ' (' + c.calls + ' תקלות) · בשנה האחרונה ' + nis(c.year) : '']]
        .filter(([, v]) => v).map(([k, v]) => '<span>' + k + '</span><div>' + (k === 'טלפון' ? '<a href="tel:' + e(v) + '">' + e(v) + '</a>' : e(v)) + '</div>').join('') +
      (x.note ? '<span>הערות</span><div style="white-space:pre-wrap">' + e(x.note) + '</div>' : '') + '</div>' +
      (D.isAdmin && x.price && c && c.year >= 0.5 * x.price ? '<div class="bf-note" style="color:#92400e;font-weight:700">💡 התיקונים בשנה האחרונה הגיעו לחצי ממחיר המכשיר — כדאי לשקול החלפה.</div>' : '') +
      (calls.length ? '<div class="bf-log"><b>תקלות</b>' + calls.map((q) => '<div>' + (q.status === 'closed' ? '✅ ' : '🔧 ') + e(q.title) + ' <small>· ' + dmy(q.openedAt) + (D.isAdmin && q.cost != null ? ' · ' + nis(q.cost) : '') + '</small></div>').join('') + '</div>' : '') +
      '<div class="bf-acts"><button class="pri" data-a="call">+ דיווח תקלה</button>' + (D.isAdmin ? '<button data-a="edit">✏ עריכה</button><button data-a="arcEq">🗄 לארכיון</button>' : '') + '<span class="sp"></span><button data-a="close">סגירה</button></div>');
    on('call', () => callForm(x.id)); on('edit', () => eqForm(x)); on('close', dlgClose);
    on('arcEq', async () => { const r = await api('bfArchiveEquipment', { id: x.id, archived: true }); if (!r.ok) return say(r.error, 'err'); dlgClose(); load(); });
  }
  function eqForm(x) {
    x = x || { name: '', category: '', location: '', supplier: '', supplierPhone: '', price: null, bought: '', warranty: '', note: '', branch: '' };
    const inp = (id, label, v, type, extra) => '<div><label>' + label + '<input id="' + id + '"' + (type ? ' type="' + type + '"' : '') + ' value="' + e(v == null ? '' : v) + '"' + (extra || '') + '></label></div>';
    dlg('<h3>' + (x.id ? '✏ עריכת ציוד' : '+ ציוד חדש') + '</h3><div class="bf-f">' +
      '<div class="w"><label>שם<input id="bfQn" maxlength="100" value="' + e(x.name) + '" placeholder="למשל: מקרר חלב 2"></label></div>' +
      inp('bfQc', 'סוג', x.category, '', ' maxlength="60" placeholder="מקרר, קופה, משקל…"') + inp('bfQl', 'מיקום', x.location, '', ' maxlength="80"') +
      inp('bfQs', 'ספק / טכנאי', x.supplier, '', ' maxlength="80"') + inp('bfQp', 'טלפון הספק', x.supplierPhone, 'tel', ' maxlength="20"') +
      inp('bfQr', 'מחיר (₪)', x.price, 'number', ' min="0"') + inp('bfQb', 'תאריך קנייה', x.bought, 'date') + inp('bfQw', 'אחריות עד', x.warranty, 'date') +
      (D.branches.length > 1 ? '<div><label>סניף<select id="bfQbr"><option value="">—</option>' + D.branches.map((b) => '<option' + (b === x.branch ? ' selected' : '') + '>' + e(b) + '</option>').join('') + '</select></label></div>' : '') +
      '<div class="w"><label>הערות<textarea id="bfQnote" maxlength="1000">' + e(x.note) + '</textarea></label></div></div>' +
      '<div class="bf-acts"><button class="pri" data-a="save">שמירה</button><span class="sp"></span><button data-a="back">ביטול</button></div>');
    on('back', () => (x.id ? eqDetail(x.id) : dlgClose()));
    on('save', async () => {
      const item = { id: x.id || 0, name: $('bfQn').value, category: $('bfQc').value, location: $('bfQl').value, supplier: $('bfQs').value, supplierPhone: $('bfQp').value,
        price: $('bfQr').value === '' ? null : Number($('bfQr').value), bought: $('bfQb').value, warranty: $('bfQw').value, note: $('bfQnote').value, branch: $('bfQbr') ? $('bfQbr').value : '' };
      const r = await api('bfSaveEquipment', { item });
      if (!r.ok) return say(r.error, 'err');
      say('נשמר ✓'); await load(); eqDetail(r.id);
    });
  }

  /* ================= helpers ================= */
  function bind() {
    const b = $('bfBody');
    b.querySelectorAll('[data-f]').forEach((x) => x.addEventListener('click', () => { filter = x.dataset.f; showArc = false; draw(); }));
    b.querySelectorAll('[data-tpl]').forEach((x) => x.addEventListener('click', () => dlForm(null, TEMPLATES[Number(x.dataset.tpl)])));
    b.querySelectorAll('[data-dl]').forEach((x) => x.addEventListener('click', () => dlDetail(Number(x.dataset.dl))));
    b.querySelectorAll('[data-call]').forEach((x) => x.addEventListener('click', () => callDetail(Number(x.dataset.call))));
    b.querySelectorAll('[data-eq]').forEach((x) => x.addEventListener('click', () => eqDetail(Number(x.dataset.eq))));
    const a = (k, f) => b.querySelectorAll('[data-a="' + k + '"]').forEach((x) => x.addEventListener('click', f));
    a('newDl', () => dlForm(null)); a('arc', () => { showArc = !showArc; draw(); }); a('newCall', () => callForm(0)); a('newEq', () => eqForm(null));
  }
  function dlg(html) { const d = $('bfDlg'); d.innerHTML = '<div class="bf-m">' + html + '</div>'; d.classList.remove('hidden'); d.scrollTop = 0; }
  function dlgClose() { const d = $('bfDlg'); if (d) { d.classList.add('hidden'); d.innerHTML = ''; } }
  function on(k, f) { $('bfDlg').querySelectorAll('[data-a="' + k + '"]').forEach((x) => x.addEventListener('click', f)); }
  async function openFile(q) {
    const w = window.open('', '_blank');
    const r = await api('bfFileUrl', q);
    if (!r.ok) { if (w) w.close(); return say(r.error, 'err'); }
    if (w) w.location = r.url; else location.href = r.url;
  }
  // a file → base64; a photo is made smaller (1600px, JPEG) — phones' photos are big
  function pickFile(cb, docs) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = docs ? 'image/*,.pdf,.doc,.docx,.xlsx' : 'image/*';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      if (f.size > 10 * 1024 * 1024 && !/^image\//.test(f.type)) return say('הקובץ גדול מדי (עד 10MB)', 'err');
      if (/^image\//.test(f.type) && !/heic/i.test(f.type)) {
        const img = new Image(), url = URL.createObjectURL(f);
        img.onload = () => {
          const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          cb(f.name.replace(/\.[^.]+$/, '') + '.jpg', c.toDataURL('image/jpeg', 0.82).split(',')[1]);
        };
        img.onerror = () => say('לא הצלחתי לקרוא את התמונה', 'err');
        img.src = url;
        return;
      }
      const rd = new FileReader();
      rd.onload = () => cb(f.name, String(rd.result).split(',')[1]);
      rd.readAsDataURL(f);
    });
    inp.click();
  }

  /* ================= the menu item ================= */
  function start() {
    const drop = $('menuOpsDrop') || $('menuSchedDrop');
    if (drop && !$('bfMgrBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="bfMgrBtn">🗂 תיק הסניף</button>');
      $('bfMgrBtn').addEventListener('click', open);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openBranchFile = open;
})();
