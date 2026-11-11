// Pinkas — small screen helpers: escaping, money, a modal form, a confirm box, a toast, download / file picking.
import { IS_ANDROID_APP, nativeShareFile } from './env.js';

export const e = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
export const money = (n) => '₪' + nf.format(Number(n) || 0);
export const money0 = (n) => '₪' + nf0.format(Math.round(Number(n) || 0));
export const pct = (n) => (n === null || n === undefined ? '—' : nf0.format(n) === '-0' ? '0%' : (Math.round(n * 10) / 10) + '%');
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(msg, kind = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('on'));
  setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 300); }, 2600);
}

/** a modal: title + inner html; buttons [{label, kind, value}]. Resolves with the pressed value (and the form's fields). */
export function modal(title, html, buttons = [{ label: 'סגירה', value: null }], opts = {}) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<form class="modal${opts.wide ? ' wide' : ''}" novalidate><header><h3>${e(title)}</h3><button type="button" class="x" aria-label="סגירה">✕</button></header>
      <div class="modal-body">${html}</div><div class="err" role="alert"></div>
      <footer>${buttons.map((b, i) => `<button type="${b.submit ? 'submit' : 'button'}" class="btn ${b.kind || ''}" data-i="${i}">${e(b.label)}</button>`).join('')}</footer></form>`;
    document.body.appendChild(back);
    const form = back.querySelector('form');
    const done = (v) => { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (ev) => { if (ev.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
    back.querySelector('.x').onclick = () => done(null);
    back.addEventListener('mousedown', (ev) => { if (ev.target === back) done(null); });
    const fire = async (b) => {
      if (b.value === null || b.value === undefined) return done(null);
      const vals = fields(form);
      if (b.check) { const err = await b.check(vals, form); if (err) { form.querySelector('.err').textContent = err; return; } }
      done({ value: b.value, ...vals });
    };
    form.addEventListener('submit', (ev) => { ev.preventDefault(); const b = buttons.find((x) => x.submit); if (b) fire(b); });
    form.querySelectorAll('footer button[type=button]').forEach((btn) => { btn.onclick = () => fire(buttons[Number(btn.dataset.i)]); });
    if (opts.onOpen) opts.onOpen(form);
    const first = form.querySelector('.modal-body input:not([type=hidden]):not([type=checkbox]), .modal-body select, .modal-body textarea');
    if (first && !opts.noFocus) setTimeout(() => first.focus(), 30);
  });
}
/** every named field of a form → {name: value}; checkboxes → true/false; data-multi checkboxes → arrays */
export function fields(form) {
  const out = {};
  for (const el of form.querySelectorAll('[name]')) {
    if (el.type === 'checkbox') {
      if (el.dataset.multi !== undefined) { (out[el.name] ||= []); if (el.checked) out[el.name].push(el.value); }
      else out[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value.trim();
  }
  return out;
}
export async function confirmBox(text, yes = 'אישור', kind = 'danger') {
  const r = await modal('לאשר?', `<p>${e(text)}</p>`, [{ label: 'ביטול', value: null }, { label: yes, kind, value: 'yes', submit: true }], { noFocus: true });
  return !!r;
}

export function download(name, text, mime = 'application/json') {
  if (IS_ANDROID_APP) { nativeShareFile(name, text, mime).catch((e) => toast(e.message || 'השמירה נכשלה', 'err')); return; }   // no downloads in the Android app — the share sheet
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export function pickFile(accept) {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.onchange = () => resolve(i.files[0] || null);
    i.click();
  });
}
/** a CSV the Hebrew Excel opens right (BOM) */
export function toCsv(rows) {
  return '﻿' + rows.map((r) => r.map((c) => { const s = String(c ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
}

/* form field builders */
export const field = (label, input, hint = '') => `<label class="f"><span>${e(label)}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;
export const inp = (name, value = '', attrs = '') => `<input name="${name}" value="${e(value)}" ${attrs}>`;
export const money_in = (name, value = '') => `<input name="${name}" value="${value === '' || value === null || value === undefined ? '' : e(value)}" inputmode="decimal" dir="ltr" class="num" placeholder="0">`;
export const sel = (name, options, value) => `<select name="${name}">${options.map(([v, l]) => `<option value="${e(v)}"${String(v) === String(value) ? ' selected' : ''}>${e(l)}</option>`).join('')}</select>`;
export const check = (name, label, on) => `<label class="chk"><input type="checkbox" name="${name}"${on ? ' checked' : ''}> ${e(label)}</label>`;
export const empty = (text, action = '') => `<div class="empty"><p>${text}</p>${action}</div>`;
