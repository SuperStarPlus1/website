const GAS_URL = 'https://script.google.com/macros/s/AKfycbwZaNMNViVxp31eSn60geAqwwnnCa9Ep1ii-JNHTcOYPoCKOdEMU3xhSTXxfPrp6vgX/exec';

const DEFAULT_CHECKLIST_EMPLOYEE = 'אשרף עדנאן';

function initBranchChecklist(opts) {
  const items = opts.items;
  const mode = opts.mode; // 'closing' | 'opening'

  document.getElementById("pageTitle").textContent = opts.title;
  document.title = opts.title;

  const now = new Date();
  document.getElementById("dateTime").value = now.toLocaleString();
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
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        const fileName = `item${idx}_image${uploadedFiles[idx].length + 1}.jpg`;
        uploadedFiles[idx].push({ name: fileName, data: base64 });
        const img = document.createElement("img"); img.src = reader.result; img.className = "preview-img";
        document.getElementById(`imgContainer${idx}`).appendChild(img);
        document.getElementById(`item${idx}`).checked = true; updateTaskCounter();
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

    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'submitClosingChecklist', mode, employeeName, sections })
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
