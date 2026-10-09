// Publishing channels (same file in the Sidurit template web/app/ and on the Superstar site; server:
// _shared/publish-handlers.ts, rules and the waiver's text: _shared/publish-core.ts). Admin only.
//   ⚙ ניהול ← 📣 ערוצי פרסום: (1) the publishing authorization and liability waiver — read, name + role, accept (a new
//   version — accepted again); (2) the channels: Facebook page · Instagram · WordPress · webhook — the details are typed,
//   checked live, sealed on the server and never shown again (only "connected", the page's name, ••••last 4);
//   (3) the company's jobs page and the code to embed it in a website.
// Publishing a job is in the job itself (recruit.js). Uses the app's own globals: apiPost, mgrAuth, state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const when = (d) => { if (!d) return ''; const t = new Date(d); return isNaN(t) ? String(d) : t.toLocaleDateString('he-IL') + ' ' + t.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); };

  // the fields of each channel (all write-only), and where to find them
  const FORM = {
    facebook: { fields: [['pageId', 'מזהה העמוד (Page ID)', 'ltr'], ['accessToken', 'אסימון גישה לעמוד (Page access token)', 'ltr', true]],
      help: 'מזהה העמוד: בעמוד הפייסבוק ← "אודות" ← "שקיפות הדף". אסימון קבוע: Meta Business Suite ← הגדרות העסק ← משתמשי מערכת ← "יצירת אסימון", עם ההרשאות pages_manage_posts ו-pages_read_engagement, ללא תפוגה.' },
    instagram: { fields: [['igUserId', 'מזהה חשבון האינסטגרם (IG user ID)', 'ltr'], ['accessToken', 'אסימון גישה (אותו אסימון של העמוד המקושר)', 'ltr', true]],
      help: 'חשבון אינסטגרם עסקי או של יוצר/ת, מקושר לעמוד הפייסבוק. באסימון צריכות להיות גם ההרשאות instagram_basic ו-instagram_content_publish. באינסטגרם חובה תמונה למשרה.' },
    wordpress: { fields: [['siteUrl', 'כתובת האתר', 'ltr'], ['username', 'שם משתמש', 'ltr'], ['appPassword', 'סיסמת אפליקציה (Application Password)', 'ltr', true], ['categoryId', 'מזהה קטגוריה לפוסטים (לא חובה)', 'ltr']],
      help: 'בניהול האתר: משתמשים ← הפרופיל שלך ← "סיסמאות אפליקציה" ← הוספה. משתמש עם הרשאת מחבר/ת או עורך/ת. כל פרסום יוצר פוסט עם התמונה וכפתור "להגשת מועמדות".' },
    webhook: { fields: [['url', 'כתובת ה-Webhook', 'ltr'], ['secret', 'מפתח חתימה (לפחות 16 תווים)', 'ltr', true]],
      help: 'לאתר שבנוי אצלכם: בכל פרסום נשלחת בקשת POST עם פרטי המשרה (JSON) וכותרת X-Signature: HMAC-SHA256 של הגוף עם המפתח — האתר בודק אותה. גם "ping" בחיבור ו-"job.closed" בהסרה.' },
  };

  function overlay() {
    if (!$('jpOverlay')) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="jpOverlay"><div class="modal" style="max-width:820px">' +
        '<header><h3>📣 ערוצי פרסום</h3><p>פרסום משרות בפייסבוק, באינסטגרם ובאתר החברה · אדמין בלבד</p></header>' +
        '<div class="mbody" id="jpBody"></div><div class="mfoot"><span class="spacer"></span><button class="btn plain" id="jpClose">סגירה</button></div></div></div>');
      $('jpClose').addEventListener('click', () => $('jpOverlay').classList.add('hidden'));
    }
    $('jpOverlay').classList.remove('hidden');
    return $('jpBody');
  }
  let S = null;
  async function open() {
    if (!isAdmin()) { say('אדמין בלבד', 'err'); return; }
    const body = overlay();
    body.innerHTML = '<p class="rc-meta">טוען…</p>';
    const r = await apiPost({ action: 'publishSettings', ...mAuth() });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    S = r; draw();
  }
  function draw() {
    const body = $('jpBody'), ok = S.consent && S.consent.current;
    const text = S.consentText.map(([t, lines]) => '<h4 style="margin:10px 0 3px">' + e(t) + '</h4>' + lines.map((l) => '<p style="margin:3px 0;font-size:13.5px;line-height:1.55">' + e(l) + '</p>').join('')).join('');
    body.innerHTML =
      (!S.keyReady ? '<p class="rc-warn">⚠ מפתח ההצפנה של השרת עדיין לא הוגדר — לא ניתן לחבר ערוצים. (פעולה חד-פעמית של מפעיל המערכת.)</p>' : '') +
      '<details' + (ok ? '' : ' open') + ' style="border:1.5px solid ' + (ok ? '#bbf7d0' : '#fcd34d') + ';border-radius:12px;padding:8px 12px;background:' + (ok ? '#f0fdf4' : '#fffbeb') + '">' +
      '<summary style="cursor:pointer;font-weight:800">' + (ok ? '✓ הרשאת הפרסום וכתב הוויתור אושרו — ' + e(S.consent.signer) + ' · ' + e(when(S.consent.at)) : '1. הרשאת פרסום וכתב ויתור — חובה לפני חיבור ערוצים') + '</summary>' +
      '<div style="max-height:320px;overflow:auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:6px 12px;margin:8px 0">' + text +
      '<p class="rc-meta" style="margin-top:8px">נוסח ' + e(S.version) + '</p></div>' +
      (ok ? '' : (S.consent ? '<p class="rc-warn">הנוסח עודכן מאז האישור הקודם (' + e(S.consent.version) + ') — יש לאשר שוב.</p>' : '') +
        '<div class="rc-f"><label class="wide">שם מלא ותפקיד של המאשר/ת בשם החברה<input id="jpSigner" placeholder="למשל: דנה כהן, מנכ&quot;לית"></label></div>' +
        '<label style="display:flex;gap:8px;align-items:flex-start;margin:8px 0;font-weight:700;font-size:13.5px"><input type="checkbox" id="jpAgree" style="margin-top:3px"> קראתי, אני מוסמך/ת לחייב את החברה, ואני מאשר/ת את ההרשאה ואת כתב הוויתור בשם החברה</label>' +
        '<div class="merr" id="jpCErr"></div><button class="btn primary" id="jpAccept">✍ אישור</button>') + '</details>' +
      '<h4 style="margin:14px 0 6px">2. הערוצים</h4>' +
      S.channels.map((c) => '<div class="rc-card" style="cursor:default" data-c="' + c.channel + '"><div class="t">' + e(c.label) + ' ' +
        (c.connected ? '<span class="rc-st" style="background:#dcfce7;color:#166534">מחובר' + (c.meta.name ? ' — ' + e(c.meta.name) : '') + '</span>' : '<span class="rc-st" style="background:#f3f4f6;color:#4b5563">לא מחובר</span>') + '</div>' +
        (c.connected ? '<div class="rc-meta">' + Object.entries(c.meta).filter(([k]) => k !== 'name').map(([k, v]) => e(k) + ': <span dir="ltr">' + e(v) + '</span>').join(' · ') +
          '<br>חובר ע"י ' + e(c.by) + ' · ' + e(when(c.at)) + (c.lastError ? '<br><span style="color:#b91c1c">שגיאה אחרונה: ' + e(c.lastError) + '</span>' : '') + '</div>' +
          '<div style="display:flex;gap:6px;margin-top:6px"><button class="btn plain" data-test style="font-size:12.5px">🔄 בדיקת חיבור</button><button class="btn plain" data-form style="font-size:12.5px">החלפת פרטים</button>' +
          '<button class="btn plain" data-rm style="font-size:12.5px;color:#b91c1c">ניתוק</button></div>'
          : '<button class="btn plain" data-form style="font-size:12.5px;margin-top:6px"' + (ok && S.keyReady ? '' : ' disabled title="קודם — אישור ההרשאה"') + '>➕ חיבור</button>') +
        '<div data-box></div></div>').join('') +
      '<h4 style="margin:14px 0 6px">3. דף המשרות באתר</h4>' +
      '<p class="rc-meta">כל משרה פעילה מופיעה אוטומטית בדף המשרות של החברה, עם התמונה וכפתור הגשה: <a href="' + e(S.jobsPage) + '" target="_blank" rel="noopener" dir="ltr">' + e(S.jobsPage) + '</a></p>' +
      '<p class="rc-meta">להצגה בתוך אתר החברה — מדביקים את הקוד בעמוד "דרושים":</p><textarea class="rc-in" id="jpEmbed" rows="3" readonly dir="ltr">' + e(S.embed) + '</textarea>' +
      '<button class="btn plain" id="jpCopy" style="font-size:12.5px;margin-top:4px">📋 העתקת הקוד</button>';
    if ($('jpAccept')) $('jpAccept').addEventListener('click', async () => {
      if (!$('jpAgree').checked) { $('jpCErr').textContent = 'יש לסמן את האישור'; return; }
      const r = await apiPost({ action: 'acceptPublishConsent', ...mAuth(), agree: true, signer: $('jpSigner').value, version: S.version, ua: navigator.userAgent });
      if (!r.ok) { $('jpCErr').textContent = r.error || 'שגיאה'; return; }
      say('ההרשאה אושרה ✓', 'ok'); open();
    });
    $('jpCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('jpEmbed').value); say('הקוד הועתק ✓', 'ok'); } catch (_) { $('jpEmbed').select(); } });
    body.querySelectorAll('[data-c]').forEach((card) => {
      const ch = card.dataset.c, box = card.querySelector('[data-box]');
      const fb = card.querySelector('[data-form]');
      if (fb) fb.addEventListener('click', () => {
        const F = FORM[ch];
        box.innerHTML = '<p class="hr-legal" style="font-size:12.5px">' + e(F.help) + '</p><div class="rc-f">' +
          F.fields.map(([k, label, dir, secret]) => '<label' + (F.fields.length % 2 && k === F.fields[F.fields.length - 1][0] ? ' class="wide"' : '') + '>' + e(label) +
            '<input data-k="' + k + '" dir="' + dir + '"' + (secret ? ' type="password" autocomplete="new-password"' : ' autocomplete="off"') + '></label>').join('') + '</div>' +
          '<p class="rc-meta">🔒 הפרטים נבדקים מול ' + e(ch === 'webhook' || ch === 'wordpress' ? 'האתר' : 'Meta') + ', נשמרים מוצפנים, ולא יוצגו שוב לאף אחד.</p>' +
          '<div class="merr" data-err></div><button class="btn primary" data-save style="font-size:12.5px">🔒 בדיקה ושמירה</button>';
        box.querySelector('[data-save]').addEventListener('click', async () => {
          const config = {}; box.querySelectorAll('[data-k]').forEach((i) => { config[i.dataset.k] = i.value; });
          box.querySelector('[data-err]').textContent = 'בודק את החיבור…';
          const r = await apiPost({ action: 'savePublishChannel', ...mAuth(), channel: ch, config });
          box.querySelectorAll('[data-k]').forEach((i) => { i.value = ''; });   // never kept on screen
          if (!r.ok) { box.querySelector('[data-err]').textContent = r.error || 'שגיאה'; return; }
          say('מחובר ✓ ' + (r.name || ''), 'ok'); open();
        });
      });
      const t = card.querySelector('[data-test]');
      if (t) t.addEventListener('click', async () => {
        t.disabled = true; const r = await apiPost({ action: 'testPublishChannel', ...mAuth(), channel: ch }); t.disabled = false;
        say(r.ok ? 'החיבור תקין ✓ ' + (r.name || '') : 'החיבור נכשל: ' + (r.error || ''), r.ok ? 'ok' : 'err');
        if (!r.ok) open();
      });
      const rm = card.querySelector('[data-rm]');
      if (rm) rm.addEventListener('click', async () => {
        if (!confirm('לנתק? פרטי הגישה יימחקו מהמערכת. מומלץ לבטל את ההרשאה גם בהגדרות הפלטפורמה.')) return;
        const r = await apiPost({ action: 'removePublishChannel', ...mAuth(), channel: ch });
        if (r.ok) { say('נותק', 'ok'); open(); }
      });
    });
  }

  function start() {
    const drop = $('menuAdminDrop');
    if (drop && !$('pubMenuBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="pubMenuBtn">📣 ערוצי פרסום</button>');
      $('pubMenuBtn').addEventListener('click', open);
      $('menuAdminBtn')?.addEventListener('click', () => { $('pubMenuBtn').style.display = isAdmin() ? '' : 'none'; }, true);
    }
  }
  window.openPublishSettings = open;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
