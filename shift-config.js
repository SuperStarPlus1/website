// The company's shifts on the screen (same file in Superstar and Sidurit; the server's twin: _shared/shift-config.ts).
//   parts  the parts of the day: the staffing standard, constraints, "not available", fixed days off and auto-assign
//          count by them. A shift belongs to the last part whose "from" is not after its start (before the first — the last).
//   types  the ready-made shifts of the shift window; depts = only in these departments.
// From getData (state.shiftConfig); until it arrives, or without the setting — the defaults (morning / evening).
// The settings window (admin): openShiftConfig() — from the scheduling menu.
(function () {
  const DEF = {
    parts: [
      { key: 'בוקר', icon: '☀', from: '00:00', start: '08:00', end: '15:00' },
      { key: 'ערב', icon: '🌙', from: '15:00', start: '15:00', end: '22:00' },
    ],
    types: [
      { name: 'בוקר', start: '08:00', end: '15:00', depts: [] },
      { name: 'בוקר 2', start: '10:00', end: '16:00', depts: [] },
      { name: 'ערב', start: '15:00', end: '22:00', depts: [] },
      { name: 'ערב 2', start: '16:00', end: '22:00', depts: [] },
    ],
  };
  const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
  function cfg() {
    try { const c = state.shiftConfig; if (c && Array.isArray(c.parts) && c.parts.length) return c; } catch (e) { /* not loaded yet */ }
    return DEF;
  }
  const part = (k) => cfg().parts.find((p) => p.key === k);
  window.SC = {
    DEF,
    cfg,
    parts: () => cfg().parts,
    keys: () => cfg().parts.map((p) => p.key),
    has: (k) => !!part(k),
    idx: (k) => cfg().parts.findIndex((p) => p.key === k),
    icon: (k) => (part(k) ? part(k).icon : ''),
    /** " ☀" after a day letter (the part's name when it has no icon) */
    mark: (k) => ' ' + ((part(k) && part(k).icon) || k),
    partOf(start) {
      const ps = cfg().parts, m = toMin(start);
      let hit = ps[ps.length - 1];
      ps.forEach((p) => { if (toMin(p.from) <= m) hit = p; });
      return hit.key;
    },
    /** the hours auto-assign gives a shift of this part */
    times(k) { const p = part(k) || cfg().parts[0]; return [p.start, p.end]; },
    /** ready-made shifts for every department / only for this one */
    general: () => (cfg().types || []).filter((t) => !t.depts || !t.depts.length),
    forDept: (dept) => (cfg().types || []).filter((t) => t.depts && t.depts.includes(dept)),
    /** every time the config uses (the shift window's lists must offer them) */
    times_all() {
      const c = cfg(), out = new Set();
      c.parts.forEach((p) => { out.add(p.start); out.add(p.end); });
      (c.types || []).forEach((t) => { out.add(t.start); out.add(t.end); });
      return [...out];
    },
    toMin,
  };
})();
