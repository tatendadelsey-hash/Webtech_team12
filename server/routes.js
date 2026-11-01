/* Routes: every URL under /api.  Each function receives (req, res, ctx) where ctx = { h, session, user, body, params }. */
const crypto = require('node:crypto');
const { hashPassword, verifyPassword, newToken, sha256, passwordProblem, makeLimiter } = require('./security');
const { bootstrap, publicUser, roleKey, can, attachmentActive } = require('./scope');
const { apply, Rule } = require('./sync');
const { seed, SHARED } = require('./db');
const C = require('./config');
const { sendMail } = require('./mailer');

const DEMO_MODE = C.DEMO_MODE;      // demo mode shows invite / reset links on screen instead of emailing them
const SESSION_HOURS = 12, REMEMBER_DAYS = 30, TOKEN_HOURS = 24 * 7;
const loginLimiter = makeLimiter(8, 10 * 60 * 1000);
const DUMMY_HASH = hashPassword('not-a-real-password');   // makes "unknown user" take as long as "wrong password"

const fail = (status, message, extra = {}) => { const e = new Rule(message, status); Object.assign(e, extra); return e; };
const rid = (p) => p + crypto.randomBytes(6).toString('hex');
const nowIso = () => new Date().toISOString();
const isEmail = (s) => typeof s === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length <= 200;

/* ---------- sessions ---------- */
async function createSession(h, user, remember) {
  const token = newToken();
  const ttl = remember ? REMEMBER_DAYS * 86400000 : SESSION_HOURS * 3600000;
  const perms = await h.kvGet('permissions');          // copied now: permission changes apply the next time someone signs in
  await h.db.prepare('INSERT INTO sessions (token_hash, user_id, perms, expires) VALUES (?, ?, ?, ?)').run(sha256(token), user.id, JSON.stringify(perms), Date.now() + ttl);
  return { token, maxAge: remember ? Math.floor(ttl / 1000) : null };
}
async function findSession(h, token) {
  if (!token) return null;
  const r = await h.db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires > ?').get(sha256(token), Date.now());
  return r ? { userId: r.user_id, perms: JSON.parse(r.perms), hash: r.token_hash } : null;
}
const endSessionsFor = (h, userId) => h.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

/* ---------- one-time links (invite, password reset) ---------- */
async function makeToken(h, userId, type) {
  const token = newToken();
  await h.db.prepare('DELETE FROM tokens WHERE user_id = ? AND type = ?').run(userId, type);
  await h.db.prepare('INSERT INTO tokens VALUES (?, ?, ?, ?)').run(sha256(token), userId, type, Date.now() + TOKEN_HOURS * 3600000);
  return token;
}
const readToken = (h, token) => h.db.prepare('SELECT * FROM tokens WHERE token_hash = ? AND expires > ?').get(sha256(String(token || '')), Date.now());

async function audit(h, text, by, perm) { const id = rid('g'); return h.putRecord('audit', id, '', { id, text, ts: nowIso(), by, ...(perm ? { perm: true } : {}) }); }

const routes = {};
const route = (method, pattern, opts, fn) => routes[`${method} ${pattern}`] = { re: new RegExp('^' + pattern.replace(/:([a-z]+)/g, '([^/]+)') + '$'), method, auth: opts.auth, admin: opts.admin, fn };

/* ================= health ================= */
route('GET', '/api/health', {}, async () => ({ ok: true, demoMode: DEMO_MODE }));

/* ================= log in / out ================= */
route('POST', '/api/login', {}, async ({ h, body, ip }, res) => {
  const identifier = String(body.identifier || '').trim(), password = String(body.password || '');
  if (!identifier) throw fail(400, 'Enter your school email or ID.', { field: 'identifier' });
  if (!password) throw fail(400, 'Enter your password.', { field: 'password' });
  const key = `${ip}|${identifier.toLowerCase()}`;
  if (loginLimiter.blocked(key)) throw fail(429, 'Too many tries. Wait a few minutes and try again.', { field: 'password' });

  const row = await h.db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) OR school_id = ?').get(identifier, identifier);
  const ok = verifyPassword(password, row ? row.password_hash : DUMMY_HASH) && !!row;
  if (!ok) {
    // A student who has signed up but is not approved yet gets a helpful message (only if their password matches).
    const su = await h.db.prepare('SELECT * FROM signups WHERE (school_id = ? OR lower(email) = lower(?))').get(identifier, identifier);
    if (!row && su && verifyPassword(password, su.password_hash)) {
      if (su.status === 'correction') throw fail(401, 'The registry office asked you to correct your sign-up details. Use "Create an account" to send them again.', { field: 'identifier' });
      throw fail(401, 'Your sign-up is waiting for the administrator to approve it. You will be able to sign in after that.', { field: 'identifier' });
    }
    if (row && !row.password_hash) throw fail(401, 'This account has no password yet. Use the link in your invitation email to set one.', { field: 'identifier' });
    loginLimiter.add(key);
    throw fail(401, 'That email or ID and password do not match. Check them and try again.', { field: 'password' });
  }
  if (!row.active) throw fail(403, `This account has been deactivated. Contact the registry office (${SHARED.CONFIG.registryEmail}).`, { field: 'identifier' });
  if (body.role && body.role !== row.role) throw fail(401, `This is a ${row.role === 'admin' ? 'administrator' : row.role} account. Choose "${row.role === 'admin' ? 'Administrator' : row.role[0].toUpperCase() + row.role.slice(1)}" above.`, { field: 'identifier' });
  loginLimiter.clear(key);
  const s = await createSession(h, await h.getUser(row.id), !!body.remember);
  res.setSession(s);
  return { ok: true };
});
route('POST', '/api/logout', { auth: true }, async ({ h, session }, res) => { await h.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(session.hash); res.clearSession(); return { ok: true }; });

/* ================= data for the signed-in person ================= */
route('GET', '/api/bootstrap', { auth: true }, async ({ h, user, session }) => ({ meId: user.id, perms: session.perms, state: await bootstrap(h, user, session.perms) }));
route('POST', '/api/sync', { auth: true }, async ({ h, session, body }) => { await apply(h, session, body.changes); return { ok: true }; });

/* ================= student sign-up ================= */
async function checkSignup(h, b) {
  const schoolId = String(b.schoolId || '').trim(), email = String(b.email || '').trim();
  if (!/^\d{6}$/.test(schoolId)) throw fail(400, 'Enter your 6-digit school ID, for example 250493.', { field: 'schoolId' });
  if (!isEmail(email)) throw fail(400, 'Enter a valid school email.', { field: 'email' });
  const rec = await h.db.prepare('SELECT * FROM registry WHERE school_id = ?').get(schoolId);
  if (await h.db.prepare('SELECT 1 FROM users WHERE school_id = ?').get(schoolId)) throw fail(409, 'An account already exists for this school ID. Sign in instead.', { field: 'schoolId' });
  const pending = await h.db.prepare('SELECT status FROM signups WHERE school_id = ?').get(schoolId);
  if (pending && pending.status !== 'correction') throw fail(409, 'This school ID has already signed up and is waiting for approval.', { field: 'schoolId' });
  if (!rec) throw fail(404, `We could not find this school ID in school records. Check it, or contact the registry office (${SHARED.CONFIG.registryEmail}).`, { field: 'schoolId' });
  return { schoolId, email, rec };
}
route('POST', '/api/signup/check', {}, async ({ h, body }) => { await checkSignup(h, body); return { ok: true }; });
route('POST', '/api/signup', {}, async ({ h, body }) => {
  const { schoolId, email, rec } = await checkSignup(h, body);
  const digits = String(body.phone || '').replace(/[\s-]/g, '');
  if (!/^\d{7,10}$/.test(digits)) throw fail(400, 'Enter your phone number without the country code, for example 77 123 4567.', { field: 'phone' });
  const pe = passwordProblem(body.password); if (pe) throw fail(400, pe, { field: 'password' });
  if (!/^\+\d{1,4}$/.test(String(body.cc || '+263'))) throw fail(400, 'Bad country code.', { field: 'phone' });
  const status = rec.email.toLowerCase() === email.toLowerCase() ? 'match' : 'mismatch';
  await h.tx(async () => {
    await h.db.prepare('DELETE FROM signups WHERE school_id = ?').run(schoolId);
    await h.db.prepare('INSERT INTO signups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(rid('su'), schoolId, rec.name, email, rec.email, `${body.cc || '+263'} ${digits}`, hashPassword(body.password), status, '', nowIso());
    await audit(h, `${rec.name} signed up and is waiting for approval`, 'System');
  });
  return { ok: true, name: rec.name, status };
});

/* ================= forgot / set password ================= */
route('POST', '/api/forgot', {}, async ({ h, body, origin }) => {
  const email = String(body.email || '').trim();
  if (!isEmail(email)) throw fail(400, 'Enter a valid email address.', { field: 'email' });
  const row = await h.db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) AND active = 1').get(email);
  const out = { ok: true };                                    // same answer whether or not the account exists
  if (row) {
    const t = await makeToken(h, row.id, 'reset');
    if (DEMO_MODE) out.demoToken = t;
    else sendMail({ to: row.email, name: row.name, subject: 'Reset your AU Launchpad password', text: `Hello ${row.name},\n\nSomeone asked to reset the password for your AU Launchpad account. The link works for 7 days.`, link: `${origin}/#/set-password/${t}`, button: 'Choose a new password' });
  }
  return out;
});
route('GET', '/api/token/:t', {}, async ({ h, params }) => {
  const t = await readToken(h, params[0]); if (!t) throw fail(404, 'This link has expired.');
  const u = await h.getUser(t.user_id); return { ok: true, name: u.name, email: u.email, type: t.type };
});
route('POST', '/api/set-password', {}, async ({ h, body }) => {
  const t = await readToken(h, body.token); if (!t) throw fail(404, 'This link has expired. Ask the registry office to send a new one.');
  const pe = passwordProblem(body.password); if (pe) throw fail(400, pe, { field: 'password' });
  await h.tx(async () => {
    await h.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(body.password), t.user_id);
    await h.db.prepare('DELETE FROM tokens WHERE user_id = ?').run(t.user_id);
    await endSessionsFor(h, t.user_id);
    const who = await h.getUser(t.user_id);
    await audit(h, `${who.name} set a password`, who.name);
  });
  return { ok: true };
});

/* ================= administrator actions ================= */
const adminRoute = (method, pattern, fn) => route(method, pattern, { auth: true, admin: true }, async (ctx, res) => {
  if (!can(ctx.session.perms, ctx.user, 'manage_accounts')) throw fail(403, 'You cannot manage accounts.');
  return fn(ctx, res);
});

adminRoute('POST', '/api/admin/signups/:id/approve', async ({ h, user, params }) => {
  const su = await h.db.prepare('SELECT * FROM signups WHERE id = ?').get(params[0]); if (!su) throw fail(404, 'That sign-up no longer exists.');
  const rec = await h.db.prepare('SELECT * FROM registry WHERE school_id = ?').get(su.school_id);
  if (await h.db.prepare('SELECT 1 FROM users WHERE school_id = ? OR lower(email) = lower(?)').get(su.school_id, su.email)) { await h.db.prepare('DELETE FROM signups WHERE id = ?').run(su.id); return { ok: true }; }
  await h.tx(async () => {
    await h.insertUser({ id: rid('u-'), role: 'student', name: su.name, schoolId: su.school_id, year: rec ? rec.year : 1, programme: rec ? rec.programme : '', email: su.email, phone: su.phone, active: true, createdLive: true, profile: { bio: '', skills: [], linkedin: '', github: '' } }, su.password_hash);
    await h.db.prepare('DELETE FROM signups WHERE id = ?').run(su.id);
    await audit(h, `Approved sign-up: ${su.name}`, user.name);
  });
  return { ok: true, name: su.name };
});
adminRoute('POST', '/api/admin/signups/:id/reject', async ({ h, user, params }) => {
  const su = await h.db.prepare('SELECT * FROM signups WHERE id = ?').get(params[0]); if (!su) throw fail(404, 'That sign-up no longer exists.');
  await h.tx(async () => { await h.db.prepare('DELETE FROM signups WHERE id = ?').run(su.id); await audit(h, `Rejected sign-up: ${su.name}`, user.name); });
  return { ok: true };
});
adminRoute('POST', '/api/admin/signups/:id/correct', async ({ h, user, params }) => {
  const su = await h.db.prepare('SELECT * FROM signups WHERE id = ?').get(params[0]); if (!su) throw fail(404, 'That sign-up no longer exists.');
  await h.tx(async () => { await h.db.prepare("UPDATE signups SET status = 'correction' WHERE id = ?").run(su.id); await audit(h, `Asked ${su.name} to correct their sign-up details`, user.name); });
  return { ok: true };
});

adminRoute('POST', '/api/admin/staff', async ({ h, user, body, origin }) => {
  const name = String(body.name || '').trim(), email = String(body.email || '').trim().toLowerCase(), dept = String(body.dept || '').trim();
  const roleName = String(body.role || '');
  if (!name || name.length > 100) throw fail(400, 'Enter their full name.', { field: 'name' });
  if (!isEmail(email)) throw fail(400, 'Enter a valid work email.', { field: 'email' });
  if (await h.db.prepare('SELECT 1 FROM users WHERE lower(email) = ?').get(email)) throw fail(409, 'An account with this email already exists.', { field: 'email' });
  if (!['Teacher', 'Lecturer', 'Supervisor'].includes(roleName)) throw fail(400, 'Choose a role.', { field: 'role' });
  if (!dept || dept.length > 100) throw fail(400, roleName === 'Supervisor' ? 'Enter the company.' : 'Enter the department.', { field: 'dept' });
  const ids = Array.isArray(body.students) ? body.students.filter(x => typeof x === 'string') : [];
  const students = [];
  for (const id of ids) { const s = await h.getUser(id); if (s && s.role === 'student') students.push(s); }
  if (students.length !== ids.length) throw fail(400, 'One of the chosen students does not exist.');
  const isSup = roleName === 'Supervisor';
  if (isSup && !students.length) throw fail(400, 'Link at least one student below, or this supervisor will see nobody.', { field: 'role' });
  let weeks = 12, start = '';
  if (isSup) {
    weeks = parseInt(body.weeks, 10); start = String(body.start || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw fail(400, 'Choose the start date.', { field: 'start' });
    if (!(weeks >= 1 && weeks <= 52)) throw fail(400, 'Enter a length between 1 and 52 weeks.', { field: 'weeks' });
    for (const s of students) { const a = await h.getRecord('attachments', s.id); if (a && attachmentActive(a)) throw fail(409, `${s.name} is already on an attachment.`); }
  }
  let emailed = false;
  const id = rid('u-');
  const token = await h.tx(async () => {
    await h.insertUser({ id, role: isSup ? 'supervisor' : 'staff', staffRole: isSup ? undefined : roleName.toLowerCase(), prefix: '', title: roleName, name, department: dept, email, active: true, createdLive: true, teaches: isSup ? undefined : students.map(s => s.id) }, null);
    if (isSup) {
      const end = new Date(start + 'T12:00:00'); end.setDate(end.getDate() + weeks * 7);
      for (const s of students) await h.putRecord('attachments', s.id, s.id, { studentId: s.id, supervisorId: id, company: dept, weeks, start, end: end.toISOString().slice(0, 10), notes: [], report: null });
    }
    await audit(h, `Account created for ${name} (${roleName})`, user.name);
    return await makeToken(h, id, 'invite');
  });
  if (!DEMO_MODE) emailed = await sendMail({ to: email, name, subject: 'Your AU Launchpad account', text: `Hello ${name},\n\nAn account has been created for you on AU Launchpad as ${roleName}. Use the button below to choose your password. The link works for 7 days.`, link: `${origin}/#/set-password/${token}`, button: 'Set my password' });
  return { ok: true, userId: id, name, email, emailed, ...(DEMO_MODE ? { demoToken: token } : {}) };
});
adminRoute('POST', '/api/admin/users/:id/active', async ({ h, user, params, body }) => {
  const target = await h.getUser(params[0]); if (!target) throw fail(404, 'No such account.');
  if (target.id === user.id) throw fail(400, 'You cannot deactivate your own account.');
  const active = !!body.active;
  await h.tx(async () => {
    await h.db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, target.id);
    if (!active) await endSessionsFor(h, target.id);
    await audit(h, `${target.name} ${active ? 'reactivated' : 'deactivated'}`, user.name);
  });
  return { ok: true };
});
adminRoute('POST', '/api/admin/users/:id/invite', async ({ h, params, origin }) => {
  const target = await h.getUser(params[0]); if (!target) throw fail(404, 'No such account.');
  if (target.hasPassword) throw fail(400, 'That person already has a password.');
  const t = await makeToken(h, target.id, 'invite');
  const emailed = DEMO_MODE ? false : await sendMail({ to: target.email, name: target.name, subject: 'Your AU Launchpad invitation', text: `Hello ${target.name},\n\nYou have been invited to AU Launchpad. Use the button below to choose your password. The link works for 7 days.`, link: `${origin}/#/set-password/${t}`, button: 'Set my password' });
  return { ok: true, name: target.name, email: target.email, emailed, ...(DEMO_MODE ? { demoToken: t } : {}) };
});
adminRoute('POST', '/api/admin/registry/import', async ({ h, user, body }) => {
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 5000) : [];
  let added = 0, skipped = 0; const badRows = [];
  const known = new Set([...(await h.db.prepare('SELECT school_id FROM registry').all()), ...(await h.db.prepare('SELECT school_id FROM users WHERE school_id IS NOT NULL').all())].map(r => r.school_id));
  const fresh = [];
  rows.forEach((r, i) => {
    const rec = { schoolId: String(r.schoolId || '').trim(), name: String(r.name || '').trim(), email: String(r.email || '').trim(), programme: String(r.programme || '').trim(), year: parseInt(r.year, 10) || 1 };
    if (!/^\d{6}$/.test(rec.schoolId)) return badRows.push(`Row ${i + 2}: school ID "${rec.schoolId}" should be 6 digits, like 260101`);
    if (!rec.name) return badRows.push(`Row ${i + 2}: name is missing`);
    if (!isEmail(rec.email)) return badRows.push(`Row ${i + 2}: email "${rec.email}" is not valid`);
    if (rec.year < 1 || rec.year > 4) return badRows.push(`Row ${i + 2}: year must be 1 to 4`);
    if (known.has(rec.schoolId)) return skipped++;
    known.add(rec.schoolId); fresh.push(rec); added++;
  });
  await h.tx(async () => {                                            // inserted in chunks: far fewer trips to the database
    for (let i = 0; i < fresh.length; i += 200) {
      const part = fresh.slice(i, i + 200);
      await h.db.prepare(`INSERT INTO registry VALUES ${part.map(() => '(?, ?, ?, ?, ?)').join(', ')}`).run(...part.flatMap(r => [r.schoolId, r.name, r.email, r.programme, r.year]));
    }
  });
  await audit(h, `Imported ${added} student record${added === 1 ? '' : 's'} from a file`, user.name);
  return { ok: true, added, skipped, bad: badRows };
});

/* ================= demo helper: put the sample data back ================= */
route('POST', '/api/dev/reset', {}, async ({ h }, res) => {
  if (!DEMO_MODE) throw fail(404, 'Not found.');
  await seed(h); res.clearSession(); return { ok: true };
});

module.exports = { routes, findSession, Rule, DEMO_MODE };
