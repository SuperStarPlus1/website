// Recruitment — the "📱 SMS" tab (admins; same file in Superstar and Sidurit). Server: _shared/recruit-comm.ts
// smsSettings / saveSmsSender / smsSenderCheck / smsSenderOtp / smsSenderVerify; smsInbox / smsInboxAssign / smsInboxDrop.
//   replies to assign: an SMS reply from a phone that several candidates got an SMS from — the admin chooses whose
//   (only one of them); a reply from an unknown phone — shown to drop.
//   the sender the candidates see: 2–11 Latin letters / digits (a name — no replies), or a phone number approved with a
//   code sent to it; empty — the system's sender. This and last month's use (messages, parts, delivered) and its price.
// recruit.js draws the tab (window.rcSmsSettings) — and the delivery state of each SMS in the correspondence (recruit-comm.js).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); };
  const mAuth = () => (typeof mgrAuth === 'function' ? mgrAuth() : {});
  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const monthHe = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
  const isPhone = (s) => /^\+?[\d\s-]{9,15}$/.test(s.trim());

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.sms-box{border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;margin-bottom:12px;background:#fff}' +
    '.sms-box h4{margin:0 0 8px;font-size:15px}.sms-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
    '.sms-row input{border:1.5px solid #d1d5db;border-radius:8px;padding:7px 10px;font:inherit;font-size:14px;width:180px;direction:ltr;text-align:left}' +
    '.sms-ok{color:#166534;font-weight:700}.sms-bad{color:#b91c1c;font-weight:700}.sms-note{font-size:12.5px;color:#6b7280;margin:6px 0 0}' +
    '.sms-use{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(max-width:560px){.sms-use{grid-template-columns:1fr}}' +
    '.sms-use div{background:#f8fafc;border-radius:10px;padding:10px}.sms-use b{font-size:20px;display:block}' +
    '.sms-prev{display:inline-block;background:#eef2ff;border-radius:10px;padding:6px 10px;font-size:13px;margin-top:6px}' +
    '</style>');

  async function rcSmsSettings(pane) {
    pane.innerHTML = '<p class="rc-meta">טוען…</p>';
    const r = await apiPost({ action: 'smsSettings', ...mAuth() });
    if (!r.ok) { pane.innerHTML = '<p class="merr">' + e(r.error || 'שגיאה') + '</p>'; return; }
    const use = (u) => '<div><span class="rc-meta">' + e(monthHe(u.month)) + '</span><b>' + u.messages + ' הודעות</b>' + u.segments + ' מקטעים · ✓ נמסרו ' + u.delivered +
      (u.notDelivered ? ' · <span class="sms-bad">✗ לא נמסרו ' + u.notDelivered + '</span>' : '') + (u.pending ? ' · ממתינות לאישור ' + u.pending : '') +
      (r.pricing && r.pricing.price > 0 ? '<br>לחיוב: ' + Math.max(u.segments - r.pricing.included, 0) + ' × ₪' + r.pricing.price + ' = <b style="display:inline;font-size:14px">₪' +
        (Math.max(u.segments - r.pricing.included, 0) * r.pricing.price).toFixed(2) + '</b> (לפני מע"מ)' : '') + '</div>';
    pane.innerHTML =
      (r.waiting ? '<div class="sms-box" style="background:#fff7ed;border-color:#fed7aa">📥 <b>' + r.waiting + ' תשובות SMS ממתינות לשיוך</b> — למטה.</div>' : '') +
      (r.ready ? '' : '<div class="sms-box" style="background:#fffbeb;border-color:#fde68a">ℹ שליחת SMS עוד לא הופעלה במערכת. אפשר כבר לקבוע את שם השולח — הוא ייכנס לתוקף עם ההפעלה.</div>') +
      '<div class="sms-box"><h4>✉️ שם השולח</h4>' +
        '<p class="sms-note" style="margin:0 0 8px">כך תופיע ההודעה אצל המועמד/ת. <b>שם</b>: 2–11 אותיות באנגלית או ספרות, בלי רווחים (למשל <span dir="ltr">MyShop</span>) — למועמד/ת אי אפשר להשיב לשם. <b>מספר טלפון</b>: מאשרים פעם אחת בקוד שנשלח אליו.</p>' +
        '<div class="sms-row"><input id="smsSender" maxlength="14" placeholder="' + e(r.systemSender || 'MyShop') + '" value="' + e(r.sender) + '" spellcheck="false">' +
          '<button class="btn primary" id="smsSave">שמירה</button><button class="btn plain" id="smsCheck">בדיקה מול ספק ה-SMS</button></div>' +
        '<div id="smsOtp" style="display:none;margin-top:8px" class="sms-row"><input id="smsCode" maxlength="8" inputmode="numeric" placeholder="הקוד שהתקבל" style="width:130px">' +
          '<button class="btn primary" id="smsVerify">אישור המספר</button><button class="btn plain" id="smsResend">שליחת קוד</button></div>' +
        '<div id="smsMsg" class="sms-note"></div>' +
        '<div class="sms-prev" id="smsPrev"></div>' +
        '<p class="sms-note">ריק = שם השולח של המערכת' + (r.systemSender ? ' (<span dir="ltr">' + e(r.systemSender) + '</span>)' : '') + '.</p></div>' +
      '<div class="sms-box" id="smsReplyNote"></div>' +
      '<div class="sms-box"><h4>📥 תשובות לשיוך</h4><div id="smsInbox"><p class="rc-meta">טוען…</p></div></div>' +
      (r.inboundUrl ? '<div class="sms-box"><h4>🔗 כתובת קליטת תשובות</h4><p class="sms-note" style="margin:0 0 6px">לשלוח לתמיכה של UP Send ולבקש "קליטת הודעות נכנסות ב-PUSH (IncomingXML)" לכתובת:</p>' +
        '<input readonly dir="ltr" value="' + e(r.inboundUrl) + '" style="width:100%;font-family:monospace;font-size:12px;border:1.5px solid #d1d5db;border-radius:8px;padding:6px" onclick="this.select()"></div>' : '') +
      '<div class="sms-box"><h4>📊 שימוש</h4><div class="sms-use">' + use(r.thisMonth) + use(r.lastMonth) + '</div>' +
        '<p class="sms-note">מקטע = 70 תווים בעברית (160 באנגלית); הודעה ארוכה נשלחת בכמה מקטעים. "נמסרו" — לפי אישור המסירה מחברת הסלולר' +
        (r.pricing ? (r.pricing.included ? '. כלולים בחודש: ' + r.pricing.included + ' מקטעים' : '') + (r.pricing.price > 0 ? '. מחיר למקטע: ₪' + r.pricing.price + ' — מופיע בחשבונית החודשית.' : '.') : '.') + '</p></div>';
    const msg = (html, cls) => { $('smsMsg').innerHTML = cls ? '<span class="' + cls + '">' + html + '</span>' : html; };
    const prev = () => {
      const v = $('smsSender').value.trim() || r.systemSender || '';
      $('smsPrev').innerHTML = '📱 אצל המועמד/ת: <b dir="ltr">' + e(v || '—') + '</b>';
      // replies: only to a phone number — a name cannot be answered
      $('smsReplyNote').innerHTML = !v ? '' : isPhone(v)
        ? '💬 <b>תשובות מועמדים ייקלטו:</b> מי שעונה ל-SMS — התשובה נכנסת להתכתבות שלו/ה. אם כמה מועמדים קיבלו הודעות מאותו מספר טלפון, התשובה ממתינה כאן לשיוך ידני — ולא נכנסת לתיק לפי ניחוש.'
        : '💬 <b>לשם שולח אי אפשר להשיב.</b> מועמדים לא יוכלו לענות ב-SMS. כדי לקבל תשובות — השאירו ריק' + (r.systemSender && isPhone(r.systemSender) ? ' (המספר של המערכת)' : '') + ' או אשרו מספר טלפון.';
    };
    const otpFor = (v) => { $('smsOtp').style.display = isPhone(v) ? 'flex' : 'none'; };
    $('smsSender').addEventListener('input', () => { prev(); otpFor($('smsSender').value); msg(''); });
    prev(); otpFor(r.sender); inbox();

    async function inbox() {
      const box = $('smsInbox'); if (!box) return;
      const x = await apiPost({ action: 'smsInbox', ...mAuth() });
      if (!x.ok) { box.innerHTML = '<p class="merr">' + e(x.error || 'שגיאה') + '</p>'; return; }
      if (!x.items.length) { box.innerHTML = '<p class="sms-note" style="margin:0">אין תשובות שממתינות. תשובה של מועמד/ת שקיבל/ה SMS מאיתנו נכנסת ישר להתכתבות שלו/ה.</p>'; return; }
      const when = (v) => { const t = new Date(v); return isNaN(t) ? '' : t.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' + t.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); };
      box.innerHTML = x.items.map((it) => '<div style="border-top:1px solid #f1f5f9;padding:8px 0" data-in="' + it.id + '">' +
        '<div class="sms-note" style="margin:0">📱 <span dir="ltr">' + e(it.phone) + '</span> · ' + e(when(it.at)) + '</div>' +
        '<div style="white-space:pre-wrap;margin:4px 0">' + e(it.text) + '</div>' +
        (it.status === 'pending'
          ? '<div class="sms-row"><span class="sms-note" style="margin:0">של מי? (קיבלו SMS מהמספר הזה):</span>' + it.candidates.map((c) => '<button class="btn plain" data-as="' + c.id + '" style="font-size:12.5px">' + e(c.name) + '</button>').join('') + '<button class="btn plain" data-drop style="font-size:12.5px;color:#b91c1c">התעלמות</button></div>'
          : '<div class="sms-row"><span class="sms-note" style="margin:0">ממספר שלא קיבל מאיתנו SMS ב-30 הימים האחרונים.</span><button class="btn plain" data-drop style="font-size:12.5px;color:#b91c1c">הסרה</button></div>') +
        '</div>').join('');
      box.querySelectorAll('[data-as]').forEach((b) => b.addEventListener('click', async () => {
        const id = Number(b.closest('[data-in]').dataset.in);
        const y = await apiPost({ action: 'smsInboxAssign', ...mAuth(), id, candidateId: Number(b.dataset.as) });
        if (!y.ok) { say(y.error || 'שגיאה', 'err'); return; }
        say('שויך ל' + b.textContent + ' ✓', 'ok'); inbox();
      }));
      box.querySelectorAll('[data-drop]').forEach((b) => b.addEventListener('click', async () => {
        const id = Number(b.closest('[data-in]').dataset.in);
        const y = await apiPost({ action: 'smsInboxDrop', ...mAuth(), id });
        if (!y.ok) { say(y.error || 'שגיאה', 'err'); return; }
        inbox();
      }));
    }
    $('smsSave').addEventListener('click', async () => {
      const v = $('smsSender').value.trim();
      msg('שומר…');
      const x = await apiPost({ action: 'saveSmsSender', ...mAuth(), sender: v });
      if (!x.ok) { msg(e(x.error || 'שגיאה'), 'sms-bad'); return; }
      $('smsSender').value = x.sender; prev();
      if (!x.sender) { msg('נשמר — ההודעות יישלחו בשם השולח של המערכת', 'sms-ok'); return; }
      if (x.allowed === true) msg('✓ נשמר ומאושר אצל ספק ה-SMS', 'sms-ok');
      else if (x.allowed === false) msg(x.kind === 'phone' ? 'נשמר, אבל המספר עוד לא מאושר — לחצו "שליחת קוד" והזינו את הקוד שיגיע אליו' : '⚠ נשמר, אבל ספק ה-SMS עדיין לא מאשר את השם — הודעות עלולות להיחסם. אפשר לפנות לתמיכה של סידורית', 'sms-bad');
      else msg('נשמר' + (x.checkError ? ' (הבדיקה מול ספק ה-SMS לא הצליחה: ' + e(x.checkError) + ')' : ''));
      say('נשמר ✓', 'ok');
    });
    $('smsCheck').addEventListener('click', async () => {
      const v = $('smsSender').value.trim() || r.systemSender;
      if (!v) return;
      msg('בודק…');
      const x = await apiPost({ action: 'smsSenderCheck', ...mAuth(), sender: v });
      if (!x.ok) { msg(e(x.error || 'שגיאה'), 'sms-bad'); return; }
      msg(x.allowed ? '✓ ספק ה-SMS מאשר את השולח <span dir="ltr">' + e(v) + '</span>' : '✗ השולח <span dir="ltr">' + e(v) + '</span> עוד לא מאושר' + (x.kind === 'phone' ? ' — "שליחת קוד" למספר' : ''), x.allowed ? 'sms-ok' : 'sms-bad');
    });
    $('smsResend').addEventListener('click', async () => {
      const v = $('smsSender').value.trim();
      msg('שולח קוד…');
      const x = await apiPost({ action: 'smsSenderOtp', ...mAuth(), sender: v });
      if (!x.ok) { msg(e(x.error || 'שגיאה'), 'sms-bad'); return; }
      msg(x.allowed ? '✓ המספר כבר מאושר' : 'נשלח קוד ל-<span dir="ltr">' + e(v) + '</span> (ב-SMS, או בשיחה קולית לטלפון קווי) — הזינו אותו ולחצו "אישור המספר"', x.allowed ? 'sms-ok' : '');
      if (!x.allowed) $('smsCode').focus();
    });
    $('smsVerify').addEventListener('click', async () => {
      msg('מאמת…');
      const x = await apiPost({ action: 'smsSenderVerify', ...mAuth(), sender: $('smsSender').value.trim(), code: $('smsCode').value.trim() });
      if (!x.ok) { msg(e(x.error || 'שגיאה'), 'sms-bad'); return; }
      $('smsSender').value = x.sender; $('smsCode').value = ''; prev();
      msg('✓ המספר אושר ונשמר כשם השולח', 'sms-ok'); say('המספר אושר ✓', 'ok');
    });
  }
  window.rcSmsSettings = rcSmsSettings;
})();
