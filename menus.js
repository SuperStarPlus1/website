// The managers' menus, arranged (same file in the Sidurit template web/app/ and on the Superstar site; loaded LAST — the
// other modules add their buttons first, and this file moves them; a moved button keeps its own behaviour).
// 11/11/2026 (the owner: the menus were too long — then: two main menus with sub-menus):
//   👥 עובדים ונוכחות    ▸ ניהול עובדים: עובדים · כרטיס עובד · מחלה / חופשה לעובד · גיוס · ערוצי פרסום · תמרוץ
//                        ▸ נוכחות: בזמן אמת · דוח חודשי · אישורי שעות · לא התייצבו · שעון נוכחות · מיקום לדיווח
//                        ▸ סידור: שיבוץ אוטומטי · העתק משבוע קודם · פרסום · איפוס · הגדרת משמרות · משמרות לפי מחלקה
//                        ▸ בקשות ואישורים: בקשות הצוות · חופשה · אילוצים · החלפה · מחלה · הצטרפות · שרשרת אישורים
//   💼 ניהול העסק        ▸ דוחות: 🚦 חדר בקרה (Superstar, 14/11) · לוח מכירות · אופטימייזר מגוון · מלאי בשר · טופס ספירת מלאי בשר · פנקס / clearcount
//                        ▸ טפסים ותלושים: מסמכים · תלושים · 101 · 106
//                        ▸ הגדרות ותקשורת: הודעה · לוח הודעות · לוח חגים · הגדרות חברה · חיוב
//                        ▸ תפעול: משימות · ספירת מלאי בשר · 🏪 פתיחת סניף · 🔒 סגירת סניף (Superstar; today's task by name)
//   👤 אזור אישי         the manager's own: החלפת סיסמה · אימות דו-שלבי · ההתראות שלי · Push
// A sub-menu opens with a click on its title (one at a time; the last one opened is remembered); its title shows the
// number of waiting items (the badges of its buttons). The old menus (📍 נוכחות's siblings 📅 סידור, ⚙ אדמין, 🛠 תפעול)
// are emptied and hidden — a button a module adds there later is swept into its sub-menu (SWEEP). Modules show their
// buttons by role on a click of the old ⚙ / 📅 buttons — each menu click and each sign-in fires those (refresh).
// A menu / sub-menu with nothing the signed-in manager may see is not shown.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const NEW = [
    // [menu id, label, after which menu]
    ['menuBiz', '💼 ניהול העסק', 'menuAtt'],
    ['menuMe', '👤 אזור אישי', null],          // last
  ];
  // '§…' = a sub-menu's title
  const PLAN = {
    menuAttDrop: ['§ניהול עובדים', 'empMgr', 'hrMenuBtn', 'meSickBtn', 'meVacBtn', 'rcMgrBtn', 'pubMenuBtn', 'incMgrBtn',
      '§נוכחות', 'liveBtn', 'attBtn', 'haMgrBtn', 'nsMenuBtn', 'clkMenuBtn', 'geoMgrBtn',
      '§סידור', 'autoBtn', 'copyPrev', 'publishBtn', 'resetBtn', 'scMenuBtn', 'sdMenuBtn',
      '§בקשות ואישורים', 'apMgrTeamBtn', 'reqVacBtn', 'reqConsBtn', 'reqSwapBtn', 'sickMgrBtn', 'rgMgrBtn', 'apChainBtn', 'consBtn'],   // consBtn: hidden (all together)
    menuBizDrop: ['§דוחות', 'crMgrBtn', 'sdMgrBtn', 'asMgrBtn', 'miMgrBtn', 'bzMeatCount', 'ccMgrBtn',
      '§טפסים ותלושים', 'dsMgrBtn', 'payBtn', 'f101AdminBtn', 'f106AllBtn',
      '§הגדרות ותקשורת', 'msgBtn', 'annBtn', 'holBtn', 'coSetBtn', 'coBillBtn',
      '§תפעול', 'tkMgrBtn', 'tkMgrMine', 'opMeatCount', 'opOpenBtn', 'opCloseBtn'],
    menuMeDrop: ['mpwBtn', 'mfaMenuBtn', 'myAlertsBtn', 'mgrPushBtn2'],
  };
  // [old menu, new menu, sub-menu] — what is (or later comes) into an old menu goes to the end of that sub-menu
  const SWEEP = [['menuSchedDrop', 'menuAttDrop', 'סידור'], ['menuReqDrop', 'menuAttDrop', 'בקשות ואישורים'],
    ['menuAdminDrop', 'menuBizDrop', 'הגדרות ותקשורת'], ['menuDocsDrop', 'menuBizDrop', 'טפסים ותלושים'], ['menuOpsDrop', 'menuBizDrop', 'תפעול']];
  // the old menus whose buttons show by role when their own button is clicked (the modules listen there)
  const OLD_BTNS = ['menuAdminBtn', 'menuSchedBtn'];
  const KEY = 'mgrSubOpen:';
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };

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
  /** a menu button's label (its arrow / text node kept) */
  function rename(btnId, from, to) {
    const b = $(btnId);
    if (!b) return;
    for (const n of b.childNodes) if (n.nodeType === 3 && n.textContent.includes(from)) n.textContent = n.textContent.replace(from, to);
    if (!b.textContent.includes(to)) b.textContent = b.textContent.replace(from, to);
  }
  function visible(btn) {
    return !btn.classList.contains('hidden') && btn.style.display !== 'none';
  }
  /** the elements of a sub-menu (up to the next title) */
  function partOf(h) {
    const out = [];
    let n = h.nextElementSibling;
    while (n && !n.classList.contains('mgr-sec')) { out.push(n); n = n.nextElementSibling; }
    return out;
  }
  function secTitle(drop, name) {
    return [...drop.querySelectorAll(':scope > .mgr-sec')].find((h) => h.dataset.sec === name);
  }
  const setIf = (el, prop, v) => { if (el.style[prop] !== v) el.style[prop] = v; };

  function syncMenus() {
    for (const [from, to, sec] of SWEEP) {
      const f = $(from), t = $(to);
      if (!f || !t) continue;
      const h = secTitle(t, sec);
      [...f.querySelectorAll(':scope > button')].forEach((x) => {
        if (!h) { t.appendChild(x); return; }
        const part = partOf(h);
        (part.length ? part[part.length - 1] : h).after(x);
      });
    }
    document.querySelectorAll('.mgr-menu').forEach((m) => {
      const drop = m.querySelector('.mgr-dropdown');
      if (!drop) return;
      const any = [...drop.querySelectorAll(':scope > button')].some(visible);
      setIf(m, 'display', any ? '' : 'none');
      const open = store.get(KEY + drop.id);
      drop.querySelectorAll(':scope > .mgr-sec').forEach((h) => {
        const part = partOf(h).filter((x) => x.tagName === 'BUTTON');
        const on = part.some(visible);
        setIf(h, 'display', on ? '' : 'none');
        const isOpen = open === h.dataset.sec;
        if (h.classList.contains('open') !== isOpen) h.classList.toggle('open', isOpen);
        part.forEach((x) => { if (x.classList.contains('mgr-col') === isOpen) x.classList.toggle('mgr-col', !isOpen); });
        // waiting items (the buttons' badges) on the title of a closed sub-menu
        const n = part.filter(visible).reduce((s, x) => s + [...x.querySelectorAll('.ap-badge, .tk-badge, .badge')].reduce((a, b) => a + (parseInt(b.textContent, 10) || 0), 0), 0);
        const badge = h.querySelector('.mgr-sec-n'), txt = n && !isOpen ? String(n) : '';
        if (badge.textContent !== txt) badge.textContent = txt;
      });
    });
  }

  let busy = false;
  function refresh() {
    if (busy) return;
    busy = true;
    for (const id of OLD_BTNS) {
      const a = $(id), d = $(id.replace('Btn', 'Drop'));
      if (!a || !d) continue;
      const was = d.classList.contains('open');
      try { a.dispatchEvent(new MouseEvent('click', { bubbles: false })); } catch (_) {}
      d.classList.toggle('open', was); a.classList.toggle('active', was);
    }
    busy = false;
    syncMenus();
  }
  function hookRefresh() {
    document.addEventListener('click', (ev) => {
      const b = ev.target.closest && ev.target.closest('.mgr-menu-btn');
      if (b && !OLD_BTNS.includes(b.id) && !busy) refresh();
    }, true);
    if (typeof window.setAuthUI === 'function') {
      const orig = window.setAuthUI;
      window.setAuthUI = function () { const r = orig.apply(this, arguments); setTimeout(refresh, 0); return r; };
    }
    refresh();
  }

  function arrange() {
    NEW.forEach(([id, label, after]) => makeMenu(id, label, after));
    rename('menuAttBtn', 'נוכחות', 'עובדים ונוכחות');
    rename('menuAttBtn', '📍', '👥');
    if (!$('mgrSecCss')) document.head.insertAdjacentHTML('beforeend', '<style id="mgrSecCss">' +
      '.mgr-dropdown{max-height:calc(100vh - 120px);overflow-y:auto;min-width:220px}' +
      '.mgr-dropdown .mgr-sec{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:800;color:#1e293b;padding:9px 14px;border-radius:7px;cursor:pointer;white-space:nowrap;user-select:none}' +
      '.mgr-dropdown .mgr-sec:hover{background:#f1f5f9}.mgr-dropdown .mgr-sec .ar{margin-inline-start:auto;color:#94a3b8;font-size:11px;transition:transform .15s}' +
      '.mgr-dropdown .mgr-sec.open{color:#1e40af;background:#eff6ff}.mgr-dropdown .mgr-sec.open .ar{transform:rotate(-90deg)}' +
      '.mgr-dropdown .mgr-sec-n:not(:empty){background:#dc2626;color:#fff;border-radius:99px;padding:0 7px;font-size:11px}' +
      '.mgr-dropdown > button.mgr-col{display:none!important}' +
      '.mgr-dropdown .mgr-sec.open ~ button:not(.mgr-col){padding-inline-start:26px}' +
      '</style>');
    // 🛠 תפעול (Superstar): the meat count form (also among the reports) and the branch's opening / closing (tasks)
    const ops = $('menuOpsDrop');
    if (ops) {
      const meat = [...ops.querySelectorAll('button')].find((x) => /meat-count/.test(x.getAttribute('onclick') || ''));
      if (meat && !meat.id) {
        meat.id = 'opMeatCount';
        const c = meat.cloneNode(true); c.id = 'bzMeatCount'; c.textContent = '🥩 טופס ספירת מלאי בשר';
        meat.after(c);
      }
    }
    if (ops && typeof window.openTaskByTitle === 'function' && !$('opOpenBtn')) {
      ops.insertAdjacentHTML('beforeend', '<button id="opOpenBtn">🏪 פתיחת סניף</button><button id="opCloseBtn">🔒 סגירת סניף</button>');
      $('opOpenBtn').addEventListener('click', () => window.openTaskByTitle(/פתיח/, 'פתיחת סניף'));
      $('opCloseBtn').addEventListener('click', () => window.openTaskByTitle(/סגיר/, 'סגירת סניף'));
    }
    for (const [dropId, ids] of Object.entries(PLAN)) {
      const drop = $(dropId);
      if (!drop) continue;
      for (const bid of ids) {
        if (bid[0] === '§') {
          const h = document.createElement('div');
          h.className = 'mgr-sec'; h.dataset.sec = bid.slice(1); h.setAttribute('role', 'button'); h.tabIndex = 0;
          h.innerHTML = '<span></span><span class="mgr-sec-n"></span><span class="ar">◀</span>';
          h.firstChild.textContent = bid.slice(1);
          const toggle = (ev) => {
            ev.stopPropagation();
            store.set(KEY + dropId, h.classList.contains('open') ? '' : h.dataset.sec);
            syncMenus();
          };
          h.addEventListener('click', toggle);
          h.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(ev); } });
          drop.appendChild(h);
          continue;
        }
        const b = $(bid);
        if (!b) continue;
        const prev = b.previousElementSibling;
        if (prev && prev.tagName === 'HR') prev.remove();   // the separator a module put before its button
        drop.appendChild(b);                                 // in the plan's order
      }
    }
    hookRefresh();
    const mo = new MutationObserver(syncMenus);
    document.querySelectorAll('.mgr-dropdown').forEach((d) => mo.observe(d, { attributes: true, subtree: true, childList: true, characterData: true, attributeFilter: ['class', 'style'] }));
  }
  // every module adds its buttons on DOMContentLoaded (or at once) — this one, loaded last, runs after them
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(arrange, 0)); else setTimeout(arrange, 0);
})();
