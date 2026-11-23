// 👥 ניהול מועדון לקוחות (23/11/2026, the owner: "in ניהול העסק add a link to the customer club's management screen; an
// admin signed in needs no second factor"). Admin only: 💼 ניהול העסק ▸ הגדרות ותקשורת ▸ 👥 ניהול מועדון לקוחות.
// Opens club-send.html in a new tab already signed in: the server gives this admin a session of that page
// (api clubSendFromApp — his session here already passed the two-step sign-in); the token is handed to the new tab
// through window.opener (club-send.js takes it once, within a minute) — never in the address.
// Without an opener (e.g. an installed app on iPhone opening Safari) the page simply asks for its e-mail code as before.
// Uses the app's globals: apiPost, mgrAuth, state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const isAdmin = () => { try { return !!(state && state.mgr && state.mgr.role === 'אדמין'); } catch (_) { return false; } };
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); };

  async function openClub() {
    // the tab first, inside the click (a tab opened after waiting for the server is blocked as a pop-up)
    const w = window.open('about:blank', '_blank');
    let r = null;
    try { r = await apiPost({ action: 'clubSendFromApp', ...(typeof mgrAuth === 'function' ? mgrAuth() : {}) }); } catch (_) { r = null; }
    if (!r || !r.ok) {
      if (w) w.close();
      say((r && r.error) || 'אין חיבור לשרת — נסו שוב', 'err');
      return;
    }
    window.__clubHandoff = { token: r.token, email: r.email, at: Date.now() };
    setTimeout(() => { window.__clubHandoff = null; }, 60000);
    if (w) w.location.href = 'club-send.html';
    else location.href = 'club-send.html';   // pop-ups blocked: the same tab (the handoff is lost — the e-mail code then)
  }

  function start() {
    const drop = $('menuAdminDrop');
    if (!drop || $('clubMgrBtn')) return;
    drop.insertAdjacentHTML('beforeend', '<button id="clubMgrBtn" style="display:none">👥 ניהול מועדון לקוחות</button>');
    $('clubMgrBtn').addEventListener('click', openClub);
    const show = () => { $('clubMgrBtn').style.display = isAdmin() ? '' : 'none'; };
    $('menuAdminBtn')?.addEventListener('click', show, true);
    $('menuBizBtn')?.addEventListener('click', show, true);
    show();
    setInterval(show, 5000);   // signing in / out changes the role without a click on the menu
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openClubAdmin = openClub;
})();
