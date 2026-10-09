// The managers' menus, arranged (same file in the Sidurit template web/app/ and on the Superstar site; loaded LAST — the
// other modules add their buttons first, and this file moves them; a moved button keeps its own behaviour):
//   📍 נוכחות            real time and reports: בזמן אמת · דוח חודשי · אישורי שעות · לא התייצבו
//   ✅ בקשות ואישורים    every request waiting for someone: בקשות (אילוצים / החלפות / חופשות) · אישורי מחלה · בקשות הצטרפות ·
//                        שרשרת אישורים
//   📅 סידור             as it was
//   ⚙ ניהול              (was "אדמין"): עובדים · הודעה · לוח הודעות · מחלה / חופשה לעובד · לוח חגים · תמרוץ · הגדרות חברה · חיוב
//   📁 טפסים ותלושים     תלושים · טפסי 101 · טפסי 106
//   👤 אזור אישי         the manager's own: החלפת סיסמה · ההתראות שלי · Push
// A menu with nothing the signed-in manager may see (e.g. the documents for a shift manager) is not shown.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const NEW = [
    // [menu id, label, after which menu]
    ['menuReq', '✅ בקשות ואישורים', 'menuAtt'],
    ['menuDocs', '📁 טפסים ותלושים', 'menuAdmin'],
    ['menuMe', '👤 אזור אישי', null],          // last
  ];
  const PLAN = {
    menuAttDrop: ['liveBtn', 'attBtn', 'haMgrBtn', 'nsMenuBtn'],
    menuReqDrop: ['consBtn', 'sickMgrBtn', 'rgMgrBtn', 'apChainBtn'],
    menuAdminDrop: ['empMgr', 'msgBtn', 'annBtn', 'meSickBtn', 'meVacBtn', 'holBtn', 'incMgrBtn', 'coSetBtn', 'coBillBtn'],
    menuDocsDrop: ['payBtn', 'f101AdminBtn', 'f106AllBtn'],
    menuMeDrop: ['mpwBtn', 'myAlertsBtn', 'mgrPushBtn2'],
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
      m.style.display = any ? '' : 'none';
    });
  }

  function arrange() {
    NEW.forEach(([id, label, after]) => makeMenu(id, label, after));
    rename('menuAdminBtn', 'אדמין', 'ניהול');
    for (const [dropId, ids] of Object.entries(PLAN)) {
      const drop = $(dropId);
      if (!drop) continue;
      for (const bid of ids) {
        const b = $(bid);
        if (!b) continue;
        const prev = b.previousElementSibling;
        if (prev && prev.tagName === 'HR') prev.remove();   // the separator a module put before its button
        drop.appendChild(b);                                 // in the plan's order
      }
    }
    // buttons a module adds to a menu later on (or this file does not know yet) stay where they were put
    syncMenus();
    const mo = new MutationObserver(syncMenus);
    document.querySelectorAll('.mgr-dropdown').forEach((d) => mo.observe(d, { attributes: true, subtree: true, childList: true, attributeFilter: ['class', 'style'] }));
  }
  // every module adds its buttons on DOMContentLoaded (or at once) — this one, loaded last, runs after them
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(arrange, 0)); else setTimeout(arrange, 0);
})();
