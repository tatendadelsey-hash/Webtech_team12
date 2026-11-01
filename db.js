/* Database layer. One small interface, two engines:
   - DATABASE_URL is set  ->  PostgreSQL (for example Supabase). Used when the site is online.
   - otherwise            ->  a SQLite file (data/portfolio.db) using Node's built-in node:sqlite. Used on your own computer.

   Tables
   - users, signups, registry   real columns (accounts, pending sign-ups, school records)
   - records                    portfolio data stored as JSON text, one row per item:
                                grades, projects, activities, letters, assessments, attachments, events, audit, reports
   - kv                         small settings, such as the permission matrix
   - sessions, tokens           log-in sessions and one-time links (invite / password reset)

   Every database call is async (use await). SQL is written once with ? placeholders; the Postgres adapter turns them into $1, $2... */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { AsyncLocalStorage } = require('node:async_hooks');
const { hashPassword } = require('./security');

const ROOT = path.join(__dirname, '..');
const DB_FILE = process.env.DB_FILE || path.join(ROOT, 'data', 'portfolio.db');
const DATABASE_URL = process.env.DATABASE_URL || '';

/* The sample school database is built by seed-data.js (shared code from the prototype). We run it once to get
   plain objects, along with the permission matrix definition that the server needs for its rules. */
function loadSeedModule() {
  const cfg = fs.readFileSync(path.join(ROOT, 'public', 'js', 'config.js'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, 'seed-data.js'), 'utf8');
  return vm.runInNewContext(`${cfg}\n${seed}\n;({ CONFIG, seed: buildSeed(), PERM_ROWS, PERM_ROLES, SCHOOL_BASELINE })`, {}, { filename: 'seed' });
}
const SHARED = loadSeedModule();   // { CONFIG, seed, PERM_ROWS, PERM_ROLES, SCHOOL_BASELINE }

const TABLES = ['users', 'signups', 'registry', 'records', 'kv', 'sessions', 'tokens'];
const SCHEMA_COMMON = `
  CREATE TABLE IF NOT EXISTS signups (
    id TEXT PRIMARY KEY, school_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, registry_email TEXT, phone TEXT,
    password_hash TEXT NOT NULL, status TEXT NOT NULL, note TEXT, ts TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS registry (school_id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, programme TEXT, year INTEGER);
  CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL, id TEXT NOT NULL, owner TEXT, data TEXT NOT NULL, PRIMARY KEY (collection, id));
  CREATE INDEX IF NOT EXISTS idx_records_owner ON records (collection, owner);
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;
const USER_COLUMNS = `id TEXT PRIMARY KEY, role TEXT NOT NULL, staff_role TEXT, school_id TEXT UNIQUE, email TEXT NOT NULL,
  name TEXT NOT NULL, prefix TEXT, title TEXT, department TEXT, unit TEXT, programme TEXT, year INTEGER, phone TEXT, photo TEXT,
  active INTEGER NOT NULL DEFAULT 1, password_hash TEXT, teaches TEXT, profile TEXT, created_live INTEGER NOT NULL DEFAULT 0`;

/* ---------- SQLite (own computer) ---------- */
function sqliteAdapter() {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const raw = new DatabaseSync(DB_FILE);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const als = new AsyncLocalStorage();           // set while we are inside a transaction
  let lock = Promise.resolve();                  // one transaction at a time (a single connection)
  const waitTurn = async () => { if (!als.getStore()) await lock; };
  return {
    dialect: 'sqlite',
    label: `SQLite file ${DB_FILE}`,
    async exec(sql) { await waitTurn(); raw.exec(sql); },
    async all(sql, ...p) { await waitTurn(); return raw.prepare(sql).all(...p); },
    async get(sql, ...p) { await waitTurn(); return raw.prepare(sql).get(...p); },
    async run(sql, ...p) { await waitTurn(); raw.prepare(sql).run(...p); },
    tx(fn) {
      if (als.getStore()) return fn();
      const result = lock.then(async () => {
        raw.exec('BEGIN IMMEDIATE');
        try { const r = await als.run(true, fn); raw.exec('COMMIT'); return r; }
        catch (e) { try { raw.exec('ROLLBACK'); } catch (_) {} throw e; }
      });
      lock = result.catch(() => {});
      return result;
    },
    async schema() {
      await this.exec(`CREATE TABLE IF NOT EXISTS users (${USER_COLUMNS.replace('email TEXT NOT NULL', 'email TEXT NOT NULL UNIQUE COLLATE NOCASE')});
        ${SCHEMA_COMMON}
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, perms TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, expires INTEGER NOT NULL);`);
    },
    async close() { raw.close(); },
  };
}

/* ---------- PostgreSQL (Supabase, online) ---------- */
const toPg = (sql) => { let n = 0, out = '', q = false; for (const ch of sql) { if (ch === "'") q = !q; out += (ch === '?' && !q) ? `$${++n}` : ch; } return out; };
function postgresAdapter(url) {
  let pg;
  try { pg = require('pg'); } catch (e) { throw new Error('The "pg" package is missing. Run:  npm install'); }
  pg.types.setTypeParser(20, Number);            // BIGINT and COUNT(*) come back as numbers, not text
  const local = /@(localhost|127\.0\.0\.1)([:/]|$)/.test(url);
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX) || 5, ssl: (local || process.env.PGSSL === '0') ? undefined : { rejectUnauthorized: false } });
  pool.on('error', (e) => console.error('Database connection problem:', e.message));
  const als = new AsyncLocalStorage();           // holds the transaction's own connection while inside tx()
  const q = (sql, params) => (als.getStore() || pool).query(toPg(sql), params);
  return {
    dialect: 'postgres',
    label: 'PostgreSQL database (DATABASE_URL)',
    async exec(sql) { await (als.getStore() || pool).query(sql); },
    async all(sql, ...p) { return (await q(sql, p)).rows; },
    async get(sql, ...p) { return (await q(sql, p)).rows[0]; },
    async run(sql, ...p) { await q(sql, p); },
    async tx(fn) {
      if (als.getStore()) return fn();
      const client = await pool.connect();
      try { await client.query('BEGIN'); const r = await als.run(client, fn); await client.query('COMMIT'); return r; }
      catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} throw e; }
      finally { client.release(); }
    },
    async schema() {
      const SEQ = ', seq BIGINT GENERATED ALWAYS AS IDENTITY';          // keeps the order rows were added in
      await this.exec(`CREATE TABLE IF NOT EXISTS users (${USER_COLUMNS}${SEQ});
        CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email));
        ${SCHEMA_COMMON.replace(/(CREATE TABLE IF NOT EXISTS (?:registry|records|signups) \()([^;]*?)\);/g, (m, head, cols) => `${head}${cols}${SEQ});`)}
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, perms TEXT NOT NULL, expires BIGINT NOT NULL);
        CREATE TABLE IF NOT EXISTS tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, expires BIGINT NOT NULL);`);
      // Row level security ON with no policies: nobody can read these tables through Supabase's public API.
      // Only this server can, because it connects with the private database password.
      for (const t of TABLES) await this.exec(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    },
    async close() { await pool.end(); },
  };
}

/* ---------- small helpers used everywhere (all async) ---------- */
function makeHelpers(adapter) {
  const ORD = adapter.dialect === 'postgres' ? 'seq' : 'rowid';       // lists always come back in the order they were added
  const db = {
    dialect: adapter.dialect,
    prepare: (sql) => ({ get: (...p) => adapter.get(sql, ...p), all: (...p) => adapter.all(sql, ...p), run: (...p) => adapter.run(sql, ...p) }),
    exec: (sql) => adapter.exec(sql),
  };
  const tx = (fn) => adapter.tx(fn);
  const getRecord = async (collection, id) => {
    const r = await db.prepare('SELECT data, owner FROM records WHERE collection = ? AND id = ?').get(collection, id);
    return r ? JSON.parse(r.data) : null;
  };
  const hasRecord = async (collection, id) => !!(await db.prepare('SELECT 1 AS x FROM records WHERE id = ? AND collection = ?').get(id, collection));
  const putRecord = (collection, id, owner, obj) =>
    db.prepare('INSERT INTO records (collection, id, owner, data) VALUES (?, ?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET owner = excluded.owner, data = excluded.data')
      .run(collection, id, owner || '', JSON.stringify(obj));
  const deleteRecord = (collection, id) => db.prepare('DELETE FROM records WHERE collection = ? AND id = ?').run(collection, id);
  const allRecords = async (collection) => (await db.prepare(`SELECT data FROM records WHERE collection = ? ORDER BY ${ORD}`).all(collection)).map(r => JSON.parse(r.data));
  const recordsByOwner = async (collection, owner) => (await db.prepare(`SELECT data FROM records WHERE collection = ? AND owner = ? ORDER BY ${ORD}`).all(collection, owner)).map(r => JSON.parse(r.data));

  const rowToUser = (r) => r && ({
    id: r.id, role: r.role, staffRole: r.staff_role || undefined, schoolId: r.school_id || undefined, email: r.email, name: r.name,
    prefix: r.prefix || '', title: r.title || '', department: r.department || '', unit: r.unit || '', programme: r.programme || '',
    year: r.year || undefined, phone: r.phone || '', photo: r.photo || null, active: !!r.active,
    teaches: r.teaches ? JSON.parse(r.teaches) : undefined, profile: r.profile ? JSON.parse(r.profile) : undefined,
    createdLive: !!r.created_live, hasPassword: !!r.password_hash,
  });
  const getUser = async (id) => rowToUser(await db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  const allUsers = async () => (await db.prepare(`SELECT * FROM users ORDER BY ${ORD}`).all()).map(rowToUser);
  const insertUser = (u, passwordHash) =>
    db.prepare(`INSERT INTO users (id, role, staff_role, school_id, email, name, prefix, title, department, unit, programme, year, phone, photo, active, password_hash, teaches, profile, created_live)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(u.id, u.role, u.staffRole || null, u.schoolId || null, u.email, u.name, u.prefix || '', u.title || '', u.department || '', u.unit || '',
        u.programme || '', u.year || null, u.phone || '', u.photo || null, u.active === false ? 0 : 1, passwordHash || null,
        u.teaches ? JSON.stringify(u.teaches) : null, u.profile ? JSON.stringify(u.profile) : null, u.createdLive ? 1 : 0);
  const kvGet = async (key) => { const r = await db.prepare('SELECT value FROM kv WHERE key = ?').get(key); return r ? JSON.parse(r.value) : null; };
  const kvSet = (key, val) => db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(val));
  return { ORD, db, tx, getRecord, hasRecord, putRecord, deleteRecord, allRecords, recordsByOwner, getUser, allUsers, insertUser, rowToUser, kvGet, kvSet, close: () => adapter.close(), label: adapter.label };
}

/* ---------- seeding ---------- */
/* Sample school data (demo only): every demo account shares one password. */
async function seed(h) {
  const { seed: S, CONFIG } = SHARED, { db } = h;
  const demoHash = hashPassword(CONFIG.demoPassword);
  await h.tx(async () => {
    for (const t of TABLES) await db.exec(`DELETE FROM ${t}`);
    for (const u of S.users) await h.insertUser(u, demoHash);
    for (const r of S.registry) await db.prepare('INSERT INTO registry VALUES (?, ?, ?, ?, ?)').run(r.schoolId, r.name, r.email, r.programme, r.year);
    for (const s of S.signups) await db.prepare('INSERT INTO signups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(s.id, s.schoolId, s.name, s.email, s.registryEmail || null, s.phone, demoHash, s.status, s.note || '', s.ts);
    for (const [uid, sems] of Object.entries(S.grades)) await h.putRecord('grades', uid, uid, sems);
    for (const p of S.projects) await h.putRecord('projects', p.id, p.userId, p);
    for (const a of S.activities) await h.putRecord('activities', a.id, a.userId, a);
    for (const l of S.letters) await h.putRecord('letters', l.id, l.studentId, l);
    for (const a of S.attachments) await h.putRecord('attachments', a.studentId, a.studentId, a);
    for (const e of S.events) await h.putRecord('events', e.id, e.userId, e);
    for (const a of S.audit) await h.putRecord('audit', a.id, '', a);
    for (const r of S.reports) await h.putRecord('reports', r.id, '', r);
    await h.kvSet('permissions', S.permissions);
  });
}

/* A real (online) site starts empty: no sample people. The first administrator comes from ADMIN_EMAIL and ADMIN_PASSWORD. */
async function createFirstAdmin(h) {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(), password = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !password) {
    console.error('\nThe database is empty and there is no first administrator.\nSet ADMIN_EMAIL and ADMIN_PASSWORD (and ADMIN_NAME if you like), then start again.\n');
    process.exit(1);
  }
  const { passwordProblem } = require('./security');
  const problem = passwordProblem(password);
  if (problem) { console.error(`\nADMIN_PASSWORD is not strong enough: ${problem}\n`); process.exit(1); }
  await h.tx(async () => {
    await h.insertUser({ id: 'u-admin', role: 'admin', name: process.env.ADMIN_NAME || 'Administrator', title: 'Administrator', department: 'Registry office', email, active: true, createdLive: true }, hashPassword(password));
    await h.kvSet('permissions', SHARED.seed.permissions);
  });
  console.log(`First administrator created: ${email}`);
}

async function init({ demo }) {
  const adapter = DATABASE_URL ? postgresAdapter(DATABASE_URL) : sqliteAdapter();
  const h = makeHelpers(adapter);
  await adapter.schema();
  const count = (await h.db.prepare('SELECT COUNT(*) AS n FROM users').get()).n;
  if (process.argv.includes('--reset')) {
    if (!demo) { console.error('Refusing to wipe the database while DEMO_MODE=0.'); process.exit(1); }
    await seed(h); console.log('Database filled with sample data.');
  } else if (count === 0) {
    if (demo) { await seed(h); console.log('Database filled with sample data.'); }
    else await createFirstAdmin(h);
  }
  return h;
}

module.exports = { init, seed, makeHelpers, SHARED, DB_FILE, DATABASE_URL };
