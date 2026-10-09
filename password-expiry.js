// Managers' password expiry (same file in shiftfloo web/app/ and on the Superstar site; server: mgrPasswordStatus /
// mgrChangePassword). Employees use the app's own change window (sign-in answers mustChange after 90 days).
//   after a manager signs in: expired → a change window that cannot be skipped; last 7 days → a reminder with a button
//   "🔑 החלפת סיסמה" in the manager's attendance menu, any time
// A manager signed in through his employee account (unified login) is governed by the employee password — not asked here.
// Uses the app's own globals: apiPost, mgrAuth, state, store, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  let checkedFor = '';

  function build() {
    if ($('mpwOverlay')) return;
    const inp = (id, label, ac) => '<div class="mrow"><label for="' + id + '">' + label + '</label><input type="password" id="' + id + '" autocomplete="' + ac + '" autocapitalize="off" spellcheck="false"></div>';
    document.body.insertAdjacentHTML('beforeend',
      '<div class="overlay hidden" id="mpwOverlay"><div class="modal" style="max-width:440px">' +
      '<header><h3>🔑 החלפת סיסמת מנהל</h3><p id="mpwSub"></p></header>' +
      '<div class="mbody">' + inp('mpwCur', 'סיסמה נוכחית', 'current-password') + inp('mpwNew', 'סיסמה חדשה (לפחות 4 תווים)', 'new-password') +
        inp('mpwNew2', 'סיסמה חדשה — שוב', 'new-password') + '</div>' +
      '<div class="merr" id="mpwErr" style="padding:0 18px"></div>' +
      '<div class="mfoot"><button class="btn primary" id="mpwOk">החלפת הסיסמה</button><button class="btn plain" id="mpwCancel">ביטול</button></div></div></div>');
    $('mpwOk').addEventListener('click', save);
    $('mpwCancel').addEventListener('click', () => $('mpwOverlay').classList.add('hidden'));
  }
  function open(forced) {
    build();
    $('mpwSub').textContent = forced ? 'עברו 90 יום מהחלפת הסיסמה האחרונה — יש לבחור סיסמה חדשה כדי להמשיך' : 'הסיסמה מוחלפת כל 90 יום. מכשירים אחרים יתבקשו להתחבר מחדש.';
    $('mpwCancel').style.display = forced ? 'none' : '';
    ['mpwCur', 'mpwNew', 'mpwNew2'].forEach((id) => ($(id).value = ''));
    $('mpwErr').textContent = '';
    $('mpwOverlay').classList.remove('hidden');
    $('mpwCur').focus();
  }
  async function save() {
    const err = $('mpwErr'), cur = $('mpwCur').value, np = $('mpwNew').value.trim(), np2 = $('mpwNew2').value.trim();
    if (!cur) { err.textContent = 'יש להזין את הסיסמה הנוכחית'; return; }
    if (np.length < 4) { err.textContent = 'הסיסמה החדשה חייבת להכיל לפחות 4 תווים'; return; }
    if (np !== np2) { err.textContent = 'הסיסמאות אינן זהות'; return; }
    const btn = $('mpwOk'); btn.disabled = true; err.textContent = 'שומר…';
    try {
      const x = await apiPost({ action: 'mgrChangePassword', ...mgrAuth(), currentPassword: cur, newPassword: np });
      if (!x.ok) { err.textContent = x.error || 'שגיאה'; return; }
      const s = appState();
      s.mgr.pw = x.token;                                    // the other devices were signed out; this one has a new session
      try { if (typeof store !== 'undefined' && !s.emp) store.set({ kind: 'mgr', name: s.mgr.name, pw: x.token }); } catch (_) { /* storage blocked */ }
      $('mpwOverlay').classList.add('hidden');
      say('הסיסמה הוחלפה ✓', 'ok');
    } finally { btn.disabled = false; }
  }

  /** once per manager sign-in: is his password expired or about to? */
  async function check() {
    const s = appState();
    if (!s || !s.mgr || s.emp) return;                       // not a manager sign-in (or a manager through his employee account)
    const key = s.mgr.name + '|' + String(s.mgr.pw || '').slice(0, 12);
    if (checkedFor === key) return;
    checkedFor = key;
    try {
      const r = await apiPost({ action: 'mgrPasswordStatus', ...mgrAuth() });
      if (!r || !r.ok || !r.managed) return;
      if (r.expired) open(true);
      else if (r.warn) say('🔑 הסיסמה שלך תפוג בעוד ' + r.daysLeft + ' ימים — אפשר להחליף ב-👤 אזור אישי ← החלפת סיסמה', 'err');
    } catch (_) { checkedFor = ''; }
  }

  function start() {
    const drop = $('menuAttDrop');
    if (drop && !$('mpwBtn')) {
      drop.insertAdjacentHTML('beforeend', '<hr><button id="mpwBtn">🔑 החלפת סיסמה</button>');
      $('mpwBtn').addEventListener('click', () => open(false));
    }
    // the manager tools appear after sign-in: check then
    const tools = $('adminTools');
    if (tools) new MutationObserver(() => { if (!tools.classList.contains('hidden')) check(); }).observe(tools, { attributes: true, attributeFilter: ['class'] });
    if (tools && !tools.classList.contains('hidden')) check();
  }
  window.openMgrPasswordChange = () => open(false);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
