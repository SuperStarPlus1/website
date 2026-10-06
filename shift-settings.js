// The shift settings windows (admin; same file in Superstar and Sidurit), in the schedule menu:
//   🕒 הגדרת משמרות      the company's parts of the day (name, icon, from what hour a shift belongs to it, the hours
//                         auto-assign gives it; up to 4) and its ready-made shifts for every department
//                         → saveShiftConfig; a renamed part takes its standard, fixed days off and coming constraints along
//   🗂 משמרות לפי מחלקה  each department's shifts on each day of the week — any name (בוקר / אמצע / ערב / לילה / other),
//                         hours, the part of the day it counts as, and which one auto-assign uses → saveShiftTemplates
// Uses the app's globals: apiPost, mgrAuth, state, toast, load, effectiveBranch, DAY_NAMES. SC: shift-config.js.
(function () {
  'use strict';
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const MAX_PARTS = 4;
  const IN = 'border:1.5px solid var(--line,#e5e7eb);border-radius:8px;padding:6px 7px;font:inherit;min-width:0';

  function ensureModal() {
    if (document.getElementById('scOverlay')) return;
    document.head.insertAdjacentHTML('beforeend', '<style>' +
      '#scOverlay .sc-h{font-weight:800;font-size:14px;margin:4px 0 4px}' +
      '#scOverlay .sc-note{font-size:12px;color:var(--muted,#64748b);margin:0 0 8px;line-height:1.5}' +
      '#scOverlay .sc-row{display:grid;gap:6px;align-items:center;margin-bottom:6px}' +
      '#scOverlay .sc-part{grid-template-columns:50px 1fr 118px 118px 118px 38px}' +
      '#scOverlay .sc-type{grid-template-columns:1fr 118px 118px 38px;border-top:1px dashed var(--line,#e5e7eb);padding-top:6px}' +
      '#scOverlay .sc-cols{font-size:11px;color:var(--muted,#64748b);font-weight:700;margin-bottom:2px}' +
      '#scOverlay .sc-depts{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:5px;align-items:center;font-size:12px}' +
      '@media (max-width:560px){#scOverlay .sc-part{grid-template-columns:46px 1fr 1fr 38px}#scOverlay .sc-part .sc-auto{grid-column:span 1}' +
      '#scOverlay .sc-type{grid-template-columns:1fr 1fr 1fr 38px}}' +
      '</style>');
    document.body.insertAdjacentHTML('beforeend',
      '<div class="overlay hidden" id="scOverlay"><div class="modal wide" style="max-width:760px">' +
      '<header><h3>🕒 הגדרת משמרות</h3><p>חלקי היום שהסידור עובד לפיהם, והמשמרות המוכנות בחלון המשמרת</p></header>' +
      '<div class="mbody">' +
      '<div class="sc-h">חלקי היום</div>' +
      '<p class="sc-note">משמרת שייכת לחלק היום שבו היא מתחילה ("מ-שעה"). לפי החלקים נקבעים: תקן העובדים, האילוצים ואי-הזמינות של העובדים, ' +
      'החופש הקבוע והשיבוץ האוטומטי (שמשבץ בשעות של החלק). משמרת שמתחילה לפני החלק הראשון — שייכת לאחרון (משמרת לילה).</p>' +
      '<div class="sc-row sc-part sc-cols"><span>סמל</span><span>שם</span><span>מ-שעה</span><span>שיבוץ: התחלה</span><span>סיום</span><span></span></div>' +
      '<div id="scParts"></div>' +
      '<button type="button" class="btn plain" id="scAddPart">+ חלק יום</button>' +
      '<div class="sc-h" style="margin-top:16px">משמרות מוכנות</div>' +
      '<p class="sc-note">הכפתורים בחלון המשמרת, לכל המחלקות. משמרות של מחלקה מסוימת, ושעות שונות לפי יום בשבוע — ב-' +
      '<a href="#" id="scToDept">🗂 משמרות לפי מחלקה</a>.</p>' +
      '<div id="scTypes"></div>' +
      '<button type="button" class="btn plain" id="scAddType">+ משמרת</button>' +
      '</div>' +
      '<div class="merr" id="scErr" style="padding:0 18px"></div>' +
      '<div class="mfoot"><button class="btn primary" id="scSave">שמירה</button><span class="spacer"></span>' +
      '<button class="btn plain" id="scDefaults" title="בוקר מ-00:00 וערב מ-15:00, ו-4 משמרות כלליות">ברירת מחדל</button>' +
      '<button class="btn plain" id="scClose">ביטול</button></div></div></div>');
    const ov = document.getElementById('scOverlay');
    document.getElementById('scClose').addEventListener('click', () => ov.classList.add('hidden'));
    document.getElementById('scAddPart').addEventListener('click', () => {
      if (document.querySelectorAll('#scParts .sc-part').length >= MAX_PARTS) { say('עד ' + MAX_PARTS + ' חלקי יום', 'err'); return; }
      addPart({ key: '', icon: '', from: '', start: '', end: '' }, '');
    });
    document.getElementById('scAddType').addEventListener('click', () => addType({ name: '', start: '', end: '', depts: [] }));
    document.getElementById('scDefaults').addEventListener('click', () => fill(SC.DEF, false));
    document.getElementById('scSave').addEventListener('click', save);
    document.getElementById('scToDept').addEventListener('click', (ev) => { ev.preventDefault(); ov.classList.add('hidden'); openDept(); });
  }

  function addPart(p, was) {
    const row = document.createElement('div');
    row.className = 'sc-row sc-part';
    row.dataset.was = was;
    row.innerHTML =
      '<input class="sc-icon" maxlength="4" value="' + e(p.icon) + '" placeholder="☀" aria-label="סמל" style="' + IN + ';text-align:center">' +
      '<input class="sc-key" maxlength="12" value="' + e(p.key) + '" placeholder="למשל: צהריים" aria-label="שם חלק היום" style="' + IN + '">' +
      '<input class="sc-from" type="time" step="300" value="' + e(p.from) + '" aria-label="מאיזו שעה" style="' + IN + '">' +
      '<input class="sc-start sc-auto" type="time" step="300" value="' + e(p.start) + '" aria-label="שיבוץ אוטומטי: התחלה" style="' + IN + '">' +
      '<input class="sc-end sc-auto" type="time" step="300" value="' + e(p.end) + '" aria-label="שיבוץ אוטומטי: סיום" style="' + IN + '">' +
      '<button type="button" class="btn plain" title="הסרה" aria-label="הסרה" style="padding:6px 0">🗑</button>';
    row.querySelector('button').addEventListener('click', () => row.remove());
    document.getElementById('scParts').appendChild(row);
  }

  function addType(t) {
    const row = document.createElement('div');
    row.className = 'sc-row sc-type';
    row.dataset.depts = JSON.stringify(t.depts || []);   // older settings: a shift for some departments only (kept as is)
    row.innerHTML =
      '<input class="sc-name" maxlength="20" value="' + e(t.name) + '" placeholder="שם המשמרת" aria-label="שם המשמרת" style="' + IN + '">' +
      '<input class="sc-start" type="time" step="300" value="' + e(t.start) + '" aria-label="התחלה" style="' + IN + '">' +
      '<input class="sc-end" type="time" step="300" value="' + e(t.end) + '" aria-label="סיום" style="' + IN + '">' +
      '<button type="button" class="btn plain sc-del" title="הסרה" aria-label="הסרה" style="padding:6px 0">🗑</button>' +
      ((t.depts || []).length ? '<div class="sc-depts">רק ב: ' + e(t.depts.join(', ')) + '</div>' : '');
    row.querySelector('.sc-del').addEventListener('click', () => row.remove());
    document.getElementById('scTypes').appendChild(row);
  }

  /** keepNames: the parts on screen are the saved ones (a rename is sent as "was") */
  function fill(c, keepNames) {
    document.getElementById('scParts').innerHTML = '';
    document.getElementById('scTypes').innerHTML = '';
    const saved = SC.keys();
    c.parts.forEach((p) => addPart(p, keepNames ? p.key : (saved.includes(p.key) ? p.key : '')));
    (c.types || []).forEach(addType);
    document.getElementById('scErr').textContent = '';
  }

  function open() {
    if (!isAdmin()) { say('הגדרת משמרות — אדמין בלבד', 'err'); return; }
    ensureModal();
    fill(SC.cfg(), true);
    document.getElementById('scOverlay').classList.remove('hidden');
  }

  async function save() {
    const err = document.getElementById('scErr');
    const parts = [...document.querySelectorAll('#scParts .sc-part')].map((r) => ({
      key: r.querySelector('.sc-key').value.trim(), icon: r.querySelector('.sc-icon').value.trim(),
      from: r.querySelector('.sc-from').value, start: r.querySelector('.sc-start').value, end: r.querySelector('.sc-end').value,
      was: r.dataset.was || '',
    }));
    const types = [...document.querySelectorAll('#scTypes .sc-type')].map((r) => ({
      name: r.querySelector('.sc-name').value.trim(), start: r.querySelector('.sc-start').value, end: r.querySelector('.sc-end').value,
      depts: JSON.parse(r.dataset.depts || '[]'),
    })).filter((t) => t.name || t.start || t.end);
    if (!parts.length) { err.textContent = 'צריך לפחות חלק יום אחד'; return; }
    if (parts.some((p) => !p.key || !p.from || !p.start || !p.end)) { err.textContent = 'בכל חלק יום: שם, מ-שעה, ושעות השיבוץ'; return; }
    // what happens to the data of a renamed / removed part — said before saving
    const saved = SC.keys(), notes = [];
    parts.forEach((p) => { if (p.was && p.was !== p.key) notes.push('• "' + p.was + '" ← "' + p.key + '": התקן, החופש הקבוע של העובדים והאילוצים מהיום עוברים לשם החדש.'); });
    saved.filter((k) => !parts.some((p) => (p.was || p.key) === k)).forEach((k) =>
      notes.push('• "' + k + '" מוסר: התקן שלו והחופש הקבוע של העובדים בו נמחקים. אילוצים שכבר הוגשו נשארים כפי שהם.'));
    if (notes.length && !confirm('שינוי בחלקי היום:\n' + notes.join('\n') + '\n\nלהמשיך?')) return;
    const btn = document.getElementById('scSave');
    btn.disabled = true; err.textContent = 'שומר…';
    try {
      const r = await apiPost({ action: 'saveShiftConfig', ...mgrAuth(), config: { parts, types } });
      if (!r.ok) { err.textContent = r.error || 'שגיאה'; return; }
      appState().shiftConfig = r.shiftConfig;
      document.getElementById('scOverlay').classList.add('hidden');
      say('הגדרת המשמרות נשמרה', 'ok');
      if (typeof load === 'function') load();   // the board, the standard and the employees' fixed days — by the new parts
    } catch (ex) { err.textContent = 'שגיאה: ' + ex.message; }
    finally { btn.disabled = false; }
  }
  window.openShiftConfig = open;

  /* ---------- 🗂 shifts per department and day of the week ---------- */
  const NAMES = ['בוקר', 'אמצע', 'ערב', 'לילה', 'אחר'];
  const dayName = (i) => (typeof DAY_NAMES !== 'undefined' ? DAY_NAMES[i] : 'אבגדהוש'[i]);
  const branchNow = () => (typeof effectiveBranch === 'function' ? effectiveBranch() : '') || '';
  let deptDirty = false;

  function ensureDeptModal() {
    if (document.getElementById('sdOverlay')) return;
    document.head.insertAdjacentHTML('beforeend', '<style>' +
      '#sdOverlay .sd-day{border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:8px;margin-bottom:8px}' +
      '#sdOverlay .sd-dh{display:flex;align-items:center;gap:8px;font-weight:800;font-size:13px;margin-bottom:6px}' +
      '#sdOverlay .sd-dh .sp{flex:1}' +
      '#sdOverlay .sd-row{display:grid;grid-template-columns:1fr 112px 112px 104px 66px 34px;gap:5px;align-items:center;margin-bottom:5px}' +
      '#sdOverlay .sd-row label{font-size:11.5px;display:flex;align-items:center;gap:3px;white-space:nowrap}' +
      '#sdOverlay .sd-none{font-size:12px;color:var(--muted,#64748b);margin-bottom:4px}' +
      '#sdOverlay .sd-tools{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}' +
      '#sdOverlay .sd-tools .btn{font-size:12px;padding:5px 10px}' +
      '@media (max-width:560px){#sdOverlay .sd-row{grid-template-columns:1fr 1fr 1fr;}}' +
      '</style>');
    document.body.insertAdjacentHTML('beforeend',
      '<div class="overlay hidden" id="sdOverlay"><div class="modal wide" style="max-width:780px">' +
      '<header><h3>🗂 משמרות לפי מחלקה</h3><p id="sdSub">המשמרות של כל מחלקה בכל יום בשבוע — בוקר, אמצע, ערב, לילה או כל שם אחר</p></header>' +
      '<div class="mbody">' +
      '<div class="mrow"><label>מחלקה</label><select id="sdDept"></select></div>' +
      '<p class="sc-note" style="font-size:12px;color:var(--muted,#64748b);line-height:1.5;margin:4px 0">' +
      'מגדירים רק מה שיש: מחלקה של בוקר בלבד, של לילה בלבד, או משולבת. השיבוץ האוטומטי משבץ רק בחלקי היום שיש בהם משמרת באותו יום; ' +
      'ביום בלי משמרות — לא משבץ. <b>נחשבת כ-</b>: חלק היום שהמשמרת נספרת בו (תקן העובדים, אילוצים, אי-זמינות). ' +
      '<b>לשיבוץ</b>: כשיש כמה משמרות באותו חלק יום — זו שהשיבוץ האוטומטי נותן (בלי סימון — הראשונה). ' +
      'מחלקה בלי משמרות כאן — משתמשת במשמרות הכלליות ובשעות חלקי היום מ"🕒 הגדרת משמרות".</p>' +
      '<div class="sd-tools"><button type="button" class="btn plain" id="sdCopyWeek">העתק את יום א׳ לימים ב׳–ה׳</button>' +
      '<button type="button" class="btn plain" id="sdCopyAll">העתק את יום א׳ לכל השבוע</button>' +
      '<button type="button" class="btn plain" id="sdClear">ניקוי כל השבוע</button></div>' +
      '<div id="sdDays"></div>' +
      '<datalist id="sdNames"></datalist>' +
      '</div>' +
      '<div class="merr" id="sdErr" style="padding:0 18px"></div>' +
      '<div class="mfoot"><button class="btn primary" id="sdSave">שמירה</button><span class="spacer"></span>' +
      '<button class="btn plain" id="sdClose">סגירה</button></div></div></div>');
    const ov = document.getElementById('sdOverlay');
    document.getElementById('sdClose').addEventListener('click', () => {
      if (deptDirty && !confirm('יש שינויים שלא נשמרו. לסגור בלי לשמור?')) return;
      ov.classList.add('hidden');
    });
    let shown = '';
    document.getElementById('sdDept').addEventListener('focus', (ev) => { shown = ev.target.value; });
    document.getElementById('sdDept').addEventListener('change', (ev) => {
      if (deptDirty && !confirm('יש שינויים שלא נשמרו במחלקה הקודמת. לעבור בלי לשמור?')) { ev.target.value = shown; return; }
      shown = ev.target.value; drawDept();
    });
    document.getElementById('sdDays').addEventListener('input', () => { deptDirty = true; });
    document.getElementById('sdCopyWeek').addEventListener('click', () => copyDay0([1, 2, 3, 4]));
    document.getElementById('sdCopyAll').addEventListener('click', () => copyDay0([1, 2, 3, 4, 5, 6]));
    document.getElementById('sdClear').addEventListener('click', () => {
      if (!confirm('למחוק את כל המשמרות של המחלקה מהמסך? (נשמר רק בלחיצה על "שמירה")')) return;
      document.querySelectorAll('#sdDays .sd-list').forEach((l) => { l.innerHTML = ''; });
      document.querySelectorAll('#sdDays .sd-day').forEach(markEmpty);
      deptDirty = true;
    });
    document.getElementById('sdSave').addEventListener('click', saveDept);
  }

  function partOptions(sel) {
    return SC.parts().map((p) => '<option value="' + e(p.key) + '"' + (p.key === sel ? ' selected' : '') + '>' + e((p.icon ? p.icon + ' ' : '') + p.key) + '</option>').join('');
  }
  function markEmpty(day) {
    const none = day.querySelector('.sd-none');
    none.style.display = day.querySelectorAll('.sd-row').length ? 'none' : '';
  }
  function addRow(dow, t) {
    const day = document.querySelector('#sdDays .sd-day[data-dow="' + dow + '"]');
    const row = document.createElement('div');
    row.className = 'sd-row';
    const part = t.part && SC.has(t.part) ? t.part : (t.start ? SC.partOf(t.start) : SC.keys()[0]);
    row.innerHTML =
      '<input class="sd-name" list="sdNames" maxlength="20" value="' + e(t.name) + '" placeholder="שם (בוקר / אמצע / ערב / אחר…)" aria-label="שם המשמרת" style="' + IN + '">' +
      '<input class="sd-start" type="time" step="300" value="' + e(t.start) + '" aria-label="התחלה" style="' + IN + '">' +
      '<input class="sd-end" type="time" step="300" value="' + e(t.end) + '" aria-label="סיום" style="' + IN + '">' +
      '<select class="sd-part" aria-label="נחשבת כ" title="נחשבת כ-: חלק היום של המשמרת" style="' + IN + '">' + partOptions(part) + '</select>' +
      '<label title="כשיש כמה משמרות באותו חלק יום — זו שהשיבוץ האוטומטי נותן"><input type="checkbox" class="sd-auto"' + (t.auto ? ' checked' : '') + '>לשיבוץ</label>' +
      '<button type="button" class="btn plain" title="הסרה" aria-label="הסרה" style="padding:5px 0">🗑</button>';
    // the part follows the start hour until it is picked by hand
    let partByHand = !!t.part;
    row.querySelector('.sd-part').addEventListener('change', () => { partByHand = true; });
    row.querySelector('.sd-start').addEventListener('change', (ev) => { if (!partByHand && ev.target.value) row.querySelector('.sd-part').value = SC.partOf(ev.target.value); });
    // one "for auto-assign" per day and part
    row.querySelector('.sd-auto').addEventListener('change', (ev) => {
      if (!ev.target.checked) return;
      const p = row.querySelector('.sd-part').value;
      day.querySelectorAll('.sd-row').forEach((r) => { if (r !== row && r.querySelector('.sd-part').value === p) r.querySelector('.sd-auto').checked = false; });
    });
    row.querySelector('button').addEventListener('click', () => { row.remove(); markEmpty(day); deptDirty = true; });
    day.querySelector('.sd-list').appendChild(row);
    markEmpty(day);
    return row;
  }
  function rowsOf(dow) {
    return [...document.querySelectorAll('#sdDays .sd-day[data-dow="' + dow + '"] .sd-row')].map((r) => ({
      dow, name: r.querySelector('.sd-name').value.trim(), start: r.querySelector('.sd-start').value, end: r.querySelector('.sd-end').value,
      part: r.querySelector('.sd-part').value, auto: r.querySelector('.sd-auto').checked,
    }));
  }
  function copyDay0(days) {
    const src = rowsOf(0);
    if (!src.length) { say('אין משמרות ביום א׳ להעתקה', 'err'); return; }
    days.forEach((d) => {
      const day = document.querySelector('#sdDays .sd-day[data-dow="' + d + '"]');
      day.querySelector('.sd-list').innerHTML = '';
      src.forEach((t) => addRow(d, { ...t, dow: d }));
      markEmpty(day);
    });
    deptDirty = true;
  }
  function drawDept() {
    const dept = document.getElementById('sdDept').value, branch = branchNow();
    document.getElementById('sdNames').innerHTML = [...new Set([...SC.keys(), ...NAMES])].map((n) => '<option value="' + e(n) + '">').join('');
    const mine = ((appState() && appState().shiftTemplates) || []).filter((t) => t.dept === dept && (!t.branch || t.branch === branch));
    document.getElementById('sdDays').innerHTML = [0, 1, 2, 3, 4, 5, 6].map((d) =>
      '<div class="sd-day" data-dow="' + d + '"><div class="sd-dh">יום ' + e(dayName(d)) + '<span class="sp"></span>' +
      '<button type="button" class="btn plain sd-add" style="font-size:12px;padding:4px 10px">+ משמרת</button></div>' +
      '<div class="sd-none">אין משמרות ביום הזה</div><div class="sd-list"></div></div>').join('');
    document.querySelectorAll('#sdDays .sd-day').forEach((day) => {
      const d = Number(day.dataset.dow);
      day.querySelector('.sd-add').addEventListener('click', () => { addRow(d, { name: '', start: '', end: '', part: '', auto: false }).querySelector('.sd-name').focus(); deptDirty = true; });
    });
    mine.forEach((t) => addRow(t.dow, t));
    document.querySelectorAll('#sdDays .sd-day').forEach(markEmpty);
    document.getElementById('sdErr').textContent = '';
    deptDirty = false;
  }

  function openDept() {
    if (!isAdmin()) { say('משמרות לפי מחלקה — אדמין בלבד', 'err'); return; }
    const branch = branchNow(), deps = (appState() && appState().departments) || [];
    if (!branch || !deps.length) { say('בחרו סניף בראש המסך — המשמרות מוגדרות לכל מחלקה בסניף', 'err'); return; }
    ensureDeptModal();
    const sel = document.getElementById('sdDept'), keep = sel.value;
    sel.innerHTML = deps.map((d) => '<option value="' + e(d) + '">' + e(d) + (SC.hasTpl(d) ? ' ✓' : '') + '</option>').join('');
    if (deps.includes(keep)) sel.value = keep;
    document.getElementById('sdSub').textContent = 'סניף ' + branch + ' · המשמרות של כל מחלקה בכל יום בשבוע — בוקר, אמצע, ערב, לילה או כל שם אחר';
    drawDept();
    document.getElementById('sdOverlay').classList.remove('hidden');
  }

  async function saveDept() {
    const err = document.getElementById('sdErr');
    const rows = [0, 1, 2, 3, 4, 5, 6].flatMap(rowsOf).filter((r) => r.name || r.start || r.end);
    const bad = rows.find((r) => !r.name || !r.start || !r.end);
    if (bad) { err.textContent = 'ביום ' + dayName(bad.dow) + ': לכל משמרת צריך שם, התחלה וסיום'; return; }
    const dept = document.getElementById('sdDept').value;
    const btn = document.getElementById('sdSave');
    btn.disabled = true; err.textContent = 'שומר…';
    try {
      const r = await apiPost({ action: 'saveShiftTemplates', ...mgrAuth(), branch: branchNow(), department: dept, rows });
      if (!r.ok) { err.textContent = r.error || 'שגיאה'; return; }
      appState().shiftTemplates = r.shiftTemplates || [];
      err.textContent = '';
      deptDirty = false;
      const opt = [...document.getElementById('sdDept').options].find((o) => o.value === dept);
      if (opt) opt.textContent = dept + (rows.length ? ' ✓' : '');
      say('המשמרות של ' + dept + ' נשמרו', 'ok');
      if (typeof render === 'function') render();
    } catch (ex) { err.textContent = 'שגיאה: ' + ex.message; }
    finally { btn.disabled = false; }
  }
  window.openDeptShifts = openDept;

  function start() {
    const drop = document.getElementById('menuSchedDrop');
    if (drop && !document.getElementById('scMenuBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="scMenuBtn">🕒 הגדרת משמרות</button><button id="sdMenuBtn">🗂 משמרות לפי מחלקה</button>');
      document.getElementById('scMenuBtn').addEventListener('click', open);
      document.getElementById('sdMenuBtn').addEventListener('click', openDept);
      // admins only: the menu is shown to every manager
      document.getElementById('menuSchedBtn')?.addEventListener('click', () => {
        ['scMenuBtn', 'sdMenuBtn'].forEach((id) => { document.getElementById(id).style.display = isAdmin() ? '' : 'none'; });
      }, true);
    }
    const legend = document.getElementById('aaLegend');
    if (legend && !document.getElementById('scAaLink')) {
      legend.insertAdjacentHTML('afterend', '<button type="button" class="btn plain" id="scAaLink" style="margin:-2px 0 8px;font-size:12px;padding:4px 10px">🕒 חלקי היום והשעות — הגדרת משמרות</button>');
      document.getElementById('scAaLink').addEventListener('click', () => {
        if (!isAdmin()) { say('הגדרת משמרות — אדמין בלבד', 'err'); return; }
        document.getElementById('aaOverlay')?.classList.add('hidden');
        open();
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
