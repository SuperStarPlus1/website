// Pinkas — the data. Always kept on this device, in IndexedDB; on start every table is read into memory (S.*) and each
// change is written through. In the online mode (cloud.js) every change also goes to the "outbox" (deleted rows as
// tombstones) until the server has it, and what other devices changed is applied with applyRemote().
// Stores: the app's tables, settings, outbox, files (purchase documents: the blob + whether it is uploaded), meta.
import { fixedDue, addMonths, monthOf, today } from './calc.js';
import { CC } from './env.js';

export const TABLES = ['days', 'creditSales', 'payments', 'customers', 'fixed', 'expenses', 'suppliers', 'categories', 'items', 'invoices', 'payPeople'];   // payPeople: clearcount's payroll settings
const DB_NAME = CC ? 'clearcount-' + CC : 'pinkas', DB_VER = 3;   // clearcount: each company apart from Pinkas
const DEV = CC ? 'cc_' + CC + '_' : 'pk_';

export const DEFAULT_SETTINGS = {
  id: 'main', business: '', vatOn: true, vat: 18, priceIncVat: true, rounding: '0.9', creditOn: false,
  expenseCats: ['תיקונים ותחזוקה', 'נותני שירותים', 'ניקיון', 'פרסום ושיווק', 'משרד וציוד', 'רכב ודלק', 'עמלות בנק ואשראי', 'אחר'],
  fixedCats: ['שכירות', 'ארנונה', 'חשמל', 'מים', 'גז', 'אינטרנט וטלפון', 'ביטוח', 'הנהלת חשבונות', 'שכר עובדים', 'הלוואה', 'מנויים ותוכנות', 'אחר'],
  created: null,
};

export const S = { settings: { ...DEFAULT_SETTINGS } };
for (const t of TABLES) S[t] = [];

/* this device only (not synced): the mode, the lock, the last backup… */
export const dev = {
  get: (k, d = null) => { try { const v = localStorage.getItem(DEV + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { if (v === null || v === undefined) localStorage.removeItem(DEV + k); else localStorage.setItem(DEV + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

let db = null;
let changed = () => {};                 // cloud.js: a change waits in the outbox → schedule a sync
export const onChange = (fn) => { changed = fn; };
const online = () => dev.get('mode') === 'cloud';

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const t of [...TABLES, 'settings', 'files', 'meta']) if (!d.objectStoreNames.contains(t)) d.createObjectStore(t, { keyPath: 'id' });
      if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('הפנקס פתוח בחלון אחר עם גרסה ישנה — סגרו אותו ונסו שוב'));
  });
}
const tx = (store, mode, fn) => new Promise((res, rej) => {
  const t = db.transaction(store, mode);
  const out = fn(t.objectStore(store));
  t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
  t.onerror = () => rej(t.error);
  t.onabort = () => rej(t.error);
});
export const idb = { get: (s, k) => tx(s, 'readonly', (o) => o.get(k)), all: (s) => tx(s, 'readonly', (o) => o.getAll()),
  put: (s, v) => tx(s, 'readwrite', (o) => o.put(v)), del: (s, k) => tx(s, 'readwrite', (o) => o.delete(k)), clear: (s) => tx(s, 'readwrite', (o) => o.clear()) };

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export async function openDb() { if (!db) db = await open(); }
export async function load() {
  await openDb();
  for (const t of TABLES) S[t] = await idb.all(t);
  const st = await idb.get('settings', 'main');
  S.settings = { ...DEFAULT_SETTINGS, ...(st || {}), id: 'main' };
  if (!st) { S.settings.created = today(); await idb.put('settings', S.settings); }
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch { /* not supported */ }
  await syncFixed();
}
export const hasData = () => S.days.length + S.expenses.length + S.invoices.length + S.suppliers.length > 0;

/* ---------------- writing (+ the outbox) ---------------- */
async function queue(tbl, row, deleted = false) {
  if (!online()) return;
  await idb.put('outbox', { key: tbl + '/' + row.id, tbl, id: row.id, updated: row.updated, deleted, data: deleted ? null : row });
  changed();
}
export async function saveSettings(patch) {
  if (patch) Object.assign(S.settings, patch);
  S.settings.updated = new Date().toISOString();
  await idb.put('settings', S.settings);
  await queue('settings', S.settings);
}
/** add or update one row (by id) */
export async function save(table, row) {
  if (!row.id) row.id = uid();
  row.updated = new Date().toISOString();
  await idb.put(table, row);
  const i = S[table].findIndex((x) => x.id === row.id);
  if (i >= 0) S[table][i] = row; else S[table].push(row);
  await queue(table, row);
  return row;
}
export async function saveMany(table, rows) {
  if (!rows.length) return;
  const now = new Date().toISOString();
  for (const r of rows) { if (!r.id) r.id = uid(); r.updated = now; }
  await tx(table, 'readwrite', (s) => { for (const r of rows) s.put(r); });
  for (const r of rows) { const i = S[table].findIndex((x) => x.id === r.id); if (i >= 0) S[table][i] = r; else S[table].push(r); }
  if (online()) { await tx('outbox', 'readwrite', (s) => { for (const r of rows) s.put({ key: table + '/' + r.id, tbl: table, id: r.id, updated: r.updated, deleted: false, data: r }); }); changed(); }
}
export async function remove(table, id) {
  await idb.del(table, id);
  S[table] = S[table].filter((x) => x.id !== id);
  await queue(table, { id, updated: new Date().toISOString() }, true);
}
export const byId = (table, id) => S[table].find((x) => x.id === id);

/** rows from the server (another device's changes): newer than ours → in. Returns how many changed. */
export async function applyRemote(rows) {
  let n = 0;
  const box = new Set((await idb.all('outbox')).map((o) => o.key));
  for (const r of rows) {
    if (r.tbl === 'settings') {
      if (r.deleted || box.has('settings/main') || (S.settings.updated && S.settings.updated >= r.updated)) continue;
      S.settings = { ...DEFAULT_SETTINGS, ...r.data, id: 'main', updated: r.updated };
      await idb.put('settings', S.settings); n++; continue;
    }
    if (!TABLES.includes(r.tbl) || box.has(r.tbl + '/' + r.id)) continue;   // our own change still waits to go up — ours wins
    const cur = S[r.tbl].find((x) => x.id === r.id);
    if (cur && cur.updated && cur.updated >= r.updated) continue;
    if (r.deleted) { if (cur) { await idb.del(r.tbl, r.id); S[r.tbl] = S[r.tbl].filter((x) => x.id !== r.id); n++; } continue; }
    const row = { ...r.data, id: r.id, updated: r.updated };
    await idb.put(r.tbl, row);
    const i = S[r.tbl].findIndex((x) => x.id === r.id);
    if (i >= 0) S[r.tbl][i] = row; else S[r.tbl].push(row);
    n++;
  }
  return n;
}
/** everything on this device → the outbox (moving to an online account) */
export async function queueAll() {
  const now = new Date().toISOString();
  await tx('outbox', 'readwrite', (s) => {
    for (const t of TABLES) for (const r of S[t]) s.put({ key: t + '/' + r.id, tbl: t, id: r.id, updated: r.updated || now, deleted: false, data: r });
    s.put({ key: 'settings/main', tbl: 'settings', id: 'main', updated: S.settings.updated || now, deleted: false, data: S.settings });
  });
  changed();
}

/** the fixed expenses' rows, up to two months ahead (for the cash-flow) */
export async function syncFixed() {
  const until = addMonths(monthOf(today()), 2);
  const rows = S.fixed.flatMap((t) => fixedDue(t, until, S.expenses));
  // a fixed row's id comes from its template + month, so two devices create the same row, not two
  for (const r of rows) r.id = 'fx-' + r.fixedId + '-' + r.period;
  await saveMany('expenses', rows);
  return rows.length;
}

/* ---------------- purchase documents (blobs on the device) ---------------- */
export const files = {
  put: (f) => idb.put('files', f),
  get: (id) => idb.get('files', id),
  del: (id) => idb.del('files', id),
  all: () => idb.all('files'),
};

/* ---------------- backup ---------------- */
const toB64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob); });
export async function exportAll(withFiles = true) {
  const out = { app: 'pinkas', version: 2, exported: new Date().toISOString(), settings: S.settings };
  for (const t of TABLES) out[t] = S[t];
  if (withFiles) out.files = await Promise.all((await files.all()).filter((f) => f.blob).map(async (f) => ({ id: f.id, invoiceId: f.invoiceId, name: f.name, mime: f.mime, size: f.size, data: await toB64(f.blob) })));
  return out;
}
export async function importAll(obj) {
  if (!obj || obj.app !== 'pinkas') throw new Error('זה לא קובץ גיבוי של פנקס');
  for (const t of TABLES) {
    const rows = (Array.isArray(obj[t]) ? obj[t] : []).filter((r) => r && r.id);
    await tx(t, 'readwrite', (s) => { s.clear(); for (const r of rows) s.put(r); });
    S[t] = rows;
  }
  S.settings = { ...DEFAULT_SETTINGS, ...(obj.settings || {}), id: 'main' };
  await idb.put('settings', S.settings);
  await idb.clear('files');
  for (const f of Array.isArray(obj.files) ? obj.files : []) {
    const bin = Uint8Array.from(atob(f.data || ''), (c) => c.charCodeAt(0));
    await files.put({ id: f.id, invoiceId: f.invoiceId, name: f.name, mime: f.mime, size: f.size, blob: new Blob([bin], { type: f.mime }), uploaded: false });
  }
  if (online()) await queueAll();
}
/** erase this device (the online account itself stays) */
export async function wipeAll() {
  for (const t of [...TABLES, 'outbox', 'files']) { await idb.clear(t); if (S[t]) S[t] = []; }
  S.settings = { ...DEFAULT_SETTINGS, created: today() };
  await idb.put('settings', S.settings);
}
