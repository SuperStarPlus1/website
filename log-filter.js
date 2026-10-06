// The activity log with filters (same file in the Sidurit template web/app/ and on the Superstar site; server:
// api/activity-log.ts getLog): action type, who did it, a date range — each alone or together, searched on the server
// over the whole log (not only the last 200). Replaces the app's own "📜 לוג" window. Uses: apiPost, mgrAuth, toast.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const say = (m, c) => { if (typeof toast === 'function') toast(m, c); };
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  let facets = null, busy = false;

  document.head.insertAdjacentHTML('beforeend', '<style>' +
    '.lf-bar{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb}' +
    '.lf-bar label{display:grid;gap:3px;font-size:12px;font-weight:700;color:#374151}' +
    '.lf-bar input,.lf-bar select{border:1.5px solid #d1d5db;border-radius:8px;padding:6px 8px;font:inherit;font-size:13.5px;width:100%;box-sizing:border-box;background:#fff}' +
    '.lf-quick{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:6px 12px;font-size:12.5px;color:#6b7280;border-bottom:1px solid #e5e7eb}' +
    '.lf-quick button{border:1px solid #d1d5db;background:#fff;border-radius:99px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}' +
    '.lf-quick button.on{background:#1b2a4a;color:#fff;border-color:#1b2a4a}' +
    '.lf-tbl{width:100%;min-width:0;border-collapse:collapse;font-size:13px}.lf-tbl th{position:sticky;top:0;background:#f1f5f9;text-align:right;padding:6px;font-size:12px}' +
    '.lf-tbl td{border-top:1px solid #e5e7eb;padding:5px 6px;vertical-align:top}.lf-tbl td:first-child{white-space:nowrap;color:#6b7280}' +
    '</style>');

  function overlay() {
    if (!$('lfOverlay')) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="overlay hidden" id="lfOverlay"><div class="modal" style="max-width:980px;width:100%">' +
        '<header><h3>📜 לוג פעולות</h3><p id="lfSub">סינון לפי סוג פעולה, מי ביצע ותאריכים — כל אחד לבד או ביחד</p></header>' +
        '<div class="lf-bar">' +
          '<label>סוג פעולה<select id="lfAction"><option value="">הכל</option></select></label>' +
          '<label>מי ביצע<input id="lfActor" list="lfActors" placeholder="הכל — הקלידו שם"><datalist id="lfActors"></datalist></label>' +
          '<label>מתאריך<input type="date" id="lfFrom"></label>' +
          '<label>עד תאריך<input type="date" id="lfTo"></label>' +
        '</div>' +
        '<div class="lf-quick"><span>מהיר:</span><button type="button" data-q="0">היום</button><button type="button" data-q="7">7 ימים</button>' +
          '<button type="button" data-q="30">30 יום</button><button type="button" data-q="">הכל</button>' +
          '<span style="flex:1"></span><button type="button" id="lfClear">ניקוי סינון</button></div>' +
        '<div class="mbody" style="padding:0;max-height:60vh;overflow:auto"><table class="lf-tbl"><thead><tr><th>זמן</th><th>מי ביצע</th><th>פעולה</th><th>פירוט</th></tr></thead>' +
        '<tbody id="lfBody"></tbody></table></div>' +
        '<div class="mfoot"><span id="lfCount" style="font-size:12.5px;color:#6b7280;flex:1"></span><button class="btn plain" data-close>סגירה</button></div></div></div>');
      $('lfOverlay').querySelector('[data-close]').addEventListener('click', () => $('lfOverlay').classList.add('hidden'));
      ['lfAction', 'lfFrom', 'lfTo'].forEach((id) => $(id).addEventListener('change', load));
      $('lfActor').addEventListener('change', load);
      $('lfActor').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') load(); });
      $('lfOverlay').querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
        const d = b.dataset.q;
        if (d === '') { $('lfFrom').value = ''; $('lfTo').value = ''; }
        else { const f = new Date(); f.setDate(f.getDate() - Number(d)); $('lfFrom').value = iso(f); $('lfTo').value = iso(new Date()); }
        load();
      }));
      $('lfClear').addEventListener('click', () => { ['lfAction', 'lfActor', 'lfFrom', 'lfTo'].forEach((id) => ($(id).value = '')); load(); });
    }
    $('lfOverlay').classList.remove('hidden');
  }
  function markQuick() {
    const f = $('lfFrom').value, t = $('lfTo').value, today = iso(new Date());
    $('lfOverlay').querySelectorAll('[data-q]').forEach((b) => {
      const d = b.dataset.q;
      let on = false;
      if (d === '') on = !f && !t;
      else { const x = new Date(); x.setDate(x.getDate() - Number(d)); on = f === iso(x) && t === today; }
      b.classList.toggle('on', on);
    });
  }
  async function load() {
    if (busy) return;
    busy = true;
    markQuick();
    const from = $('lfFrom').value, to = $('lfTo').value;
    if (from && to && from > to) { busy = false; return say('תאריך ההתחלה אחרי תאריך הסיום', 'err'); }
    $('lfBody').innerHTML = '<tr><td colspan="4">טוען…</td></tr>';
    const actor = $('lfActor').value.trim();
    const r = await apiPost({ action: 'getLog', ...mgrAuth(), facets: !facets, actionType: $('lfAction').value, from, to, actor });
    busy = false;
    if (!r || !r.ok) { $('lfBody').innerHTML = '<tr><td colspan="4">' + e((r && r.error) || 'שגיאה') + '</td></tr>'; return; }
    if (r.facets) {
      facets = r.facets;
      const cur = $('lfAction').value;
      $('lfAction').innerHTML = '<option value="">הכל</option>' + facets.actions.map((a) => '<option' + (a === cur ? ' selected' : '') + '>' + e(a) + '</option>').join('');
      $('lfActors').innerHTML = facets.actors.map((a) => '<option value="' + e(a) + '">').join('');
    }
    render(r);
  }
  function render(r) {
    $('lfBody').innerHTML = r.log.length ? r.log.map((l) => '<tr><td>' + e(l.time) + '</td><td>' + e(l.manager) + '</td><td>' + e(l.action) + '</td><td>' + e(l.detail) + '</td></tr>').join('')
      : '<tr><td colspan="4" style="color:#6b7280">אין פעולות שמתאימות לסינון</td></tr>';
    $('lfCount').textContent = r.more ? 'מוצגות ' + r.limit + ' הפעולות האחרונות שמתאימות — לצמצום: סינון לפי תאריכים, סוג או מבצע' : (r.log.length === 1 ? 'פעולה אחת' : r.log.length + ' פעולות');
  }
  async function open() { overlay(); await load(); }

  // the app's own "📜 לוג" button opens this window instead (captured before the app's handler)
  document.addEventListener('click', (ev) => {
    const b = ev.target && ev.target.closest && ev.target.closest('#logBtn');
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    open();
  }, true);
  window.openActivityLog = open;
})();
