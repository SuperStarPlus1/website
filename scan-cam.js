// 📷 The barcode camera, shared (24/11/2026 — goods receiving, and the orders after it). The same reader as the
// inventory count and the shelf signs: zxing-cpp (zxing-wasm 3.1.6, self-hosted in vendor/; the page's policy allows
// 'wasm-unsafe-eval'). Our own video, a frame every ~90 ms, the middle of the picture (every 4th frame the whole one),
// tryHarder + tryRotate, and the picture turned 25–65° for a diagonal barcode. The stream stays open 60 s between items.
//   ScanCam.start(box, onCode, onErr)  — draws the camera into box; onCode(text) once, then the camera stops (the stream
//                                        is kept 60 s for the next item)
//   ScanCam.stop(keep)                 — keep: keep the stream for the next item
//   ScanCam.photo(onCode, onErr)       — "📸" a photo from the phone's camera app, decoded
//   ScanCam.on()                       — is the camera showing
(function () {
  'use strict';
  const ZX_JS = 'vendor/zxing-reader-3.1.6.js', ZX_WASM = '/vendor/zxing_reader-3.1.6.wasm';
  const ZX_OPTS = { formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128', 'ITF', 'Code39'], tryHarder: true, tryRotate: true, tryInvert: false, tryDownscale: true, maxNumberOfSymbols: 1 };
  const ZX_TURN = [25, 35, 45, 55, 65];
  let zxReady = null, stream = null, streamTimer = null, seq = 0, on = false, box = null;

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.sc-cam{position:relative;border-radius:16px;overflow:hidden;background:#000;margin-bottom:10px}.sc-cam video{display:block;width:100%;height:auto}' +
    '.sc-cam .fr{position:absolute;inset:22% 10% 64px;border:2.5px solid rgba(255,255,255,.85);border-radius:14px;pointer-events:none}' +
    '.sc-camb{display:flex;gap:8px;justify-content:space-between;padding:8px;background:#0b1220}' +
    '.sc-camb button{background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:10px;padding:8px 12px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer}' +
    '</style>');

  function zxLoad() {
    if (zxReady) return zxReady;
    zxReady = new Promise((res, rej) => {
      const go = () => { try { window.ZXingWASM.prepareZXingModule({ overrides: { locateFile: (p, pre) => (p.endsWith('.wasm') ? ZX_WASM : pre + p) }, fireImmediately: true }); } catch (_) {} res(window.ZXingWASM); };
      if (window.ZXingWASM) return go();
      const sc = document.createElement('script'); sc.src = ZX_JS; sc.onload = go; sc.onerror = () => rej(new Error('load')); document.head.appendChild(sc);
    }).catch((x) => { zxReady = null; throw x; });
    return zxReady;
  }
  function turned(src, deg) {
    const w = src.width, h = src.height, d = Math.ceil(Math.hypot(w, h)), k = Math.min(1, 1280 / d);
    const c = document.createElement('canvas'); c.width = c.height = Math.round(d * k);
    const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.translate(c.width / 2, c.height / 2); g.rotate(-deg * Math.PI / 180); g.scale(k, k); g.drawImage(src, -w / 2, -h / 2);
    return g.getImageData(0, 0, c.width, c.height);
  }
  async function zxRead(src) {
    const Z = await zxLoad();
    const r = await Z.readBarcodes(src, ZX_OPTS);
    const ok = (r || []).find((x) => x && x.isValid !== false && x.text);
    return ok ? String(ok.text).trim() : '';
  }
  async function openStream() {
    clearTimeout(streamTimer);
    if (stream && stream.getVideoTracks().some((t) => t.readyState === 'live')) return stream;
    const want = { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } };
    try { stream = await navigator.mediaDevices.getUserMedia({ video: Object.assign({ advanced: [{ focusMode: 'continuous' }] }, want), audio: false }); }
    catch (e1) {
      if (/NotAllowed|Permission|denied|Security/i.test(String((e1 && (e1.name || e1.message)) || e1))) throw e1;
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    }
    return stream;
  }
  function closeStream() { clearTimeout(streamTimer); if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} }); stream = null; }
  const errText = (m) => (/NotAllowed|Permission|denied|Security/i.test(m) ? 'צריך לאשר לאתר גישה למצלמה (בהגדרות הדפדפן ← הרשאות האתר ← מצלמה)'
    : /NotFound|Overconstrained|no camera/i.test(m) ? 'לא נמצאה מצלמה במכשיר — אפשר להקליד ברקוד'
    : 'לא הצלחתי לפתוח את המצלמה — אפשר להקליד ברקוד או להשתמש בסורק');

  async function start(el, onCode, onErr) {
    if (on) stop(true);
    box = el; on = true;
    const my = ++seq;
    box.innerHTML = '<div class="sc-cam"><video playsinline muted autoplay></video><div class="fr"></div><div class="sc-camb"><button type="button" data-snap>📸 לא נקלט? צלמו תמונה</button><button type="button" data-x>✕ סגירה</button></div></div>' +
      '<div style="color:#64748b;font-size:12.5px;margin:-4px 2px 8px">מכוונים את הברקוד למסגרת, כ-15 ס״מ מהטלפון ובאור טוב — גם בזווית.</div>';
    box.querySelector('[data-x]').onclick = () => stop();
    box.querySelector('[data-snap]').onclick = () => photo(onCode, onErr);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no camera');
      const [s] = await Promise.all([openStream(), zxLoad()]);
      if (!on || my !== seq) return;
      const v = box.querySelector('video'); v.srcObject = s; try { await v.play(); } catch (_) {}
      loop(v, my, onCode);
    } catch (err) {
      stop();
      if (onErr) onErr(errText(String((err && (err.name || err.message)) || err || '')));
    }
  }
  function loop(v, my, onCode) {
    const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
    let n = 0, turn = 0;
    const tick = async () => {
      if (!on || my !== seq) return;
      const W = v.videoWidth, H = v.videoHeight;
      if (W && H) {
        const full = (++n % 4) === 0;
        const sw = full ? W : Math.round(W * 0.86), sh = full ? H : Math.round(H * 0.62);
        const k = Math.min(1, 1280 / Math.max(sw, sh));
        cv.width = Math.round(sw * k); cv.height = Math.round(sh * k);
        g.drawImage(v, Math.round((W - sw) / 2), Math.round((H - sh) / 2), sw, sh, 0, 0, cv.width, cv.height);
        let text = '';
        try {
          text = await zxRead(g.getImageData(0, 0, cv.width, cv.height));
          for (let j = 0; j < 2 && !text && on && my === seq; j++) text = await zxRead(turned(cv, ZX_TURN[(turn++) % ZX_TURN.length]));
        } catch (_) {}
        if (text && on && my === seq) { if (navigator.vibrate) try { navigator.vibrate(40); } catch (_) {} stop(true); onCode(text); return; }
      }
      setTimeout(tick, 90);
    };
    tick();
  }
  function photo(onCode, onErr) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
        const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(img.src);
        let text = await zxRead(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height));
        for (const a of ZX_TURN) { if (text) break; text = await zxRead(turned(cv, a)); }
        if (!text) throw new Error('none');
        onCode(text);
      } catch (_) { if (onErr) onErr('לא הצלחתי לקרוא את הברקוד מהתמונה — צלמו קרוב יותר, ישר ובאור טוב, או הקלידו 6 ספרות אחרונות'); }
    };
    stop(); closeStream();   // the phone's camera app needs the camera
    inp.click();
  }
  function stop(keep) {
    on = false; seq++;
    if (box) box.innerHTML = '';
    clearTimeout(streamTimer);
    if (stream) { if (keep) streamTimer = setTimeout(closeStream, 60000); else closeStream(); }
  }
  window.ScanCam = { start, stop, photo, on: () => on };
})();
