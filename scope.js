/* Scope: who may see what.  Every request to /api/bootstrap passes through here, so a signed-in person
   only ever receives the data their role is allowed to see. The browser never has the rest. */

const roleKey = (u) => (u.role === 'staff' ? u.staffRole : u.role);          // student | teacher | lecturer | supervisor | admin
const can = (perms, u, key) => !!(perms && perms[key] && perms[key][roleKey(u)] === true);

const attachmentActive = (att) => new Date(att.end + 'T23:59:59').getTime() >= Date.now();

/* Keep only the ids of accounts that exist and are active. */
async function activeOnly(h, ids) {
  const out = [];
  for (const id of ids) { const s = await h.getUser(id); if (s && s.active) out.push(id); }
  return out;
}

/* Set of student ids that this person may open. */
async function visibleStudentIds(h, u, perms) {
  if (u.role === 'student') return new Set([u.id]);
  if (u.role === 'admin') return new Set((await h.allUsers()).filter(x => x.role === 'student').map(x => x.id));
  if (u.role === 'staff') {
    if (can(perms, u, 'view_all')) return new Set((await h.allUsers()).filter(x => x.role === 'student' && x.active).map(x => x.id));
    return new Set(await activeOnly(h, u.teaches || []));
  }
  if (u.role === 'supervisor') {                                              // only linked students, only while the attachment runs
    const mine = (await h.allRecords('attachments')).filter(a => a.supervisorId === u.id && attachmentActive(a)).map(a => a.studentId);
    return new Set(await activeOnly(h, mine));
  }
  return new Set();
}

/* A user object that is safe to send: no password hash. Admins also learn if an account still needs a password. */
const publicUser = (x, asAdmin) => {
  const { hasPassword, ...rest } = x;
  if (asAdmin) rest.password = hasPassword ? 'set' : null;
  return rest;
};
/* Staff, supervisors and admins show up by name next to letters, notes and comments, so everyone gets a short directory. */
const directoryEntry = (x) => ({ id: x.id, role: x.role, staffRole: x.staffRole, name: x.name, prefix: x.prefix, title: x.title, department: x.department, unit: x.unit, photo: x.photo, active: x.active, email: '' });

async function bootstrap(h, u, perms) {
  const isAdmin = u.role === 'admin';
  const vis = await visibleStudentIds(h, u, perms);
  const all = await h.allUsers();
  const users = [];
  all.forEach(x => {
    if (isAdmin) users.push(publicUser(x, true));
    else if (x.id === u.id || (x.role === 'student' && vis.has(x.id))) users.push(publicUser(x, false));
    else if (x.role !== 'student') users.push(directoryEntry(x));
  });

  const pick = async (collection, fn) => (await h.allRecords(collection)).filter(fn);
  const state = {
    users,
    grades: {}, projects: [], activities: [], letters: [], assessments: [], attachments: [], events: [],
    audit: [], reports: [], registry: [], signups: [],
  };
  for (const id of vis) { const g = await h.getRecord('grades', id); if (g) state.grades[id] = g; }
  state.projects = await pick('projects', p => vis.has(p.userId));
  state.activities = await pick('activities', a => vis.has(a.userId));

  if (u.role === 'student') {
    state.letters = await pick('letters', l => l.studentId === u.id);
    state.assessments = await pick('assessments', a => a.studentId === u.id);
    state.attachments = await pick('attachments', a => a.studentId === u.id);
    state.events = await pick('events', e => e.userId === u.id);
  } else if (u.role === 'staff') {
    state.letters = await pick('letters', l => l.staffId === u.id);
    state.assessments = await pick('assessments', a => a.staffId === u.id);
    state.attachments = await pick('attachments', a => vis.has(a.studentId));      // lecturers can read progress notes of their students
  } else if (u.role === 'supervisor') {
    state.attachments = await pick('attachments', a => a.supervisorId === u.id && attachmentActive(a));
  } else if (isAdmin) {
    state.letters = await h.allRecords('letters');
    state.assessments = await h.allRecords('assessments');
    state.attachments = await h.allRecords('attachments');
    state.audit = await h.allRecords('audit');
    state.reports = await h.allRecords('reports');
    state.registry = (await h.db.prepare(`SELECT * FROM registry ORDER BY ${h.ORD}`).all()).map(r => ({ schoolId: r.school_id, name: r.name, email: r.email, programme: r.programme, year: r.year }));
    state.signups = (await h.db.prepare(`SELECT * FROM signups ORDER BY ${h.ORD}`).all()).map(s => ({ id: s.id, schoolId: s.school_id, name: s.name, email: s.email, registryEmail: s.registry_email, phone: s.phone, status: s.status, note: s.note, ts: s.ts }));
  }
  state.permissions = isAdmin ? await h.kvGet('permissions') : {};
  return state;
}

module.exports = { roleKey, can, visibleStudentIds, attachmentActive, bootstrap, publicUser };
