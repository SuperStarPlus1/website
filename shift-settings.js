// The shift settings window (admin; same file in Superstar and Sidurit) — "🕒 הגדרת משמרות" in the schedule menu and
// in the auto-assign window:
//   parts of the day  name, icon, from what hour a shift belongs to it, and the hours auto-assign gives it (up to 4)
//   ready-made shifts name + hours, for every department or only some — the buttons of the shift window
// Saved with saveShiftConfig (api/scheduling.ts); a renamed part takes its standard, fixed days off and coming
// constraints along. Uses the app's globals: apiPost, mgrAuth, state, toast, load. SC: shift-config.js.
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
      '#scOverlay .sc-dep{border:1.5px solid var(--line,#e5e7eb);background:#f8fafc;border-radius:99px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}' +
      '#scOverlay .sc-dep.on{background:var(--brand,#2563eb);border-color:var(--brand,#2563eb);color:#fff}' +
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
      '<p class="sc-note">הכפתורים בחלון המשמרת. בלי מחלקה מסומנת — לכל המחלקות; עם מחלקות — רק בהן.</p>' +
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

  function deptList(extra) {
    const s = appState();
    return [...new Set([...((s && s.departments) || []), ...(extra || [])])];
  }
  function addType(t) {
    const row = document.createElement('div');
    row.className = 'sc-row sc-type';
    const on = new Set(t.depts || []);
    row.innerHTML =
      '<input class="sc-name" maxlength="20" value="' + e(t.name) + '" placeholder="שם המשמרת" aria-label="שם המשמרת" style="' + IN + '">' +
      '<input class="sc-start" type="time" step="300" value="' + e(t.start) + '" aria-label="התחלה" style="' + IN + '">' +
      '<input class="sc-end" type="time" step="300" value="' + e(t.end) + '" aria-label="סיום" style="' + IN + '">' +
      '<button type="button" class="btn plain sc-del" title="הסרה" aria-label="הסרה" style="padding:6px 0">🗑</button>' +
      '<div class="sc-depts"><span>מחלקות:</span>' + deptList(t.depts).map((d) =>
        '<button type="button" class="sc-dep' + (on.has(d) ? ' on' : '') + '" data-d="' + e(d) + '">' + e(d) + '</button>').join('') +
      (deptList(t.depts).length ? '' : '<span style="color:var(--muted,#64748b)">(בחרו סניף כדי לסמן מחלקות)</span>') + '</div>';
    row.querySelector('.sc-del').addEventListener('click', () => row.remove());
    row.querySelectorAll('.sc-dep').forEach((b) => b.addEventListener('click', () => b.classList.toggle('on')));
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
      depts: [...r.querySelectorAll('.sc-dep.on')].map((b) => b.dataset.d),
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

  function start() {
    const drop = document.getElementById('menuSchedDrop');
    if (drop && !document.getElementById('scMenuBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="scMenuBtn">🕒 הגדרת משמרות</button>');
      document.getElementById('scMenuBtn').addEventListener('click', open);
      // admins only: the menu is shown to every manager
      document.getElementById('menuSchedBtn')?.addEventListener('click', () => {
        document.getElementById('scMenuBtn').style.display = isAdmin() ? '' : 'none';
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
