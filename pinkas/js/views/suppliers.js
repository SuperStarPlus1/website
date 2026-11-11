// Pinkas — 🚚 suppliers (#/suppliers): a screen of its own (until 23/10/2026 a tab in 📦 purchasing). Each supplier is
// 📦 a stock supplier (goods — its invoices in purchasing) and / or 🛠 a service supplier (electrician, accountant,
// cleaning… — chosen on an expense, a fixed one too). Old suppliers (no type) are stock suppliers.
import { S, save, remove, uid } from '../store.js';
import { e, money, $, $$, toast, modal, field, sel, inp, check, confirmBox, empty } from '../ui.js';
import { today, sum, termsText } from '../calc.js';

export const isStock = (v) => !!v && v.stock !== false;
export const isService = (v) => !!v && v.service === true;
export const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'he');
/** the active suppliers of one kind (+ the one already chosen, even if inactive / of the other kind) */
export const suppliersOf = (kind, keepId) => S.suppliers.filter((v) => v.id === keepId || (v.active !== false && (kind === 'service' ? isService(v) : isStock(v)))).sort(byName);
const typeTags = (v) => (isStock(v) ? '<span class="tag">📦 מלאי</span>' : '') + (isService(v) ? '<span class="tag">🛠 שירות</span>' : '');

export async function editSupplier(x, kind) {
  const cats = S.categories.slice().sort(byName);
  const t = x?.terms || { base: 'eom', days: 30 };
  const r = await modal(x ? 'עריכת ספק' : 'ספק חדש',
    field('שם הספק', inp('name', x?.name || '')) +
    `<div class="f"><span>סוג הספק</span><div class="checks">${check('stock', '📦 ספק מלאי — סחורה, החשבוניות שלו ברכש', x ? isStock(x) : kind !== 'service')}${check('service', '🛠 ספק שירות — מופיע בהוצאות (חשמלאי, רו"ח, ניקיון…)', x ? isService(x) : kind === 'service')}</div><small>אפשר לסמן את שניהם — הספק יופיע בשני המקומות.</small></div>` +
    `<div class="grid2">${field('איש קשר', inp('contact', x?.contact || ''))}${field('טלפון', inp('phone', x?.phone || '', 'inputmode="tel" dir="ltr"'))}</div>` +
    `<div class="grid2">${field('מייל', inp('email', x?.email || '', 'type="email" dir="ltr"'))}${field('ח.פ. / ע.מ.', inp('taxId', x?.taxId || '', 'dir="ltr" inputmode="numeric"'))}</div>` +
    `<div class="grid2">${field('תנאי תשלום', sel('base', [['eom', 'שוטף +'], ['net', 'ימים מתאריך החשבונית'], ['cash', 'מזומן / מיידי']], t.base))}${field('ימים', inp('days', t.days ?? 30, 'type="number" min="0" max="365"'))}</div>` +
    `<div class="f" id="supCats"><span>קטגוריות מוצרים שהספק מספק (ספק מלאי)</span>${cats.length ? `<div class="checks">${cats.map((c) => `<label class="chk"><input type="checkbox" name="cats" data-multi value="${c.id}"${(x?.cats || []).includes(c.id) ? ' checked' : ''}> ${e(c.name)}</label>`).join('')}</div>` : '<small>עוד אין קטגוריות — מוסיפים ב-📦 רכש ← "🗂 קטגוריות ורווח".</small>'}</div>` +
    field('הערות', inp('note', x?.note || '')) + (x ? check('active', 'ספק פעיל', x.active !== false) : ''),
    [...(x ? [{ label: '🗑 מחיקה', kind: 'danger ghost', value: 'del' }] : []), { label: 'ביטול', value: null },
      { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: (v) => (!v.name ? 'יש להזין שם' : !v.stock && !v.service ? 'יש לסמן ספק מלאי, ספק שירות או שניהם' : '') }],
    { wide: true, onOpen: (fm) => { const show = () => { $('#supCats', fm).style.display = fm.elements.stock.checked ? '' : 'none'; }; fm.elements.stock.addEventListener('change', show); show(); } });
  if (!r) return null;
  if (r.value === 'del') {
    if (S.invoices.some((i) => i.supplierId === x.id) || S.expenses.some((i) => i.supplierId === x.id) || S.fixed.some((i) => i.supplierId === x.id)) {
      toast('יש לספק חשבוניות או הוצאות — אפשר להשבית אותו במקום למחוק', 'err'); return null;
    }
    if (!(await confirmBox('למחוק את הספק ' + x.name + '?', 'מחיקה'))) return null;
    await remove('suppliers', x.id); return x;
  }
  const row = await save('suppliers', { ...(x || { id: uid() }), name: r.name, stock: !!r.stock, service: !!r.service, contact: r.contact, phone: r.phone, email: r.email, taxId: r.taxId,
    terms: { base: r.base, days: Math.max(0, Number(r.days) || 0) }, cats: r.stock ? r.cats || [] : [], note: r.note, active: x ? r.active : true });
  toast('נשמר ✓');
  return row;
}

export async function suppliersView(main) {
  const f = sessionStorage.getItem('pk_supf') || 'all';
  const all = S.suppliers.slice().sort((a, b) => (b.active !== false) - (a.active !== false) || byName(a, b));
  const list = all.filter((v) => f === 'all' || (f === 'stock' ? isStock(v) : isService(v)));
  const t = today();
  main.innerHTML = `
    <div class="head row"><h1>🚚 ספקים</h1><button class="btn primary" id="add">➕ ספק</button></div>
    <div class="chips">${[['all', 'הכל · ' + all.length], ['stock', '📦 ספקי מלאי · ' + all.filter(isStock).length], ['service', '🛠 ספקי שירות · ' + all.filter(isService).length]]
      .map(([k, l]) => `<button class="chip${k === f ? ' on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
    <div class="card hint small">📦 <b>ספק מלאי</b> — מופיע ב-📦 רכש (חשבוניות, קטלוג ותמחור). 🛠 <b>ספק שירות</b> — בוחרים אותו ב-🧾 הוצאה או בהוצאה קבועה. ספק עם שני הסימונים מופיע בשני המקומות.</div>
    <div class="card flush">${list.length ? `<ul class="list click">${list.map((v) => {
      const inv = S.invoices.filter((i) => i.supplierId === v.id && !i.paid);
      const exp = S.expenses.filter((i) => i.supplierId === v.id && !i.paid && !i.skipped);
      const open = sum(inv, (i) => i.amount) + sum(exp, (i) => i.amount);
      const late = inv.some((i) => i.dueDate < t) || exp.some((i) => i.date < t);
      return `<li data-id="${v.id}" class="${v.active === false ? 'off' : ''}"><span><b class="sm">${e(v.name)}</b> ${typeTags(v)}
        <small>${termsText(v.terms)}${v.phone ? ' · <span dir="ltr">' + e(v.phone) + '</span>' : ''}${(v.cats || []).length ? ' · ' + (v.cats || []).map((c) => e(S.categories.find((k) => k.id === c)?.name || '')).filter(Boolean).join(', ') : ''}${v.active === false ? ' · מושבת' : ''}</small></span>
        <span class="end">${open ? `<b class="${late ? 'neg' : ''}">${money(open)}</b><small>פתוח</small>` : ''}</span></li>`;
    }).join('')}</ul>` : empty(all.length ? 'אין ספקים מהסוג הזה.' : 'עוד אין ספקים.')}</div>`;
  $('#add', main).onclick = async () => { if (await editSupplier(null, f === 'service' ? 'service' : 'stock')) suppliersView(main); };
  $$('[data-f]', main).forEach((b) => { b.onclick = () => { sessionStorage.setItem('pk_supf', b.dataset.f); suppliersView(main); }; });
  $$('li[data-id]', main).forEach((li) => { li.onclick = async () => { if (await editSupplier(S.suppliers.find((v) => v.id === li.dataset.id))) suppliersView(main); }; });
}
