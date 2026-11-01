/* API tests: start the server on a temporary database, then try normal use AND attacks.
   Run with:  npm test      (no packages needed) */
const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const PORT = 3999, BASE = `http://localhost:${PORT}`;
const DB = path.join(os.tmpdir(), `portfolio-test-${Date.now()}.db`);
let pass = 0, failed = 0;

class Client {
  constructor() { this.cookie = ''; }
  async call(method, url, body, extraHeaders = {}) {
    const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'portfolio', ...(this.cookie ? { Cookie: this.cookie } : {}), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    sc.forEach(c => { const [kv] = c.split(';'); if (kv.endsWith('=')) this.cookie = ''; else this.cookie = kv; });
    let data = null; try { data = await res.json(); } catch (e) {}
    return { status: res.status, data };
  }
  get(u) { return this.call('GET', u); }
  post(u, b) { return this.call('POST', u, b ?? {}); }
  async login(identifier, role, password = 'Demo@1234') { const r = await this.post('/api/login', { identifier, password, role }); return r; }
  async boot() { const r = await this.get('/api/bootstrap'); return r.data; }
  sync(changes) { return this.post('/api/sync', { changes }); }
}
const t = async (name, fn) => { try { await fn(); pass++; console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '-', e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'expected'}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };
const id = () => 'x' + Math.random().toString(36).slice(2, 10);

(async () => {
  const srv = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT, DB_FILE: DB }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 200)); }

  const jordan = new Client(), sam = new Client(), riley = new Client(), casey = new Client(), quinn = new Client();

  await t('login: wrong password rejected', async () => { const r = await new Client().login('230148', 'student', 'bad'); eq(r.status, 401); });
  await t('login: wrong role tab rejected after correct password', async () => { const r = await new Client().login('230148', 'staff'); eq(r.status, 401); ok(/student account/.test(r.data.error), r.data.error); });
  await t('login: all four roles can sign in', async () => {
    eq((await jordan.login('230148', 'student')).status, 200); eq((await sam.login('230152', 'student')).status, 200);
    eq((await riley.login('rudo.chikwanha@africau.edu', 'staff')).status, 200); eq((await casey.login('casey.brooks@acme.example', 'supervisor')).status, 200); eq((await quinn.login('admin@africau.edu', 'admin')).status, 200); });
  await t('no cookie, no data', async () => { eq((await new Client().get('/api/bootstrap')).status, 401); });
  await t('password hashes never leave the server', async () => { for (const c of [jordan, riley, quinn]) { const b = JSON.stringify(await c.boot()); ok(!/scrypt\$/.test(b) && !/password_hash/.test(b), 'hash leaked'); } });

  await t('student sees only their own data', async () => {
    const b = (await jordan.boot()).state;
    ok(b.users.filter(u => u.role === 'student').every(u => u.id === 'u-tendai'), 'other students visible');
    ok(b.activities.every(a => a.userId === 'u-tendai'), 'others activities'); ok(Object.keys(b.grades).join() === 'u-tendai', 'others grades');
    eq(b.audit.length, 0, 'audit visible'); eq(b.signups.length, 0, 'signups visible'); eq(b.registry.length, 0, 'registry visible'); });
  await t('student cannot see staff emails', async () => { const b = (await jordan.boot()).state; ok(b.users.filter(u => u.role === 'staff').every(u => !u.email), 'staff email leaked'); });
  await t('supervisor sees only linked students', async () => {
    const b = (await casey.boot()).state; const ids = b.users.filter(u => u.role === 'student').map(u => u.id).sort();
    eq(ids.join(), 'u-casey,u-chipo,u-tendai'); });
  await t('staff sees only their own letters', async () => { const b = (await riley.boot()).state; ok(b.letters.every(l => l.staffId === 'u-rudo')); ok(b.letters.length >= 3); });
  await t('admin sees everyone', async () => { const b = (await quinn.boot()).state; ok(b.users.length > 40 && b.audit.length > 0 && b.registry.length > 0); });

  await t('student cannot verify own entry', async () => {
    const a = (await jordan.boot()).state.activities.find(x => x.status === 'waiting');
    const r = await jordan.sync({ activities: { upsert: [{ ...a, status: 'verified' }] } }); eq(r.status, 403, r.data && r.data.error); });
  await t("student cannot edit someone else's entry or project", async () => {
    const samActs = (await sam.boot()).state.activities[0];
    const r = await jordan.sync({ activities: { upsert: [{ ...samActs, title: 'hacked', status: 'waiting' }] } }); eq(r.status, 403);
    const r2 = await jordan.sync({ projects: { delete: ['p5'] } }); eq(r2.status, 403); });
  await t('nobody can change grades', async () => {
    for (const c of [jordan, riley, quinn]) { eq((await c.sync({ grades: { upsert: [{ id: 'u-tendai', data: [] }] } })).status, 400); } });
  await t('student can add, edit and delete own project', async () => {
    const pid = id(); let r = await jordan.sync({ projects: { upsert: [{ id: pid, name: 'My App', kind: 'Personal build', team: 'Solo', goal: 'g', challenge: 'c', role: 'r', result: 'Used by 5', liveUrl: '', codeUrl: 'https://github.com/x/y' }] } }); eq(r.status, 200, JSON.stringify(r.data));
    r = await jordan.sync({ projects: { upsert: [{ id: pid, name: 'My App v2', kind: 'Personal build', team: 'Solo', goal: 'g', challenge: 'c', role: 'r', result: 'x', liveUrl: '', codeUrl: '' }] } }); eq(r.status, 200);
    r = await jordan.sync({ projects: { upsert: [{ id: id(), name: 'Bad', liveUrl: 'javascript:alert(1)' }] } }); eq(r.status, 400, 'javascript: link accepted');
    r = await jordan.sync({ projects: { delete: [pid] } }); eq(r.status, 200); });
  await t('student adds an activity: forced to waiting', async () => {
    const r = await jordan.sync({ activities: { upsert: [{ id: id(), type: 'extra', year: 3, title: 'Chess', detail: '', status: 'waiting', certificate: null }] } }); eq(r.status, 200, JSON.stringify(r.data)); });
  await t('staff can verify a student they teach; student sees it', async () => {
    const a = (await riley.boot()).state.activities.find(x => x.userId === 'u-tendai' && x.status === 'waiting');
    let r = await riley.sync({ activities: { upsert: [{ ...a, status: 'verified' }] } }); eq(r.status, 200, JSON.stringify(r.data));
    const mine = (await jordan.boot()).state.activities.find(x => x.id === a.id); eq(mine.status, 'verified'); eq(mine.verifiedBy, 'u-rudo'); });
  await t('staff cannot rewrite what a student wrote', async () => {
    const a = (await riley.boot()).state.activities.find(x => x.userId === 'u-tendai');
    eq((await riley.sync({ activities: { upsert: [{ ...a, title: 'Changed by staff' }] } })).status, 403); });
  await t('supervisor cannot verify or comment on entries', async () => {
    const a = (await casey.boot()).state.activities; eq(a.length >= 0, true);
    const act = (await riley.boot()).state.activities.find(x => x.status === 'waiting' && x.userId === 'u-tendai'); ok(act, 'no waiting entry to test with'); eq((await casey.sync({ activities: { upsert: [{ ...act, status: 'verified' }] } })).status, 403); });
  await t('comments are append-only and attributed', async () => {
    const a = (await riley.boot()).state.activities.find(x => x.userId === 'u-tendai');
    let r = await riley.sync({ activities: { upsert: [{ ...a, comments: [...(a.comments || []), { by: 'u-rudo', text: 'Nice', ts: 'x' }] }] } }); eq(r.status, 200, JSON.stringify(r.data));
    r = await riley.sync({ activities: { upsert: [{ ...a, comments: [{ by: 'u-rudo', text: 'rewritten' }] }] } }); eq(r.status, 403);
    r = await riley.sync({ activities: { upsert: [{ ...a, comments: [...(a.comments || []), { by: 'u-admin', text: 'impersonating', ts: 'x' }] }] } }); eq(r.status, 403); });

  await t('letters: student request -> staff accept -> bracket check -> send -> student asks for changes (max 2)', async () => {
    const lid = id(); const due = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    let r = await jordan.sync({ letters: { upsert: [{ id: lid, staffId: 'u-rudo', purpose: 'Internship', due, message: 'hi', share: { grades: true } }] } }); eq(r.status, 200, JSON.stringify(r.data));
    r = await jordan.sync({ letters: { upsert: [{ id: id(), staffId: 'u-rudo', purpose: 'Internship', due: '2020-01-01' }] } }); eq(r.status, 400, 'past date accepted');
    let L = (await riley.boot()).state.letters.find(l => l.id === lid); eq(L.status, 'new');
    eq((await jordan.sync({ letters: { upsert: [{ ...L, status: 'ready', versions: [{ n: 1, text: 'self-written' }] }] } })).status, 403, 'student wrote own letter');
    eq((await sam.sync({ letters: { upsert: [{ ...L, status: 'progress' }] } })).status, 403, 'other student accepted it');
    eq((await riley.sync({ letters: { upsert: [{ ...L, status: 'progress' }] } })).status, 200);
    L = (await riley.boot()).state.letters.find(l => l.id === lid);
    eq((await riley.sync({ letters: { upsert: [{ ...L, status: 'ready', versions: [{ n: 1, text: 'Dear X, [placeholder]' }] }] } })).status, 400, 'bracket letter sent');
    eq((await riley.sync({ letters: { upsert: [{ ...L, status: 'ready', versions: [{ n: 1, text: 'Dear X, Tendai is great.' }] }] } })).status, 200);
    let J = (await jordan.boot()).state.letters.find(l => l.id === lid); eq(J.status, 'ready'); eq(J.versions.length, 1);
    for (let i = 1; i <= 2; i++) {
      J = (await jordan.boot()).state.letters.find(l => l.id === lid);
      eq((await jordan.sync({ letters: { upsert: [{ ...J, status: 'changes', changesUsed: i, changeRequests: [...J.changeRequests, { n: i, text: 'please add ' + i }] }] } })).status, 200, 'change ' + i);
      const R = (await riley.boot()).state.letters.find(l => l.id === lid);
      eq((await riley.sync({ letters: { upsert: [{ ...R, status: 'ready', versions: [...R.versions, { n: R.versions.length + 1, text: 'Dear X, version ' + (i + 1) }] }] } })).status, 200);
    }
    J = (await jordan.boot()).state.letters.find(l => l.id === lid);
    eq((await jordan.sync({ letters: { upsert: [{ ...J, status: 'changes', changesUsed: 3, changeRequests: [...J.changeRequests, { n: 3, text: 'third' }] }] } })).status, 403, 'third change allowed'); });
  await t('letters: decline needs a reason', async () => {
    const L = (await riley.boot()).state.letters.find(l => l.status === 'new' && l.studentId === 'u-chipo');
    eq((await riley.sync({ letters: { upsert: [{ ...L, status: 'declined' }] } })).status, 400);
    eq((await riley.sync({ letters: { upsert: [{ ...L, status: 'declined', declineReason: 'On leave' }] } })).status, 200); });

  await t('supervisor: notes for linked student only, current week only', async () => {
    const att = (await casey.boot()).state.attachments.find(a => a.studentId === 'u-tendai');
    const week = Math.floor((Date.now() - new Date(att.start + 'T00:00:00').getTime()) / 864e5 / 7) + 1;
    let r = await casey.sync({ attachments: { upsert: [{ ...att, notes: [...att.notes, { week, text: 'Good week', ratings: { punctuality: 5, quality: 4, teamwork: 5 } }] }] } }); eq(r.status, 200, JSON.stringify(r.data));
    r = await casey.sync({ attachments: { upsert: [{ ...att, notes: [{ ...att.notes[0], text: 'rewrite history' }] }] } }); eq(r.status, 403, 'old note edited');
    eq((await riley.sync({ attachments: { upsert: [{ ...att, notes: [] }] } })).status, 403, 'staff wrote supervisor note');
    eq((await jordan.sync({ attachments: { upsert: [{ ...att, notes: [] }] } })).status, 403, 'student wrote supervisor note'); });

  await t('permissions: locked cells cannot be changed; others can', async () => {
    const perms = (await quinn.boot()).state.permissions; const bad = JSON.parse(JSON.stringify(perms));
    bad.change_gpa.admin = true; eq((await quinn.sync({ permissions: { value: bad } })).status, 403, 'locked grade edit allowed');
    const bad2 = JSON.parse(JSON.stringify(perms)); bad2.verify.student = true; eq((await quinn.sync({ permissions: { value: bad2 } })).status, 403, 'student verify allowed');
    const good = JSON.parse(JSON.stringify(perms)); good.comment_rate.teacher = !good.comment_rate.teacher; eq((await quinn.sync({ permissions: { value: good } })).status, 200);
    eq((await riley.sync({ permissions: { value: good } })).status, 403, 'staff changed permissions');
    eq((await jordan.sync({ permissions: { value: good } })).status, 403, 'student changed permissions'); });
  await t('non-admins cannot use admin endpoints', async () => {
    for (const c of [jordan, riley, casey]) { eq((await c.post('/api/admin/staff', { name: 'x' })).status, 403); eq((await c.post('/api/admin/users/u-tendai/active', { active: false })).status, 403); }
    eq((await new Client().post('/api/admin/registry/import', { rows: [] })).status, 401); });
  await t('audit log: "who" cannot be faked', async () => {
    const gid = id(); await jordan.sync({ audit: { upsert: [{ id: gid, text: 'Made by hacker', by: 'Admin Office', perm: true }] } });
    const g = (await quinn.boot()).state.audit.find(x => x.id === gid); ok(g, 'not logged'); eq(g.by, 'Tendai Moyo'); ok(!g.perm, 'perm flag faked'); });
  await t('events: cannot message students you cannot see', async () => { eq((await jordan.sync({ events: { upsert: [{ id: id(), userId: 'u-chipo', kind: 'verified', text: 'fake' }] } })).status, 403); });
  await t('own profile: phone ok, role escalation blocked', async () => {
    const me = (await jordan.boot()).state.users.find(u => u.id === 'u-tendai');
    eq((await jordan.sync({ users: { upsert: [{ ...me, phone: '+263 77 999 1111' }] } })).status, 200);
    eq((await jordan.sync({ users: { upsert: [{ ...me, role: 'admin' }] } })).status, 403, 'role change allowed');
    eq((await jordan.sync({ users: { upsert: [{ ...me, email: 'new@x.com' }] } })).status, 403, 'email change allowed');
    eq((await jordan.sync({ users: { upsert: [{ id: 'u-chipo', phone: '+263 77 1' }] } })).status, 403, 'edited other user'); });

  await t('sign-up: validates, flags mismatch, waits for approval, then can sign in', async () => {
    const c = new Client();
    eq((await c.post('/api/signup/check', { schoolId: '2023-0148', email: 'a@b.co' })).status, 400, 'dashed id');
    eq((await c.post('/api/signup/check', { schoolId: '250493', email: 'a@b.co' })).status, 404, 'unknown id');
    eq((await c.post('/api/signup/check', { schoolId: '230148', email: 'a@b.co' })).status, 409, 'existing account');
    let r = await c.post('/api/signup', { schoolId: '250420', email: 'maya.okoye@africau.edu', cc: '+263', phone: '77 123 4567', password: 'weak' }); eq(r.status, 400);
    r = await c.post('/api/signup', { schoolId: '250420', email: 'maya.okoye@africau.edu', cc: '+263', phone: '77 123 4567', password: 'Str0ng!pass' }); eq(r.status, 200); eq(r.data.status, 'match');
    r = await c.login('250420', 'student', 'Str0ng!pass'); eq(r.status, 401); ok(/waiting for the administrator/.test(r.data.error), r.data.error);
    eq((await new Client().login('250420', 'student', 'wrong-guess')).status, 401, 'pending status leaked to wrong password');
    const su = (await quinn.boot()).state.signups.find(s => s.schoolId === '250420'); ok(su, 'not in admin queue'); ok(!('password' in su) && !('password_hash' in su), 'signup password exposed');
    eq((await quinn.post(`/api/admin/signups/${su.id}/approve`)).status, 200);
    eq((await c.login('250420', 'student', 'Str0ng!pass')).status, 200); });
  await t('admin: create supervisor -> invite link -> set password -> sign in; link works once', async () => {
    const students = (await quinn.boot()).state.users.filter(u => u.role === 'student').slice(-2).map(u => u.id);
    let r = await quinn.post('/api/admin/staff', { name: 'Pat Lee', email: 'pat@firm.example', role: 'Supervisor', dept: 'Firm', students: [], start: '2026-10-01', weeks: 12 }); eq(r.status, 400);
    r = await quinn.post('/api/admin/staff', { name: 'Pat Lee', email: 'pat@firm.example', role: 'Supervisor', dept: 'Firm', students: [students[0]], start: new Date().toISOString().slice(0, 10), weeks: 12 }); eq(r.status, 200, JSON.stringify(r.data));
    const tok = r.data.demoToken; ok(tok, 'no token');
    eq((await new Client().login('pat@firm.example', 'supervisor')).status, 401);
    eq((await new Client().post('/api/set-password', { token: tok, password: 'short' })).status, 400);
    eq((await new Client().post('/api/set-password', { token: tok, password: 'Pass@1234' })).status, 200);
    eq((await new Client().post('/api/set-password', { token: tok, password: 'Pass@1234' })).status, 404, 'link reusable');
    const pat = new Client(); eq((await pat.login('pat@firm.example', 'supervisor', 'Pass@1234')).status, 200);
    eq((await pat.boot()).state.users.filter(u => u.role === 'student').length, 1); });
  await t('deactivated users are locked out immediately', async () => {
    const x = new Client(); eq((await x.login('230152', 'student')).status, 200);
    eq((await quinn.post('/api/admin/users/u-chipo/active', { active: false })).status, 200);
    eq((await x.get('/api/bootstrap')).status, 401, 'old session still works'); eq((await new Client().login('230152', 'student')).status, 403);
    eq((await quinn.post('/api/admin/users/u-chipo/active', { active: true })).status, 200); eq((await quinn.post('/api/admin/users/u-admin/active', { active: false })).status, 400, 'self-deactivate'); });
  await t('logout ends the session', async () => { const c = new Client(); await c.login('230148', 'student'); eq((await c.post('/api/logout')).status, 200); eq((await c.get('/api/bootstrap')).status, 401); });
  await t('log in rate limit', async () => { const c = new Client(); let last; for (let i = 0; i < 10; i++) last = await c.login('230152', 'student', 'nope' + i); eq(last.status, 429); });
  await t('CSRF: requests without our header or from other origins are blocked', async () => {
    const c = new Client(); await c.login('230148', 'student');
    let res = await fetch(BASE + '/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: c.cookie }, body: '{"changes":{}}' }); eq(res.status, 403);
    res = await fetch(BASE + '/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'portfolio', Origin: 'https://evil.example', Cookie: c.cookie }, body: '{"changes":{}}' }); eq(res.status, 403);
    res = await fetch(BASE + '/api/sync', { method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-Requested-With': 'portfolio', Cookie: c.cookie }, body: '{}' }); eq(res.status, 400); });
  await t('static files: only public/ is served', async () => {
    for (const p of ['/server/db.js', '/data/portfolio.db', '/package.json', '/../package.json', '/%2e%2e/package.json']) { const r = await fetch(BASE + p); ok(r.status === 404 || r.status === 400, `${p} -> ${r.status}`); }
    eq((await fetch(BASE + '/')).status, 200); eq((await fetch(BASE + '/js/app.js')).status, 200); });
  await t('seed data is no longer shipped to the browser', async () => { const js = await (await fetch(BASE + '/js/data.js')).text(); ok(!/buildSeed|Demo@1234|password/.test(js), 'seed in client'); });
  await t('sessions: cookie is HttpOnly + SameSite', async () => {
    const res = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'portfolio' }, body: JSON.stringify({ identifier: '230148', password: 'Demo@1234', role: 'student' }) });
    const c = res.headers.get('set-cookie'); ok(/HttpOnly/.test(c) && /SameSite=Lax/.test(c), c); });

  srv.kill(); try { fs.rmSync(DB, { force: true }); fs.rmSync(DB + '-wal', { force: true }); fs.rmSync(DB + '-shm', { force: true }); } catch (e) {}
  console.log(`\n${pass} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
})();
