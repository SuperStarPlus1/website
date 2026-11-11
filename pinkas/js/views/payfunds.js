// clearcount — 🏦 the pension / study funds (#/payroll/funds) for the funds' file (ממשק מעסיקים — דיווח שוטף,
// api/clearcount.ts ccPensionFile): the funds the business deposits to (the 30-digit unified code — the managing
// company's ח.פ + the fund's approval number — and how the money is paid), the employer's contact person for the funds
// and its bank account (only for a bank transfer). Kept in settings.payroll (funds, pensionCfg). Each employee's fund and
// section 14 — in the employee's ⚙ on the payroll screen; with one fund of a kind, everyone is in it by default.
import { S, saveSettings, uid } from '../store.js';
import { e, $, $$, toast, modal, field, inp, sel, confirmBox } from '../ui.js';
import { syncNow } from '../cloud.js';
import { go } from '../app.js';

export const FUND_KINDS = [['pension', 'קרן פנסיה'], ['gemel', 'קופת גמל לקצבה'], ['insurance', 'ביטוח מנהלים'], ['study', 'קרן השתלמות']];
const METHODS = [[6, 'הרשאה לחיוב חשבון / הוראת קבע'], [9, 'חיוב החשבון לפי קובץ הדיווח (בהסכם עם הקופה)'], [1, 'העברה בנקאית']];
const ID_TYPES = [[1, 'ח.פ (חברה)'], [5, 'עוסק מורשה'], [3, 'ת.ז'], [2, 'ח.צ'], [7, 'עמותה'], [11, 'שותפות'], [8, 'אגודה שיתופית']];
const kindName = (k) => (FUND_KINDS.find((x) => x[0] === k) || [k, k])[1];
const digits = (v) => String(v ?? '').replace(/\D/g, '');
/** the 30-digit unified code from the ח.פ + approval no. (the server's _shared/pension-file.ts fundCode) */
function fundCode(code, hp, approval) {
  const c = digits(code);
  if (c.length === 30) return c;
  const h = digits(hp), a = digits(approval);
  return h.length === 9 && a.length >= 1 && a.length <= 5 ? h + a.padStart(14, '0') + '0000000' : '';
}
const cfg = () => S.settings.payroll || {};
const savePayroll = async (patch) => { await saveSettings({ payroll: { ...cfg(), ...patch } }); await syncNow(); };

export async function payFundsView(main) {
  const c = cfg(), funds = c.funds || [], pc = c.pensionCfg || {};
  main.innerHTML = `
    <div class="head row"><h1>🏦 קופות פנסיה והשתלמות</h1><a class="btn" href="#/payroll">→ לשכר</a></div>
    <div class="card hint small">לקובץ הדיווח לקופות (ממשק מעסיקים — המבנה האחיד של רשות שוק ההון, גרסה 6). מגדירים כאן את הקופות שהעסק מפקיד אליהן ואת איש הקשר מול הקופות.
      הקופה של כל עובד/ת וסעיף 14 — ב-⚙ של העובד/ת במסך השכר (כשיש קופה אחת מכל סוג — כולם בה). הקובץ מופק מדוחות השכר של חודש שנסגר.</div>
    <div class="card"><div class="row"><b>הקופות</b><button class="btn primary" id="add">➕ קופה</button></div>
      ${funds.length ? `<ul class="list">${funds.map((f, i) => `<li class="row"><span><b>${e(f.name)}</b> <small class="muted">${e(kindName(f.kind))} · ${e((METHODS.find((m) => m[0] === Number(f.payMethod)) || METHODS[0])[1])}</small>
          <br><small class="muted" dir="ltr">${e(f.code)}</small></span><span class="actions"><button class="btn sm" data-ed="${i}">✏</button><button class="btn sm ghost" data-del="${i}">🗑</button></span></li>`).join('')}</ul>`
        : '<p class="muted">עוד לא הוגדרו קופות.</p>'}</div>
    <div class="card"><div class="row"><b>המעסיק מול הקופות</b><button class="btn" id="emp">✏ עריכה</button></div>
      <p class="small">${pc.contact?.first ? `איש קשר: <b>${e(pc.contact.first + ' ' + (pc.contact.last || ''))}</b> · ${e(pc.contact.phone || '')} · ${e(pc.contact.email || '')}` : '<span class="neg">לא הוגדר איש קשר</span>'}
        · סוג מזהה: ${e((ID_TYPES.find((x) => x[0] === Number(pc.idType || 1)) || ID_TYPES[0])[1])}${pc.bank?.account ? ' · חשבון להעברות: ' + e(pc.bank.code + '-' + pc.bank.branch + '-' + pc.bank.account) : ''}</p>
      <p class="muted small">מספר הזיהוי ותיק הניכויים — מפרטי העסק בסידורית.</p></div>`;
  $('#add', main).onclick = async () => { if (await editFund(null)) go('#/payroll/funds'); };
  $$('[data-ed]', main).forEach((b) => { b.onclick = async () => { if (await editFund(funds[Number(b.dataset.ed)])) go('#/payroll/funds'); }; });
  $$('[data-del]', main).forEach((b) => { b.onclick = async () => {
    const f = funds[Number(b.dataset.del)];
    if (!(await confirmBox('למחוק את הקופה "' + f.name + '"? עובדים שמשויכים אליה יצטרכו קופה אחרת.', '🗑 מחיקה'))) return;
    await savePayroll({ funds: funds.filter((x) => x.id !== f.id) }); toast('נמחק'); go('#/payroll/funds'); }; });
  $('#emp', main).onclick = async () => { if (await editEmployer()) go('#/payroll/funds'); };
}

async function editFund(f) {
  const r = await modal(f ? 'עריכת קופה' : 'קופה חדשה',
    field('שם הקופה', inp('name', f?.name || '', 'placeholder="למשל: מגדל מקפת אישית"')) +
    field('סוג', sel('kind', FUND_KINDS, f?.kind || 'pension')) +
    field('קוד הקופה (30 ספרות)', inp('code', f?.code || '', 'inputmode="numeric" dir="ltr" class="num" maxlength="30"'),
      'מופיע בדוחות של הקופה למעסיק, ובדוח "פרטי קופות למעסיקים" באתר רשות שוק ההון (cmainfo.cma.gov.il/empinfo). או למלא את שני השדות הבאים:') +
    `<div class="grid2">${field('ח.פ של החברה המנהלת', inp('hp', '', 'inputmode="numeric" dir="ltr" class="num" maxlength="9"'))}
      ${field('מספר אישור הקופה', inp('approval', '', 'inputmode="numeric" dir="ltr" class="num" maxlength="5"'))}</div>` +
    field('איך משלמים לקופה', sel('payMethod', METHODS, f?.payMethod || 6), 'העברה בנקאית — בכל הפקה מזינים את מספר האסמכתא ותאריך ההעברה') +
    `<div class="grid2">${field('מספר המעסיק בקופה (לא חובה)', inp('employerNo', f?.employerNo || '', 'dir="ltr"'))}<span></span></div>` +
    `<div class="f" data-k="bank"><span>חשבון הבנק של הקופה (להעברה בנקאית)</span><div class="grid2">${field('בנק', inp('bCode', f?.bank?.code || '', 'inputmode="numeric" dir="ltr" class="num"'))}
      ${field('סניף', inp('bBranch', f?.bank?.branch || '', 'inputmode="numeric" dir="ltr" class="num"'))}</div>${field('חשבון', inp('bAcc', f?.bank?.account || '', 'inputmode="numeric" dir="ltr" class="num"'))}</div>`,
    [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true,
      check: (v) => (!String(v.name).trim() ? 'יש לכתוב שם' : !fundCode(v.code, v.hp, v.approval) ? 'קוד הקופה — 30 ספרות, או ח.פ (9 ספרות) ומספר אישור' :
        Number(v.payMethod) === 1 && !(digits(v.bCode) && digits(v.bBranch) && digits(v.bAcc)) ? 'העברה בנקאית — חשבון הבנק של הקופה' : '') }],
    { onOpen: (fm) => { const show = () => { fm.querySelector('[data-k="bank"]').style.display = Number(fm.elements.payMethod.value) === 1 ? '' : 'none'; };
      fm.elements.payMethod.addEventListener('change', show); show(); } });
  if (!r) return false;
  const row = { id: f?.id || uid(), name: String(r.name).trim(), kind: r.kind, code: fundCode(r.code, r.hp, r.approval), payMethod: Number(r.payMethod),
    employerNo: String(r.employerNo || '').trim(), bank: Number(r.payMethod) === 1 ? { code: digits(r.bCode), branch: digits(r.bBranch), account: digits(r.bAcc) } : null };
  const funds = cfg().funds || [];
  await savePayroll({ funds: f ? funds.map((x) => (x.id === f.id ? row : x)) : [...funds, row] });
  toast('נשמר ✓');
  return true;
}

async function editEmployer() {
  const pc = cfg().pensionCfg || {}, c = pc.contact || {};
  const r = await modal('המעסיק מול הקופות',
    field('סוג מספר הזיהוי של המעסיק', sel('idType', ID_TYPES, pc.idType || 1)) +
    `<div class="grid2">${field('איש קשר — שם פרטי', inp('first', c.first || ''))}${field('שם משפחה', inp('last', c.last || ''))}</div>` +
    `<div class="grid2">${field('טלפון', inp('phone', c.phone || '', 'inputmode="tel" dir="ltr"'))}${field('נייד', inp('cell', c.cell || '', 'inputmode="tel" dir="ltr"'))}</div>` +
    field('דוא"ל', inp('email', c.email || '', 'type="email" dir="ltr"'), 'של מי שמטפל בפנסיה של העובדים אצל המעסיק — הקופות פונות אליו') +
    `<div class="f"><span>חשבון הבנק של המעסיק — רק אם משלמים לקופה בהעברה בנקאית</span><div class="grid2">${field('בנק', inp('bCode', pc.bank?.code || '', 'inputmode="numeric" dir="ltr" class="num"'))}
      ${field('סניף', inp('bBranch', pc.bank?.branch || '', 'inputmode="numeric" dir="ltr" class="num"'))}</div>${field('חשבון', inp('bAcc', pc.bank?.account || '', 'inputmode="numeric" dir="ltr" class="num"'))}</div>`,
    [{ label: 'ביטול', value: null }, { label: 'שמירה', kind: 'primary', value: 1, submit: true,
      check: (v) => (String(v.first).trim().length < 2 || String(v.last).trim().length < 2 ? 'שם פרטי ושם משפחה של איש הקשר' :
        digits(v.phone).length < 9 || digits(v.phone).length > 11 ? 'טלפון — 9 עד 11 ספרות' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v.email).trim()) ? 'כתובת דוא"ל לא תקינה' : '') }]);
  if (!r) return false;
  await savePayroll({ pensionCfg: { idType: Number(r.idType), contact: { first: String(r.first).trim(), last: String(r.last).trim(), phone: digits(r.phone), cell: digits(r.cell), email: String(r.email).trim() },
    bank: digits(r.bAcc) ? { code: digits(r.bCode), branch: digits(r.bBranch), account: digits(r.bAcc) } : null } });
  toast('נשמר ✓');
  return true;
}
