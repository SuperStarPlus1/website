// Pinkas — the entrance screens (a full-screen layer over the app):
//   first open: standalone (this device only, a password) or an online account (two-step verification required)
//   standalone: the password that opens the app on this device (PBKDF2 hash in localStorage — a lock, nothing leaves)
//   online: sign-up (store, e-mail, password) → the authenticator app (QR) → recovery codes; sign-in: password → code
import { S, dev, hasData, wipeAll, queueAll, saveSettings } from './store.js';
import { e } from './ui.js';
import { call } from './cloud.js';
import { deviceCode, licenseState, activate, refreshLicense } from './license.js';

const enc = new TextEncoder();
const b64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u)));
async function pbkdf2(pw, salt, iter) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)), iterations: iter }, k, 256));
}
export async function setLocalPassword(pw) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16))), iter = 200000;
  dev.set('lock', { salt, iter, hash: await pbkdf2(pw, salt, iter) });
}
export async function checkLocalPassword(pw) {
  const l = dev.get('lock');
  return !!l && (await pbkdf2(pw, l.salt, l.iter)) === l.hash;
}
export const pwProblem = (pw) => (pw.length < 6 ? 'לפחות 6 תווים' : null);
export const cloudPwProblem = (pw) => (pw.length < 10 ? 'סיסמה לחשבון מקוון — לפחות 10 תווים' : null);

/* ---------------- the layer ---------------- */
let layer = null;
function show(html) {
  if (!layer) { layer = document.createElement('div'); layer.id = 'gate'; document.body.appendChild(layer); }
  layer.innerHTML = `<div class="gate-card"><div class="gate-brand"><img src="icon.svg" alt=""><div><b>פנקס</b><small>ניהול הכנסות והוצאות לעסק</small></div></div>${html}</div>`;
  const f = layer.querySelector('input'); if (f) setTimeout(() => f.focus(), 30);
  return layer;
}
function close() { if (layer) { layer.remove(); layer = null; } }
const $g = (sel) => layer.querySelector(sel);
const err = (t) => { const x = $g('.gerr'); if (x) x.textContent = t || ''; };
const busy = (b, on, label) => { b.disabled = on; if (label) b.textContent = label; };
const device = () => (navigator.userAgentData?.platform || navigator.platform || '') + ' · ' + (/Mobi/.test(navigator.userAgent) ? 'נייד' : 'מחשב');

/** first open on this device */
export function welcome() {
  return new Promise((done) => {
    show(`<h2>איך עובדים עם פנקס?</h2>
      ${hasData() ? '<p class="gnote">יש כבר מידע במכשיר הזה — הוא נשאר.</p>' : ''}
      <button class="gopt" id="gLocal"><b>📱 עצמאי — רק במכשיר הזה</b><small>בלי אינטרנט ובלי חשבון. נכנסים עם סיסמה. גיבוי — קובץ / דרייב.</small></button>
      <button class="gopt" id="gCloud"><b>☁ חשבון מקוון</b><small>המידע מגובה בשרת ומסונכרן בין הטלפון למחשב, קליטת חשבוניות מצילום. כניסה עם סיסמה + קוד מאפליקציית אימות (חובה).</small></button>
      <p class="gnote">אפשר לעבור מעצמאי לחשבון מקוון מאוחר יותר, בהגדרות.</p>`);
    $g('#gLocal').onclick = async () => { await ensureLicense(); localSetup(done); };
    $g('#gCloud').onclick = () => cloudStart(done, hasData() ? 'move' : 'new');
  });
}

/* ---------------- standalone: the activation code ---------------- */
const STATUS_TEXT = {
  none: 'כדי להשתמש בפנקס במכשיר הזה צריך <b>קוד הפעלה</b>.',
  invalid: 'קוד ההפעלה השמור לא תקין — צריך קוד חדש.',
  otherDevice: 'קוד ההפעלה שייך למכשיר אחר — צריך קוד למכשיר הזה.',
  revoked: 'קוד ההפעלה בוטל.',
  expired: 'תוקף קוד ההפעלה הסתיים.',
  needsOnline: 'כדי להמשיך לעבוד, הפנקס צריך <b>להתחבר לאינטרנט</b> לאימות הרישיון (פעם בחודש). מתחברים ולוחצים "בדיקה מול השרת".',
};
/** a code from the activation link (#/activate/PK1… or ?act=PK1…) */
function codeFromUrl() {
  const m = /(PK1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/.exec(decodeURIComponent(location.hash + ' ' + location.search));
  return m ? m[1] : '';
}
/** until this device has a good code: the device code to send, a place for the code; an expired / revoked one —
 *  the data can still be taken out (a backup file) */
export async function ensureLicense() {
  await refreshLicense().catch(() => {});
  const fromUrl = codeFromUrl();
  if (fromUrl) { if (!(await activate(fromUrl))) await refreshLicense(true).catch(() => {}); history.replaceState(null, '', location.pathname + '#/home'); }
  let st = await licenseState();
  while (st.status !== 'ok') {
    await activationScreen(st);
    st = await licenseState();
  }
  return st;
}
function activationScreen(st) {
  return new Promise(async (done) => {
    const dc = await deviceCode();
    const msg = 'שלום, אני מבקש/ת קוד הפעלה לפנקס. קוד המכשיר: ' + dc;
    show(`<h2>🔑 הפעלת פנקס</h2><p>${STATUS_TEXT[st.status] || STATUS_TEXT.none}${st.p && st.status === 'expired' ? ' (' + e(st.p.e.split('-').reverse().join('/')) + ')' : ''}</p>
      <p class="gnote">שולחים את <b>קוד המכשיר</b> לספק התוכנה, ומקבלים קוד הפעלה (או קישור הפעלה).</p>
      <div class="devcode"><code dir="ltr">${e(dc)}</code><button class="btn" id="gCopy" type="button">📋 העתקה</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">💬 וואטסאפ</a></div>
      <form id="gf"><label>קוד הפעלה<textarea name="code" rows="3" dir="ltr" placeholder="PK1.…"></textarea></label><div class="gerr"></div><button class="btn primary wide">הפעלה</button></form>
      ${st.status === 'expired' || st.status === 'revoked' || st.status === 'needsOnline' ? '<p class="gnote">המידע שלכם לא נמחק. אפשר להוריד אותו כקובץ גיבוי: <button class="link" id="gBk" type="button" style="display:inline">⬇ הורדת גיבוי</button></p>' : ''}
      <button class="link" id="gNet" type="button">⟳ בדיקה מול השרת (אם הקוד הוארך)</button>`);
    $g('#gCopy').onclick = async () => { try { await navigator.clipboard.writeText(dc); $g('#gCopy').textContent = '✓ הועתק'; } catch { /* */ } };
    const bk = $g('#gBk');
    if (bk) bk.onclick = async () => { const { downloadBackup } = await import('./backup.js'); await downloadBackup(); };
    $g('#gNet').onclick = async () => { await refreshLicense(true).catch(() => {}); const n = await licenseState(); if (n.status === 'ok') { close(); done(); } else err(navigator.onLine ? 'אין קוד חדש — צריך לפנות לספק' : 'אין חיבור לאינטרנט'); };
    $g('#gf').onsubmit = async (ev) => {
      ev.preventDefault();
      const why = await activate(ev.target.code.value);
      if (why) return err(why);
      await refreshLicense(true).catch(() => {});   // the monthly permit right away, when online
      close(); done();
    };
  });
}

/* ---------------- standalone ---------------- */
function localSetup(done) {
  show(`<h2>📱 סיסמה לפנקס במכשיר הזה</h2><p class="gnote">בכל פתיחה מקלידים אותה. אין דרך לשחזר סיסמה שנשכחה — רק לשחזר מקובץ גיבוי.</p>
    <form id="gf"><label>סיסמה<input type="password" name="p1" autocomplete="new-password"></label><label>שוב<input type="password" name="p2" autocomplete="new-password"></label>
    <div class="gerr"></div><button class="btn primary wide">המשך</button></form><button class="link" id="gBack">→ חזרה</button>`);
  $g('#gBack').onclick = () => welcome().then(done);
  $g('#gf').onsubmit = async (ev) => {
    ev.preventDefault();
    const p1 = ev.target.p1.value, p2 = ev.target.p2.value;
    if (pwProblem(p1)) return err(pwProblem(p1));
    if (p1 !== p2) return err('הסיסמאות לא זהות');
    await setLocalPassword(p1);
    dev.set('mode', 'local');
    close(); done('local');
  };
}
/** standalone: the password on every open (5 wrong → a 1-minute wait, growing) */
export function unlock() {
  return new Promise((done) => {
    show(`<h2>🔒 כניסה</h2><form id="gf"><label>סיסמה<input type="password" name="p" autocomplete="current-password"></label><div class="gerr"></div><button class="btn primary wide">כניסה</button></form>
      <button class="link" id="gForgot">שכחתי את הסיסמה</button>`);
    $g('#gf').onsubmit = async (ev) => {
      ev.preventDefault();
      const wait = dev.get('lockWait', 0);
      if (wait > Date.now()) return err('יותר מדי ניסיונות — נסו שוב בעוד ' + Math.ceil((wait - Date.now()) / 1000) + ' שניות');
      if (await checkLocalPassword(ev.target.p.value)) { dev.set('lockFails', 0); close(); return done(); }
      const n = dev.get('lockFails', 0) + 1; dev.set('lockFails', n);
      if (n >= 5) dev.set('lockWait', Date.now() + 60000 * Math.min(30, 2 ** (n - 5)));
      err('הסיסמה שגויה'); ev.target.p.value = '';
    };
    $g('#gForgot').onclick = () => {
      show(`<h2>שכחתי את הסיסמה</h2><p>הסיסמה לא נשמרת בשום מקום, ולכן אי אפשר לשחזר אותה. אפשר:</p>
        <ul class="gnote"><li>למחוק את המידע מהמכשיר ולהתחיל מחדש — ואז לשחזר מקובץ גיבוי (⚙ הגדרות ← שחזור).</li></ul>
        <form id="gf"><label>כדי למחוק הכל, כתבו <b>מחיקה</b><input name="w"></label><div class="gerr"></div><button class="btn danger wide">מחיקת המידע והתחלה מחדש</button></form>
        <button class="link" id="gBack">→ חזרה</button>`);
      $g('#gBack').onclick = () => unlock().then(done);
      $g('#gf').onsubmit = async (ev) => {
        ev.preventDefault();
        if (ev.target.w.value.trim() !== 'מחיקה') return err('לא נכתב "מחיקה"');
        await wipeAll(); dev.set('lock', null); dev.set('mode', null);
        welcome().then(done);
      };
    };
  });
}

/* ---------------- online: the operator's approval ---------------- */
/** an online account works only once approved (and not blocked). Known approval is kept on the device, so the app
 *  opens offline too; a store never seen approved waits — also offline. */
export async function ensureApproved() {
  for (;;) {
    if (navigator.onLine) {
      const r = await call('me').catch(() => null);
      if (r && r.signIn) { await new Promise((done) => cloudStart(done, 'relogin')); continue; }
      if (r && r.ok) dev.set('storeStatus', r.store.status);
    }
    const st = dev.get('storeStatus') || 'pending';
    if (st === 'active') return;
    const again = await approvalScreen(st);
    if (again === 'left') return 'left';
  }
}
function approvalScreen(st) {
  return new Promise(async (done) => {
    const { licenseState } = await import('./license.js');
    const lic = await licenseState().catch(() => ({ status: 'none' }));
    show(st === 'blocked'
      ? `<h2>⛔ החשבון חסום</h2><p>החשבון המקוון של <b>${e(dev.get('storeName') || '')}</b> חסום. לפרטים — לפנות לספק התוכנה.</p>
        <p class="gnote">המידע שבמכשיר לא נמחק: <button class="link" id="gBk" type="button" style="display:inline">⬇ הורדת גיבוי</button></p>`
      : `<h2>⏳ החשבון ממתין לאישור</h2><p>החשבון של <b>${e(dev.get('storeName') || '')}</b> נפתח, והאימות הדו-שלבי מוגדר. ספק התוכנה קיבל הודעה — <b>כשהחשבון יאושר יישלח אליך מייל</b>, ואפשר להתחיל לעבוד.</p>
        <p class="gnote">${dev.get('email') ? e(dev.get('email')) : ''}</p>`) ;
    const extra = document.createElement('div');
    extra.innerHTML = `<div class="gerr"></div><button class="btn primary wide" id="gChk" type="button">⟳ בדיקה אם אושר</button>
      ${lic.status === 'ok' ? '<button class="link" id="gLocalBack" type="button">↩ להמשיך לעבוד במכשיר בלבד (עצמאי) בינתיים</button>' : ''}
      <button class="link" id="gOut" type="button">🚪 יציאה מהחשבון</button>`;
    layer.querySelector('.gate-card').appendChild(extra);
    const bk = $g('#gBk');
    if (bk) bk.onclick = async () => { const { downloadBackup } = await import('./backup.js'); await downloadBackup(); };
    $g('#gChk').onclick = async () => {
      if (!navigator.onLine) return err('אין חיבור לאינטרנט');
      const r = await call('me').catch(() => null);
      if (r && r.ok) dev.set('storeStatus', r.store.status);
      if (r && r.signIn) { close(); return done('again'); }
      if (dev.get('storeStatus') === 'active') { close(); return done('ok'); }
      err(dev.get('storeStatus') === 'blocked' ? 'החשבון חסום' : 'עוד לא אושר');
    };
    const back = $g('#gLocalBack');
    if (back) back.onclick = () => { dev.set('mode', 'local'); close(); done('left'); };
    $g('#gOut').onclick = async () => {
      await call('logout').catch(() => {});
      dev.set('token', null); dev.set('mode', null); dev.set('storeStatus', null);
      close(); done('left');
    };
  });
}

/* ---------------- online ---------------- */
/** kind: 'new' (an empty device), 'move' (this device's data goes up to a new account), 'relogin' (the session ended) */
export function cloudStart(done, kind = 'new') {
  const signupFirst = kind !== 'relogin';
  const draw = (signup) => {
    show(signup ? `<h2>☁ פתיחת חשבון מקוון</h2>${kind === 'move' ? '<p class="gnote">כל המידע שבמכשיר יעלה לחשבון החדש.</p>' : ''}
      <form id="gf"><label>שם העסק<input name="store" autocomplete="organization"></label><label>השם שלך<input name="name" autocomplete="name"></label>
      <label>מייל<input name="email" type="email" dir="ltr" autocomplete="email"></label><label>סיסמה (10 תווים לפחות)<input name="password" type="password" autocomplete="new-password"></label>
      <div class="gerr"></div><button class="btn primary wide">המשך — הגדרת אימות דו-שלבי</button></form>
      <button class="link" id="gSwap">כבר יש לי חשבון — כניסה</button>${kind !== 'relogin' ? '<button class="link" id="gBack">→ חזרה</button>' : ''}`
      : `<h2>☁ כניסה לחשבון</h2>${kind === 'move' ? '<p class="gnote">⚠ בכניסה לחשבון קיים המידע שבמכשיר הזה יוחלף במידע של החשבון. כדאי לגבות קודם.</p>' : ''}
      <form id="gf"><label>מייל<input name="email" type="email" dir="ltr" autocomplete="username" value="${e(dev.get('email') || '')}"></label><label>סיסמה<input name="password" type="password" autocomplete="current-password"></label>
      <div class="gerr"></div><button class="btn primary wide">כניסה</button></form>
      <button class="link" id="gSwap">אין לי חשבון — פתיחת חשבון</button>${kind !== 'relogin' ? '<button class="link" id="gBack">→ חזרה</button>' : ''}`);
    $g('#gSwap').onclick = () => draw(!signup);
    const back = $g('#gBack');
    if (back) back.onclick = () => { close(); done(null); };
    $g('#gf').onsubmit = async (ev) => {
      ev.preventDefault();
      const f = ev.target, btn = f.querySelector('button');
      err('');
      dev.set('token', null);
      if (signup) {
        if (!f.store.value.trim()) return err('יש להזין את שם העסק');
        if (cloudPwProblem(f.password.value)) return err(cloudPwProblem(f.password.value));
        busy(btn, true);
        const r = await call('signup', { store: f.store.value, name: f.name.value, email: f.email.value, password: f.password.value }).catch(() => ({ ok: false, error: 'אין חיבור לאינטרנט' }));
        busy(btn, false);
        if (!r.ok) return err(r.error);
        enroll(r, f.email.value.trim().toLowerCase(), 'signup');
      } else {
        busy(btn, true);
        const r = await call('login', { email: f.email.value, password: f.password.value }).catch(() => ({ ok: false, error: 'אין חיבור לאינטרנט' }));
        busy(btn, false);
        const email = f.email.value.trim().toLowerCase();
        if (r.mfa === 'setup') return enroll(r, email, 'login');
        if (r.mfa === 'verify') return code(r.challenge, email);
        err(r.error);
      }
    };
  };
  /** the authenticator app: scan → the first code */
  const enroll = (r, email, how) => {
    show(`<h2>🔐 אימות דו-שלבי</h2><ol class="gnote"><li>מתקינים בטלפון אפליקציית אימות: Google Authenticator / Microsoft Authenticator.</li>
      <li>בוחרים "הוספה" ← סריקת קוד QR, וסורקים:</li></ol><div class="qr">${r.qr}</div>
      <p class="gnote">אי אפשר לסרוק (באותו טלפון)? <a href="${e(r.uri)}">פתיחה באפליקציה</a> · או הקלדת הקוד: <code dir="ltr">${e(r.secret)}</code></p>
      <form id="gf"><label>3. הקוד בן 6 הספרות שמופיע באפליקציה<input name="code" inputmode="numeric" autocomplete="one-time-code" dir="ltr" maxlength="6"></label><div class="gerr"></div><button class="btn primary wide">אישור</button></form>`);
    $g('#gf').onsubmit = async (ev) => {
      ev.preventDefault();
      const v = await call('enrollVerify', { enroll: r.enroll, code: ev.target.code.value, device: device() });
      if (!v.ok) { err(v.error); if (v.expired) setTimeout(() => draw(true), 1500); return; }
      await signedIn(v, email, how === 'signup' && kind === 'move');
      show(`<h2>✅ החשבון מוכן</h2><p>אלה <b>קודי שחזור</b> — כל אחד נכנס פעם אחת במקום הקוד מהאפליקציה, אם הטלפון אבד. שמרו אותם במקום בטוח (לא בטלפון):</p>
        <pre class="codes" dir="ltr">${v.recoveryCodes.map(e).join('\n')}</pre><button class="btn primary wide" id="gOk">שמרתי — כניסה</button>`);
      $g('#gOk').onclick = () => { close(); done('cloud'); };
    };
  };
  const code = (challenge, email) => {
    show(`<h2>🔐 קוד אימות</h2><form id="gf"><label>הקוד מאפליקציית האימות (או קוד שחזור)<input name="code" autocomplete="one-time-code" dir="ltr"></label><div class="gerr"></div><button class="btn primary wide">כניסה</button></form>`);
    $g('#gf').onsubmit = async (ev) => {
      ev.preventDefault();
      const v = await call('mfa', { challenge, code: ev.target.code.value, device: device() });
      if (!v.ok) { err(v.error); if (v.expired) setTimeout(() => draw(false), 1500); return; }
      if (v.recoveryLeft !== undefined) alertNote('נכנסת עם קוד שחזור. נשארו ' + v.recoveryLeft + ' קודים.');
      await signedIn(v, email, false);
      close(); done('cloud');
    };
  };
  draw(signupFirst);
}
const alertNote = (t) => { const n = document.createElement('div'); n.className = 'toast on'; n.textContent = t; document.body.appendChild(n); setTimeout(() => n.remove(), 5000); };

/** a session: this device switches to the account. keep = this device's data goes up (a new account from a
 *  standalone device); otherwise a different account than before → the device starts empty and pulls everything */
async function signedIn(v, email, keep) {
  const before = dev.get('email');
  dev.set('token', v.token);
  if (!keep && (dev.get('mode') !== 'cloud' || (before && before !== email))) { await wipeAll(); dev.set('cursor', 0); }
  dev.set('mode', 'cloud'); dev.set('email', email); dev.set('storeName', v.store?.name || ''); dev.set('storeStatus', v.store?.status || 'pending');
  dev.set('lock', null);
  if (keep) { dev.set('cursor', 0); await queueAll(); }
  if (!S.settings.business && v.store?.name) await saveSettings({ business: v.store.name });   // a new account: its name
}
