// 📒 פנקס והוצאות (11/11/2026, the owner) — the store's business ledger: income, expenses, suppliers, purchasing,
// cash-flow and reports. It is Sidurit's Pinkas / clearcount app (copied to /pinkas/ by Sidurit's
// scripts/sync_pinkas_to_superstar.py) in its "cc" mode, opened here in a window over the portal: it reaches the
// server through this page (window.apiPost + mgrAuth — the admin's sign-in), so it has no sign-in of its own.
// Server: api/clearcount.ts (cc* actions; ccSales — the registers' Z per day for the income). Admin only.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  // read by the app (web/pinkas/js/env.js): the host's name and the app's name here
  window.CC_HOST_NAME = 'סופרסטאר';
  window.CC_BRAND = 'פנקס והוצאות';

  function overlay() {
    if (!$('ccOv')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="ccOv" style="position:fixed;inset:0;z-index:9000;background:#fff;display:none;flex-direction:column">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#0f766e;color:#fff"><b style="font-size:16px">📒 פנקס והוצאות</b>' +
        '<span style="opacity:.85;font-size:13px">ניהול העסק</span><span style="flex:1"></span>' +
        '<button id="ccClose" style="background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer">✕ סגירה</button></div>' +
        '<iframe id="ccFrame" title="פנקס והוצאות" style="flex:1;border:0;width:100%"></iframe></div>');
      $('ccClose').addEventListener('click', () => { $('ccOv').style.display = 'none'; $('ccFrame').src = 'about:blank'; document.body.style.overflow = ''; });
    }
    return $('ccOv');
  }
  async function open() {
    if (!isAdmin()) return;
    const r = await window.apiPost({ action: 'ccOpen', ...(typeof mgrAuth === 'function' ? mgrAuth() : {}) }).catch(() => null);
    if (!r || !r.ok) { if (typeof toast === 'function') toast((r && r.error) || 'אין חיבור', 'err'); return; }
    overlay().style.display = 'flex';
    document.body.style.overflow = 'hidden';
    $('ccFrame').src = '/pinkas/?cc=superstar#/home';
  }
  function start() {
    const drop = $('menuAdminDrop');
    if (!drop || $('ccMgrBtn')) return;
    const anchor = $('asMgrBtn') || $('miMgrBtn') || $('sdMgrBtn');
    const html = '<button id="ccMgrBtn" style="display:none">📒 פנקס והוצאות</button>';
    if (anchor) anchor.insertAdjacentHTML('afterend', html); else drop.insertAdjacentHTML('afterbegin', html);
    $('ccMgrBtn').addEventListener('click', open);
    const show = () => { $('ccMgrBtn').style.display = isAdmin() ? '' : 'none'; };
    $('menuAdminBtn')?.addEventListener('click', show, true);
    show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.openLedger = open;
})();
