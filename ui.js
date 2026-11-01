/* UI: small helpers shared by every screen (escaping, dates, modals, toasts, forms, printing, router). */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const UI = {
  actions: {},     // data-act="name" click handlers
  changes: {},     // data-change="name" change handlers
  inputs: {},      // data-input="name" input handlers
  submits: {},     // form[data-submit="name"] handlers
  vs: {},          // per-screen view state (selected tab, open panels...)
  drafts: {},      // form values that survive a re-render
  routes: [],

  on(name, fn) { this.actions[name] = fn; },
  onChange(name, fn) { this.changes[name] = fn; },
  onInput(name, fn) { this.inputs[name] = fn; },
  onSubmit(name, fn) { this.submits[name] = fn; },
  state(key, defaults) { if (!this.vs[key]) this.vs[key] = Object.assign({}, defaults); return this.vs[key]; },

  /* ---------- formatting ---------- */
  fmtDate(iso) { if (!iso) return ''; const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); },
  fmtDateLong(iso) { if (!iso) return ''; const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); },
  fmtWhen(iso) {
    const d = new Date(iso), now = new Date();
    const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
    if (days <= 0) return 'Today, ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    return UI.fmtDate(iso);
  },
  daysUntil(isoDate) { return Math.ceil((new Date(isoDate + 'T23:59:59').getTime() - Date.now()) / 86400000); },
  dueLabel(isoDate) {
    const n = UI.daysUntil(isoDate);
    if (n < 0) return `<span class="bad">⏱ ${-n} day${n === -1 ? '' : 's'} overdue</span>`;
    if (n <= 14) return `<span class="bad">⏱ Due in ${n} day${n === 1 ? '' : 's'}</span>`;
    return `<span class="muted">Due ${UI.fmtDate(isoDate)}</span>`;
  },
  initials(name) { return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); },
  plural(n, one, many) { return `${n} ${n === 1 ? one : (many || one + 's')}`; },
  nl2br(s) { return esc(s).replace(/\n/g, '<br>'); },
  today() { return new Date().toISOString().slice(0, 10); },

  avatar(u, size = 'sm') {
    if (u && u.photo) return `<span class="avatar has ${size}" style="background-image:url('${u.photo}')" role="img" aria-label="Photo of ${esc(u.name)}"></span>`;
    return `<span class="avatar ${size}" aria-hidden="true">${u ? esc(UI.initials(u.name)) : ''}</span>`;
  },
  /* Avatar with a camera button for the signed-in person's own photo */
  avatarEditable(u) {
    return `<span class="avatar-wrap">${UI.avatar(u, 'lg')}<button class="cam" data-act="photo" title="Change photo" aria-label="Change profile photo">📷</button></span>`;
  },
  empty(title, text) { return `<div class="empty"><b>${esc(title)}</b>${esc(text)}</div>`; },
  crumbs(parts) {
    return `<div class="crumbs">${parts.map(p => p.href ? `<a href="${p.href}">${esc(p.label)}</a>` : esc(p.label)).join(' › ')}</div>`;
  },
  ratingRow(label, name, value, readonly) {
    const btns = [1, 2, 3, 4, 5].map(n => `<button type="button" class="${value === n ? 'on' : ''}" ${readonly ? 'tabindex="-1"' : `data-act="rate" data-name="${name}" data-val="${n}"`} aria-label="${label} ${n} out of 5" aria-pressed="${value === n}">${n}</button>`).join('');
    return `<div class="row between" style="margin:9px 0"><span>${esc(label)}</span><div class="rating ${readonly ? 'readonly' : ''}" data-rating="${name}">${btns}</div></div>`;
  },

  /* ---------- toast & modal ---------- */
  toast(msg, isErr) {
    let box = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast' + (isErr ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), isErr ? 5200 : 3400);
  },
  modal(html, opts = {}) {
    UI.closeModal();
    const back = document.createElement('div');
    back.className = 'modal-back'; back.id = 'modal-back';
    back.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    back.addEventListener('mousedown', e => { if (e.target === back) UI.closeModal(); });
    $('#modal-root').appendChild(back);
    const first = $('input:not([type=hidden]),textarea,select', back);
    if (first && !opts.noFocus) first.focus();
  },
  closeModal() { const m = $('#modal-back'); if (m) m.remove(); },
  confirm(title, text, okLabel, onOk, danger) {
    UI.modal(`<h2>${esc(title)}</h2><p class="muted" style="margin:6px 0 16px">${esc(text)}</p>
      <div class="row"><button class="btn ${danger ? 'danger' : 'primary'}" id="confirm-ok">${esc(okLabel)}</button><button class="btn" data-act="closeModal">Cancel</button></div>`, { noFocus: true });
    $('#confirm-ok').onclick = () => { UI.closeModal(); onOk(); };
  },

  /* ---------- forms ---------- */
  formData(form) {
    const out = {};
    $$('[name]', form).forEach(el => {
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else if (el.type === 'file') out[el.name] = el.files && el.files[0] ? el.files[0] : null;
      else out[el.name] = el.value;
    });
    return out;
  },
  /* Shows an error right next to each field, and clears old ones. errs = {fieldName: 'message'} */
  showErrors(form, errs) {
    $$('.err-msg[data-auto]', form).forEach(e => e.remove());
    $$('.input.err', form).forEach(e => e.classList.remove('err'));
    let first = null;
    Object.keys(errs).forEach(name => {
      const el = form.elements[name] || $(`[name="${name}"]`, form);
      const msg = document.createElement('div');
      msg.className = 'err-msg'; msg.dataset.auto = '1'; msg.setAttribute('role', 'alert'); msg.textContent = errs[name];
      if (el) {
        el.classList && el.classList.add('err');
        const anchor = el.closest('.pw-wrap') || el.closest('.phone-row') || el;
        anchor.insertAdjacentElement('afterend', msg);
        if (!first) first = el;
      } else form.insertAdjacentElement('afterbegin', msg);
    });
    if (first && first.focus) first.focus();
    return Object.keys(errs).length === 0;
  },
  clearDrafts(formId) { delete UI.drafts[formId]; },
  saveDraft(el) {
    const form = el.closest('form[id]');
    if (!form || !el.name || el.type === 'password' || el.type === 'file') return;
    (UI.drafts[form.id] = UI.drafts[form.id] || {})[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  },
  restoreDrafts(root) {
    $$('form[id]', root).forEach(form => {
      const d = UI.drafts[form.id]; if (!d) return;
      Object.keys(d).forEach(name => {
        const el = form.elements[name]; if (!el || el.length) return;
        if (el.type === 'checkbox') el.checked = d[name]; else el.value = d[name];
      });
      $$('[data-rating]', form).forEach(box => {
        const hid = form.elements[box.dataset.rating]; if (!hid) return;
        $$('button', box).forEach(b => { const on = Number(b.dataset.val) === Number(hid.value); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      });
    });
  },

  /* ---------- download, print ---------- */
  download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },
  /* "Download as PDF": opens the browser's print dialog showing only this content; choose "Save as PDF". */
  print(title, html) {
    const r = $('#print-root');
    r.innerHTML = `<h1>${esc(title)}</h1><p class="muted small">${esc(CONFIG.schoolName)} · printed ${UI.fmtDateLong(new Date().toISOString())}</p>${html}`;
    document.body.classList.add('printing');
    UI.toast('In the print window, choose "Save as PDF".');
    setTimeout(() => { try { window.print(); } finally { document.body.classList.remove('printing'); r.innerHTML = ''; } }, 300);
  },
  csv(rows) {
    return rows.map(r => r.map(c => { const s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  },
  parseCsv(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  },

  /* ---------- photo ---------- */
  pickPhoto() {
    const user = Session.user(); if (!user) return;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const f = input.files[0]; if (!f) return;
      const img = new Image(), url = URL.createObjectURL(f);
      img.onload = () => {
        const size = 240, c = document.createElement('canvas'); c.width = c.height = size;
        const s = Math.min(img.width, img.height), ctx = c.getContext('2d');
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        user.photo = c.toDataURL('image/jpeg', 0.8); URL.revokeObjectURL(url);
        Store.save(); UI.toast('Photo updated.'); UI.render();
      };
      img.onerror = () => UI.toast('That file is not a picture we can read.', true);
      img.src = url;
    };
    input.click();
  },
  /* Read a small attachment (certificate). Keeps the data only when it is small enough for browser storage. */
  readAttachment(file) {
    return new Promise(resolve => {
      if (!file) return resolve(null);
      if (file.size > 250 * 1024) return resolve({ name: file.name, data: null, note: 'too large to keep' });
      const r = new FileReader();
      r.onload = () => resolve({ name: file.name, data: r.result });
      r.onerror = () => resolve({ name: file.name, data: null });
      r.readAsDataURL(file);
    });
  },

  /* ---------- router + render ---------- */
  route() {
    const raw = (location.hash || '#/').slice(1);
    const [path, qs] = raw.split('?');
    const query = {}; (qs || '').split('&').filter(Boolean).forEach(p => { const [k, v] = p.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { path: path || '/', query };
  },
  go(path) { if (location.hash === '#' + path) UI.render(); else location.hash = path; },
  lastPath: null,
  afterFns: [],
  after(fn) { this.afterFns.push(fn); },
  render() {
    const app = $('#app');
    const r = UI.route();
    const scroll = r.path === UI.lastPath ? window.scrollY : 0;
    const ae = document.activeElement;
    const keep = ae && ae.dataset && ae.dataset.keep ? { key: ae.dataset.keep, pos: ae.selectionStart } : null;
    let html = '';
    try { html = Router.resolve(r); }
    catch (err) { console.error(err); html = `<div class="auth-page"><div class="card"><h2>Something went wrong</h2><p class="muted">${esc(err.message)}</p><p style="margin-top:12px"><a href="#/">Back to start</a></p></div></div>`; }
    app.innerHTML = html;
    UI.restoreDrafts(app);
    UI.lastPath = r.path;
    window.scrollTo(0, scroll);
    if (keep) { const el = $(`[data-keep="${keep.key}"]`, app); if (el) { el.focus(); try { el.setSelectionRange(keep.pos, keep.pos); } catch (e) {} } }
    document.title = Router.title || CONFIG.appName;
    const fns = UI.afterFns; UI.afterFns = []; fns.forEach(fn => { try { fn(app); } catch (e) { console.error(e); } });
  },
};

const Router = {
  title: '',
  table: [],
  add(pattern, roles, fn, title) { this.table.push({ re: new RegExp('^' + pattern.replace(/:([a-z]+)/g, '([^/]+)') + '$'), roles, fn, title }); },
  resolve(r) {
    const user = Session.user();
    for (const t of this.table) {
      const m = r.path.match(t.re);
      if (!m) continue;
      this.title = (t.title || CONFIG.appName) + ' · ' + CONFIG.schoolName;
      if (t.roles) {
        if (!user) { sessionStorage.setItem('spp.after', location.hash); return Views.auth.login({ notice: 'Please sign in to continue.' }); }
        if (!t.roles.includes(user.role)) { UI.toast('That page is for a different role.', true); return Views.shell.redirect(Views.shell.home(user)); }
      }
      return t.fn({ user, params: m.slice(1).map(decodeURIComponent), query: r.query });
    }
    if (user) return Views.shell.redirect(Views.shell.home(user));
    return Views.auth.landing();
  },
};

/* Namespaces filled in by each screen file */
const Views = { auth: {}, shell: {}, student: {}, staff: {}, sup: {}, admin: {} };

/* ---------- global event delegation ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = UI.actions[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A' && !el.dataset.native) e.preventDefault();
  fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  UI.saveDraft(el);
  const name = el.dataset && el.dataset.change; if (name && UI.changes[name]) UI.changes[name](el, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  UI.saveDraft(el);
  const name = el.dataset && el.dataset.input; if (name && UI.inputs[name]) UI.inputs[name](el, e);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-submit]');
  if (!f) return;
  e.preventDefault();
  const fn = UI.submits[f.dataset.submit]; if (fn) fn(f, e);
});

UI.on('closeModal', () => UI.closeModal());
UI.on('photo', () => UI.pickPhoto());
UI.on('goto', el => UI.go(el.dataset.to));
UI.on('rate', el => {
  // Rating buttons live inside forms; the value is kept in a hidden input named after the rating.
  const form = el.closest('form'); const name = el.dataset.name; const val = Number(el.dataset.val);
  const hidden = form.elements[name]; const same = Number(hidden.value) === val;
  hidden.value = same ? '' : val;
  $$(`[data-rating="${name}"] button`, form).forEach(b => { const on = !same && Number(b.dataset.val) === val; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  UI.saveDraft(hidden);
});
UI.on('sampleLink', el => UI.toast('Sample link. In the real system this opens the student\'s work.'));

/* A link that goes to the student's real URL, or shows a note for the made-up sample links */
UI.link = (url, label, cls = 'btn small') => {
  if (!url) return '';
  const full = /^https?:\/\//.test(url) ? url : 'https://' + url;
  const sample = /^https:\/\/(example\.com|github\.com\/example)/.test(full);
  return sample ? `<a class="${cls}" href="#" data-act="sampleLink">${esc(label)}</a>` : `<a class="${cls}" href="${esc(full)}" target="_blank" rel="noopener">${esc(label)}</a>`;
};
UI.greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
