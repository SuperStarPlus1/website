// The app's touch and motion, in one place (same file in Superstar and Sidurit) — Emil Kowalski's rules:
//   * a button answers the press: scale(.97), 140ms, a strong ease-out curve (never ease-in)
//   * a disabled button looks disabled
//   * a window (overlay) opens with a short fade and a small rise — 180ms; it is opened now and then, so it may move;
//     what is used dozens of times a day (the board, the cells, typing) does not animate
//   * hover effects only where there is a mouse; prefers-reduced-motion turns all of it off
// Only presentation: no screen's structure or behaviour changes.
(function () {
  'use strict';
  const B = '.btn,.tk-btn,.ha-btn,.ap-btn,.rg-btn,.inc-btn,.em-btn';
  document.head.insertAdjacentHTML('beforeend', '<style id="uiPolish">' +
    ':root{--ease-out:cubic-bezier(.23,1,.32,1)}' +
    B.split(',').map((c) => c + ':not(#backHomeFab)').join(',') + '{transition:transform 140ms var(--ease-out),background-color 140ms ease,color 140ms ease,border-color 140ms ease,opacity 140ms ease}' +
    B.split(',').map((c) => c + ':not(#backHomeFab):not(:disabled):active').join(',') + '{transform:scale(.97)}' +
    B.split(',').map((c) => c + ':disabled').join(',') + '{opacity:.55;cursor:not-allowed}' +
    '.overlay:not(.hidden){animation:uiFade 140ms ease}' +
    '.overlay:not(.hidden)>.modal{animation:uiRise 180ms var(--ease-out)}' +
    '@keyframes uiFade{from{opacity:0}}' +
    '@keyframes uiRise{from{opacity:0;transform:translateY(8px) scale(.98)}}' +
    '@media (prefers-reduced-motion:reduce){.overlay:not(.hidden),.overlay:not(.hidden)>.modal{animation:none}' +
      B.split(',').map((c) => c + ':active').join(',') + '{transform:none}}' +
    // the employee's home screen: the week, the filters and the PDF belong to the board — hidden while the home shows,
    // so "כניסה למשמרת" is near the top of the phone (they come back with the board)
    'body:has(#empHome:not(.hidden)) header .weeknav,body:has(#empHome:not(.hidden)) header .hsel,' +
    'body:has(#empHome:not(.hidden)) header #showInactiveWrap,body:has(#empHome:not(.hidden)) header #pdfBtn{display:none!important}' +
    // "add to the home screen": a small chip in the corner, not a big button over the middle of the board
    '.ui-install{position:fixed!important;bottom:16px!important;left:16px!important;right:auto!important;transform:none!important;' +
      'padding:9px 16px!important;font-size:13px!important;box-shadow:0 6px 16px rgba(0,0,0,.18)!important}' +
    '</style>');
  new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.tagName === 'BUTTON' && /הוסף לדף הבית/.test(n.textContent || '')) n.classList.add('ui-install');
  }))).observe(document.body || document.documentElement, { childList: true });
})();
