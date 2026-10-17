// The product photos (16/10/2026): Supabase Storage — products/<barcode>.webp (shrunk once to 600 px on the store PC,
// only the active catalog's products; sync_images_supabase.py). A product without a photo — the logo (17/10/2026: the
// Cloudinary fallback is gone; nothing of the site is on Cloudinary any more).
const IMG_SB = 'https://otjhhljgdevazanrretx.supabase.co/storage/v1/object/public/products/';
const IMG_LOGO = 'img/logo.webp';
function prodImg(bc) { return IMG_SB + encodeURIComponent(String(bc || '').trim().replace(/\.0$/, '')) + '.webp'; }
function imgFallback(el) {
  if (!/logo\.webp$/.test(el.src)) el.src = IMG_LOGO;
}
