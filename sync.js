/* Sync: the only way the website can change data (apart from the dedicated account endpoints in routes.js).
   The browser sends the items it changed. For EACH item this file checks who is asking and what they are
   allowed to change. Anything that breaks a rule is rejected and the whole request is rolled back.

   Things that can never be changed from the browser, by anyone: grades, school registry, passwords, other people's accounts. */
const { roleKey, can, visibleStudentIds, attachmentActive } = require('./scope');
const { SHARED } = require('./db');

class Rule extends Error { constructor(msg, status = 403) { super(msg); this.status = status; } }
const deny = (msg) => { throw new Rule(msg); };
const bad = (msg) => { throw new Rule(msg, 400); };

/* ---------- tiny validators ---------- */
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const str = (v, max, label, { required = false } = {}) => {
  if (v == null) v = '';
  if (typeof v !== 'string') bad(`${label} must be text.`);
  v = v.trim();
  if (required && !v) bad(`${label} is required.`);
  if (v.length > max) bad(`${label} is too long (most ${max} characters).`);
  return v;
};
const int = (v, min, max, label, { nullable = false } = {}) => {
  if (v == null || v === '') { if (nullable) return null; bad(`${label} is required.`); }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) bad(`${label} must be a whole number from ${min} to ${max}.`);
  return n;
};
const urlOrEmpty = (v, label) => {
  v = str(v, 500, label);
  if (v && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(v)) bad(`${label} must be a full web address starting with http:// or https://.`);
  return v;
};
const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysBetween = (isoDate) => Math.ceil((new Date(isoDate + 'T23:59:59').getTime() - Date.now()) / 86400000);

async function apply(h, session, changes) {
  const u = await h.getUser(session.userId), perms = session.perms;
  if (!u || !u.active) deny('Your account is not active.');
  if (!isObj(changes)) bad('Nothing to save.');
  const vis = await visibleStudentIds(h, u, perms);
  const ctx = { h, u, perms, vis, role: roleKey(u) };

  const handlers = { users, projects, activities, letters, assessments, attachments, events, audit, reports, permissions };
  Object.keys(changes).forEach(name => { if (!handlers[name]) bad(`You cannot change "${name}".`); });
  await h.tx(async () => {
    for (const name of Object.keys(changes)) await handlers[name](ctx, changes[name] || {});
  });
}

const upserts = (c) => (Array.isArray(c.upsert) ? c.upsert : []);
const deletes = (c) => (Array.isArray(c.delete) ? c.delete : []);
function mustHaveId(o) { if (!isObj(o) || !validId(o.id)) bad('An item has no valid id.'); }

/* ================= your own account (phone, profile, photo) ================= */
async function users({ h, u }, c) {
  if (deletes(c).length) deny('Accounts cannot be deleted. Ask an administrator to deactivate them.');
  for (const x of upserts(c)) {
    mustHaveId(x);
    if (x.id !== u.id) deny('You can only change your own profile.');
    const old = await h.getUser(u.id);
    // Only these fields may change. Every other field must still match what is stored.
    const protectedFields = ['role', 'staffRole', 'schoolId', 'email', 'name', 'prefix', 'title', 'department', 'unit', 'programme', 'year', 'active', 'teaches', 'createdLive'];
    protectedFields.forEach(f => { if (x[f] !== undefined && !sameJson(x[f], old[f])) deny(`You cannot change your ${f}.`); });
    const phone = x.phone === undefined ? old.phone : str(x.phone, 30, 'Phone');
    if (phone && !/^[+\d][\d\s-]{6,}$/.test(phone)) bad('Enter a phone number such as +263 77 123 4567.');
    let profile = old.profile;
    if (x.profile !== undefined) {
      if (u.role !== 'student') deny('Only students have a portfolio profile.');
      const p = x.profile || {};
      const skills = Array.isArray(p.skills) ? p.skills.slice(0, 12).map(s => str(s, 40, 'Skill')).filter(Boolean) : [];
      profile = { bio: str(p.bio, 400, 'Bio'), skills, linkedin: str(p.linkedin, 200, 'LinkedIn'), github: str(p.github, 200, 'GitHub') };
    }
    let photo = old.photo;
    if (x.photo !== undefined) {
      if (x.photo !== null && !(typeof x.photo === 'string' && /^data:image\/(jpeg|png);base64,/.test(x.photo) && x.photo.length < 200000)) bad('That photo is not a small JPEG or PNG picture.');
      photo = x.photo;
    }
    await h.db.prepare('UPDATE users SET phone = ?, profile = ?, photo = ? WHERE id = ?').run(phone, profile ? JSON.stringify(profile) : null, photo, u.id);
  }
}

/* ================= projects ================= */
const PROJECT_FIELDS = ['name', 'kind', 'team', 'goal', 'challenge', 'role', 'result', 'liveUrl', 'codeUrl'];
async function projects({ h, u, perms, vis, role }, c) {
  if (u.role === 'student') {
    if (!can(perms, u, 'edit_profile')) deny('Editing projects is switched off for students.');
    for (const x of upserts(c)) {
      mustHaveId(x);
      const old = await h.getRecord('projects', x.id);
      if (old && old.userId !== u.id) deny('That project belongs to someone else.');
      if (!old && (await h.hasRecord('projects', x.id))) deny('That id is already used.');
      const rec = {
        id: x.id, userId: u.id, comments: old ? old.comments : [],            // students can never edit comments
        name: str(x.name, 120, 'Project name', { required: true }),
        kind: str(x.kind, 40, 'Project type'), team: str(x.team, 40, 'Team'),
        goal: str(x.goal, 1000, 'Goal'), challenge: str(x.challenge, 1500, 'Challenge'), role: str(x.role, 1000, 'Role'), result: str(x.result, 600, 'Result'),
        liveUrl: urlOrEmpty(x.liveUrl, 'The live link'), codeUrl: urlOrEmpty(x.codeUrl, 'The code link'),
      };
      await h.putRecord('projects', rec.id, u.id, rec);
    }
    for (const id of deletes(c)) { const old = await h.getRecord('projects', id); if (!old) continue; if (old.userId !== u.id) deny('That project belongs to someone else.'); await h.deleteRecord('projects', id); }
    return;
  }
  // Staff may only add comments to projects of students they can see.
  if (deletes(c).length) deny('You cannot delete projects.');
  for (const x of upserts(c)) {
    mustHaveId(x);
    const old = await h.getRecord('projects', x.id);
    if (!old) deny('You cannot create projects.');
    if (!vis.has(old.userId)) deny('You cannot open that student.');
    PROJECT_FIELDS.forEach(f => { if (x[f] !== undefined && x[f] !== old[f]) deny('You can only comment on projects, not change them.'); });
    old.comments = mergeComments(old.comments, x.comments, u, can(perms, u, 'comment_rate'));
    await h.putRecord('projects', old.id, old.userId, old);
  }
}
/* Comments are append-only: old ones must stay exactly the same, new ones must be written by the person asking. */
function mergeComments(oldList, newList, u, allowed) {
  oldList = oldList || [];
  if (newList === undefined || sameJson(newList, oldList)) return oldList;
  if (!allowed) deny('Commenting is switched off for your role.');
  if (!Array.isArray(newList) || newList.length <= oldList.length || !sameJson(newList.slice(0, oldList.length), oldList)) deny('Comments cannot be edited or removed.');
  const added = newList.slice(oldList.length).map(cm => {
    if (!isObj(cm) || cm.by !== u.id) deny('A comment must be written by you.');
    return { by: u.id, text: str(cm.text, 1000, 'Comment', { required: true }), ts: new Date().toISOString() };
  });
  return oldList.concat(added);
}

/* ================= activities (achievements, leadership, extracurricular) ================= */
const TYPES = ['achievement', 'leadership', 'extra'];
async function activities({ h, u, perms, vis }, c) {
  if (u.role === 'student') {
    if (!can(perms, u, 'add_activities')) deny('Adding activities is switched off for students.');
    for (const x of upserts(c)) {
      mustHaveId(x);
      const old = await h.getRecord('activities', x.id);
      if (old && old.userId !== u.id) deny('That entry belongs to someone else.');
      if (!old && (await h.hasRecord('activities', x.id))) deny('That id is already used.');
      if (x.status !== 'waiting') deny('Students cannot verify their own entries.');   // the rule from the Permissions screen
      let cert = old ? old.certificate : null;
      if (x.certificate !== undefined && !sameJson(x.certificate, cert)) {
        const k = x.certificate;
        if (k !== null) {
          if (!isObj(k)) bad('Bad certificate.');
          if (k.data != null && !(typeof k.data === 'string' && /^data:(image\/(jpeg|png|gif|webp)|application\/pdf);base64,/.test(k.data) && k.data.length < 400000)) bad('That certificate must be a small picture or PDF.');
          cert = { name: str(k.name, 120, 'File name'), data: k.data || null, ...(k.note ? { note: str(k.note, 80, 'Note') } : {}) };
        } else cert = null;
      }
      const rec = {
        id: x.id, userId: u.id, comments: old ? old.comments : [],
        type: TYPES.includes(x.type) ? x.type : bad('Choose a valid kind of entry.'),
        year: int(x.year, 1, 4, 'Year'), title: str(x.title, 200, 'Name', { required: true }), detail: str(x.detail, 300, 'Details'),
        status: 'waiting', createdAt: old ? old.createdAt : new Date().toISOString(), certificate: cert,
        verifiedBy: null, updated: !!old, evidenceNote: '',
      };
      await h.putRecord('activities', rec.id, u.id, rec);
    }
    for (const id of deletes(c)) { const old = await h.getRecord('activities', id); if (!old) continue; if (old.userId !== u.id) deny('That entry belongs to someone else.'); await h.deleteRecord('activities', id); }
    return;
  }
  if (deletes(c).length) deny('You cannot delete entries.');
  for (const x of upserts(c)) {
    mustHaveId(x);
    const old = await h.getRecord('activities', x.id);
    if (!old) deny('You cannot create entries for students.');
    if (!vis.has(old.userId)) deny('You cannot open that student.');
    ['type', 'year', 'title', 'detail', 'createdAt', 'userId'].forEach(f => { if (x[f] !== undefined && !sameJson(x[f], old[f])) deny('You cannot change what the student wrote.'); });
    if (x.certificate !== undefined && !sameJson(x.certificate, old.certificate)) deny('You cannot change the student\'s certificate.');
    if (x.status !== undefined && x.status !== old.status) {
      if (!can(perms, u, 'verify')) deny('Checking entries is switched off for your role.');
      if (x.status === 'verified') { old.status = 'verified'; old.verifiedBy = u.id; old.evidenceNote = ''; old.updated = false; }
      else if (x.status === 'evidence' && old.status === 'waiting') { old.status = 'evidence'; old.evidenceNote = str(x.evidenceNote, 500, 'Evidence request', { required: true }); }
      else deny('That change is not allowed.');
    }
    old.comments = mergeComments(old.comments, x.comments, u, can(perms, u, 'comment_rate'));
    await h.putRecord('activities', old.id, old.userId, old);
  }
}

/* ================= letters ================= */
const PURPOSES = ['Job application', 'Scholarship', 'Internship', 'Further study', 'Standard reference'];
async function letters({ h, u, perms }, c) {
  if (deletes(c).length) deny('Letters cannot be deleted.');
  for (const x of upserts(c)) {
    mustHaveId(x);
    const old = await h.getRecord('letters', x.id);
    if (u.role === 'student') { await studentLetter(h, u, perms, x, old); continue; }
    if (u.role === 'staff') { await staffLetter(h, u, perms, x, old); continue; }
    deny('You cannot change letters.');
  }
}
async function studentLetter(h, u, perms, x, old) {
  if (!old) {                                                    // a new request
    if (!can(perms, u, 'ask_letter')) deny('Asking for letters is switched off for students.');
    const staff = await h.getUser(x.staffId);
    if (!staff || staff.role !== 'staff' || !staff.active) bad('Choose a staff member to ask.');
    if (!PURPOSES.includes(x.purpose)) bad('Choose what the letter is for.');
    if (typeof x.due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.due) || x.due < todayIso()) bad('Choose a due date in the future.');
    const s = isObj(x.share) ? x.share : {};
    const rec = { id: x.id, studentId: u.id, staffId: staff.id, purpose: x.purpose, due: x.due, message: str(x.message, 1000, 'Message'),
      share: { grades: !!s.grades, achievements: !!s.achievements, leadership: !!s.leadership, extracurricular: !!s.extracurricular },
      status: 'new', createdAt: new Date().toISOString(), changesUsed: 0, changeRequests: [], draft: '', versions: [] };
    return await h.putRecord('letters', rec.id, u.id, rec);
  }
  if (old.studentId !== u.id) deny('That letter belongs to someone else.');
  // Only one change is allowed on an existing letter: ask for changes (ready -> changes), at most twice.
  const fixed = ['studentId', 'staffId', 'purpose', 'due', 'message', 'share', 'createdAt', 'draft', 'versions', 'declineReason'];
  fixed.forEach(f => { if (x[f] !== undefined && !sameJson(x[f], old[f])) deny('You cannot change that part of a letter.'); });
  if (x.status === old.status && sameJson(x.changeRequests, old.changeRequests)) return;
  if (old.status !== 'ready' || x.status !== 'changes') deny('You can only ask for changes to a finished letter.');
  if (old.changesUsed >= 2) deny('You have used both changes for this letter.');
  const text = str(x.changeRequests && x.changeRequests[old.changeRequests.length] && x.changeRequests[old.changeRequests.length].text, 600, 'Your message', { required: true });
  old.changesUsed += 1; old.status = 'changes';
  old.changeRequests = old.changeRequests.concat([{ n: old.changesUsed, text, ts: new Date().toISOString() }]);
  await h.putRecord('letters', old.id, old.studentId, old);
}
async function staffLetter(h, u, perms, x, old) {
  if (!old) deny('Only students can start a letter request.');
  if (old.staffId !== u.id) deny('That letter is assigned to someone else.');
  if (!can(perms, u, 'write_letters')) deny('Writing letters is switched off for your role.');
  ['studentId', 'staffId', 'purpose', 'due', 'message', 'share', 'createdAt', 'changesUsed', 'changeRequests'].forEach(f => { if (x[f] !== undefined && !sameJson(x[f], old[f])) deny('You cannot change that part of a letter.'); });
  const from = old.status, to = x.status === undefined ? from : x.status;
  if (to !== from) {
    if (from === 'new' && to === 'progress') old.status = 'progress';                                   // Accept
    else if (from === 'new' && to === 'declined') { old.status = 'declined'; old.declineReason = str(x.declineReason, 500, 'The reason', { required: true }); }   // Decline needs a reason
    else if ((from === 'progress' || from === 'changes') && to === 'ready') {                              // Sign and send
      const list = Array.isArray(x.versions) ? x.versions : [];
      if (list.length !== old.versions.length + 1 || !sameJson(list.slice(0, old.versions.length), old.versions)) deny('Send exactly one new version.');
      const text = str(list[list.length - 1].text, 20000, 'The letter', { required: true });
      if (/\[[^\]]*\]/.test(text)) bad('Replace the placeholders in [brackets] with real details before sending.');
      old.versions = old.versions.concat([{ n: old.versions.length + 1, text, sentAt: new Date().toISOString() }]);
      old.status = 'ready'; old.draft = '';
    } else deny('That change is not allowed.');
  } else if (x.draft !== undefined && (from === 'progress' || from === 'changes')) {
    old.draft = str(x.draft, 20000, 'Draft');
  } else if (x.versions !== undefined && !sameJson(x.versions, old.versions)) deny('Versions cannot be changed.');
  await h.putRecord('letters', old.id, old.studentId, old);
}

/* ================= staff assessments ================= */
async function assessments({ h, u, perms, vis }, c) {
  if (deletes(c).length) deny('Assessments cannot be deleted.');
  for (const x of upserts(c)) {
    mustHaveId(x);
    if (u.role !== 'staff' || !can(perms, u, 'comment_rate')) deny('Rating students is not allowed for your role.');
    if (!vis.has(x.studentId)) deny('You cannot open that student.');
    const old = await h.getRecord('assessments', x.id);
    if (old && (old.staffId !== u.id || old.studentId !== x.studentId)) deny('That assessment belongs to someone else.');
    const rec = { id: x.id, studentId: x.studentId, staffId: u.id, leadership: int(x.leadership, 1, 5, 'Leadership', { nullable: true }), teamwork: int(x.teamwork, 1, 5, 'Teamwork', { nullable: true }),
      communication: int(x.communication, 1, 5, 'Communication', { nullable: true }), feedback: str(x.feedback, 2000, 'Feedback'), ts: new Date().toISOString() };
    if (!rec.leadership && !rec.teamwork && !rec.communication && !rec.feedback) bad('Give at least one rating or write some feedback.');
    await h.putRecord('assessments', rec.id, rec.studentId, rec);
  }
}

/* ================= supervisor progress notes and final report ================= */
async function attachments({ h, u, perms }, c) {
  if (deletes(c).length) deny('Attachments cannot be deleted.');
  for (const x of upserts(c)) {
    if (!isObj(x) || !validId(x.studentId)) bad('Bad attachment.');
    const old = await h.getRecord('attachments', x.studentId);
    if (!old) deny('There is no attachment for that student.');
    if (u.role !== 'supervisor' || old.supervisorId !== u.id) deny('Only the linked supervisor can write progress notes.');
    if (!attachmentActive(old)) deny('That attachment has ended.');
    if (!can(perms, u, 'progress_notes')) deny('Writing progress notes is switched off for your role.');
    ['supervisorId', 'company', 'weeks', 'start', 'end'].forEach(f => { if (x[f] !== undefined && x[f] !== old[f]) deny('You cannot change the attachment details.'); });
    const week = Math.min(old.weeks, Math.max(1, Math.floor((Date.now() - new Date(old.start + 'T00:00:00').getTime()) / 86400000 / 7) + 1));
    if (Array.isArray(x.notes) && !sameJson(x.notes, old.notes)) {
      const others = old.notes.filter(n => n.week !== week);
      const newOthers = x.notes.filter(n => n.week !== week);
      if (!sameJson(others, newOthers)) deny('You can only write the note for the current week.');
      const cur = x.notes.find(n => n.week === week);
      if (cur) {
        const r = cur.ratings || {};
        const note = { week, text: str(cur.text, 2000, 'Note'), ratings: { punctuality: int(r.punctuality, 1, 5, 'Punctuality', { nullable: true }), quality: int(r.quality, 1, 5, 'Quality of work', { nullable: true }), teamwork: int(r.teamwork, 1, 5, 'Teamwork', { nullable: true }) }, ts: new Date().toISOString() };
        if (!note.text && !note.ratings.punctuality && !note.ratings.quality && !note.ratings.teamwork) bad('Give at least one rating or write a note.');
        old.notes = others.concat([note]).sort((a, b) => a.week - b.week);
      }
    }
    if (x.report !== undefined && !sameJson(x.report, old.report)) {
      const r = x.report;
      if (r === null || !isObj(r)) bad('Bad report.');
      old.report = { overall: int(r.overall, 1, 5, 'Overall rating'), summary: str(r.summary, 4000, 'Summary', { required: true }), recommend: ['Yes', 'Yes, with some more experience', 'Not yet'].includes(r.recommend) ? r.recommend : bad('Choose a recommendation.'), ts: new Date().toISOString() };
    }
    await h.putRecord('attachments', old.studentId, old.studentId, old);
  }
}

/* ================= events (the "Recent updates" list) and audit log: append only ================= */
const EVENT_KINDS = ['verified', 'waiting', 'letter', 'comment', 'assessment', 'evidence', 'note'];
async function events({ h, u, vis }, c) {
  if (deletes(c).length) deny('Updates cannot be deleted.');
  for (const x of upserts(c)) {
    mustHaveId(x);
    if ((await h.hasRecord('events', x.id))) deny('Updates cannot be changed.');
    if (!EVENT_KINDS.includes(x.kind)) bad('Bad update kind.');
    if (!(u.id === x.userId || vis.has(x.userId))) deny('You cannot send updates to that student.');
    const rec = { id: x.id, userId: x.userId, kind: x.kind, text: str(x.text, 300, 'Text', { required: true }), ts: new Date().toISOString(), ref: x.ref ? str(x.ref, 64, 'Ref') : null };
    await h.putRecord('events', rec.id, rec.userId, rec);
  }
}
async function audit({ h, u }, c) {
  if (deletes(c).length) deny('The log cannot be edited.');
  for (const x of upserts(c)) {
    mustHaveId(x);
    if ((await h.hasRecord('audit', x.id))) deny('The log cannot be edited.');
    const rec = { id: x.id, text: str(x.text, 300, 'Text', { required: true }), ts: new Date().toISOString(), by: u.name };   // "who" is always the signed-in person, never what the browser says
    if (x.perm && u.role === 'admin') rec.perm = true;
    await h.putRecord('audit', rec.id, '', rec);
  }
}

/* ================= reports (admin) ================= */
async function reports({ h, u, perms }, c) {
  if (deletes(c).length) deny('Reports cannot be deleted.');
  for (const x of upserts(c)) {
    mustHaveId(x);
    if (u.role !== 'admin' || !can(perms, u, 'dashboard')) deny('Only administrators can export reports.');
    if ((await h.hasRecord('reports', x.id))) deny('Reports cannot be changed.');
    const types = ['progress', 'completion', 'compliance', 'letters'], formats = ['pdf', 'excel', 'csv'];
    const inc = isObj(x.include) ? x.include : {};
    const rec = { id: x.id, name: str(x.name, 120, 'Name', { required: true }), type: types.includes(x.type) ? x.type : bad('Bad report type.'), group: str(x.group, 30, 'Group'), period: str(x.period, 10, 'Period'),
      include: { grades: !!inc.grades, credits: !!inc.credits, activities: !!inc.activities, compliance: !!inc.compliance }, format: formats.includes(x.format) ? x.format : bad('Bad format.'), ts: new Date().toISOString() };
    if (!Object.values(rec.include).some(Boolean)) bad('Choose at least one thing to include.');
    await h.putRecord('reports', rec.id, '', rec);
  }
}

/* ================= permission matrix (admin) ================= */
async function permissions({ h, u, perms }, c) {
  if (u.role !== 'admin' || !can(perms, u, 'change_perms')) deny('Only administrators can change permissions.');
  const next = c.value;
  if (!isObj(next)) bad('Bad permissions.');
  const { PERM_ROWS, PERM_ROLES } = SHARED;
  const out = {};
  PERM_ROWS.forEach(r => {
    if (!r.key) return;
    if (!isObj(next[r.key])) bad('Permissions are incomplete.');
    out[r.key] = {};
    PERM_ROLES.forEach(([role]) => {
      const fixed = r.v[role], val = next[r.key][role];
      if (fixed === 'L1' || fixed === 'L0') {                                  // locked by the school's rules
        if (val !== (fixed === 'L1')) deny(`That setting is fixed by the school: ${r.label}.`);
        out[r.key][role] = fixed === 'L1';
      } else if (fixed === null) out[r.key][role] = null;
      else { if (typeof val !== 'boolean') bad('Permissions must be on or off.'); out[r.key][role] = val; }
    });
  });
  await h.kvSet('permissions', out);
}

module.exports = { apply, Rule };
