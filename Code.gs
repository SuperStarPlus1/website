/**
 * סופרסטאר פלוס — סידור עבודה שבועי · גרסה 2
 * Backend: Google Apps Script + Google Sheets
 *
 * ===== שדרוג מגרסה 1 (אם כבר התקנת) =====
 * 1. החלף את כל הקוד בקוד הזה
 * 2. הרץ פעם אחת את הפונקציה upgrade — ייווצרו גיליונות "מנהלים" + "לוג"
 *    ותתווסף עמודת "סיסמה" לגיליון העובדים
 * 3. פריסה → ניהול פריסות (Manage deployments) → עריכה (עיפרון) →
 *    Version: New version → Deploy.  כך הכתובת נשארת זהה!
 *
 * ===== התקנה חדשה =====
 * הרץ פעם אחת את setup, ואז פרוס כאפליקציית אינטרנט (Execute as: Me, Access: Anyone)
 *
 * ===== רמות ניהול (גיליון "מנהלים": שם | סיסמה | תפקיד) =====
 * אדמין        — הכל: משמרות, עובדים, ניהול מנהלים, צפייה בלוג
 * מנהל משמרת  — משמרות + עובדים בלבד
 * כל שינוי במשמרות/עובדים/מנהלים נרשם בגיליון "לוג" עם שם המנהל.
 */

var SHEET_EMPLOYEES = 'עובדים';
var SHEET_SHIFTS = 'משמרות';
var SHEET_SETTINGS = 'הגדרות';
var SHEET_MANAGERS = 'מנהלים';
var SHEET_LOG = 'לוג';
var SHEET_CONSTRAINTS = 'אילוצים';
var SHEET_STAFFING = 'תקן משמרות';
var SHEET_SWAPS = 'החלפות';
var DAY_LETTERS_GS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

var ROLE_ADMIN = 'אדמין';
var ROLE_SHIFT = 'מנהל משמרת';

var DEFAULT_DEPARTMENTS = [
  'הנח"ש',
  'חומרי ניקוי',
  'כללי',
  'מעדניה/פיצוחיה',
  'מקרר',
  'סדרנות מזון',
  'קופאיות',
  'קופה ראשית/גיבוי קופות'
];

var INITIAL_EMPLOYEES = [
  ['פתאן בקרי סרחאן', 'הנח"ש'],
  ['לרין קדאח', 'חומרי ניקוי'],
  ['רולא כיוואן', 'קופאיות'],
  ['רנא מנאע', 'חומרי ניקוי'],
  ['חמדה סואעד', 'כללי'],
  ['אמר קבלאוי', 'מעדניה/פיצוחיה'],
  ['סהאם אסדי', 'מעדניה/פיצוחיה'],
  ['סירנה קדאח', 'מעדניה/פיצוחיה'],
  ['אילנה מנאע', 'מקרר'],
  ['דוניא עותמאן', 'סדרנות מזון'],
  ['מורגאן מסרי', 'סדרנות מזון'],
  ['סמיחה עבד אלראזק', 'סדרנות מזון'],
  ['איה חליל', 'קופאיות'],
  ['אסמהאן חסארמה', 'קופאיות'],
  ["ג'זל אדריס", 'קופאיות'],
  ['גדיר סואעד', 'קופאיות'],
  ['מונא סעיד', 'קופאיות'],
  ['מור נסראוי', 'קופאיות'],
  ['מרים כנעאן', 'קופאיות'],
  ['פדאא אסדי', 'קופאיות'],
  ['ריאן אסדי', 'קופאיות'],
  ['שפיקה דיב', 'קופאיות'],
  ['תימאא סרחאן', 'קופאיות'],
  ['נורהאן עבד אלעזיז', 'קופה ראשית/גיבוי קופות']
];

/* ============ התקנה / שדרוג ============ */

function setup() {
  var ss = SpreadsheetApp.getActive();

  var emp = ss.getSheetByName(SHEET_EMPLOYEES) || ss.insertSheet(SHEET_EMPLOYEES);
  if (emp.getLastRow() === 0) {
    emp.appendRow(['שם', 'מחלקות', 'פעיל', 'סיסמה', 'ימי חופש קבועים', 'שם משתמש', 'כישורים', 'משמרות קבועות', 'דירוג', 'אימייל']);
    INITIAL_EMPLOYEES.forEach(function (e) { emp.appendRow([e[0], e[1], 'כן', '', '', '', '', '', 2, '']); });
    emp.setColumnWidths(1, 2, 180);
  }

  var sh = ss.getSheetByName(SHEET_SHIFTS) || ss.insertSheet(SHEET_SHIFTS);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['תאריך', 'עובד', 'מחלקה', 'התחלה', 'סיום']);
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('D:E').setNumberFormat('@');
  }

  var st = ss.getSheetByName(SHEET_SETTINGS) || ss.insertSheet(SHEET_SETTINGS);
  if (st.getLastRow() === 0) {
    st.getRange('A1').setValue('(הסיסמה עברה לגיליון "מנהלים")');
    st.getRange('A3').setValue('מחלקות (לפי סדר תצוגה)');
    DEFAULT_DEPARTMENTS.forEach(function (d, i) { st.getRange(4 + i, 1).setValue(d); });
  }

  upgrade();
}

/** שדרוג מגרסה 1: מוסיף מנהלים, לוג ועמודת סיסמה לעובדים. בטוח להרצה חוזרת. */
function upgrade() {
  var ss = SpreadsheetApp.getActive();

  // עמודות סיסמה + ימי חופש קבועים לעובדים
  var emp = ss.getSheetByName(SHEET_EMPLOYEES);
  if (emp) {
    if (String(emp.getRange('D1').getValue()).trim() === '') emp.getRange('D1').setValue('סיסמה');
    if (String(emp.getRange('E1').getValue()).trim() === '') emp.getRange('E1').setValue('ימי חופש קבועים');
    if (String(emp.getRange('F1').getValue()).trim() === '') emp.getRange('F1').setValue('שם משתמש');
    if (String(emp.getRange('G1').getValue()).trim() === '') emp.getRange('G1').setValue('כישורים');
    if (String(emp.getRange('H1').getValue()).trim() === '') emp.getRange('H1').setValue('משמרות קבועות');
    if (String(emp.getRange('I1').getValue()).trim() === '') emp.getRange('I1').setValue('דירוג');
    if (String(emp.getRange('J1').getValue()).trim() === '') emp.getRange('J1').setValue('אימייל');
  }

  // גיליון מנהלים — נזרע מהסיסמה הישנה בהגדרות B1 אם קיימת
  var mg = ss.getSheetByName(SHEET_MANAGERS);
  if (!mg) {
    mg = ss.insertSheet(SHEET_MANAGERS);
    mg.appendRow(['שם', 'סיסמה', 'תפקיד']);
    var legacy = '1234';
    var st = ss.getSheetByName(SHEET_SETTINGS);
    if (st) {
      var old = String(st.getRange('B1').getValue()).trim();
      if (old) legacy = old;
      st.getRange('A1').setValue('(הסיסמה עברה לגיליון "מנהלים")');
      st.getRange('B1').setValue('');
    }
    mg.appendRow(['מנהל ראשי', legacy, ROLE_ADMIN]);
  }

  // גיליון לוג
  var lg = ss.getSheetByName(SHEET_LOG);
  if (!lg) {
    lg = ss.insertSheet(SHEET_LOG);
    lg.appendRow(['זמן', 'מנהל', 'פעולה', 'פירוט']);
    lg.setColumnWidth(1, 140);
    lg.setColumnWidth(4, 420);
  }

  // גיליון אילוצים (בקשות עובדים)
  var cs = ss.getSheetByName(SHEET_CONSTRAINTS);
  if (!cs) {
    cs = ss.insertSheet(SHEET_CONSTRAINTS);
    cs.appendRow(['תאריך', 'עובד', 'חלק', 'סטטוס', 'הוגש']);
    cs.getRange('A:A').setNumberFormat('@');
  }

  // גיליון תקן משמרות: מחלקה + 14 עמודות (בוקר/ערב לכל יום) + כישורי חובה
  var st2 = ss.getSheetByName(SHEET_STAFFING);
  if (!st2) {
    st2 = ss.insertSheet(SHEET_STAFFING);
    var hdr = ['מחלקה'];
    DAY_LETTERS_GS.forEach(function (l) { hdr.push(l + ' בוקר'); hdr.push(l + ' ערב'); });
    hdr.push('כישור חובה בוקר'); hdr.push('כישור חובה ערב');
    st2.appendRow(hdr);
    getDepartments_().forEach(function (d) {
      var row = [d];
      for (var i = 0; i < 14; i++) row.push(1);
      row.push(''); row.push(d === 'קופאיות' ? 'טביעת אצבע' : '');
      st2.appendRow(row);
    });
  } else {
    if (String(st2.getRange('P1').getValue()).trim() === '') st2.getRange('P1').setValue('כישור חובה בוקר');
    if (String(st2.getRange('Q1').getValue()).trim() === '') st2.getRange('Q1').setValue('כישור חובה ערב');
    // ברירת מחדל: טביעת אצבע בערב קופאיות
    var vals2 = st2.getRange(2, 1, Math.max(st2.getLastRow() - 1, 1), 1).getValues();
    for (var r2 = 0; r2 < vals2.length; r2++) {
      if (String(vals2[r2][0]).trim() === 'קופאיות' && String(st2.getRange(r2 + 2, 17).getValue()).trim() === '') {
        st2.getRange(r2 + 2, 17).setValue('טביעת אצבע');
      }
    }
  }

  // גיליון החלפות
  var sw = ss.getSheetByName(SHEET_SWAPS);
  if (!sw) {
    sw = ss.insertSheet(SHEET_SWAPS);
    sw.appendRow(['תאריך', 'מחלקה', 'התחלה', 'סיום', 'מבקש', 'מחליף', 'סטטוס', 'הוגש']);
    sw.getRange('A:A').setNumberFormat('@');
  }
}

/* ============ תקן ואילוצים — עזר ============ */

function getStaffing_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_STAFFING);
  var out = {};
  if (sh && sh.getLastRow() > 1) {
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 17).getValues();
    vals.forEach(function (r) {
      var d = String(r[0]).trim();
      if (!d) return;
      var days = [];
      for (var i = 0; i < 7; i++) days.push([Number(r[1 + i * 2]) || 0, Number(r[2 + i * 2]) || 0]);
      out[d] = { days: days, ms: String(r[15] || '').trim(), es: String(r[16] || '').trim() };
    });
  }
  return out;
}

function getSwaps_(weekSet) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_SWAPS);
  var out = [];
  if (sh && sh.getLastRow() > 1) {
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
    vals.forEach(function (r) {
      var ds = toDateStr_(r[0]);
      if (weekSet && !weekSet[ds]) return;
      if (!String(r[4]).trim()) return;
      out.push({ date: ds, dept: String(r[1]).trim(), start: toTimeStr_(r[2]), end: toTimeStr_(r[3]),
                 requester: String(r[4]).trim(), target: String(r[5]).trim(), status: String(r[6]).trim() || 'ממתין' });
    });
  }
  return out;
}

function findSwapRow_(s) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_SWAPS);
  if (!sh || sh.getLastRow() < 2) return -1;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (toDateStr_(vals[i][0]) === s.date && String(vals[i][1]).trim() === s.dept &&
        toTimeStr_(vals[i][2]) === s.start && String(vals[i][4]).trim() === s.requester &&
        String(vals[i][5]).trim() === s.target) return i + 2;
  }
  return -1;
}

function getEmailOf_(name) {
  var e = getEmployees_(true).filter(function (x) { return x.name === name; })[0];
  return e && e.email ? e.email : '';
}

function notify_(emails, subject, bodyText) {
  emails.filter(function (m) { return m && m.indexOf('@') > 0; }).forEach(function (m) {
    try { MailApp.sendEmail(m, subject, bodyText); } catch (err) {}
  });
}

function getConstraints_(weekSet) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_CONSTRAINTS);
  var out = [];
  if (sh && sh.getLastRow() > 1) {
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
    vals.forEach(function (r) {
      var ds = toDateStr_(r[0]);
      if (weekSet && !weekSet[ds]) return;
      if (!String(r[1]).trim()) return;
      out.push({ date: ds, employee: String(r[1]).trim(), part: String(r[2]).trim() || 'מלא',
                 status: String(r[3]).trim() || 'מאושר' });
    });
  }
  return out;
}

function findConstraintRow_(date, employee, part) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_CONSTRAINTS);
  if (!sh || sh.getLastRow() < 2) return -1;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (toDateStr_(vals[i][0]) === date && String(vals[i][1]).trim() === employee &&
        (String(vals[i][2]).trim() || 'מלא') === part) return i + 2;
  }
  return -1;
}

/* ============ עזר ============ */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function toDateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).trim();
}
function toTimeStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  return String(v).trim();
}
function now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
}

/** אימות מנהל: מחזיר תפקיד או null */
function authManager_(name, password) {
  var mg = SpreadsheetApp.getActive().getSheetByName(SHEET_MANAGERS);
  if (!mg || mg.getLastRow() < 2) return null;
  var vals = mg.getRange(2, 1, mg.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(name).trim() &&
        String(vals[i][1]).trim() === String(password).trim()) {
      var role = String(vals[i][2]).trim();
      return role === ROLE_ADMIN ? ROLE_ADMIN : ROLE_SHIFT;
    }
  }
  return null;
}

function log_(manager, action, detail) {
  var lg = SpreadsheetApp.getActive().getSheetByName(SHEET_LOG);
  if (lg) lg.appendRow([now_(), manager, action, detail || '']);
}

function getDepartments_() {
  var st = SpreadsheetApp.getActive().getSheetByName(SHEET_SETTINGS);
  var out = [];
  if (st && st.getLastRow() >= 4) {
    var vals = st.getRange(4, 1, st.getLastRow() - 3, 1).getValues();
    vals.forEach(function (r) { if (String(r[0]).trim()) out.push(String(r[0]).trim()); });
  }
  return out.length ? out : DEFAULT_DEPARTMENTS;
}

function getEmployees_(withPasswords) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_EMPLOYEES);
  var out = [];
  if (sheet && sheet.getLastRow() > 1) {
    var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
    vals.forEach(function (r) {
      var name = String(r[0]).trim();
      if (!name) return;
      var e = { name: name, dept: String(r[1]).trim(), active: String(r[2]).trim() !== 'לא',
                offDays: String(r[4]).trim(), skills: String(r[6]).trim() };
      if (withPasswords) {
        e.password = String(r[3]).trim(); e.username = String(r[5]).trim();
        e.fixedShifts = String(r[7]).trim();
        e.rating = Number(r[8]) || 2;
        e.email = String(r[9]).trim();
      }
      else e.hasPw = String(r[3]).trim() !== '';
      out.push(e);
    });
  }
  return out;
}

function weekRange_(weekStart) {
  var parts = String(weekStart).split('-');
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  var dates = [];
  for (var i = 0; i < 7; i++) {
    var x = new Date(d.getTime() + i * 86400000);
    dates.push(Utilities.formatDate(x, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  }
  return dates;
}

function shiftKey_(r) { // r = [date, emp, dept, start, end]
  return r.join('|');
}
function shiftLabel_(r) {
  return r[0] + ' · ' + r[1] + ' · ' + r[2] + (r[3] ? ' · ' + r[3] + (r[4] ? '–' + r[4] : '') : '');
}

/* ============ GET — חסום. הצפייה מחייבת התחברות דרך POST ============ */

function doGet(e) {
  return json_({ ok: false, authRequired: true, error: 'נדרשת התחברות — הצפייה בסידור למשתמשי המערכת בלבד' });
}

/** אימות עובד לפי שם משתמש: מחזיר שם מלא או null */
function authEmployee_(username, password) {
  var uname = String(username || '').trim().toLowerCase();
  var pw = String(password || '').trim();
  if (!uname || !pw) return null;
  var emps = getEmployees_(true);
  for (var i = 0; i < emps.length; i++) {
    if (emps[i].username && emps[i].username.toLowerCase() === uname && emps[i].password === pw) {
      return emps[i].name;
    }
  }
  return null;
}

/** נתוני שבוע (לאחר אימות) */
function weekData_(week) {
  var dates = weekRange_(week);
  var set = {};
  dates.forEach(function (d) { set[d] = true; });

  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_SHIFTS);
  var shifts = [];
  if (sheet && sheet.getLastRow() > 1) {
    var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
    vals.forEach(function (r) {
      var ds = toDateStr_(r[0]);
      if (!set[ds]) return;
      shifts.push({
        date: ds, employee: String(r[1]).trim(), dept: String(r[2]).trim(),
        start: toTimeStr_(r[3]), end: toTimeStr_(r[4])
      });
    });
  }
  var wset = {};
  dates.forEach(function (d) { wset[d] = true; });
  return { ok: true, employees: getEmployees_(false), departments: getDepartments_(),
           shifts: shifts, constraints: getConstraints_(wset), swaps: getSwaps_(wset) };
}

/* ============ POST ============ */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    /* --- נתוני שבוע: מחייב התחברות של עובד או מנהל --- */
    if (action === 'getData') {
      var allowed = false;
      if (body.mname) allowed = !!authManager_(body.mname, body.password);
      else if (body.username) allowed = !!authEmployee_(body.username, body.password);
      if (!allowed) return json_({ ok: false, authRequired: true, error: 'נדרשת התחברות' });
      return json_(weekData_(body.week));
    }

    /* --- כניסת עובד לפי שם משתמש (ללא הרשאות ניהול) --- */
    if (action === 'elogin') {
      var uname = String(body.username || '').trim().toLowerCase();
      if (!uname) return json_({ ok: false, error: 'יש להזין שם משתמש' });
      var emps = getEmployees_(true);
      for (var i = 0; i < emps.length; i++) {
        if (emps[i].username && emps[i].username.toLowerCase() === uname) {
          if (!emps[i].password) return json_({ ok: false, error: 'לעובד זה לא הוגדרה סיסמה — פנה למנהל' });
          if (emps[i].password === String(body.password).trim()) {
            log_(emps[i].name, 'כניסת עובד', 'שם משתמש: ' + emps[i].username);
            return json_({ ok: true, name: emps[i].name });
          }
          return json_({ ok: false, error: 'סיסמה שגויה' });
        }
      }
      return json_({ ok: false, error: 'שם משתמש לא נמצא' });
    }

    /* --- הגשת אילוץ על ידי עובד --- */
    if (action === 'addConstraint') {
      var en = authEmployee_(body.username, body.password);
      if (!en) return json_({ ok: false, error: 'נדרשת התחברות עובד' });
      var dateStr = String(body.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return json_({ ok: false, error: 'תאריך לא תקין' });
      var part = (body.part === 'בוקר' || body.part === 'ערב') ? body.part : 'מלא';
      var tz = Session.getScriptTimeZone();
      var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
      if (dateStr < today) return json_({ ok: false, error: 'לא ניתן להגיש אילוץ לתאריך שעבר' });

      var p = dateStr.split('-');
      var dObj = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      var dow = dObj.getDay();

      // כפילות: אילוץ קיים (שלא נדחה) שחופף לאותו תאריך
      var all = getConstraints_(null);
      for (var i = 0; i < all.length; i++) {
        var c = all[i];
        if (c.employee === en && c.date === dateStr && c.status !== 'נדחה' &&
            (c.part === 'מלא' || part === 'מלא' || c.part === part)) {
          return json_({ ok: false, error: 'כבר קיים אילוץ לתאריך זה' });
        }
      }

      var isWeekend = (dow === 5 || dow === 6);
      if (!isWeekend) {
        // מגבלת 2 אילוצים (א-ה) לאותו שבוע, לא כולל נדחים
        var sunday = new Date(dObj.getTime() - dow * 86400000);
        var wk = {};
        for (var j = 0; j < 7; j++) {
          wk[Utilities.formatDate(new Date(sunday.getTime() + j * 86400000), tz, 'yyyy-MM-dd')] = true;
        }
        var count = 0;
        all.forEach(function (c2) {
          if (c2.employee !== en || !wk[c2.date] || c2.status === 'נדחה') return;
          var pp = c2.date.split('-');
          var dw = new Date(Number(pp[0]), Number(pp[1]) - 1, Number(pp[2])).getDay();
          if (dw <= 4) count++;
        });
        if (count >= 2) return json_({ ok: false, code: 'limit',
          error: 'המערכת מוגבלת ל-2 אילוצים בשבוע בלבד — לבקשה חריגה יש לפנות למנהל' });
      }

      var status = isWeekend ? 'ממתין' : 'מאושר';
      SpreadsheetApp.getActive().getSheetByName(SHEET_CONSTRAINTS)
        .appendRow([dateStr, en, part, status, now_()]);
      log_(en, 'הגשת אילוץ', dateStr + ' (' + DAY_LETTERS_GS[dow] + ') · ' + part + ' · ' + status);
      return json_({ ok: true, status: status });
    }

    /* --- מחיקת אילוץ: עובד (שלו בלבד) או מנהל --- */
    if (action === 'deleteConstraint') {
      var who = null, target = String(body.employee || '').trim();
      if (body.mname && authManager_(body.mname, body.password)) who = String(body.mname).trim();
      else {
        var en2 = authEmployee_(body.username, body.password);
        if (en2) { who = en2; target = en2; }
      }
      if (!who) return json_({ ok: false, error: 'נדרשת התחברות' });
      var rowIdx = findConstraintRow_(String(body.date).trim(), target, String(body.part).trim() || 'מלא');
      if (rowIdx < 0) return json_({ ok: false, error: 'האילוץ לא נמצא' });
      SpreadsheetApp.getActive().getSheetByName(SHEET_CONSTRAINTS).deleteRow(rowIdx);
      log_(who, 'מחיקת אילוץ', body.date + ' · ' + target + ' · ' + body.part);
      return json_({ ok: true });
    }

    /* --- בקשת החלפת משמרת (עובד) --- */
    if (action === 'addSwap') {
      var enS = authEmployee_(body.username, body.password);
      if (!enS) return json_({ ok: false, error: 'נדרשת התחברות עובד' });
      // אימות שהמשמרת אכן שייכת למבקש
      var shSheet = SpreadsheetApp.getActive().getSheetByName(SHEET_SHIFTS);
      var found = false;
      if (shSheet.getLastRow() > 1) {
        var sv = shSheet.getRange(2, 1, shSheet.getLastRow() - 1, 5).getValues();
        for (var i = 0; i < sv.length; i++) {
          if (toDateStr_(sv[i][0]) === body.date && String(sv[i][1]).trim() === enS &&
              String(sv[i][2]).trim() === body.dept && toTimeStr_(sv[i][3]) === body.start) { found = true; break; }
        }
      }
      if (!found) return json_({ ok: false, error: 'המשמרת לא נמצאה על שמך' });
      var target = String(body.target || '').trim();
      if (!target || target === enS) return json_({ ok: false, error: 'יש לבחור עובד להחלפה' });
      // כפילות בקשה
      var dup = getSwaps_(null).some(function (s) {
        return s.date === body.date && s.dept === body.dept && s.start === body.start &&
               s.requester === enS && s.status === 'ממתין';
      });
      if (dup) return json_({ ok: false, error: 'כבר קיימת בקשת החלפה ממתינה למשמרת זו' });
      SpreadsheetApp.getActive().getSheetByName(SHEET_SWAPS)
        .appendRow([body.date, body.dept, body.start, body.end, enS, target, 'ממתין', now_()]);
      log_(enS, 'בקשת החלפה', body.date + ' · ' + body.dept + ' · עם ' + target);
      return json_({ ok: true });
    }

    /* --- מחיקת בקשת החלפה: עובד (שלו, ממתינה) או מנהל --- */
    if (action === 'deleteSwap') {
      var whoS = null, s0 = { date: String(body.date).trim(), dept: String(body.dept).trim(),
        start: String(body.start).trim(), requester: String(body.requester || '').trim(),
        target: String(body.target || '').trim() };
      if (body.mname && authManager_(body.mname, body.password)) whoS = String(body.mname).trim();
      else {
        var en3 = authEmployee_(body.username, body.password);
        if (en3 && s0.requester === en3) whoS = en3;
      }
      if (!whoS) return json_({ ok: false, error: 'נדרשת התחברות' });
      var swRow = findSwapRow_(s0);
      if (swRow < 0) return json_({ ok: false, error: 'הבקשה לא נמצאה' });
      SpreadsheetApp.getActive().getSheetByName(SHEET_SWAPS).deleteRow(swRow);
      log_(whoS, 'מחיקת בקשת החלפה', s0.date + ' · ' + s0.requester);
      return json_({ ok: true });
    }

    /* --- כל השאר מחייב מנהל --- */
    var role = authManager_(body.mname, body.password);
    if (!role) return json_({ ok: false, error: 'שם מנהל או סיסמה שגויים' });

    if (action === 'mlogin') {
      log_(String(body.mname).trim(), 'כניסת מנהל', role);
      return json_({ ok: true, role: role, name: String(body.mname).trim() });
    }

    if (action === 'getAdminData') {
      var res = { ok: true, role: role, employees: getEmployees_(true), staffing: getStaffing_() };
      if (role === ROLE_ADMIN) {
        var mg = SpreadsheetApp.getActive().getSheetByName(SHEET_MANAGERS);
        res.managers = [];
        if (mg && mg.getLastRow() > 1) {
          mg.getRange(2, 1, mg.getLastRow() - 1, 3).getValues().forEach(function (r) {
            if (String(r[0]).trim()) res.managers.push({ name: String(r[0]).trim(), password: String(r[1]), role: String(r[2]).trim() });
          });
        }
        var lg = SpreadsheetApp.getActive().getSheetByName(SHEET_LOG);
        res.log = [];
        if (lg && lg.getLastRow() > 1) {
          var n = Math.min(lg.getLastRow() - 1, 200);
          lg.getRange(lg.getLastRow() - n + 1, 1, n, 4).getValues().forEach(function (r) {
            res.log.push({ time: String(r[0]), manager: String(r[1]), action: String(r[2]), detail: String(r[3]) });
          });
          res.log.reverse();
        }
      }
      return json_(res);
    }

    if (action === 'saveWeek') {
      var dates = weekRange_(body.weekStart);
      var set = {};
      dates.forEach(function (d) { set[d] = true; });

      var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_SHIFTS);
      var keep = [], oldWeek = [];
      if (sheet.getLastRow() > 1) {
        var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
        vals.forEach(function (r) {
          if (!String(r[0]).trim() && !String(r[1]).trim()) return;
          var row = [toDateStr_(r[0]), String(r[1]).trim(), String(r[2]).trim(), toTimeStr_(r[3]), toTimeStr_(r[4])];
          if (set[row[0]]) oldWeek.push(row); else keep.push(row);
        });
      }
      var newWeek = [];
      (body.shifts || []).forEach(function (s) {
        if (!s.employee || !s.date) return;
        newWeek.push([s.date, s.employee, s.dept || '', s.start || '', s.end || '']);
      });

      // לוג שינויים: הוספות ומחיקות
      var oldKeys = {}, newKeys = {};
      oldWeek.forEach(function (r) { oldKeys[shiftKey_(r)] = r; });
      newWeek.forEach(function (r) { newKeys[shiftKey_(r)] = r; });
      var added = [], removed = [];
      newWeek.forEach(function (r) { if (!oldKeys[shiftKey_(r)]) added.push(r); });
      oldWeek.forEach(function (r) { if (!newKeys[shiftKey_(r)]) removed.push(r); });
      added.slice(0, 60).forEach(function (r) { log_(body.mname, 'הוספת משמרת', shiftLabel_(r)); });
      removed.slice(0, 60).forEach(function (r) { log_(body.mname, 'מחיקת משמרת', shiftLabel_(r)); });
      if (added.length || removed.length) {
        log_(body.mname, 'שמירת שבוע', body.weekStart + ' — ' + added.length + ' הוספות, ' + removed.length + ' מחיקות');
      }

      var all = keep.concat(newWeek);
      all.sort(function (a, b) { return (a[0] + a[2] + a[3]).localeCompare(b[0] + b[2] + b[3]); });
      if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
      if (all.length) sheet.getRange(2, 1, all.length, 5).setValues(all);
      return json_({ ok: true, saved: newWeek.length });
    }

    if (action === 'saveEmployees') {
      var sheet2 = SpreadsheetApp.getActive().getSheetByName(SHEET_EMPLOYEES);
      var rows = (body.employees || [])
        .filter(function (p) { return p.name && String(p.name).trim(); })
        .map(function (p) {
          return [String(p.name).trim(), p.dept || '', p.active === false ? 'לא' : 'כן',
                  String(p.password || ''), String(p.offDays || ''), String(p.username || '').trim(),
                  String(p.skills || '').trim(), String(p.fixedShifts || '').trim(),
                  Number(p.rating) || 2, String(p.email || '').trim()];
        });
      if (sheet2.getLastRow() > 1) sheet2.getRange(2, 1, sheet2.getLastRow() - 1, 10).clearContent();
      if (rows.length) sheet2.getRange(2, 1, rows.length, 10).setValues(rows);
      log_(body.mname, 'עדכון עובדים', rows.length + ' עובדים ברשימה');
      return json_({ ok: true, saved: rows.length });
    }

    if (action === 'saveManagers') {
      if (role !== ROLE_ADMIN) return json_({ ok: false, error: 'רק אדמין יכול לנהל מנהלים' });
      var list = (body.managers || [])
        .filter(function (m) { return m.name && String(m.name).trim() && String(m.password || '').trim(); })
        .map(function (m) {
          var r = String(m.role).trim() === ROLE_ADMIN ? ROLE_ADMIN : ROLE_SHIFT;
          return [String(m.name).trim(), String(m.password).trim(), r];
        });
      var hasAdmin = list.some(function (r) { return r[2] === ROLE_ADMIN; });
      if (!hasAdmin) return json_({ ok: false, error: 'חייב להישאר לפחות אדמין אחד' });

      var mg2 = SpreadsheetApp.getActive().getSheetByName(SHEET_MANAGERS);
      if (mg2.getLastRow() > 1) mg2.getRange(2, 1, mg2.getLastRow() - 1, 3).clearContent();
      if (list.length) mg2.getRange(2, 1, list.length, 3).setValues(list);
      log_(body.mname, 'עדכון מנהלים', list.map(function (r) { return r[0] + ' (' + r[2] + ')'; }).join(', '));
      return json_({ ok: true, saved: list.length });
    }

    /* --- אישור/דחיית אילוץ (מנהל) --- */
    if (action === 'reviewConstraint') {
      var st = body.status === 'מאושר' ? 'מאושר' : 'נדחה';
      var ri = findConstraintRow_(String(body.date).trim(), String(body.employee).trim(), String(body.part).trim() || 'מלא');
      if (ri < 0) return json_({ ok: false, error: 'האילוץ לא נמצא' });
      SpreadsheetApp.getActive().getSheetByName(SHEET_CONSTRAINTS).getRange(ri, 4).setValue(st);
      log_(body.mname, st === 'מאושר' ? 'אישור אילוץ' : 'דחיית אילוץ', body.date + ' · ' + body.employee + ' · ' + body.part);
      notify_([getEmailOf_(String(body.employee).trim())],
        'עדכון בקשת אילוץ — סופרסטאר',
        'בקשת האילוץ שהגשת לתאריך ' + body.date + ' (' + body.part + ') ' +
        (st === 'מאושר' ? 'אושרה' : 'נדחתה') + ' על ידי ' + body.mname + '.');
      return json_({ ok: true });
    }

    /* --- שמירת תקן משמרות (מנהל) --- */
    if (action === 'saveStaffing') {
      var sh3 = SpreadsheetApp.getActive().getSheetByName(SHEET_STAFFING);
      var deps = getDepartments_();
      var rows3 = deps.map(function (d) {
        var cfg3 = (body.staffing && body.staffing[d]) || {};
        var days = cfg3.days || [];
        var row = [d];
        for (var i = 0; i < 7; i++) {
          var pair = days[i] || [0, 0];
          row.push(Number(pair[0]) || 0);
          row.push(Number(pair[1]) || 0);
        }
        row.push(String(cfg3.ms || '').trim());
        row.push(String(cfg3.es || '').trim());
        return row;
      });
      if (sh3.getLastRow() > 1) sh3.getRange(2, 1, sh3.getLastRow() - 1, 17).clearContent();
      sh3.getRange(2, 1, rows3.length, 17).setValues(rows3);
      log_(body.mname, 'עדכון תקן משמרות', deps.length + ' מחלקות');
      return json_({ ok: true });
    }

    /* --- אישור/דחיית החלפה (מנהל) — באישור מתבצעת ההחלפה בפועל --- */
    if (action === 'reviewSwap') {
      var stS = body.status === 'מאושר' ? 'מאושר' : 'נדחה';
      var sw = { date: String(body.date).trim(), dept: String(body.dept).trim(),
                 start: String(body.start).trim(), requester: String(body.requester).trim(),
                 target: String(body.target).trim() };
      var rowS = findSwapRow_(sw);
      if (rowS < 0) return json_({ ok: false, error: 'הבקשה לא נמצאה' });
      var swSheet = SpreadsheetApp.getActive().getSheetByName(SHEET_SWAPS);

      if (stS === 'מאושר') {
        var shs = SpreadsheetApp.getActive().getSheetByName(SHEET_SHIFTS);
        var reqRow = -1, tgtRow = -1;
        if (shs.getLastRow() > 1) {
          var sv2 = shs.getRange(2, 1, shs.getLastRow() - 1, 5).getValues();
          for (var j = 0; j < sv2.length; j++) {
            var ds2 = toDateStr_(sv2[j][0]), emp2 = String(sv2[j][1]).trim(), dp2 = String(sv2[j][2]).trim();
            if (reqRow < 0 && ds2 === sw.date && emp2 === sw.requester && dp2 === sw.dept &&
                toTimeStr_(sv2[j][3]) === sw.start) reqRow = j + 2;
            else if (tgtRow < 0 && ds2 === sw.date && emp2 === sw.target && dp2 !== 'אי-זמינות') tgtRow = j + 2;
          }
        }
        if (reqRow < 0) return json_({ ok: false, error: 'המשמרת המקורית כבר שונתה — לא ניתן לאשר' });
        shs.getRange(reqRow, 2).setValue(sw.target);
        if (tgtRow > 0) shs.getRange(tgtRow, 2).setValue(sw.requester); // החלפה הדדית באותו יום
      }

      swSheet.getRange(rowS, 7).setValue(stS);
      log_(body.mname, stS === 'מאושר' ? 'אישור החלפה' : 'דחיית החלפה',
           sw.date + ' · ' + sw.requester + ' ⇄ ' + sw.target);
      notify_([getEmailOf_(sw.requester), getEmailOf_(sw.target)],
        'החלפת משמרת ' + (stS === 'מאושר' ? 'אושרה' : 'נדחתה') + ' — סופרסטאר',
        'בקשת ההחלפה לתאריך ' + sw.date + ' (' + sw.dept + ', ' + sw.start + ') בין ' + sw.requester +
        ' ל-' + sw.target + ' ' + (stS === 'מאושר' ? 'אושרה' : 'נדחתה') + ' על ידי ' + body.mname + '.');
      return json_({ ok: true });
    }

    /* --- פרסום סידור: התראה לכל העובדים (מנהל) --- */
    if (action === 'publish') {
      var link = '';
      var stt = SpreadsheetApp.getActive().getSheetByName(SHEET_SETTINGS);
      if (stt) link = String(stt.getRange('B2').getValue()).trim();
      var emails = getEmployees_(true).filter(function (e) { return e.active && e.email; })
        .map(function (e) { return e.email; });
      notify_(emails, 'פורסם סידור עבודה חדש — סופרסטאר',
        'פורסם סידור עבודה לשבוע ' + body.week + '.' + (link ? ' לצפייה: ' + link : '') +
        ' יש להתחבר עם שם המשתמש והסיסמה שלך.');
      log_(body.mname, 'פרסום סידור', body.week + ' · נשלח ל-' + emails.length + ' עובדים');
      return json_({ ok: true, sent: emails.length });
    }

    return json_({ ok: false, error: 'פעולה לא מוכרת' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
