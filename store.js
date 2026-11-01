/* Store: the browser's copy of the data this person is allowed to see, plus the connection to the server.

   How it works
   - After sign-in the browser asks the server for data (GET /api/bootstrap). The server only sends what this role may see.
   - Screens change Store.state and call Store.save(). Save works out what changed and sends just that to the server
     (POST /api/sync). The server checks every change against the rules and rejects anything not allowed.
   - If the server refuses a change, the screen reloads the real data, so the browser can never "fake" anything. */

/* ---------- talking to the server ---------- */
const API = {
  async call(method, url, body) {
    let res;
    try {
      res = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'portfolio' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { const err = new Error('Cannot reach the server. Check that it is running and try again.'); err.status = 0; throw err; }
    let data = null; try { data = await res.json(); } catch (e) {}
    if (!res.ok) { const err = new Error((data && data.error) || 'Something went wrong. Try again.'); err.status = res.status; err.field = data && data.field; throw err; }
    return data;
  },
  get(url) { return this.call('GET', url); },
  post(url, body) { return this.call('POST', url, body || {}); },
};

const SYNCED = { users: 'id', projects: 'id', activities: 'id', letters: 'id', assessments: 'id', attachments: 'studentId', events: 'id', audit: 'id', reports: 'id' };
const emptyState = () => ({ users: [], grades: {}, projects: [], activities: [], letters: [], assessments: [], attachments: [], events: [], audit: [], reports: [], registry: [], signups: [], permissions: {} });

const Store = {
  state: emptyState(), meId: null, perms: null, snap: null, queue: Promise.resolve(), pending: false,

  /* Load (or reload) everything this person may see. Signed out = empty. */
  async bootstrap() {
    try {
      const d = await API.get('/api/bootstrap');
      this.state = Object.assign(emptyState(), d.state); this.meId = d.meId; this.perms = d.perms;
    } catch (e) {
      if (e.status !== 401) throw e;
      this.state = emptyState(); this.meId = null; this.perms = null;
    }
    this.snap = this.snapshot();
  },

  /* What the data looked like at the last sync, so we can send only the differences. */
  snapshot() {
    const out = { permissions: JSON.stringify(this.state.permissions || {}) };
    Object.keys(SYNCED).forEach(name => {
      const m = new Map(); (this.state[name] || []).forEach(x => m.set(x[SYNCED[name]], JSON.stringify(x))); out[name] = m;
    });
    return out;
  },
  diff() {
    const changes = {};
    Object.keys(SYNCED).forEach(name => {
      const key = SYNCED[name], prev = this.snap[name], cur = this.state[name] || [];
      let upsert = cur.filter(x => prev.get(x[key]) !== JSON.stringify(x));
      if (name === 'users') upsert = upsert.filter(x => x.id === this.meId);            // you can only ever change your own profile here
      const seen = new Set(cur.map(x => x[key]));
      const del = name === 'users' ? [] : [...prev.keys()].filter(k => !seen.has(k));
      if (upsert.length || del.length) changes[name] = { upsert, delete: del };
    });
    const u = this.user(this.meId);
    if (u && u.role === 'admin' && JSON.stringify(this.state.permissions || {}) !== this.snap.permissions) changes.permissions = { value: this.state.permissions };
    return changes;
  },

  /* Screens call save() after changing Store.state. Changes are sent one request at a time. */
  save() {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => { this.pending = false; this.queue = this.queue.then(() => this.flush()); });
  },
  async flush() {
    if (!this.meId) return;
    const changes = this.diff();
    if (!Object.keys(changes).length) return;
    this.snap = this.snapshot();
    try { await API.post('/api/sync', { changes }); }
    catch (e) {
      if (e.status === 401) { await this.bootstrap(); UI.toast('Your session has ended. Please sign in again.', true); UI.go('/login'); return; }
      UI.toast(e.message, true);                         // the server said no: show why, then show the real data again
      try { await this.bootstrap(); } catch (e2) {}
      UI.render();
    }
  },
  /* Wait until everything has been sent (used by tests) */
  async settled() { await new Promise(r => setTimeout(r, 0)); await this.queue; },

  async reset() { await API.post('/api/dev/reset'); await this.bootstrap(); },

  /* Random ids, so two people creating things at the same moment never clash. */
  id(prefix) { return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3); },

  user(id) { return this.state.users.find(u => u.id === id) || null; },
  users(role) { return this.state.users.filter(u => !role || u.role === role); },
  students() { return this.state.users.filter(u => u.role === 'student'); },
  log(text, by, extra = {}) { this.state.audit.unshift({ id: this.id('g'), text, ts: new Date().toISOString(), by: by || 'System', ...extra }); },
  event(userId, kind, text, ref) { this.state.events.unshift({ id: this.id('e'), userId, kind, text, ts: new Date().toISOString(), ref }); },
};

/* ---------- who is signed in ---------- */
const Session = {
  user() { return Store.meId ? Store.user(Store.meId) : null; },
  /* Does this person's role have this permission? Uses the permissions copied when they signed in. */
  can(key) {
    const u = this.user();
    if (!u || !Store.perms) return false;
    const role = u.role === 'staff' ? u.staffRole : u.role;
    const row = Store.perms[key];
    if (!row) return true;
    return row[role] === true;
  },
};

/* ---------- grade maths ---------- */
const Calc = {
  semGpa(sem) {
    const cr = sem.courses.reduce((a, c) => a + c.credits, 0);
    if (!cr) return 0;
    return sem.courses.reduce((a, c) => a + GRADE_POINTS[c.grade] * c.credits, 0) / cr;
  },
  semCredits(sem) { return sem.courses.reduce((a, c) => a + c.credits, 0); },
  sems(userId) { return (Store.state.grades[userId] || []).slice().sort((a, b) => a.year - b.year || a.sem - b.sem); },
  overall(userId) {
    const sems = this.sems(userId);
    const cr = sems.reduce((a, s) => a + this.semCredits(s), 0);
    if (!cr) return null;
    const pts = sems.reduce((a, s) => a + s.courses.reduce((b, c) => b + GRADE_POINTS[c.grade] * c.credits, 0), 0);
    return pts / cr;
  },
  credits(userId) { return this.sems(userId).reduce((a, s) => a + this.semCredits(s), 0); },
  latest(userId) { const s = this.sems(userId); return s.length ? s[s.length - 1] : null; },
  previous(userId) { const s = this.sems(userId); return s.length > 1 ? s[s.length - 2] : null; },
  fmt(n) { return n == null ? '–' : n.toFixed(2); },
  points(grade) { return GRADE_POINTS[grade].toFixed(1); },
};

/* ---------- queries used by several screens ---------- */
const Q = {
  acts(userId) { return Store.state.activities.filter(a => a.userId === userId); },
  projects(userId) { return Store.state.projects.filter(p => p.userId === userId); },
  letters(studentId) { return Store.state.letters.filter(l => l.studentId === studentId); },
  attachment(studentId) { return Store.state.attachments.find(a => a.studentId === studentId) || null; },
  attachmentWeek(att) {
    const days = Math.floor((Date.now() - new Date(att.start + 'T00:00:00').getTime()) / 86400000);
    return Math.min(att.weeks, Math.max(1, Math.floor(days / 7) + 1));
  },
  attachmentActive(att) { return new Date(att.end + 'T23:59:59').getTime() >= Date.now(); },
  daysLeft(att) { return Math.ceil((new Date(att.end + 'T23:59:59').getTime() - Date.now()) / 86400000); },
  /* Which students can this staff member open? */
  staffStudents(staff) {
    if (Session.can('view_all')) return Store.students();
    return (staff.teaches || []).map(id => Store.user(id)).filter(u => u && u.active);
  },
  /* Which students can this supervisor open? Only linked students, only while the attachment runs. */
  supervisorStudents(sup) {
    return Store.state.attachments.filter(a => a.supervisorId === sup.id && Q.attachmentActive(a))
      .map(a => ({ att: a, student: Store.user(a.studentId) })).filter(x => x.student && x.student.active);
  },
  canSeeStudent(viewer, studentId) {
    if (!viewer) return false;
    if (viewer.role === 'student') return viewer.id === studentId;
    if (viewer.role === 'admin') return true;
    if (viewer.role === 'staff') return Q.staffStudents(viewer).some(s => s.id === studentId);
    if (viewer.role === 'supervisor') return Q.supervisorStudents(viewer).some(x => x.student.id === studentId);
    return false;
  },
  pendingEntries(staff) {
    const ids = new Set(Q.staffStudents(staff).map(s => s.id));
    return Store.state.activities.filter(a => ids.has(a.userId) && a.status === 'waiting').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  staffLetters(staffId, status) { return Store.state.letters.filter(l => l.staffId === staffId && (!status || l.status === status)); },
  portfolioComplete(userId) {
    const acts = Q.acts(userId);
    return ['achievement', 'leadership', 'extra'].every(t => acts.some(a => a.type === t)) && Q.projects(userId).length > 0;
  },
};

/* ---------- names and labels ---------- */
const Names = {
  staff(u) { return u ? `${u.prefix ? u.prefix + ' ' : ''}${u.name}` : 'Unknown'; },
  typeLabel: { achievement: 'School achievements', leadership: 'Leadership roles', extra: 'Extracurricular' },
  typeShort: { achievement: 'Achievement', leadership: 'Leadership role', extra: 'Extracurricular activity' },
  typeLetter: { achievement: 'T', leadership: 'L', extra: 'E' },
  purposes: ['Job application', 'Scholarship', 'Internship', 'Further study', 'Standard reference'],
  kinds: ['Class project', 'Freelance', 'Personal build', 'Internship', 'Research'],
  roleLabel: { student: 'Student', teacher: 'Teacher', lecturer: 'Lecturer', supervisor: 'Supervisor', admin: 'Administrator' },
};
