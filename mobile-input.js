// Phone keyboard over the fields (same file in the Sidurit template web/app/ and on the Superstar site):
// the windows (.overlay — login, forgot password, registration, forms) were centered with no scrolling, so the keyboard
// hid the field being typed in. Now: a window scrolls, starts at the top on a short screen, its height follows the part
// of the screen the keyboard leaves (visualViewport), and the focused field is brought into view.
(function () {
  'use strict';
  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.overlay{overflow-y:auto!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}' +
    '#loginOverlay{overflow-y:auto!important}' +
    '@media (max-height:700px),(max-width:600px){.overlay{place-items:start center!important;align-content:start}' +
    '.overlay .modal{max-height:none!important;margin:8px 0 40vh}}' +       // room under the window to scroll it above the keyboard
    '</style>');

  const vv = window.visualViewport;
  /** the windows cover only what the keyboard leaves visible (iOS keeps fixed elements full height under the keyboard) */
  function fit() {
    if (!vv) return;
    const h = Math.round(vv.height), top = Math.round(vv.offsetTop);
    document.querySelectorAll('.overlay:not(.hidden)').forEach((o) => { o.style.height = h + 'px'; o.style.top = top + 'px'; o.style.bottom = 'auto'; });
  }
  function reset() { document.querySelectorAll('.overlay').forEach((o) => { o.style.height = ''; o.style.top = ''; o.style.bottom = ''; }); }
  if (vv) {
    vv.addEventListener('resize', () => (vv.height < window.innerHeight - 80 ? fit() : reset()));
    vv.addEventListener('scroll', () => { if (vv.height < window.innerHeight - 80) fit(); });
  }
  // the field being typed in: in view once the keyboard is up
  document.addEventListener('focusin', (ev) => {
    const el = ev.target;
    if (!el || !el.matches || !el.matches('input, textarea, select') || !el.closest('.overlay')) return;
    setTimeout(() => { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { el.scrollIntoView(); } }, 350);
  });
})();
