// Pinkas — purchasing: #/purchasing/<tab>
//   invoices   — supplier invoices (or a monthly statement): amount, date, due date (from the supplier's terms), paid
//   (the suppliers — 🚚 a screen of their own, views/suppliers.js; only the 📦 stock suppliers are offered here)
//   categories — product categories, each with a wanted margin "from the top" (of the price) or "from the bottom" (on cost)
//   items      — pricing: cost from the supplier's catalog (pasted from Excel / a CSV file) or typed; the shelf price from
//                the category's margin, or a manual price (and the margin it really gives)
import { S, save, saveMany, remove, uid, files } from '../store.js';
import { isCloud, serverConfig, readInvoice, shrinkImage, openFile, deleteFile } from '../cloud.js';
import { e, money, money0, pct, $, $$, toast, modal, field, money_in, sel, inp, check, confirmBox, empty, pickFile, download, toCsv } from '../ui.js';
import { today, monthOf, monthName, addMonths, fmtDate, num, r2, sum, dueDate, termsText, salePrice, marginOf, itemPrice, parseTable } from '../calc.js';
import { go } from '../app.js';
import { suppliersOf, byName, isStock } from './suppliers.js';

const TABS = [['invoices', '📥 חשבוניות'], ['categories', '🗂 קטגוריות ורווח'], ['items', '🏷 תמחור פריטים']];
const METHODS = [['', '—'], ['transfer', 'העברה בנקאית'], ['check', 'שיק'], ['card', 'אשראי'], ['cash', 'מזומן']];
const sName = (id) => (S.suppliers.find((x) => x.id === id) || {}).name || '—';
const cat = (id) => S.categories.find((x) => x.id === id);

export async function purchasingView(main, tab = 'invoices', arg) {
  if (tab === 'suppliers') return go('#/suppliers');             // the old link (a tab here until 23/10/2026)
  if (!TABS.some((t) => t[0] === tab)) tab = 'invoices';
  main.innerHTML = `<div class="head"><h1>📦 רכש</h1></div>
    <div class="tabs">${TABS.map(([k, l]) => `<a href="#/purchasing/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div><div id="pv"></div>`;
  const pv = $('#pv', main);
  if (tab === 'invoices') return invoicesTab(pv, arg);
  if (tab === 'categories') return categoriesTab(pv);
  return itemsTab(pv);
}

/* ================= invoices ================= */
/** a supplier invoice: typed, or read from a photo / PDF (online — cloud.js readInvoice); the photo / PDF of the
 *  document is kept with it (📎 — on the device; online also on the server). `start`: 'photo' opens the camera first. */
export async function editInvoice(x, start) {
  const s = S.settings;
  const cfg = isCloud() ? await serverConfig() : { ocr: false };
  const canRead = isCloud() && cfg.ocr;
  const docs = [...(x?.files || [])];                 // {id, name, mime, size}
  const fresh = [];                                   // new files chosen now: {meta, blob}
  const removed = [];                                 // documents taken off (deleted on save)
  let fromOcr = null;                                 // the supplier the photo named, when it is not in the list
  const supOpts = () => [['', '— בחירת ספק —'], ...(fromOcr ? [['__new', '➕ ספק חדש: ' + fromOcr.supplier]] : []),
    ...suppliersOf('stock', x?.supplierId).map((v) => [v.id, v.name])];
  const supDefault = x?.supplierId || sessionStorage.getItem('pk_lastSup') || '';
  const r = await modal(x ? 'עריכת חשבונית ספק' : 'חשבונית ספק חדשה',
    `<div class="ocrbar">${canRead ? '<button type="button" class="btn primary" id="ocrBtn">📷 קליטה מצילום / PDF</button>' : ''}<button type="button" class="btn" id="attBtn">📎 צירוף מסמך</button>
      <span class="muted small" id="ocrMsg">${canRead ? 'צלמו את החשבונית — הפרטים יתמלאו לבד, והצילום יישמר עם החשבונית.' : isCloud() ? 'קליטה מצילום עוד לא הופעלה בשרת.' : 'קליטה אוטומטית מצילום — בחשבון מקוון (⚙ הגדרות). כאן אפשר לצרף את הצילום.'}</span></div>
     <div class="docs" id="docs"></div>` +
    field('ספק', `<select name="supplierId">${supOpts().map(([v, l]) => `<option value="${e(v)}"${v === supDefault ? ' selected' : ''}>${e(l)}</option>`).join('')}</select>`) +
    `<div class="grid2">${field('מספר חשבונית', inp('number', x?.number || '', 'dir="ltr"'))}${field('סוג', sel('type', [['invoice', 'חשבונית'], ['monthly', 'ריכוז חודשי'], ['credit', 'זיכוי']], x?.type || 'invoice'))}</div>` +
    `<div class="grid2">${field('תאריך החשבונית', inp('date', x?.date || today(), 'type="date"'))}${field('סכום (כולל מע"מ)', money_in('amount', x ? Math.abs(x.amount) : ''))}</div>` +
    field('תאריך פירעון', inp('dueDate', x?.dueDate || '', 'type="date"'), '<span id="termsHint"></span>') +
    (s.vatOn ? check('vat', 'כולל מע"מ (חשבונית מס)', x ? x.vat !== false : true) : '') +
    `<div class="grid2">${check('paid', 'שולם', x?.paid)}${field('אמצעי תשלום', sel('method', METHODS, x?.method || ''))}</div>` +
    field('הערה', inp('note', x?.note || '')),
    [...(x ? [{ label: '🗑 מחיקה', kind: 'danger ghost', value: 'del' }] : []), { label: 'ביטול', value: null },
      { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: (v) => (!v.supplierId ? 'יש לבחור ספק' : !v.date ? 'יש להזין תאריך' : !(num(v.amount) > 0) ? 'יש להזין סכום' : '') }],
    { wide: true, onOpen: (f) => {
      // the due date follows the supplier's terms until it is changed by hand
      let touched = !!x?.dueDate;
      const calc = () => {
        const sup = S.suppliers.find((v) => v.id === f.elements.supplierId.value);
        $('#termsHint', f).textContent = sup ? 'תנאי התשלום של הספק: ' + termsText(sup.terms) : '';
        if (!touched) f.elements.dueDate.value = dueDate(f.elements.date.value, sup?.terms || { base: 'eom', days: 30 });
      };
      f.elements.dueDate.addEventListener('input', () => { touched = true; });
      f.elements.supplierId.addEventListener('change', () => { touched = false; calc(); });
      f.elements.date.addEventListener('change', () => { if (!x?.dueDate) touched = false; calc(); });
      calc();
      const drawDocs = () => {
        const all = [...docs.map((d) => ({ ...d, old: true })), ...fresh.map((n) => n.meta)];
        $('#docs', f).innerHTML = all.map((d) => `<span class="doc"><button type="button" class="link" data-open="${d.id}">${d.mime === 'application/pdf' ? '📄' : '🖼'} ${e(d.name)}</button><button type="button" class="x" data-rm="${d.id}" aria-label="הסרה">✕</button></span>`).join('');
        $$('[data-open]', f).forEach((b) => { b.onclick = async () => {
          const n = fresh.find((z) => z.meta.id === b.dataset.open);
          if (n) { const u = URL.createObjectURL(n.blob); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); return; }
          if (!(await openFile({ id: b.dataset.open }))) toast('המסמך לא נמצא במכשיר הזה', 'err');
        }; });
        $$('[data-rm]', f).forEach((b) => { b.onclick = () => {
          const i = fresh.findIndex((z) => z.meta.id === b.dataset.rm);
          if (i >= 0) fresh.splice(i, 1); else { const j = docs.findIndex((d) => d.id === b.dataset.rm); if (j >= 0) { removed.push(docs[j].id); docs.splice(j, 1); } }
          drawDocs();
        }; });
      };
      drawDocs();
      const addFile = async (file) => {
        if (!/^image\/|^application\/pdf$/.test(file.type)) { toast('תמונה או PDF בלבד', 'err'); return null; }
        const small = await shrinkImage(file);
        if (small.size > 10 * 1024 * 1024) { toast('הקובץ גדול מדי (עד 10MB)', 'err'); return null; }
        const meta = { id: uid(), name: small.name || 'מסמך', mime: small.type, size: small.size };
        fresh.push({ meta, blob: small }); drawDocs();
        return small;
      };
      $('#attBtn', f).onclick = async () => { const file = await pickFile('image/*,application/pdf'); if (file) await addFile(file); };
      const ocr = $('#ocrBtn', f);
      const read = async () => {
        const file = await pickFile('image/*,application/pdf');
        if (!file) return;
        const small = await addFile(file);
        if (!small) return;
        const msg = $('#ocrMsg', f);
        ocr.disabled = true; msg.textContent = '⏳ קורא את החשבונית…';
        const res = await readInvoice(small).catch(() => ({ ok: false, error: 'אין חיבור לאינטרנט' }));
        ocr.disabled = false;
        if (!res.ok) { msg.textContent = '⚠ ' + (res.error || 'הקריאה נכשלה') + ' — הצילום צורף, ממלאים ידנית.'; return; }
        const inv = res.invoice;
        // the supplier: by tax id, then by name
        const norm = (t) => String(t || '').replace(/["'״׳.\-\s]|בע"?מ/g, '');
        const mine = suppliersOf('stock');
        const sup = (inv.taxId && mine.find((v) => (v.taxId || '').replace(/\D/g, '') === inv.taxId)) ||
          mine.find((v) => norm(v.name) && (norm(v.name) === norm(inv.supplier) || norm(inv.supplier).includes(norm(v.name)) || norm(v.name).includes(norm(inv.supplier))));
        if (sup) f.elements.supplierId.value = sup.id;
        else if (inv.supplier) {
          fromOcr = inv;
          f.elements.supplierId.innerHTML = supOpts().map(([v, l]) => `<option value="${e(v)}">${e(l)}</option>`).join('');
          f.elements.supplierId.value = '__new';
        }
        if (inv.number) f.elements.number.value = inv.number;
        if (inv.date) f.elements.date.value = inv.date;
        if (inv.total !== null) f.elements.amount.value = inv.total;
        f.elements.type.value = inv.type;
        if (f.elements.vat) f.elements.vat.checked = !(inv.vat === 0);
        touched = !!inv.dueDate;
        if (inv.dueDate) f.elements.dueDate.value = inv.dueDate;
        calc();
        msg.innerHTML = (inv.confidence === 'low' ? '⚠ חלק מהפרטים לא היו ברורים — <b>בדקו לפני השמירה</b>.' : '✅ הפרטים מולאו מהצילום — בדקו ושמרו.') +
          (fromOcr && !sup ? ' הספק "' + e(inv.supplier) + '" חדש — ייווסף בשמירה.' : '');
      };
      if (ocr) ocr.onclick = read;
      if (start === 'photo' && ocr) setTimeout(read, 50);
    } });
  if (!r) return false;
  if (r.value === 'del') {
    if (!(await confirmBox('למחוק את החשבונית' + (docs.length ? ' ואת המסמכים שלה' : '') + '?', 'מחיקה'))) return false;
    for (const d of docs) await deleteFile(d.id);
    await remove('invoices', x.id); return true;
  }
  let supplierId = r.supplierId;
  if (supplierId === '__new' && fromOcr) {
    const ns = await save('suppliers', { id: uid(), name: fromOcr.supplier, stock: true, service: false, taxId: fromOcr.taxId || '', terms: { base: 'eom', days: 30 }, cats: [], active: true });
    supplierId = ns.id;
    toast('נוסף ספק: ' + ns.name + ' (תנאי תשלום: שוטף + 30 — אפשר לשנות בלשונית ספקים)');
  }
  sessionStorage.setItem('pk_lastSup', supplierId);
  const id = x?.id || uid();
  for (const n of fresh) await files.put({ ...n.meta, invoiceId: id, blob: n.blob, uploaded: false, created: new Date().toISOString() });
  for (const d of removed) await deleteFile(d);
  const amount = r2(num(r.amount)) * (r.type === 'credit' ? -1 : 1);
  await save('invoices', { ...(x || {}), id, supplierId, number: r.number, type: r.type, date: r.date, amount, dueDate: r.dueDate || r.date,
    vat: s.vatOn ? r.vat : false, paid: r.paid, paidDate: r.paid ? (x?.paidDate || today()) : null, method: r.method, note: r.note,
    files: [...docs, ...fresh.map((n) => n.meta)] });
  toast('נשמר ✓');
  return true;
}

async function invoicesTab(pv, arg) {
  if (arg === 'new' || arg === 'photo') { await editInvoice(null, arg === 'photo' ? 'photo' : null); return go('#/purchasing/invoices'); }
  const ym = arg && /^\d{4}-\d{2}$/.test(arg) ? arg : monthOf(today());
  const supF = sessionStorage.getItem('pk_isup') || '';
  const rows = S.invoices.filter((x) => monthOf(x.date) === ym && (!supF || x.supplierId === supF)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const open = S.invoices.filter((x) => !x.paid && (!supF || x.supplierId === supF));
  const t = today();
  pv.innerHTML = `
    <div class="row"><div class="monthbar"><a class="btn sm" href="#/purchasing/invoices/${addMonths(ym, -1)}">→</a><b>${monthName(ym)}</b><a class="btn sm" href="#/purchasing/invoices/${addMonths(ym, 1)}">←</a></div>
      <div class="actions"><select id="supF"><option value="">כל הספקים</option>${suppliersOf('stock', supF).map((v) => `<option value="${v.id}"${v.id === supF ? ' selected' : ''}>${e(v.name)}</option>`).join('')}</select>
      <button class="btn" id="addPh">📷 מצילום</button><button class="btn primary" id="add">➕ חשבונית</button></div></div>
    <div class="kpis">
      <div class="kpi"><small>רכש החודש</small><b>${money0(sum(rows, (x) => x.amount))}</b></div>
      <div class="kpi"><small>חשבוניות</small><b>${rows.length}</b></div>
      <div class="kpi neg"><small>פתוח לתשלום (הכל)</small><b>${money0(sum(open, (x) => x.amount))}</b></div>
      <div class="kpi ${open.some((x) => x.dueDate < t) ? 'neg' : ''}"><small>באיחור</small><b>${money0(sum(open.filter((x) => x.dueDate < t), (x) => x.amount))}</b></div>
    </div>
    <div class="card flush">${rows.length ? `<table class="tbl click"><thead><tr><th>תאריך</th><th>ספק</th><th class="hide-m">מס׳</th><th class="n">סכום</th><th>פירעון</th></tr></thead><tbody>
      ${rows.map((x) => `<tr data-id="${x.id}"><td>${fmtDate(x.date)}</td><td>${e(sName(x.supplierId))}${(x.files || []).length ? ' 📎' : ''}${x.type === 'monthly' ? ' <span class="tag">ריכוז</span>' : x.type === 'credit' ? ' <span class="tag">זיכוי</span>' : ''}</td>
        <td dir="ltr" class="hide-m">${e(x.number || '')}</td><td class="n">${money(x.amount)}</td><td>${fmtDate(x.dueDate)}<br>${x.paid ? '<span class="tag ok">שולם</span>' : `<button class="tag ${x.dueDate < t ? 'bad' : 'wait'}" data-pay="${x.id}">${x.dueDate < t ? 'באיחור · לתשלום' : 'סימון ששולם'}</button>`}</td></tr>`).join('')}
    </tbody></table>` : empty('אין חשבוניות בחודש הזה.')}</div>`;
  $('#add', pv).onclick = async () => { if (await editInvoice(null)) invoicesTab(pv, ym); };
  $('#addPh', pv).onclick = async () => { if (await editInvoice(null, 'photo')) invoicesTab(pv, ym); };
  $('#supF', pv).onchange = (ev) => { sessionStorage.setItem('pk_isup', ev.target.value); invoicesTab(pv, ym); };
  $$('tr[data-id]', pv).forEach((tr) => { tr.onclick = async (ev) => {
    const x = S.invoices.find((r) => r.id === tr.dataset.id);
    if (ev.target.dataset.pay) {
      const r = await modal('תשלום לספק — ' + sName(x.supplierId), `<p>${money(x.amount)} · חשבונית ${e(x.number || '')}</p>` + field('תאריך התשלום', inp('paidDate', today(), 'type="date"')) + field('אמצעי תשלום', sel('method', METHODS, x.method || 'transfer')),
        [{ label: 'ביטול', value: null }, { label: 'סימון כשולם', kind: 'primary', value: 1, submit: true }]);
      if (r) { await save('invoices', { ...x, paid: true, paidDate: r.paidDate || today(), method: r.method }); toast('סומן כשולם ✓'); }
      return invoicesTab(pv, ym);
    }
    if (await editInvoice(x)) invoicesTab(pv, ym);
  }; });
}

/* ================= categories ================= */
const MODES = [['top', 'מלמעלה — % מהמחיר (רווח גולמי)'], ['bottom', 'מלמטה — % תוספת על העלות']];
async function categoriesTab(pv) {
  const s = S.settings;
  const list = S.categories.slice().sort(byName);
  const ex = (c) => { const p = salePrice(100, c, s); return p ? 'עלות ₪100 ← מחיר ' + money(p) : ''; };
  pv.innerHTML = `<div class="card hint"><b>אחוז רווח מלמעלה</b>: הרווח כאחוז ממחיר המכירה (30% ← עלות 70 נמכרת ב-100). <b>מלמטה</b>: תוספת על העלות (30% ← עלות 100 נמכרת ב-130).
      ${s.vatOn && s.priceIncVat ? 'העלות לפני מע"מ, והמחיר לצרכן כולל מע"מ ' + s.vat + '%.' : ''} עיגול: ${({ '0.9': 'ל-x.90', '0.1': 'ל-10 אגורות', '1': 'לשקל', none: 'ללא' })[s.rounding] || ''} (בהגדרות).</div>
    <div class="row"><span class="muted">${list.length} קטגוריות</span><button class="btn primary" id="add">➕ קטגוריה</button></div>
    <div class="card flush">${list.length ? `<ul class="list click">${list.map((c) => {
      const sups = S.suppliers.filter((v) => (v.cats || []).includes(c.id));
      return `<li data-id="${c.id}"><span><b class="sm">${e(c.name)}</b><small>${sups.length ? '🚚 ' + sups.map((v) => e(v.name)).join(', ') : 'אין ספקים משויכים'} · ${S.items.filter((i) => i.categoryId === c.id).length} פריטים</small></span>
        <span class="end"><b>${pct(c.margin)} ${c.mode === 'top' ? 'מלמעלה' : 'מלמטה'}</b><small>${ex(c)}</small></span></li>`;
    }).join('')}</ul>` : empty('עוד אין קטגוריות. למשל: ירקות, מוצרי חלב, משקאות, ניקיון.')}</div>`;
  const edit = async (c) => {
    const sups = S.suppliers.filter(isStock).sort(byName);
    const r = await modal(c ? 'עריכת קטגוריה' : 'קטגוריה חדשה',
      field('שם הקטגוריה', inp('name', c?.name || '')) +
      `<div class="grid2">${field('אחוז רווח רצוי', inp('margin', c?.margin ?? 30, 'inputmode="decimal" dir="ltr" class="num"'))}${field('חישוב', sel('mode', MODES, c?.mode || 'top'))}</div>` +
      `<p class="muted small" id="ex"></p>` +
      `<div class="f"><span>ספקים של הקטגוריה</span>${sups.length ? `<div class="checks">${sups.map((v) => `<label class="chk"><input type="checkbox" name="sups" data-multi value="${v.id}"${c && (v.cats || []).includes(c.id) ? ' checked' : ''}> ${e(v.name)}</label>`).join('')}</div>` : '<small>אין ספקים עדיין.</small>'}</div>`,
      [...(c ? [{ label: '🗑 מחיקה', kind: 'danger ghost', value: 'del' }] : []), { label: 'ביטול', value: null },
        { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: (v) => (!v.name ? 'יש להזין שם' : !(num(v.margin) >= 0) || (v.mode === 'top' && num(v.margin) >= 100) ? 'אחוז לא תקין (מלמעלה — פחות מ-100)' : '') }],
      { onOpen: (f) => { const upd = () => { const p = salePrice(100, { margin: num(f.elements.margin.value), mode: f.elements.mode.value }, s); $('#ex', f).textContent = p ? 'דוגמה: עלות ₪100 ← מחיר לצרכן ' + money(p) : ''; }; f.addEventListener('input', upd); f.addEventListener('change', upd); upd(); } });
    if (!r) return;
    if (r.value === 'del') {
      if (S.items.some((i) => i.categoryId === c.id)) return toast('יש פריטים בקטגוריה — מעבירים אותם קודם', 'err');
      if (!(await confirmBox('למחוק את הקטגוריה ' + c.name + '?', 'מחיקה'))) return;
      await remove('categories', c.id);
      await saveMany('suppliers', S.suppliers.filter((v) => (v.cats || []).includes(c.id)).map((v) => ({ ...v, cats: v.cats.filter((k) => k !== c.id) })));
    } else {
      const row = await save('categories', { ...(c || { id: uid() }), name: r.name, margin: r2(num(r.margin)), mode: r.mode });
      const want = new Set(r.sups || []);
      await saveMany('suppliers', S.suppliers.filter((v) => want.has(v.id) !== (v.cats || []).includes(row.id))
        .map((v) => ({ ...v, cats: want.has(v.id) ? [...(v.cats || []), row.id] : (v.cats || []).filter((k) => k !== row.id) })));
      toast('נשמר ✓');
    }
    categoriesTab(pv);
  };
  $('#add', pv).onclick = () => edit(null);
  $$('li[data-id]', pv).forEach((li) => { li.onclick = () => edit(cat(li.dataset.id)); });
}

/* ================= items / pricing ================= */
async function itemsTab(pv) {
  const s = S.settings;
  const f = JSON.parse(sessionStorage.getItem('pk_itf') || '{}');
  const draw = () => {
    const q = (f.q || '').trim();
    const list = S.items.filter((i) => (!f.cat || i.categoryId === f.cat) && (!f.sup || i.supplierId === f.sup) && (!q || (i.name || '').includes(q) || (i.code || '').includes(q)))
      .sort(byName);
    const shown = list.slice(0, 300);
    $('#il', pv).innerHTML = shown.length ? `<table class="tbl click"><thead><tr><th>פריט</th><th class="hide-m">קטגוריה</th><th class="n">עלות</th><th class="n">מחיר</th><th class="n">רווח</th></tr></thead><tbody>
      ${shown.map((i) => {
        const c = cat(i.categoryId), auto = salePrice(i.cost, c, s), price = itemPrice(i, c, s), m = marginOf(price, i.cost, c?.mode || 'top', s);
        const low = c && m !== null && m < Number(c.margin) - 0.5;
        return `<tr data-id="${i.id}"><td>${e(i.name)}${i.code ? `<small class="muted code" dir="ltr">${e(i.code)}</small>` : ''}<br><small class="muted">${e(sName(i.supplierId))}</small></td><td class="hide-m">${e(c?.name || '—')}</td>
          <td class="n">${i.cost ? money(i.cost) : '—'}</td><td class="n"><b>${price ? money(price) : '—'}</b>${Number(i.price) > 0 ? `<br><small class="muted">ידני${auto ? ' (לפי הקטגוריה ' + money(auto) + ')' : ''}</small>` : ''}</td>
          <td class="n ${low ? 'neg' : ''}">${pct(m)}${low ? ' ⚠' : ''}</td></tr>`;
      }).join('')}</tbody></table>${list.length > shown.length ? `<p class="muted small" style="padding:8px 12px">מוצגים 300 מתוך ${list.length} — אפשר לסנן.</p>` : ''}`
      : empty(S.items.length ? 'לא נמצאו פריטים.' : 'עוד אין פריטים. מוסיפים ידנית, או מייבאים את הקטלוג של הספק (מעתיקים מאקסל / קובץ CSV).');
    $$('tr[data-id]', pv).forEach((tr) => { tr.onclick = async () => { if (await editItem(S.items.find((i) => i.id === tr.dataset.id))) draw(); }; });
  };
  pv.innerHTML = `<div class="row wrap"><div class="actions">
      <input id="iq" placeholder="🔍 שם / ברקוד / מק״ט" value="${e(f.q || '')}">
      <select id="icat"><option value="">כל הקטגוריות</option>${S.categories.slice().sort(byName).map((c) => `<option value="${c.id}"${c.id === f.cat ? ' selected' : ''}>${e(c.name)}</option>`).join('')}</select>
      <select id="isup"><option value="">כל הספקים</option>${suppliersOf('stock', f.sup).map((v) => `<option value="${v.id}"${v.id === f.sup ? ' selected' : ''}>${e(v.name)}</option>`).join('')}</select></div>
    <div class="actions"><button class="btn" id="imp">📋 ייבוא קטלוג ספק</button><button class="btn" id="exp">⬇ מחירון</button><button class="btn primary" id="add">➕ פריט</button></div></div>
    <div class="card flush" id="il"></div>`;
  const keep = () => sessionStorage.setItem('pk_itf', JSON.stringify(f));
  $('#iq', pv).oninput = (ev) => { f.q = ev.target.value; keep(); draw(); };
  $('#icat', pv).onchange = (ev) => { f.cat = ev.target.value; keep(); draw(); };
  $('#isup', pv).onchange = (ev) => { f.sup = ev.target.value; keep(); draw(); };
  $('#add', pv).onclick = async () => { if (await editItem(null, f)) draw(); };
  $('#imp', pv).onclick = async () => { if (await importCatalog()) itemsTab(pv); };
  $('#exp', pv).onclick = () => download('מחירון ' + today() + '.csv', toCsv([['ברקוד / מק"ט', 'פריט', 'קטגוריה', 'ספק', 'עלות', 'מחיר לצרכן', 'רווח %'],
    ...S.items.slice().sort(byName).map((i) => { const c = cat(i.categoryId), p = itemPrice(i, c, s); return [i.code || '', i.name, c?.name || '', sName(i.supplierId), i.cost || '', p || '', marginOf(p, i.cost, c?.mode || 'top', s) ?? '']; })]), 'text/csv');
  draw();
}

async function editItem(x, f = {}) {
  const s = S.settings;
  const cats = S.categories.slice().sort(byName).map((c) => [c.id, c.name + ' (' + c.margin + '% ' + (c.mode === 'top' ? 'מלמעלה' : 'מלמטה') + ')']);
  const sups = [['', '—'], ...suppliersOf('stock', x?.supplierId).map((v) => [v.id, v.name])];
  const r = await modal(x ? 'עריכת פריט' : 'פריט חדש',
    `<div class="grid2">${field('שם הפריט', inp('name', x?.name || ''))}${field('ברקוד / מק״ט', inp('code', x?.code || '', 'dir="ltr"'))}</div>` +
    `<div class="grid2">${field('קטגוריה', sel('categoryId', [['', '—'], ...cats], x?.categoryId || f.cat || ''))}${field('ספק', sel('supplierId', sups, x?.supplierId || f.sup || ''))}</div>` +
    `<div class="grid2">${field('עלות (לפני מע"מ)', money_in('cost', x?.cost ?? ''))}${field('מחיר ידני (לא חובה)', money_in('price', Number(x?.price) > 0 ? x.price : ''), 'ריק — לפי אחוז הרווח של הקטגוריה')}</div>` +
    `<div class="calc" id="pc"></div>`,
    [...(x ? [{ label: '🗑 מחיקה', kind: 'danger ghost', value: 'del' }] : []), { label: 'ביטול', value: null },
      { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: (v) => (!v.name ? 'יש להזין שם' : v.code && S.items.some((i) => i.code === v.code && i.supplierId === v.supplierId && i.id !== x?.id) ? 'כבר יש פריט עם הקוד הזה אצל הספק' : '') }],
    { wide: true, onOpen: (fm) => {
      const upd = () => {
        const c = cat(fm.elements.categoryId.value), cost = num(fm.elements.cost.value), manual = num(fm.elements.price.value);
        const auto = salePrice(cost, c, s), price = manual > 0 ? manual : auto, m = marginOf(price, cost, c?.mode || 'top', s);
        $('#pc', fm).innerHTML = cost > 0 ? `מחיר לפי הקטגוריה: <b>${auto ? money(auto) : '— (אין קטגוריה)'}</b>${manual > 0 ? ` · במחיר הידני הרווח: <b class="${c && m < c.margin ? 'neg' : 'pos'}">${pct(m)}</b>${c ? ' (יעד ' + c.margin + '%)' : ''}` : ''}` : '';
      };
      fm.addEventListener('input', upd); fm.addEventListener('change', upd); upd();
    } });
  if (!r) return false;
  if (r.value === 'del') { if (!(await confirmBox('למחוק את הפריט?', 'מחיקה'))) return false; await remove('items', x.id); return true; }
  await save('items', { ...(x || { id: uid() }), name: r.name, code: r.code, categoryId: r.categoryId || null, supplierId: r.supplierId || null,
    cost: r2(num(r.cost)) || null, price: r2(num(r.price)) || null, costDate: x && Number(x.cost) === r2(num(r.cost)) ? x.costDate : today() });
  toast('נשמר ✓');
  return true;
}

/** the supplier's catalog: pasted from Excel or a CSV file → choose the columns → new items are added, existing ones (same
 *  code at the same supplier, or the same name without a code) get the new cost */
async function importCatalog() {
  if (!suppliersOf('stock').length) { toast('קודם מוסיפים ספק מלאי — ב-🚚 ספקים', 'err'); return false; }
  const sups = suppliersOf('stock').map((v) => [v.id, v.name]);
  const step1 = await modal('ייבוא קטלוג ספק',
    field('ספק', sel('supplierId', sups, sessionStorage.getItem('pk_lastSup') || sups[0][0])) +
    field('הדבקה מאקסל', '<textarea name="text" rows="8" dir="auto" placeholder="מסמנים באקסל את העמודות (ברקוד, שם, מחיר) ← העתקה ← הדבקה כאן"></textarea>') +
    '<p class="muted small">או: <button type="button" class="btn sm" id="csvBtn">📄 בחירת קובץ CSV</button></p>',
    [{ label: 'ביטול', value: null }, { label: 'המשך ←', kind: 'primary', value: 1, submit: true, check: (v) => (parseTable(v.text).length ? '' : 'אין שורות — מדביקים טבלה או בוחרים קובץ') }],
    { wide: true, onOpen: (fm) => { $('#csvBtn', fm).onclick = async () => { const file = await pickFile('.csv,.txt,text/csv'); if (file) fm.elements.text.value = await readText(file); }; } });
  if (!step1) return false;
  const rows = parseTable(step1.text);
  const cols = Math.max(...rows.map((r) => r.length));
  const guess = (re) => { const i = rows[0].findIndex((h) => re.test(h)); return i; };
  const hasHead = rows[0].some((c) => /שם|תיאור|מחיר|ברקוד|קוד|מק"?ט|name|price|code/i.test(c));
  const colOpts = [[-1, '—'], ...Array.from({ length: cols }, (_, i) => [i, 'עמודה ' + (i + 1) + (hasHead ? ' · ' + rows[0][i] : ' · ' + (rows[0][i] || ''))])];
  const priceCol = guess(/מחיר|עלות|price|cost/i), nameCol = guess(/שם|תיאור|name|desc/i), codeCol = guess(/ברקוד|קוד|מק"?ט|code|barcode|sku/i);
  const cats = [['', '— בלי קטגוריה —'], ...S.categories.filter((c) => (S.suppliers.find((v) => v.id === step1.supplierId)?.cats || []).includes(c.id)).sort(byName).map((c) => [c.id, c.name]),
    ...S.categories.filter((c) => !(S.suppliers.find((v) => v.id === step1.supplierId)?.cats || []).includes(c.id)).sort(byName).map((c) => [c.id, c.name])];
  const step2 = await modal('ייבוא — ' + sName(step1.supplierId),
    `<p class="muted">${rows.length - (hasHead ? 1 : 0)} שורות. בוחרים מה בכל עמודה:</p>` +
    `<div class="grid3">${field('ברקוד / מק״ט', sel('code', colOpts, codeCol >= 0 ? codeCol : (hasHead ? -1 : 0)))}${field('שם הפריט', sel('name', colOpts, nameCol >= 0 ? nameCol : (hasHead ? -1 : 1)))}${field('מחיר עלות', sel('cost', colOpts, priceCol >= 0 ? priceCol : (hasHead ? -1 : 2)))}</div>` +
    check('head', 'השורה הראשונה היא כותרות', hasHead) +
    `<div class="grid2">${field('קטגוריה לפריטים חדשים', sel('categoryId', cats, ''))}${field('המחיר בקטלוג', sel('vatIn', [['0', 'לפני מע"מ'], ['1', 'כולל מע"מ']], '0'))}</div>` +
    `<div class="preview" id="pvw"></div>`,
    [{ label: 'ביטול', value: null }, { label: 'ייבוא', kind: 'primary', value: 1, submit: true, check: (v) => (Number(v.name) < 0 && Number(v.code) < 0 ? 'צריך לפחות עמודת שם או קוד' : Number(v.cost) < 0 ? 'יש לבחור את עמודת המחיר' : '') }],
    { wide: true, onOpen: (fm) => {
      const upd = () => {
        const g = (r, k) => (Number(fm.elements[k].value) >= 0 ? r[Number(fm.elements[k].value)] || '' : '');
        const body = fm.elements.head.checked ? rows.slice(1) : rows;
        $('#pvw', fm).innerHTML = `<table class="tbl"><thead><tr><th>קוד</th><th>שם</th><th class="n">עלות</th></tr></thead><tbody>${body.slice(0, 5).map((r) => `<tr><td dir="ltr">${e(g(r, 'code'))}</td><td>${e(g(r, 'name'))}</td><td class="n">${e(g(r, 'cost'))}</td></tr>`).join('')}</tbody></table>`;
      };
      fm.addEventListener('change', upd); upd();
    } });
  if (!step2) return false;
  const body = step2.head ? rows.slice(1) : rows;
  const ci = Number(step2.code), ni = Number(step2.name), pi = Number(step2.cost), vf = step2.vatIn === '1' && S.settings.vatOn ? 1 + S.settings.vat / 100 : 1;
  const supId = step1.supplierId, mine = S.items.filter((i) => i.supplierId === supId);
  const out = []; let added = 0, updated = 0, skipped = 0;
  for (const r of body) {
    const code = ci >= 0 ? (r[ci] || '').trim() : '', name = ni >= 0 ? (r[ni] || '').trim() : '', cost = r2(num(r[pi]) / vf);
    if ((!code && !name) || !(cost > 0)) { skipped++; continue; }
    const hit = (code && mine.find((i) => i.code === code)) || (!code && name && mine.find((i) => !i.code && i.name === name));
    if (hit) { if (Number(hit.cost) !== cost || (name && hit.name !== name)) { out.push({ ...hit, cost, name: name || hit.name, costDate: today() }); updated++; } }
    else { out.push({ id: uid(), code, name: name || code, supplierId: supId, categoryId: step2.categoryId || null, cost, price: null, costDate: today() }); added++; }
  }
  await saveMany('items', out);
  sessionStorage.setItem('pk_lastSup', supId);
  await modal('הייבוא הסתיים', `<p>✅ נוספו <b>${added}</b> פריטים · עודכנה עלות ב-<b>${updated}</b>${skipped ? ` · דולגו ${skipped} שורות (בלי שם / מחיר)` : ''}.</p>` +
    (added && !step2.categoryId ? '<p class="muted">לפריטים החדשים אין קטגוריה — בלי קטגוריה אין מחיר אוטומטי. אפשר לסנן לפי הספק ולשייך.</p>' : ''), [{ label: 'סגירה', value: null }]);
  return true;
}
async function readText(file) {
  const buf = await file.arrayBuffer();
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.includes('�')) t = new TextDecoder('windows-1255').decode(buf);   // an old Hebrew Excel CSV
  return t.replace(/^﻿/, '');
}
