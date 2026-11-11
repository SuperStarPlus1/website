// Pinkas — settings: the business, VAT and prices, credit sales (הקפה), the expense categories, the working days;
// the account (standalone: the password, moving to an online account; online: the account, sync, password, sign out,
// closing the account); backup (file / share / a folder / Google Drive) and restore; installing; sample data; erasing.
import { S, saveSettings, importAll, wipeAll, saveMany, uid, syncFixed, dev, hasData, remove, files } from '../store.js';
import { e, $, $$, toast, modal, field, inp, sel, check, confirmBox, pickFile } from '../ui.js';
import { today, addDays, monthOf, addMonths, dueDate, parse } from '../calc.js';
import { render } from '../app.js';
import { IS_APP, APP_KIND, CC, BRAND, HOST_NAME } from '../env.js';
import { isCloud, call, syncNow, pendingCount, status, deleteFile } from '../cloud.js';
import { cloudStart, setLocalPassword, checkLocalPassword, pwProblem } from '../auth.js';
import { licenseState, activate, deviceCode, refreshLicense } from '../license.js';
import { downloadBackup, canShare, shareBackup, canFolder, chooseFolder, folderName, forgetFolder, folderNow, driveReady, driveBackup, driveList, driveRestore } from '../backup.js';

const DOW = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
let installEvt = null;
window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); installEvt = ev; });
const when = (iso) => (iso ? new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : 'עוד לא');
const HOW = { file: 'קובץ', share: 'שיתוף', folder: 'תיקייה', drive: 'גוגל דרייב' };

/** clearcount: the ledger belongs to the company in Sidurit — its details come from there (shared, edited there) */
function ccCard(pend) {
  const c = S.settings.company || {};
  const row = (l, v) => (v ? `<p class="small" style="margin:2px 0">${l}: <b>${e(v)}</b></p>` : '');
  return `<div class="card"><h3>🔗 מחובר ל${e(HOST_NAME)} — ${e(S.settings.business)}</h3>
    ${row('שם משפטי', c.legalName)}${row('ח.פ. / עוסק מורשה', c.taxId)}${row('תיק ניכויים', c.taxFileNo)}${row('כתובת', c.address)}${row('טלפון', c.phone)}${row('סניפים', (c.branches || []).join(', '))}
    <p class="muted small">פרטי העסק משותפים עם ${e(HOST_NAME)} ומתעדכנים שם. הכניסה — עם המשתמש של ${e(HOST_NAME)}; הנתונים נשמרים בשרת של החברה ובמכשיר.
      סנכרון אחרון: ${when(dev.get('lastSync'))}${pend ? ` · ${pend} שינויים ממתינים` : ''}</p>
    <div class="actions"><button class="btn primary" id="syncNow">⟳ סנכרון עכשיו</button></div></div>`;
}

export async function settingsView(main) {
  const s = S.settings, cloud = isCloud();
  const wd = s.workDays || [0, 1, 2, 3, 4, 5];
  const counts = { 'ימי הכנסות': S.days.length, 'הוצאות': S.expenses.length, 'חשבוניות': S.invoices.length, 'ספקים': S.suppliers.length, 'פריטים': S.items.length, 'לקוחות': S.customers.length };
  const [drive, folder, pend, lic, dc] = await Promise.all([driveReady(), folderName(), cloud ? pendingCount() : 0, cloud ? null : licenseState(), deviceCode()]);
  main.innerHTML = `
    <div class="head"><h1>⚙ הגדרות</h1></div>
    ${CC ? ccCard(pend) : `<div class="card"><h3>${cloud ? '☁ חשבון מקוון' : '📱 עצמאי — במכשיר בלבד'}</h3>
      ${cloud ? `<p>החנות: <b>${e(dev.get('storeName') || s.business)}</b> · ${e(dev.get('email') || '')}</p>
        <p class="muted small">סנכרון אחרון: ${when(dev.get('lastSync'))}${pend ? ` · ${pend} שינויים ממתינים` : ''} · כניסה עם סיסמה + קוד אימות. המידע מופרד משאר החנויות ונשמר גם במכשיר, כך שעובדים גם בלי אינטרנט.</p>
        <div class="actions"><button class="btn primary" id="syncNow">⟳ סנכרון עכשיו</button><button class="btn" id="cpw">🔑 שינוי סיסמה</button><button class="btn" id="logout">🚪 יציאה מהחשבון במכשיר הזה</button><button class="btn danger ghost" id="delAcc">סגירת החשבון</button></div>`
      : `<p>${dev.get('demo') ? 'מצב ניסיון — בלי סיסמה.' : 'הפנקס נפתח עם סיסמה. המידע לא יוצא מהמכשיר.'}</p>
        <div class="actions"><button class="btn" id="lpw">🔑 ${dev.get('lock') ? 'שינוי סיסמה' : 'הגדרת סיסמה'}</button><button class="btn primary" id="toCloud">☁ מעבר לחשבון מקוון</button></div>
        ${lic ? `<p class="small">🔑 רישיון: <b>${e(lic.p?.n || '')}</b> · בתוקף עד <b>${lic.p ? lic.p.e.split('-').reverse().join('/') : '—'}</b>${lic.status === 'ok' ? ' (' + lic.days + ' ימים)' : ''} · קוד המכשיר: <code dir="ltr">${e(dc)}</code> <button class="btn sm" id="newLic">הזנת קוד הפעלה חדש</button> <button class="btn sm ghost" id="chkLic">⟳ בדיקה מול השרת</button></p>` : ''}
        <p class="muted small">חשבון מקוון: גיבוי בשרת, סנכרון בין הטלפון למחשב, וקליטת חשבוניות מצילום. הכניסה אליו — עם סיסמה וקוד מאפליקציית אימות (חובה).</p>`}</div>`}
    <form class="card" id="sf">
      <h3>העסק</h3>
      ${CC ? field('שם העסק', inp('business', s.business, 'readonly'), 'מ' + HOST_NAME + ' — משתנה שם') : field('שם העסק', inp('business', s.business, 'placeholder="למשל: מכולת השכונה"'))}
      <div class="f"><span>ימי פעילות</span><div class="checks">${DOW.map((d, i) => `<label class="chk"><input type="checkbox" name="wd" data-multi value="${i}"${wd.includes(i) ? ' checked' : ''}> ${d}'</label>`).join('')}</div></div>
      <h3>מע"מ ומחירים</h3>
      ${check('vatOn', 'העסק עוסק מורשה (גובה מע"מ)', s.vatOn)}
      <div class="grid3">${field('שיעור מע"מ %', inp('vat', s.vat, 'inputmode="decimal" dir="ltr" class="num"'))}
        ${field('המחיר לצרכן', sel('priceIncVat', [['1', 'כולל מע"מ'], ['0', 'לפני מע"מ']], s.priceIncVat ? '1' : '0'))}
        ${field('עיגול מחיר מחושב', sel('rounding', [['0.9', 'ל-x.90 (₪12.90)'], ['0.1', 'ל-10 אגורות'], ['1', 'לשקל שלם'], ['none', 'בלי עיגול']], s.rounding))}</div>
      <h3>מכירה בהקפה</h3>
      ${check('creditOn', 'העסק מוכר בהקפה — לנהל לקוחות, חובות ותשלומים', s.creditOn)}
      <h3>קטגוריות הוצאות</h3>
      ${field('הוצאות קבועות', `<textarea name="fixedCats" rows="3">${e(s.fixedCats.join(', '))}</textarea>`, 'מופרדות בפסיק')}
      ${field('הוצאות נלוות', `<textarea name="expenseCats" rows="3">${e(s.expenseCats.join(', '))}</textarea>`, 'מופרדות בפסיק')}
      <div class="actions"><button class="btn primary" type="submit">💾 שמירה</button></div>
    </form>
    <div class="card"><h3>💾 גיבוי</h3>
      <p>${cloud ? 'המידע נשמר בשרת ובמכשיר. גיבוי נוסף משלכם — לדרייב או לקובץ — הוא תוספת ביטחון.' : 'כל המידע שמור <b>רק במכשיר הזה</b>. אם המכשיר מתקלקל או שמנקים את הדפדפן — המידע אובד. לכן מגבים לדרייב / לתיקייה / לקובץ, לפחות פעם בשבוע.'}</p>
      <p class="muted small">גיבוי אחרון: ${when(dev.get('lastBackup'))}${dev.get('lastBackupHow') ? ' (' + (HOW[dev.get('lastBackupHow')] || '') + ')' : ''} · ${Object.entries(counts).map(([k, v]) => k + ': ' + v).join(' · ')}. הגיבוי כולל את מסמכי הרכש.</p>
      <div class="bk-grid">
        <div class="bk"><b>☁ גוגל דרייב שלכם</b><small>${drive ? 'מתחברים עם חשבון גוגל; הגיבוי נשמר בתיקייה "פנקס — גיבויים". הפנקס רואה רק את הקבצים שהוא יצר.' : 'עוד לא הופעל בשרת.'}</small>
          ${drive ? '<div class="actions"><button class="btn primary" id="gdUp">☁ גיבוי לדרייב</button><button class="btn" id="gdList">⬆ שחזור מהדרייב</button></div>' : ''}</div>
        ${canFolder() ? `<div class="bk"><b>📁 תיקייה במחשב — אוטומטי</b><small>פעם ביום, בפתיחת הפנקס, נשמר גיבוי לתיקייה שבוחרים (נשמרים 14 אחרונים). אם במחשב מותקן Google Drive / OneDrive — בוחרים תיקייה שלהם, והגיבוי עולה לענן לבד.</small>
          ${folder ? `<p class="small">התיקייה: <b>${e(folder)}</b>${dev.get('folderNeedsOk') ? ' · <span class="neg">הדפדפן מבקש אישור מחדש</span>' : ''} · אחרון: ${when(dev.get('folderBackup'))}</p>` : ''}
          <div class="actions"><button class="btn" id="fdPick">📁 ${folder ? 'החלפת תיקייה' : 'בחירת תיקייה'}</button>${folder ? '<button class="btn" id="fdNow">💾 גיבוי עכשיו</button><button class="btn ghost" id="fdOff">ביטול</button>' : ''}</div></div>` : ''}
        ${canShare() ? '<div class="bk"><b>📤 שליחה</b><small>הטלפון פותח את חלון השיתוף — בוחרים Google Drive, וואטסאפ לעצמכם או מייל.</small><div class="actions"><button class="btn" id="shr">📤 שיתוף קובץ גיבוי</button></div></div>' : ''}
        <div class="bk"><b>⬇ קובץ</b><small>הורדת קובץ גיבוי. אותו קובץ מעביר את המידע גם למכשיר אחר.</small><div class="actions"><button class="btn" id="bk">⬇ הורדה</button><button class="btn" id="rs">⬆ שחזור מקובץ</button></div></div>
      </div></div>
    ${IS_APP || CC ? '' : `<div class="card"><h3>📲 התקנה כאפליקציה</h3>
      <p>פנקס עובד גם בלי אינטרנט. כדי שיהיה אייקון במסך הבית / בשולחן העבודה:</p>
      <ul class="small"><li><b>אנדרואיד (Chrome)</b>: תפריט ⋮ ← "התקנת אפליקציה" / "הוספה למסך הבית".</li><li><b>אייפון (Safari)</b>: כפתור השיתוף ← "הוספה למסך הבית".</li>
        <li><b>מחשב Windows (Edge / Chrome)</b>: בשורת הכתובת — סמל ההתקנה, או תפריט ← "אפליקציות" ← "התקנת האתר כאפליקציה".</li></ul>
      <p class="small">או אפליקציה מלאה להתקנה: <a href="download.html" target="_blank">💻 Windows / 🤖 אנדרואיד</a></p>
      ${installEvt ? '<button class="btn primary" id="inst">📲 התקנה עכשיו</button>' : ''}</div>`}
    ${CC ? '' : `<div class="card"><h3>🧪 ניסיון</h3>
      <p class="muted">${hasData() ? 'כבר יש נתונים — נתוני דוגמה זמינים רק כשהמאגר ריק.' : 'אפשר לטעון נתוני דוגמה (חודשיים של הכנסות, ספקים, חשבוניות והוצאות) כדי לראות איך הכל עובד, ואחר כך למחוק.'}</p>
      <div class="actions">${hasData() ? '' : '<button class="btn" id="demo">🧪 טעינת נתוני דוגמה</button>'}<button class="btn danger ghost" id="wipe">🗑 מחיקת כל המידע${cloud ? ' (גם בשרת)' : ''}</button></div></div>`}
    <p class="muted small center">${BRAND} · גרסה <span id="ver"></span></p>`;
  fetch('version.json').then((r) => r.json()).then((v) => { $('#ver', main).textContent = v.version + ' (' + v.date + ')' + (APP_KIND === 'windows' ? ' · Windows' : APP_KIND === 'android' ? ' · אנדרואיד' : ''); }).catch(() => {});
  const on = (id, fn) => { const b = $('#' + id, main); if (b) b.onclick = async () => { try { await fn(b); } catch (err) { toast(err.message || 'שגיאה', 'err'); } }; };
  const f = $('#sf', main);
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const v = (n) => f.elements[n].value.trim();
    const vat = Number(v('vat'));
    if (!(vat >= 0 && vat < 100)) return toast('שיעור מע"מ לא תקין', 'err');
    const list = (n) => [...new Set(v(n).split(/[,\n]/).map((x) => x.trim()).filter(Boolean))];
    if (!list('fixedCats').length || !list('expenseCats').length) return toast('צריך לפחות קטגוריה אחת בכל רשימה', 'err');
    await saveSettings({ business: v('business'), vatOn: f.elements.vatOn.checked, vat, priceIncVat: v('priceIncVat') === '1', rounding: v('rounding'),
      creditOn: f.elements.creditOn.checked, fixedCats: list('fixedCats'), expenseCats: list('expenseCats'),
      workDays: $$('input[name=wd]', f).filter((x) => x.checked).map((x) => Number(x.value)) });
    toast('נשמר ✓');
    render();
  };

  /* ---- the account ---- */
  on('syncNow', async () => { await syncNow(); toast(status.v === 'ok' ? 'מסונכרן ✓' : 'הסנכרון לא הושלם — ' + status.v, status.v === 'ok' ? 'ok' : 'err'); settingsView(main); });
  on('lpw', async () => {
    const has = !!dev.get('lock');
    const r = await modal(has ? 'שינוי סיסמה' : 'הגדרת סיסמה', (has ? field('הסיסמה הנוכחית', '<input type="password" name="cur" autocomplete="current-password">') : '') +
      field('סיסמה חדשה', '<input type="password" name="p1" autocomplete="new-password">') + field('שוב', '<input type="password" name="p2" autocomplete="new-password">'),
      [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: async (v) => (has && !(await checkLocalPassword(v.cur)) ? 'הסיסמה הנוכחית שגויה' : pwProblem(v.p1) || (v.p1 !== v.p2 ? 'הסיסמאות לא זהות' : '')) }]);
    if (!r) return;
    await setLocalPassword(r.p1); dev.set('demo', null); toast('הסיסמה נשמרה ✓'); settingsView(main);
  });
  on('newLic', async () => {
    const r = await modal('קוד הפעלה חדש', `<p class="muted">קוד המכשיר: <code dir="ltr">${e(dc)}</code></p>` + field('קוד ההפעלה', '<textarea name="code" rows="3" dir="ltr" placeholder="PK1.…"></textarea>'),
      [{ label: 'ביטול', value: null }, { label: 'הפעלה', kind: 'primary', value: 1, submit: true, check: async (v) => { const w = await activate(v.code); if (!w) await refreshLicense(true).catch(() => {}); return w; } }]);
    if (r) { toast('הקוד הופעל ✓'); settingsView(main); }
  });
  on('chkLic', async () => { await refreshLicense(true); const n = await licenseState(); toast(n.status === 'ok' ? 'בתוקף עד ' + n.p.e.split('-').reverse().join('/') : 'הקוד לא בתוקף', n.status === 'ok' ? 'ok' : 'err'); settingsView(main); });
  on('toCloud', async () => {
    if (!navigator.onLine) return toast('צריך חיבור לאינטרנט', 'err');
    const mode = await new Promise((done) => cloudStart(done, 'move'));
    if (mode === 'cloud') { toast('עברתם לחשבון מקוון ✓ — המידע עולה לשרת'); location.reload(); }
  });
  on('cpw', async () => {
    const r = await modal('שינוי סיסמה', field('הסיסמה הנוכחית', '<input type="password" name="current" autocomplete="current-password">') +
      field('סיסמה חדשה (10 תווים לפחות)', '<input type="password" name="password" autocomplete="new-password">') + field('קוד מאפליקציית האימות', '<input name="code" inputmode="numeric" dir="ltr" autocomplete="one-time-code">'),
      [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: async (v) => { const x = await call('changePassword', v); return x.ok ? '' : x.error; } }]);
    if (r) toast('הסיסמה הוחלפה ✓ — מכשירים אחרים יתבקשו להתחבר מחדש');
  });
  on('logout', async () => {
    const n = await pendingCount();
    if (n && !(await confirmBox(n + ' שינויים עוד לא עלו לשרת ויאבדו. לצאת בכל זאת?', 'יציאה'))) return;
    if (!n && !(await confirmBox('לצאת מהחשבון? המידע יימחק מהמכשיר הזה (הוא שמור בחשבון).', 'יציאה'))) return;
    await call('logout'); dev.set('token', null); await wipeAll(); dev.set('mode', null); dev.set('cursor', 0);
    location.hash = '#/home'; location.reload();
  });
  on('delAcc', async () => {
    const r = await modal('סגירת החשבון', '<p class="neg"><b>כל המידע של החנות יימחק מהשרת</b> — כולל מסמכי הרכש — ולא ניתן לשחזר. כדאי להוריד קובץ גיבוי קודם.</p>' +
      field('סיסמה', '<input type="password" name="password" autocomplete="current-password">') + field('קוד מאפליקציית האימות', '<input name="code" inputmode="numeric" dir="ltr">') + field('כתבו: סגירת החשבון', inp('w')),
      [{ label: 'ביטול', value: null }, { label: 'מחיקת החשבון לצמיתות', kind: 'danger', value: 1, submit: true, check: async (v) => { if (v.w !== 'סגירת החשבון') return 'לא נכתב "סגירת החשבון"'; const x = await call('deleteAccount', v); return x.ok ? '' : x.error; } }]);
    if (!r) return;
    dev.set('token', null); await wipeAll(); dev.set('mode', null); dev.set('cursor', 0); location.hash = '#/home'; location.reload();
  });

  /* ---- backup ---- */
  on('bk', async () => { await downloadBackup(); toast('קובץ הגיבוי ירד ✓ — שמרו אותו במקום בטוח'); settingsView(main); });
  on('shr', async () => { await shareBackup(); settingsView(main); });
  on('gdUp', async (b) => { b.disabled = true; b.textContent = 'מגבה…'; try { await driveBackup(); toast('הגיבוי נשמר בדרייב ✓'); } finally { settingsView(main); } });
  on('gdList', async () => {
    const list = await driveList();
    if (!list.length) return toast('אין גיבויים בתיקייה "פנקס — גיבויים"', 'err');
    const r = await modal('שחזור מגוגל דרייב', '<p class="neg">השחזור מחליף את כל המידע' + (cloud ? ' (גם בחשבון המקוון)' : ' שבמכשיר') + '.</p>' +
      field('גיבוי', sel('id', list.map((x) => [x.id, x.name + ' · ' + when(x.createdTime)]), list[0].id)),
      [{ label: 'ביטול', value: null }, { label: 'שחזור', kind: 'danger', value: 1, submit: true }]);
    if (!r) return;
    await driveRestore(r.id); toast('המידע שוחזר ✓'); render();
  });
  on('fdPick', async () => { const n = await chooseFolder(); toast('הגיבוי נשמר בתיקייה ' + n + ' ✓'); settingsView(main); });
  on('fdNow', async () => { if (await folderNow()) toast('נשמר בתיקייה ✓'); else toast('לא ניתן אישור לתיקייה', 'err'); settingsView(main); });
  on('fdOff', async () => { await forgetFolder(); settingsView(main); });
  on('rs', async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    let obj;
    try { obj = JSON.parse(await file.text()); } catch { return toast('הקובץ לא תקין', 'err'); }
    if (obj.app !== 'pinkas') return toast('זה לא קובץ גיבוי של פנקס', 'err');
    if (!(await confirmBox('השחזור מחליף את כל המידע' + (cloud ? ' (גם בחשבון המקוון)' : ' שבמכשיר') + ' במידע מהקובץ (מ-' + new Date(obj.exported).toLocaleDateString('he-IL') + '). להמשיך?', 'שחזור'))) return;
    await importAll(obj);
    toast('המידע שוחזר ✓');
    render();
  });
  const inst = $('#inst', main);
  if (inst) inst.onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; settingsView(main); };
  on('demo', async () => { await loadDemo(); toast('נתוני הדוגמה נטענו ✓'); location.hash = '#/home'; render(); });
  on('wipe', async () => {
    if (!(await confirmBox('למחוק את כל המידע' + (cloud ? ' — במכשיר ובחשבון המקוון' : ' מהמכשיר') + '? אי אפשר לבטל — רק לשחזר מגיבוי.', 'מחיקת הכל'))) return;
    const r = await modal('אישור אחרון', '<p>כדי למחוק, כתבו <b>מחיקה</b>:</p>' + inp('w', ''), [{ label: 'ביטול', value: null }, { label: 'מחיקה', kind: 'danger', value: 1, submit: true, check: (x) => (x.w === 'מחיקה' ? '' : 'לא נכתב "מחיקה"') }]);
    if (!r) return;
    if (cloud) await wipeCloud(); else await wipeAll();
    toast('כל המידע נמחק');
    location.hash = '#/home'; render();
  });
}
/** online: every row becomes a tombstone (synced to the other devices), the documents are deleted */
async function wipeCloud() {
  for (const t of ['days', 'creditSales', 'payments', 'customers', 'fixed', 'expenses', 'suppliers', 'categories', 'items', 'invoices']) for (const r of [...S[t]]) await remove(t, r.id);
  for (const f of await files.all()) await deleteFile(f.id);
  await syncNow();
}

/** two months of a small shop, to try the screens */
export async function loadDemo() {
  const t = today(), rnd = (a, b) => Math.round((a + Math.random() * (b - a)) * 100) / 100;
  await saveSettings({ business: S.settings.business || 'מכולת הדוגמה', creditOn: true });
  const cats = [['ירקות ופירות', 35, 'top'], ['מוצרי חלב', 18, 'top'], ['משקאות', 30, 'bottom'], ['ניקיון', 35, 'bottom'], ['מאפים', 25, 'top']].map(([name, margin, mode]) => ({ id: uid(), name, margin, mode }));
  await saveMany('categories', cats);
  const sups = [
    { name: 'תנובה', terms: { base: 'eom', days: 30 }, cats: [cats[1].id] }, { name: 'שוק סיטונאי ירקות', terms: { base: 'cash', days: 0 }, cats: [cats[0].id] },
    { name: 'משקאות הצפון', terms: { base: 'eom', days: 60 }, cats: [cats[2].id] }, { name: 'ניקיון פלוס', terms: { base: 'net', days: 45 }, cats: [cats[3].id, cats[2].id] },
    { name: 'מאפיית הבוקר', terms: { base: 'net', days: 14 }, cats: [cats[4].id] },
  ].map((x, i) => ({ id: uid(), active: true, phone: '', stock: true, service: i === 3, ...x }));   // ניקיון פלוס: goods + the cleaning service
  const svc = [['טכנאי קירור', { base: 'cash', days: 0 }], ['מדביר', { base: 'net', days: 30 }], ['חברת החשמל', { base: 'net', days: 14 }], ['משרד רו"ח', { base: 'eom', days: 10 }]]
    .map(([name, terms]) => ({ id: uid(), name, terms, cats: [], active: true, phone: '', stock: false, service: true }));
  sups.push(...svc);
  await saveMany('suppliers', sups);
  await saveMany('items', [
    ['7290000000011', 'חלב 3% קרטון 1 ל׳', 1, 0, 5.4], ['7290000000028', 'גבינה לבנה 5% 250 גר׳', 1, 0, 4.1], ['7290000000035', 'קוקה קולה 1.5 ל׳', 2, 2, 5.2],
    ['7290000000042', 'מים מינרליים 6×1.5', 2, 2, 9.8], ['7290000000059', 'אקונומיקה 4 ל׳', 3, 3, 7.5], ['', 'עגבניות (ק"ג)', 0, 1, 4.2], ['', 'מלפפונים (ק"ג)', 0, 1, 3.6],
    ['7290000000066', 'לחם אחיד פרוס', 4, 4, 5.1],
  ].map(([code, name, c, sp, cost]) => ({ id: uid(), code, name, categoryId: cats[c].id, supplierId: sups[sp].id, cost, price: null, costDate: t })));
  const days = [], invoices = [], expenses = [], credit = [];
  for (let i = 60; i >= 1; i--) {
    const d = addDays(t, -i);
    if (parse(d).getDay() === 6) continue;
    days.push({ id: 'd' + d, date: d, cash: rnd(900, 2200), check: Math.random() < 0.2 ? rnd(150, 600) : 0, card: rnd(1800, 4200), bit: rnd(80, 450), paybox: Math.random() < 0.4 ? rnd(30, 200) : 0, note: '', closed: false });
    if (i % 4 === 0) invoices.push({ id: uid(), supplierId: sups[1].id, number: 'S' + (1000 + i), type: 'invoice', date: d, amount: rnd(600, 1400), dueDate: d, vat: true, paid: true, paidDate: d, method: 'cash' });
    if (i % 7 === 0) invoices.push({ id: uid(), supplierId: sups[4].id, number: 'M' + (500 + i), type: 'invoice', date: d, amount: rnd(700, 1100), dueDate: addDays(d, 14), vat: true, paid: addDays(d, 14) < t, paidDate: addDays(d, 14) < t ? addDays(d, 14) : null });
  }
  for (const [k, ym] of [[0, monthOf(addDays(t, -40))], [1, monthOf(t)]]) {
    invoices.push({ id: uid(), supplierId: sups[0].id, number: 'T-' + ym.replace('-', ''), type: 'monthly', date: ym + '-25', amount: rnd(9000, 12000), dueDate: '', vat: true, paid: false });
    invoices.push({ id: uid(), supplierId: sups[2].id, number: 'N' + (77 + k), type: 'invoice', date: ym + '-10', amount: rnd(3000, 4500), dueDate: '', vat: true, paid: false });
  }
  for (const x of invoices) if (!x.dueDate) { const sp = sups.find((v) => v.id === x.supplierId); x.dueDate = dueDate(x.date, sp.terms); }
  expenses.push({ id: uid(), kind: 'other', category: 'תיקונים ותחזוקה', supplierId: svc[0].id, payee: 'טכנאי קירור', name: 'תיקון מקרר משקאות', date: addDays(t, -12), amount: 850, vat: true, paid: true, paidDate: addDays(t, -12), method: 'cash' });
  expenses.push({ id: uid(), kind: 'other', category: 'נותני שירותים', supplierId: svc[1].id, payee: 'מדביר', name: 'הדברה רבעונית', date: addDays(t, -30), amount: 450, vat: true, paid: true, paidDate: addDays(t, -30), method: 'transfer' });
  const c1 = { id: uid(), name: 'משפחת כהן', phone: '050-0000000', active: true }, c2 = { id: uid(), name: 'גן ילדים רימון', phone: '', active: true, limit: 2000 };
  await saveMany('customers', [c1, c2]);
  for (let i = 3; i < 40; i += 5) credit.push({ id: uid(), date: addDays(t, -i), customerId: i % 2 ? c1.id : c2.id, amount: rnd(80, 400), note: '' });
  await saveMany('days', days); await saveMany('invoices', invoices); await saveMany('expenses', expenses); await saveMany('creditSales', credit);
  await saveMany('payments', [{ id: uid(), date: addDays(t, -10), customerId: c1.id, amount: 300, method: 'cash' }]);
  const start = addMonths(monthOf(t), -2);
  await saveMany('fixed', [
    { name: 'שכירות החנות', category: 'שכירות', amount: 7500, every: 1, day: 1, vat: true }, { name: 'ארנונה', category: 'ארנונה', amount: 1900, every: 2, day: 15, vat: false },
    { name: 'חשמל', category: 'חשמל', supplierId: svc[2].id, payee: 'חברת החשמל', amount: 2400, every: 2, day: 20, vat: true }, { name: 'אינטרנט וטלפון', category: 'אינטרנט וטלפון', amount: 180, every: 1, day: 5, vat: true },
    { name: 'ביטוח העסק', category: 'ביטוח', amount: 3600, every: 12, day: 10, vat: false }, { name: 'הנהלת חשבונות', category: 'הנהלת חשבונות', supplierId: svc[3].id, payee: 'משרד רו"ח', amount: 950, every: 1, day: 10, vat: true },
  ].map((x) => ({ id: uid(), start, end: null, active: true, ...x })));
  await syncFixed();
  // the months that have passed are paid
  await saveMany('expenses', S.expenses.filter((x) => x.kind === 'fixed' && x.date < t).map((x) => ({ ...x, paid: true, paidDate: x.date, method: 'standing' })));
}
