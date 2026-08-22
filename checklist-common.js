const GAS_URL = 'https://script.google.com/macros/s/AKfycbzM-LQ8t7CH14Mlij4p6r2fnC1PMzBoE8eFeP4VTPqSKJQDI6aoRmP641ONpqolJEet/exec';

const DEFAULT_CHECKLIST_EMPLOYEE = 'אשרף עדנאן';

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

  const empSelect = document.getElementById("employeeName");
  fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'activeShiftEmployees' }) })
    .then(res => res.json())
    .then(j => {
      const names = (j.ok && j.employees && j.employees.length) ? j.employees : [DEFAULT_CHECKLIST_EMPLOYEE];
      empSelect.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
    })
    .catch(() => {
      empSelect.innerHTML = `<option value="${DEFAULT_CHECKLIST_EMPLOYEE}">${DEFAULT_CHECKLIST_EMPLOYEE}</option>`;
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

  document.getElementById("checkForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const employeeName = document.getElementById("employeeName").value.trim();
    if (!employeeName) { alert("יש לבחור עובד."); return; }

    showProgress("שולח דוח...", 60);
    const sections = items.map((item, idx) => ({
      text: item.text,
      done: document.getElementById(`item${idx}`).checked,
      images: uploadedFiles[idx] || []
    }));

    // הערה: כאן בכוונה בלי ריטריי אוטומטי (בניגוד להעלאת תמונה) - כי הפעולה הזו שולחת מייל
    // ויוצרת קובץ דוח; ריטריי אוטומטי עלול לשלוח מייל כפול אם התגובה פשוט לא הגיעה בזמן.
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'submitClosingChecklist', mode, stamp, employeeName, sections })
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'שליחה נכשלה');
      showProgress("הדוח נשלח למייל בהצלחה ✅", 100);
    } catch (err) {
      console.error(err);
      document.getElementById("progressOverlay").style.display = 'none';
      alert("שגיאה בשליחת הדוח ❌ " + err.message);
    }
  });
}
