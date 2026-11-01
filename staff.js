/* Staff screens: home, my students, review a portfolio, letter requests, letter editor, update a letter. */

const TV = Views.staff;
const wrapT = (user, active, inner) => Views.shell.wrap(user, active, inner);

TV.recent = (iso, days = 7) => (Date.now() - new Date(iso).getTime()) < days * 86400000;
TV.entryKind = (a) => a.updated ? 'Updated activity' : `New ${({ achievement: 'achievement', leadership: 'leadership role', extra: 'activity' })[a.type]}`;

TV.studentRow = (s) => `<div class="item">${UI.avatar(s)}<div class="grow"><b>${esc(s.name)}</b><div class="muted small">${esc(s.schoolId)} · Year ${s.year} · ${esc(s.programme)}</div></div>
  <a class="btn small" href="#/staff/students/${s.id}">Open portfolio</a></div>`;

TV.studentFinder = (user, key, limit) => {
  const st = UI.state(key, { q: '' });
  const all = Q.staffStudents(user).sort((a, b) => a.name.localeCompare(b.name));
  const q = st.q.trim().toLowerCase();
  const hits = q ? all.filter(s => s.name.toLowerCase().includes(q) || s.schoolId.toLowerCase().includes(q)) : all;
  const shown = hits.slice(0, limit);
  return `<input class="input" style="margin:0 0 10px" type="search" placeholder="⌕ Type a name or school ID" aria-label="Find a student" value="${esc(st.q)}" data-input="finder" data-key="${key}" data-keep="finder-${key}">
    ${shown.length ? `<div class="card list" style="padding-top:12px;padding-bottom:6px">${shown.map(TV.studentRow).join('')}</div>`
      : UI.empty(q ? `No student matches "${st.q}"` : 'No students yet', q ? 'Check the spelling, or try their school ID instead.' : 'Students you teach will show here.')}
    <p class="muted small" style="margin-top:8px">Showing ${shown.length} of ${hits.length} ${q ? 'matches' : 'students'}.${hits.length > shown.length ? ' Search to find anyone else.' : ''}</p>`;
};
UI.onInput('finder', el => { UI.state(el.dataset.key).q = el.value; UI.render(); });

/* =================== DASHBOARD =================== */
TV.studentTable = (user, key, limit) => {
  const st = UI.state(key, { q: '' });
  const all = Q.staffStudents(user).sort((a, b) => a.name.localeCompare(b.name));
  const q = st.q.trim().toLowerCase();
  const hits = q ? all.filter(s => s.name.toLowerCase().includes(q) || s.schoolId.toLowerCase().includes(q)) : all;
  const shown = hits.slice(0, limit);
  return `<div class="card"><div class="row between" style="margin-bottom:8px"><h3>My students</h3>
      <input class="input" style="margin:0;max-width:240px" type="search" placeholder="Search name or ID" aria-label="Find a student" value="${esc(st.q)}" data-input="finder" data-key="${key}" data-keep="finder-${key}"></div>
    ${shown.length ? `<table class="tbl"><thead><tr><th>Student</th><th>Year</th><th>Cum. GPA</th><th class="right">Portfolio</th></tr></thead><tbody>
      ${shown.map(s => `<tr><td><b>${esc(s.name)}</b><div class="muted xs">${esc(s.schoolId)} · ${esc(s.programme)}</div></td><td>Year ${s.year}</td><td>${Calc.fmt(Calc.overall(s.id))}</td><td class="right"><a class="btn small" href="#/staff/students/${s.id}">Open</a></td></tr>`).join('')}</tbody></table>`
      : UI.empty(q ? `No student matches "${st.q}"` : 'No students yet', q ? 'Check the spelling, or try their school ID instead.' : 'Students you teach will show here.')}
    <p class="muted small" style="margin-top:8px">Showing ${shown.length} of ${hits.length}.${hits.length > shown.length ? ' <a href="#/staff/students">See everyone</a>' : ''}</p></div>`;
};
UI.onInput('finder', el => { UI.state(el.dataset.key).q = el.value; UI.render(); });

TV.home = ({ user }) => {
  const entries = Q.pendingEntries(user);
  const letters = Store.state.letters.filter(l => l.staffId === user.id && ['new', 'changes', 'progress'].includes(l.status)).sort((a, b) => a.due.localeCompare(b.due));
  const canVerify = Session.can('verify'), canWrite = Session.can('write_letters');
  const nStudents = Q.staffStudents(user).length;
  const attn = [
    ...(canVerify ? entries.slice(0, 4).map(e => { const s = Store.user(e.userId); return `<div class="item">${UI.avatar(s)}<div class="grow"><b>${esc(s.name)}</b><div class="muted small">${TV.entryKind(e)}: ${esc(e.title)}</div></div><span class="badge">Verify</span><a class="btn small" href="#/staff/students/${s.id}?entry=${e.id}">Review</a></div>`; }) : []),
    ...(canWrite ? letters.slice(0, 4).map(l => { const s = Store.user(l.studentId); return `<div class="item">${UI.avatar(s)}<div class="grow"><b>${esc(s.name)}</b><div class="muted small">Letter for ${esc(l.purpose.toLowerCase())} · ${UI.dueLabel(l.due)}${l.status === 'changes' ? ' · changes requested' : ''}</div></div><span class="badge">Letter</span><a class="btn small" href="#/staff/letters">Respond</a></div>`; }) : [])];
  return wrapT(user, '', `
    <div class="profile card"><div class="prow">${UI.avatarEditable(user)}<div class="grow"><h1>Welcome, ${esc(user.name)}</h1><p class="muted">${esc(user.title)} · ${esc(user.department)}</p></div></div></div>
    <div class="grid g3 stats-row" style="margin-bottom:14px">
      <div class="stat"><div class="lbl">My students</div><div class="num">${nStudents}</div></div>
      <div class="stat"><div class="lbl">Entries to verify</div><div class="num">${entries.length}</div><div class="sub warn">${entries.filter(e => TV.recent(e.createdAt)).length} new this week</div></div>
      <div class="stat"><div class="lbl">Letter requests</div><div class="num">${letters.length}</div><div class="sub warn">${letters.filter(l => UI.daysUntil(l.due) <= 14).length} due soon</div></div>
    </div>
    <div class="card" style="margin-bottom:14px"><h3>Needs your attention</h3><div class="list" style="margin-top:8px">${attn.join('') || '<p class="muted small">All caught up.</p>'}</div></div>
    ${TV.studentTable(user, 'staffHome', 5)}
  `);
};
UI.on('openLetterTab', el => { UI.state('sl', { tab: 'new', declineId: null }).tab = el.dataset.tab; UI.go('/staff/letters'); });

TV.students = ({ user }) => wrapT(user, '/students', `
  <div class="page-head"><div><h1>My students</h1><p>Everyone whose portfolio you can open. Search by name or school ID.</p></div></div>
  ${TV.studentTable(user, 'staffAll', 100)}`);

TV.verify = ({ user }) => {
  const entries = Q.pendingEntries(user), canVerify = Session.can('verify');
  return wrapT(user, '/verify', `
    <div class="page-head"><div><h1>Verify entries</h1><p>Entries your students added that nobody has checked yet.</p></div></div>
    <div class="card">${!canVerify ? '<p class="muted small">Checking entries is switched off for your role.</p>' : entries.length ? `<div class="list">${entries.map(e => { const s = Store.user(e.userId); return `<div class="item">${UI.avatar(s)}<div class="grow"><b>${esc(e.title)}</b><div class="muted small">${esc(s.name)} · ${esc(Names.typeShort[e.type])} · Year ${e.year}${e.certificate ? ' · 📎 ' + esc(e.certificate.name) : ''}</div></div>
      <button class="btn small primary" data-act="verifyQuick" data-id="${e.id}">Verify</button><a class="btn small" href="#/staff/students/${s.id}?entry=${e.id}">Open</a></div>`; }).join('')}</div>` : UI.empty('Nothing to verify', 'You are all caught up.')}</div>`);
};
UI.on('verifyQuick', el => {
  const user = Session.user(), a = Store.state.activities.find(x => x.id === el.dataset.id);
  if (!a || !Session.can('verify')) return UI.toast('Your role cannot check entries.', true);
  a.status = 'verified'; a.verifiedBy = user.id; a.evidenceNote = ''; a.updated = false;
  Store.event(a.userId, 'verified', `${a.title} was checked by ${Names.staff(user)}`, a.id);
  Store.save(); UI.toast(`Verified: ${a.title}`); UI.render();
});

/* =================== REVIEW A PORTFOLIO =================== */
TV.sharedSummary = (l) => {
  const s = Store.user(l.studentId), acts = Q.acts(s.id), blocks = [];
  if (l.share.grades) blocks.push(`<h3>Grades</h3><p class="small">Certified overall GPA <b>${Calc.fmt(Calc.overall(s.id))}</b> · ${Calc.credits(s.id)} of 120 credits</p><table class="tbl small">${Calc.sems(s.id).map(x => `<tr><td>Year ${x.year}, Semester ${x.sem}</td><td class="right">${Calc.fmt(Calc.semGpa(x))}</td></tr>`).join('')}</table>`);
  [['achievements', 'achievement', 'Achievements'], ['leadership', 'leadership', 'Leadership roles'], ['extracurricular', 'extra', 'Extracurricular activities']].forEach(([k, t, label]) => {
    if (l.share[k]) blocks.push(`<h3 style="margin-top:12px">${label}</h3>${acts.filter(a => a.type === t).map(a => `<div class="small">${esc(a.title)} · Year ${a.year}${a.detail ? ' · ' + esc(a.detail) : ''} ${a.status === 'verified' ? '<span class="good">✓</span>' : '<span class="warn">(not yet checked)</span>'}</div>`).join('') || '<p class="muted small">Nothing added.</p>'}`);
  });
  return `<h2>${esc(s.name)}'s portfolio</h2><p class="muted small" style="margin:3px 0 12px">Only what ${esc(s.name.split(' ')[0])} shared for this letter (${esc(l.purpose)}).</p>${blocks.join('') || '<p class="muted">They did not share anything.</p>'}<div style="margin-top:16px"><button class="btn" data-act="closeModal">Close</button></div>`;
};

TV.entryCard = (a, user, student, canVerify, canComment, st) => {
  const comments = a.comments || [], open = st.open[a.id];
  return `<div class="card ${st.flash === a.id ? 'flash' : ''}" id="entry-${a.id}" style="padding:13px 15px;margin-top:10px">
    <div class="row between" style="align-items:flex-start;flex-wrap:nowrap"><div><b>${esc(a.title)}</b><div class="muted small">${esc(Names.typeShort[a.type])} · Year ${a.year}${a.detail ? ' · ' + esc(a.detail) : ''}</div></div>${SV.actStatus(a)}</div>
    ${a.certificate ? `<div class="small" style="margin-top:4px">${a.certificate.data ? `<a href="${a.certificate.data}" download="${esc(a.certificate.name)}">📎 ${esc(a.certificate.name)}</a>` : `📎 ${esc(a.certificate.name)}`}</div>` : ''}
    <div class="row" style="margin-top:9px">
      ${canVerify && a.status !== 'verified' ? `<button class="btn primary small" data-act="verifyEntry" data-id="${a.id}">Verify</button>` : ''}
      ${canVerify && a.status === 'waiting' ? `<button class="btn small" data-act="askEvidence" data-id="${a.id}">Ask for evidence</button>` : ''}
      <button class="btn small" data-act="toggleEntryComments" data-id="${a.id}">Comments (${comments.length})</button></div>
    ${open ? `<div style="margin-top:8px">${comments.map(c => `<div class="comment"><b>${esc(Names.staff(Store.user(c.by)) || 'Someone')}:</b> ${esc(c.text)}</div>`).join('')}
      ${canComment ? `<form class="row" style="flex-wrap:nowrap;margin-top:8px" id="cm-${a.id}" data-submit="postComment" data-kind="activity" data-id="${a.id}" novalidate><input class="input" style="margin:0" name="text" placeholder="Write a comment" aria-label="Write a comment"><button class="btn small">Post</button></form><div class="hint">${esc(student.name.split(' ')[0])} can see your comments.</div>` : ''}</div>` : ''}
  </div>`;
};

TV.review = ({ user, params, query }) => {
  const student = Store.user(params[0]);
  if (!student || student.role !== 'student' || !Q.canSeeStudent(user, student.id)) {
    return wrapT(user, '/students', `<div style="margin-top:30px">${UI.empty('You cannot open this portfolio', 'Staff can only open the portfolios of students they teach.')}<p style="margin-top:12px;text-align:center"><a class="btn" href="#/staff">Back to dashboard</a></p></div>`);
  }
  let st = UI.state('review', { sid: null, tab: 'overview', open: {}, flash: null });
  if (st.sid !== student.id) { st.sid = student.id; st.tab = 'overview'; st.open = {}; st.flash = null; }
  if (query.entry && st.flash !== query.entry) { st.flash = query.entry; st.open[query.entry] = false; st.tab = 'overview'; UI.after(() => { const el = $('#entry-' + query.entry); if (el) el.scrollIntoView({ block: 'center' }); }); }
  const pr = student.profile || {}, acts = Q.acts(student.id), projs = Q.projects(student.id), sems = Calc.sems(student.id);
  const canVerify = Session.can('verify'), canComment = Session.can('comment_rate');
  const tabs = [['overview', 'Overview'], ['academic', 'Academic'], ['achievement', 'Achievements'], ['leadership', 'Leadership'], ['extra', 'Activities'], ['projects', `Projects (${projs.length})`]];
  const mine = Store.state.assessments.find(a => a.studentId === student.id && a.staffId === user.id) || {};
  const card = a => TV.entryCard(a, user, student, canVerify, canComment, st);
  const projCard = p => { const cs = p.comments || [], open = st.open[p.id]; return `<div class="card" style="padding:13px 15px;margin-top:10px"><div class="row between"><b>${esc(p.name)}</b><span class="small muted">Read and comment</span></div>
            <div class="muted small">Project · ${esc(p.kind)} · ${esc(p.team)}</div>${p.challenge ? `<div class="small" style="margin-top:4px">${esc(p.challenge)}</div>` : ''}${p.result ? `<div class="small bold" style="margin-top:4px">Result: ${esc(p.result)}</div>` : ''}
            <div class="row" style="margin-top:9px">${UI.link(p.liveUrl, 'Open live version')}${UI.link(p.codeUrl, 'View code')}<button class="btn small" data-act="toggleEntryComments" data-id="${p.id}">Comments (${cs.length})</button></div>
            ${open ? `<div style="margin-top:8px">${cs.map(c => `<div class="comment"><b>${esc(Names.staff(Store.user(c.by)))}:</b> ${esc(c.text)}</div>`).join('')}${canComment ? `<form class="row" style="flex-wrap:nowrap;margin-top:8px" id="cm-${p.id}" data-submit="postComment" data-kind="project" data-id="${p.id}" novalidate><input class="input" style="margin:0" name="text" placeholder="Write a comment" aria-label="Write a comment"><button class="btn small">Post</button></form>` : ''}</div>` : ''}</div>`; };
  const assess = canComment ? `<form class="card" id="assess-form" data-submit="saveAssessment" data-sid="${student.id}" novalidate>
        <h3>Your assessment</h3><p class="muted small">1 means needs work, 5 means excellent. ${esc(student.name.split(' ')[0])} will see this.</p>
        ${[['leadership', 'Leadership'], ['teamwork', 'Teamwork'], ['communication', 'Communication']].map(([k, l]) => `<input type="hidden" name="${k}" value="${mine[k] || ''}">${UI.ratingRow(l, k, mine[k] || 0)}`).join('')}
        <label class="field" for="as-fb">Feedback for ${esc(student.name.split(' ')[0])} <span class="opt">(optional)</span></label><textarea class="input" id="as-fb" name="feedback" placeholder="${esc(student.name.split(' ')[0])} led the club well this year. Next, try delegating more tasks.">${esc(mine.feedback || '')}</textarea>
        <div class="hint">Needs at least one rating or some feedback.</div>
        <button class="btn primary block" style="margin-top:12px">Save assessment</button></form>`
    : `<div class="card"><p class="muted small">Commenting and rating are switched off for your role.</p></div>`;
  let body;
  if (st.tab === 'overview') {
    const waiting = acts.filter(a => a.status !== 'verified').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    body = `<div class="grid g2" style="align-items:start"><div class="stack-lg">
        <div class="card"><h3>About ${esc(student.name.split(' ')[0])}</h3><p class="small" style="margin:6px 0">${esc(pr.bio) || '<span class="muted">No bio yet.</span>'}</p>
          <div class="row" style="gap:6px">${(pr.skills || []).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>
          <p class="small muted" style="margin-top:8px">${esc(student.email)} · ${esc(student.phone || '')}<br>${esc(pr.linkedin || '')}${pr.linkedin && pr.github ? ' · ' : ''}${esc(pr.github || '')}</p></div>
        <div><h3>Waiting for verification</h3>${waiting.map(card).join('') || `<div style="margin-top:10px">${UI.empty('Nothing waiting', 'Every entry has been checked.')}</div>`}</div></div>${assess}</div>`;
  } else if (st.tab === 'academic') {
    body = sems.length ? `<div class="banner ok" style="margin-bottom:12px">Certified overall GPA <b>${Calc.fmt(Calc.overall(student.id))}</b> · ${Calc.credits(student.id)} of 120 credits. Read only.</div>
      ${sems.map(sem => `<div class="card" style="margin-bottom:12px"><div class="row between"><h3>Year ${sem.year}, Semester ${sem.sem}</h3><b>${Calc.fmt(Calc.semGpa(sem))}</b></div><table class="tbl" style="margin-top:8px"><tbody>${sem.courses.map(c => `<tr><td class="muted">${esc(c.code)}</td><td>${esc(c.title)}</td><td class="c">${c.credits}</td><td class="c bold">${esc(c.grade)}</td></tr>`).join('')}</tbody></table></div>`).join('')}` : UI.empty('No certified grades yet', 'Grades appear once the registry certifies them.');
  } else if (st.tab === 'projects') {
    body = projs.map(projCard).join('') || UI.empty('No projects yet', 'This student has not added any projects.');
  } else {
    const list = acts.filter(a => a.type === st.tab).sort((a, b) => (a.status === 'verified') - (b.status === 'verified') || b.createdAt.localeCompare(a.createdAt));
    body = list.map(card).join('') || UI.empty('Nothing here yet', 'This student has not added anything of this type.');
  }
  return wrapT(user, '/students', `
    <a class="small" href="#/staff/students">← Back to my students</a>
    <div class="card" style="display:flex;gap:16px;align-items:center;margin:10px 0 14px;flex-wrap:wrap">${UI.avatar(student, 'lg')}<div class="grow"><h1>${esc(student.name)}</h1><p class="muted">${esc(student.schoolId)} · Year ${student.year} · ${esc(student.programme)}</p></div>
      <div style="text-align:right"><div class="muted small">Cumulative GPA</div><div style="font-size:1.9rem;font-weight:800">${Calc.fmt(Calc.overall(student.id))}</div><div class="${Calc.overall(student.id) != null ? 'good' : 'muted'} small">${Calc.overall(student.id) != null ? '✓ School certified' : 'Not certified yet'}</div></div></div>
    <div class="utabs" role="tablist">${tabs.map(([k, l]) => `<button class="${st.tab === k ? 'on' : ''}" data-act="reviewFilter" data-f="${k}">${l}</button>`).join('')}</div>
    <div style="margin-top:14px">${body}</div>`);
};
UI.on('reviewFilter', el => { UI.state('review').tab = el.dataset.f; UI.render(); });
UI.on('toggleEntryComments', el => { const s = UI.state('review'); s.open[el.dataset.id] = !s.open[el.dataset.id]; UI.render(); });
UI.on('verifyEntry', el => {
  const user = Session.user(), a = Store.state.activities.find(x => x.id === el.dataset.id);
  if (!Session.can('verify')) return UI.toast('Your role cannot check entries.', true);
  a.status = 'verified'; a.verifiedBy = user.id; a.evidenceNote = ''; a.updated = false;
  Store.event(a.userId, 'verified', `${a.title} was checked by ${Names.staff(user)}`, a.id);
  Store.save(); UI.toast(`Verified: ${a.title}`); UI.render();
});
UI.on('askEvidence', el => {
  UI.modal(`<h2>Ask for evidence</h2><p class="muted small" style="margin:3px 0 12px">Tell the student what to attach, such as a certificate or a letter.</p>
    <form id="evidence-form" data-submit="sendEvidence" data-id="${el.dataset.id}" novalidate><label class="field" for="ev-note">What do you need?</label><textarea class="input" id="ev-note" name="note" placeholder="Please attach the certificate or a letter from the club president."></textarea>
    <div class="row" style="margin-top:14px"><button class="btn primary">Send request</button><button type="button" class="btn" data-act="closeModal">Cancel</button></div></form>`);
});
UI.onSubmit('sendEvidence', form => {
  const note = form.elements.note.value.trim();
  if (!note) return UI.showErrors(form, { note: 'Say what you need, so the student knows what to attach.' });
  const user = Session.user(), a = Store.state.activities.find(x => x.id === form.dataset.id);
  a.status = 'evidence'; a.evidenceNote = `${Names.staff(user)} asks: ${note}`;
  Store.event(a.userId, 'evidence', `${Names.staff(user)} asked for evidence for ${a.title}`, a.id);
  Store.save(); UI.closeModal(); UI.toast('Sent. The student will see your request.'); UI.render();
});
UI.onSubmit('postComment', form => {
  const text = form.elements.text.value.trim();
  if (!text) return UI.showErrors(form, { text: 'Write a comment before posting.' });
  const user = Session.user(), S = Store.state, id = form.dataset.id;
  const item = form.dataset.kind === 'project' ? S.projects.find(p => p.id === id) : S.activities.find(a => a.id === id);
  (item.comments = item.comments || []).push({ by: user.id, text, ts: new Date().toISOString() });
  Store.event(item.userId, 'comment', `${Names.staff(user)} commented on ${item.title || item.name}`, id);
  Store.save(); UI.render();
});
UI.onSubmit('saveAssessment', form => {
  const user = Session.user(), d = UI.formData(form), sid = form.dataset.sid;
  const r = k => d[k] ? Number(d[k]) : null;
  if (!r('leadership') && !r('teamwork') && !r('communication') && !d.feedback.trim()) return UI.showErrors(form, { feedback: 'Give at least one rating or write some feedback.' });
  const S = Store.state; let a = S.assessments.find(x => x.studentId === sid && x.staffId === user.id);
  const rec = { leadership: r('leadership'), teamwork: r('teamwork'), communication: r('communication'), feedback: d.feedback.trim(), ts: new Date().toISOString() };
  if (a) Object.assign(a, rec); else S.assessments.push({ id: Store.id('as'), studentId: sid, staffId: user.id, ...rec });
  Store.event(sid, 'assessment', `${Names.staff(user)} added feedback about you`, null);
  Store.save(); UI.clearDrafts('assess-form'); UI.toast('Assessment saved.'); UI.render();
});

/* =================== LETTER REQUESTS =================== */
TV.letterTemplates = {
  'Scholarship': (n, t) => `To the scholarship committee,\n\nI am writing in support of ${n}. Their academic record and [achievement] show real promise.\n\n[A specific example of their work]\n\nI strongly support their application.\n\nYours faithfully,\n${t}`,
  'Job application': (n, t) => `Dear hiring manager,\n\nIt is my pleasure to recommend ${n} for [the role]. In my [course] class they showed [a strength].\n\n[A specific example of their work]\n\nI am confident they would be a valuable team member.\n\nYours sincerely,\n${t}`,
  'Internship': (n, t) => `Dear hiring manager,\n\nIt is my pleasure to recommend ${n} for [the internship]. In my [course] class they showed [a strength].\n\n[A specific example of their work]\n\nI am confident they would be a valuable team member.\n\nYours sincerely,\n${t}`,
  'Standard reference': (n, t) => `To whom it may concern,\n\nI have taught ${n} in [course] and am happy to confirm their record.\n\n[A specific example of their work]\n\nPlease contact me if you need more detail.\n\nYours sincerely,\n${t}`,
};
TV.templateFor = (purpose) => TV.letterTemplates[purpose] ? purpose : 'Standard reference';

TV.letters = ({ user }) => {
  const st = UI.state('sl', { tab: 'new', declineId: null });
  const mine = Store.state.letters.filter(l => l.staffId === user.id);
  const tabs = [['new', 'New', mine.filter(l => l.status === 'new')], ['changes', 'Changes requested', mine.filter(l => l.status === 'changes')], ['progress', 'In progress', mine.filter(l => l.status === 'progress')], ['ready', 'Sent', mine.filter(l => l.status === 'ready')]];
  const cur = tabs.find(t => t[0] === st.tab) || tabs[0];
  const canWrite = Session.can('write_letters');
  const empty = { new: ['No new requests', 'When a student asks you for a letter it will show here, so you can accept or decline it.'], changes: ['No changes requested', 'If a student asks you to update a letter you sent, it will show here.'], progress: ['Nothing in progress', 'Accept a new request and it will move here, ready for you to write.'], ready: ['No letters sent yet', 'Letters you sign and send will be listed here.'] }[cur[0]];
  const card = (l) => {
    const s = Store.user(l.studentId);
    const head = `<div class="row between" style="align-items:flex-start"><div class="row" style="gap:12px">${UI.avatar(s)}<div><b>${esc(s.name)}</b><div class="muted small">${esc(l.purpose)}${l.status === 'changes' ? ` · Change request ${l.changesUsed} of ${CONFIG.maxLetterChanges}` : ''}</div></div></div>
      <div class="small">${l.status === 'changes' ? '<span class="status info">✎ Changes requested</span>' : l.status === 'ready' ? `<span class="muted">Sent ${UI.fmtDate(l.versions[l.versions.length - 1].sentAt)} · v${l.versions.length}</span>` : UI.dueLabel(l.due)}</div></div>`;
    let body = '';
    if (l.status === 'new') {
      body = `${l.message ? `<div class="card soft" style="padding:9px 12px;margin-top:10px"><span class="muted small">Message from student:</span> ${esc(l.message)}</div>` : ''}
        ${st.declineId === l.id ? `<form id="decline-form" data-submit="declineLetter" data-id="${l.id}" novalidate class="card soft" style="margin-top:10px"><h3>If you decline, tell ${esc(s.name.split(' ')[0])} why, so they can ask someone else</h3>
          <textarea class="input" name="reason" placeholder="I am on leave until December and cannot meet your deadline." style="min-height:62px"></textarea><div class="hint">A short reason is required before the reply can be sent.</div>
          <div class="row" style="margin-top:8px"><button class="btn primary small">Send reply</button><button type="button" class="btn small" data-act="cancelDecline">Cancel</button></div></form>`
        : canWrite ? `<div class="row" style="margin-top:10px"><button class="btn primary" data-act="acceptLetter" data-id="${l.id}">Accept</button><button class="btn" data-act="declineOpen" data-id="${l.id}">Decline</button></div>` : '<p class="muted small" style="margin-top:8px">Writing letters is switched off for your role.</p>'}`;
    } else if (l.status === 'changes') {
      const cr = l.changeRequests[l.changeRequests.length - 1];
      body = `<div class="card" style="padding:9px 12px;margin-top:10px"><span class="muted small">What ${esc(s.name.split(' ')[0])} wants changed:</span> ${esc(cr.text)}</div>${canWrite ? `<a class="btn primary" style="margin-top:10px" href="#/staff/letters/update/${l.id}">Update letter</a>` : ''}`;
    } else if (l.status === 'progress') {
      body = `${l.message ? `<div class="card soft" style="padding:9px 12px;margin-top:10px"><span class="muted small">Message from student:</span> ${esc(l.message)}</div>` : ''}${l.draft ? '<p class="small warn" style="margin-top:8px">● You have a saved draft.</p>' : ''}${canWrite ? `<a class="btn primary" style="margin-top:10px" href="#/staff/letters/write/${l.id}">${l.draft ? 'Continue writing' : 'Write letter'}</a>` : ''}`;
    } else {
      body = `<button class="btn small" style="margin-top:10px" data-act="viewLetter" data-id="${l.id}">View sent letter</button>`;
    }
    return `<div class="card" style="margin-top:12px">${head}${body}</div>`;
  };
  return wrapT(user, '/letters', `
    ${UI.crumbs([{ label: 'Home', href: '#/staff' }, { label: 'Letter requests' }])}
    <div class="page-head"><div><h1>Letter requests</h1><p>Accept or decline requests, then write and send each letter.</p></div></div>
    <div class="tabs">${tabs.map(([k, l, arr]) => `<button class="chip ${cur[0] === k ? 'on' : ''}" data-act="letterTab" data-tab="${k}">${l} (${arr.length})</button>`).join('')}</div>
    ${cur[2].sort((a, b) => a.due.localeCompare(b.due)).map(card).join('') || `<div style="margin-top:14px">${UI.empty(...empty)}</div>`}`);
};
UI.on('letterTab', el => { const s = UI.state('sl'); s.tab = el.dataset.tab; s.declineId = null; UI.render(); });
UI.on('declineOpen', el => { UI.state('sl').declineId = el.dataset.id; UI.render(); const t = $('#decline-form textarea'); if (t) t.focus(); });
UI.on('cancelDecline', () => { UI.state('sl').declineId = null; UI.clearDrafts('decline-form'); UI.render(); });
UI.on('acceptLetter', el => {
  const user = Session.user(), l = Store.state.letters.find(x => x.id === el.dataset.id);
  if (!Session.can('write_letters')) return UI.toast('Your role cannot write letters.', true);
  l.status = 'progress';
  Store.event(l.studentId, 'note', `${Names.staff(user)} accepted your ${l.purpose.toLowerCase()} letter request and is writing it`, l.id);
  Store.save(); UI.toast(`Accepted. ${Store.user(l.studentId).name.split(' ')[0]} has been told. It is now In progress.`); UI.render();
});
UI.onSubmit('declineLetter', form => {
  const reason = form.elements.reason.value.trim();
  if (!reason) return UI.showErrors(form, { reason: 'Write a short reason so the student can ask someone else.' });
  const user = Session.user(), l = Store.state.letters.find(x => x.id === form.dataset.id);
  l.status = 'declined'; l.declineReason = reason;
  Store.event(l.studentId, 'note', `${Names.staff(user)} cannot write your ${l.purpose.toLowerCase()} letter. See the reply in My letters`, l.id);
  Store.save(); UI.state('sl').declineId = null; UI.clearDrafts('decline-form'); UI.toast('Reply sent.'); UI.render();
});
UI.on('viewLetter', el => {
  const l = Store.state.letters.find(x => x.id === el.dataset.id), v = l.versions[l.versions.length - 1], s = Store.user(l.studentId);
  UI.modal(`<h2>Letter for ${esc(s.name)}</h2><p class="muted small" style="margin:3px 0 12px">${esc(l.purpose)} · version ${v.n} · sent ${UI.fmtDateLong(v.sentAt)}</p><div class="letter-text card soft">${esc(v.text)}</div><div style="margin-top:14px"><button class="btn" data-act="closeModal">Close</button></div>`, { wide: true, noFocus: true });
});

/* =================== LETTER EDITOR (write + update) =================== */
TV.editor = (mode) => ({ user, params }) => {
  const l = Store.state.letters.find(x => x.id === params[0] && x.staffId === user.id);
  const wantStatus = mode === 'write' ? 'progress' : 'changes';
  if (!l || l.status !== wantStatus || !Session.can('write_letters')) {
    return wrapT(user, '/letters', `<div style="margin-top:30px">${UI.empty('This letter is not open for editing', 'It may already be sent, or it is not assigned to you.')}<p style="margin-top:12px;text-align:center"><a class="btn" href="#/staff/letters">Back to requests</a></p></div>`);
  }
  const s = Store.user(l.studentId), first = s.name.split(' ')[0];
  const latest = l.versions[l.versions.length - 1];
  const tplName = TV.templateFor(l.purpose);
  const text = l.draft || (mode === 'update' ? latest.text : TV.letterTemplates[tplName](s.name, Names.staff(user)));
  const cr = l.changeRequests[l.changeRequests.length - 1];
  const nextV = l.versions.length + 1;
  const shared = [['grades', 'My grades'], ['achievements', 'My achievements'], ['leadership', 'My leadership roles'], ['extracurricular', 'My extracurricular activities']];
  return wrapT(user, '/letters', `
    ${UI.crumbs([{ label: 'Home', href: '#/staff' }, { label: 'Letter requests', href: '#/staff/letters' }, { label: s.name }])}
    <h1>${mode === 'write' ? `Letter for ${esc(s.name)}` : `Update letter for ${esc(s.name)}`}</h1>
    ${mode === 'update' ? `<div class="banner warn" style="margin:12px 0"><b>${esc(first)} asked for changes</b> (request ${cr.n} of ${CONFIG.maxLetterChanges})<br>"${esc(cr.text)}"</div>` : ''}
    <p style="margin:10px 0"><a class="btn small" href="#/staff/letters">← Back to requests</a></p>
    <div class="grid g-side" style="align-items:start"><form id="letter-editor" data-submit="sendLetterText" data-id="${l.id}" data-mode="${mode}" novalidate>
      ${mode === 'write' ? `<label class="field" for="le-tpl">Start from a template</label><select class="input" id="le-tpl" name="template" data-change="tplChange" data-prev="${tplName}" data-letter="${l.id}">${Object.keys(TV.letterTemplates).map(t => `<option ${t === tplName ? 'selected' : ''}>${t}</option>`).join('')}</select>` : ''}
      ${mode === 'write' ? `<div class="row" style="margin-top:10px"><button type="button" class="btn small" data-act="draftFromPortfolio" data-id="${l.id}">✨ Draft from ${esc(first)}'s portfolio</button><span class="hint" style="margin:0">Builds a first draft from what ${esc(first)} shared. You review and edit it.</span></div>` : ''}
      <label class="field" for="le-text">${mode === 'write' ? 'Your letter' : `Your letter (version ${nextV}, draft)`}</label>
      <textarea class="input" id="le-text" name="text" style="min-height:330px;font-family:Georgia,serif" spellcheck="true">${esc(text)}</textarea>
      <div class="hint">Replace the [brackets] with real details before sending.</div>
      <div class="row" style="margin-top:12px"><button type="button" class="btn" data-act="saveDraft" data-id="${l.id}">Save draft</button><button class="btn primary">${mode === 'write' ? 'Sign and send' : 'Sign and send updated letter'}</button></div></form>
      <div class="stack-lg">
        ${mode === 'write' ? `<div class="card"><h3>What ${esc(first)} shared with you</h3><p class="muted small">For: ${esc(l.purpose)}, due ${UI.fmtDate(l.due)}</p>${l.message ? `<p class="small" style="margin-top:6px"><span class="muted">Their message:</span> ${esc(l.message)}</p>` : ''}
          <div class="list" style="margin-top:6px">${shared.map(([k, label]) => `<div class="item" style="padding:8px 0"><span class="status ${l.share[k] ? 'ok' : ''}" style="width:18px">${l.share[k] ? '✓' : '–'}</span><span class="${l.share[k] ? '' : 'muted'}">${label}${l.share[k] ? '' : ' (not shared)'}</span></div>`).join('')}</div>
          <button class="btn small" style="margin-top:8px" data-act="openShared" data-id="${l.id}">Open ${esc(first)}'s portfolio</button></div>`
        : `<div class="card"><h3>Versions</h3><div class="list" style="margin-top:6px"><div class="item"><div class="grow"><b>Version ${nextV}</b><div class="muted small">Draft, you are editing this</div></div><span class="status info">✎ Draft</span></div>
          ${l.versions.slice().reverse().map(v => `<div class="item"><div class="grow"><b>Version ${v.n}</b><div class="muted small">Sent ${UI.fmtDate(v.sentAt)}</div></div><button class="btn small" data-act="viewVersion" data-id="${l.id}" data-n="${v.n}">View</button></div>`).join('')}</div>
          <p class="hint">${esc(first)} can still download version ${latest.n} until you send the update. They will be told when the new version is ready.</p></div>`}
      </div></div>`);
};
TV.write = TV.editor('write'); TV.update = TV.editor('update');

UI.onChange('tplChange', el => {
  const l = Store.state.letters.find(x => x.id === el.dataset.letter), s = Store.user(l.studentId), user = Session.user();
  const ta = $('#le-text'), prev = el.dataset.prev, cur = ta.value.trim();
  const prevText = TV.letterTemplates[prev](s.name, Names.staff(user)).trim();
  const next = el.value;
  const apply = () => { ta.value = TV.letterTemplates[next](s.name, Names.staff(user)); el.value = next; el.dataset.prev = next; UI.saveDraft(ta); UI.saveDraft(el); };
  if (!cur || cur === prevText) apply();
  else { el.value = prev; UI.confirm('Replace your letter?', 'Changing the template replaces what you have written so far.', 'Replace', apply, true); }
});
/* Draft helper: assembles a first draft from the items the student chose to share.
   It uses their verified entries only, and leaves [brackets] for the personal part only the lecturer can write. */
TV.portfolioDraft = (l, staff) => {
  const s = Store.user(l.studentId), first = s.name.split(' ')[0], sh = l.share || {};
  const acts = Q.acts(s.id).filter(a => a.status === 'verified');
  const pick = (types) => acts.filter(a => types.includes(a.type));
  const list = (arr) => arr.slice(0, 3).map(a => a.title).join(', ');
  const lines = [`Dear Committee,`, '', `I am pleased to recommend ${s.name} for ${l.purpose}. I have taught ${first} in [course or context] and can speak to ${first}'s work first-hand.`];
  if (sh.grades) { const g = Calc.overall(s.id); if (g != null) lines.push('', `${first} holds an overall GPA of ${Calc.fmt(g)} with ${Calc.credits(s.id)} credits completed.`); }
  const ach = sh.achievements ? pick(['achievement']) : [], lead = sh.leadership ? pick(['leadership']) : [], ex = sh.extracurricular ? pick(['extra']) : [];
  if (ach.length) lines.push('', `Among ${first}'s verified achievements are ${list(ach)}.`);
  if (lead.length) lines.push('', `${first} has taken on leadership responsibility, including ${list(lead)}.`);
  if (ex.length) lines.push('', `Outside class, ${first} is involved in ${list(ex)}.`);
  const pr = Q.projects(s.id).slice(0, 2); if (pr.length) lines.push('', `${first}'s project work includes ${pr.map(p => p.name).join(' and ')}.`);
  lines.push('', `[Add one or two specific things you have personally seen ${first} do, and what they show about ${first}'s character.]`, '', `I recommend ${first} without reservation.`, '', 'Yours sincerely,', Names.staff(staff));
  return lines.join('\n');
};
UI.on('draftFromPortfolio', el => {
  const l = Store.state.letters.find(x => x.id === el.dataset.id), ta = $('#le-text'), user = Session.user();
  const apply = () => { ta.value = TV.portfolioDraft(l, user); UI.saveDraft(ta); UI.toast('First draft ready. Replace the [brackets] and make it your own.'); };
  if (ta.value.trim()) UI.confirm('Replace your letter?', 'The draft replaces what is in the box now.', 'Replace', apply, true); else apply();
});
UI.on('saveDraft', el => {
  const l = Store.state.letters.find(x => x.id === el.dataset.id); l.draft = $('#le-text').value; Store.save(); UI.toast('Draft saved.');
});
UI.on('openShared', el => UI.modal(TV.sharedSummary(Store.state.letters.find(x => x.id === el.dataset.id)), { wide: true, noFocus: true }));
UI.on('viewVersion', el => {
  const l = Store.state.letters.find(x => x.id === el.dataset.id), v = l.versions.find(x => x.n === Number(el.dataset.n));
  UI.modal(`<h2>Version ${v.n}</h2><p class="muted small" style="margin:3px 0 12px">Sent ${UI.fmtDateLong(v.sentAt)}</p><div class="letter-text card soft">${esc(v.text)}</div><div style="margin-top:14px"><button class="btn" data-act="closeModal">Close</button></div>`, { wide: true, noFocus: true });
});
UI.onSubmit('sendLetterText', form => {
  const l = Store.state.letters.find(x => x.id === form.dataset.id), user = Session.user(), text = form.elements.text.value;
  if (!text.trim()) return UI.showErrors(form, { text: 'The letter is empty. Write it before sending.' });
  const br = text.match(/\[[^\]]*\]/g);
  if (br) return UI.showErrors(form, { text: `Replace the placeholders in [brackets] with real details before sending. Still to fill in: ${br.slice(0, 3).join(', ')}${br.length > 3 ? '…' : ''}` });
  const s = Store.user(l.studentId);
  UI.confirm(form.dataset.mode === 'write' ? 'Sign and send this letter?' : 'Sign and send the updated letter?', `${s.name} will be able to download it straight away.`, 'Sign and send', () => {
    l.versions.push({ n: l.versions.length + 1, text: text.trim(), sentAt: new Date().toISOString() });
    l.status = 'ready'; l.draft = '';
    Store.event(l.studentId, 'letter', `Your letter from ${Names.staff(user)} is ready${l.versions.length > 1 ? ` (version ${l.versions.length})` : ''}`, l.id);
    Store.save(); UI.state('sl', { tab: 'ready', declineId: null }).tab = 'ready';
    UI.toast(`Sent. ${s.name.split(' ')[0]} has been told.`); UI.go('/staff/letters');
  });
});
