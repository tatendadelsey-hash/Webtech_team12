/* Supervisor screens: home and student portfolio + attachment monitoring. */

const PV = Views.sup;
const wrapP = (user, active, inner) => Views.shell.wrap(user, active, inner);

PV.noteDue = (att) => { const w = Q.attachmentWeek(att); return !att.notes.some(n => n.week === w); };
PV.endingSoon = (att) => Q.daysLeft(att) <= 21;
PV.range = (att) => `${UI.fmtDate(att.start)} to ${UI.fmtDate(att.end)}`;

PV.home = ({ user }) => {
  const list = Q.supervisorStudents(user);
  const due = list.filter(x => PV.noteDue(x.att));
  const ending = list.filter(x => PV.endingSoon(x.att));
  const reports = ending.filter(x => !x.att.report);
  const next = ending.slice().sort((a, b) => a.att.end.localeCompare(b.att.end))[0];
  const attention = [
    ...due.map(x => `<div class="item"><span class="status wait">●</span><div class="grow"><b>${esc(x.student.name)}</b>: week ${Q.attachmentWeek(x.att)} progress note is due Friday</div><a class="btn primary small" href="#/supervisor/students/${x.student.id}">Write note</a></div>`),
    ...reports.map(x => `<div class="item"><span class="status bad">⏱</span><div class="grow"><b>${esc(x.student.name)}</b>: attachment ends in ${Q.daysLeft(x.att)} days. Final report needed.</div><button class="btn small" data-act="startReport" data-id="${x.student.id}">Start report</button></div>`),
  ];
  return wrapP(user, '', `
    <div class="hero">${UI.avatarEditable(user)}<div><h1>${UI.greeting ? UI.greeting() : "Hello"}, ${esc(user.name)}</h1><p class="muted">${esc(user.department)}${user.unit ? ' · ' + esc(user.unit) : ''}</p></div></div>
    <div class="grid g3 stats-row" style="margin-bottom:18px">
      <div class="stat"><div class="lbl">Students with you</div><div class="num">${list.length}</div></div>
      <div class="stat"><div class="lbl">Progress notes due</div><div class="num">${due.length}</div><div class="sub warn">${due.length ? 'Due this week' : 'All up to date'}</div></div>
      <div class="stat"><div class="lbl">Attachments ending soon</div><div class="num">${ending.length}</div><div class="sub warn">${next ? `Ends in ${Q.daysLeft(next.att)} days` : 'None this month'}</div></div>
    </div>
    <h2 style="margin-bottom:8px">Needs your attention</h2>
    <div class="card" style="margin-bottom:20px"><div class="list">${attention.join('') || '<p class="muted small">Nothing needs you right now. Notes and reports that fall due will show here.</p>'}</div></div>
    <h2 style="margin-bottom:8px">Students on attachment with you</h2>
    ${list.length ? `<div class="card"><div class="list">${list.map(({ att, student: s }) => { const w = Q.attachmentWeek(att); const soon = PV.endingSoon(att);
      return `<div class="item">${UI.avatar(s)}<div class="grow"><b>${esc(s.name)}</b><div class="muted small">${esc(s.programme)} · Year ${s.year}</div>
        <div class="row" style="flex-wrap:nowrap;margin-top:5px"><div class="progress" style="width:130px"><i style="width:${Math.round(w / att.weeks * 100)}%"></i></div><span class="small muted">Week ${w} of ${att.weeks}</span></div></div>
        <span class="status ${soon ? 'wait' : 'ok'}">${soon ? '● Ending soon' : '✓ On track'}</span><a class="btn small" href="#/supervisor/students/${s.id}">Open portfolio</a></div>`; }).join('')}</div></div>`
      : UI.empty('No students linked to you right now', 'The registry office links students to you when their attachment starts.')}
    <p class="muted small" style="margin-top:8px">You only see the students the school has linked to you, and only while their attachment runs.</p>
  `);
};
PV.students = ({ user }) => wrapP(user, '/students', `
  ${UI.crumbs([{ label: 'Home', href: '#/supervisor' }, { label: 'My students' }])}
  <div class="page-head"><div><h1>My students</h1><p>Students linked to you while their attachment runs.</p></div></div>
  ${Q.supervisorStudents(user).map(({ att, student: s }) => `<div class="card" style="margin-bottom:10px"><div class="row between">${'<div class="row">' + UI.avatar(s) + `<div><b>${esc(s.name)}</b><div class="muted small">Week ${Q.attachmentWeek(att)} of ${att.weeks} · ${PV.range(att)}</div></div></div>`}<a class="btn small" href="#/supervisor/students/${s.id}">Open portfolio</a></div></div>`).join('') || UI.empty('No students linked to you right now', 'The registry office links students to you when their attachment starts.')}`);

/* =================== STUDENT PORTFOLIO + MONITORING =================== */
PV.monitor = ({ user, params }) => {
  const s = Store.user(params[0]);
  if (!s || !Q.canSeeStudent(user, s.id)) {
    return wrapP(user, '/students', `<div style="margin-top:30px">${UI.empty('You cannot open this portfolio', 'You can only open students the school has linked to you, and only while their attachment runs.')}<p style="margin-top:12px;text-align:center"><a class="btn" href="#/supervisor">Back to home</a></p></div>`);
  }
  const att = Q.attachment(s.id), w = Q.attachmentWeek(att);
  const st = UI.state('mon', { sid: null, tab: 'overview' });
  if (st.sid !== s.id) { st.sid = s.id; st.tab = 'overview'; }
  const pr = s.profile || {}, projs = Q.projects(s.id), acts = Q.acts(s.id);
  const verified = acts.filter(a => a.status === 'verified').length;
  const canNote = Session.can('progress_notes');
  const thisNote = att.notes.find(n => n.week === w);
  const earlier = att.notes.filter(n => n.week !== w).sort((a, b) => b.week - a.week);
  const first = s.name.split(' ')[0];
  const tabs = [['overview', 'Overview'], ['projects', `Projects (${projs.length})`], ['grades', 'Grades'], ['activities', 'Activities']];

  const overview = `<div class="grid g2" style="align-items:start">
    <div class="stack-lg">
      <div class="card"><h3>About ${esc(first)}</h3><p class="small" style="margin:6px 0">${esc(pr.bio) || '<span class="muted">No bio yet.</span>'}</p><div class="row" style="gap:6px">${(pr.skills || []).map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>
        <p class="small muted" style="margin-top:8px">${esc(s.email)} · ${esc(s.phone || '')}<br>${esc(pr.linkedin || '')}${pr.linkedin && pr.github ? ' · ' : ''}${esc(pr.github || '')}</p></div>
      <div class="card"><h3>Projects</h3><div class="list" style="margin-top:6px">${projs.slice(0, 2).map(p => `<div class="item"><div class="grow"><b>${esc(p.name)}</b><div class="muted small">${esc(p.challenge || p.goal)} ${esc(p.result)}</div></div><div class="row" style="gap:6px">${UI.link(p.liveUrl, 'Live')}${UI.link(p.codeUrl, 'Code')}</div></div>`).join('') || '<p class="muted small">No projects yet.</p>'}
        ${projs.length > 2 ? `<p class="small muted" style="padding-top:8px">${esc(projs[2].name)}${projs.length > 3 ? ` and ${projs.length - 3} more` : ''}. See the Projects tab.</p>` : ''}</div></div>
      <div class="grid g2"><div class="stat"><div class="lbl">Overall GPA</div><div class="num">${Calc.fmt(Calc.overall(s.id))}</div><div class="sub good">✓ Certified, read only</div></div>
        <div class="stat"><div class="lbl">Activities</div><div class="num">${acts.length}</div><div class="sub muted">${verified} verified by teachers</div></div></div>
    </div>
    <div class="card"><form id="note-form" data-submit="saveNote" data-sid="${s.id}" novalidate>
      <h3>Progress during the attachment</h3><p class="muted small">1 means needs work, 5 means excellent.</p>
      ${canNote ? [['punctuality', 'Punctuality'], ['quality', 'Quality of work'], ['teamwork', 'Teamwork']].map(([k, l]) => `<input type="hidden" name="${k}" value="${thisNote && thisNote.ratings[k] || ''}">${UI.ratingRow(l, k, thisNote && thisNote.ratings[k] || 0)}`).join('')
        + `<label class="field" for="nt-text">This week's note (week ${w})</label><textarea class="input" id="nt-text" name="text" placeholder="Delivered the reports page on time and helped a teammate fix a bug.">${esc(thisNote ? thisNote.text : '')}</textarea>
        <button class="btn primary block" style="margin-top:12px">Save progress note</button><p class="hint">${esc(first)} and their lecturers can see your notes.</p>` : '<p class="muted small" style="margin-top:8px">Writing progress notes is switched off for your role.</p>'}
      </form>
      <div style="margin-top:14px;border-top:1px solid var(--line-soft);padding-top:10px"><h3>Earlier notes</h3>${earlier.map(n => `<div class="item" style="display:block;padding:8px 0"><div class="row between"><b>Week ${n.week}</b><span class="muted small">${UI.fmtDate(n.ts)}</span></div><div class="small">${esc(n.text)}</div></div>`).join('') || '<p class="muted small">No earlier notes.</p>'}</div>
      <div class="row between" style="margin-top:8px;border-top:1px solid var(--line-soft);padding-top:12px"><div><b>Final attachment report</b><div class="muted small">${att.report ? `Submitted ${UI.fmtDate(att.report.ts)}` : `Due ${UI.fmtDate(att.end)}`}</div></div>
        <button class="btn small" data-act="startReport" data-id="${s.id}">${att.report ? 'View report' : 'Start report'}</button></div>
    </div></div>`;

  const sems = Calc.sems(s.id);
  const tabBody = {
    overview,
    projects: projs.length ? `<div class="grid g2" style="align-items:start">${projs.map(p => SV.projectCard(p, s, true)).join('')}</div>` : UI.empty('No projects yet', `${first} has not added any projects.`),
    grades: sems.length ? `<div class="card soft" style="margin-bottom:12px"><div class="muted small">Overall GPA</div><div style="font-size:1.9rem;font-weight:800">${Calc.fmt(Calc.overall(s.id))}</div><div class="good small bold">✓ Certified, read only · ${Calc.credits(s.id)} of 120 credits</div></div>
      ${sems.map(x => `<div class="card" style="margin-bottom:10px;padding:12px 14px"><div class="row between"><b>Year ${x.year}, Semester ${x.sem}</b><b>${Calc.fmt(Calc.semGpa(x))}</b></div><table class="tbl small">${x.courses.map(c => `<tr><td>${esc(c.title)} <span class="muted xs">${esc(c.code)}</span></td><td class="c">${c.credits} cr</td><td class="c bold">${esc(c.grade)}</td></tr>`).join('')}</table></div>`).join('')}` : UI.empty('No grades yet', 'Grades appear once the registry office certifies them.'),
    activities: acts.length ? `<div class="card list">${acts.sort((a, b) => b.year - a.year).map(a => `<div class="item"><span class="dot">${Names.typeLetter[a.type]}</span><div class="grow"><b>${esc(a.title)}</b><div class="muted small">${esc(Names.typeLabel[a.type])} · Year ${a.year}${a.detail ? ' · ' + esc(a.detail) : ''}</div></div>${SV.actStatus(a)}</div>`).join('')}</div>` : UI.empty('No activities yet', `${first} has not added any activities.`),
  }[st.tab];

  return wrapP(user, '/students', `
    ${UI.crumbs([{ label: 'Home', href: '#/supervisor' }, { label: 'My students', href: '#/supervisor/students' }, { label: s.name }])}
    <div class="row between" style="margin-bottom:14px;align-items:flex-start"><div class="row" style="gap:14px">${UI.avatar(s, 'lg')}<div><h1>${esc(s.name)}</h1><p class="muted">${esc(s.schoolId)} · Year ${s.year} · ${esc(s.programme)}</p></div></div>
      <div class="stat"><div class="lbl">Attachment at ${esc(att.company)}</div><div class="bold" style="font-size:1.1rem">Week ${w} of ${att.weeks}</div><div class="progress" style="margin:6px 0"><i style="width:${Math.round(w / att.weeks * 100)}%"></i></div><div class="muted small">${PV.range(att)}</div></div></div>
    <div class="banner info" style="margin-bottom:14px">ⓘ You can see this student's whole portfolio: profile, projects, grades, activities and contact details.</div>
    <div class="tabs" style="margin-bottom:14px">${tabs.map(([k, l]) => `<button class="chip ${st.tab === k ? 'on' : ''}" data-act="monTab" data-tab="${k}">${l}</button>`).join('')}</div>
    ${tabBody}`);
};
UI.on('monTab', el => { UI.state('mon').tab = el.dataset.tab; UI.render(); });
UI.onSubmit('saveNote', form => {
  const user = Session.user(), d = UI.formData(form), att = Q.attachment(form.dataset.sid), w = Q.attachmentWeek(att);
  const r = k => d[k] ? Number(d[k]) : null;
  if (!Session.can('progress_notes')) return UI.toast('Your role cannot write progress notes.', true);
  if (!r('punctuality') && !r('quality') && !r('teamwork') && !d.text.trim()) return UI.showErrors(form, { text: 'Give at least one rating or write a note.' });
  const rec = { week: w, text: d.text.trim(), ratings: { punctuality: r('punctuality'), quality: r('quality'), teamwork: r('teamwork') }, ts: new Date().toISOString() };
  const i = att.notes.findIndex(n => n.week === w); if (i >= 0) att.notes[i] = rec; else att.notes.push(rec);
  Store.event(att.studentId, 'note', `${user.name} added a progress note for week ${w}`, null);
  Store.save(); UI.clearDrafts('note-form'); UI.toast(`Progress note for week ${w} saved.`); UI.render();
});

/* ---- final report ---- */
UI.on('startReport', el => {
  const s = Store.user(el.dataset.id), att = Q.attachment(s.id), r = att.report;
  UI.modal(`<h2>Final attachment report: ${esc(s.name)}</h2><p class="muted small" style="margin:3px 0 12px">${esc(att.company)} · ${PV.range(att)} · due ${UI.fmtDate(att.end)}</p>
    <form id="report-form" data-submit="saveReport" data-sid="${s.id}" novalidate>
      <input type="hidden" name="overall" value="${r ? r.overall : ''}">${UI.ratingRow('Overall performance', 'overall', r ? r.overall : 0)}
      <label class="field" for="rp-sum">Summary of the attachment</label><textarea class="input" id="rp-sum" name="summary" style="min-height:120px" placeholder="What did ${esc(s.name.split(' ')[0])} work on, and how did they do?">${esc(r ? r.summary : '')}</textarea>
      <label class="field" for="rp-rec">Would you recommend them for a job?</label><select class="input" id="rp-rec" name="recommend">${['Yes', 'Yes, with some more experience', 'Not yet'].map(o => `<option ${r && r.recommend === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
      <div class="row" style="margin-top:14px"><button class="btn primary">${r ? 'Update report' : 'Submit report'}</button><button type="button" class="btn" data-act="closeModal">Cancel</button></div></form>`, { wide: true });
});
UI.onSubmit('saveReport', form => {
  const d = UI.formData(form), errs = {}, att = Q.attachment(form.dataset.sid);
  if (!d.overall) errs.summary = 'Give an overall rating from 1 to 5.';
  else if (!d.summary.trim()) errs.summary = 'Write a short summary of the attachment.';
  if (Object.keys(errs).length) return UI.showErrors(form, errs);
  att.report = { overall: Number(d.overall), summary: d.summary.trim(), recommend: d.recommend, ts: new Date().toISOString() };
  Store.event(att.studentId, 'note', `${Session.user().name} submitted your final attachment report`, null);
  Store.save(); UI.closeModal(); UI.toast('Final report saved.'); UI.render();
});
