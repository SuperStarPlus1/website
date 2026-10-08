// Tasks — screens (same file in the Sidurit template web/app/ and on the Superstar site; server: _shared/tasks-handlers.ts,
// rules: _shared/tasks-core.ts):
//   employee  "📋 המשימות שלי" on the home screen (with a count): today's tasks; a task opens its form — checks, yes / no,
//             readings (temperatures…), text, a list, photos (taken with the camera, made smaller, uploaded one by one)
//   manager   "📋 משימות" (menu): ✔ ביצוע — what came, what was done / missed, day by day, and each report with photos
//             (📄 PDF — the report with all its photos, as the managers got it by mail);
//             📋 משימות — who, when (once / daily / days of the week / day of the month, until an hour), which form;
//             🧾 טפסים — the form builder
// Uses the app's own globals: apiPost, mgrAuth, state, toast, effectiveBranch, openBlobPdf.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const empAuth = () => { const s = appState(); return s && s.emp ? { username: s.emp.username, password: s.emp.pw } : {}; };
  const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const TYPES = [['check', '☑ סימון ביצוע'], ['yesno', '✔/✘ כן / לא'], ['number', '🔢 מספר / קריאות (טמפרטורה…)'], ['text', '✍ טקסט'], ['select', '☰ בחירה מרשימה'], ['photo', '📷 צילום']];
  const dmy = (d) => (d || '').slice(8, 10) + '/' + (d || '').slice(5, 7);
  const hm = (iso) => (iso ? new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '');
  const todayIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.tk-card{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:center;justify-content:space-between;cursor:pointer;background:#fff}' +
    '.tk-card:hover{background:#f8fafc}.tk-card .t{font-weight:800}.tk-meta{font-size:12px;color:#6b7280}' +
    '.tk-chip{border-radius:99px;padding:2px 10px;font-size:12px;font-weight:700;white-space:nowrap}' +
    '.tk-chip.done{background:#dcfce7;color:#166534}.tk-chip.open{background:#e0e7ff;color:#3730a3}.tk-chip.late,.tk-chip.missed{background:#fee2e2;color:#991b1b}' +
    '.tk-badge{background:#dc2626;color:#fff;border-radius:99px;font-size:11px;font-weight:800;padding:0 6px;margin-inline-start:4px}' +
    '.tk-f{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;margin-bottom:8px;display:grid;gap:7px}' +
    '.tk-f.bad{border-color:#fca5a5;background:#fff7f7}.tk-f .lbl{font-weight:700}.tk-f .lbl small{font-weight:400;color:#6b7280}' +
    '.tk-f input[type=number],.tk-f input[type=text],.tk-f textarea,.tk-f select,.tk-in{border:1.5px solid #d1d5db;border-radius:8px;padding:8px 10px;font:inherit;font-size:16px;min-width:0}' +
    '.tk-f input.out{border-color:#dc2626;background:#fef2f2}' +
    '.tk-reads{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px}.tk-reads label{font-size:11.5px;color:#6b7280;display:grid;gap:2px}' +
    '.tk-check{display:flex;align-items:center;gap:10px;font-weight:700;cursor:pointer}.tk-check input{width:24px;height:24px;accent-color:#16a34a;flex:none}' +
    '.tk-yn{display:flex;gap:8px}.tk-yn button{flex:1;border:1.5px solid #d1d5db;background:#fff;border-radius:10px;padding:9px;font:inherit;font-weight:800;cursor:pointer}' +
    '.tk-yn button.on.y{background:#dcfce7;border-color:#16a34a}.tk-yn button.on.n{background:#fee2e2;border-color:#dc2626}' +
    '.tk-pics{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.tk-pics .p{position:relative}.tk-pics img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #d1d5db}' +
    '.tk-pics .p button{position:absolute;top:-6px;inset-inline-end:-6px;border:0;border-radius:99px;background:#111827;color:#fff;width:20px;height:20px;font-size:11px;cursor:pointer}' +
    '.tk-pics .up{opacity:.4}.tk-cam{border:1.5px dashed #94a3b8;background:#f8fafc;border-radius:8px;padding:8px 12px;font:inherit;font-weight:700;cursor:pointer}' +
    '.tk-tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}.tk-tabs button{border:1.5px solid #d1d5db;background:#fff;border-radius:99px;padding:6px 14px;font:inherit;font-weight:700;cursor:pointer}' +
    '.tk-tabs button.on{background:#1b2a4a;color:#fff;border-color:#1b2a4a}' +
    '.tk-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}' +
    '.tk-table{width:100%;border-collapse:collapse;font-size:13px}.tk-table th{background:#f8fafc;font-size:11.5px;color:#6b7280;text-align:right;padding:6px}' +
    '.tk-table td{border-top:1px solid #e5e7eb;padding:6px;vertical-align:middle}.tk-table tr.click{cursor:pointer}.tk-table tr.click:hover td{background:#f8fafc}' +
    '.tk-grid{display:grid;gap:8px}.tk-grid label{display:grid;gap:3px;font-weight:700;font-size:13px}' +
    '.tk-chips{display:flex;flex-wrap:wrap;gap:5px}.tk-chips button{border:1.5px solid #d1d5db;background:#fff;border-radius:99px;padding:4px 11px;font:inherit;font-size:13px;cursor:pointer}' +
    '.tk-chips button.on{background:#1b2a4a;color:#fff;border-color:#1b2a4a}' +
    '.tk-row{border:1px solid #e5e7eb;border-radius:10px;padding:8px;display:grid;gap:6px;margin-bottom:6px;background:#fff}' +
    '.tk-row .hd{display:grid;grid-template-columns:1fr 170px auto;gap:6px;align-items:center}' +
    '.tk-row .ex{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px}.tk-row .ex input{width:90px}' +
    '.tk-btn{border:0;border-radius:9px;padding:8px 14px;font:inherit;font-weight:800;cursor:pointer;background:#1b2a4a;color:#fff}' +
    '.tk-btn.light{background:#f1f5f9;color:#1f2937}.tk-btn.red{background:#fee2e2;color:#991b1b}' +
    '.tk-flags{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;color:#991b1b;font-size:13px}' +
    '@media (max-width:560px){.tk-row .hd{grid-template-columns:1fr}}' +
    '</style>');

  function overlay(id, title, wide) {
    if (!$(id)) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="' + id + '"><div class="modal" style="max-width:' + (wide ? 960 : 640) + 'px">' +
        '<header><h3 id="' + id + 'Title"></h3><p id="' + id + 'Sub"></p></header><div class="mbody" id="' + id + 'Body"></div>' +
        '<div class="mfoot" id="' + id + 'Foot"><span class="spacer"></span><button class="btn plain" data-close>סגירה</button></div></div></div>');
      $(id).querySelector('[data-close]').addEventListener('click', () => $(id).classList.add('hidden'));
    }
    $(id + 'Title').textContent = title;
    $(id + 'Sub').textContent = '';
    $(id).classList.remove('hidden');
    return $(id + 'Body');
  }
  const chip = (st) => st === 'done' ? '<span class="tk-chip done">✅ בוצעה</span>' : st === 'late' ? '<span class="tk-chip late">⏰ באיחור</span>'
    : st === 'missed' ? '<span class="tk-chip missed">❌ לא בוצעה</span>' : '<span class="tk-chip open">⏳ פתוחה</span>';

  /* ================= employee ================= */
  let mine = [];
  async function fetchMine() {
    const s = appState();
    if (!s || !s.emp) return;
    try { const r = await apiPost({ action: 'myTasks', ...empAuth() }); if (r && r.ok) mine = r.tasks || []; } catch (_) { /* offline */ }
    const b = $('ehTasks');
    const open = mine.filter((t) => t.status !== 'done').length;
    if (b) {
      b.style.display = mine.length ? '' : 'none';
      b.innerHTML = '<span class="ic">📋</span>המשימות שלי' + (open ? '<span class="tk-badge">' + open + '</span>' : '');
    }
  }
  async function openMine() {
    const body = overlay('tkMine', '📋 המשימות שלי');
    body.innerHTML = '<p class="tk-meta">טוען…</p>';
    await fetchMine();
    $('tkMineSub').textContent = 'היום · ' + new Date().toLocaleDateString('he-IL');
    body.innerHTML = mine.length ? mine.map((t, i) =>
      '<div class="tk-card" data-i="' + i + '"><div><div class="t">' + e(t.title) + '</div><div class="tk-meta">' + e(t.when) +
      (t.date !== todayIso() ? ' · מ-' + dmy(t.date) : '') + (t.status === 'done' ? ' · ' + e(t.doneBy) + ' ' + hm(t.doneAt) : '') + '</div></div>' + chip(t.status) + '</div>').join('')
      : '<p class="tk-meta">אין לך משימות היום 🙂</p>';
    body.querySelectorAll('.tk-card').forEach((c) => c.addEventListener('click', () => {
      const t = mine[Number(c.dataset.i)];
      if (t.status === 'done') { say('המשימה כבר בוצעה' + (t.doneBy ? ' ע"י ' + t.doneBy : ''), 'ok'); return; }
      openFill(t);
    }));
  }

  /** a photo from the camera: at most 1280 px, JPEG — then uploaded on its own */
  function shrink(file) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('התמונה לא נטענה')); };
      img.src = url;
    });
  }

  function openFill(t) {
    const body = overlay('tkFill', '📋 ' + t.title);
    $('tkFillSub').textContent = t.when + (t.status === 'late' ? ' · עבר מועד היעד — עדיין אפשר למלא' : '');
    const stamp = (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
    const fields = (t.form && t.form.fields) || [];
    const ans = {}; fields.forEach((f) => { ans[f.id] = { photos: [] }; });
    const pending = new Set();
    const range = (f) => (f.min != null || f.max != null) ? ' <small>(' + (f.min != null ? f.min : '…') + '–' + (f.max != null ? f.max : '…') + (f.unit || '') + ')</small>' : '';
    body.innerHTML = (t.description ? '<p style="white-space:pre-wrap;background:#f8fafc;border-radius:10px;padding:8px 12px">' + e(t.description) + '</p>' : '') +
      (fields.length ? '<p class="tk-meta" id="tkProg"></p>' : '') +
      fields.map((f) => {
        let ctl = '';
        if (f.type === 'check') ctl = '<label class="tk-check"><input type="checkbox" data-f="' + e(f.id) + '" data-k="done"><span>' + e(f.label) + '</span></label>';
        else {
          ctl = '<div class="lbl">' + e(f.label) + (f.required ? ' <small>*</small>' : '') + (f.type === 'number' ? range(f) : '') + '</div>';
          if (f.type === 'yesno') ctl += '<div class="tk-yn" data-f="' + e(f.id) + '"><button type="button" class="y" data-v="1">כן</button><button type="button" class="n" data-v="0">לא</button></div>';
          if (f.type === 'number') ctl += '<div class="tk-reads">' + Array.from({ length: f.readings || 1 }, (_, i) =>
            '<label>' + e((f.readingLabels && f.readingLabels[i]) || ((f.readings || 1) > 1 ? '#' + (i + 1) : '')) +
            '<input type="number" inputmode="decimal" step="any" data-f="' + e(f.id) + '" data-r="' + i + '" placeholder="' + e(f.unit || '') + '"></label>').join('') + '</div>';
          if (f.type === 'text') ctl += '<textarea rows="2" data-f="' + e(f.id) + '"></textarea>';
          if (f.type === 'select') ctl += '<select data-f="' + e(f.id) + '"><option value="">— בחירה —</option>' + (f.options || []).map((o) => '<option>' + e(o) + '</option>').join('') + '</select>';
        }
        const cam = f.photo !== 'none' || f.type === 'photo';
        return '<div class="tk-f" data-box="' + e(f.id) + '">' + ctl + (cam ? '<div class="tk-pics" data-pics="' + e(f.id) + '"><button type="button" class="tk-cam" data-cam="' + e(f.id) + '">📷 צילום' +
          (f.photo === 'required' || f.type === 'photo' ? ' (חובה)' : '') + '</button></div>' : '') + '</div>';
      }).join('') +
      '<div class="tk-f"><div class="lbl">הערה <small>(לא חובה)</small></div><textarea rows="2" id="tkNote"></textarea></div>' +
      '<div class="merr" id="tkErr"></div><button class="tk-btn" id="tkSend" style="width:100%;padding:12px">✓ שליחה</button>';
    const prog = () => {
      const p = $('tkProg'); if (!p) return;
      const done = fields.filter((f) => f.type === 'check' ? ans[f.id].done : f.type === 'number' ? (ans[f.id].values || []).filter((v) => v !== null && v !== '').length >= (f.readings || 1)
        : f.type === 'photo' ? ans[f.id].photos.length : f.type === 'yesno' ? ans[f.id].value !== undefined : !!ans[f.id].value).length;
      p.textContent = 'הושלמו ' + done + ' מתוך ' + fields.length;
    };
    body.querySelectorAll('input[type=checkbox][data-f]').forEach((c) => c.addEventListener('change', () => { ans[c.dataset.f].done = c.checked; prog(); }));
    body.querySelectorAll('.tk-yn').forEach((g) => g.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      ans[g.dataset.f].value = b.dataset.v === '1'; prog();
    })));
    body.querySelectorAll('input[type=number][data-f]').forEach((inp) => inp.addEventListener('input', () => {
      const f = fields.find((x) => x.id === inp.dataset.f), a = ans[f.id];
      a.values = a.values || Array(f.readings || 1).fill(null);
      const v = inp.value === '' ? null : Number(inp.value);
      a.values[Number(inp.dataset.r)] = v;
      inp.classList.toggle('out', v !== null && ((f.min != null && v < f.min) || (f.max != null && v > f.max)));
      prog();
    }));
    body.querySelectorAll('textarea[data-f],select[data-f]').forEach((c) => c.addEventListener('input', () => { ans[c.dataset.f].value = c.value; prog(); }));
    body.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => {
      const fid = b.dataset.cam, inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
      inp.onchange = async () => {
        const file = inp.files && inp.files[0];
        if (!file) return;
        const name = fid + '_' + Date.now().toString(36) + '.jpg';
        const wrap = document.createElement('span'); wrap.className = 'p up';
        b.before(wrap);
        pending.add(name);
        try {
          const data = await shrink(file);
          wrap.innerHTML = '<img src="' + data + '" alt="">';
          let ok = false, err = null;
          for (let i = 1; i <= 3 && !ok; i++) {   // mobile networks drop a request now and then
            try {
              const r = await apiPost({ action: 'uploadTaskPhoto', ...empAuth(), stamp, fileName: name, fileData: data.split(',')[1] });
              if (!r.ok) throw new Error(r.error || 'ההעלאה נכשלה');
              ok = true;
            } catch (x) { err = x; if (i < 3) await new Promise((r) => setTimeout(r, 1000 * i)); }
          }
          if (!ok) throw err;
          ans[fid].photos.push(name);
          wrap.classList.remove('up');
          wrap.insertAdjacentHTML('beforeend', '<button type="button" title="הסרה">✕</button>');
          wrap.querySelector('button').addEventListener('click', () => { ans[fid].photos = ans[fid].photos.filter((p) => p !== name); wrap.remove(); prog(); });
          const f = fields.find((x) => x.id === fid);
          if (f.type === 'check' && !ans[fid].done) { ans[fid].done = true; const c = body.querySelector('input[type=checkbox][data-f="' + fid + '"]'); if (c) c.checked = true; }
          prog();
        } catch (x) {
          wrap.remove();
          say('שגיאה בהעלאת התמונה — ' + x.message + ' — נסה/י לצלם שוב', 'err');
        } finally { pending.delete(name); }
      };
      inp.click();
    }));
    prog();
    $('tkSend').addEventListener('click', async () => {
      const err = $('tkErr');
      if (pending.size) { err.textContent = 'רגע — תמונות עדיין עולות…'; return; }
      const missing = fields.filter((f) => {
        const a = ans[f.id];
        if ((f.photo === 'required' || f.type === 'photo') && !a.photos.length) return true;
        if (f.type === 'check' || !f.required) return false;
        if (f.type === 'number') return (a.values || []).filter((v) => v !== null).length < (f.readings || 1);
        if (f.type === 'yesno') return a.value === undefined;
        return f.type !== 'photo' && !a.value;
      });
      document.querySelectorAll('#tkFillBody .tk-f').forEach((b) => b.classList.toggle('bad', missing.some((f) => f.id === b.dataset.box)));
      if (missing.length) { err.textContent = 'חסר: ' + missing.map((f) => f.label).join(', '); return; }
      const notDone = fields.filter((f) => f.type === 'check' && !ans[f.id].done);
      if (notDone.length && !confirm(notDone.length + ' סעיפים לא סומנו כבוצעו — הם יופיעו בדוח למנהל. לשלוח?')) return;
      const btn = $('tkSend'); btn.disabled = true; err.textContent = 'שולח…';
      try {
        const r = await apiPost({ action: 'submitTask', ...empAuth(), taskId: t.id, date: t.date, stamp, answers: ans, note: $('tkNote').value });
        if (!r.ok) { err.textContent = r.error || 'שגיאה'; return; }
        $('tkFill').classList.add('hidden');
        say('המשימה נשלחה ✓' + (r.flags ? ' · ' + r.flags + ' סעיפים לתשומת לב המנהל' : ''), 'ok');
        await fetchMine();
        if ($('tkMine') && !$('tkMine').classList.contains('hidden')) openMine();
      } catch (x) { err.textContent = 'שגיאה: ' + x.message; }
      finally { btn.disabled = false; }
    });
  }

  /* ================= manager ================= */
  let adm = null, tab = 'runs';
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  async function loadAdmin() {
    const r = await apiPost({ action: 'tasksAdmin', ...mAuth() });
    if (!r.ok) throw new Error(r.error || 'שגיאה');
    adm = r;
  }
  async function openMgr() {
    const body = overlay('tkMgr', '📋 משימות', true);
    body.innerHTML = '<p class="tk-meta">טוען…</p>';
    try { await loadAdmin(); } catch (x) { body.innerHTML = '<p class="merr">' + e(x.message) + '</p>'; return; }
    drawMgr();
  }
  function drawMgr() {
    const body = $('tkMgrBody');
    body.innerHTML = '<div class="tk-tabs"><button data-t="runs">✔ ביצוע</button><button data-t="tasks">📋 משימות</button><button data-t="forms">🧾 טפסים</button></div><div id="tkPane"></div>';
    body.querySelectorAll('.tk-tabs button').forEach((b) => {
      b.classList.toggle('on', b.dataset.t === tab);
      b.addEventListener('click', () => { tab = b.dataset.t; drawMgr(); });
    });
    $('tkMgrSub').textContent = tab === 'runs' ? 'מה היה צריך להתבצע ומה בוצע — לפי יום' : tab === 'tasks' ? 'משימות חוזרות ומזדמנות: למי, מתי ואיזה טופס' : 'צ׳קליסטים וטפסים קבועים למשימות';
    if (tab === 'runs') drawRuns(); else if (tab === 'tasks') drawTasks(); else drawForms();
  }

  /* ---------- ✔ runs ---------- */
  let runsFrom = '', runsTo = '';
  async function drawRuns() {
    const pane = $('tkPane');
    runsFrom = runsFrom || todayIso(); runsTo = runsTo || todayIso();
    pane.innerHTML = '<div class="tk-tools"><label>מ-<input type="date" class="tk-in" id="tkFrom" value="' + runsFrom + '"></label>' +
      '<label>עד <input type="date" class="tk-in" id="tkTo" value="' + runsTo + '"></label><button class="tk-btn light" id="tkToday">היום</button>' +
      '<button class="tk-btn light" id="tkWeek">7 ימים</button></div><div id="tkRuns"><p class="tk-meta">טוען…</p></div>';
    const go = () => { runsFrom = $('tkFrom').value; runsTo = $('tkTo').value; drawRuns(); };
    $('tkFrom').addEventListener('change', go); $('tkTo').addEventListener('change', go);
    $('tkToday').addEventListener('click', () => { runsFrom = runsTo = todayIso(); drawRuns(); });
    $('tkWeek').addEventListener('click', () => { const d = new Date(); d.setDate(d.getDate() - 6); runsFrom = d.toISOString().slice(0, 10); runsTo = todayIso(); drawRuns(); });
    const branch = typeof effectiveBranch === 'function' ? effectiveBranch() : '';
    const r = await apiPost({ action: 'taskRuns', ...mAuth(), from: runsFrom, to: runsTo, branch: branch || undefined });
    const box = $('tkRuns');
    if (!box) return;
    if (!r.ok) { box.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    if (!r.runs.length) { box.innerHTML = '<p class="tk-meta">אין משימות בטווח הזה. מוסיפים משימות בלשונית 📋 משימות.</p>'; return; }
    const cnt = (st) => r.runs.filter((x) => x.status === st).length;
    box.innerHTML = '<p class="tk-meta">✅ ' + cnt('done') + ' בוצעו · ⏳ ' + cnt('open') + ' פתוחות · ❌ ' + cnt('missed') + ' לא בוצעו</p>' +
      '<div style="overflow:auto"><table class="tk-table"><tr><th>תאריך</th><th>משימה</th><th>אחראים</th><th>מצב</th><th>בוצעה ע"י</th><th></th></tr>' +
      r.runs.map((x) => '<tr class="' + (x.runId && x.status === 'done' ? 'click' : '') + '" data-run="' + (x.runId || '') + '"><td>' + dmy(x.date) + '</td><td><b>' + e(x.title) + '</b>' +
        (x.time && x.time !== '23:59' ? ' <span class="tk-meta">עד ' + e(x.time) + '</span>' : '') + '</td><td class="tk-meta">' + e(x.assignees.join(', ')) + '</td><td>' + chip(x.status) +
        (x.late ? ' <span class="tk-chip late">באיחור</span>' : '') + '</td><td>' + e(x.employee) + (x.doneAt ? ' <span class="tk-meta">' + hm(x.doneAt) + '</span>' : '') + '</td><td>' +
        (x.flags ? '<span class="tk-chip missed">⚠ ' + x.flags + '</span>' : '') + (x.runId && x.status === 'done' ? ' <span class="tk-meta">פתיחה ›</span>' : '') + '</td></tr>').join('') + '</table></div>';
    box.querySelectorAll('tr.click').forEach((tr) => tr.addEventListener('click', () => openRun(Number(tr.dataset.run))));
  }
  async function openRun(id) {
    const body = overlay('tkRun', 'דוח משימה');
    body.innerHTML = '<p class="tk-meta">טוען…</p>';
    const r = await apiPost({ action: 'taskRun', ...mAuth(), id });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const run = r.run, fields = (run.form && run.form.fields) || [];
    $('tkRunTitle').textContent = '📋 ' + r.task.title;
    $('tkRunSub').textContent = dmy(run.date) + ' · ' + run.employee + ' · ' + hm(run.doneAt) + (run.late ? ' · באיחור' : '');
    const flagged = new Set((run.flags || []).map((f) => f.field));
    const txt = (f, a) => {
      if (!a) return '—';
      if (f.type === 'check') return a.done ? 'בוצע' : 'לא בוצע';
      if (f.type === 'yesno') return a.value === true ? 'כן' : a.value === false ? 'לא' : '—';
      if (f.type === 'number') return (a.values || []).map((v, i) => ((f.readingLabels && f.readingLabels[i]) ? f.readingLabels[i] + ': ' : '') + (v == null ? '—' : v + (f.unit || ''))).join(' · ');
      if (f.type === 'photo') return '';
      return a.value || '—';
    };
    body.innerHTML = '<div class="tk-tools"><button class="tk-btn light" id="tkRunPdf">📄 PDF עם כל התמונות</button></div>' +
      ((run.flags || []).length ? '<div class="tk-flags"><b>⚠ דורש תשומת לב:</b> ' + run.flags.map((f) => e(f.label) + ': ' + e(f.value)).join(' · ') + '</div>' : '') +
      (run.note ? '<p><b>הערה:</b> ' + e(run.note) + '</p>' : '') +
      fields.map((f) => {
        const a = run.answers[f.id] || {};
        const pics = (a.photos || []).map((p) => r.photos[p] ? '<a href="' + e(r.photos[p]) + '" target="_blank" rel="noopener"><img src="' + e(r.photos[p]) + '" alt=""></a>' : '').join('');
        return '<div class="tk-f' + (flagged.has(f.id) ? ' bad' : '') + '"><div class="lbl">' + e(f.label) + '</div><div style="font-weight:700;color:' + (flagged.has(f.id) ? '#b91c1c' : '#166534') + '">' + e(txt(f, a)) + '</div>' +
          (pics ? '<div class="tk-pics">' + pics + '</div>' : '') + '</div>';
      }).join('');
    $('tkRunPdf').addEventListener('click', async () => {
      const b = $('tkRunPdf'); b.disabled = true; b.textContent = 'מכין PDF…';
      try {
        const x = await apiPost({ action: 'taskRunPdf', ...mAuth(), id });
        if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
        if (typeof openBlobPdf === 'function') openBlobPdf(x.pdf, x.filename, 'application/pdf');
      } catch (err) { say('שגיאה: ' + err.message, 'err'); }
      finally { b.disabled = false; b.textContent = '📄 PDF עם כל התמונות'; }
    });
  }

  /* ---------- 📋 tasks ---------- */
  function drawTasks() {
    const pane = $('tkPane');
    const forms = new Map(adm.forms.map((f) => [f.id, f.name]));
    pane.innerHTML = '<div class="tk-tools"><button class="tk-btn" id="tkNewTask">+ משימה חדשה</button></div>' +
      (adm.tasks.length ? adm.tasks.map((t) => '<div class="tk-card" data-id="' + t.id + '"' + (t.active ? '' : ' style="opacity:.55"') + '><div><div class="t">' + e(t.title) +
        (t.active ? '' : ' <span class="tk-chip missed">לא פעילה</span>') + '</div><div class="tk-meta">' + e(t.when) + ' · ' + (t.assignees.length ? e(t.assignees.join(', ')) : 'אין עובדים') +
        (t.formId ? ' · 🧾 ' + e(forms.get(t.formId) || '') : '') + (adm.branches.length > 1 ? ' · ' + e(t.branch) : '') + '</div></div><span class="tk-meta">עריכה ›</span></div>').join('')
        : '<p class="tk-meta">אין משימות עדיין.</p>');
    $('tkNewTask').addEventListener('click', () => editTask(null));
    pane.querySelectorAll('.tk-card').forEach((c) => c.addEventListener('click', () => editTask(adm.tasks.find((t) => t.id === Number(c.dataset.id)))));
  }
  function editTask(t) {
    const pane = $('tkPane');
    const branch0 = t ? t.branch : ((typeof effectiveBranch === 'function' && effectiveBranch()) || adm.branches[0] || '');
    const s = t ? t.schedule : { freq: 'daily', time: '' };
    let freq = s.freq, days = new Set(s.days || []), picked = new Set(t ? t.assignees : []);
    pane.innerHTML = '<div class="tk-grid">' +
      '<label>שם המשימה<input class="tk-in" id="tkTitle" maxlength="100" value="' + e(t ? t.title : '') + '" placeholder="למשל: סגירת סניף, ניקיון מקרר"></label>' +
      (adm.branches.length > 1 ? '<label>סניף<select class="tk-in" id="tkBranch">' + adm.branches.map((b) => '<option' + (b === branch0 ? ' selected' : '') + '>' + e(b) + '</option>').join('') + '</select></label>' : '') +
      '<label>מתי<div class="tk-chips" id="tkFreq">' + [['once', 'פעם אחת'], ['daily', 'כל יום'], ['weekly', 'ימים בשבוע'], ['monthly', 'פעם בחודש']].map(([k, l]) => '<button type="button" data-k="' + k + '">' + l + '</button>').join('') + '</div></label>' +
      '<div id="tkFreqX"></div>' +
      '<label>עד שעה <span class="tk-meta">(אחריה — "לא בוצעה" והתראה למנהלים; ריק = סוף היום)</span><input type="time" class="tk-in" id="tkTime" value="' + e(s.time && s.time !== '23:59' ? s.time : '') + '" style="max-width:160px"></label>' +
      '<label>עובדים <span class="tk-meta">(המשימה מופיעה אצלם; מי שמבצע ראשון — סוגר אותה)</span><input class="tk-in" id="tkEmpQ" placeholder="חיפוש עובד…"><div class="tk-chips" id="tkEmps" style="max-height:170px;overflow:auto"></div></label>' +
      '<label>טופס<select class="tk-in" id="tkForm"><option value="">— ללא טופס (משימה עם תיאור) —</option>' + adm.forms.map((f) => '<option value="' + f.id + '"' + (t && t.formId === f.id ? ' selected' : '') + '>' + e(f.name) + ' (' + f.fields.length + ' סעיפים)</option>').join('') + '</select></label>' +
      '<label>תיאור / הוראות<textarea class="tk-in" id="tkDesc" rows="3">' + e(t ? t.description : '') + '</textarea></label>' +
      '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="tkActive"' + (!t || t.active ? ' checked' : '') + '> פעילה</label>' +
      '<div class="merr" id="tkTErr"></div><div class="tk-tools"><button class="tk-btn" id="tkTSave">שמירה</button><button class="tk-btn light" id="tkTBack">חזרה</button>' +
      (t ? '<span style="flex:1"></span><button class="tk-btn red" id="tkTDel">מחיקה</button>' : '') + '</div></div>';
    const drawFreq = () => {
      $('tkFreq').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === freq));
      const x = $('tkFreqX');
      if (freq === 'once') x.innerHTML = '<label>תאריך<input type="date" class="tk-in" id="tkDate" value="' + e(s.date || todayIso()) + '" style="max-width:180px"></label>';
      else if (freq === 'weekly') {
        x.innerHTML = '<div class="tk-chips" id="tkDays">' + DAYS.map((d, i) => '<button type="button" data-d="' + i + '" class="' + (days.has(i) ? 'on' : '') + '">' + d + '</button>').join('') + '</div>';
        x.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { const d = Number(b.dataset.d); days.has(d) ? days.delete(d) : days.add(d); b.classList.toggle('on'); }));
      } else if (freq === 'monthly') x.innerHTML = '<label>יום בחודש<input type="number" min="1" max="31" class="tk-in" id="tkMDay" value="' + e(s.monthDay || 1) + '" style="max-width:110px"></label>';
      else x.innerHTML = '';
    };
    $('tkFreq').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { freq = b.dataset.k; drawFreq(); }));
    drawFreq();
    const drawEmps = () => {
      const q = $('tkEmpQ').value.trim(), br = $('tkBranch') ? $('tkBranch').value : branch0;
      const list = adm.employees.filter((x) => (picked.has(x.name) || x.branch === br || adm.branches.length === 1) && (!q || x.name.includes(q)));
      $('tkEmps').innerHTML = list.map((x) => '<button type="button" class="' + (picked.has(x.name) ? 'on' : '') + '" data-n="' + e(x.name) + '">' + e(x.name) + '</button>').join('') || '<span class="tk-meta">אין עובדים</span>';
      $('tkEmps').querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => { const n = b.dataset.n; picked.has(n) ? picked.delete(n) : picked.add(n); b.classList.toggle('on'); }));
    };
    $('tkEmpQ').addEventListener('input', drawEmps);
    if ($('tkBranch')) $('tkBranch').addEventListener('change', drawEmps);
    drawEmps();
    $('tkTBack').addEventListener('click', drawTasks);
    $('tkTSave').addEventListener('click', async () => {
      const schedule = { freq, time: $('tkTime').value || '23:59' };
      if (freq === 'once') schedule.date = $('tkDate').value;
      if (freq === 'weekly') schedule.days = [...days];
      if (freq === 'monthly') schedule.monthDay = Number($('tkMDay').value);
      const task = { id: t ? t.id : 0, title: $('tkTitle').value.trim(), branch: $('tkBranch') ? $('tkBranch').value : branch0, schedule,
        assignees: [...picked], formId: Number($('tkForm').value) || null, description: $('tkDesc').value.trim(), active: $('tkActive').checked };
      $('tkTErr').textContent = 'שומר…';
      const r = await apiPost({ action: 'saveTask', ...mAuth(), task });
      if (!r.ok) { $('tkTErr').textContent = r.error || 'שגיאה'; return; }
      adm.tasks = r.tasks; say('המשימה נשמרה ✓', 'ok'); drawTasks();
    });
    if (t) $('tkTDel').addEventListener('click', async () => {
      if (!confirm('למחוק את המשימה "' + t.title + '"? (משימה שכבר בוצעה — נשארת בהיסטוריה כלא פעילה)')) return;
      const r = await apiPost({ action: 'deleteTask', ...mAuth(), id: t.id });
      if (!r.ok) { $('tkTErr').textContent = r.error || 'שגיאה'; return; }
      await loadAdmin(); drawTasks();
    });
  }

  /* ---------- 🧾 forms (the builder) ---------- */
  function drawForms() {
    const pane = $('tkPane');
    pane.innerHTML = '<div class="tk-tools"><button class="tk-btn" id="tkNewForm">+ טופס חדש</button></div>' +
      (adm.forms.length ? adm.forms.map((f) => '<div class="tk-card" data-id="' + f.id + '"><div><div class="t">🧾 ' + e(f.name) + '</div><div class="tk-meta">' + f.fields.length + ' סעיפים · ' +
        f.fields.filter((x) => x.photo === 'required' || x.type === 'photo').length + ' צילומי חובה</div></div><span class="tk-meta">עריכה ›</span></div>').join('') : '<p class="tk-meta">אין טפסים עדיין.</p>');
    $('tkNewForm').addEventListener('click', () => editForm(null));
    pane.querySelectorAll('.tk-card').forEach((c) => c.addEventListener('click', () => editForm(adm.forms.find((f) => f.id === Number(c.dataset.id)))));
  }
  function editForm(form) {
    const pane = $('tkPane');
    let fields = form ? JSON.parse(JSON.stringify(form.fields)) : [{ id: '', label: '', type: 'check', required: false, photo: 'none' }];
    pane.innerHTML = '<div class="tk-grid"><label>שם הטופס<input class="tk-in" id="tkFName" maxlength="60" value="' + e(form ? form.name : '') + '" placeholder="למשל: סגירת סניף"></label>' +
      '<div id="tkRows"></div><div class="tk-tools"><button class="tk-btn light" id="tkAddRow">+ סעיף</button></div>' +
      '<div class="merr" id="tkFErr"></div><div class="tk-tools"><button class="tk-btn" id="tkFSave">שמירה</button><button class="tk-btn light" id="tkFBack">חזרה</button>' +
      (form ? '<span style="flex:1"></span><button class="tk-btn red" id="tkFDel">מחיקה</button>' : '') + '</div></div>';
    const read = () => {
      pane.querySelectorAll('.tk-row').forEach((row, i) => {
        const f = fields[i], v = (k) => { const el = row.querySelector('[data-k="' + k + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined; };
        f.label = v('label').trim(); f.type = v('type'); f.photo = v('photo') || 'none';
        f.required = f.type === 'check' ? false : v('required') !== false;
        if (f.type === 'number') {
          f.readings = Number(v('readings')) || 1;
          f.readingLabels = String(v('readingLabels') || '').split(',').map((x) => x.trim()).filter(Boolean);
          f.unit = v('unit'); f.min = v('min') === '' ? null : Number(v('min')); f.max = v('max') === '' ? null : Number(v('max'));
        }
        if (f.type === 'select') f.options = String(v('options') || '').split(',').map((x) => x.trim()).filter(Boolean);
      });
    };
    const draw = () => {
      $('tkRows').innerHTML = fields.map((f, i) => '<div class="tk-row"><div class="hd"><input class="tk-in" data-k="label" value="' + e(f.label) + '" placeholder="סעיף ' + (i + 1) + ' — מה צריך לעשות / לבדוק">' +
        '<select class="tk-in" data-k="type">' + TYPES.map(([k, l]) => '<option value="' + k + '"' + (f.type === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
        '<span style="display:flex;gap:4px"><button type="button" class="tk-btn light" data-mv="-1" title="למעלה">↑</button><button type="button" class="tk-btn light" data-mv="1" title="למטה">↓</button>' +
        '<button type="button" class="tk-btn red" data-rm title="הסרה">✕</button></span></div><div class="ex">' +
        (f.type !== 'check' && f.type !== 'photo' ? '<label><input type="checkbox" data-k="required"' + (f.required !== false ? ' checked' : '') + '> חובה</label>' : '') +
        (f.type !== 'photo' ? '<label>צילום <select class="tk-in" data-k="photo"><option value="none"' + (f.photo === 'none' ? ' selected' : '') + '>ללא</option><option value="optional"' + (f.photo === 'optional' ? ' selected' : '') + '>אפשרי</option><option value="required"' + (f.photo === 'required' ? ' selected' : '') + '>חובה</option></select></label>' : '') +
        (f.type === 'number' ? '<label>קריאות <input class="tk-in" type="number" min="1" max="12" data-k="readings" value="' + e(f.readings || 1) + '" style="width:60px"></label>' +
          '<label>שמות <input class="tk-in" data-k="readingLabels" value="' + e((f.readingLabels || []).join(', ')) + '" placeholder="מקרר 1, מקרר 2…" style="width:150px"></label>' +
          '<label>יחידה <input class="tk-in" data-k="unit" value="' + e(f.unit || '') + '" placeholder="°" style="width:50px"></label>' +
          '<label>מינ׳ <input class="tk-in" type="number" step="any" data-k="min" value="' + e(f.min == null ? '' : f.min) + '"></label>' +
          '<label>מקס׳ <input class="tk-in" type="number" step="any" data-k="max" value="' + e(f.max == null ? '' : f.max) + '"></label>' : '') +
        (f.type === 'select' ? '<label>אפשרויות <input class="tk-in" data-k="options" value="' + e((f.options || []).join(', ')) + '" placeholder="תקין, דורש טיפול, …" style="width:260px"></label>' : '') +
        '</div></div>').join('');
      $('tkRows').querySelectorAll('.tk-row').forEach((row, i) => {
        row.querySelector('[data-k="type"]').addEventListener('change', () => { read(); draw(); });
        row.querySelector('[data-rm]').addEventListener('click', () => { read(); fields.splice(i, 1); draw(); });
        row.querySelectorAll('[data-mv]').forEach((b) => b.addEventListener('click', () => {
          read(); const j = i + Number(b.dataset.mv); if (j < 0 || j >= fields.length) return;
          [fields[i], fields[j]] = [fields[j], fields[i]]; draw();
        }));
      });
    };
    draw();
    $('tkAddRow').addEventListener('click', () => { read(); fields.push({ id: '', label: '', type: 'check', required: false, photo: 'none' }); draw(); const ins = pane.querySelectorAll('[data-k="label"]'); ins[ins.length - 1].focus(); });
    $('tkFBack').addEventListener('click', drawForms);
    $('tkFSave').addEventListener('click', async () => {
      read();
      const r = await apiPost({ action: 'saveTaskForm', ...mAuth(), form: { id: form ? form.id : 0, name: $('tkFName').value.trim(), fields: fields.filter((f) => f.label) } });
      if (!r.ok) { $('tkFErr').textContent = r.error || 'שגיאה'; return; }
      adm.forms = r.forms; say('הטופס נשמר ✓', 'ok'); drawForms();
    });
    if (form) $('tkFDel').addEventListener('click', async () => {
      if (!confirm('למחוק את הטופס "' + form.name + '"?')) return;
      const r = await apiPost({ action: 'deleteTaskForm', ...mAuth(), id: form.id });
      if (!r.ok) { $('tkFErr').textContent = r.error || 'שגיאה'; return; }
      await loadAdmin(); drawForms();
    });
  }

  /* ================= wiring ================= */
  function start() {
    const drop = $('menuOpsDrop') || $('menuSchedDrop');
    if (drop && !$('tkMgrBtn')) {
      drop.insertAdjacentHTML('afterbegin', '<button id="tkMgrBtn">📋 משימות</button>');
      $('tkMgrBtn').addEventListener('click', openMgr);
    }
    const links = document.querySelector('#empHome .eh-links');
    if (links && !$('ehTasks')) {
      links.insertAdjacentHTML('afterbegin', '<button data-go="tasks" id="ehTasks" style="display:none"><span class="ic">📋</span>המשימות שלי</button>');
      $('ehTasks').addEventListener('click', () => { if (appState() && appState().emp) openMine(); });
    }
    const home = $('empHome');
    if (home) {
      let shown = !home.classList.contains('hidden');
      if (shown) fetchMine();
      new MutationObserver(() => { const now = !home.classList.contains('hidden'); if (now && !shown) fetchMine(); shown = now; })
        .observe(home, { attributes: true, attributeFilter: ['class'] });
    }
  }
  window.openMyTasks = openMine;
  window.openTasksAdmin = openMgr;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
