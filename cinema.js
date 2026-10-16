// The home page's "trailer" (16/10/2026 — instead of the store video): a cinematic show of the products NEW ON THE
// SHELF, built live from data/new.json + the catalog (so it changes by itself every night). No video file: scenes in
// CSS — an opening title, spotlights and a zoom from blur, a light sweep, a quick montage, a 3D carousel, a closing
// frame. Few new products → this week's promos fill in. The site's "reduce motion" (accessibility) keeps it still.
(function () {
  const CSS = `
.cin{position:relative;width:100%;max-width:1000px;margin:10px auto 40px;aspect-ratio:16/9;overflow:hidden;border-radius:20px;background:#04060d;color:#fff;cursor:pointer;box-shadow:0 25px 60px rgba(0,40,100,.35);isolation:isolate;user-select:none}
.cin::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#12305e 0%,#060a18 62%,#020308 100%);z-index:0}
.cin-bg{position:absolute;inset:-60%;z-index:1;background:conic-gradient(from 0deg,transparent 0 18deg,rgba(0,118,218,.38) 28deg,transparent 42deg 118deg,rgba(255,204,0,.22) 130deg,transparent 145deg 215deg,rgba(0,118,218,.32) 228deg,transparent 242deg 300deg,rgba(255,255,255,.12) 310deg,transparent 322deg);filter:blur(22px);animation:cinSpin 22s linear infinite}
.cin-stage{position:absolute;inset:0;z-index:2}
.cin-stage>*{position:absolute;inset:0}
.cin-vig{position:absolute;inset:0;z-index:5;pointer-events:none;background:radial-gradient(ellipse at center,transparent 52%,rgba(0,0,0,.78) 100%)}
.cin-grain{position:absolute;inset:-50%;z-index:6;pointer-events:none;opacity:.09;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");animation:cinGrain .9s steps(6) infinite}
.cin-bar{position:absolute;left:0;right:0;height:6.5%;background:#000;z-index:7;pointer-events:none}
.cin-bar.t{top:0}.cin-bar.b{bottom:0}
.cin-prog{position:absolute;left:0;right:0;bottom:0;height:3px;z-index:8;background:rgba(255,255,255,.08)}
.cin-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffcc00,#fff3b0)}
.cin-flash{position:absolute;inset:0;z-index:9;background:#fff;pointer-events:none;animation:cinFlash .55s ease-out forwards}
.cin-out{animation:cinOut .55s ease-in forwards}
.cin-out.whip{animation:cinWhip .5s ease-in forwards}

/* the opening / closing titles */
.cin-intro{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:2%}
.cin-intro h2{margin:0;font-size:clamp(2rem,7.5vw,4.6rem);font-weight:900;letter-spacing:.02em;filter:drop-shadow(0 6px 24px rgba(255,204,0,.35))}
.cin-intro h2 span{display:inline-block;margin:0 .14em;padding:0 .04em;background:linear-gradient(180deg,#fff7c2 0%,#ffcc00 55%,#e09a00 100%);-webkit-background-clip:text;background-clip:text;color:transparent;animation:cinWord .8s cubic-bezier(.2,.9,.25,1.2) both}
.cin-intro p{margin:0;font-size:clamp(.9rem,2.6vw,1.45rem);letter-spacing:.35em;color:#cfe3ff;animation:cinFadeUp .9s .9s both}
.cin-flare{position:absolute;top:44%;left:0;width:60%;height:3px;background:linear-gradient(90deg,transparent,#fff,#ffe680,#fff,transparent);box-shadow:0 0 30px 8px rgba(255,230,128,.7);animation:cinFlare 1.6s .25s ease-in-out both}
.cin-intro .cin-logo{width:clamp(70px,16%,150px);animation:cinLogo 1.2s cubic-bezier(.2,.9,.25,1.2) both;filter:drop-shadow(0 10px 30px rgba(0,118,218,.6))}
.cin-cta{margin-top:2%;padding:.6em 1.6em;border-radius:40px;background:#ffcc00;color:#003a75;font-weight:800;font-size:clamp(.9rem,2.4vw,1.25rem);animation:cinPop .6s 1s both,cinPulse 1.6s 1.6s ease-in-out infinite}

/* one product: a spotlight, a zoom from blur, a light sweep */
.cin-hero{display:flex;align-items:center;gap:5%;padding:9% 7%;box-sizing:border-box}
.cin-hero.flip{flex-direction:row-reverse}
.cin-light{position:absolute;top:-30%;width:55%;height:150%;background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,0) 75%);clip-path:polygon(42% 0,58% 0,100% 100%,0 100%);filter:blur(6px);animation:cinBeam 4.8s ease-in-out both;pointer-events:none}
.cin-hero .cin-light{right:3%}.cin-hero.flip .cin-light{right:auto;left:3%}
.cin-card{position:relative;flex:0 0 40%;aspect-ratio:1/1;background:#fff;border-radius:22px;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px rgba(255,204,0,.55),0 0 70px rgba(0,140,255,.55);-webkit-box-reflect:below 8px linear-gradient(transparent 62%,rgba(255,255,255,.22));animation:cinZoom 1.15s cubic-bezier(.2,.85,.2,1) both,cinFloat 3.6s 1.15s ease-in-out infinite alternate}
.cin-card img{width:88%;height:88%;object-fit:contain;animation:cinKen 5.5s ease-out both}
.cin-shine{position:absolute;inset:-20%;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.95) 50%,transparent 62%);mix-blend-mode:overlay;transform:translateX(-130%);animation:cinShine 1.3s 1.25s ease-in-out both}
.cin-txt{flex:1;min-width:0;text-align:start;z-index:1}
.cin-stamp{display:inline-block;padding:.35em 1em;border-radius:8px;background:#e53935;color:#fff;font-weight:900;font-size:clamp(.8rem,2.2vw,1.2rem);letter-spacing:.06em;box-shadow:0 6px 20px rgba(229,57,53,.5);animation:cinSlam .55s .55s cubic-bezier(.3,1.6,.5,1) both}
.cin-stamp.new{background:#0076DA;box-shadow:0 6px 20px rgba(0,118,218,.6)}
.cin-txt h3{margin:.45em 0 .3em;font-size:clamp(1.15rem,3.9vw,2.4rem);line-height:1.18;font-weight:800;text-shadow:0 4px 18px rgba(0,0,0,.6);overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;animation:cinRise .8s .85s cubic-bezier(.2,.8,.2,1) both}
.cin-price{display:inline-block;font-size:clamp(1.4rem,5vw,3.1rem);font-weight:900;color:#ffcc00;text-shadow:0 0 22px rgba(255,204,0,.55);animation:cinPop .55s 1.35s cubic-bezier(.3,1.6,.5,1) both}
.cin-was{font-size:.45em;color:#9fb3cc;text-decoration:line-through;margin-inline-start:.5em;text-shadow:none}

/* the quick montage */
.cin-mont{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:3%;padding:10% 8%;box-sizing:border-box;animation:cinMontZoom 3.6s ease-in-out both}
.cin-mont .tile{background:#fff;border-radius:16px;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 0 30px rgba(0,140,255,.45);animation:cinTile .45s cubic-bezier(.3,1.5,.5,1) both}
.cin-mont .tile img{width:86%;height:86%;object-fit:contain}
.cin-cap{position:absolute;inset:auto 0 9% 0 !important;text-align:center;font-weight:900;font-size:clamp(1.1rem,4vw,2.4rem);color:#ffcc00;text-shadow:0 4px 20px rgba(0,0,0,.9);animation:cinRise .7s 1.5s both}

/* the 3D carousel */
.cin-orbit{perspective:1100px;display:flex;align-items:center;justify-content:center}
.cin-ring{position:relative;width:24%;aspect-ratio:1/1;transform-style:preserve-3d;animation:cinOrbit 9s linear both}
.cin-ring .tile{position:absolute;inset:0;background:#fff;border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(0,140,255,.5);-webkit-box-reflect:below 6px linear-gradient(transparent 65%,rgba(255,255,255,.2))}
.cin-ring .tile img{width:86%;height:86%;object-fit:contain}

@media (max-width:640px){
 .cin{aspect-ratio:4/5;border-radius:16px}
 .cin-hero,.cin-hero.flip{flex-direction:column;justify-content:center;padding:12% 8%;gap:5%;text-align:center}
 .cin-card{flex:0 0 auto;width:62%}
 .cin-txt{flex:0 0 auto;text-align:center}
 .cin-mont{grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(3,1fr);padding:14% 10%}
 .cin-ring{width:42%}
 .cin-light{width:90%}
}
@keyframes cinSpin{to{transform:rotate(360deg)}}
@keyframes cinGrain{0%{transform:translate(0,0)}20%{transform:translate(-8%,4%)}40%{transform:translate(6%,-6%)}60%{transform:translate(-4%,8%)}80%{transform:translate(8%,2%)}100%{transform:translate(0,0)}}
@keyframes cinFlash{from{opacity:.85}to{opacity:0}}
@keyframes cinOut{to{opacity:0;transform:scale(1.08);filter:blur(10px)}}
@keyframes cinWhip{to{opacity:0;transform:translateX(-35%) skewX(-8deg);filter:blur(14px)}}
@keyframes cinWord{from{opacity:0;transform:translateY(60%) rotateX(80deg) scale(.6);filter:blur(8px)}to{opacity:1;transform:none;filter:none}}
@keyframes cinFadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes cinFlare{from{transform:translateX(-110%);opacity:0}15%{opacity:1}85%{opacity:1}to{transform:translateX(190%);opacity:0}}
@keyframes cinLogo{from{opacity:0;transform:rotateY(540deg) scale(.3)}to{opacity:1;transform:none}}
@keyframes cinPulse{50%{transform:scale(1.07);box-shadow:0 0 30px rgba(255,204,0,.7)}}
@keyframes cinBeam{0%{opacity:0;transform:rotate(-14deg)}25%{opacity:1}60%{transform:rotate(8deg)}100%{opacity:.7;transform:rotate(-4deg)}}
@keyframes cinZoom{from{opacity:0;transform:scale(1.8) rotate(-8deg);filter:blur(16px) brightness(2.2)}to{opacity:1;transform:none;filter:none}}
@keyframes cinFloat{from{transform:translateY(0) rotate(0)}to{transform:translateY(-3%) rotate(1.2deg)}}
@keyframes cinKen{from{transform:scale(1)}to{transform:scale(1.12)}}
@keyframes cinShine{from{transform:translateX(-130%)}to{transform:translateX(130%)}}
@keyframes cinSlam{from{opacity:0;transform:scale(3) rotate(-14deg)}to{opacity:1;transform:rotate(-3deg)}}
@keyframes cinRise{from{opacity:0;transform:translateY(40px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes cinPop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}
@keyframes cinMontZoom{from{transform:scale(1)}to{transform:scale(1.06)}}
@keyframes cinTile{from{opacity:0;transform:scale(.2) rotate(10deg)}to{opacity:1;transform:none}}
@keyframes cinOrbit{from{transform:rotateX(-8deg) rotateY(0)}to{transform:rotateX(-8deg) rotateY(-360deg)}}
body.reduce-motion .cin-bg,body.reduce-motion .cin-grain{display:none}
`;
  const T = {
    he: { title: 'חדש על המדף', sub: 'השבוע בסופרסטאר פלוס', stampNew: '🆕 חדש!', stampPromo: '🔥 מבצע', mont: 'מה חדש אצלנו? 👀', orbit: 'הגיעו השבוע למדפים', cta: 'לכל המוצרים החדשים ←', end: 'בואו לגלות' },
    ar: { title: 'جديد على الرف', sub: 'هذا الأسبوع في سوبر ستار بلس', stampNew: '🆕 جديد!', stampPromo: '🔥 عرض', mont: 'ما الجديد عندنا؟ 👀', orbit: 'وصلت هذا الأسبوع', cta: '← كل المنتجات الجديدة', end: 'تعالوا اكتشفوا' },
    en: { title: 'New on the Shelf', sub: 'This week at Super Star Plus', stampNew: '🆕 NEW!', stampPromo: '🔥 DEAL', mont: "What's new? 👀", orbit: 'Just arrived this week', cta: 'All new products →', end: 'Come and discover' },
  };
  const tx = () => T[(typeof currentLang !== 'undefined' && T[currentLang]) ? currentLang : 'he'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const img = (it) => '<img src="' + esc(it.url) + '" alt="' + esc(it.name) + '" onerror="imgFallback(this)" draggable="false">';

  let root, stage, prog, items = [], timer = null, cur = null, step = 0, pool = 0;

  function gather() {
    const fresh = (window._newItems || []).map((f) => {
      const bc = String(f.public_id).split('/').pop(), p = typeof findProductByBarcode === 'function' ? findProductByBarcode(bc) : null;
      return p && p.Name ? { kind: 'new', url: f.url, name: p.Name, price: p.Price || '', barcode: bc } : null;
    }).filter(Boolean);
    if (fresh.length >= 8) return fresh;
    const seen = new Set();
    const promos = (window._promoData || []).filter((p) => /\/products\//.test(p.url) && !seen.has(p.url) && seen.add(p.url))
      .map((p) => ({ kind: 'promo', url: p.url, name: p.desc, price: p.price, was: p.regularPrice, p }));
    return fresh.concat(promos.slice(0, 16 - fresh.length));
  }
  const take = (n) => { const out = []; for (let i = 0; i < n; i++) out.push(items[(pool + i) % items.length]); pool = (pool + n) % items.length; return out; };

  // the scenes — each returns its length (ms)
  const scenes = {
    intro() {
      const t = tx();
      stage.innerHTML = '<div class="cin-intro"><div class="cin-flare"></div><h2>' + t.title.split(' ').map((w, i) => '<span style="animation-delay:' + (0.15 + i * 0.16) + 's">' + esc(w) + '</span>').join(' ') + '</h2><p>' + esc(t.sub) + '</p></div>';
      cur = null; return 3200;
    },
    hero(flip) {
      const it = take(1)[0], t = tx(); cur = it;
      stage.innerHTML = '<div class="cin-hero' + (flip ? ' flip' : '') + '"><div class="cin-light"></div><div class="cin-card">' + img(it) + '<span class="cin-shine"></span></div>' +
        '<div class="cin-txt"><span class="cin-stamp' + (it.kind === 'new' ? ' new' : '') + '">' + esc(it.kind === 'new' ? t.stampNew : t.stampPromo) + '</span><h3>' + esc(it.name) + '</h3>' +
        (it.price ? '<span class="cin-price">₪' + esc(it.price) + (it.kind === 'promo' && it.was && it.was !== it.price ? '<span class="cin-was">₪' + esc(it.was) + '</span>' : '') + '</span>' : '') + '</div></div>';
      return 4800;
    },
    montage() {
      const list = take(6), t = tx(); cur = null;
      stage.innerHTML = '<div class="cin-mont">' + list.map((it, i) => '<div class="tile" style="animation-delay:' + (i * 0.13) + 's">' + img(it) + '</div>').join('') + '</div><div class="cin-cap">' + esc(t.mont) + '</div>';
      return 3600;
    },
    orbit() {
      const list = take(Math.min(8, items.length)), t = tx(), n = list.length; cur = null;
      const tw = stage.clientWidth * (stage.clientWidth < 640 ? 0.42 : 0.24), r = Math.round(tw / (2 * Math.tan(Math.PI / Math.max(n, 3))) * 1.2);
      stage.innerHTML = '<div class="cin-orbit"><div class="cin-ring">' + list.map((it, i) => '<div class="tile" style="transform:rotateY(' + (i * 360 / n) + 'deg) translateZ(' + r + 'px)">' + img(it) + '</div>').join('') + '</div></div><div class="cin-cap">' + esc(t.orbit) + '</div>';
      return 5200;
    },
    outro() {
      const t = tx(); cur = 'all';
      stage.innerHTML = '<div class="cin-intro"><img class="cin-logo" src="img/logo.webp" alt=""><h2><span>' + esc(t.end) + '</span></h2><span class="cin-cta">' + esc(t.cta) + '</span></div>';
      return 3600;
    },
  };
  const PLAN = ['intro', 'hero', 'hero', 'hero', 'montage', 'hero', 'hero', 'orbit', 'hero', 'hero', 'outro'];

  function next() {
    const name = PLAN[step % PLAN.length];
    const old = stage.firstElementChild;
    const go = () => {
      if (name === 'intro' || name === 'montage' || name === 'outro') root.insertAdjacentHTML('beforeend', '<div class="cin-flash"></div>');
      root.querySelectorAll('.cin-flash').forEach((f) => setTimeout(() => f.remove(), 600));
      const ms = name === 'hero' ? scenes.hero(step % 2 === 1) : scenes[name]();
      prog.style.transition = 'none'; prog.style.width = '0';
      requestAnimationFrame(() => requestAnimationFrame(() => { prog.style.transition = 'width ' + ms + 'ms linear'; prog.style.width = '100%'; }));
      step++;
      timer = setTimeout(next, ms);
    };
    if (old) { [...stage.children].forEach((c) => c.classList.add('cin-out', ...(Math.random() < 0.5 ? ['whip'] : []))); setTimeout(go, 480); } else go();
  }

  function start() {
    root = document.getElementById('cinema');
    if (!root) return false;
    if (root.dataset.on) return true;
    items = gather();
    if (items.length < 3) return false;
    root.dataset.on = '1';
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root.innerHTML = '<div class="cin-bg"></div><div class="cin-stage"></div><div class="cin-vig"></div><div class="cin-grain"></div><div class="cin-bar t"></div><div class="cin-bar b"></div><div class="cin-prog"><i></i></div>';
    stage = root.querySelector('.cin-stage'); prog = root.querySelector('.cin-prog i');
    root.style.display = '';
    root.addEventListener('click', () => {
      if (cur && cur !== 'all') {
        const i = cur.kind === 'promo' ? (window._promoData || []).indexOf(cur.p) : -1;
        if (i >= 0) return zoomPromoByIdx(i);
        return zoomProduct(cur.url, cur.barcode || '');
      }
      nav('new-page');
    });
    // a tab in the background: no need to play
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(timer); timer = null; } else if (!timer) next(); });
    next();
    return true;
  }
  // waits for the catalog and data/new.json (index.html loads them)
  window.cinemaStart = function () {
    let tries = 0;
    const iv = setInterval(() => { if (start() || ++tries > 40) clearInterval(iv); }, 500);
  };
})();
