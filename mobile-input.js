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

// 06/11/2026 (the owner): times always in 24 hours. A native <input type="time"> follows the phone's / computer's own
// clock setting, so on a 12-hour device the attendance hours showed AM/PM. Every time field (also ones added later)
// becomes a text field that takes HH:MM in 24 hours: digits only, the ":" goes in by itself, "930" / "9" / "9.30"
// become "09:30" / "09:00" on leaving the field. .value stays "HH:MM" (or "") — the code reading it is unchanged.
(function () {
  'use strict';
  document.head.insertAdjacentHTML('beforeend', '<style>input.t24{direction:ltr;text-align:center;font-variant-numeric:tabular-nums}' +
    'input.t24.t24-bad{border-color:#dc2626!important;background:#fef2f2!important}</style>');
  /** "930" → "09:30", "9" → "09:00", "21:5" → "21:05"; '' when empty; null when it is not a time */
  function norm(v) {
    v = String(v || '').trim().replace(/[.,;\s]/g, ':');
    if (!v) return '';
    let h, m;
    const p = v.match(/^(\d{1,2}):(\d{0,2})(?::\d{1,2})?$/);
    if (p) { h = +p[1]; m = p[2] === '' ? 0 : +p[2]; }
    else if (/^\d{1,4}$/.test(v)) { if (v.length <= 2) { h = +v; m = 0; } else { h = +v.slice(0, v.length - 2); m = +v.slice(-2); } }
    else return null;
    if (h > 23 || m > 59) return null;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function conv(el) {
    if (el.dataset.t24) return;
    el.dataset.t24 = '1';
    const v = el.value || el.getAttribute('value') || '';
    el.type = 'text';
    el.classList.add('t24');
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('maxlength', '5');
    el.setAttribute('autocomplete', 'off');
    if (!el.placeholder) el.placeholder = '00:00';
    el.value = norm(v) || v.slice(0, 5);
  }
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches('input[type="time"]')) conv(root);
    root.querySelectorAll && root.querySelectorAll('input[type="time"]').forEach(conv);
  }
  // typing: digits and one ":", the ":" added after two digits of hour
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('t24')) return;
    let v = el.value.replace(/[^\d:]/g, '');
    const i = v.indexOf(':'); if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/:/g, '');
    if (i < 0 && v.length === 3 && ev.inputType !== 'deleteContentBackward') v = v.slice(0, 2) + ':' + v.slice(2);
    if (v !== el.value) el.value = v.slice(0, 5);
    el.classList.remove('t24-bad');
  }, true);
  // leaving the field: the full HH:MM before the page's own change handlers read it (capture runs first)
  function fix(ev) {
    const el = ev.target;
    if (!el.classList || !el.classList.contains('t24')) return;
    const n = norm(el.value);
    if (n === null) {   // not a time (e.g. 25:00) — back to what it was, marked red for a moment
      el.value = el.dataset.t24prev || '';
      el.classList.add('t24-bad'); el.title = 'שעה בפורמט 24 שעות, למשל 08:30 או 17:45';
      setTimeout(() => el.classList.remove('t24-bad'), 2500);
      return;
    }
    el.classList.remove('t24-bad');
    if (n !== el.value) el.value = n;
  }
  document.addEventListener('focusin', (ev) => { const el = ev.target; if (el.classList && el.classList.contains('t24')) el.dataset.t24prev = norm(el.value) || ''; }, true);
  document.addEventListener('change', fix, true);
  document.addEventListener('blur', fix, true);
  scan(document.body);
  new MutationObserver((list) => {
    for (const r of list) {
      if (r.type === 'attributes') { if (r.target.matches && r.target.matches('input[type="time"]')) conv(r.target); }
      else r.addedNodes.forEach(scan);
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['type'] });
})();
