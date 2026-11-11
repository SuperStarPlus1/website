// The managers' menus, arranged (same file in the Sidurit template web/app/ and on the Superstar site; loaded LAST — the
// other modules add their buttons first, and this file moves them; a moved button keeps its own behaviour).
// 11/11/2026 (the owner: "the admin menu got too long"): the people and the attendance in one menu with two parts,
// the business reports in a menu of their own, and what is left of the admin menu = settings and messages.
//   👥 עובדים ונוכחות    עובדים: עובדים · כרטיס עובד · מחלה / חופשה לעובד · גיוס עובדים · ערוצי פרסום · תמרוץ משמרות
//                        נוכחות: בזמן אמת · דוח חודשי · אישורי שעות · לא התייצבו · שעון נוכחות · מיקום לדיווח נוכחות
//   ✅ בקשות ואישורים    every request waiting for someone: בקשות חופשה · אילוצים · בקשות החלפה · אישורי מחלה · בקשות הצטרפות ·
//                        שרשרת אישורים
//   📅 סידור             as it was
//   📊 דוחות ועסק        לוח מכירות ורווח · אופטימייזר מגוון · מלאי בשר · פנקס והוצאות / clearcount (each admin only)
//   ⚙ הגדרות ותקשורת    (was "אדמין"): הודעה · לוח הודעות · לוח חגים · הגדרות חברה · חיוב (+ any button not placed here)
//   📁 טפסים ותלושים     ניהול מסמכים · תלושים · טפסי 101 · טפסי 106
//   👤 אזור אישי         the manager's own: החלפת סיסמה · אימות דו-שלבי · ההתראות שלי · Push
// A menu with nothing the signed-in manager may see (e.g. the reports for a shift manager) is not shown, and so is a
// part's title with nothing under it.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const NEW = [
    // [menu id, label, after which menu]
    ['menuReq', '✅ בקשות ואישורים', 'menuAtt'],
    ['menuBiz', '📊 דוחות ועסק', 'menuSched'],
    ['menuDocs', '📁 טפסים ותלושים', 'menuAdmin'],
    ['menuMe', '👤 אזור אישי', null],          // last
  ];
  const PLAN = {
    menuAttDrop: ['§ניהול עובדים', 'empMgr', 'hrMenuBtn', 'meSickBtn', 'meVacBtn', 'rcMgrBtn', 'pubMenuBtn', 'incMgrBtn',
      '§נוכחות', 'liveBtn', 'attBtn', 'haMgrBtn', 'nsMenuBtn', 'clkMenuBtn', 'geoMgrBtn'],
    menuReqDrop: ['apMgrTeamBtn', 'reqVacBtn', 'reqConsBtn', 'reqSwapBtn', 'sickMgrBtn', 'rgMgrBtn', 'apChainBtn', 'consBtn'],   // consBtn: hidden (all together)
    menuBizDrop: ['sdMgrBtn', 'asMgrBtn', 'miMgrBtn', 'ccMgrBtn'],
    menuAdminDrop: ['msgBtn', 'annBtn', 'holBtn', 'coSetBtn', 'coBillBtn'],
    menuDocsDrop: ['dsMgrBtn', 'payBtn', 'f101AdminBtn', 'f106AllBtn'],
    menuMeDrop: ['mpwBtn', 'mfaMenuBtn', 'myAlertsBtn', 'mgrPushBtn2'],
  };

  function makeMenu(id, label, after) {
    if ($(id)) return;
    const box = document.createElement('div');
    box.className = 'mgr-menu'; box.id = id;
    box.innerHTML = '<button class="mgr-menu-btn" id="' + id + 'Btn">' + label + '</button><div class="mgr-dropdown" id="' + id + 'Drop"></div>';
    const ref = after && $(after);
    const any = document.querySelector('.mgr-menu');
    if (ref) ref.after(box);
    else if (any) any.parentElement.appendChild(box);
    else return;
    // the same open / close as the app's own menus (a click outside closes every dropdown — the app's handler)
    $(id + 'Btn').addEventListener('click', (ev) => {
      ev.stopPropagation();
      const drop = $(id + 'Drop'), open = drop.classList.contains('open');
      document.querySelectorAll('.mgr-dropdown').forEach((d) => d.classList.remove('open'));
      document.querySelectorAll('.mgr-menu-btn').forEach((b) => b.classList.remove('active'));
      if (!open) { drop.classList.add('open'); $(id + 'Btn').classList.add('active'); }
    });
  }
  /** the label of the old admin menu (its arrow / text node kept) */
  function rename(btnId, from, to) {
    const b = $(btnId);
    if (!b) return;
    for (const n of b.childNodes) if (n.nodeType === 3 && n.textContent.includes(from)) n.textContent = n.textContent.replace(from, to);
    if (!b.textContent.includes(to)) b.textContent = b.textContent.replace(from, to);
  }
  /** a menu shows when at least one of its buttons may be seen */
  function visible(btn) {
    return !btn.classList.contains('hidden') && btn.style.display !== 'none';
  }
  function syncMenus() {
    document.querySelectorAll('.mgr-menu').forEach((m) => {
      const drop = m.querySelector('.mgr-dropdown');
      if (!drop) return;
      const any = [...drop.querySelectorAll(':scope > button')].some(visible);
      if (m.style.display !== (any ? '' : 'none')) m.style.display = any ? '' : 'none';
      // a part's title: shown when a button under it (up to the next title) may be seen
      drop.querySelectorAll(':scope > .mgr-sec').forEach((h) => {
        let n = h.nextElementSibling, on = false;
        while (n && !n.classList.contains('mgr-sec')) { if (n.tagName === 'BUTTON' && visible(n)) { on = true; break; } n = n.nextElementSibling; }
        if (h.style.display !== (on ? '' : 'none')) h.style.display = on ? '' : 'none';
      });
    });
  }

  /** Many modules show / hide their button when ⚙ (the old admin menu) is clicked (by the role of the signed-in manager).
   *  Their buttons now sit in other menus too — so each menu click, and each sign-in, runs those checks: a click on the
   *  admin button that does not bubble, and the admin menu put back as it was. */
  let busy = false;
  function refresh() {
    const a = $('menuAdminBtn'), d = $('menuAdminDrop');
    if (!a || !d || busy) return;
    busy = true;
    const was = d.classList.contains('open');
    try { a.dispatchEvent(new MouseEvent('click', { bubbles: false })); } catch (_) {}
    d.classList.toggle('open', was); a.classList.toggle('active', was);
    busy = false;
    syncMenus();
  }
  function hookRefresh() {
    document.addEventListener('click', (ev) => {
      const b = ev.target.closest && ev.target.closest('.mgr-menu-btn');
      if (b && b.id !== 'menuAdminBtn' && !busy) refresh();
    }, true);
    if (typeof window.setAuthUI === 'function') {
      const orig = window.setAuthUI;
      window.setAuthUI = function () { const r = orig.apply(this, arguments); setTimeout(refresh, 0); return r; };
    }
    refresh();
  }

  function arrange() {
    NEW.forEach(([id, label, after]) => makeMenu(id, label, after));
    rename('menuAdminBtn', 'אדמין', 'הגדרות ותקשורת');
    rename('menuAttBtn', 'נוכחות', 'עובדים ונוכחות');
    rename('menuAttBtn', '📍', '👥');
    if (!$('mgrSecCss')) document.head.insertAdjacentHTML('beforeend', '<style id="mgrSecCss">.mgr-dropdown .mgr-sec{font-size:11.5px;font-weight:800;color:#64748b;padding:8px 14px 3px;border-top:1px solid #e2e8f0;margin-top:3px;white-space:nowrap}.mgr-dropdown .mgr-sec:first-child{border-top:0;margin-top:0}</style>');
    for (const [dropId, ids] of Object.entries(PLAN)) {
      const drop = $(dropId);
      if (!drop) continue;
      for (const bid of ids) {
        if (bid[0] === '§') { const h = document.createElement('div'); h.className = 'mgr-sec'; h.textContent = bid.slice(1); drop.appendChild(h); continue; }
        const b = $(bid);
        if (!b) continue;
        const prev = b.previousElementSibling;
        if (prev && prev.tagName === 'HR') prev.remove();   // the separator a module put before its button
        drop.appendChild(b);                                 // in the plan's order
      }
    }
    // buttons a module adds to a menu later on (or this file does not know yet) stay where they were put
    hookRefresh();
    const mo = new MutationObserver(syncMenus);
    document.querySelectorAll('.mgr-dropdown').forEach((d) => mo.observe(d, { attributes: true, subtree: true, childList: true, attributeFilter: ['class', 'style'] }));
  }
  // every module adds its buttons on DOMContentLoaded (or at once) — this one, loaded last, runs after them
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(arrange, 0)); else setTimeout(arrange, 0);
})();
