// עודכן 2026-09-13: הכתובת הקודמת הצביעה על פריסה ישנה/נטושה של הסקריפט (לא זו שמעודכנת בכל
// שינוי ב-shifts.html) — activeShiftEmployees שם תמיד חזר ריק (כנראה עדיין קורא את גיליון
// הנוכחות הישן, לפני הפיצול לטאבים חודשיים), ולכן התפריט תמיד הציג רק את השם הקבוע למטה.
// הכתובת הזו היא אותה פריסה שמתעדכנת תמיד יחד עם shifts.html — ר' GAS_URL שם.
const GAS_URL = 'https://script.google.com/macros/s/AKfycbze9AQ0vpidBqKhVzd6lqSwUhVN_PxPTVj33_Xfmr3JBjqPnkDMqJH8A7NCIN5BDkv_/exec';

// הסניף היחיד שטופסי הבקרה האלה משמשים אותו (הכלי קדם לגרסה הרב-סניפית ולא עודכן מאז)
const CHECKLIST_BRANCH = 'סופרסטאר';

function initBranchChecklist(opts) {
  const items = opts.items;
  const mode = opts.mode; // 'closing' | 'opening'

  document.getElementById("pageTitle").textContent = opts.title;
  document.title = opts.title;

  const now = new Date();
  document.getElementById("dateTime").value = now.toLocaleString();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const checklistDiv = document.getElementById("checklist");
  const uploadedFiles = {};

  // kioskEmployees — רשימת עובדים פעילים בסניף, ציבורית בכוונה (בלי חשיפת נוכחות/סיסמה),
  // בדיוק מתאימה לטופס ציבורי כזה בלי התחברות. מחליף את activeShiftEmployees (דרש התחברות
  // מנהל שהטופס הזה מעולם לא שלח, ולכן חזר ריק) ואת ברירת המחדל הקבועה ("אשרף עדנאן") שהיתה
  // תמיד מופיעה ברשימה בלי קשר למי שבאמת עובד היום — הוסרה לפי בקשת המשתמש.
  const empSelect = document.getElementById("employeeName");
  fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'kioskEmployees', branch: CHECKLIST_BRANCH }) })
    .then(res => res.json())
    .then(j => {
      const names = (j.ok && j.employees) ? j.employees.map(e => e.name) : [];
      empSelect.innerHTML = names.length
        ? names.map(n => `<option value="${n}">${n}</option>`).join('')
        : `<option value="">— לא נמצאו עובדים פעילים —</option>`;
    })
    .catch(() => {
      empSelect.innerHTML = `<option value="">— שגיאה בטעינת רשימת עובדים —</option>`;
    });

  function updateTaskCounter() {
    const total = items.length;
    let done = 0;
    for (let i = 0; i < total; i++) {
      if (document.getElementById(`item${i}`).checked) done++;
    }
    document.getElementById("taskCounter").innerText = `משימות שנותרו: ${total - done}`;
  }

  items.forEach((item, idx) => {
    const section = document.createElement("div"); section.className = "section";
    const textContainer = document.createElement("div"); textContainer.className = "text-container";
    textContainer.innerHTML = `<label><input type="checkbox" id="item${idx}"> ${item.text}</label>`;
    section.appendChild(textContainer);
    if (item.requireImage) {
      const addBtn = document.createElement("button"); addBtn.type = "button"; addBtn.className = "add-image-btn";
      addBtn.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/685/685655.png">';
      addBtn.onclick = () => addImage(idx); section.appendChild(addBtn);
      const imgContainer = document.createElement("div"); imgContainer.id = `imgContainer${idx}`;
      section.appendChild(imgContainer); uploadedFiles[idx] = [];
    }
    if (item.tempCount) {
      const tempsDiv = document.createElement("div");
      tempsDiv.style.cssText = "margin-top:8px;display:flex;flex-wrap:wrap;gap:6px";
      for (let t = 0; t < item.tempCount; t++) {
        const tempInput = document.createElement("input");
        tempInput.type = "number"; tempInput.step = "0.1"; tempInput.id = `temp${idx}_${t}`;
        tempInput.placeholder = item.tempCount > 1 ? `תא ${t + 1}` : 'מעלות';
        tempInput.style.cssText = `width:${item.tempCount > 1 ? '70px' : '100px'};padding:6px`;
        tempsDiv.appendChild(tempInput);
      }
      textContainer.appendChild(tempsDiv);
    }
    if (item.counts) {
      const countsDiv = document.createElement("div");
      countsDiv.style.cssText = "margin-top:8px;display:flex;flex-wrap:wrap;gap:8px";
      item.counts.forEach((label, c) => {
        const wrap = document.createElement("label");
        wrap.style.cssText = "display:flex;flex-direction:column;font-size:12px;color:#555";
        const countInput = document.createElement("input");
        countInput.type = "number"; countInput.step = "1"; countInput.min = "0"; countInput.id = `count${idx}_${c}`;
        countInput.style.cssText = "width:70px;padding:6px;margin-top:2px";
        wrap.appendChild(document.createTextNode(label));
        wrap.appendChild(countInput);
        countsDiv.appendChild(wrap);
      });
      textContainer.appendChild(countsDiv);
    }
    checklistDiv.appendChild(section);
    document.getElementById(`item${idx}`).addEventListener("change", updateTaskCounter);
  });

  updateTaskCounter();

  window.addImage = function (idx) {
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.capture = "environment";
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        const fileName = `item${idx}_image${uploadedFiles[idx].length + 1}.jpg`;
        const img = document.createElement("img"); img.src = reader.result; img.className = "preview-img";
        img.style.opacity = '0.4';
        document.getElementById(`imgContainer${idx}`).appendChild(img);
        // מעלים כל תמונה מיד עם הצילום (בקשה קטנה ונפרדת) - כדי לא לצבור את כל התמונות
        // לבקשה אחת ענקית בסוף, מה שגרם ל"load failed" בנייד כשיש כמה תמונות.
        // רשת סלולרית לפעמים "מקלקלת" בקשה בודדת בטרנספר (במיוחד בקבצים גדולים) - לכן עד 3 ניסיונות לפני שמדווחים שגיאה.
        let uploadOk = false, lastErr = null;
        for (let attempt = 1; attempt <= 3 && !uploadOk; attempt++) {
          try {
            const res = await fetch(GAS_URL, {
              method: 'POST',
              body: JSON.stringify({ action: 'uploadChecklistPhoto', mode, stamp, fileName, fileData: base64 })
            });
            const j = await res.json();
            if (!j.ok) throw new Error(j.error || 'העלאה נכשלה');
            uploadOk = true;
          } catch (err) {
            lastErr = err;
            if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
        if (uploadOk) {
          uploadedFiles[idx].push({ name: fileName });
          img.style.opacity = '1';
          document.getElementById(`item${idx}`).checked = true; updateTaskCounter();
        } else {
          console.error(lastErr);
          img.remove();
          alert("שגיאה בהעלאת התמונה ❌ " + lastErr.message + " — נסה לצלם שוב");
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  function showProgress(stage, percent) {
    document.getElementById("progressOverlay").style.display = 'flex';
    document.getElementById("progressText").innerText = stage;
    document.getElementById("progressBar").style.width = percent + "%";
  }

  // בסיום שליחה מוצלחת אין כיום שום דרך לצאת ממסך ה"נשלח בהצלחה" — נוצר בכוונה דינמית (לא בכל
  // HTML קובץ בנפרד) כדי שהתיקון יחול על שני הטפסים (פתיחה/סגירה) ממקום אחד. window.close()
  // עובד רק אם החלון נפתח ע"י סקריפט (למשל מכפתור "פתיחת סניף" ב-shifts.html) — אם לא (נפתח
  // כטאב ישיר/מהמסך הראשי), הוא לא עושה כלום, ולכן יש גם נפילה חזרה לעמוד הראשי אחרי רגע קצר.
  function showDone(stage) {
    showProgress(stage, 100);
    document.getElementById("progressBarContainer").style.display = 'none';
    let closeBtn = document.getElementById("progressCloseBtn");
    if (!closeBtn) {
      closeBtn = document.createElement("button");
      closeBtn.id = "progressCloseBtn";
      closeBtn.textContent = "סגירה";
      closeBtn.style.cssText = "margin-top:20px;padding:10px 30px;font-size:16px;background:#4caf50;color:#fff;border:none;border-radius:8px;cursor:pointer";
      closeBtn.onclick = () => {
        window.close();
        setTimeout(() => { location.href = '/shifts'; }, 200);
      };
      document.getElementById("progressContainer").appendChild(closeBtn);
    }
    closeBtn.style.display = 'inline-block';
  }

  document.getElementById("checkForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const employeeName = document.getElementById("employeeName").value.trim();
    if (!employeeName) { alert("יש לבחור עובד."); return; }

    // אישור לפני שליחה — עם אזהרה מפורשת אם נשארו משימות שלא סומנו, כדי לצמצם דיווחים חלקיים
    // בטעות (למשל לחיצה מוקדמת מדי על "שלח טופס בקרה").
    const totalItemsC = items.length;
    let doneItemsC = 0;
    for (let i = 0; i < totalItemsC; i++) { if (document.getElementById(`item${i}`).checked) doneItemsC++; }
    const missingC = totalItemsC - doneItemsC;
    const confirmMsg = missingC > 0
      ? `שים/י לב: נותרו ${missingC} משימות שלא סומנו כבוצעו. לשלוח את הדוח בכל זאת?`
      : `לשלוח את הדוח בשם ${employeeName}?`;
    if (!confirm(confirmMsg)) return;

    showProgress("שולח דוח...", 60);
    const sections = items.map((item, idx) => {
      const sec = {
        text: item.text,
        done: document.getElementById(`item${idx}`).checked,
        images: uploadedFiles[idx] || []
      };
      if (item.tempCount) {
        sec.temps = [];
        for (let t = 0; t < item.tempCount; t++) {
          sec.temps.push(document.getElementById(`temp${idx}_${t}`).value.trim());
        }
      }
      if (item.counts) {
        sec.counts = item.counts.map((label, c) => ({ label, value: document.getElementById(`count${idx}_${c}`).value.trim() }));
      }
      return sec;
    });

    // הערה: כאן בכוונה בלי ריטריי אוטומטי (בניגוד להעלאת תמונה) - כי הפעולה הזו שולחת מייל
    // ויוצרת קובץ דוח; ריטריי אוטומטי עלול לשלוח מייל כפול אם התגובה פשוט לא הגיעה בזמן.
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'submitClosingChecklist', mode, stamp, employeeName, sections })
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'שליחה נכשלה');
      showDone("הדוח נשלח למייל בהצלחה ✅");
    } catch (err) {
      console.error(err);
      document.getElementById("progressOverlay").style.display = 'none';
      alert("שגיאה בשליחת הדוח ❌ " + err.message);
    }
  });
}
