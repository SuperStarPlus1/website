// Scheduling extras of the app (same file in shiftfloo web/app/ and on the Superstar site; loaded after the app code):
//   1. type-to-search lists — every list of employees / departments / branches opens a search box: typing filters it
//      (the real <select> stays in the page, hidden, so the app keeps reading .value and listening to 'change')
//   2. skills — picked from the company's skills catalog (several per employee, several required per shift standard);
//      the admin edits the catalog (add / rename / remove — employees and standards follow) → saveSkills
//   3. constraint rules — the admin sets how many constraints an employee may submit per week and whether Friday /
//      Saturday are included (counted and approved at once; otherwise not counted and waiting for a manager), in the
//      "pending requests" window → saveConstraintRules; the employee window shows the rule
//   4. week navigation — clear "previous week" / "next week" buttons; the dates open a calendar (month + year pickers)
//      and a chosen day moves the board to that day's week
// Uses the app's own globals: apiPost, mgrAuth, state, _currentEmp, toast, moveWeek, sundayOf. Rules come with getData (consRules, skills).
(function () {
  'use strict';
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // the app declares state / _currentEmp with const / let: global by name, but not properties of window
  const appState = () => (typeof state !== 'undefined' ? state : null);
  const isAdmin = () => !!(appState() && appState().mgr && appState().mgr.role === 'אדמין');
  const say = (msg, cls) => { if (typeof toast === 'function') toast(msg, cls); };
  const norm = (s) => String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/['"`׳״.\-_()]/g, '').replace(/\s+/g, ' ').trim();
  const splitSkills = (s) => [...new Set(String(s || '').split(',').map((x) => x.trim()).filter(Boolean))];
  const catalog = () => { const s = appState(); return (s && Array.isArray(s.skillsCatalog)) ? s.skillsCatalog : []; };
  const consRules = () => { const s = appState(); return (s && s.consRules) || { maxPerWeek: 0, countWeekend: true }; };
  const fire = (el) => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.sx-hid{display:none!important}' +
    '.sx-field{align-items:center;gap:6px;cursor:pointer;text-align:start;font:inherit;box-sizing:border-box;overflow:hidden;min-width:0}' +
    '.sx-field .sx-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}' +
    '.sx-field .sx-ph{color:#9ca3af;font-weight:400}' +
    '.sx-field .sx-arr{opacity:.55;font-size:.75em;flex:none}' +
    '.sx-field:disabled{opacity:.55;cursor:default}' +
    '.sx-field:focus-visible{outline:2px solid #1b2a4a;outline-offset:1px}' +
    '.sx-chip{display:inline-block;background:#e0e7ff;color:#1e3a8a;border-radius:99px;padding:1px 8px;font-size:11.5px;font-weight:600;margin-inline-end:3px}' +
    '.sx-chip.unk{background:#fee2e2;color:#991b1b}' +
    '.aa-dept.disabled .sx-skills{opacity:.4;pointer-events:none}' +
    '.sx-pop{position:fixed;z-index:30000;background:#fff;color:#1f2937;border:1px solid #d1d5db;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.28);' +
      'display:flex;flex-direction:column;overflow:hidden;font-size:14px;direction:rtl}' +
    '.sx-pop .sx-q{margin:8px;padding:9px 11px;border:1.5px solid #d1d5db;border-radius:9px;font:inherit;font-size:16px;flex:none}' +
    '.sx-pop .sx-q:focus{outline:none;border-color:#1b2a4a}' +
    '.sx-list{overflow-y:auto;padding:0 6px 6px;flex:1;min-height:0}' +
    '.sx-opt{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;text-align:start;padding:9px 10px;border-radius:8px;font:inherit;color:inherit;cursor:pointer}' +
    '.sx-opt:hover,.sx-opt.act{background:#eef2ff}' +
    '.sx-opt.sel{font-weight:700}' +
    '.sx-opt[disabled]{opacity:.45;cursor:default}' +
    '.sx-opt .sx-ck{width:17px;height:17px;flex:none;accent-color:#1b2a4a;pointer-events:none}' +
    '.sx-grp{font-size:11.5px;font-weight:700;color:#6b7280;padding:8px 10px 2px}' +
    '.sx-empty{padding:14px;color:#6b7280;font-size:13px;text-align:center}' +
    '.sx-foot{border-top:1px solid #e5e7eb;padding:8px;display:flex;gap:8px;justify-content:space-between;align-items:center;flex:none}' +
    '.sx-foot button{border:0;border-radius:8px;padding:8px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}' +
    '.sx-foot .sx-done{background:#1b2a4a;color:#fff}' +
    '.sx-foot .sx-edit{background:#f1f5f9;color:#1f2937}' +
    '@media (max-width:560px){.sx-pop.sheet{left:0!important;right:0!important;bottom:0!important;top:auto!important;width:auto!important;' +
      'border-radius:16px 16px 0 0;max-height:72vh!important}}' +
    '</style>');

  /* ---------- the search popup (one at a time) ---------- */
  let pop = null;
  function closePop() {
    if (!pop) return;
    const p = pop; pop = null;
    p.el.remove();
    document.removeEventListener('mousedown', p.outside, true);
    document.removeEventListener('touchstart', p.outside, true);
    window.removeEventListener('resize', p.place);
    document.removeEventListener('scroll', p.scroll, true);
    if (p.onClose) p.onClose();
  }
  /**
   * anchor: the field under which the popup opens. items: [{value, label, group?, disabled?}]
   * multi: false → onPick(value) and close; true → checkboxes, onToggle(value, on) on every click
   */
  function openPop(anchor, o) {
    closePop();
    const el = document.createElement('div');
    el.className = 'sx-pop';
    el.setAttribute('role', 'dialog');
    el.innerHTML = '<input class="sx-q" type="search" placeholder="' + e(o.searchPlaceholder || 'חיפוש…') + '" autocomplete="off" aria-label="חיפוש">' +
      '<div class="sx-list" role="listbox"' + (o.multi ? ' aria-multiselectable="true"' : '') + '></div>' + (o.foot ? '<div class="sx-foot">' + o.foot + '</div>' : '');
    document.body.appendChild(el);
    const q = el.querySelector('.sx-q'), list = el.querySelector('.sx-list');
    const selected = new Set(o.selected || []);
    let shown = [], act = -1;
    function draw() {
      const t = norm(q.value);
      shown = o.items.filter((it) => !t || norm(it.label).includes(t) || norm(it.group).includes(t));
      let html = '', grp = null;
      shown.forEach((it, i) => {
        if ((it.group || '') !== grp) { grp = it.group || ''; if (grp) html += '<div class="sx-grp">' + e(grp) + '</div>'; }
        const on = selected.has(it.value);
        html += '<button type="button" class="sx-opt' + (on ? ' sel' : '') + (i === act ? ' act' : '') + '" data-i="' + i + '" role="option" aria-selected="' + on + '"' +
          (it.disabled ? ' disabled' : '') + '>' + (o.multi ? '<input type="checkbox" class="sx-ck" tabindex="-1"' + (on ? ' checked' : '') + '>' : '') +
          '<span>' + (e(it.label) || '&nbsp;') + '</span></button>';
      });
      list.innerHTML = html || '<div class="sx-empty">' + (o.items.length ? 'לא נמצאו תוצאות' : e(o.emptyText || 'הרשימה ריקה')) + '</div>';
    }
    function choose(i) {
      const it = shown[i];
      if (!it || it.disabled) return;
      if (o.multi) {
        const on = !selected.has(it.value);
        if (on) selected.add(it.value); else selected.delete(it.value);
        o.onToggle(it.value, on);
        draw();
      } else {
        closePop();
        o.onPick(it.value);
        anchor.focus();
      }
    }
    list.addEventListener('click', (ev) => { const b = ev.target.closest('.sx-opt'); if (b) choose(Number(b.dataset.i)); });
    q.addEventListener('input', () => { act = q.value ? 0 : -1; draw(); });
    q.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        act = Math.max(0, Math.min(shown.length - 1, act + (ev.key === 'ArrowDown' ? 1 : -1)));
        draw();
        const b = list.querySelector('.sx-opt.act'); if (b) b.scrollIntoView({ block: 'nearest' });
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (shown.length) choose(act >= 0 ? act : 0);
        else if (o.multi) closePop();
      } else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closePop(); anchor.focus(); }
      else if (ev.key === 'Tab') closePop();
    });
    const sheet = window.innerWidth <= 560;
    function place() {
      if (sheet) return;
      const r = anchor.getBoundingClientRect();
      const w = Math.min(Math.max(r.width, 250), window.innerWidth - 16);
      let right = window.innerWidth - r.right;                       // RTL: the popup lines up with the field's right edge
      right = Math.max(8, Math.min(right, window.innerWidth - w - 8));
      const below = window.innerHeight - r.bottom - 8, above = r.top - 8;
      const up = below < 240 && above > below;
      el.style.width = w + 'px';
      el.style.right = right + 'px';
      el.style.left = 'auto';
      el.style.maxHeight = Math.max(160, Math.min(420, up ? above : below)) + 'px';
      if (up) { el.style.top = 'auto'; el.style.bottom = (window.innerHeight - r.top + 4) + 'px'; }
      else { el.style.bottom = 'auto'; el.style.top = (r.bottom + 4) + 'px'; }
    }
    if (sheet) el.classList.add('sheet');
    place();
    // a press on the field itself is left to the field's own click (it toggles the popup)
    const outside = (ev) => { if (!el.contains(ev.target) && !anchor.contains(ev.target)) closePop(); };
    const scroll = (ev) => { if (!el.contains(ev.target)) place(); };
    pop = { el, anchor, outside, place, scroll, onClose: o.onClose };
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('touchstart', outside, true);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', scroll, true);
    if (o.bindFoot) o.bindFoot(el);
    const cur = o.items.findIndex((it) => !o.multi && selected.has(it.value));
    act = cur; draw();
    if (o.query) { q.value = o.query; act = 0; draw(); }
    q.focus();
    if (cur >= 0) { const b = list.querySelector('.sx-opt.act'); if (b) b.scrollIntoView({ block: 'nearest' }); }
  }

  /* ---------- the field that replaces a control on screen ---------- */
  const COPY = ['font-family', 'font-size', 'font-weight', 'color', 'background-color', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-radius', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'max-width', 'min-width', 'flex', 'box-sizing', 'line-height', 'min-height'];
  /** the look of the original control, so the field sits in the same place with the same size and style */
  function baseStyle(ctl) {
    const cs = getComputedStyle(ctl);
    const out = COPY.map((p) => { const v = cs.getPropertyValue(p); return v ? p + ':' + v : ''; }).filter(Boolean);
    let width = ctl.style.width;
    // in a flex row (a list next to buttons / other lists) a stylesheet width such as ".mrow select{width:100%}" would
    // take the whole row and squeeze its neighbours to nothing: there the field sizes to its content (its flex rules apply)
    const par = ctl.parentElement;
    const inFlexRow = !!par && /flex/.test(getComputedStyle(par).display) && !/column/.test(getComputedStyle(par).flexDirection);
    if (!width && inFlexRow) {
      if (ctl.offsetParent !== null) out.push('min-width:' + ctl.offsetWidth + 'px');
    } else if (!width) {
      if (ctl.offsetParent === null) { const w = cs.width; if (w && w !== 'auto') width = w; }
      else {
        const p = ctl.parentElement, pcs = p && getComputedStyle(p);
        const inner = p ? p.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight) : 0;
        if (inner && Math.abs(ctl.offsetWidth - inner) < 2) width = '100%';
        else out.push('min-width:' + ctl.offsetWidth + 'px');
      }
    }
    if (width) out.push('width:' + width);
    out.push('display:' + (cs.display === 'block' || width === '100%' ? 'flex' : 'inline-flex'));
    if (!parseFloat(cs.minHeight)) out.push('min-height:' + (ctl.offsetHeight ? ctl.offsetHeight + 'px' : '32px'));
    return out.join(';');
  }

  /* ---------- 1. lists with search ---------- */
  // lists of people / departments / branches; any other list can opt in with data-search
  const SEARCH_SELECTORS = ['#empFilter', '#deptFilter', '#shEmp', '#rowSelect', '#empSelector', '#payViewEmp', '#mpGuestName', '#mpGuestBranch',
    '#f101ViewEmp', '#swTarget', '#addHoursEmp', '#branchSel', '#empBranchFilter', '#attMgrBranch', '#annNewBranch',
    'select.i-primary', 'select.i-branch', 'select.pay-sel', 'select.b106-sel', 'select[data-search]'].join(',');
  const MIN_OPTIONS = 1;                   // every list, short ones too (an empty list waits until it is filled)
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const nativeIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');

  function optionItems(sel) {
    const items = [];
    for (const node of sel.children) {
      if (node.tagName === 'OPTGROUP') {
        for (const op of node.children) if (op.tagName === 'OPTION' && !op.hidden) items.push({ value: op.value, label: op.textContent.trim(), group: node.label, disabled: op.disabled || node.disabled });
      } else if (node.tagName === 'OPTION' && !node.hidden) items.push({ value: node.value, label: node.textContent.trim(), disabled: node.disabled });
    }
    return items;
  }
  function syncSelect(sel) {
    const x = sel._sx;
    if (!x || !x.field) return;
    const f = x.field;
    const cls = [...sel.classList].filter((c) => c !== 'sx-hid');
    f.className = 'sx-field ' + cls.join(' ');
    f.style.cssText = x.base + ';' + sel.style.cssText;
    f.disabled = sel.disabled;
    f.hidden = sel.hidden;
    f.title = sel.title || '';
    const op = sel.options[nativeIndex.get.call(sel)];
    const txt = op ? op.textContent.trim() : '';
    f.querySelector('.sx-txt').innerHTML = txt ? e(txt) : '<span class="sx-ph">בחירה…</span>';
    if (!sel.classList.contains('sx-hid')) sel.classList.add('sx-hid');
  }
  function openSelect(sel, query) {
    const x = sel._sx;
    openPop(x.field, {
      items: optionItems(sel), selected: [nativeValue.get.call(sel)], query,
      onPick: (v) => { if (v !== nativeValue.get.call(sel)) { sel.value = v; fire(sel); } else syncSelect(sel); },
    });
  }
  function buildSelect(sel) {
    const x = sel._sx;
    x.base = baseStyle(sel);
    const f = document.createElement('button');
    f.type = 'button';
    f.innerHTML = '<span class="sx-txt"></span><span class="sx-arr" aria-hidden="true">▾</span>';
    f.setAttribute('aria-haspopup', 'listbox');
    if (sel.getAttribute('aria-label') || sel.title) f.setAttribute('aria-label', sel.getAttribute('aria-label') || sel.title);
    f.addEventListener('click', () => { if (pop && pop.anchor === f) { closePop(); return; } openSelect(sel); });
    f.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); openSelect(sel); }
      else if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey && ev.key !== ' ') { ev.preventDefault(); openSelect(sel, ev.key); }
    });
    sel.after(f);
    x.field = f;
  }
  function refreshSelect(sel) {
    const x = sel._sx;
    if (!x.field) {
      const n = sel.options.length;
      if (n < MIN_OPTIONS) return;
      buildSelect(sel);
    }
    syncSelect(sel);
  }
  function enhanceSelect(sel) {
    if (sel._sx || sel.multiple || sel.size > 1) return;
    sel._sx = { field: null, base: '' };
    // the app sets .value / .selectedIndex directly (no event): keep the field's text in step
    Object.defineProperty(sel, 'value', { configurable: true, get() { return nativeValue.get.call(this); },
      set(v) { nativeValue.set.call(this, v); syncSelect(this); } });
    Object.defineProperty(sel, 'selectedIndex', { configurable: true, get() { return nativeIndex.get.call(this); },
      set(v) { nativeIndex.set.call(this, v); syncSelect(this); } });
    sel.addEventListener('change', () => syncSelect(sel));
    new MutationObserver(() => refreshSelect(sel))
      .observe(sel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'disabled', 'hidden', 'title'] });
    refreshSelect(sel);
  }

  /* ---------- 2. skills ---------- */
  const SKILL_INPUTS = 'input.i-skills,input.a-ms,input.a-es,input[data-skills]';
  function drawSkills(inp) {
    const f = inp._sxf;
    if (!f) return;
    const have = splitSkills(inp.value), cat = catalog();
    const lead = inp.classList.contains('a-ms') ? '☀ ' : inp.classList.contains('a-es') ? '🌙 ' : '';
    f.querySelector('.sx-txt').innerHTML = have.length
      ? lead + have.map((s) => '<span class="sx-chip' + (cat.includes(s) ? '' : ' unk') + '"' + (cat.includes(s) ? '' : ' title="לא ברשימת הכישורים"') + '>' + e(s) + '</span>').join('')
      : '<span class="sx-ph">' + lead + e(inp.placeholder || 'בחירת כישורים') + '</span>';
    f.title = (inp.placeholder ? inp.placeholder + ': ' : '') + (have.join(', ') || 'לא נבחרו');
  }
  function openSkills(inp) {
    const have = splitSkills(inp.value), cat = catalog();
    const items = cat.map((s) => ({ value: s, label: s }))
      .concat(have.filter((s) => !cat.includes(s)).map((s) => ({ value: s, label: s + ' (לא ברשימה)' })));
    openPop(inp._sxf, {
      multi: true, items, selected: have, searchPlaceholder: 'חיפוש כישור…',
      emptyText: isAdmin() ? 'אין עדיין כישורים — הוסיפו ב"עריכת הרשימה"' : 'אין כישורים ברשימה — האדמין מגדיר אותם',
      foot: (isAdmin() ? '<button type="button" class="sx-edit">⚙ עריכת רשימת הכישורים</button>' : '<span></span>') + '<button type="button" class="sx-done">סיום</button>',
      bindFoot: (el) => {
        el.querySelector('.sx-done').addEventListener('click', () => { closePop(); inp._sxf.focus(); });
        const ed = el.querySelector('.sx-edit');
        if (ed) ed.addEventListener('click', () => { closePop(); openCatalog(); });
      },
      onToggle: (v, on) => {
        const cur = splitSkills(inp.value);
        // keep the catalog's order, then anything not in it
        const next = on ? cur.concat(v) : cur.filter((s) => s !== v);
        const cat2 = catalog();
        inp.value = [...cat2.filter((s) => next.includes(s)), ...next.filter((s) => !cat2.includes(s))].join(', ');
        fire(inp);
        drawSkills(inp);
      },
    });
  }
  function enhanceSkillInput(inp) {
    if (inp._sxf) return;
    const f = document.createElement('button');
    f.type = 'button';
    f.className = 'sx-field sx-skills';
    f.style.cssText = baseStyle(inp) + ';' + inp.style.cssText + ';background-color:#fff;min-height:30px;flex-wrap:nowrap';
    f.innerHTML = '<span class="sx-txt"></span><span class="sx-arr" aria-hidden="true">▾</span>';
    f.setAttribute('aria-haspopup', 'listbox');
    f.setAttribute('aria-label', inp.placeholder || 'כישורים');
    f.addEventListener('click', () => { if (pop && pop.anchor === f) { closePop(); return; } openSkills(inp); });
    inp.classList.add('sx-hid');
    inp.after(f);
    inp._sxf = f;
    inp.addEventListener('input', () => drawSkills(inp));
    drawSkills(inp);
  }
  const redrawAllSkills = () => document.querySelectorAll(SKILL_INPUTS).forEach((i) => drawSkills(i));

  /* the catalog (admin): add / rename / remove; saving rewrites the employees and standards that use a changed skill */
  function ensureCatalogModal() {
    if (document.getElementById('sxSkillsOverlay')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="overlay hidden" id="sxSkillsOverlay"><div class="modal" style="max-width:520px">' +
      '<header><h3>🎯 רשימת הכישורים</h3><p>הכישורים שאפשר לשייך לעובדים ולדרוש בתקן המשמרות. שינוי שם מתעדכן אצל כל העובדים ובתקן; הסרה מוחקת את הכישור מכולם.</p></header>' +
      '<div class="mbody"><div id="sxSkillsRows"></div>' +
      '<button type="button" class="btn plain" id="sxSkillsAdd" style="margin-top:8px">+ הוספת כישור</button></div>' +
      '<div class="merr" id="sxSkillsErr" style="padding:0 18px"></div>' +
      '<div class="mfoot"><button class="btn primary" id="sxSkillsSave">שמירה</button><button class="btn plain" id="sxSkillsClose">ביטול</button></div></div></div>');
    const hideIt = () => document.getElementById('sxSkillsOverlay').classList.add('hidden');
    document.getElementById('sxSkillsClose').addEventListener('click', hideIt);
    document.getElementById('sxSkillsAdd').addEventListener('click', () => { addCatalogRow('', ''); const all = document.querySelectorAll('#sxSkillsRows input'); all[all.length - 1].focus(); });
    document.getElementById('sxSkillsSave').addEventListener('click', saveCatalog);
  }
  function addCatalogRow(name, from) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
    row.innerHTML = '<input type="text" maxlength="40" value="' + e(name) + '" data-from="' + e(from) + '" placeholder="שם הכישור" aria-label="שם הכישור" ' +
      'style="flex:1;border:1.5px solid var(--line,#e5e7eb);border-radius:8px;padding:8px 10px;font:inherit">' +
      '<button type="button" class="btn plain" aria-label="הסרה" title="הסרה" style="padding:7px 11px">🗑</button>';
    row.querySelector('button').addEventListener('click', () => row.remove());
    document.getElementById('sxSkillsRows').appendChild(row);
  }
  function openCatalog() {
    ensureCatalogModal();
    const rows = document.getElementById('sxSkillsRows');
    rows.innerHTML = '';
    catalog().forEach((s) => addCatalogRow(s, s));
    if (!catalog().length) addCatalogRow('', '');
    document.getElementById('sxSkillsErr').textContent = '';
    document.getElementById('sxSkillsOverlay').classList.remove('hidden');
  }
  function usedBy(skill) {
    const s = appState();
    return s && Array.isArray(s.employees) ? s.employees.filter((x) => splitSkills(x.skills).includes(skill)).length : 0;
  }
  async function saveCatalog() {
    const err = document.getElementById('sxSkillsErr');
    const list = [...document.querySelectorAll('#sxSkillsRows input')]
      .map((i) => ({ name: i.value.trim(), from: i.dataset.from || '' })).filter((x) => x.name);
    const names = list.map((x) => x.name);
    if (list.some((x) => /[,<>"]/.test(x.name))) { err.textContent = 'שם כישור לא יכול להכיל פסיק או < > "'; return; }
    if (new Set(names).size !== names.length) { err.textContent = 'כישור מופיע פעמיים ברשימה'; return; }
    const kept = new Set(list.map((x) => x.from).filter(Boolean));
    const removed = catalog().filter((s) => !kept.has(s));
    const used = removed.map((s) => [s, usedBy(s)]).filter(([, n]) => n);
    if (used.length && !confirm('הכישורים הבאים יוסרו גם מהעובדים שיש להם אותם:\n' + used.map(([s, n]) => '• ' + s + ' — ' + n + ' עובדים').join('\n') + '\n\nלהמשיך?')) return;
    const btn = document.getElementById('sxSkillsSave');
    btn.disabled = true; err.textContent = 'שומר…';
    try {
      const r = await apiPost({ action: 'saveSkills', ...mgrAuth(), skills: list });
      if (!r.ok) { err.textContent = r.error || 'שגיאה'; return; }
      // the server already rewrote employees and standards; bring this screen in step without reloading it
      const rename = new Map(list.filter((x) => x.from && x.from !== x.name).map((x) => [x.from, x.name]));
      const gone = new Set(removed);
      const rewrite = (txt) => [...new Set(splitSkills(txt).filter((s) => !gone.has(s)).map((s) => rename.get(s) || s))].join(', ');
      const s = appState();
      s.skillsCatalog = r.skills || names;
      (s.employees || []).forEach((x) => { x.skills = rewrite(x.skills); });
      if (typeof _currentEmp !== 'undefined' && _currentEmp) _currentEmp.skills = rewrite(_currentEmp.skills);
      Object.values(s.staffing || {}).forEach((st) => { if (st && !Array.isArray(st)) { st.ms = rewrite(st.ms); st.es = rewrite(st.es); } });
      document.querySelectorAll(SKILL_INPUTS).forEach((i) => { const v = rewrite(i.value); if (v !== i.value) { i.value = v; fire(i); } });
      redrawAllSkills();
      err.textContent = '';
      document.getElementById('sxSkillsOverlay').classList.add('hidden');
      say('רשימת הכישורים נשמרה', 'ok');
    } catch (ex) { err.textContent = 'שגיאה: ' + ex.message; }
    finally { btn.disabled = false; }
  }
  window.openSkillsCatalog = openCatalog;

  /* ---------- 3. constraint rules ---------- */
  function rulesText(r) {
    const limit = r.maxPerWeek ? 'עד ' + r.maxPerWeek + ' בשבוע' : 'ללא הגבלה';
    const approval = r.weekendApproval !== undefined ? r.weekendApproval : !r.countWeekend;
    return 'אילוצים: ' + limit + (r.countWeekend ? ', כולל שישי/שבת' : ' (שישי/שבת לא נספרים)') +
      (approval ? ' · שישי/שבת באישור מנהל' : '') + ' · חופשה: תמיד באישור מנהל';
  }
  /** the explanation under the admin's settings: what "including Friday / Saturday" does in this system */
  function rulesNote(r) {
    if (r.approvalFixed) {
      return '0 = ללא הגבלה · כולל שישי/שבת: נספרים במכסה. לא מסומן: לא נספרים · בכל מקרה אילוצי שישי/שבת ' +
        (r.weekendApproval ? 'ממתינים לאישור מנהל' : 'מאושרים אוטומטית') + ' (הגדרה קבועה במערכת)';
    }
    return '0 = ללא הגבלה · כולל שישי/שבת: נספרים במכסה ומאושרים אוטומטית כמו כל יום. לא מסומן: לא נספרים וממתינים לאישור מנהל';
  }
  function onEmpConsOpen() {
    const p = document.querySelector('#empConsOverlay header p');
    if (p) p.textContent = rulesText(consRules());
  }
  function onMgrConsOpen() {
    const ov = document.getElementById('consOverlay');
    const body = ov && ov.querySelector('.mbody');
    if (!body) return;
    let box = document.getElementById('sxConsRules');
    if (!box) {
      body.insertAdjacentHTML('afterbegin',
        '<div id="sxConsRules" style="background:#f8fafc;border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:10px 12px;margin-bottom:12px;' +
        'display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:13px">' +
        '<b>⚙ כללי אילוצים</b>' +
        '<label style="display:flex;align-items:center;gap:6px">מותר לעובד עד <input type="number" id="sxConsMax" min="0" max="14" step="1" inputmode="numeric" ' +
          'style="width:64px;border:1.5px solid var(--line,#e5e7eb);border-radius:8px;padding:5px 7px;font:inherit"> אילוצים בשבוע</label>' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="sxConsWeekend"> כולל שישי/שבת</label>' +
        '<button type="button" class="btn primary" id="sxConsSave" style="padding:6px 14px">שמירה</button>' +
        '<span id="sxConsMsg" style="font-size:12px;font-weight:700"></span>' +
        '<span id="sxConsNote" style="flex-basis:100%;color:var(--muted,#6b7280);font-size:11.5px"></span></div>');
      box = document.getElementById('sxConsRules');
      document.getElementById('sxConsSave').addEventListener('click', async () => {
        const msg = document.getElementById('sxConsMsg');
        const raw = document.getElementById('sxConsMax').value.trim();
        const n = Number(raw);
        if (raw === '' || !Number.isInteger(n) || n < 0 || n > 14) { msg.style.color = '#dc2626'; msg.textContent = 'מספר שלם בין 0 ל-14'; return; }
        const btn = document.getElementById('sxConsSave');
        btn.disabled = true; msg.style.color = 'var(--muted,#6b7280)'; msg.textContent = 'שומר…';
        try {
          const r = await apiPost({ action: 'saveConstraintRules', ...mgrAuth(), maxPerWeek: n, countWeekend: document.getElementById('sxConsWeekend').checked });
          if (!r.ok) { msg.style.color = '#dc2626'; msg.textContent = r.error || 'שגיאה'; return; }
          appState().consRules = r.consRules;
          msg.style.color = '#16a34a'; msg.textContent = 'נשמר ✓';
          say('כללי האילוצים נשמרו', 'ok');
        } catch (ex) { msg.style.color = '#dc2626'; msg.textContent = 'שגיאה: ' + ex.message; }
        finally { btn.disabled = false; }
      });
    }
    box.style.display = isAdmin() ? 'flex' : 'none';
    const r = consRules();
    document.getElementById('sxConsMax').value = r.maxPerWeek;
    document.getElementById('sxConsWeekend').checked = !!r.countWeekend;
    document.getElementById('sxConsMsg').textContent = '';
    document.getElementById('sxConsNote').textContent = rulesNote(r);
  }
  function watchOpen(id, fn) {
    const ov = document.getElementById(id);
    if (!ov) return;
    let open = !ov.classList.contains('hidden');
    // records carry the old class: a close + reopen in the same moment still counts as an opening
    new MutationObserver((recs) => {
      const now = !ov.classList.contains('hidden');
      if (now && (!open || recs.some((r) => /(^|\s)hidden(\s|$)/.test(r.oldValue || '')))) fn();
      open = now;
    }).observe(ov, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }

  /* ---------- 4. week navigation: clear previous / next buttons + a calendar on the dates ---------- */
  // uses the app's moveWeek (unsaved-changes check, one load for quick clicks), sundayOf and state.weekStart
  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const dayNo = (d) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);   // DST-safe day count
  let cal = null;
  function closeCal() { if (cal) { cal.el.remove(); document.removeEventListener('mousedown', cal.outside, true); cal = null; } }
  function goToDate(d) {
    const s = appState();
    if (!s || !s.weekStart || typeof moveWeek !== 'function') return;
    const target = typeof sundayOf === 'function' ? sundayOf(d) : new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
    const diff = dayNo(target) - dayNo(s.weekStart);
    closeCal();
    if (diff) moveWeek(diff);
  }
  function drawCal() {
    const s = appState(), y = cal.y, m = cal.m;
    const today = new Date(), shown = s && s.weekStart ? dayNo(s.weekStart) : null;
    const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay());
    const yNow = today.getFullYear();
    let years = '';
    for (let yy = Math.min(2018, y); yy <= Math.max(yNow + 2, y); yy++) years += '<option' + (yy === y ? ' selected' : '') + '>' + yy + '</option>';
    let rows = '';
    for (let w = 0; w < 6; w++) {
      const ws = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7);
      if (w === 5 && ws.getMonth() !== m) break;
      const cur = shown !== null && dayNo(ws) === shown;
      rows += '<div class="sx-cal-wk' + (cur ? ' cur' : '') + '">';
      for (let i = 0; i < 7; i++) {
        const d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i);
        const cls = (d.getMonth() !== m ? ' out' : '') + (dayNo(d) === dayNo(today) ? ' today' : '');
        rows += '<button type="button" class="sx-cal-d' + cls + '" data-d="' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + '" ' +
          'aria-label="' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + '">' + d.getDate() + '</button>';
      }
      rows += '</div>';
    }
    cal.el.innerHTML =
      '<div class="sx-cal-head"><button type="button" class="sx-cal-nav" data-step="-1" aria-label="חודש קודם">›</button>' +
      '<select class="sx-cal-m" aria-label="חודש">' + MONTHS.map((n, i) => '<option value="' + i + '"' + (i === m ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      '<select class="sx-cal-y" aria-label="שנה">' + years + '</select>' +
      '<button type="button" class="sx-cal-nav" data-step="1" aria-label="חודש הבא">‹</button></div>' +
      '<div class="sx-cal-wk sx-cal-dn">' + ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((x) => '<span>' + x + '</span>').join('') + '</div>' + rows +
      '<div class="sx-cal-foot"><button type="button" class="sx-cal-today">השבוע</button><span>בחירת יום עוברת לשבוע שלו</span></div>';
    cal.el.querySelector('.sx-cal-m').addEventListener('change', (ev) => { cal.m = Number(ev.target.value); drawCal(); });
    cal.el.querySelector('.sx-cal-y').addEventListener('change', (ev) => { cal.y = Number(ev.target.value); drawCal(); });
    cal.el.querySelectorAll('.sx-cal-nav').forEach((b) => b.addEventListener('click', () => {
      const d = new Date(cal.y, cal.m + Number(b.dataset.step), 1); cal.y = d.getFullYear(); cal.m = d.getMonth(); drawCal();
    }));
    cal.el.querySelectorAll('.sx-cal-d').forEach((b) => b.addEventListener('click', () => {
      const [yy, mm, dd] = b.dataset.d.split('-').map(Number); goToDate(new Date(yy, mm - 1, dd));
    }));
    cal.el.querySelector('.sx-cal-today').addEventListener('click', () => goToDate(new Date()));
  }
  function openCal(anchor) {
    if (cal) { closeCal(); return; }
    const s = appState();
    const base = s && s.weekStart ? new Date(s.weekStart) : new Date();
    const el = document.createElement('div');
    el.className = 'sx-cal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'בחירת תאריך');
    document.body.appendChild(el);
    const outside = (ev) => { if (!el.contains(ev.target) && !anchor.contains(ev.target)) closeCal(); };
    cal = { el, outside, y: base.getFullYear(), m: base.getMonth() };
    drawCal();
    const r = anchor.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 16);
    el.style.width = w + 'px';
    el.style.top = (r.bottom + 6) + 'px';
    el.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)) + 'px';
    document.addEventListener('mousedown', outside, true);
    const cur = el.querySelector('.sx-cal-wk.cur .sx-cal-d') || el.querySelector('.sx-cal-d');
    if (cur) cur.focus();
  }
  function setupWeekNav() {
    const prev = document.getElementById('prevW'), next = document.getElementById('nextW'), range = document.getElementById('weekRange');
    if (!prev || !next || !range || range._sx) return;
    range._sx = true;
    document.head.insertAdjacentHTML('beforeend', '<style>' +
      '.weeknav button#prevW,.weeknav button#nextW{width:auto!important;padding:0 11px;font-size:13px!important;font-weight:700;background:rgba(255,255,255,.14)!important;white-space:nowrap}' +
      '.weeknav button#prevW:hover,.weeknav button#nextW:hover{background:rgba(255,255,255,.26)!important}' +
      '.weeknav .sx-short{display:none}' +
      '@media (max-width:560px){.weeknav .sx-long{display:none}.weeknav .sx-short{display:inline}.weeknav button#prevW,.weeknav button#nextW{padding:0 8px}}' +
      '#weekRange.sx-range{cursor:pointer;border-radius:8px;padding:5px 8px}' +
      '#weekRange.sx-range:hover,#weekRange.sx-range:focus-visible{background:rgba(255,255,255,.14);outline:none}' +
      '#weekRange.sx-range::after{content:" 📅";font-size:12px}' +
      '.sx-cal{position:fixed;z-index:30000;background:#fff;color:#1f2937;border:1px solid #d1d5db;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.28);padding:10px;direction:rtl;font-size:14px}' +
      '.sx-cal-head{display:flex;gap:6px;align-items:center;margin-bottom:8px}' +
      '.sx-cal-head select{flex:1;border:1.5px solid #d1d5db;border-radius:8px;padding:6px;font:inherit;font-size:14px;background:#fff}' +
      '.sx-cal-nav{border:0;background:#f1f5f9;border-radius:8px;width:32px;height:32px;font-size:17px;cursor:pointer}' +
      '.sx-cal-wk{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;border-radius:8px}' +
      '.sx-cal-wk.cur{background:#e0e7ff}' +
      '.sx-cal-dn span{text-align:center;font-size:11.5px;font-weight:700;color:#6b7280;padding:4px 0}' +
      '.sx-cal-d{border:0;background:none;height:34px;border-radius:8px;font:inherit;font-size:13.5px;cursor:pointer;color:inherit}' +
      '.sx-cal-d:hover,.sx-cal-d:focus-visible{background:#1b2a4a;color:#fff;outline:none}' +
      '.sx-cal-d.out{color:#9ca3af}' +
      '.sx-cal-d.today{font-weight:800;box-shadow:inset 0 0 0 1.5px #e8a819}' +
      '.sx-cal-foot{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11.5px;color:#6b7280;gap:8px}' +
      '.sx-cal-today{border:0;background:#1b2a4a;color:#fff;border-radius:8px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}' +
      '</style>');
    prev.innerHTML = '<span aria-hidden="true">›</span> <span class="sx-long">שבוע קודם</span><span class="sx-short">קודם</span>';
    next.innerHTML = '<span class="sx-long">שבוע הבא</span><span class="sx-short">הבא</span> <span aria-hidden="true">‹</span>';
    range.classList.add('sx-range');
    range.setAttribute('role', 'button');
    range.setAttribute('tabindex', '0');
    range.setAttribute('title', 'בחירת תאריך מלוח השנה');
    range.addEventListener('click', () => openCal(range));
    range.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openCal(range); } });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && cal) { closeCal(); range.focus(); } });
    window.addEventListener('resize', closeCal);
  }

  /* ---------- wiring: current and future controls ---------- */
  function scan(root) {
    if (!root.querySelectorAll) return;
    if (root.matches && root.matches(SEARCH_SELECTORS)) enhanceSelect(root);
    root.querySelectorAll(SEARCH_SELECTORS).forEach(enhanceSelect);
    if (root.matches && root.matches(SKILL_INPUTS)) enhanceSkillInput(root);
    root.querySelectorAll(SKILL_INPUTS).forEach(enhanceSkillInput);
  }
  function start() {
    scan(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1 && !(pop && pop.el.contains(n))) scan(n);
    }).observe(document.body, { childList: true, subtree: true });
    watchOpen('empConsOverlay', onEmpConsOpen);
    watchOpen('consOverlay', onMgrConsOpen);
    setupWeekNav();
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && pop) closePop(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
