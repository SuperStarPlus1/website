// Pinkas — backups (the whole store + the purchase documents, one JSON file):
//   a file download · sharing the file (phone: → Google Drive / WhatsApp / mail) · an automatic copy into a chosen folder
//   once a day (computer, Chrome / Edge: e.g. the "Google Drive" folder of Drive for desktop) · straight to the user's
//   own Google Drive (sign in with Google in a window; the app sees only the files it created — drive.file — in the
//   folder "פנקס — גיבויים"), and back from there.
import { S, dev, idb, exportAll, importAll } from './store.js';
import { download } from './ui.js';
import { serverConfig } from './cloud.js';
import { today } from './calc.js';
import { IS_APP, IS_ANDROID_APP, nativeShareFile } from './env.js';

const fileName = () => 'pinkas-' + (S.settings.business || 'backup').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 40) + '-' + today() + '.json';
const stamp = (how) => { dev.set('lastBackup', new Date().toISOString()); dev.set('lastBackupHow', how); };
const text = async () => JSON.stringify(await exportAll(true));

export async function downloadBackup() { download(fileName(), await text()); stamp('file'); }

export const canShare = () => { if (IS_ANDROID_APP) return true; try { return !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] }); } catch { return false; } };
export async function shareBackup() {
  if (IS_ANDROID_APP) { await nativeShareFile(fileName(), await text()); stamp('share'); return; }
  const f = new File([await text()], fileName(), { type: 'application/json' });
  await navigator.share({ files: [f], title: 'גיבוי פנקס' });
  stamp('share');
}

/* ---------------- a folder on the computer (automatic) ---------------- */
export const canFolder = () => 'showDirectoryPicker' in window;
export async function chooseFolder() {
  const h = await window.showDirectoryPicker({ id: 'pinkas-backup', mode: 'readwrite' });
  await idb.put('meta', { id: 'backupFolder', handle: h, name: h.name });
  await writeFolder(h);
  return h.name;
}
export async function folderName() { return (await idb.get('meta', 'backupFolder'))?.name || ''; }
export async function forgetFolder() { await idb.del('meta', 'backupFolder'); }
async function writeFolder(h) {
  const fh = await h.getFileHandle('pinkas-backup-' + today() + '.json', { create: true });
  const w = await fh.createWritable();
  await w.write(await text()); await w.close();
  // keep the last 14
  const names = [];
  for await (const [n] of h.entries()) if (/^pinkas-backup-\d{4}-\d{2}-\d{2}\.json$/.test(n)) names.push(n);
  for (const n of names.sort().slice(0, -14)) await h.removeEntry(n).catch(() => {});
  dev.set('folderBackup', new Date().toISOString()); stamp('folder');
}
/** on start: once a day into the chosen folder, when the browser still allows it without asking */
export async function autoBackup() {
  try {
    const m = await idb.get('meta', 'backupFolder');
    if (!m?.handle) return;
    const last = dev.get('folderBackup');
    if (last && Date.now() - Date.parse(last) < 20 * 3600e3) return;
    if ((await m.handle.queryPermission({ mode: 'readwrite' })) !== 'granted') { dev.set('folderNeedsOk', true); return; }
    dev.set('folderNeedsOk', false);
    await writeFolder(m.handle);
  } catch (e) { console.warn('auto backup', e); }
}
/** the browser asked again (a click is needed) */
export async function folderNow() {
  const m = await idb.get('meta', 'backupFolder');
  if (!m?.handle) return false;
  if ((await m.handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return false;
  dev.set('folderNeedsOk', false);
  await writeFolder(m.handle);
  return true;
}

/* ---------------- Google Drive ---------------- */
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER = 'פנקס — גיבויים';
// the installed apps are not at sidurit.co.il, where Google's window returns — there: share / folder / file
export async function driveReady() { return !IS_APP && !!(await serverConfig()).googleClientId; }
/** a token for an hour: Google's window → oauth.html → back here */
async function driveToken() {
  const c = dev.get('gtoken');
  if (c && c.exp > Date.now() + 60000) return c.token;
  const { googleClientId } = await serverConfig();
  if (!googleClientId) throw new Error('גיבוי לדרייב עוד לא הופעל');
  const state = crypto.randomUUID();
  const redirect = location.origin + location.pathname.replace(/[^/]*$/, '') + 'oauth.html';
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: googleClientId, redirect_uri: redirect, response_type: 'token', scope: SCOPE, state, include_granted_scopes: 'true', prompt: 'select_account' });
  const w = window.open(url, 'pk-google', 'width=500,height=650');
  if (!w) throw new Error('הדפדפן חסם את החלון — לאפשר חלונות קופצים לאתר');
  const token = await new Promise((res, rej) => {
    // the answer comes by postMessage, or — when Google's page cut the link between the windows — by localStorage
    const finish = (d) => {
      clearTimeout(t); window.removeEventListener('message', onMsg); window.removeEventListener('storage', onStore);
      try { localStorage.removeItem('pk_oauth'); } catch { /* */ }
      if (d.state !== state || !d.token) rej(new Error(d.error === 'access_denied' ? 'לא אושרה גישה לדרייב' : 'ההתחברות לגוגל נכשלה'));
      else res(d);
    };
    const onMsg = (ev) => { if (ev.origin === location.origin && ev.data?.type === 'pk-oauth') finish(ev.data); };
    const onStore = (ev) => { if (ev.key === 'pk_oauth' && ev.newValue) { try { finish(JSON.parse(ev.newValue)); } catch { /* */ } } };
    const t = setTimeout(() => { window.removeEventListener('message', onMsg); window.removeEventListener('storage', onStore); rej(new Error('לא התקבל אישור מגוגל — נסו שוב')); }, 180000);
    window.addEventListener('message', onMsg); window.addEventListener('storage', onStore);
  });
  dev.set('gtoken', { token: token.token, exp: Date.now() + (Number(token.expires) || 3500) * 1000 });
  return token.token;
}
async function g(path, opts = {}, tk) {
  const r = await fetch('https://www.googleapis.com/' + path, { ...opts, headers: { Authorization: 'Bearer ' + tk, ...(opts.headers || {}) } });
  if (r.status === 401) { dev.set('gtoken', null); throw new Error('ההתחברות לגוגל פגה — נסו שוב'); }
  if (!r.ok) throw new Error('דרייב: ' + r.status);
  return r;
}
async function folderId(tk) {
  const q = encodeURIComponent(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const l = await (await g('drive/v3/files?q=' + q + '&fields=files(id)', {}, tk)).json();
  if (l.files?.length) return l.files[0].id;
  const c = await (await g('drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }) }, tk)).json();
  return c.id;
}
export async function driveBackup() {
  const tk = await driveToken();
  const parent = await folderId(tk);
  const boundary = 'pk' + Date.now();
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: fileName(), parents: [parent], mimeType: 'application/json' })}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${await text()}\r\n--${boundary}--`;
  await g('upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body }, tk);
  stamp('drive'); dev.set('driveBackup', new Date().toISOString());
}
export async function driveList() {
  const tk = await driveToken();
  const parent = await folderId(tk);
  const q = encodeURIComponent(`'${parent}' in parents and trashed=false`);
  return (await (await g('drive/v3/files?q=' + q + '&orderBy=createdTime desc&pageSize=15&fields=files(id,name,createdTime,size)', {}, tk)).json()).files || [];
}
export async function driveRestore(id) {
  const tk = await driveToken();
  const obj = await (await g('drive/v3/files/' + id + '?alt=media', {}, tk)).json();
  await importAll(obj);
}
