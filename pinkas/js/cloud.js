// Pinkas — the online mode: the server (supabase/functions/pinkas), the sync (the outbox up, the other devices' changes
// down: on start, a few seconds after each change, every minute, when the connection comes back), the purchase
// documents' upload, reading an invoice from a photo. The session token is kept on this device (dev 'token').
import { S, dev, idb, files, applyRemote, onChange } from './store.js';
import { IS_ANDROID_APP, plugin, CC, HOST } from './env.js';

export const FN = 'https://xdxlmxywrpnqgvuoegzv.supabase.co/functions/v1/pinkas';
export const isCloud = () => dev.get('mode') === 'cloud';
let ccStopped = '';

export async function call(action, body = {}) {
  if (CC) {   // clearcount: the same actions on the company's ledger, through the Sidurit page (its sign-in, its licence window)
    if (!HOST) return { ok: false, error: 'clearcount נפתח מתוך סידורית' };
    if (ccStopped) return { ok: false, blocked: true, error: ccStopped };
    const out = await HOST.apiPost({ action: 'cc' + action[0].toUpperCase() + action.slice(1), ...body, ...(HOST.mgrAuth ? HOST.mgrAuth() : {}) });
    if (out && out.noLicense) { ccStopped = out.error || 'אין רישיון שימוש'; return { ok: false, blocked: true, error: ccStopped }; }   // once (the Sidurit page shows its licence window)
    if (out && !out.ok && /סיסמה שגויים|יש להתחבר|פג תוקף/.test(String(out.error || ''))) status.set('signin');
    return out || { ok: false, error: 'שגיאת תקשורת' };
  }
  const r = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...body, ...(dev.get('token') ? { token: dev.get('token') } : {}) }) });
  let out;
  try { out = await r.json(); } catch { out = { ok: false, error: 'שגיאת תקשורת' }; }
  if (out && out.signIn) { dev.set('token', null); status.set('signin'); }
  return out;
}
/** the public settings (is reading invoices on, the Google client id), kept for offline */
export async function serverConfig(refresh = false) {
  const c = dev.get('srvcfg');
  if (c && !refresh && Date.now() - c.at < 6 * 3600e3) return c;
  try { const r = CC ? await call('config') : await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'config' }) }).then((x) => x.json());
    if (r.ok) { const v = { ocr: r.ocr, googleClientId: r.googleClientId || '', at: Date.now() }; dev.set('srvcfg', v); return v; } } catch { /* offline */ }
  return c || { ocr: false, googleClientId: '' };
}

/* ---------------- the sync status (shown in the menu) ---------------- */
export const status = {
  v: 'idle', listeners: [],
  set(v) { this.v = v; for (const f of this.listeners) f(v); },
  on(f) { this.listeners.push(f); },
};

let timer = null, running = null, afterSync = () => {};
export const onPulled = (fn) => { afterSync = fn; };
export function scheduleSync(ms = 2500) {
  if (!isCloud()) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), ms);
}
export async function syncNow() {
  if (!isCloud() || !dev.get('token')) return;
  if (running) return running;
  running = (async () => {
    if (!navigator.onLine) { status.set('offline'); return; }
    status.set('syncing');
    try {
      let pulledAny = 0;
      for (let round = 0; round < 20; round++) {
        const box = (await idb.all('outbox')).slice(0, 400);
        const r = await call('sync', { cursor: dev.get('cursor', 0), push: box.map((o) => ({ tbl: o.tbl, id: o.id, updated: o.updated, deleted: o.deleted, data: o.data })) });
        if (r.pending || r.blocked) { dev.set('storeStatus', r.pending ? 'pending' : 'blocked'); status.set(r.pending ? 'pending-approval' : 'blocked'); return; }
        if (!r.ok) { status.set(r.signIn ? 'signin' : 'error'); return; }
        // what went up is out of the outbox — unless it changed again meanwhile
        for (const o of box) { const cur = await idb.get('outbox', o.key); if (cur && cur.updated === o.updated) await idb.del('outbox', o.key); }
        pulledAny += await applyRemote(r.pulled);
        dev.set('cursor', r.cursor);
        if (r.store?.name) dev.set('storeName', r.store.name);
        if (!r.more && (await idb.all('outbox')).length === 0) break;
      }
      await uploadFiles();
      dev.set('lastSync', new Date().toISOString()); dev.set('storeStatus', 'active');
      status.set((await idb.all('outbox')).length ? 'pending' : 'ok');
      if (pulledAny) afterSync();
    } catch (e) { console.warn('sync', e); status.set(navigator.onLine ? 'error' : 'offline'); }
  })();
  try { await running; } finally { running = null; }
}
export function startSync() {
  onChange(() => { status.set('pending'); scheduleSync(); });
  if (!isCloud()) return;
  window.addEventListener('online', () => scheduleSync(300));
  window.addEventListener('offline', () => status.set('offline'));
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(500); });
  syncNow();
}
export const pendingCount = async () => (await idb.all('outbox')).length;

/* ---------------- purchase documents ---------------- */
const b64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob); });
async function uploadFiles() {
  for (const f of await files.all()) {
    if (f.uploaded || !f.blob) continue;
    const r = await call('fileUp', { id: f.id, invoiceId: f.invoiceId, name: f.name, mime: f.mime, data: await b64(f.blob) });
    if (r.ok) await files.put({ ...f, uploaded: true });
  }
}
/** a document of an invoice: from this device, else (online) from the server */
export async function openFile(meta) {
  const f = await files.get(meta.id);
  if (f && f.blob && IS_ANDROID_APP) {   // the Android app: the document → a file → the system (open / send)
    const P = { Filesystem: plugin('Filesystem'), Share: plugin('Share') };
    const r = await P.Filesystem.writeFile({ path: f.name.replace(/[\\/:*?"<>|]+/g, ' '), data: await b64(f.blob), directory: 'CACHE' });
    await P.Share.share({ title: f.name, files: [r.uri] });
    return true;
  }
  if (f && f.blob) { const u = URL.createObjectURL(f.blob); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); return true; }
  if (!isCloud()) return false;
  const w = window.open('', '_blank');
  const r = await call('fileGet', { id: meta.id });
  if (r.ok && w) { w.location.href = r.url; return true; }
  if (w) w.close();
  return false;
}
export async function deleteFile(id) {
  await files.del(id);
  if (isCloud()) await call('fileDel', { id });
}

/* ---------------- an invoice from a photo ---------------- */
/** a photo → a smaller JPEG (long side 2000px) — faster to send, still readable */
export async function shrinkImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  if (k === 1 && file.size < 1.5e6) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
export async function readInvoice(file) {
  const r = await call('ocr', { mime: file.type, data: await b64(file), suppliers: S.suppliers.map((s) => s.name) });
  return r;
}
