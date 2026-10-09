// Connecting a physical attendance clock (same file in the Sidurit template web/app/ and on the Superstar site;
// server: _shared/clock-handlers.ts, the models: _shared/clock-core.ts). Admin only.
//   ⚙ ניהול ← ⏱ שעון נוכחות (and from the company settings): pick the clock's model / software (the common ones in
//   Israel) → "הורדת קובץ ההתקנה" — one file with a one-time pairing code built in → double-click it on the computer
//   next to the clock: it finds the software by itself (or asks for the existing place), connects and syncs every 10
//   minutes. Here: what is connected, the last sync and its result in plain words.
//   No software (a file from the clock's USB drive) → uploaded right here, no installation.
// Uses the app's own globals: apiPost, mgrAuth, state, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const ago = (d) => { if (!d) return ''; const m = Math.round((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? 'עכשיו' : m < 60 ? 'לפני ' + m + ' דק׳' : m < 1440 ? 'לפני ' + Math.round(m / 60) + ' שע׳' : new Date(d).toLocaleDateString('he-IL'); };
  const IN = 'כניסה', OUT = 'יציאה';

  function overlay() {
    if (!$('clkOverlay')) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="clkOverlay"><div class="modal" style="max-width:640px">' +
        '<header><h3>⏱ שעון נוכחות</h3><p>חיבור שעון הנוכחות של העסק — בלי הגדרות טכניות</p></header>' +
        '<div class="mbody" id="clkBody"></div><div class="mfoot"><span class="spacer"></span><button class="btn plain" id="clkClose">סגירה</button></div></div></div>');
      $('clkClose').addEventListener('click', () => $('clkOverlay').classList.add('hidden'));
    }
    $('clkOverlay').classList.remove('hidden');
    return $('clkBody');
  }
  let S = null;
  async function open() {
    if (!isAdmin()) { say('אדמין בלבד', 'err'); return; }
    const body = overlay();
    body.innerHTML = '<p class="rc-meta">טוען…</p>';
    const r = await apiPost({ action: 'clockSetup', ...mAuth() });
    if (!r.ok) { body.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    S = r; draw();
  }
  function draw() {
    const body = $('clkBody'), info = S.info;
    // the status the installer's sync reports — or, for a computer still on the older script, the last import itself
    const st = S.status || (S.lastSync ? { at: S.lastSync.at, ok: true, message: S.lastSync.details } : null);
    const stale = !st || (Date.now() - new Date(st.at).getTime()) > 40 * 60000;
    body.innerHTML =
      (S.connected ? '<div style="border:1.5px solid ' + (st && st.ok && !stale ? '#bbf7d0' : '#fcd34d') + ';border-radius:12px;padding:10px 12px;background:' + (st && st.ok && !stale ? '#f0fdf4' : '#fffbeb') + ';margin-bottom:12px">' +
          '<b>' + (st && st.ok && !stale ? '✅ השעון מחובר ומסנכרן' : st && !st.ok ? '⚠ השעון מחובר, אבל הסנכרון האחרון נכשל' : '⚠ השעון מחובר — אין סנכרון לאחרונה') + '</b>' +
          (info ? '<div class="rc-meta">' + e(info.label) + (info.computer ? ' · מחשב: ' + e(info.computer) : '') + ' · חובר ' + e(ago(info.pairedAt)) + '</div>' : '') +
          (st ? '<div style="font-size:13.5px;margin-top:4px">סנכרון אחרון: ' + e(ago(st.at)) + ' — ' + e(st.message) + '</div>' : '') +
          (stale ? '<div style="font-size:13px;margin-top:4px">בדקו שמחשב השעון דלוק ומחובר לאינטרנט, ושמישהו מחובר אליו (Windows).</div>' : '') +
          '<button class="btn plain" id="clkOff" style="font-size:12.5px;margin-top:6px;color:#b91c1c">ניתוק המחשב</button></div>' : '') +
      (!S.usesClock ? '<p class="rc-warn">כדי לחבר שעון, בוחרים קודם בהגדרות החברה: אופן דיווח הנוכחות — "גם שעון נוכחות פיזי".</p>' : '') +
      '<b>' + (S.connected ? 'חיבור מחדש / שעון אחר' : 'איזה שעון או תוכנה יש לכם?') + '</b>' +
      (S.connected ? '<p class="rc-meta" style="margin:2px 0">חיבור חדש מחליף את המחשב המחובר עכשיו.</p>' : '') +
      '<div style="display:grid;gap:6px;margin:8px 0">' + S.types.map((t) => '<label style="display:flex;gap:8px;align-items:flex-start;border:1.5px solid #e5e7eb;border-radius:10px;padding:7px 10px;cursor:pointer">' +
        '<input type="radio" name="clkKind" value="' + t.id + '"' + (info && info.kind === t.id ? ' checked' : '') + ' style="margin-top:4px"><span><b style="font-size:14px">' + e(t.label) + '</b><br><span class="rc-meta">' + e(t.note) + '</span></span></label>').join('') + '</div>' +
      '<div id="clkNext"></div>';
    if ($('clkOff')) $('clkOff').addEventListener('click', async () => {
      if (!confirm('לנתק את מחשב השעון? הסנכרון יפסיק עד חיבור מחדש.')) return;
      const r = await apiPost({ action: 'clockDisconnect', ...mAuth() });
      if (r.ok) { say('נותק', 'ok'); open(); }
    });
    body.querySelectorAll('[name=clkKind]').forEach((x) => x.addEventListener('change', next));
    if (body.querySelector('[name=clkKind]:checked')) next();
  }
  function next() {
    const t = S.types.find((x) => x.id === ($('clkBody').querySelector('[name=clkKind]:checked') || {}).value);
    const box = $('clkNext');
    if (!t) { box.innerHTML = ''; return; }
    if (t.method === 'upload') {
      box.innerHTML = '<div class="hr-legal">מעבירים את הקובץ מהשעון לדיסק-און-קי (בתפריט השעון: הורדת נוכחות / Download Attlog), מחברים למחשב ובוחרים אותו כאן.</div>' +
        '<label class="btn primary" style="cursor:pointer">📂 בחירת הקובץ מהדיסק-און-קי<input type="file" id="clkFile" accept=".dat,.txt,.csv,.log" hidden></label><div id="clkRes" style="margin-top:8px"></div>';
      $('clkFile').addEventListener('change', upload);
      return;
    }
    box.innerHTML = '<ol class="steps" style="font-size:14px;line-height:1.7;padding-inline-start:20px">' +
      '<li>מורידים את <b>קובץ ההתקנה</b> (הכפתור למטה) — במחשב שמחובר לשעון, או מעבירים אליו את הקובץ. אם הדפדפן שואל אם לשמור — בוחרים <b>שמירה</b>.</li>' +
      '<li>לוחצים עליו פעמיים. אם Windows שואל "האם להפעיל?" — עונים <b>הפעלה</b>.</li>' +
      '<li>בחלון שנפתח המערכת מוצאת את ' + e(t.brand === 'כללי' ? 'התוכנה' : 'תוכנת ' + t.brand) + ' לבד. אם היא לא מוצאת — כתוב "לא זוהתה התקנה", ובוחרים את המיקום הקיים' +
      (t.method === 'api' ? '. נכנסים עם שם המשתמש והסיסמה של תוכנת השעון' : '') + '.</li>' +
      '<li>לוחצים <b>"חיבור והפעלה"</b> — וזהו. מכאן הנוכחות נשלחת לבד כל 10 דקות.</li></ol>' +
      '<button class="btn primary" id="clkDl"' + (S.usesClock ? '' : ' disabled') + '>⬇ הורדת קובץ ההתקנה</button>' +
      '<p class="rc-meta">הקובץ אישי לחברה ותקף ל-24 שעות, לחיבור אחד. אחר כך מורידים חדש.</p>' +
      '<p class="rc-meta">חשוב: מספר העובד בשעון צריך להיות רשום בכרטיס העובד ("מספר בשעון"), כדי שההחתמות יגיעו לעובד הנכון.</p>';
    $('clkDl').addEventListener('click', () => download(t));
  }

  /** the installer: a .cmd that unpacks the script (base64 — Hebrew safe) and runs it */
  async function download(t) {
    const r = await apiPost({ action: 'clockPairStart', ...mAuth(), kind: t.id });
    if (!r.ok) { say(r.error || 'שגיאה', 'err'); return; }
    const res = await fetch('clock/clock-setup.ps1', { cache: 'no-store' });
    if (!res.ok) { say('קובץ ההתקנה לא נמצא', 'err'); return; }
    const fill = { __API__: r.api, __COMPANY__: r.company || '', __PAIR__: r.code, __KIND__: r.kind, __PRODUCT__: r.product, __LABEL__: r.label.replace(/'/g, '’') };
    let ps = await res.text();
    Object.entries(fill).forEach(([k, v]) => { ps = ps.split("'" + k + "'").join("'" + String(v).replace(/'/g, "''") + "'"); });
    const bytes = new TextEncoder().encode(ps.replace(/\r?\n/g, '\r\n'));   // UTF-8 → base64 (in pieces — one long spread would overflow)
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const b64 = btoa(bin);
    const lines = b64.match(/.{1,76}/g).join('\r\n');
    const cmd = '@echo off\r\n' +
      'title Clock setup\r\n' +
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText(\'%~f0\');$i=$t.LastIndexOf(\'#B64\'+\':\');$b=($t.Substring($i+5)) -replace \'\\s\',\'\';' +
      '$p=Join-Path $env:TEMP \'sidurit-clock-setup.ps1\';[IO.File]::WriteAllText($p,[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b)),(New-Object Text.UTF8Encoding $true));' +
      '& powershell -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File $p"\r\n' +
      'exit /b\r\n#B64:\r\n' + lines + '\r\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([cmd], { type: 'application/octet-stream' }));
    a.download = 'חיבור-שעון-נוכחות.cmd';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say('הקובץ הורד ✓ — מפעילים אותו במחשב של השעון', 'ok');
  }

  /* ---------- a file from the clock's USB drive (no installation) — same reading as the installer ---------- */
  const RX_ISO = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T,;\t]+(\d{1,2}):(\d{2})/, RX_DMY = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})[ T,;\t]+(\d{1,2}):(\d{2})/;
  const typeOf = (v) => { const s = String(v).trim().toUpperCase(); return ['I', 'IN', 'B', IN].includes(s) ? 'in' : ['O', 'OUT', 'E', OUT].includes(s) ? 'out' : ''; };
  const p2 = (n) => String(n).padStart(2, '0');
  function parseLine(line) {
    let m = RX_ISO.exec(line), y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; } else { m = RX_DMY.exec(line); if (!m) return null; y = +m[3]; if (y < 100) y += 2000; mo = +m[2]; d = +m[1]; }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const rest = line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length);
    const fields = rest.split(/[\t,;]|\s{2,}/).map((x) => x.trim().replace(/^"|"$/g, '')).filter(Boolean);
    const emp = fields.find((x) => /^\d{1,12}$/.test(x));
    if (!emp) return null;
    let type = ''; for (const f of fields) { const t = typeOf(f); if (t) { type = t; break; } }
    return { emp: emp.replace(/^0+(?=\d)/, ''), date: y + '-' + p2(mo) + '-' + p2(d), time: p2(m[4]) + ':' + m[5], type };
  }
  async function upload() {
    const f = $('clkFile').files[0];
    if (!f) return;
    const text = await f.text(), out = $('clkRes');
    // Synel's fixed-width DAT (…B / …E at the end): the server reads those lines as they are
    const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
    const fixed = lines.filter((l) => l.length >= 30 && /[BE]$/.test(l) && !/[,;\t]/.test(l));
    const recs = lines.filter((l) => !fixed.includes(l)).map(parseLine).filter(Boolean).sort((a, b) => (a.emp + a.date + a.time).localeCompare(b.emp + b.date + b.time));
    let prev = '', n = 0;
    for (const r of recs) { const k = r.emp + '|' + r.date; if (k !== prev) { prev = k; n = 0; } if (!r.type) r.type = n % 2 ? 'out' : 'in'; n++; }
    if (!recs.length && !fixed.length) { out.innerHTML = '<p class="merr">לא נמצאו בקובץ החתמות שאפשר לקרוא.</p>'; return; }
    out.innerHTML = '<p class="rc-meta">שולח ' + (recs.length + fixed.length) + ' החתמות…</p>';
    let sent = 0; const unmapped = new Set();
    for (let i = 0; i < recs.length; i += 2000) {
      const r = await apiPost({ action: 'importAttendanceDat', ...mAuth(), sourceLabel: 'קובץ מהשעון: ' + f.name,
        records: recs.slice(i, i + 2000).map((x) => ({ clockEmpNo: x.emp, date: x.date, time: x.time, type: x.type === 'out' ? OUT : IN })) });
      if (!r.ok) { out.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
      sent += Math.min(2000, recs.length - i); (r.unmapped || []).forEach((u) => unmapped.add(u.clockEmpNo));
    }
    if (fixed.length) {
      const r = await apiPost({ action: 'importAttendanceDat', ...mAuth(), sourceLabel: 'קובץ מהשעון: ' + f.name, text: fixed.join('\n') });
      if (!r.ok) { out.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
      sent += fixed.length; (r.unmapped || []).forEach((u) => unmapped.add(u.clockEmpNo));
    }
    out.innerHTML = '<p style="color:#166534;font-weight:800">✅ נקלטו ' + sent + ' החתמות.</p>' +
      (unmapped.size ? '<p class="rc-warn">מספרי שעון שאין להם עובד במערכת: ' + e([...unmapped].slice(0, 15).join(', ')) + ' — רושמים אותם בכרטיס העובד ("מספר בשעון") ומעלים שוב.</p>' : '');
  }

  function start() {
    const drop = $('menuAdminDrop');
    if (drop && !$('clkMenuBtn')) {
      drop.insertAdjacentHTML('beforeend', '<button id="clkMenuBtn">⏱ שעון נוכחות</button>');
      $('clkMenuBtn').addEventListener('click', open);
      $('menuAdminBtn')?.addEventListener('click', () => { $('clkMenuBtn').style.display = isAdmin() ? '' : 'none'; }, true);
    }
  }
  window.openClockSetup = open;
  window.clockParseLine = parseLine;   // tests
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
