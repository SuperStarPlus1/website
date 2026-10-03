// The direct-manager approval chain — screens (same file in the Sidurit template web/app/ and on the Superstar site;
// server: api/approvals.ts, rules: _shared/approval-chain.ts):
//   employee  "📥 בקשות הצוות" — requests of the people I manage directly, waiting for me (approve / reject); shown only
//             to someone with a team or a waiting request, with a count and a home-screen banner
//             "⏳ בקשות בטיפול" — where each of my requests waits now, and the way it went
//   manager   "נוכחות ← 🧭 שרשרת אישורים" — each employee's direct manager (any employee, any branch; bulk set), the
//             requests open in the chain, and (admin) the hours before a request moves one up
// Uses the app's own globals: apiPost, mgrAuth, state, toast, openBlobPdf.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const empAuth = () => { const s = appState(); return s && s.emp ? { username: s.emp.username, password: s.emp.pw } : {}; };
  const KIND_IC = { vacation: '🏖', sick: '🤒', constraint: '🖐', hours: '🕒', punch: '✏' };
  const LEVEL_TXT = { direct: 'מנהל/ת ישיר/ה', branch: 'מנהלי הסניף', admin: 'אדמין החברה', skip: 'דילוג', done: 'טופלה' };
  function ago(iso) {
    if (!iso) return '';
    const h = Math.floor((Date.now() - Date.parse(iso)) / 3600000);
    return h < 1 ? 'פחות משעה' : h < 24 ? h + ' שעות' : Math.floor(h / 24) + ' ימים' + (h % 24 ? ' ו-' + (h % 24) + ' שע׳' : '');
  }
  const when = (iso) => { const d = new Date(iso); return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); };

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.ap-card{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;margin-bottom:8px;display:grid;gap:6px}' +
    '.ap-card .top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap}' +
    '.ap-card .who{font-weight:800}.ap-card .what{font-size:13.5px;color:#374151}' +
    '.ap-meta{font-size:12px;color:#6b7280}' +
    '.ap-chip{display:inline-block;border-radius:99px;padding:2px 9px;font-size:11.5px;font-weight:700;background:#fef3c7;color:#92400e;white-space:nowrap}' +
    '.ap-chip.k{background:#e0f2fe;color:#075985}' +
    '.ap-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}' +
    '.ap-btn{border:0;border-radius:9px;padding:7px 12px;font:inherit;font-weight:800;font-size:13px;cursor:pointer;background:#1b2a4a;color:#fff}' +
    '.ap-btn.ok{background:#16a34a}.ap-btn.no{background:#dc2626}.ap-btn.plain{background:#f1f5f9;color:#1f2937}.ap-btn.sm{padding:4px 9px;font-size:12px}' +
    '.ap-steps{font-size:12px;color:#4b5563;margin:0;padding-inline-start:18px}' +
    '.ap-note{border:1.5px solid #d1d5db;border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;flex:1;min-width:140px}' +
    '.ap-badge{background:#dc2626;color:#fff;border-radius:99px;padding:0 6px;font-size:11px;margin-inline-start:4px}' +
    '.ap-banner{margin:10px 0;background:#eff6ff;border:2px solid #60a5fa;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}' +
    '.ap-table{width:100%;min-width:0;border-collapse:collapse;font-size:13px}' +
    '.ap-table th{background:#f8fafc;font-size:11.5px;color:#6b7280;text-align:right;padding:6px;position:sticky;top:0}' +
    '.ap-table td{border-top:1px solid #e5e7eb;padding:5px 6px;vertical-align:middle}' +
    '.ap-table input[list]{border:1.5px solid #d1d5db;border-radius:8px;padding:5px 8px;font:inherit;font-size:13px;width:100%;min-width:130px}' +
    '.ap-table tr.chg td{background:#fffbeb}.ap-table tr.off td{color:#9ca3af}' +
    '.ap-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}' +
    '.ap-tools input,.ap-tools select{border:1.5px solid #d1d5db;border-radius:8px;padding:6px 8px;font:inherit;font-size:13px}' +
    '.ap-tabs{display:flex;gap:6px;margin-bottom:10px}' +
    '</style>');

  function overlay(id, title, sub, wide) {
    if (!$(id)) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="' + id + '"><div class="modal" style="max-width:' + (wide ? 900 : 640) + 'px">' +
        '<header><h3>' + title + '</h3><p id="' + id + 'Sub">' + (sub || '') + '</p></header>' +
        '<div class="mbody" id="' + id + 'Body"></div>' +
        '<div class="mfoot"><button class="btn plain" data-close>סגירה</button></div></div></div>');
      $(id).querySelector('[data-close]').addEventListener('click', () => $(id).classList.add('hidden'));
    }
    $(id).classList.remove('hidden');
    return $(id + 'Body');
  }
  const stepsHtml = (steps) => !steps || !steps.length ? '' :
    '<details><summary class="ap-meta" style="cursor:pointer">מסלול הבקשה</summary><ol class="ap-steps">' +
    steps.map((s) => '<li>' + e(when(s.at)) + ' · ' + (s.level === 'skip' ? 'דילוג על ' + e(s.to) + ' (' + e(s.why) + ')'
      : s.level === 'done' ? e(s.why) + ' — ' + e(s.to) : 'אצל ' + e(s.to) + (s.why ? ' — ' + e(s.why) : '')) + '</li>').join('') + '</ol></details>';

  /* ================= employee: my team ================= */
  let team = { items: [], team: [], hours: 48 };
  async function fetchTeam() {
    const s = appState();
    if (!s || !s.emp) return null;
    try { const r = await apiPost({ action: 'teamRequests', ...empAuth() }); if (r && r.ok) team = r; } catch (_) { /* offline */ }
    syncTeamUi();
    return team;
  }
  function syncTeamUi() {
    const has = team.items.length > 0 || team.team.length > 0;
    const b = $('apTeamBtn');
    if (b) {
      b.style.display = has ? '' : 'none';
      b.innerHTML = '📥 בקשות הצוות' + (team.items.length ? '<span class="ap-badge">' + team.items.length + '</span>' : '');
    }
    const home = $('empHome');
    let ban = $('apBanner');
    if (home && team.items.length) {
      if (!ban) {
        home.insertAdjacentHTML('afterbegin', '<div class="ap-banner" id="apBanner"></div>');
        ban = $('apBanner');
      }
      ban.innerHTML = '<span>📥 <b>' + team.items.length + '</b> ' + (team.items.length === 1 ? 'בקשה של הצוות ממתינה' : 'בקשות של הצוות ממתינות') + ' לאישורך</span>' +
        '<button class="ap-btn" id="apBannerBtn">לטיפול</button>';
      $('apBannerBtn').addEventListener('click', openTeam);
    } else if (ban) ban.remove();
  }
  async function openTeam() {
    const body = overlay('apTeamOverlay', '📥 בקשות הצוות', 'בקשות של העובדים שאת/ה המנהל/ת הישיר/ה שלהם');
    body.innerHTML = '<p class="ap-meta">טוען…</p>';
    await fetchTeam();
    const hrs = team.hours > 0 ? 'בקשה שלא תיענה תוך ' + team.hours + ' שעות עוברת למנהל שמעליך.' : '';
    body.innerHTML = (team.team.length ? '<p class="ap-meta">הצוות שלך: ' + team.team.map(e).join(', ') + (hrs ? '<br>' + hrs : '') + '</p>' : '') +
      (team.items.length ? team.items.map((x) =>
        '<div class="ap-card" data-id="' + x.id + '"><div class="top"><span><span class="who">' + e(x.employee) + '</span> · <span class="ap-chip k">' +
        (KIND_IC[x.kind] || '') + ' ' + e(x.kindLabel) + '</span></span><span class="ap-meta">ממתין/ה ' + e(ago(x.since)) + '</span></div>' +
        '<div class="what">' + e(x.summary) + '</div>' + stepsHtml(x.steps) +
        '<div class="ap-acts">' + (x.hasCert ? '<button class="ap-btn plain sm" data-cert>📎 האישור הרפואי</button>' : '') +
        '<input class="ap-note" placeholder="הערה (לא חובה)" maxlength="300">' +
        '<button class="ap-btn ok" data-ok="1">✓ אישור</button><button class="ap-btn no" data-ok="0">✗ דחייה</button></div></div>').join('')
        : '<p style="color:#6b7280">אין בקשות שממתינות לאישורך 👍</p>');
    body.querySelectorAll('.ap-card').forEach((card) => {
      const id = Number(card.dataset.id);
      card.querySelectorAll('[data-ok]').forEach((btn) => btn.addEventListener('click', async () => {
        const approve = btn.dataset.ok === '1';
        card.querySelectorAll('button').forEach((b) => (b.disabled = true));
        const x = await apiPost({ action: 'reviewTeamRequest', ...empAuth(), id, approve, note: card.querySelector('.ap-note').value.trim() });
        if (!x.ok) { say(x.error || 'שגיאה', 'err'); card.querySelectorAll('button').forEach((b) => (b.disabled = false)); return; }
        say(approve ? '✓ הבקשה אושרה' : 'הבקשה נדחתה', approve ? 'ok' : '');
        openTeam();
      }));
      const c = card.querySelector('[data-cert]');
      if (c) c.addEventListener('click', async () => {
        c.disabled = true; c.textContent = 'טוען…';
        const x = await apiPost({ action: 'teamSickCert', ...empAuth(), id });
        c.disabled = false; c.textContent = '📎 האישור הרפואי';
        if (!x.ok) return say(x.error || 'שגיאה', 'err');
        if (typeof openBlobPdf === 'function') openBlobPdf(x.data, x.filename, x.mimeType);
      });
    });
  }

  /* ================= employee: where my requests wait ================= */
  async function openMine() {
    const body = overlay('apMineOverlay', '⏳ בקשות בטיפול', 'איפה כל בקשה שלך ממתינה עכשיו');
    body.innerHTML = '<p class="ap-meta">טוען…</p>';
    const r = await apiPost({ action: 'myOpenRequests', ...empAuth() });
    if (!r.ok) { body.innerHTML = '<p>' + e(r.error || 'שגיאה') + '</p>'; return; }
    body.innerHTML = '<p class="ap-meta">' + (r.myManager ? 'המנהל/ת הישיר/ה שלך: <b>' + e(r.myManager) + '</b>' : 'לא הוגדר לך מנהל/ת ישיר/ה — הבקשות מגיעות למנהלי הסניף') + '</p>' +
      (r.items.length ? r.items.map((x) => '<div class="ap-card"><div class="top"><span class="ap-chip k">' + (KIND_IC[x.kind] || '') + ' ' + e(x.kindLabel) + '</span>' +
        '<span class="ap-chip">ממתין לאישור: ' + e(x.waitingFor) + '</span></div><div class="what">' + e(x.summary) + '</div>' +
        '<div class="ap-meta">הוגשה לפני ' + e(ago(x.createdAt)) + '</div>' + stepsHtml(x.steps) + '</div>').join('')
        : '<p style="color:#6b7280">אין בקשות שממתינות לאישור. בקשות שטופלו — ב"היסטוריית בקשות".</p>');
  }

  /* ================= manager: the chain ================= */
  let chain = null, chainTab = 'people', edits = {};
  async function openChain(tab) {
    if (typeof tab === 'string') chainTab = tab;
    const body = overlay('apChainOverlay', '🧭 שרשרת אישורים', 'מנהל/ת ישיר/ה לכל עובד — מאשר/ת חופשה, מחלה, אילוצים ותיקוני שעות. בהיעדרו/ה, או ללא מענה, הבקשה עולה למנהל שמעל, אחר כך למנהלי הסניף ולאדמין.', true);
    body.innerHTML = '<p class="ap-meta">טוען…</p>';
    const r = await apiPost({ action: 'approvalChain', ...mgrAuth() });
    if (!r.ok) { body.innerHTML = '<p>' + e(r.error || 'שגיאה') + '</p>'; return; }
    chain = r; edits = {};
    renderChain();
  }
  function renderChain() {
    const body = $('apChainOverlayBody');
    const r = chain;
    const tabs = '<div class="ap-tabs"><button class="btn ' + (chainTab === 'people' ? 'primary' : 'plain') + '" data-tab="people">👥 מנהלים ישירים</button>' +
      '<button class="btn ' + (chainTab === 'open' ? 'primary' : 'plain') + '" data-tab="open">⏳ בקשות בשרשרת (' + r.open.length + ')</button></div>';
    if (chainTab === 'open') {
      body.innerHTML = tabs + (r.open.length ? '<div style="overflow:auto"><table class="ap-table"><thead><tr><th>עובד/ת</th><th>בקשה</th><th>פרטים</th><th>ממתין/ה ל</th><th>מאז</th></tr></thead><tbody>' +
        r.open.map((x) => '<tr><td>' + e(x.employee) + '</td><td>' + (KIND_IC[x.kind] || '') + ' ' + e(x.kindLabel) + '</td><td>' + e(x.summary) + stepsHtml(x.steps) +
          '</td><td><b>' + e(x.waitingFor) + '</b></td><td>' + e(ago(x.since)) + '</td></tr>').join('') + '</tbody></table></div>' +
        '<p class="ap-meta">כמנהל/ת את/ה יכול/ה לאשר כל בקשה במסכים הרגילים (בקשות, מחלות, אישורי שעות) — גם כשהיא אצל מנהל/ת ישיר/ה.</p>'
        : '<p style="color:#6b7280">אין בקשות פתוחות בשרשרת.</p>');
    } else {
      const branches = [...new Set(r.people.map((p) => p.branch))].sort();
      body.innerHTML = tabs +
        '<datalist id="apEmpList">' + r.people.filter((p) => p.active).map((p) => '<option value="' + e(p.name) + '">' + e(p.branch) + '</option>').join('') + '</datalist>' +
        '<div class="ap-tools"><input id="apFind" placeholder="🔍 חיפוש עובד/ת" style="flex:1;min-width:140px">' +
        (branches.length > 1 ? '<select id="apBranch"><option value="">כל הסניפים</option>' + branches.map((b) => '<option>' + e(b) + '</option>').join('') + '</select>' : '') +
        '<label class="ap-meta"><input type="checkbox" id="apOff"> לא פעילים</label></div>' +
        '<div class="ap-tools" style="background:#f8fafc;border-radius:10px;padding:8px"><span class="ap-meta">למסומנים:</span>' +
        '<input list="apEmpList" id="apBulk" placeholder="מנהל/ת ישיר/ה" style="min-width:150px"><button class="ap-btn sm" id="apBulkSet">החלה</button>' +
        '<button class="ap-btn plain sm" id="apBulkClear">ללא מנהל ישיר</button></div>' +
        '<div style="overflow:auto;max-height:52vh"><table class="ap-table"><thead><tr><th><input type="checkbox" id="apAll"></th><th>עובד/ת</th><th>סניף</th><th>מנהל/ת ישיר/ה</th><th>צוות</th></tr></thead><tbody id="apRows"></tbody></table></div>' +
        (r.isAdmin ? '<div class="ap-tools" style="margin-top:10px"><span class="ap-meta">בקשה ללא מענה עוברת למנהל שמעל אחרי</span>' +
          '<input type="number" id="apHours" min="0" max="720" value="' + Number(r.hours) + '" style="width:70px"><span class="ap-meta">שעות (0 = רק כשהמאשר/ת בחופשה / מחלה)</span>' +
          '<button class="ap-btn plain sm" id="apHoursSave">שמירה</button></div>' : '') +
        '<div style="display:flex;gap:8px;justify-content:flex-start;margin-top:10px"><button class="ap-btn ok" id="apSave">💾 שמירת השינויים</button><span class="ap-meta" id="apDirty"></span></div>';
      drawRows();
      ['apFind', 'apBranch', 'apOff'].forEach((id) => { const x = $(id); if (x) x.addEventListener('input', drawRows); if (x) x.addEventListener('change', drawRows); });
      $('apAll').addEventListener('change', (ev) => $('apRows').querySelectorAll('input[type=checkbox]:not(:disabled)').forEach((c) => (c.checked = ev.target.checked)));
      const bulk = (val) => {
        const picked = [...$('apRows').querySelectorAll('input[type=checkbox]:checked')].map((c) => c.dataset.n);
        if (!picked.length) return say('יש לסמן עובדים', 'err');
        if (val && !r.people.some((p) => p.name === val)) return say('יש לבחור מנהל/ת מהרשימה', 'err');
        picked.forEach((n) => setEdit(n, val));
        drawRows();
      };
      $('apBulkSet').addEventListener('click', () => bulk($('apBulk').value.trim()));
      $('apBulkClear').addEventListener('click', () => bulk(''));
      $('apSave').addEventListener('click', save);
      if ($('apHoursSave')) $('apHoursSave').addEventListener('click', async () => {
        const x = await apiPost({ action: 'setEscalateHours', ...mgrAuth(), hours: Number($('apHours').value) });
        say(x.ok ? '✓ נשמר' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err');
      });
    }
    body.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { chainTab = b.dataset.tab; renderChain(); }));
  }
  const current = (p) => (p.name in edits ? edits[p.name] : p.reportsTo);
  function setEdit(name, val) {
    const p = chain.people.find((x) => x.name === name);
    if (!p || !p.canEdit) return;
    if (val === p.reportsTo) delete edits[name]; else edits[name] = val;
  }
  function drawRows() {
    const q = ($('apFind') && $('apFind').value.trim()) || '', br = ($('apBranch') && $('apBranch').value) || '', off = $('apOff') && $('apOff').checked;
    const teamOf = {};
    chain.people.forEach((p) => { const m = current(p); if (m) (teamOf[m] = teamOf[m] || []).push(p.name); });
    const list = chain.people.filter((p) => (off || p.active) && (!br || p.branch === br) && (!q || p.name.includes(q) || current(p).includes(q)));
    $('apRows').innerHTML = list.map((p) => '<tr class="' + (p.name in edits ? 'chg' : '') + (p.active ? '' : ' off') + '">' +
      '<td><input type="checkbox" data-n="' + e(p.name) + '"' + (p.canEdit ? '' : ' disabled') + '></td><td>' + e(p.name) + '</td><td>' + e(p.branch) + '</td>' +
      '<td><input list="apEmpList" data-m="' + e(p.name) + '" value="' + e(current(p)) + '" placeholder="— ללא —"' + (p.canEdit ? '' : ' disabled') + '></td>' +
      '<td class="ap-meta">' + (teamOf[p.name] ? teamOf[p.name].length + ' עובדים' : '') + '</td></tr>').join('') ||
      '<tr><td colspan="5" class="ap-meta">אין עובדים</td></tr>';
    $('apRows').querySelectorAll('input[data-m]').forEach((inp) => inp.addEventListener('change', () => {
      const v = inp.value.trim();
      if (v && !chain.people.some((p) => p.name === v)) { say('יש לבחור עובד/ת מהרשימה', 'err'); inp.value = current(chain.people.find((p) => p.name === inp.dataset.m)); return; }
      setEdit(inp.dataset.m, v);
      drawRows();
    }));
    const n = Object.keys(edits).length;
    $('apDirty').textContent = n ? n + ' שינויים שלא נשמרו' : '';
  }
  async function save() {
    const changes = Object.keys(edits).map((n) => ({ employee: n, reportsTo: edits[n] }));
    if (!changes.length) return say('אין שינויים');
    $('apSave').disabled = true;
    const x = await apiPost({ action: 'setReportsTo', ...mgrAuth(), changes });
    $('apSave').disabled = false;
    if (!x.ok) return say(x.error || 'שגיאה', 'err');
    say('✓ נשמר (' + x.changed + ')', 'ok');
    openChain('people');
  }

  /* ================= wiring ================= */
  /** a request sent to a direct manager: say to whom (the server answers waitingFor). After load: the app sets
   *  window.apiPost itself in its main script. */
  function wrapApi() {
    if (typeof window.apiPost !== 'function' || window.apiPost.__ap) return;
    const orig = window.apiPost;
    const wrapped = async function () {
      const r = await orig.apply(this, arguments);
      if (r && r.ok && r.waitingFor) setTimeout(() => say('✓ נשלח לאישור ' + r.waitingFor + ' (מנהל/ת ישיר/ה)', 'ok'), 600);
      return r;
    };
    wrapped.__ap = true;
    window.apiPost = wrapped;
  }
  function wireEmployee() {
    const drop = $('emSchedDrop');
    if (!drop || $('apTeamBtn')) return !!drop;
    const mk = (id, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.setAttribute('role', 'menuitem'); b.innerHTML = label; b.addEventListener('click', fn); return b; };
    const hist = $('myHistoryBtn');
    const mine = mk('apMineBtn', '⏳ בקשות בטיפול', openMine);
    const tb = mk('apTeamBtn', '📥 בקשות הצוות', openTeam);
    tb.style.display = 'none';
    if (hist) { drop.insertBefore(mine, hist); drop.insertBefore(tb, mine); } else { drop.appendChild(tb); drop.appendChild(mine); }
    syncTeamUi();                                            // the team may have been fetched before the menu existed
    return true;
  }
  function wireManager() {
    const drop = $('menuAttDrop');
    if (!drop || $('apChainBtn')) return;
    drop.insertAdjacentHTML('beforeend', '<button id="apChainBtn">🧭 שרשרת אישורים</button>');
    $('apChainBtn').addEventListener('click', () => openChain());
  }
  function start() {
    wrapApi();
    wireManager();
    let tries = 0;
    const iv = setInterval(() => { if (wireEmployee() || ++tries > 40) clearInterval(iv); }, 250);   // employee-menus.js builds the menu first
    const home = $('empHome');
    if (home) {
      let shown = !home.classList.contains('hidden');
      if (shown) fetchTeam();
      new MutationObserver(() => { const now = !home.classList.contains('hidden'); if (now && !shown) fetchTeam(); shown = now; })
        .observe(home, { attributes: true, attributeFilter: ['class'] });
    }
  }
  window.openTeamRequests = openTeam;
  window.openApprovalChain = openChain;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
