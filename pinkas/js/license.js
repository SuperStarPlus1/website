// Pinkas — the standalone app's activation: a code issued by the operator (Sidurit platform page, 📒 tab) for this
// device, with an expiry date. Checked offline: the operator's signature (ECDSA P-256 — only the public key is here;
// the private one never leaves the server, supabase/functions/_shared/pinkas-license.ts), this device's code, the date.
// The date never goes back: the latest date ever seen (here or from the server) counts — setting the clock back does
// not bring back an expired code. Online, once a day: a revoked code stops, an extended one is swapped in by itself,
// and a signed monthly permit ("lease", 30 days) is renewed — without connecting for 30 days the app stops until it
// checks in (so a revoked code is enforced within a month even on a device kept offline).
import { dev, idb } from './store.js';
import { today, addDays } from './calc.js';
import { FN } from './cloud.js';

export const PUB = 'BDs0Ydjt8Ticm8KnTV6O8MTeX38Gb26DIMI6fNEZtiaM0v05UFEKC2MVJ-QNxcmKnXsXwbWpLS_AX8Jwzs1MTSs';
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** this device's code (XXXX-XXXX-XXXX) — made once, kept in two places */
export async function deviceCode() {
  let c = dev.get('device') || (await idb.get('meta', 'device'))?.code;
  if (!c) {
    const r = crypto.getRandomValues(new Uint8Array(12));
    const s = Array.from(r, (b) => B32[b % 32]).join('');
    c = s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8);
  }
  dev.set('device', c);
  await idb.put('meta', { id: 'device', code: c });
  return c;
}
/** "PK1.<payload>.<signature>" → the payload, or null (also accepts the activation link) */
export const verifyCode = (raw) => verifyWith(PUB, raw);
export async function verifyWith(pub, raw) {
  const m = /PK1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/.exec(String(raw || '').replace(/\s+/g, ''));
  if (!m) return null;
  try {
    const key = await crypto.subtle.importKey('raw', unb64u(pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64u(m[2]), new TextEncoder().encode(m[1]));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64u(m[1])));
    return { ...p, code: 'PK1.' + m[1] + '.' + m[2] };
  } catch { return null; }
}
/** today, never earlier than any day already seen */
function seenToday(serverDay) {
  const t = [today(), dev.get('seen') || '', serverDay || ''].sort().pop();
  dev.set('seen', t);
  return t;
}
const daysTo = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** until when this device may work without checking in: the signed permit, or 30 days from the code's issue */
async function leaseUntil(p) {
  const l = await verifyCode(dev.get('lease') || '');
  const fromLease = l && l.k === 'lease' && l.i === p.i && l.d === p.d ? l.u : '';
  return [fromLease, addDays(p.t || today(), 30)].sort().pop();
}
/** {status: none | invalid | otherDevice | revoked | expired | needsOnline | ok, p, days, leaseDays} */
export async function licenseState() {
  const code = dev.get('license');
  if (!code) return { status: 'none' };
  const p = await verifyCode(code);
  if (!p || p.k) return { status: 'invalid' };
  if (p.d !== await deviceCode()) return { status: 'otherDevice', p };
  if (dev.get('licRevoked') === p.i) return { status: 'revoked', p };
  const t = seenToday();
  if (t > p.e) return { status: 'expired', p, days: daysTo(p.e, t) };
  const lu = await leaseUntil(p);
  if (t > lu) return { status: 'needsOnline', p };
  return { status: 'ok', p, days: daysTo(t, p.e), leaseDays: daysTo(t, lu) };
}
/** a code typed / pasted / from a link → saved if it is good for this device. → '' or why not */
export async function activate(raw) {
  const p = await verifyCode(raw);
  if (!p || p.k) return 'הקוד לא תקין — מעתיקים אותו במלואו (מתחיל ב-PK1.)';
  if (p.d !== await deviceCode()) return 'הקוד הזה הונפק למכשיר אחר (' + p.d + ')';
  if (seenToday() > p.e) return 'תוקף הקוד הסתיים ב-' + p.e.split('-').reverse().join('/');
  dev.set('license', p.code);
  if (dev.get('licRevoked') === p.i) dev.set('licRevoked', null);
  return '';
}
/** online, at most once a day: revoked / extended / the real date */
export async function refreshLicense(force = false) {
  const code = dev.get('license');
  if (!code || !navigator.onLine) return;
  const last = dev.get('licChecked');
  if (!force && last && Date.now() - last < 20 * 3600e3) return;
  const r = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'licenseStatus', code }), signal: AbortSignal.timeout(6000) })
    .then((x) => x.json()).catch(() => null);
  if (!r || !r.ok) return;
  dev.set('licChecked', Date.now());
  if (r.today) seenToday(r.today);
  const p = await verifyCode(code);
  if (r.revoked && p) dev.set('licRevoked', p.i);
  if (r.code && (await verifyCode(r.code))) dev.set('license', r.code);
  if (r.lease) { const l = await verifyCode(r.lease); if (l && l.k === 'lease') dev.set('lease', r.lease); }
}
