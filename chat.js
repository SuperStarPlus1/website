// "סטארי" — the site's chat agent (17/10/2026). A bubble on the store's pages; the server: api/club-chat.ts (chatStatus,
// chatAsk). Shown only while the owner has it on (the club page, 🤖 tab). A member signed in to the personal area in
// this browser (club-me — localStorage ss_club_s) is sent with his session, so the server may tell him HIS details;
// without it — general questions only. The conversation lives in this tab only (sessionStorage) and is not kept on the
// server. Unknown / a person → WhatsApp to the store.
(function () {
  'use strict';
  if (window.__ssChat) return; window.__ssChat = 1;
  const API = 'https://otjhhljgdevazanrretx.supabase.co/functions/v1/api';
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } } };
  const ss = { get: (k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const lang = () => { const l = (document.documentElement.lang || '').slice(0, 2); return l === 'ar' || l === 'en' ? l : 'he'; };
  const T = {
    he: { open: 'צ׳אט עם הנציג הדיגיטלי', name: 'סטארי · הנציג הדיגיטלי', hi: 'היי! אני סטארי 👋 אפשר לשאול אותי על מבצעים, מחירים, שעות פתיחה ומועדון הלקוחות.',
      privacy: 'השיחה לא נשמרת אצלנו. אל תכתבו פרטי אשראי או סיסמאות.', ph: 'כתבו שאלה…', send: 'שליחה', wa: 'וואטסאפ לחנות', in: (n) => '🔓 מחובר/ת' + (n ? ' כ-' + n : '') + ' — אפשר לשאול על הקניות והקופונים שלך',
      out: '🔒 לשאלות על הקניות, הקופונים והטבת 41 שלך —', login: 'כניסה לאזור האישי', err: 'משהו השתבש — נסו שוב, או כתבו לנו בוואטסאפ.', clear: 'שיחה חדשה',
      chips: ['🔥 מה המבצעים השבוע?', '🕗 שעות פתיחה', '🎟 אילו קופונים יש לי?', '🎁 כמה קניות נשארו להטבה?'], waText: 'שלום, יש לי שאלה: ' },
    ar: { open: 'دردشة مع الممثل الرقمي', name: 'ستاري · الممثل الرقمي', hi: 'أهلًا! أنا ستاري 👋 اسألوني عن العروض والأسعار وساعات العمل ونادي الزبائن.',
      privacy: 'لا نحفظ المحادثة. لا تكتبوا تفاصيل بطاقة ائتمان أو كلمات سر.', ph: 'اكتبوا سؤالًا…', send: 'إرسال', wa: 'واتساب للمتجر', in: (n) => '🔓 متصل' + (n ? ' باسم ' + n : '') + ' — يمكنك السؤال عن مشترياتك وقسائمك',
      out: '🔒 للأسئلة عن مشترياتك وقسائمك وهدية 41 —', login: 'الدخول إلى المنطقة الشخصية', err: 'حدث خطأ — حاولوا مرة أخرى أو راسلونا عبر واتساب.', clear: 'محادثة جديدة',
      chips: ['🔥 ما هي عروض الأسبوع؟', '🕗 ساعات العمل', '🎟 ما هي قسائمي؟', '🎁 كم مشتريات بقيت للهدية؟'], waText: 'مرحبًا، لدي سؤال: ' },
    en: { open: 'Chat with our digital assistant', name: 'Stari · digital assistant', hi: 'Hi! I\'m Stari 👋 Ask me about deals, prices, opening hours and the customer club.',
      privacy: 'We don\'t keep the conversation. Don\'t type card details or passwords.', ph: 'Type a question…', send: 'Send', wa: 'WhatsApp the store', in: (n) => '🔓 Signed in' + (n ? ' as ' + n : '') + ' — ask about your purchases and coupons',
      out: '🔒 For questions about your purchases, coupons and 41st-basket gift —', login: 'sign in to your personal area', err: 'Something went wrong — try again or WhatsApp us.', clear: 'New chat',
      chips: ['🔥 What are this week\'s deals?', '🕗 Opening hours', '🎟 What coupons do I have?', '🎁 How many purchases to my gift?'], waText: 'Hello, I have a question: ' },
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(https:\/\/(?:www\.)?superstar-plus\.co\.il[^\s<)]*)/g, (u) => '<a href="' + u + '" target="_blank" rel="noopener">' + u.replace(/^https:\/\/(www\.)?/, '') + '</a>')
    .replace(/\n/g, '<br>');
  let msgs = ss.get('ss_chat') || [], who = ss.get('ss_chat_who'), busy = false, wa = '97249076772';

  // the bubble's icon: a support agent with a headset (17/10/2026 — the owner: clearer than 💬)
  const AGENT = '<svg viewBox="0 0 64 64" aria-hidden="true">' +
    '<path d="M12 60c0-12 9-18 20-18s20 6 20 18z" fill="#fff"/><path d="M27 42l5 7 5-7z" fill="#0076DA"/>' +
    '<circle cx="32" cy="27" r="12" fill="#ffd9b3"/><path d="M20 26c0-9 6-13 12-13s12 4 12 13c-3-5-8-7-12-7s-9 2-12 7z" fill="#5b3a29"/>' +
    '<path d="M17 29a15 15 0 0 1 30 0" fill="none" stroke="#1b2a4a" stroke-width="3.5" stroke-linecap="round"/>' +
    '<rect x="13" y="25" width="7" height="12" rx="3.5" fill="#ffcc00" stroke="#1b2a4a" stroke-width="1.5"/>' +
    '<rect x="44" y="25" width="7" height="12" rx="3.5" fill="#ffcc00" stroke="#1b2a4a" stroke-width="1.5"/>' +
    '<path d="M16.5 37c0 5 4 8 10 8" fill="none" stroke="#1b2a4a" stroke-width="2.5" stroke-linecap="round"/><circle cx="28" cy="45" r="2.8" fill="#ffcc00" stroke="#1b2a4a" stroke-width="1.2"/>' +
    '<circle cx="28" cy="28" r="1.4" fill="#1b2a4a"/><circle cx="36" cy="28" r="1.4" fill="#1b2a4a"/><path d="M28.5 33q3.5 3 7 0" fill="none" stroke="#1b2a4a" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const css = `
  .ssc-btn{position:fixed;left:16px;bottom:var(--ssc-b,20px);z-index:2600;width:76px;height:76px;border-radius:50%;border:3px solid #fff;cursor:pointer;padding:0;
    background:linear-gradient(135deg,#0076DA,#003a75);color:#fff;box-shadow:0 10px 30px rgba(0,60,140,.45);display:flex;align-items:center;justify-content:center}
  .ssc-btn svg{width:56px;height:56px;display:block}
  @media (max-width:640px){.ssc-btn{width:62px;height:62px;left:10px}.ssc-btn svg{width:46px;height:46px}}
  .ssc-btn:focus-visible{outline:3px solid #ffcc00;outline-offset:3px}
  .ssc-btn .dot{position:absolute;top:3px;right:3px;width:16px;height:16px;border-radius:50%;background:#ffcc00;border:2px solid #fff}
  .ssc{position:fixed;left:16px;bottom:var(--ssc-b,20px);z-index:3100;width:min(380px,calc(100vw - 32px));height:min(600px,calc(100dvh - var(--ssc-b,20px) - 20px));
    background:#fff;color:#1f2937;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
  .ssc[hidden],.ssc-btn[hidden]{display:none}
  .ssc-h{background:linear-gradient(135deg,#0076DA,#003a75);color:#fff;padding:10px 12px;display:flex;align-items:center;gap:8px}
  .ssc-h b{flex:1;font-size:15px}.ssc-h .ic{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center}.ssc-h .ic svg{width:28px;height:28px}.ssc-h button{background:rgba(255,255,255,.15);border:0;color:#fff;border-radius:8px;padding:4px 9px;cursor:pointer;font:inherit;font-size:13px}
  .ssc-who{font-size:12.5px;padding:6px 12px;background:#f1f6fc;border-bottom:1px solid #e5edf6}.ssc-who a{color:#0076DA;font-weight:700}
  .ssc-m{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f7f9fc}
  .ssc-m .b{max-width:85%;padding:8px 11px;border-radius:14px;white-space:normal;word-wrap:break-word}
  .ssc-m .b a{color:#0076DA;word-break:break-all}
  .ssc-m .u{align-self:flex-start;background:#0076DA;color:#fff;border-end-start-radius:4px}
  .ssc-m .a{align-self:flex-end;background:#fff;border:1px solid #e3e8ef;border-end-end-radius:4px}
  .ssc-m .n{font-size:12px;color:#64748b;text-align:center}
  .ssc-m .t{align-self:flex-end;color:#64748b}
  .ssc-c{display:flex;flex-wrap:wrap;gap:6px}.ssc-c button{border:1.5px solid #cfe0f3;background:#fff;color:#003a75;border-radius:99px;padding:4px 10px;font:inherit;font-size:13px;cursor:pointer}
  .ssc-f{display:flex;gap:6px;padding:8px;border-top:1px solid #e5e7eb}
  .ssc-f textarea{flex:1;resize:none;border:1.5px solid #d1d5db;border-radius:12px;padding:8px 10px;font:inherit;height:42px;max-height:110px}
  .ssc-f button{border:0;background:#0076DA;color:#fff;border-radius:12px;padding:0 14px;font:inherit;font-weight:700;cursor:pointer}
  .ssc-f button:disabled{opacity:.5}
  .ssc-wa{display:block;text-align:center;background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:13.5px;padding:7px}
  @media (prefers-reduced-motion:no-preference){.ssc-btn{animation:sscIn .5s ease-out}@keyframes sscIn{from{transform:scale(0)}}}`;

  function mount() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const btn = document.createElement('button');
    btn.className = 'ssc-btn'; btn.type = 'button'; btn.innerHTML = AGENT + '<span class="dot"></span>';
    const box = document.createElement('section');
    box.className = 'ssc'; box.hidden = true; box.setAttribute('role', 'dialog');
    document.body.append(btn, box);
    // above the page's own bottom strip (the home page's blue banner), whatever its height
    const lift = () => {
      const bn = document.getElementById('club-banner');
      const h = bn && getComputedStyle(bn).display !== 'none' && !bn.classList.contains('hidden') ? bn.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty('--ssc-b', Math.round(20 + h) + 'px');
    };
    lift(); setInterval(lift, 800);

    function draw() {
      const t = T[lang()], s = ls.get('ss_club_s');
      btn.setAttribute('aria-label', t.open); btn.title = t.open;
      box.setAttribute('aria-label', t.name); box.dir = lang() === 'en' ? 'ltr' : 'rtl';
      const signed = s && (who ? who.s === s : !ss.get('ss_chat_checked'));   // before the first answer: as the browser says
      box.innerHTML = '<div class="ssc-h"><span class="ic">' + AGENT + '</span><b>' + esc(t.name) + '</b><button type="button" data-x="new">' + esc(t.clear) + '</button><button type="button" data-x="close" aria-label="✕">✕</button></div>' +
        '<div class="ssc-who">' + (signed ? esc(t.in(who ? who.name : '')) : esc(t.out) + ' <a href="/club-me' + (lang() === 'ar' ? '?lang=ar' : '') + '">' + esc(t.login) + '</a>') + '</div>' +
        '<div class="ssc-m" aria-live="polite"><div class="n">' + esc(t.privacy) + '</div><div class="b a">' + esc(t.hi) + '</div>' +
        msgs.map((m) => '<div class="b ' + (m.role === 'user' ? 'u' : 'a') + '">' + (m.role === 'user' ? esc(m.content).replace(/\n/g, '<br>') : fmt(m.content)) + '</div>').join('') +
        (busy ? '<div class="b a t">…</div>' : '') +
        (!msgs.length ? '<div class="ssc-c">' + t.chips.map((c) => '<button type="button">' + esc(c) + '</button>').join('') + '</div>' : '') + '</div>' +
        '<a class="ssc-wa" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(t.waText + (lastQ() || '')) + '">🟢 ' + esc(t.wa) + '</a>' +
        '<form class="ssc-f"><textarea maxlength="600" rows="1" placeholder="' + esc(t.ph) + '" aria-label="' + esc(t.ph) + '"></textarea><button type="submit"' + (busy ? ' disabled' : '') + '>' + esc(t.send) + '</button></form>';
      const m = box.querySelector('.ssc-m'); m.scrollTop = m.scrollHeight;
      box.querySelector('[data-x=close]').onclick = () => { box.hidden = true; btn.hidden = false; btn.focus(); };
      box.querySelector('[data-x=new]').onclick = () => { msgs = []; ss.set('ss_chat', msgs); draw(); };
      box.querySelectorAll('.ssc-c button').forEach((b) => { b.onclick = () => send(b.textContent.replace(/^\S+\s/, '')); });
      const ta = box.querySelector('textarea'), f = box.querySelector('form');
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } });
      f.onsubmit = (e) => { e.preventDefault(); const v = ta.value.trim(); if (v) send(v); };
      if (!busy) ta.focus({ preventScroll: true });
    }
    const lastQ = () => { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'user') return msgs[i].content.slice(0, 300); return ''; };
    async function send(text) {
      if (busy) return;
      msgs.push({ role: 'user', content: text.slice(0, 600) }); msgs = msgs.slice(-12); busy = true; draw();
      const s = ls.get('ss_club_s') || '';
      let r;
      try { r = await (await fetch(API, { method: 'POST', body: JSON.stringify({ action: 'chatAsk', messages: msgs, s, uiLang: lang(), page: document.title }) })).json(); }
      catch (e) { r = { ok: false }; }
      busy = false;
      msgs.push({ role: 'assistant', content: r && r.answer ? r.answer : T[lang()].err });
      if (r && r.ok && !r.off) { who = r.signedIn ? { s, name: r.firstName || '' } : null; ss.set('ss_chat_checked', 1); }
      ss.set('ss_chat', msgs); ss.set('ss_chat_who', who); draw();
    }
    btn.onclick = () => { btn.hidden = true; box.hidden = false; draw(); };
    new MutationObserver(() => { if (!box.hidden) draw(); else { const t = T[lang()]; btn.setAttribute('aria-label', t.open); btn.title = t.open; } })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  fetch(API, { method: 'POST', body: JSON.stringify({ action: 'chatStatus' }) }).then((r) => r.json()).then((r) => {
    if (!r || !r.on) { if (!/[?&]chat=preview\b/.test(location.search)) return; }
    if (r && r.whatsapp) wa = r.whatsapp;
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  }).catch(() => {});
})();
