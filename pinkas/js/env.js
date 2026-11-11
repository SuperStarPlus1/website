// Pinkas — where the app runs: the website (a PWA in the browser), the Windows app (pinkas/native/windows — the app is
// served inside it at https://pinkas.local) or the Android app (pinkas/native/android — Capacitor). The installed apps
// carry their files inside, so: no service worker, no "install" card, a check for a newer version on the site, and on
// Android files are saved / shared through the system (Capacitor Filesystem + Share).
export const IS_WINDOWS_APP = location.hostname === 'pinkas.local';
export const IS_ANDROID_APP = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
export const IS_APP = IS_WINDOWS_APP || IS_ANDROID_APP;
export const APP_KIND = IS_WINDOWS_APP ? 'windows' : IS_ANDROID_APP ? 'android' : 'web';
export const SITE = 'https://sidurit.co.il/pinkas/';
// clearcount (20/10/2026): the same app opened by Sidurit (web/app/clearcount.js) in a window of its own page, as a
// paid module of the company — ?cc=<company>. Its data: the company's ledger on Sidurit's server (api/clearcount.ts),
// reached through the Sidurit page's own sign-in (HOST.apiPost / HOST.mgrAuth); kept on this device apart from Pinkas.
export const CC = (new URLSearchParams(location.search).get('cc') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
export const HOST = (() => { try { return CC && window.parent !== window && typeof window.parent.apiPost === 'function' ? window.parent : null; } catch { return null; } })();
// the host system: Sidurit (clearcount) or Superstar (📒 פנקס והוצאות, 11/11/2026) — its name and the app's, from the host page
const hostVal = (k, d) => { try { return (HOST && HOST[k]) || d; } catch { return d; } };
export const HOST_NAME = hostVal('CC_HOST_NAME', 'סידורית');
export const BRAND = CC ? hostVal('CC_BRAND', 'clearcount') : 'פנקס';
/** what the host's server offers (ccOpen → features): Sidurit — the payroll; Superstar — the registers' daily sales */
export const FEAT = { payroll: true, sales: false };

/** Android: a file → the app's cache folder → the system share sheet (Drive, WhatsApp, e-mail, Files…) */
/** a native plugin (Capacitor): the ready proxy, or registered by name (the app is not bundled) */
export const plugin = (name) => (window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || window.Capacitor.registerPlugin(name);
export async function nativeShareFile(name, text, mime = 'application/json') {
  const P = { Filesystem: plugin('Filesystem'), Share: plugin('Share') };
  const safe = name.replace(/[\\/:*?"<>|]+/g, ' ');
  const r = await P.Filesystem.writeFile({ path: safe, data: text, directory: 'CACHE', encoding: 'utf8' });
  await P.Share.share({ title: safe, files: [r.uri], dialogTitle: 'שמירה / שליחה' });
}

/** the installed apps: is there a newer version on the site → {version, url} or null */
export async function newerVersion(current) {
  if (!IS_APP || !navigator.onLine) return null;
  try {
    const v = await fetch(SITE + 'version.json?' + Date.now(), { cache: 'no-store' }).then((r) => r.json());
    const n = (s) => String(s || '0').split('.').map((x) => Number(x) || 0);
    const [a, b] = [n(v.version), n(current)];
    for (let i = 0; i < 3; i++) { if ((a[i] || 0) > (b[i] || 0)) return { version: v.version, url: SITE + 'download.html' }; if ((a[i] || 0) < (b[i] || 0)) return null; }
  } catch { /* offline */ }
  return null;
}
