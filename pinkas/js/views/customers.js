// Pinkas — credit customers (הקפה; only when turned on in the settings): the list with each one's debt, and a customer's
// card — every credit sale and payment with a running balance, receiving a payment, and a statement (CSV).
import { S, save, remove, uid } from '../store.js';
import { e, money, $, $$, toast, modal, field, money_in, sel, inp, confirmBox, empty, download, toCsv } from '../ui.js';
import { today, fmtDate, num, r2, balanceOf } from '../calc.js';
import { go } from '../app.js';

const METHODS = [['cash', 'מזומן'], ['check', 'שיק'], ['card', 'אשראי'], ['transfer', 'העברה בנקאית']];

async function editCustomer(c) {
  const r = await modal(c ? 'עריכת לקוח' : 'לקוח הקפה חדש',
    field('שם', inp('name', c?.name || '', 'required')) + field('טלפון', inp('phone', c?.phone || '', 'inputmode="tel" dir="ltr"')) +
    field('מסגרת אשראי (לא חובה)', money_in('limit', c?.limit || '')) + field('הערות', inp('note', c?.note || '')) +
    (c ? `<label class="chk"><input type="checkbox" name="active"${c.active !== false ? ' checked' : ''}> לקוח פעיל</label>` : ''),
    [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: (x) => (x.name ? '' : 'יש להזין שם') }]);
  if (!r) return null;
  return save('customers', { ...(c || { id: uid() }), name: r.name, phone: r.phone, limit: r2(num(r.limit)) || null, note: r.note, active: c ? r.active : true });
}

export async function customersView(main) {
  if (!S.settings.creditOn) {
    main.innerHTML = `<div class="head"><h1>👥 לקוחות הקפה</h1></div>` + empty('מכירה בהקפה כבויה. אם העסק מוכר בהקפה — מפעילים ב<a href="#/settings">⚙ הגדרות</a>.');
    return;
  }
  const q = (sessionStorage.getItem('pk_cq') || '');
  const draw = () => {
    const query = $('#cq', main)?.value.trim() || q;
    const list = S.customers.map((c) => ({ c, bal: balanceOf(c.id, S) }))
      .filter((x) => !query || x.c.name.includes(query) || (x.c.phone || '').includes(query))
      .sort((a, b) => (b.c.active !== false) - (a.c.active !== false) || b.bal - a.bal || a.c.name.localeCompare(b.c.name, 'he'));
    const total = r2(list.reduce((a, x) => a + Math.max(0, x.bal), 0));
    $('#cl', main).innerHTML = list.length ? `<ul class="list click">${list.map(({ c, bal }) => `<li data-id="${c.id}" class="${c.active === false ? 'off' : ''}">
      <span>${e(c.name)}${c.phone ? `<small dir="ltr">${e(c.phone)}</small>` : ''}${c.limit && bal > c.limit ? '<small class="neg">מעל המסגרת</small>' : ''}</span>
      <b class="${bal > 0 ? 'neg' : ''}">${money(bal)}</b></li>`).join('')}</ul>` : empty(query ? 'לא נמצא' : 'עוד אין לקוחות הקפה.');
    $('#ctot', main).textContent = money(total);
    $$('li[data-id]', main).forEach((li) => { li.onclick = () => go('#/customer/' + li.dataset.id); });
  };
  main.innerHTML = `<div class="head row"><h1>👥 לקוחות הקפה</h1><button class="btn primary" id="addC">➕ לקוח</button></div>
    <div class="card row"><span>סה"כ חוב לקוחות: <b id="ctot"></b></span><input id="cq" placeholder="🔍 חיפוש לפי שם / טלפון" value="${e(q)}"></div>
    <div class="card flush" id="cl"></div>`;
  $('#cq', main).oninput = (ev) => { sessionStorage.setItem('pk_cq', ev.target.value); draw(); };
  $('#addC', main).onclick = async () => { const c = await editCustomer(null); if (c) go('#/customer/' + c.id); };
  draw();
}

export async function customerView(main, id) {
  const c = S.customers.find((x) => x.id === id);
  if (!c) return go('#/customers');
  const lines = [
    ...S.creditSales.filter((x) => x.customerId === id).map((x) => ({ ...x, t: 'sale' })),
    ...S.payments.filter((x) => x.customerId === id).map((x) => ({ ...x, t: 'pay' })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.t === 'sale' ? -1 : 1)));
  let bal = 0;
  for (const l of lines) { bal = r2(bal + (l.t === 'sale' ? 1 : -1) * Number(l.amount)); l.bal = bal; }
  main.innerHTML = `
    <div class="head row"><h1>👤 ${e(c.name)}</h1><a class="btn" href="#/customers">כל הלקוחות</a></div>
    <div class="card row"><div><small class="muted">יתרת חוב</small><div class="big ${bal > 0 ? 'neg' : ''}">${money(bal)}</div>${c.limit ? `<small class="muted">מסגרת: ${money(c.limit)}</small>` : ''}</div>
      <div class="actions"><button class="btn primary" id="pay">💵 קבלת תשלום</button><button class="btn" id="sale">➕ מכירה בהקפה</button><button class="btn" id="edit">✏ פרטים</button><button class="btn" id="csv">⬇ כרטסת</button></div></div>
    <div class="card flush"><table class="tbl"><thead><tr><th>תאריך</th><th>פירוט</th><th class="n">חובה</th><th class="n">זכות</th><th class="n">יתרה</th><th></th></tr></thead><tbody>
      ${lines.slice().reverse().map((l) => `<tr><td>${fmtDate(l.date)}</td><td>${l.t === 'sale' ? 'מכירה' : 'תשלום · ' + (METHODS.find((m) => m[0] === l.method) || ['', ''])[1]}${l.note ? ' — ' + e(l.note) : ''}</td>
        <td class="n">${l.t === 'sale' ? money(l.amount) : ''}</td><td class="n">${l.t === 'pay' ? money(l.amount) : ''}</td><td class="n">${money(l.bal)}</td>
        <td><button class="btn sm ghost" data-del="${l.t}:${l.id}" aria-label="מחיקה">🗑</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">אין תנועות</td></tr>'}
    </tbody></table></div>`;
  $('#edit', main).onclick = async () => { if (await editCustomer(c)) customerView(main, id); };
  $('#pay', main).onclick = async () => {
    const r = await modal('קבלת תשלום — ' + c.name, field('תאריך', inp('date', today(), 'type="date"')) + field('סכום', money_in('amount', bal > 0 ? bal : '')) +
      field('אמצעי תשלום', sel('method', METHODS, 'cash')) + field('הערה', inp('note')),
      [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: (x) => (num(x.amount) > 0 && x.date ? '' : 'יש להזין תאריך וסכום') }]);
    if (!r) return;
    await save('payments', { id: uid(), customerId: id, date: r.date, amount: r2(num(r.amount)), method: r.method, note: r.note });
    toast('התשלום נרשם ✓'); customerView(main, id);
  };
  $('#sale', main).onclick = async () => {
    const r = await modal('מכירה בהקפה — ' + c.name, field('תאריך', inp('date', today(), 'type="date"')) + field('סכום', money_in('amount')) + field('פירוט', inp('note')),
      [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true, check: (x) => (num(x.amount) > 0 && x.date ? '' : 'יש להזין תאריך וסכום') }]);
    if (!r) return;
    await save('creditSales', { id: uid(), customerId: id, date: r.date, amount: r2(num(r.amount)), note: r.note });
    customerView(main, id);
  };
  $('#csv', main).onclick = () => download('כרטסת ' + c.name + '.csv', toCsv([['תאריך', 'פירוט', 'חובה', 'זכות', 'יתרה'],
    ...lines.map((l) => [fmtDate(l.date), (l.t === 'sale' ? 'מכירה' : 'תשלום') + (l.note ? ' — ' + l.note : ''), l.t === 'sale' ? l.amount : '', l.t === 'pay' ? l.amount : '', l.bal])]), 'text/csv');
  $$('[data-del]', main).forEach((b) => { b.onclick = async () => {
    const [t, lid] = b.dataset.del.split(':');
    if (await confirmBox('למחוק את התנועה?', 'מחיקה')) { await remove(t === 'sale' ? 'creditSales' : 'payments', lid); customerView(main, id); }
  }; });
}
