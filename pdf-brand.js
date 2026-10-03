// The product's mark on every PDF the app makes (same file in the Sidurit template web/app/ and on the Superstar site):
// the Sidurit logo, "הופק באמצעות מערכת סידורית · sidurit.co.il", and a link to the site.
//   productFooter()            HTML line for a printed report (the print windows open as about:blank — absolute addresses)
//   withPageFooters(html)      the line at the end of every <div class="page"> of a multi-page report
//   stampPdfFooter(pdf, w, h)  jsPDF (the schedule PDF): the line as an image at the foot of every page + a link
// The server's PDFs carry the same line (supabase/functions/_shared/pdf-brand.ts).
(function () {
  'use strict';
  const cfg = window.APP_CONFIG || {};
  const SITE = (cfg.PRODUCT_SITE || 'https://sidurit.co.il').replace(/\/$/, '');
  const LABEL = SITE.replace(/^https?:\/\//, '');
  // the mark: the template serves it at /brand/mark.svg, the Superstar site at /sidurit-mark.svg
  const MARK = location.origin + (window.APP_CONFIG ? '/brand/mark.svg' : '/sidurit-mark.svg');

  function productFooter() {
    return '<div class="sid-foot" style="margin-top:12px;padding-top:6px;border-top:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;' +
      'gap:6px;font-size:10px;color:#6b7280;direction:rtl;font-family:Heebo,Arial,sans-serif">' +
      '<img src="' + MARK + '" alt="" style="height:13px;width:13px">' +
      '<span>הופק באמצעות מערכת <b style="color:#13234A">סידורית</b> · <a href="' + SITE + '" target="_blank" rel="noopener" style="color:#0B8F8A;text-decoration:none;direction:ltr;unicode-bidi:isolate">' + LABEL + '</a></span></div>';
  }

  /** the footer at the end of every page of a report built from <div class="page"> blocks */
  function withPageFooters(html) {
    const parts = String(html).split('<div class="page">');
    return parts.map((p, i) => {
      if (i === 0) return p;
      const end = p.lastIndexOf('</div>');
      return '<div class="page">' + (end < 0 ? p + productFooter() : p.slice(0, end) + productFooter() + p.slice(end));
    }).join('');
  }

  /** the schedule PDF (jsPDF, A4 landscape): the footer line as an image + a clickable link on every page */
  async function stampPdfFooter(pdf, pageW, pageH) {
    if (typeof html2canvas !== 'function') return;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;padding:2px 8px;width:max-content';
    box.innerHTML = productFooter().replace('margin-top:12px;padding-top:6px;border-top:1px solid #e5e7eb;', '');
    document.body.appendChild(box);
    try {
      await Promise.all([...box.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
      const c = await html2canvas(box, { scale: 3, backgroundColor: '#ffffff' });
      const h = 4.2, w = c.width * h / c.height, x = (pageW - w) / 2, y = pageH - h - 2.5;
      const img = c.toDataURL('image/png');
      for (let p = 1; p <= pdf.getNumberOfPages(); p++) {
        pdf.setPage(p);
        pdf.addImage(img, 'PNG', x, y, w, h);
        pdf.link(x, y, w, h, { url: SITE });
      }
    } finally { box.remove(); }
  }

  window.productFooter = productFooter;
  window.withPageFooters = withPageFooters;
  window.stampPdfFooter = stampPdfFooter;
})();
