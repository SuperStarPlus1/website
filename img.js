// The product photos (16/10/2026): Supabase Storage — products/<barcode>.webp (shrunk once to 600 px on the store PC,
// only the active catalog's products; sync_images_supabase.py). While moving from Cloudinary: a photo not there yet
// is tried at Cloudinary, then the logo.
const IMG_SB = 'https://otjhhljgdevazanrretx.supabase.co/storage/v1/object/public/products/';
const IMG_LOGO = 'img/logo.webp';
function prodImg(bc) { return IMG_SB + encodeURIComponent(String(bc || '').trim().replace(/\.0$/, '')) + '.webp'; }
// (an <img> that is reused for another product — the price checker — starts again: nothing is remembered on it)
function imgFallback(el) {
  const m = /\/products\/([^/?]+)\.webp/.exec(el.src);
  if (m) { el.src = 'https://res.cloudinary.com/dj56w7nb9/image/upload/f_auto,q_auto/products/' + m[1] + '.jpg'; return; }
  if (!/logo\.webp$/.test(el.src)) el.src = IMG_LOGO;
}
