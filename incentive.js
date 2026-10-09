// The yearly shift incentive — screens (same file in the Sidurit template web/app/ and on the Superstar site; server:
// _shared/incentive-handlers.ts, rules: _shared/incentive-core.ts):
//   employee  a card on the home screen (the year's count, percent, a bar) → "🏆 היעד שלי": the percent, the money at
//             the target, how many are left, the pace (where an even pace would be by today, where the year ends at
//             this pace), evenings / Saturdays / holidays, month by month, the last counted days; earlier years
//   manager   "⚙ ניהול ← 🏆 תמרוץ משמרות": every employee's standing, who reached the target, the year's cost;
//             (admin) the settings — on / off, the target, the amount, the year's first month, what counts, who is out
// Uses the app's own globals: apiPost, mgrAuth, state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const empAuth = () => { const s = appState(); return s && s.emp ? { username: s.emp.username, password: s.emp.pw } : {}; };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
  const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const nis = (n) => '₪' + Number(n || 0).toLocaleString('he-IL');
  const KIND = { part: 'ערב', saturday: 'שבת', holiday: 'חג' };

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.inc-card{background:linear-gradient(135deg,#1b2a4a,#2f4a7a);color:#fff;border-radius:16px;padding:12px 14px;margin:10px 0;cursor:pointer;display:grid;gap:6px}' +
    '.inc-card .top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.inc-card .t{font-weight:800}.inc-card .p{font-size:22px;font-weight:900}' +
    '.inc-bar{height:10px;border-radius:99px;background:rgba(255,255,255,.22);overflow:hidden;position:relative}.inc-bar i{position:absolute;inset:0 auto 0 0;display:block;border-radius:99px;background:#facc15}' +
    '.inc-bar.light{background:#e5e7eb}.inc-bar.light i{background:#2563eb}.inc-bar .pace{position:absolute;top:-3px;bottom:-3px;width:2px;background:#ef4444}' +
    '.inc-card small{opacity:.85}' +
    '.inc-ring{width:170px;height:170px;border-radius:50%;display:grid;place-items:center;margin:4px auto 8px}' +
    '.inc-ring>div{width:132px;height:132px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center}' +
    '.inc-ring b{font-size:30px;line-height:1}.inc-ring span{font-size:12px;color:#6b7280}' +
    '.inc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:8px 0}' +
    '.inc-kpi{border:1px solid #e5e7eb;border-radius:12px;padding:8px 10px;text-align:center}.inc-kpi b{display:block;font-size:20px}.inc-kpi span{font-size:12px;color:#6b7280}' +
    '.inc-kpi.win{background:#dcfce7;border-color:#86efac}.inc-kpi.warn{background:#fef9c3;border-color:#fde047}' +
    '.inc-months{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;align-items:end;height:110px;margin:6px 0 2px}' +
    '.inc-months div{background:#2563eb;border-radius:5px 5px 0 0;min-height:2px;position:relative}.inc-months div span{position:absolute;top:-16px;left:0;right:0;text-align:center;font-size:10.5px;color:#374151}' +
    '.inc-mlbl{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;font-size:10px;color:#6b7280;text-align:center}' +
    '.inc-chip{display:inline-block;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:700;margin:2px}' +
    '.inc-chip.ok{background:#dcfce7;color:#166534}.inc-chip.warn{background:#fef9c3;color:#854d0e}.inc-chip.no{background:#fee2e2;color:#991b1b}.inc-chip.n{background:#e0e7ff;color:#3730a3}' +
    '.inc-yr{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px}.inc-yr button{border:1.5px solid #d1d5db;background:#fff;border-radius:8px;padding:4px 10px;font:inherit;cursor:pointer}' +
    '.inc-table{width:100%;border-collapse:collapse;font-size:13px}.inc-table th{background:#f8fafc;font-size:11.5px;color:#6b7280;text-align:right;padding:6px}' +
    '.inc-table td{border-top:1px solid #e5e7eb;padding:6px;vertical-align:middle}.inc-table tr.out td{color:#9ca3af}' +
    '.inc-set{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;margin-bottom:10px;display:grid;gap:8px}' +
    '.inc-set .r{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.inc-set label{display:flex;gap:6px;align-items:center;font-weight:700;font-size:13px}' +
    '.inc-set input[type=number],.inc-set select{border:1.5px solid #d1d5db;border-radius:8px;padding:6px 8px;font:inherit;width:110px}' +
    '.inc-chips{display:flex;flex-wrap:wrap;gap:5px}.inc-chips button{border:1.5px solid #d1d5db;background:#fff;border-radius:99px;padding:4px 11px;font:inherit;font-size:13px;cursor:pointer}' +
    '.inc-chips button.on{background:#1b2a4a;color:#fff;border-color:#1b2a4a}.inc-chips button.out{background:#fee2e2;border-color:#fca5a5;color:#991b1b;text-decoration:line-through}' +
    '.inc-btn{border:0;border-radius:9px;padding:8px 14px;font:inherit;font-weight:800;cursor:pointer;background:#1b2a4a;color:#fff}' +
    '</style>');

  function overlay(id, title, wide) {
    if (!$(id)) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="' + id + '"><div class="modal" style="max-width:' + (wide ? 940 : 560) + 'px">' +
        '<header><h3 id="' + id + 'Title"></h3><p id="' + id + 'Sub"></p></header><div class="mbody" id="' + id + 'Body"></div>' +
        '<div class="mfoot"><span class="spacer"></span><button class="btn plain" data-close>סגירה</button></div></div></div>');
      $(id).querySelector('[data-close]').addEventListener('click', () => $(id).classList.add('hidden'));
    }
    $(id + 'Title').textContent = title;
    $(id).classList.remove('hidden');
    return $(id + 'Body');
  }
  const bar = (pct, light, pace) => '<div class="inc-bar' + (light ? ' light' : '') + '"><i style="width:' + Math.min(100, pct) + '%"></i>' +
    (pace != null && pace < 100 ? '<span class="pace" style="left:' + pace + '%" title="הקצב הנדרש עד היום"></span>' : '') + '</div>';

  /* ================= employee ================= */
  let mine = null;
  async function fetchMine(year) {
    const s = appState();
    if (!s || !s.emp) return null;
    try { const r = await apiPost({ action: 'myIncentive', ...empAuth(), year }); if (r && r.ok) return r; } catch (_) { /* offline */ }
    return null;
  }
  async function refreshCard() {
    const home = $('empHome');
    if (!home) return;
    mine = await fetchMine();
    let card = $('incCard');
    if (!mine || !mine.enabled || mine.excluded) { if (card) card.remove(); return; }
    if (!card) {
      const anchor = home.querySelector('.eh-links');
      (anchor || home).insertAdjacentHTML(anchor ? 'beforebegin' : 'beforeend', '<div class="inc-card" id="incCard"></div>');
      card = $('incCard');
      card.addEventListener('click', () => openMine());
    }
    const m = mine;
    card.innerHTML = '<div class="top"><span class="t">🏆 יעד משמרות ' + e(m.label) + '</span><span class="p">' + Math.floor(m.pct) + '%</span></div>' +
      bar(m.pct, false, m.reached ? null : m.elapsedPct) +
      '<small>' + (m.reached ? '🎉 הגעת ליעד! ' + m.count + ' משמרות · ' + nis(m.earned) : m.count + ' מתוך ' + m.target + ' משמרות · עוד ' + m.remaining + ' ל-' + nis(m.amount)) + ' ›</small>';
  }
  async function openMine(year) {
    const body = overlay('incMine', '🏆 היעד שלי');
    body.innerHTML = '<p class="tk-meta">טוען…</p>';
    const m = year ? await fetchMine(year) : (mine || await fetchMine());
    if (!m || !m.enabled) { body.innerHTML = '<p>המודל לא פעיל כרגע.</p>'; return; }
    if (m.excluded) { body.innerHTML = '<p>אינך משתתף/ת במודל התמרוץ.</p>'; return; }
    $('incMineSub').textContent = m.rules;
    const deg = Math.min(100, m.pct) * 3.6, color = m.reached ? '#16a34a' : '#2563eb';
    const maxM = Math.max(1, ...m.byMonth);
    body.innerHTML =
      '<div class="inc-yr"><button id="incPrev">›</button><b>שנת ' + e(m.label) + '</b>' + (m.year < m.current ? '<button id="incNext">‹</button>' : '<span style="width:34px"></span>') + '</div>' +
      '<div class="inc-ring" style="background:conic-gradient(' + color + ' ' + deg + 'deg,#e5e7eb 0)"><div><div><b>' + Math.floor(m.pct) + '%</b><br><span>' + m.count + ' / ' + m.target + ' משמרות</span></div></div></div>' +
      (m.reached ? '<div class="inc-kpi win" style="margin-bottom:8px"><b>🎉 ' + nis(m.earned) + '</b><span>הגעת ליעד — זכאי/ת לתמרוץ</span></div>'
        : '<div style="text-align:center;margin-bottom:6px">עוד <b>' + m.remaining + '</b> משמרות ל-<b>' + nis(m.amount) + '</b><br><span class="tk-meta">מתחת ליעד — אין תמרוץ</span></div>') +
      '<div class="inc-kpis">' +
      '<div class="inc-kpi"><b>' + m.byKind.part + '</b><span>ערב / לילה</span></div>' +
      '<div class="inc-kpi"><b>' + m.byKind.saturday + '</b><span>שבת</span></div>' +
      '<div class="inc-kpi"><b>' + m.byKind.holiday + '</b><span>חג</span></div>' +
      (m.ended || m.reached ? '' : '<div class="inc-kpi ' + (m.onTrack ? 'win' : 'warn') + '"><b>' + (m.onTrack ? '✅ בקצב' : '⚠ מתחת לקצב') + '</b><span>' +
        (m.onTrack ? 'צפוי: ~' + m.projected + ' בסוף השנה' : 'עד היום היה צריך ' + m.expected + ' · צפוי ~' + m.projected) + '</span></div>') + '</div>' +
      '<div style="font-weight:700;margin-top:6px">משמרות שנספרו לפי חודש</div>' +
      '<div class="inc-months">' + m.byMonth.map((n) => '<div style="height:' + Math.round(n / maxM * 90) + '%"><span>' + (n || '') + '</span></div>').join('') + '</div>' +
      '<div class="inc-mlbl">' + m.months.map((x) => '<span>' + MONTHS[Number(x.slice(5, 7)) - 1] + '</span>').join('') + '</div>' +
      (m.recent.length ? '<div style="font-weight:700;margin-top:10px">נספרו לאחרונה</div><div>' + m.recent.map((r) => '<span class="inc-chip n">' + r.date.slice(8, 10) + '/' + r.date.slice(5, 7) + ' · ' + (r.kind === 'part' ? e(r.part) : KIND[r.kind]) + '</span>').join('') + '</div>' : '');
    $('incPrev').addEventListener('click', () => openMine(m.year - 1));
    if ($('incNext')) $('incNext').addEventListener('click', () => openMine(m.year + 1));
  }

  /* ================= manager ================= */
  let adm = null;
  async function openMgr(year) {
    const body = overlay('incMgr', '🏆 תמרוץ משמרות', true);
    body.innerHTML = '<p class="tk-meta">טוען…</p>';
    const r = await apiPost({ action: 'incentiveAdmin', ...mAuth(), year });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    adm = r;
    $('incMgrSub').textContent = 'עובד שמגיע ליעד המשמרות בשנה מקבל את הסכום; מתחת ליעד — לא כלום. ' + r.rules;
    const s = r.settings, isAdmin = r.role === 'אדמין';
    const parts = s.parts || r.defaultParts, out = new Set(s.excluded);
    body.innerHTML = (isAdmin ? '<details class="inc-set"' + (s.enabled ? '' : ' open') + '><summary style="font-weight:800;cursor:pointer">⚙ הגדרות המודל</summary>' +
      '<div class="r"><label><input type="checkbox" id="incOn"' + (s.enabled ? ' checked' : '') + '> המודל פעיל (העובדים רואים את היעד)</label></div>' +
      '<div class="r"><label>יעד: מעל <input type="number" id="incTarget" min="1" max="366" value="' + s.target + '"> משמרות בשנה</label>' +
      '<label>סכום התמרוץ ₪ <input type="number" id="incAmount" min="0" step="50" value="' + s.amount + '"></label>' +
      '<label>השנה מתחילה ב-<select id="incStart">' + MONTH_NAMES.map((n, i) => '<option value="' + (i + 1) + '"' + (s.startMonth === i + 1 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label></div>' +
      '<div class="r"><span style="font-weight:700;font-size:13px">נספרות משמרות:</span><div class="inc-chips" id="incParts">' +
      r.parts.map((p) => '<button type="button" data-p="' + e(p) + '" class="' + (parts.includes(p) ? 'on' : '') + '">' + e(p) + '</button>').join('') + '</div>' +
      '<label><input type="checkbox" id="incSat"' + (s.saturday ? ' checked' : '') + '> כל משמרת בשבת</label><label><input type="checkbox" id="incHol"' + (s.holidays ? ' checked' : '') + '> כל משמרת בחג</label></div>' +
      '<div><span style="font-weight:700;font-size:13px">לא משתתפים במודל (לחיצה מוציאה / מחזירה):</span><div class="inc-chips" id="incOut" style="margin-top:4px">' +
      r.rows.map((x) => '<button type="button" data-n="' + e(x.name) + '" class="' + (out.has(x.name) ? 'out' : '') + '">' + e(x.name) + '</button>').join('') + '</div></div>' +
      '<div class="r"><button class="inc-btn" id="incSave">שמירת ההגדרות</button><span class="merr" id="incErr"></span></div></details>' : '') +
      '<div class="inc-yr"><button id="incPrevY">›</button><b>שנת ' + e(r.label) + '</b>' + (r.year < r.current ? '<button id="incNextY">‹</button>' : '<span style="width:34px"></span>') + '</div>' +
      (s.enabled ? '' : '<p class="inc-chip warn">המודל כבוי — העובדים לא רואים אותו. הנתונים למטה לפי ההגדרות.</p>') +
      '<div class="inc-kpis"><div class="inc-kpi"><b>' + r.totals.employees + '</b><span>משתתפים</span></div>' +
      '<div class="inc-kpi win"><b>' + r.totals.reached + '</b><span>הגיעו ליעד</span></div>' +
      '<div class="inc-kpi"><b>' + r.totals.onTrack + '</b><span>בקצב ליעד</span></div>' +
      '<div class="inc-kpi"><b>' + nis(r.totals.cost) + '</b><span>עלות התמרוץ עד כה</span></div></div>' +
      '<div style="overflow:auto"><table class="inc-table"><tr><th>עובד</th><th>משמרות</th><th style="min-width:140px">התקדמות</th><th>ערב · שבת · חג</th><th>מצב</th><th>תמרוץ</th></tr>' +
      r.rows.map((x) => '<tr class="' + (x.excluded ? 'out' : '') + '"><td><b>' + e(x.name) + '</b>' + (r.role === 'אדמין' ? ' <span class="tk-meta">' + e(x.branch) + '</span>' : '') + '</td>' +
        '<td>' + x.count + ' / ' + s.target + '</td><td>' + bar(x.pct, true) + '<span class="tk-meta">' + Math.floor(x.pct) + '%</span></td>' +
        '<td class="tk-meta">' + x.byKind.part + ' · ' + x.byKind.saturday + ' · ' + x.byKind.holiday + '</td><td>' +
        (x.excluded ? '<span class="inc-chip no">לא משתתף</span>' : x.reached ? '<span class="inc-chip ok">🏆 הגיע ליעד</span>' : x.onTrack ? '<span class="inc-chip ok">בקצב</span>' :
          '<span class="inc-chip warn">מתחת לקצב · צפוי ~' + x.projected + '</span>') + '</td><td><b>' + (x.earned ? nis(x.earned) : '—') + '</b></td></tr>').join('') + '</table></div>';
    $('incPrevY').addEventListener('click', () => openMgr(r.year - 1));
    if ($('incNextY')) $('incNextY').addEventListener('click', () => openMgr(r.year + 1));
    if (!isAdmin) return;
    $('incParts').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => b.classList.toggle('on')));
    $('incOut').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => b.classList.toggle('out')));
    $('incSave').addEventListener('click', async () => {
      const settings = { enabled: $('incOn').checked, target: Number($('incTarget').value), amount: Number($('incAmount').value), startMonth: Number($('incStart').value),
        parts: [...$('incParts').querySelectorAll('button.on')].map((b) => b.dataset.p), saturday: $('incSat').checked, holidays: $('incHol').checked,
        excluded: [...$('incOut').querySelectorAll('button.out')].map((b) => b.dataset.n) };
      $('incErr').textContent = 'שומר…';
      const x = await apiPost({ action: 'saveIncentive', ...mAuth(), settings });
      if (!x.ok) { $('incErr').textContent = x.error || 'שגיאה'; return; }
      say('הגדרות התמרוץ נשמרו ✓', 'ok');
      openMgr(r.year);
    });
  }

  /* ================= wiring ================= */
  function start() {
    const drop = $('menuAdminDrop');
    if (drop && !$('incMgrBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="incMgrBtn">🏆 תמרוץ משמרות</button>');
      $('incMgrBtn').addEventListener('click', () => openMgr());
    }
    const home = $('empHome');
    if (home) {
      let shown = !home.classList.contains('hidden');
      if (shown) refreshCard();
      new MutationObserver(() => { const now = !home.classList.contains('hidden'); if (now && !shown) refreshCard(); shown = now; })
        .observe(home, { attributes: true, attributeFilter: ['class'] });
    }
  }
  window.openMyIncentive = openMine;
  window.openIncentiveAdmin = openMgr;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
