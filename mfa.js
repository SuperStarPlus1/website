// Two-step verification for managers (same file in the Sidurit template web/app/ and on the Superstar site; server:
// _shared/mfa-handlers.ts, rules: _shared/mfa-core.ts).
//   at sign-in: the app's own login is untouched — apiPost is wrapped: when the server answers "a code is needed"
//   (mfa: 'verify') or "set it up now" (mfa: 'setup' — the company requires it), a window asks for the code / walks the
//   set-up (an Authenticator app by QR code, or a code by e-mail), and the login call resolves with the real answer.
//   "Keep me signed in" → this device is trusted for 30 days (no code); the device's token is kept here per company.
//   👤 אזור אישי ← 🔐 אימות דו-שלבי: status, set up / change, turn off (when allowed), new recovery codes, forget the
//   trusted devices; an admin also sets the company's policy and resets a manager who lost the phone.
// Uses the app's own globals: apiPost, mgrAuth, state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const LOGIN_ACTIONS = ['login', 'mlogin', 'elogin'];
  const isToken = (v) => String(v || '').startsWith('sft1.');
  const devKey = () => 'mfa_dev:' + (window.COMPANY || 'main');
  const devices = () => { try { return JSON.parse(localStorage.getItem(devKey()) || '{}'); } catch (_) { return {}; } };
  const saveDevice = (who, tok) => { try { const d = devices(); d[who] = tok; localStorage.setItem(devKey(), JSON.stringify(d)); } catch (_) { /* private mode */ } };

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '#mfaOverlay{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '#mfaBox{background:#fff;color:#1b2a4a;border-radius:18px;max-width:440px;width:100%;padding:20px 20px 16px;box-shadow:0 30px 80px -20px rgba(0,0,0,.45);max-height:92vh;overflow:auto;direction:rtl}' +
    '#mfaBox h3{margin:0 0 6px;font-size:20px}#mfaBox p{margin:6px 0;font-size:14.5px;line-height:1.55;color:#334155}' +
    '#mfaBox .code{font-size:26px;letter-spacing:.3em;text-align:center;direction:ltr;width:100%;box-sizing:border-box;border:2px solid #cbd5e1;border-radius:12px;padding:10px;margin:10px 0}' +
    '#mfaBox .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}#mfaBox .row .btn{flex:1}' +
    '#mfaBox .opt{display:block;width:100%;text-align:right;border:2px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:12px;margin:8px 0;font:inherit;cursor:pointer}' +
    '#mfaBox .opt b{display:block;font-size:15.5px}#mfaBox .opt span{font-size:13px;color:#64748b}' +
    '#mfaBox .qr{display:flex;justify-content:center;margin:8px 0}#mfaBox .qr svg{width:200px;height:200px}' +
    '#mfaBox .sec{direction:ltr;text-align:center;font-family:monospace;background:#f1f5f9;border-radius:8px;padding:6px;font-size:14px;word-break:break-all}' +
    '#mfaBox .rec{display:grid;grid-template-columns:1fr 1fr;gap:6px;direction:ltr;font-family:monospace;font-size:15px;background:#f8fafc;border:1px dashed #94a3b8;border-radius:10px;padding:10px;margin:8px 0}' +
    '#mfaBox .err{color:#b91c1c;font-weight:700;min-height:18px;font-size:13.5px}#mfaBox .link{background:none;border:0;color:#0b8f8a;font:inherit;font-size:13.5px;cursor:pointer;text-decoration:underline;padding:4px 0}' +
    '.mfa-st{display:inline-block;border-radius:99px;padding:2px 10px;font-size:12.5px;font-weight:800}' +
    '</style>');

  /* ---------- the window ---------- */
  function box(html) {
    let o = $('mfaOverlay');
    if (!o) { document.body.insertAdjacentHTML('beforeend', '<div id="mfaOverlay"><div id="mfaBox" role="dialog" aria-modal="true"></div></div>'); o = $('mfaOverlay'); }
    $('mfaBox').innerHTML = html;
    const inp = $('mfaBox').querySelector('input.code');
    if (inp) setTimeout(() => inp.focus(), 50);
    return $('mfaBox');
  }
  const closeBox = () => { const o = $('mfaOverlay'); if (o) o.remove(); };
  const codeInput = (ph) => '<input class="code" id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="' + (ph || '••••••') + '">';
  const onEnter = (fn) => { const i = $('mfaCode'); if (i) i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') fn(); }); };
  const busy = (b, on) => { if (b) { b.disabled = on; } };
  function recoveryScreen(codes, done) {
    box('<h3>🔑 קודי שחזור</h3><p>אם הטלפון יאבד, אפשר להיכנס עם אחד הקודים האלה (כל קוד פעם אחת). <b>שמרו אותם במקום בטוח</b> — הם לא יוצגו שוב.</p>' +
      '<div class="rec">' + codes.map((c) => '<span>' + e(c) + '</span>').join('') + '</div>' +
      '<div class="row"><button class="btn plain" id="mfaCopy">📋 העתקה</button><button class="btn plain" id="mfaSaveTxt">⬇ שמירה לקובץ</button></div>' +
      '<div class="row"><button class="btn primary" id="mfaRecOk">שמרתי — המשך</button></div>');
    $('mfaCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(codes.join('\n')); say('הועתק ✓', 'ok'); } catch (_) { /* no clipboard */ } });
    $('mfaSaveTxt').addEventListener('click', () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([codes.join('\r\n')], { type: 'text/plain' })); a.download = 'קודי-שחזור.txt';
      document.body.appendChild(a); a.click(); a.remove();
    });
    $('mfaRecOk').addEventListener('click', done);
  }

  /** the set-up: an app (QR / "add on this phone") or e-mail. challenge: from the sign-in, or null (the personal area) */
  function setup(ch, hasEmail, emailHint, intro, finish, cancel) {
    box('<h3>🔐 הגדרת אימות דו-שלבי</h3><p>' + e(intro) + '</p><p>בוחרים איך לקבל את הקוד בכל כניסה:</p>' +
      '<button class="opt" id="mfaTotp"><b>📱 אפליקציית אימות (מומלץ)</b><span>Google Authenticator או Microsoft Authenticator — עובד גם בלי אינטרנט</span></button>' +
      (hasEmail ? '<button class="opt" id="mfaMail"><b>✉ קוד במייל</b><span>נשלח ל-' + e(emailHint) + ' בכל כניסה</span></button>' : '<p class="rc-meta">קוד במייל — אפשרי רק אחרי שמוסיפים כתובת מייל למשתמש.</p>') +
      '<div class="err" id="mfaErr"></div><button class="link" id="mfaCancel">ביטול</button>');
    $('mfaCancel').addEventListener('click', cancel);
    const start = async (method) => {
      $('mfaErr').textContent = 'רגע…';
      const r = await apiPost(Object.assign({ action: 'mfaSetupStart', method }, ch ? { challenge: ch } : mAuth()));
      if (!r.ok) { $('mfaErr').textContent = r.error || 'שגיאה'; if (r.expired) setTimeout(cancel, 1500); return; }
      const cid = r.challenge;
      if (method === 'totp') {
        box('<h3>📱 חיבור אפליקציית האימות</h3>' +
          '<p>1. מתקינים בטלפון <b>Google Authenticator</b> או <b>Microsoft Authenticator</b> (חינם).</p>' +
          '<p>2. באפליקציה לוחצים <b>+</b> וסורקים את הקוד:</p><div class="qr">' + r.qr + '</div>' +
          '<p style="text-align:center"><a class="btn plain" href="' + e(r.uri) + '" style="font-size:13px">📲 הוספה לאפליקציה בטלפון הזה</a></p>' +
          '<p class="rc-meta">אי אפשר לסרוק? מקלידים באפליקציה את המפתח:</p><div class="sec">' + e(r.secret) + '</div>' +
          '<p>3. מקלידים את הקוד בן 6 הספרות שמופיע באפליקציה:</p>' + codeInput() + '<div class="err" id="mfaErr"></div>' +
          '<div class="row"><button class="btn primary" id="mfaOk">אישור</button></div><button class="link" id="mfaBack">→ חזרה</button>');
      } else {
        box('<h3>✉ קוד במייל</h3><p>שלחנו קוד בן 6 ספרות אל <b>' + e(r.emailHint) + '</b>. מקלידים אותו כאן:</p>' + codeInput() + '<div class="err" id="mfaErr"></div>' +
          '<div class="row"><button class="btn primary" id="mfaOk">אישור</button></div><button class="link" id="mfaBack">→ חזרה</button> <button class="link" id="mfaResend">שליחה חוזרת</button>');
        $('mfaResend').addEventListener('click', async () => { const x = await apiPost({ action: 'mfaResend', challenge: cid }); say(x.ok ? 'נשלח קוד חדש' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); });
      }
      $('mfaBack').addEventListener('click', () => setup(ch, hasEmail, emailHint, intro, finish, cancel));
      const ok = async () => {
        const b = $('mfaOk'); busy(b, true); $('mfaErr').textContent = '';
        const x = await apiPost(Object.assign({ action: 'mfaSetupConfirm', challenge: cid, code: $('mfaCode').value }, ch ? {} : { keepToken: mAuth().password }));
        busy(b, false);
        if (!x.ok && !x.role && !x.name) { $('mfaErr').textContent = x.error || 'שגיאה'; if (x.expired) setTimeout(cancel, 1500); return; }
        if (x.recoveryCodes && x.recoveryCodes.length) recoveryScreen(x.recoveryCodes, () => finish(x)); else finish(x);
      };
      $('mfaOk').addEventListener('click', ok); onEnter(ok);
    };
    $('mfaTotp').addEventListener('click', () => start('totp'));
    if ($('mfaMail')) $('mfaMail').addEventListener('click', () => start('email'));
  }

  /** the sign-in asked for two-step → the real sign-in answer (or a cancel) */
  function runLogin(r, body, who) {
    return new Promise((resolve) => {
      const cancel = () => { closeBox(); resolve({ ok: false, error: 'הכניסה בוטלה' }); };
      const done = (x) => { closeBox(); if (x.mfaDevice) saveDevice(who, x.mfaDevice); delete x.mfaDevice; delete x.recoveryCodes; delete x.mfaEnabled; resolve(x); };
      if (r.mfa === 'setup') {
        setup(r.challenge, r.hasEmail, r.emailHint, 'לכניסת מנהלים נדרש אימות דו-שלבי: אחרי הסיסמה — גם קוד חד-פעמי. זה לוקח דקה, פעם אחת.', done, cancel);
        return;
      }
      const draw = (recovery) => {
        box('<h3>🔐 אימות דו-שלבי</h3>' +
          (recovery ? '<p>מקלידים אחד מקודי השחזור ששמרתם (למשל abcd-efgh):</p>' + codeInput('xxxx-xxxx')
            : r.method === 'email' ? '<p>שלחנו קוד בן 6 ספרות אל <b>' + e(r.emailHint) + '</b>.</p>' + codeInput()
            : '<p>מקלידים את הקוד בן 6 הספרות מאפליקציית האימות.</p>' + codeInput()) +
          '<div class="err" id="mfaErr"></div><div class="row"><button class="btn primary" id="mfaOk">כניסה</button></div>' +
          (r.method === 'email' && !recovery ? '<button class="link" id="mfaResend">שליחה חוזרת</button> ' : '') +
          (r.recovery && !recovery ? '<button class="link" id="mfaRec">אין גישה לטלפון? קוד שחזור</button> ' : '') +
          (recovery ? '<button class="link" id="mfaRecBack">→ חזרה לקוד מהאפליקציה</button> ' : '') +
          '<button class="link" id="mfaCancel">ביטול</button>' +
          (body.remember !== false ? '<p class="rc-meta" style="margin-top:6px">המכשיר הזה ייזכר ל-30 יום ("השאר אותי מחובר").</p>' : ''));
        $('mfaCancel').addEventListener('click', cancel);
        if ($('mfaResend')) $('mfaResend').addEventListener('click', async () => { const x = await apiPost({ action: 'mfaResend', challenge: r.challenge }); say(x.ok ? 'נשלח קוד חדש' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); });
        if ($('mfaRec')) $('mfaRec').addEventListener('click', () => draw(true));
        if ($('mfaRecBack')) $('mfaRecBack').addEventListener('click', () => draw(false));
        const ok = async () => {
          const b = $('mfaOk'); busy(b, true); $('mfaErr').textContent = '';
          const x = await apiPost({ action: 'mfaVerify', challenge: r.challenge, code: $('mfaCode').value, trust: body.remember !== false });
          busy(b, false);
          if (x.ok || x.role || x.name) { done(x); return; }
          $('mfaErr').textContent = x.error || 'שגיאה';
          if (x.expired) setTimeout(cancel, 1800);
        };
        $('mfaOk').addEventListener('click', ok); onEnter(ok);
      };
      draw(false);
    });
  }

  /* ---------- wrapping the app's apiPost ---------- */
  function wrap() {
    const orig = window.apiPost;
    if (typeof orig !== 'function' || orig._mfa) return;
    const wrapped = async function (body) {
      const isLogin = body && LOGIN_ACTIONS.includes(body.action) && body.password && !isToken(body.password);
      const who = String((body && (body.username || body.mname)) || '').toLowerCase();
      if (isLogin) { const d = devices()[who]; if (d) body = Object.assign({}, body, { mfaDevice: d }); }
      const r = await orig.apply(this, [body]);
      if (isLogin && r && r.mfa && r.challenge) return await runLogin(r, body, who);
      return r;
    };
    wrapped._mfa = true;
    window.apiPost = wrapped;
    try { apiPost = wrapped; } catch (_) { /* a const in this page — the window property is enough */ }
  }
  wrap();

  /* ---------- the personal area ---------- */
  function overlay() {
    if (!$('mfaPOverlay')) {
      document.body.insertAdjacentHTML('beforeend', '<div class="overlay hidden" id="mfaPOverlay"><div class="modal" style="max-width:620px">' +
        '<header><h3>🔐 אימות דו-שלבי</h3><p>קוד חד-פעמי בכל כניסה, בנוסף לסיסמה</p></header><div class="mbody" id="mfaPBody"></div>' +
        '<div class="mfoot"><span class="spacer"></span><button class="btn plain" id="mfaPClose">סגירה</button></div></div></div>');
      $('mfaPClose').addEventListener('click', () => $('mfaPOverlay').classList.add('hidden'));
    }
    $('mfaPOverlay').classList.remove('hidden');
    return $('mfaPBody');
  }
  let S = null;
  async function open() {
    const body = overlay();
    body.innerHTML = '<p class="rc-meta">טוען…</p>';
    const r = await apiPost({ action: 'mfaStatus', ...mAuth() });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    S = r; draw();
  }
  function draw() {
    const on = !!S.method;
    const st = on ? '<span class="mfa-st" style="background:#dcfce7;color:#166534">✓ פעיל — ' + (S.method === 'totp' ? 'אפליקציית אימות' : 'קוד במייל (' + e(S.emailHint) + ')') + '</span>'
      : '<span class="mfa-st" style="background:#fee2e2;color:#991b1b">כבוי</span>';
    $('mfaPBody').innerHTML = '<p>מצב: ' + st + (S.required ? ' <span class="rc-meta">· חובה לתפקיד שלך בחברה</span>' : '') + '</p>' +
      (on && S.method === 'totp' ? '<p class="rc-meta">קודי שחזור שנותרו: ' + S.recoveryLeft + '</p>' : '') +
      (on ? '<p class="rc-meta">מכשירים מוכרים (בלי קוד עד 30 יום): ' + S.devices + '</p>' : '') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">' +
      '<button class="btn primary" id="mfaPSet">' + (on ? '🔄 החלפת שיטה' : '🔐 הפעלה') + '</button>' +
      (on && S.method === 'totp' ? '<button class="btn plain" id="mfaPRec">🔑 קודי שחזור חדשים</button>' : '') +
      (on && S.devices ? '<button class="btn plain" id="mfaPDev">שכחת המכשירים המוכרים</button>' : '') +
      (on && !S.required ? '<button class="btn plain" id="mfaPOff" style="color:#b91c1c">ביטול</button>' : '') + '</div>' +
      (S.isAdmin ? '<h4 style="margin:16px 0 6px">מדיניות החברה</h4><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><select class="rc-in" id="mfaPol" style="max-width:340px">' +
        Object.entries(S.policies).map(([k, v]) => '<option value="' + k + '"' + (k === S.policy ? ' selected' : '') + '>' + e(v) + '</option>').join('') + '</select>' +
        '<button class="btn plain" id="mfaPolSave">שמירה</button></div>' +
        '<p class="rc-meta">מי שחייב ועוד לא הגדיר — יתבקש להגדיר בכניסה הבאה (וינותק מהמכשירים).</p>' +
        '<h4 style="margin:14px 0 6px">המנהלים</h4>' + (S.managers || []).map((x) => '<div class="rc-doc"><span>' + e(x.name) + ' <span class="rc-meta">' + e(x.role) + (x.branch ? ' · ' + e(x.branch) : '') + '</span></span>' +
          (x.method ? '<span class="mfa-st" style="background:#dcfce7;color:#166534">' + (x.method === 'totp' ? 'אפליקציה' : 'מייל') + '</span>'
            : x.required ? '<span class="mfa-st" style="background:#fef9c3;color:#854d0e">יגדיר בכניסה הבאה</span>' : '<span class="mfa-st" style="background:#f1f5f9;color:#475569">כבוי</span>') +
          (x.method && x.name !== mAuth().mname ? ' <button class="btn plain" data-reset="' + e(x.name) + '" style="font-size:12px;padding:3px 9px">איפוס</button>' : '') + '</div>').join('') +
        '<p class="rc-meta">"איפוס" — למנהל שאיבד את הטלפון: האימות שלו נמחק, והוא מגדיר מחדש בכניסה הבאה.</p>' : '');
    $('mfaPSet').addEventListener('click', () => setup(null, S.hasEmail, S.emailHint, on ? 'החלפת שיטת האימות.' : 'הוספת שכבת הגנה לחשבון המנהל שלך.',
      (x) => { closeBox(); say('האימות הדו-שלבי הופעל ✓', 'ok'); open(); }, () => { closeBox(); }));
    const confirmCode = (title, action, after) => async () => {
      const r = await apiPost({ action: 'mfaManageStart', ...mAuth() });
      if (!r.ok) { say(r.error || 'שגיאה', 'err'); return; }
      box('<h3>' + e(title) + '</h3><p>' + (r.method === 'email' ? 'שלחנו קוד אל <b>' + e(r.emailHint) + '</b>.' : 'מקלידים את הקוד מאפליקציית האימות.') + '</p>' + codeInput() +
        '<div class="err" id="mfaErr"></div><div class="row"><button class="btn primary" id="mfaOk">אישור</button></div><button class="link" id="mfaCancel">ביטול</button>');
      $('mfaCancel').addEventListener('click', closeBox);
      const ok = async () => {
        const x = await apiPost({ action, ...mAuth(), challenge: r.challenge, code: $('mfaCode').value });
        if (!x.ok) { $('mfaErr').textContent = x.error || 'שגיאה'; return; }
        after(x);
      };
      $('mfaOk').addEventListener('click', ok); onEnter(ok);
    };
    if ($('mfaPOff')) $('mfaPOff').addEventListener('click', confirmCode('ביטול אימות דו-שלבי', 'mfaDisable', () => { closeBox(); say('האימות הדו-שלבי בוטל', 'ok'); open(); }));
    if ($('mfaPRec')) $('mfaPRec').addEventListener('click', confirmCode('קודי שחזור חדשים', 'mfaRecoveryNew', (x) => recoveryScreen(x.recoveryCodes, () => { closeBox(); open(); })));
    if ($('mfaPDev')) $('mfaPDev').addEventListener('click', async () => { const x = await apiPost({ action: 'mfaForgetDevices', ...mAuth() }); if (x.ok) { say('המכשירים נשכחו — בכניסה הבאה יידרש קוד', 'ok'); open(); } });
    if ($('mfaPolSave')) $('mfaPolSave').addEventListener('click', async () => {
      const p = $('mfaPol').value;
      if (!S.method && (p === 'all' || p === 'admins')) { say('קודם מפעילים אימות דו-שלבי לעצמך (למעלה), ואז קובעים חובה', 'err'); return; }
      const x = await apiPost({ action: 'mfaSetPolicy', ...mAuth(), policy: p });
      if (!x.ok) { say(x.error || 'שגיאה', 'err'); return; }
      say('המדיניות נשמרה ✓' + (x.signedOut ? ' — ' + x.signedOut + ' מנהלים יגדירו בכניסה הבאה' : ''), 'ok'); open();
    });
    $('mfaPBody').querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('לאפס את האימות הדו-שלבי של ' + b.dataset.reset + '? הוא ינותק ויגדיר מחדש בכניסה הבאה.')) return;
      const x = await apiPost({ action: 'mfaResetManager', ...mAuth(), manager: b.dataset.reset });
      say(x.ok ? 'אופס ✓' : (x.error || 'שגיאה'), x.ok ? 'ok' : 'err'); if (x.ok) open();
    }));
  }

  function start() {
    wrap();   // in case the app defined apiPost after this file
    const drop = $('menuMeDrop') || $('menuAdminDrop');
    if (drop && !$('mfaMenuBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="mfaMenuBtn">🔐 אימות דו-שלבי</button>');
      $('mfaMenuBtn').addEventListener('click', open);
    }
  }
  window.openMfaSettings = open;
  window.__mfaRunLogin = runLogin;   // the guide's screenshots (scripts/guides/guide_shots.py)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
