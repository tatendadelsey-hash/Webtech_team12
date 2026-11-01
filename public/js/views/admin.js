/* Administrator screens: home, people, permissions, reports. */

const AV = Views.admin;
const wrapA = (user, active, inner) => Views.shell.wrap(user, active, inner);

AV.pending = () => Store.state.signups.filter(s => s.status === 'match' || s.status === 'mismatch');
AV.live = () => ({
  newUsers: Store.state.users.filter(u => u.createdLive),
  oldEntries: Store.state.activities.filter(a => a.status === 'waiting' && (Date.now() - new Date(a.createdAt).getTime()) > 30 * 86400000),
  overdue: Store.state.letters.filter(l => ['new', 'progress', 'changes'].includes(l.status) && UI.daysUntil(l.due) < 0),
});

/* On a real site the figures come from the real records. In demo mode they are the sample school figures. */
AV.real = () => {
  const users = Store.state.users, students = users.filter(u => u.role === 'student');
  const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const complete = (s) => ['achievement', 'leadership', 'extra'].every(t => Q.acts(s.id).some(a => a.type === t));
  const byYear = [1, 2, 3, 4].map(y => students.filter(s => s.year === y));
  const week = Date.now() - 30 * 86400000;
  return {
    people: users.length, students: students.length, staff: users.filter(u => u.role === 'staff' || u.role === 'supervisor').length,
    completed: students.length ? Math.round(students.filter(complete).length / students.length * 100) : 0,
    entriesOver30: 0, lettersOverdue: 0,
    gpa: byYear.map(g => mean(g.map(s => Calc.overall(s.id)).filter(v => v != null))),
    done: byYear.map(g => g.length ? Math.round(g.filter(complete).length / g.length * 100) : 0),
    credits: byYear.map(g => mean(g.map(s => Calc.credits(s.id)))),
    entries: byYear.map(g => mean(g.map(s => Q.acts(s.id).length))),
  };
};
AV.stats = (period) => CONFIG.demoMode ? SCHOOL_BASELINE[period] : AV.real();

/* =================== HOME =================== */
AV.home = ({ user }) => {
  const st = UI.state('adm', { year: CONFIG.academicYears[0] });
  const B = AV.stats(st.year), L = AV.live();
  const demo = CONFIG.demoMode;
  const newStudents = demo ? L.newUsers.filter(u => u.role === 'student').length : 0, newStaff = demo ? L.newUsers.length - newStudents : 0;
  const pend = AV.pending().length;
  const audit = Store.state.audit.slice().sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 4);
  const bars = (vals, fmt) => `<div class="bars">${vals.map((v, i) => `<div class="bar-row ${i === 3 ? 'hl' : ''}"><span class="muted">Year ${i + 1}</span><div class="track"><i style="width:${fmt.pct(v)}%"></i></div><b>${fmt.label(v)}</b></div>`).join('')}</div>`;
  return wrapA(user, '', `
    <div class="row between" style="margin-bottom:14px;align-items:flex-start"><div class="hero" style="margin:0">${UI.avatarEditable(user)}<div><h1>Hello, ${esc(user.name)}</h1><p class="muted">${esc(user.department)}</p></div></div>
      ${demo ? `<label class="sr-only" for="adm-year">Academic year</label><select class="input" id="adm-year" style="width:auto;margin:0" data-change="admYear">${CONFIG.academicYears.map(y => `<option ${y === st.year ? 'selected' : ''} value="${y}">Academic year: ${y}</option>`).join('')}</select>` : ''}</div>
    <div class="grid g4 stats-row" style="margin-bottom:6px">
      <div class="stat"><div class="lbl">People with accounts</div><div class="num">${(B.people + (demo ? L.newUsers.length : 0)).toLocaleString('en-GB')}</div></div>
      <div class="stat"><div class="lbl">Students</div><div class="num">${(B.students + newStudents).toLocaleString('en-GB')}</div></div>
      <div class="stat"><div class="lbl">Staff</div><div class="num">${(B.staff + newStaff).toLocaleString('en-GB')}</div></div>
      <div class="stat"><div class="lbl">Portfolios completed</div><div class="num">${B.completed}%</div><div class="progress" style="margin-top:6px"><i style="width:${B.completed}%"></i></div></div>
    </div>
    <p class="muted small" style="margin-bottom:18px">A portfolio is complete when it has at least one entry in each section.</p>
    <h2 style="margin-bottom:8px">Needs your attention</h2>
    <div class="card" style="margin-bottom:18px"><div class="list">
      <div class="item"><span class="status bad">●</span><div class="grow"><b>${pend} new sign-up${pend === 1 ? ' is' : 's are'}</b> waiting for you to approve ${pend === 1 ? 'it' : 'them'}</div><a class="btn small" href="#/admin/people" data-native="1" data-act="gotoWaiting">Review sign-ups</a></div>
      <div class="item"><span class="status wait">●</span><div class="grow"><b>${B.entriesOver30 + L.oldEntries.length} student ${B.entriesOver30 + L.oldEntries.length === 1 ? 'entry has' : 'entries have'}</b> waited over 30 days to be checked</div><button class="btn small" data-act="seeEntries">See entries</button></div>
      <div class="item"><span class="status wait">●</span><div class="grow"><b>${B.lettersOverdue + L.overdue.length} letter request${B.lettersOverdue + L.overdue.length === 1 ? ' is' : 's are'}</b> past the due date</div><button class="btn small" data-act="seeRequests">See requests</button></div></div></div>
    <div class="grid g2" style="margin-bottom:18px;align-items:start">
      <div class="card"><h3>Average overall GPA</h3><p class="muted small">By year group, out of 4.0</p>${bars(B.gpa, { pct: v => v / 4 * 100, label: v => v ? v.toFixed(2) : '–' })}</div>
      <div class="card"><h3>Portfolios completed</h3><p class="muted small">By year group</p>${bars(B.done, { pct: v => v, label: v => v + '%' })}</div></div>
    <div class="card"><h3>Recent activity</h3><div class="list" style="margin-top:6px">${audit.map(a => `<div class="item"><div class="grow">${esc(a.text)}</div><span class="muted small">${UI.fmtWhen(a.ts)}</span></div>`).join('')}</div></div>
    ${demo ? '<p class="muted xs" style="margin-top:10px">School-wide totals are sample figures for the demo, plus any accounts created while you try it.</p>' : ''}
  `);
};
UI.onChange('admYear', el => { UI.state('adm').year = el.value; UI.render(); });
UI.on('gotoWaiting', () => { UI.state('ppl', { adding: false }).scrollWaiting = true; UI.go('/admin/people'); });
UI.on('seeEntries', () => {
  const L = Store.state.activities.filter(a => a.status === 'waiting').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  UI.modal(`<h2>Entries waiting to be checked</h2><p class="muted small" style="margin:3px 0 10px">Oldest first.</p>
    <div class="list">${L.map(a => { const s = Store.user(a.userId), days = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 86400000); return `<div class="item"><div class="grow"><b>${esc(a.title)}</b><div class="muted small">${esc(s.name)} · ${esc(Names.typeShort[a.type])}</div></div><span class="small ${days > 30 ? 'bad' : 'muted'}">${days} day${days === 1 ? '' : 's'}</span></div>`; }).join('') || '<p class="muted">Nothing is waiting.</p>'}</div>
    <div style="margin-top:14px"><button class="btn" data-act="closeModal">Close</button></div>`, { noFocus: true });
});
UI.on('seeRequests', () => {
  const L = Store.state.letters.filter(l => ['new', 'progress', 'changes'].includes(l.status)).sort((a, b) => a.due.localeCompare(b.due));
  UI.modal(`<h2>Open letter requests</h2><p class="muted small" style="margin:3px 0 10px">Requests that are not finished yet, by due date. Overdue ones are marked.</p>
    <div class="list">${L.map(l => `<div class="item"><div class="grow"><b>${esc(Store.user(l.studentId).name)}</b> · ${esc(l.purpose)}<div class="muted small">Writer: ${esc(Names.staff(Store.user(l.staffId)))}</div></div><span class="small">${UI.dueLabel(l.due)}</span></div>`).join('') || '<p class="muted">No open requests.</p>'}</div>
    <div style="margin-top:14px"><button class="btn" data-act="closeModal">Close</button></div>`, { noFocus: true });
});

/* =================== PEOPLE =================== */
AV.personLine = (u) => u.role === 'student' ? `Student · ${esc(u.schoolId)}`
  : u.role === 'staff' ? `${esc(u.title)} · ${esc(u.department)} · ${esc(u.email)}`
  : u.role === 'supervisor' ? `Supervisor · ${esc(u.department)} · ${esc(u.email)}`
  : `Administrator · ${esc(u.department)}`;

AV.people = ({ user }) => {
  const st = UI.state('ppl', { adding: false, q: '', role: 'all', status: 'all', showAllPending: false, more: false, newRole: 'Supervisor', scrollWaiting: false });
  const pend = AV.pending(), asked = Store.state.signups.filter(s => s.status === 'correction');
  const q = st.q.trim().toLowerCase();
  const everyone = Store.state.users.filter(u => {
    const roleName = u.role === 'staff' ? u.staffRole : u.role;
    const st2 = !u.active ? 'deactivated' : u.password == null ? 'invited' : 'active';
    return (st.role === 'all' || roleName === st.role || (st.role === 'staff' && u.role === 'staff')) && (st.status === 'all' || st.status === st2)
      && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.schoolId || '').toLowerCase().includes(q));
  }).sort((a, b) => ({ admin: 0, staff: 1, supervisor: 2, student: 3 }[a.role] - { admin: 0, staff: 1, supervisor: 2, student: 3 }[b.role]) || a.name.localeCompare(b.name));
  const shown = st.more ? everyone : everyone.slice(0, 8);
  const pshown = st.showAllPending ? pend : pend.slice(0, 4);
  if (st.scrollWaiting) { st.scrollWaiting = false; UI.after(() => { const el = $('#waiting'); if (el) el.scrollIntoView({ block: 'start' }); }); }

  const free = Store.students().filter(s => s.active);
  const linked = new Set(Store.state.attachments.filter(a => Q.attachmentActive(a)).map(a => a.studentId));
  const isSup = st.newRole === 'Supervisor';
  const addForm = st.adding ? `<form class="card" id="add-staff-form" data-submit="addStaff" novalidate style="margin-bottom:16px;background:#fbfbfd">
    <h3>Add staff or supervisor</h3>
    <div class="grid g2"><div><label class="field" for="as-name">Full name</label><input class="input" id="as-name" name="name" placeholder="Casey Brooks"></div>
      <div><label class="field" for="as-email">Work email</label><input class="input" id="as-email" name="email" type="email" placeholder="casey.brooks@acme.example"></div>
      <div><label class="field" for="as-role">Role</label><select class="input" id="as-role" name="role" data-change="newRole">${['Teacher', 'Lecturer', 'Supervisor'].map(r => `<option ${r === st.newRole ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div><label class="field" for="as-dept">${isSup ? 'Company' : 'Department'}</label><input class="input" id="as-dept" name="dept" placeholder="${isSup ? 'Acme Ltd' : 'Computing'}"></div></div>
    <div class="field" style="margin-top:14px">${isSup ? 'Students they supervise' : 'Students they teach'} <span class="opt" id="sel-count"></span></div>
    <div class="card" style="max-height:170px;overflow:auto;padding:8px 12px;margin-top:5px">${free.map(s => { const dis = isSup && linked.has(s.id); return `<label class="check" style="margin-top:4px"><input type="checkbox" name="stu_${s.id}" data-change="selCount" ${dis ? 'disabled' : ''}> ${esc(s.name)} <span class="muted xs">${esc(s.schoolId)}${dis ? ' · already on an attachment' : ''}</span></label>`; }).join('')}</div>
    ${isSup ? `<div class="grid g2"><div><label class="field" for="as-start">Attachment starts</label><input class="input" id="as-start" name="start" type="date" value="${UI.today()}"></div><div><label class="field" for="as-weeks">Length in weeks</label><input class="input" id="as-weeks" name="weeks" type="number" min="1" max="52" value="12"></div></div><p class="hint">They only see the students you link here, and only while the attachment runs.</p>` : ''}
    <p class="hint">They'll get an email with a link to set their own password.</p>
    <div class="row" style="margin-top:12px"><button class="btn primary">Create account</button><button type="button" class="btn" data-act="cancelAdd">Cancel</button></div></form>` : '';

  return wrapA(user, '/people', `
    ${UI.crumbs([{ label: 'Home', href: '#/admin' }, { label: 'Users' }])}
    <div class="page-head"><div><h1>Users</h1><p>Create staff accounts, approve student sign-ups, and manage every account.</p></div>
      <div class="row"><button class="btn" data-act="importStudents">Import students from a file</button><button class="btn primary" data-act="addStaffOpen">Add staff or supervisor</button></div></div>
    ${addForm}
    <div class="card" id="waiting" style="margin-bottom:16px"><h3>Waiting for approval (${pend.length})</h3><p class="muted small">Students who signed up themselves. Check their details match school records.</p>
      <div class="list" style="margin-top:8px">${pshown.map(s => s.status === 'match'
        ? `<div class="item"><div class="grow"><b>${esc(s.name)}</b><div class="small good">✓ ${esc(s.schoolId)} · Details match school records</div></div><button class="btn primary small" data-act="approve" data-id="${s.id}">Approve</button><button class="btn small" data-act="reject" data-id="${s.id}">Reject</button></div>`
        : `<div class="item"><div class="grow"><b>${esc(s.name)}</b><div class="small warn">▲ ${esc(s.schoolId)} · Details don't match</div><div class="muted small">Records list ${esc(s.registryEmail)}, but they entered ${esc(s.email)}.</div></div><button class="btn small" data-act="askCorrect" data-id="${s.id}">Ask them to correct it</button><button class="btn small" data-act="reject" data-id="${s.id}">Reject</button></div>`).join('') || '<p class="muted small">No sign-ups are waiting.</p>'}
        ${asked.map(s => `<div class="item"><div class="grow"><b>${esc(s.name)}</b><div class="small muted">${esc(s.schoolId)} · Waiting for the student to correct their details</div></div><button class="btn small" data-act="reject" data-id="${s.id}">Reject</button></div>`).join('')}</div>
      ${pend.length > 4 ? `<button class="btn small" style="margin-top:8px" data-act="togglePending">${st.showAllPending ? 'Show fewer' : `Show all ${pend.length}`}</button>` : ''}</div>
    <div class="utabs" role="tablist">${[['all', 'All'], ['student', 'Students'], ['staff', 'Staff'], ['supervisor', 'Supervisors'], ['admin', 'Admins']].map(([k, l]) => `<button class="${st.role === k ? 'on' : ''}" data-act="pplTab" data-r="${k}">${l}</button>`).join('')}</div>
    <div class="row" style="flex-wrap:nowrap;margin:12px 0 10px"><input class="input" style="margin:0" type="search" placeholder="Search by name, email or school ID" aria-label="Search people" value="${esc(st.q)}" data-input="pplSearch" data-keep="ppl-q">
      <select class="input" style="width:auto;margin:0" data-change="pplStatus" aria-label="Filter by status">${[['all', 'All status'], ['active', 'Active'], ['invited', 'Invited'], ['deactivated', 'Deactivated']].map(([k, l]) => `<option value="${k}" ${st.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="card" style="padding:6px 16px 12px;overflow-x:auto">${shown.length ? `<table class="tbl"><thead><tr><th>Name</th><th>ID / email</th><th>Role</th><th>Status</th><th class="right">Actions</th></tr></thead><tbody>
      ${shown.map(u => `<tr><td><b>${esc(u.name)}</b></td><td class="muted small">${esc(u.schoolId || u.email)}</td><td>${u.role === 'staff' ? esc(u.title) : u.role === 'admin' ? 'Administrator' : u.role === 'supervisor' ? 'Supervisor' : 'Student'}</td>
        <td>${!u.active ? '<span class="badge b-er">Deactivated</span>' : u.password == null ? '<span class="badge b-in">Invited</span>' : '<span class="badge b-ok">Active</span>'}</td>
        <td class="right">${!u.active ? `<button class="btn small" data-act="toggleActive" data-id="${u.id}">Reactivate</button>`
          : u.password == null ? `<button class="btn small" data-act="showInvite" data-id="${u.id}">Invite link</button> <button class="btn small" data-act="toggleActive" data-id="${u.id}">Deactivate</button>`
          : `<button class="btn small" data-act="toggleActive" data-id="${u.id}" ${u.id === user.id ? 'disabled title="You cannot deactivate your own account"' : ''}>Deactivate</button>`}</td></tr>`).join('')}</tbody></table>` : `<p class="muted small" style="padding:12px 0">No one matches. Try a different search or filter.</p>`}
      <div class="row between" style="margin-top:10px"><p class="muted small">Showing ${shown.length} of ${everyone.length}. Accounts are deactivated, never deleted, so student records stay safe.</p>${everyone.length > 8 ? `<button class="btn small" data-act="toggleMore">${st.more ? 'Show fewer' : 'Show all'}</button>` : ''}</div></div>
  `);
};
UI.on('pplTab', el => { UI.state('ppl').role = el.dataset.r; UI.render(); });
UI.onInput('pplSearch', el => { UI.state('ppl').q = el.value; UI.render(); });
UI.onChange('pplRole', el => { UI.state('ppl').role = el.value; UI.render(); });
UI.onChange('pplStatus', el => { UI.state('ppl').status = el.value; UI.render(); });
UI.onChange('newRole', el => { UI.state('ppl').newRole = el.value; UI.render(); });
UI.onChange('selCount', el => { const f = el.closest('form'); const n = $$('input[type=checkbox]:checked', f).filter(c => c.name.startsWith('stu_')).length; $('#sel-count').textContent = n ? `(${n} selected)` : ''; });
UI.on('toggleMore', () => { const s = UI.state('ppl'); s.more = !s.more; UI.render(); });
UI.on('togglePending', () => { const s = UI.state('ppl'); s.showAllPending = !s.showAllPending; UI.render(); });
UI.on('addStaffOpen', () => { UI.state('ppl').adding = true; UI.clearDrafts('add-staff-form'); UI.render(); const f = $('#add-staff-form'); if (f) { f.scrollIntoView({ block: 'center' }); $('#as-name').focus(); } });
UI.on('cancelAdd', () => { UI.state('ppl').adding = false; UI.clearDrafts('add-staff-form'); UI.render(); });

UI.onSubmit('addStaff', async form => {
  const d = UI.formData(form), errs = {}, S = Store.state, st = UI.state('ppl');
  d.name = d.name.trim(); d.email = d.email.trim().toLowerCase(); d.dept = d.dept.trim();
  if (!d.name) errs.name = 'Enter their full name.';
  if (!/^\S+@\S+\.\S+$/.test(d.email)) errs.email = 'Enter a valid work email.';
  else if (S.users.some(u => u.email.toLowerCase() === d.email)) errs.email = 'An account with this email already exists.';
  if (!d.dept) errs.dept = d.role === 'Supervisor' ? 'Enter the company.' : 'Enter the department.';
  const picked = Object.keys(d).filter(k => k.startsWith('stu_') && d[k]).map(k => k.slice(4));
  if (d.role === 'Supervisor' && !picked.length) errs.role = 'Link at least one student below, or this supervisor will see nobody.';
  if (d.role === 'Supervisor') { const w = parseInt(d.weeks, 10); if (!d.start) errs.start = 'Choose the start date.'; if (!(w >= 1 && w <= 52)) errs.weeks = 'Enter a length between 1 and 52 weeks.'; }
  if (Object.keys(errs).length) return UI.showErrors(form, errs);

  let r;
  try { r = await API.post('/api/admin/staff', { name: d.name, email: d.email, role: d.role, dept: d.dept, students: picked, start: d.start, weeks: d.weeks }); }
  catch (e) { return UI.showErrors(form, { [e.field && form.elements[e.field] ? e.field : 'email']: e.message }); }
  await Store.bootstrap();
  st.adding = false; UI.clearDrafts('add-staff-form'); UI.render();
  AV.inviteModal({ name: r.name, email: r.email }, r.demoToken, r.emailed);
});
AV.inviteModal = (u, token, emailed) => UI.modal(`<h2>Account created for ${esc(u.name)}</h2>
  <p class="muted small" style="margin:4px 0 10px">${token || emailed ? `${esc(u.name)} will get an email at <b>${esc(u.email)}</b> with a link to set their own password.` : `Email is not set up on this server, so no message was sent to <b>${esc(u.email)}</b>. The set-password link was written to the server log (Render > Logs). Copy it from there and send it to ${esc(u.name.split(' ')[0])}.`}</p>
  ${token ? `<div class="banner info small">Demo mode: no real email is sent. Open the link below to act as ${esc(u.name.split(' ')[0])} setting their password.</div>
  <div class="card soft small" style="margin-top:10px;word-break:break-all">${esc(location.href.split('#')[0])}#/set-password/${esc(token)}</div>
  <div class="row" style="margin-top:14px"><a class="btn primary" href="#/set-password/${esc(token)}" data-native="1" data-act="closeModal">Open set-password page</a><button class="btn" data-act="closeModal">Close</button></div>`
  : `<div class="row" style="margin-top:14px"><button class="btn" data-act="closeModal">Close</button></div>`}`, { noFocus: true });
UI.on('showInvite', async el => {
  const u = Store.user(el.dataset.id);
  try { const r = await API.post(`/api/admin/users/${encodeURIComponent(u.id)}/invite`); AV.inviteModal(u, r.demoToken, r.emailed); }
  catch (e) { UI.toast(e.message, true); }
});

UI.on('toggleActive', el => {
  const u = Store.user(el.dataset.id), me = Session.user();
  if (u.id === me.id) return UI.toast('You cannot deactivate your own account.', true);
  const act = async () => {
    try { await API.post(`/api/admin/users/${encodeURIComponent(u.id)}/active`, { active: !u.active }); await Store.bootstrap(); }
    catch (e) { return UI.toast(e.message, true); }
    UI.toast(`${u.name} ${u.active ? 'reactivated' : 'deactivated'}.`); UI.render();
  };
  if (u.active) UI.confirm(`Deactivate ${u.name}?`, 'They will not be able to sign in. Their records are kept, and you can reactivate them at any time.', 'Deactivate', act, true); else act();
});
UI.on('approve', async el => {
  const su = Store.state.signups.find(x => x.id === el.dataset.id); if (!su) return;
  try { await API.post(`/api/admin/signups/${encodeURIComponent(su.id)}/approve`); await Store.bootstrap(); }
  catch (e) { return UI.toast(e.message, true); }
  UI.toast(`${su.name} approved. They can sign in now.`); UI.render();
});
UI.on('reject', el => {
  const su = Store.state.signups.find(x => x.id === el.dataset.id); if (!su) return;
  UI.confirm(`Reject ${su.name}'s sign-up?`, 'Their sign-up is removed. They can try again with the right details.', 'Reject', async () => {
    try { await API.post(`/api/admin/signups/${encodeURIComponent(su.id)}/reject`); await Store.bootstrap(); }
    catch (e) { return UI.toast(e.message, true); }
    UI.toast('Sign-up rejected.'); UI.render();
  }, true);
});
UI.on('askCorrect', async el => {
  const su = Store.state.signups.find(x => x.id === el.dataset.id); if (!su) return;
  try { await API.post(`/api/admin/signups/${encodeURIComponent(su.id)}/correct`); await Store.bootstrap(); }
  catch (e) { return UI.toast(e.message, true); }
  UI.toast(`${su.name} has been asked to correct their details.`); UI.render();
});

/* ---- import students from a file ---- */
UI.on('importStudents', () => {
  UI.modal(`<h2>Import students from a file</h2><p class="muted small" style="margin:4px 0 12px">Upload a CSV with the columns <b>schoolId, name, email, programme, year</b>. These become the school records students sign up against.</p>
    <form id="import-form" data-submit="doImport" novalidate>
      <label class="field" for="im-file">CSV file</label><input class="input" id="im-file" name="file" type="file" accept=".csv,text/csv">
      <div class="hint"><a href="#" data-act="sampleCsv">Download a sample file</a></div>
      <div class="row" style="margin-top:14px"><button class="btn primary">Import</button><button type="button" class="btn" data-act="closeModal">Cancel</button></div></form><div id="import-result"></div>`);
});
UI.on('sampleCsv', () => UI.download('students-sample.csv', UI.csv([['schoolId', 'name', 'email', 'programme', 'year'], ['260101', 'Ada Moyo', `ada.moyo@${CONFIG.studentEmailDomain}`, 'BSc Computer Science', 1], ['260102', 'Ben Dube', `ben.dube@${CONFIG.studentEmailDomain}`, 'BA Communication', 1]]), 'text/csv'));
UI.onSubmit('doImport', form => {
  const f = form.elements.file.files[0];
  if (!f) return UI.showErrors(form, { file: 'Choose a CSV file first.' });
  const reader = new FileReader();
  reader.onload = async () => {
    const rows = UI.parseCsv(String(reader.result).replace(/^\uFEFF/, ''));
    const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
    const idx = k => head.indexOf(k);
    if (['schoolid', 'name', 'email'].some(k => idx(k) < 0)) return UI.showErrors(form, { file: 'The first row must include the columns schoolId, name and email.' });
    const get = (r, k) => idx(k) >= 0 ? (r[idx(k)] || '').trim() : '';
    let res;
    try { res = await API.post('/api/admin/registry/import', { rows: rows.map(r => ({ schoolId: get(r, 'schoolid'), name: get(r, 'name'), email: get(r, 'email'), programme: get(r, 'programme'), year: get(r, 'year') })) }); }
    catch (e) { return UI.showErrors(form, { file: e.message }); }
    await Store.bootstrap();
    const added = res.added, skipped = res.skipped, bad = res.bad;
    form.classList.add('hidden');
    $('#import-result').innerHTML = `<div class="banner ${bad.length && !added ? 'err' : 'ok'}"><b>${added} imported</b>${skipped ? `, ${skipped} skipped (already on file)` : ''}${bad.length ? `, ${bad.length} with problems` : ''}.</div>
      ${bad.length ? `<ul class="small bad" style="margin:10px 0 0 18px">${bad.slice(0, 8).map(b => `<li>${esc(b)}</li>`).join('')}${bad.length > 8 ? `<li>…and ${bad.length - 8} more</li>` : ''}</ul>` : ''}<div style="margin-top:14px"><button class="btn" data-act="closeModal">Close</button></div>`;
  };
  reader.readAsText(f);
});

/* =================== PERMISSIONS =================== */
AV.permDiff = (draft) => {
  const saved = Store.state.permissions, out = [];
  PERM_ROWS.forEach(r => { if (!r.key) return; PERM_ROLES.forEach(([role]) => { if (draft[r.key][role] !== saved[r.key][role]) out.push({ key: r.key, role, label: r.label, on: draft[r.key][role] }); }); });
  return out;
};
AV.permissions = ({ user }) => {
  const st = UI.state('perm', { draft: null });
  if (!st.draft) st.draft = JSON.parse(JSON.stringify(Store.state.permissions));
  const diff = AV.permDiff(st.draft);
  const cell = (r, role) => {
    const v = r.v[role];
    if (v === null) return '<span class="muted" aria-label="Not applicable">–</span>';
    if (v === 'L1' || v === 'L0') return `<button class="perm-lock" data-act="lockWhy" data-key="${r.key}" data-role="${role}" aria-label="Fixed by the school: ${v === 'L1' ? 'allowed' : 'not allowed'}. Tap to see why.">🔒${v === 'L1' ? '✓' : '✕'}</button>`;
    return `<input type="checkbox" data-change="permToggle" data-key="${r.key}" data-role="${role}" ${st.draft[r.key][role] ? 'checked' : ''} aria-label="${esc(r.label)} for ${Names.roleLabel[role]}">`;
  };
  const changes = Store.state.audit.filter(a => a.perm).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 5);
  return wrapA(user, '/permissions', `
    ${UI.crumbs([{ label: 'Home', href: '#/admin' }, { label: 'Permissions' }])}
    <div class="page-head"><div><h1>Permissions</h1><p>Choose what each role can do. Changes apply the next time people sign in.</p></div></div>
    ${diff.length ? `<div class="banner warn row between" style="margin-bottom:12px"><span>▲ You have ${diff.length} unsaved change${diff.length === 1 ? '' : 's'}.</span><button class="btn small" data-act="permUndo">Undo changes</button></div>` : ''}
    <div class="card perm-wrap" style="padding:0;overflow-x:auto"><table class="tbl perm-grid" style="min-width:680px"><thead><tr><th>What people can do</th>${PERM_ROLES.map(([, l]) => `<th class="c">${l}</th>`).join('')}</tr></thead><tbody>
      ${PERM_ROWS.map(r => r.section ? `<tr><td class="sec" colspan="6">${r.section}</td></tr>` : `<tr><td>${esc(r.label)}</td>${PERM_ROLES.map(([role]) => `<td class="c">${cell(r, role)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="muted small" style="margin:8px 0 12px">🔒 A lock means the school's rules fix this setting. Tap the lock to see why.</p>
    <button class="btn primary" data-act="permSave" ${diff.length ? '' : 'disabled'}>Save changes</button>
    <div class="card" style="margin-top:18px"><h3>Recent changes</h3><p class="muted small">Every change is recorded: who made it and when.</p><div class="list" style="margin-top:6px">${changes.map(a => `<div class="item"><div class="grow">${esc(a.text)} <span class="muted small">· by ${esc(a.by)}</span></div><span class="muted small">${UI.fmtWhen(a.ts)}</span></div>`).join('') || '<p class="muted small">No changes yet.</p>'}</div></div>
    <div class="card soft" style="margin-top:14px"><h3>Fixed by the school</h3><ul class="small muted" style="margin:6px 0 0 18px"><li>Nobody can edit certified GPA or grades here.</li><li>Students cannot verify their own entries.</li><li>Administrators always keep access to accounts and permissions.</li><li>Supervisors only see the students linked to them.</li></ul></div>`);
};
UI.onChange('permToggle', el => { UI.state('perm').draft[el.dataset.key][el.dataset.role] = el.checked; UI.render(); });
UI.on('permUndo', () => { UI.state('perm').draft = null; UI.render(); });
UI.on('lockWhy', el => {
  const r = PERM_ROWS.find(x => x.key === el.dataset.key), role = el.dataset.role;
  const why = (r.whyBy && r.whyBy[role]) || r.why || "The school's rules fix this setting.";
  UI.modal(`<h2>🔒 ${esc(r.label)}</h2><p class="muted small" style="margin:3px 0 10px">${Names.roleLabel[role]}: ${r.v[role] === 'L1' ? 'always allowed' : 'never allowed'}</p><p>${esc(why)}</p><div style="margin-top:14px"><button class="btn" data-act="closeModal">Got it</button></div>`, { noFocus: true });
});
UI.on('permSave', () => {
  const st = UI.state('perm'), diff = AV.permDiff(st.draft), me = Session.user();
  if (!diff.length) return;
  const byRole = {}; diff.forEach(d => (byRole[d.role] = byRole[d.role] || []).push(d));
  Object.keys(byRole).forEach(role => {
    const items = byRole[role], plural = Names.roleLabel[role] + 's';
    Store.log(items.length === 1 ? `${plural} ${items[0].on ? 'can now' : 'can no longer'}: ${items[0].label.charAt(0).toLowerCase() + items[0].label.slice(1)}` : `Permissions changed for ${plural}`, me.name, { perm: true });
  });
  Store.state.permissions = JSON.parse(JSON.stringify(st.draft)); Store.save(); st.draft = null;
  UI.toast('Saved. Changes apply the next time people sign in.'); UI.render();
});

/* =================== REPORTS =================== */
AV.reportTypes = {
  progress: ['Student progress', 'How students are doing across grades and credits.'],
  completion: ['Portfolio completion', 'Which portfolios have an entry in every section.'],
  compliance: ['Compliance summary', 'Entries waiting for checks and late letter requests.'],
  letters: ['Letter requests', 'Requests, who is writing them, and when they are due.'],
};
AV.periodLabel = (p) => `${p === CONFIG.academicYears[0] ? 'This' : 'An earlier'} academic year (${p})`;
AV.groups = ['All students', 'Year 1', 'Year 2', 'Year 3', 'Year 4'];

AV.reportRows = (r) => {
  const S = Store.state;
  const studs = Store.students().filter(s => r.group === 'All students' || s.year === Number(r.group.slice(5)));
  if (r.type === 'letters') {
    const ids = new Set(studs.map(s => s.id));
    return { head: ['Student', 'School ID', 'Writer', 'Purpose', 'Due', 'Status'], rows: S.letters.filter(l => ids.has(l.studentId)).map(l => { const s = Store.user(l.studentId); return [s.name, s.schoolId, Names.staff(Store.user(l.staffId)), l.purpose, l.due, ({ new: 'Waiting', progress: 'Being written', ready: 'Sent', changes: 'Changes requested', declined: 'Declined' })[l.status]]; }) };
  }
  const head = ['School ID', 'Name', 'Year', 'Programme'];
  const inc = r.include;
  if (inc.grades) head.push('Overall GPA (certified)');
  if (inc.credits) head.push('Credits earned', 'Credits needed');
  if (inc.activities) head.push('Entries', 'Verified entries', 'Achievements', 'Leadership', 'Extracurricular');
  if (r.type === 'completion') head.push('Projects', 'Portfolio complete');
  if (inc.compliance) head.push('Entries waiting over 30 days', 'Letter requests overdue');
  const rows = studs.map(s => {
    const acts = Q.acts(s.id), row = [s.schoolId, s.name, s.year, s.programme];
    if (inc.grades) row.push(Calc.overall(s.id) == null ? '' : Calc.fmt(Calc.overall(s.id)));
    if (inc.credits) row.push(Calc.credits(s.id), 120);
    if (inc.activities) row.push(acts.length, acts.filter(a => a.status === 'verified').length, ...['achievement', 'leadership', 'extra'].map(t => acts.filter(a => a.type === t).length));
    if (r.type === 'completion') row.push(Q.projects(s.id).length, Q.portfolioComplete(s.id) ? 'Yes' : 'No');
    if (inc.compliance) row.push(acts.filter(a => a.status === 'waiting' && Date.now() - new Date(a.createdAt).getTime() > 30 * 86400000).length, S.letters.filter(l => l.studentId === s.id && ['new', 'progress', 'changes'].includes(l.status) && UI.daysUntil(l.due) < 0).length);
    return row;
  });
  return { head, rows };
};
AV.exportReport = (r) => {
  const { head, rows } = AV.reportRows(r);
  const title = `${AV.reportTypes[r.type][0]}: ${r.group}, ${r.period}`;
  const fileBase = `${r.type}-${r.group.toLowerCase().replace(/\s+/g, '-')}-${r.period.replace('/', '-')}`;
  if (r.format === 'csv') UI.download(fileBase + '.csv', '﻿' + UI.csv([head, ...rows]), 'text/csv;charset=utf-8');
  else if (r.format === 'excel') UI.download(fileBase + '.xls', `<html><head><meta charset="utf-8"></head><body><table border="1"><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map(x => `<tr>${x.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></body></html>`, 'application/vnd.ms-excel');
  else UI.print(title, `<p>${rows.length} row${rows.length === 1 ? '' : 's'}. Contains student records: share only with people who are allowed to see them.</p><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(x => `<tr>${x.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
  return title;
};

AV.reports = ({ user }) => {
  const st = UI.state('rep', { type: 'progress', group: 'Year 3', period: CONFIG.academicYears[0], format: 'pdf', include: { grades: true, credits: true, activities: false, compliance: true } });
  const B = AV.stats(st.period);
  const yr = st.group === 'All students' ? null : Number(st.group.slice(5));
  const waiting = Store.state.activities.filter(a => a.status === 'waiting' && (Date.now() - new Date(a.createdAt).getTime()) > 30 * 86400000).length;
  const avg = (a) => a.reduce((x, y) => x + y, 0) / 4;
  const pv = CONFIG.demoMode ? (yr ? PREVIEW_BASELINE[st.group] : { credits: 65, entries: 4.9, waiting: 41 })
    : { credits: Math.round(yr ? B.credits[yr - 1] : avg(B.credits)), entries: yr ? B.entries[yr - 1] : avg(B.entries), waiting };
  const lines = [];
  if (st.include.grades) lines.push(['Average overall GPA', (yr ? B.gpa[yr - 1] : B.gpa.reduce((a, b) => a + b, 0) / 4).toFixed(2)]);
  if (st.include.credits) lines.push(['Average credits earned', `${pv.credits} of 120`]);
  if (st.include.activities) lines.push(['Average entries per student', pv.entries.toFixed(1)]);
  if (st.type === 'completion') lines.push(['Portfolios completed', (yr ? B.done[yr - 1] : B.completed) + '%']);
  if (st.type === 'letters') lines.push(['Letter requests this year', CONFIG.demoMode ? (yr ? 120 + yr * 35 : 640) : Store.state.letters.length]);
  if (st.include.compliance) lines.push(['Entries waiting over 30 days', pv.waiting]);
  const recent = Store.state.reports.slice().sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 5);
  const chk = (k, l) => `<label class="check"><input type="checkbox" data-change="repInc" data-k="${k}" ${st.include[k] ? 'checked' : ''}> ${l}</label>`;
  return wrapA(user, '/reports', `
    ${UI.crumbs([{ label: 'Home', href: '#/admin' }, { label: 'Reports' }])}
    <div class="page-head"><div><h1>Reports</h1><p>Build a report, check the preview, then export it.</p></div></div>
    <div class="grid g2" style="align-items:start">
      <form class="card" id="report-builder" data-submit="exportReport" novalidate><h2>Build your report</h2>
        <label class="field" for="rp-type">What kind of report?</label><select class="input" id="rp-type" data-change="repSet" data-k="type">${Object.entries(AV.reportTypes).map(([k, [l]]) => `<option value="${k}" ${st.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select><div class="hint">${AV.reportTypes[st.type][1]}</div>
        <label class="field" for="rp-group">Which students?</label><select class="input" id="rp-group" data-change="repSet" data-k="group">${AV.groups.map(g => `<option ${st.group === g ? 'selected' : ''}>${g}</option>`).join('')}</select>
        <label class="field" for="rp-period">Which period?</label><select class="input" id="rp-period" data-change="repSet" data-k="period">${CONFIG.academicYears.map(p => `<option value="${p}" ${st.period === p ? 'selected' : ''}>${AV.periodLabel(p)}</option>`).join('')}</select>
        <div class="field" style="margin-top:14px">What should it include?</div>
        ${chk('grades', 'Grades and GPA')}${chk('credits', 'Credits earned')}${chk('activities', 'Activities and achievements')}${chk('compliance', 'Compliance checks')}
        <div class="field" style="margin-top:14px">Save it as</div>
        <div class="tabs">${[['pdf', 'PDF'], ['excel', 'Excel'], ['csv', 'CSV']].map(([k, l]) => `<button type="button" class="chip ${st.format === k ? 'on' : ''}" data-act="repFormat" data-f="${k}" aria-pressed="${st.format === k}" style="flex:1;justify-content:center">${l}</button>`).join('')}</div>
        <button class="btn primary block" style="margin-top:14px" name="export">Export report</button>
        <p class="hint">Reports contain student records. Only share them with people who are allowed to see them.</p></form>
      <div class="card"><h2>Preview</h2><p class="muted small">${CONFIG.demoMode ? 'Sample figures. Your export uses live data.' : 'Figures from your current records.'}</p>
        <div class="preview" style="margin-top:10px"><h3 style="font-size:1.15rem">${AV.reportTypes[st.type][0]}</h3><p class="muted small">${esc(st.group)} · ${esc(AV.periodLabel(st.period))}</p>
          ${lines.map(([l, v]) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`).join('') || '<p class="muted small" style="margin-top:10px">Tick at least one thing to include to see a preview.</p>'}</div></div></div>
    <div class="card" style="margin-top:16px"><h3>Recent reports</h3><div class="list" style="margin-top:6px">${recent.map(r => `<div class="item"><span class="dot">${r.format === 'pdf' ? 'PDF' : r.format === 'excel' ? 'XLS' : 'CSV'}</span><div class="grow"><b>${esc(r.name)}</b><div class="muted small">${UI.fmtDate(r.ts)} · ${r.format === 'pdf' ? 'PDF' : r.format === 'excel' ? 'Excel' : 'CSV'}</div></div><button class="btn small" data-act="repAgain" data-id="${r.id}">Download again</button></div>`).join('') || '<p class="muted small">Reports you export will be listed here.</p>'}</div></div>`);
};
UI.onChange('repSet', el => { UI.state('rep')[el.dataset.k] = el.value; UI.render(); });
UI.onChange('repInc', el => { UI.state('rep').include[el.dataset.k] = el.checked; UI.render(); });
UI.on('repFormat', el => { UI.state('rep').format = el.dataset.f; UI.render(); });
UI.onSubmit('exportReport', form => {
  const st = UI.state('rep');
  if (!Object.values(st.include).some(Boolean)) return UI.showErrors(form, { export: 'Choose at least one thing to include. An empty report is not useful.' });
  const cfg = { type: st.type, group: st.group, period: st.period, format: st.format, include: Object.assign({}, st.include) };
  AV.exportReport(cfg);
  Store.state.reports.unshift({ id: Store.id('r'), name: `${st.group === 'All students' ? 'All students' : st.group} ${AV.reportTypes[st.type][0].toLowerCase()}`, ts: new Date().toISOString(), ...cfg });
  Store.log(`Exported report: ${AV.reportTypes[st.type][0]} (${st.group})`, Session.user().name); Store.save();
  if (st.format !== 'pdf') UI.toast('Report exported. Check your downloads.'); UI.render();
});
UI.on('repAgain', el => { const r = Store.state.reports.find(x => x.id === el.dataset.id); AV.exportReport(r); if (r.format !== 'pdf') UI.toast('Report downloaded again with live data.'); });

/* =================== AUDIT LOG =================== */
AV.audit = ({ user }) => {
  const rows = Store.state.audit.slice().sort((a, b) => b.ts.localeCompare(a.ts));
  return wrapA(user, '/audit', `
    <div class="page-head"><div><h1>Audit log</h1><p>Every account and permission change: what happened, who did it, and when.</p></div></div>
    <div class="card" style="padding:6px 16px 12px"><table class="tbl"><thead><tr><th>What happened</th><th>By</th><th class="right">When</th></tr></thead><tbody>
      ${rows.map(a => `<tr><td>${esc(a.text)}</td><td class="muted">${esc(a.by || 'System')}</td><td class="right muted small">${UI.fmtWhen(a.ts)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Nothing yet.</td></tr>'}</tbody></table></div>`);
};
