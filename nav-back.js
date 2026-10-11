// "סגירה" goes one step back (same file in Superstar and Sidurit). A window that shows a step inside it (a candidate's
// card inside the candidates list, editing a task inside the tasks list, a letter inside the employee card, …) marks
// that step's back button with data-back. Closing such a window — its "סגירה" button or a click outside it — then goes
// back one step instead of closing everything; at the first step it closes as before.
// The hours editor opened from "✏ עריכת שעות" goes back to the employee list (scripts/nav_back_pairs.py).
(function () {
  'use strict';
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    if (!t || !t.closest) return;
    const closer = t.closest('[data-close]');
    const ov = closer ? closer.closest('.overlay') : (t.classList.contains('overlay') ? t : null);   // the button, or the backdrop
    if (!ov || ov.classList.contains('hidden')) return;
    const back = [...ov.querySelectorAll('[data-back]')].find((b) => b.offsetParent !== null && !b.disabled);
    if (!back) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    back.click();
  }, true);
})();
