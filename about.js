// The help icon (ⓘ) in the header's corner: the system's version, its last update date, what's new and the user guide.
// Same file in shiftfloo web/app/ and on the Superstar site. The data comes from version.js (one per system):
//   window.APP_VERSION = { name, version, date, notes: [...], guide }
// On each release: update version.js and bump the service worker's CACHE.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function guideUrl(v) {
    const g = $('guideBtn');
    if (g && !g.classList.contains('hidden') && g.getAttribute('href') && g.getAttribute('href') !== '#') return g.getAttribute('href');
    return v.guide || '';
  }

  function build() {
    const v = window.APP_VERSION || {};
    const brand = document.querySelector('body > header .brand') || document.querySelector('header .brand');
    if (!brand || $('aboutBtn')) return;
    const style = document.createElement('style');
    style.textContent =
      '#aboutBtn{width:26px;height:26px;border-radius:50%;border:1.5px solid rgba(255,255,255,.55);background:transparent;color:#fff;' +
        'font:700 14px/1 Georgia,serif;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;margin-inline-start:4px}' +
      '#aboutBtn:hover,#aboutBtn[aria-expanded="true"]{background:rgba(255,255,255,.18)}' +
      '#aboutPop{position:fixed;top:56px;inset-inline-start:12px;z-index:200;width:min(340px,calc(100vw - 24px));background:#fff;color:#0f172a;' +
        'border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.28);padding:14px 16px;font-size:13.5px;line-height:1.55;direction:rtl;text-align:right}' +
      '#aboutPop h4{margin:0 0 2px;font-size:15px}#aboutPop .ver{display:flex;gap:14px;flex-wrap:wrap;color:#475569;font-size:12.5px;margin-bottom:8px}' +
      '#aboutPop .ver b{color:#0f172a}#aboutPop ul{margin:4px 0 10px;padding-inline-start:18px;max-height:40vh;overflow:auto}#aboutPop li{margin:2px 0}' +
      '#aboutPop .acts{display:flex;gap:8px;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;padding-top:9px}' +
      '#aboutPop a{color:#1d4ed8;font-weight:600;text-decoration:none}#aboutPop .x{border:0;background:#f1f5f9;border-radius:8px;padding:5px 12px;cursor:pointer;font:inherit}';
    document.head.appendChild(style);
    brand.insertAdjacentHTML('beforeend', '<button type="button" id="aboutBtn" title="עזרה ומידע על הגרסה" aria-label="עזרה ומידע על הגרסה" aria-expanded="false" aria-controls="aboutPop">i</button>');
    document.body.insertAdjacentHTML('beforeend', '<div id="aboutPop" role="dialog" aria-label="מידע על המערכת" hidden></div>');

    // the login window covers the header: a small version line at its bottom opens the same panel
    const login = document.querySelector('#loginOverlay .modal');
    if (login && v.version) login.insertAdjacentHTML('beforeend',
      '<div style="text-align:center;padding:0 0 12px"><button type="button" id="aboutLoginBtn" style="border:0;background:none;color:#94a3b8;font:inherit;font-size:11.5px;cursor:pointer">' +
      'ⓘ גרסה ' + esc(v.version) + (v.date ? ' · ' + esc(v.date) : '') + '</button></div>');

    const btn = $('aboutBtn'), pop = $('aboutPop');
    let opener = btn;
    const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    const toggle = (e) => {
      e.stopPropagation();
      opener = e.currentTarget;
      if (!pop.hidden) { close(); return; }
      const guide = guideUrl(v);
      pop.innerHTML =
        '<h4>' + esc(v.name || document.title) + '</h4>' +
        '<div class="ver"><span>גרסה <b>' + esc(v.version || '—') + '</b></span><span>עדכון אחרון <b>' + esc(v.date || '—') + '</b></span></div>' +
        (v.notes && v.notes.length ? '<div><b>מה חדש בגרסה ' + esc(v.version) + '</b></div><ul>' + v.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '') +
        '<div class="acts">' + (guide ? '<a href="' + esc(guide) + '" target="_blank" rel="noopener">📖 מדריך למשתמש</a>' : '<span></span>') +
        '<button type="button" class="x">סגירה</button></div>';
      pop.querySelector('.x').addEventListener('click', close);
      const r = opener.getBoundingClientRect();
      pop.style.top = opener === btn ? Math.round(r.bottom + 8) + 'px' : '56px';
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    };
    btn.addEventListener('click', toggle);
    if ($('aboutLoginBtn')) $('aboutLoginBtn').addEventListener('click', toggle);
    document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { close(); opener.focus(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
