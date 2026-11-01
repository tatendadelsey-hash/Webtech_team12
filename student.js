/* Student screens: home, grades, projects, add/edit project, activities, letters. */

const SV = Views.student;
const wrapS = (user, active, inner) => Views.shell.wrap(user, active, inner);

/* ---------- small shared pieces ---------- */
SV.actStatus = (a) => a.status === 'verified' ? '<span class="status ok">✓ Verified</span>'
  : a.status === 'evidence' ? '<span class="status bad">▲ Evidence needed</span>'
  : '<span class="status wait">● Waiting to be checked</span>';

SV.letterStatus = (l) => ({
  new: '<span class="status wait">● Waiting</span>',
  progress: '<span class="status info">✎ Being written</span>',
  ready: '<span class="status ok">✓ Ready to download</span>',
  changes: '<span class="status info">✎ Update in progress</span>',
  declined: '<span class="status bad">✕ Not available</span>',
}[l.status]);

SV.downloadLetter = (l) => {
  const v = l.versions[l.versions.length - 1]; if (!v) return;
  const student = Store.user(l.studentId);
  UI.print(`Recommendation letter for ${student.name}`, `<p class="small muted">${esc(l.purpose)} · version ${v.n} · sent ${UI.fmtDateLong(v.sentAt)}</p><div class="letter-text" style="margin-top:14pt">${esc(v.text)}</div>`);
};

/* The "What would you like changed?" panel, used on Home and My letters */
SV.changePanel = (user) => {
  const st = UI.state('changes', { id: null });
  const l = st.id && Store.state.letters.find(x => x.id === st.id && x.studentId === user.id);
  if (!l) return '';
  const staff = Store.user(l.staffId);
  return `<div class="card soft" id="change-panel"><form id="change-form" data-submit="requestChange" novalidate>
    <h3>What would you like changed? <span class="muted small" style="font-weight:400">(opens when you tap Ask for changes)</span></h3>
    <p class="muted small">${esc(Names.staff(staff))} will see your message and update the letter. Be as specific as you can.</p>
    <textarea class="input" name="text" maxlength="600" placeholder="For example: please mention my final-year project and how I led the team." data-input="count600"></textarea>
    <div class="row between hint"><span>Write what you would like changed before sending.</span><span id="count600">0 / 600</span></div>
    <div class="row" style="margin-top:10px"><button class="btn primary small">Send request</button><button type="button" class="btn small" data-act="cancelChange">Cancel</button></div>
    <p class="hint">You can still download the current version while you wait. You can ask for changes up to ${CONFIG.maxLetterChanges} times per letter.</p>
  </form></div>`;
};
UI.onInput('count600', el => { const c = $('#count600'); if (c) c.textContent = `${el.value.length} / 600`; });
UI.on('askChanges', el => { UI.state('changes').id = el.dataset.id; UI.clearDrafts('change-form'); UI.render(); const p = $('#change-panel'); if (p) { p.scrollIntoView({ block: 'center' }); $('textarea', p).focus(); } });
UI.on('cancelChange', () => { UI.state('changes').id = null; UI.clearDrafts('change-form'); UI.render(); });
UI.on('downloadLetter', el => SV.downloadLetter(Store.state.letters.find(l => l.id === el.dataset.id)));
UI.onSubmit('requestChange', form => {
  const user = Session.user(), l = Store.state.letters.find(x => x.id === UI.state('changes').id);
  const text = form.elements.text.value.trim();
  if (!text) return UI.showErrors(form, { text: 'Write what you would like changed before sending.' });
  if (l.changesUsed >= CONFIG.maxLetterChanges) return UI.showErrors(form, { text: 'You have used all your changes for this letter.' });
  l.changesUsed += 1; l.status = 'changes';
  l.changeRequests.push({ n: l.changesUsed, text, ts: new Date().toISOString() });
  Store.save(); UI.clearDrafts('change-form'); UI.state('changes').id = null;
  UI.toast(`Sent to ${Names.staff(Store.user(l.staffId))}. You can still download the current version.`); UI.render();
});

/* =================== HOME =================== */
SV.home = ({ user }) => {
  const sems = Calc.sems(user.id), latest = Calc.latest(user.id), prev = Calc.previous(user.id);
  const overall = Calc.overall(user.id), credits = Calc.credits(user.id), pct = Math.min(100, Math.round(credits / 120 * 100));
  const S = Store.state;
  const readyLetters = Q.letters(user.id).filter(l => l.status === 'ready' || l.status === 'changes').length;
  const waiting = Q.acts(user.id).filter(a => a.status === 'waiting').length;
  const needEvidence = Q.acts(user.id).filter(a => a.status === 'evidence').length;
  const bits = [];
  if (readyLetters) bits.push(`${readyLetters === 1 ? 'a letter is' : readyLetters + ' letters are'} ready to download`);
  if (needEvidence) bits.push(`${needEvidence === 1 ? 'one activity needs' : needEvidence + ' activities need'} evidence from you`);
  if (waiting) bits.push(`${waiting === 1 ? 'one activity is' : waiting + ' activities are'} waiting for a teacher to check ${waiting === 1 ? 'it' : 'them'}`);
  const count = readyLetters + (needEvidence ? 1 : 0) + (waiting ? 1 : 0);
  const banner = bits.length ? `<div class="banner warn" style="margin-bottom:14px">● ${count === 1 ? 'One thing needs' : count + ' things need'} you: ${bits.join(', and ')}.</div>` : '';

  const hs = UI.state('home', { allSems: false });
  const delta = latest && prev ? Calc.semGpa(latest) - Calc.semGpa(prev) : null;
  const deltaTxt = delta == null ? '' : Math.abs(delta) < 0.005 ? `Same as last semester (${Calc.fmt(Calc.semGpa(prev))})` : delta > 0 ? `↑ Up from ${Calc.fmt(Calc.semGpa(prev))} last semester` : `↓ Down from ${Calc.fmt(Calc.semGpa(prev))} last semester`;

  // recent updates
  const seenLetters = new Set();
  const events = S.events.filter(e => e.userId === user.id).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 6);
  const evRows = events.map(e => {
    const icon = { verified: '✓', waiting: '●', letter: '↓', comment: '💬', assessment: '★', evidence: '▲', note: '✎' }[e.kind] || '•';
    const cls = { verified: 'ok', waiting: 'wait', letter: 'info', comment: 'info', assessment: 'info', evidence: 'bad', note: 'info' }[e.kind] || '';
    let right = { verified: '<span class="status ok">Verified</span>', waiting: '<span class="status wait">Waiting</span>', evidence: '<span class="status bad">Evidence needed</span>' }[e.kind] || '';
    if (e.kind === 'letter') {
      const l = S.letters.find(x => x.id === e.ref);
      if (l && (l.status === 'ready' || l.status === 'changes') && !seenLetters.has(l.id)) {
        seenLetters.add(l.id);
        right = `<span class="row" style="gap:6px"><button class="btn small" data-act="downloadLetter" data-id="${l.id}">Download</button>${l.changesUsed < CONFIG.maxLetterChanges && l.status === 'ready' ? `<button class="btn small" data-act="askChanges" data-id="${l.id}">Ask for changes</button>` : ''}</span>`;
      }
    }
    return `<div class="item"><span class="status ${cls}" aria-hidden="true" style="width:18px">${icon}</span><div class="grow">${esc(e.text)}<div class="xs muted">${UI.fmtWhen(e.ts)}</div></div><div>${right}</div></div>`;
  }).join('');

  // feedback from teachers and supervisor
  const fb = [];
  S.assessments.filter(a => a.studentId === user.id).forEach(a => fb.push({ ts: a.ts, who: Names.staff(Store.user(a.staffId)), ratings: [['Leadership', a.leadership], ['Teamwork', a.teamwork], ['Communication', a.communication]].filter(r => r[1]), text: a.feedback }));
  const att = Q.attachment(user.id);
  if (att) att.notes.forEach(n => fb.push({ ts: n.ts, who: `${Store.user(att.supervisorId).name} (${att.company}), week ${n.week}`, ratings: [['Punctuality', n.ratings.punctuality], ['Quality of work', n.ratings.quality], ['Teamwork', n.ratings.teamwork]].filter(r => r[1]), text: n.text }));
  fb.sort((a, b) => b.ts.localeCompare(a.ts));
  const fbHtml = fb.length ? `<div class="card"><h3>Feedback about you</h3><div class="list" style="margin-top:8px">${fb.slice(0, 3).map(f => `<div class="item" style="display:block"><div class="bold small">${esc(f.who)} <span class="muted" style="font-weight:400">· ${UI.fmtDate(f.ts)}</span></div>${f.ratings.length ? `<div class="small muted">${f.ratings.map(r => `${esc(r[0])} ${r[1]}/5`).join(' · ')}</div>` : ''}${f.text ? `<div class="small" style="margin-top:3px">${esc(f.text)}</div>` : ''}</div>`).join('')}</div></div>` : '';

  const yearGpa = (y) => { const ss = sems.filter(s => s.year === y); const cr = ss.reduce((a, s) => a + Calc.semCredits(s), 0); return cr ? ss.reduce((a, s) => a + Calc.semGpa(s) * Calc.semCredits(s), 0) / cr : null; };
  const yBars = [1, 2, 3, 4].map(y => { const g = yearGpa(y); return `<div class="yb"><div class="yb-col">${g == null ? '<i class="e"></i>' : `<i style="height:${Math.max(8, Math.round((g - 2) / 2 * 100))}%"></i>`}</div><div class="yb-lbl">Year ${y}</div><div class="yb-v">${g == null ? '–' : g.toFixed(2)}</div></div>`; }).join('');
  const topOf = (type) => { const l = Q.acts(user.id).filter(a => a.type === type); return { n: l.length, v: l.filter(a => a.status === 'verified').length, items: l.slice().sort((a, b) => b.year - a.year).slice(0, 2) }; };
  const sumCard = ([type, label]) => { const x = topOf(type); return `<div class="card sum"><div class="row between"><h3>${label}</h3><span class="badge">${x.v} of ${x.n} verified</span></div>
      <div class="sum-list">${x.items.map(a => `<div>${esc(a.title)} <span class="muted xs">Year ${a.year}</span></div>`).join('') || '<span class="muted small">Nothing yet</span>'}</div>
      <button class="btn link small" data-act="goActs" data-f="${type}">See all</button></div>`; };
  const L = Q.letters(user.id);
  return wrapS(user, '', `
    <div class="profile card"><div class="prow">${UI.avatarEditable(user)}<div class="grow"><h1>Welcome, ${esc(user.name.split(' ')[0])}</h1><p class="muted">${esc(user.schoolId)} · Year ${user.year} · ${esc(user.programme)}</p></div><button class="btn small" data-act="printRecord">⬇ Download my portfolio (PDF)</button></div></div>
    ${banner}
    <div class="grid g3 stats-row" style="margin-bottom:14px">
      <div class="stat"><div class="lbl">Current GPA</div><div class="num">${latest ? Calc.fmt(Calc.semGpa(latest)) : '–'}</div><div class="sub ${delta != null && delta < 0 ? 'warn' : 'good'}">${latest ? deltaTxt || 'First certified semester' : 'Appears once grades are certified'}</div></div>
      <div class="stat"><div class="lbl">Cumulative GPA</div><div class="num">${Calc.fmt(overall)}</div><div class="sub good">${overall != null ? '✓ School certified' : 'Not certified yet'}</div></div>
      <div class="stat"><div class="lbl">Credits earned</div><div class="num">${credits}</div><div class="progress" style="margin:6px 0" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><div class="sub muted">of 120 required (${pct}%)</div></div>
    </div>
    <div class="card" style="margin-bottom:14px"><div class="row between"><h3>GPA by year</h3><a class="small" href="#/student/grades">View full record</a></div>
      <div class="ybars">${yBars}</div>
      <div class="chart"><p class="muted small" style="margin:10px 0 0">Semester by semester</p>${SV.gpaChart(sems)}</div></div>
    <div class="grid g3" style="margin-bottom:14px">${[['achievement', 'Achievements'], ['leadership', 'Leadership'], ['extra', 'Activities']].map(sumCard).join('')}</div>
    <div class="card letter-strip" style="margin-bottom:14px"><div class="grow"><h3>Recommendation letters</h3><span class="muted small">${L.filter(l => l.status === 'new' || l.status === 'progress').length} pending · ${L.filter(l => l.status === 'ready' || l.status === 'changes').length} ready to download</span></div><a class="btn primary" href="#/student/letters">Request a letter</a></div>
    ${SV.timeline(user)}
    <div class="card" style="margin-bottom:14px"><h3>Recent updates</h3><div class="list" style="margin-top:8px">${evRows || '<p class="muted small">Nothing yet. Updates about your entries and letters will show here.</p>'}</div></div>
    ${SV.changePanel(user)}
    ${fbHtml ? `<div style="margin-top:14px">${fbHtml}</div>` : ''}
  `);
};
/* "My journey": every entry on one line of time, by year. Green = checked by a teacher. */
SV.timeline = (user) => {
  const acts = Q.acts(user.id); if (!acts.length) return '';
  const years = [...new Set(acts.map(a => a.year))].sort((a, b) => a - b);
  const cls = { verified: 'ok', waiting: 'wait', evidence: 'bad' };
  const lbl = { verified: 'Verified', waiting: 'Waiting', evidence: 'Evidence needed' };
  return `<div class="card" style="margin-bottom:14px"><h3>My journey</h3><p class="muted small">Everything you have done, year by year. Green means a teacher has checked it.</p>
    <div class="tl">${years.map(y => `<div class="tl-year"><div class="tl-y">Year ${y}</div><div class="tl-items">${acts.filter(a => a.year === y).map(a => `<div class="tl-item ${cls[a.status] || ''}"><i></i><div><b>${esc(a.title)}</b> <span class="muted small">${esc(Names.typeShort[a.type])}</span><div class="xs ${cls[a.status] === 'ok' ? 'good' : 'muted'}">${lbl[a.status] || ''}</div></div></div>`).join('')}</div></div>`).join('')}</div></div>`;
};
UI.on('toggleSems', () => { const s = UI.state('home'); s.allSems = !s.allSems; UI.render(); });

SV.gpaChart = (sems) => {
  if (!sems.length) return UI.empty('No grades yet', 'Your GPA graph appears here once the registry office has certified your first semester.');
  const W = 640, H = 210, L = 44, R = 20, T = 22, B = 36;
  const vals = sems.map(Calc.semGpa);
  const yMin = Math.min(3.0, Math.floor(Math.min(...vals) * 2) / 2), yMax = 4.0;
  const x = i => sems.length === 1 ? (L + W - R) / 2 : L + (W - L - R) * i / (sems.length - 1);
  const y = v => T + (H - T - B) * (1 - (v - yMin) / (yMax - yMin));
  const grid = []; for (let g = yMin; g <= yMax + 0.001; g += 0.5) grid.push(g);
  const best = Math.max(...vals);
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const years = [...new Set(sems.map(s => s.year))];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line graph of GPA by semester. Latest ${Calc.fmt(vals[vals.length - 1])}.">
    ${grid.map(g => `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line-soft)"/><text x="${L - 8}" y="${y(g) + 4}" text-anchor="end" font-size="12" fill="var(--muted)">${g.toFixed(1)}</text>`).join('')}
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
    ${vals.map((v, i) => { const last = i === vals.length - 1; return `<circle cx="${x(i)}" cy="${y(v)}" r="${last ? 7 : 5}" fill="${last ? 'var(--accent)' : 'var(--card)'}" stroke="var(--accent)" stroke-width="2.5"><title>Year ${sems[i].year}, Semester ${sems[i].sem}: ${Calc.fmt(v)}</title></circle>${last || v === best ? `<text x="${x(i)}" y="${y(v) - 12}" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--accent)">${Calc.fmt(v)}</text>` : ''}`; }).join('')}
    ${years.map(yr => { const idx = sems.map((s, i) => s.year === yr ? i : -1).filter(i => i >= 0); const cx = (x(idx[0]) + x(idx[idx.length - 1])) / 2; return `<text x="${cx}" y="${H - 10}" text-anchor="middle" font-size="12.5" fill="var(--muted)">Year ${yr}</text>`; }).join('')}
  </svg>`;
};

/* =================== GRADES =================== */
SV.grades = ({ user }) => {
  const sems = Calc.sems(user.id), latest = Calc.latest(user.id);
  const gs = UI.state('grades', { year: null });
  if (gs.year == null) gs.year = latest ? latest.year : 1;
  const overall = Calc.overall(user.id), credits = Calc.credits(user.id);
  const ys = [1, 2].map(n => sems.find(s => s.year === gs.year && s.sem === n));
  const body = ys.some(Boolean)
    ? `<div class="grid g3 stats-row" style="margin-bottom:14px">
        ${[1, 2].map(n => `<div class="stat"><div class="lbl">Semester ${n} GPA</div><div class="num">${ys[n - 1] ? Calc.fmt(Calc.semGpa(ys[n - 1])) : '–'}</div><div class="sub muted">${ys[n - 1] ? Calc.semCredits(ys[n - 1]) + ' credits' : 'Not certified yet'}</div></div>`).join('')}
        <div class="stat"><div class="lbl">Cumulative GPA</div><div class="num">${Calc.fmt(overall)}</div><div class="sub good">${overall != null ? '✓ School certified' : 'Not certified yet'} · ${credits} of 120 credits</div></div></div>
      ${ys.map((sem, i) => sem ? `<div class="card" style="margin-bottom:14px"><div class="row between"><h3>Semester ${i + 1}</h3><span class="muted small">Certified ${esc(sem.certified)}</span></div>
        <table class="tbl" style="margin-top:8px"><thead><tr><th>Code</th><th>Course</th><th class="c">Credits</th><th class="c">Grade</th><th class="right">Points</th></tr></thead><tbody>
        ${sem.courses.map(c => `<tr><td class="muted">${esc(c.code)}</td><td><b>${esc(c.title)}</b></td><td class="c">${c.credits}</td><td class="c bold">${esc(c.grade)}</td><td class="right">${Calc.points(c.grade)}</td></tr>`).join('')}</tbody></table></div>` : '').join('')}`
    : `<div style="margin-top:12px">${UI.empty(`Year ${gs.year} has no certified grades yet`, 'Your grades will show here once the registry office has certified them.')}</div>`;
  return wrapS(user, '/grades', `
    <div class="page-head"><div><h1>Academic record</h1><p>Every grade from Year 1 to the final year, in one place.</p></div>
      ${sems.length ? `<button class="btn primary" data-act="transcript">Download transcript</button>` : ''}</div>
    <div class="banner ok" style="margin-bottom:12px">Grades are certified by the registrar's office, and you cannot change them.</div>
    <div class="utabs" role="tablist">${[1, 2, 3, 4].map(y => `<button class="${gs.year === y ? 'on' : ''}" data-act="gradeYear" data-y="${y}">Year ${y}</button>`).join('')}</div>
    ${body}
    <p class="muted small" style="margin-top:6px">Think a grade is wrong? <a href="mailto:${CONFIG.registryEmail}?subject=Question about my grades (${esc(user.schoolId)})">Contact the registry office</a></p>
  `);
};
UI.on('gradeYear', el => { UI.state('grades').year = Number(el.dataset.y); UI.render(); });
UI.on('transcript', () => {
  const user = Session.user(), sems = Calc.sems(user.id);
  UI.print(`Official transcript: ${user.name}`, `<p>${esc(user.schoolId)} · ${esc(user.programme)}</p>
    <p><b>Overall GPA ${Calc.fmt(Calc.overall(user.id))}</b> · ${Calc.credits(user.id)} of 120 credits · certified by the registry office</p>
    ${sems.map(s => `<h2>Year ${s.year}, Semester ${s.sem} · GPA ${Calc.fmt(Calc.semGpa(s))} <span style="font-weight:400;font-size:10pt">(certified ${esc(s.certified)})</span></h2>
      <table><thead><tr><th>Code</th><th>Course</th><th>Credits</th><th>Grade</th><th>Points</th></tr></thead><tbody>${s.courses.map(c => `<tr><td>${esc(c.code)}</td><td>${esc(c.title)}</td><td>${c.credits}</td><td>${esc(c.grade)}</td><td>${Calc.points(c.grade)}</td></tr>`).join('')}</tbody></table>`).join('')}`);
});

/* =================== PROJECTS =================== */
SV.projectCard = (p, user, readonlyView) => {
  const open = (UI.state('projects', { open: {} }).open || {})[p.id];
  return `<div class="card" style="display:flex;flex-direction:column">
    <div class="row between" style="align-items:flex-start"><h3>${esc(p.name)}</h3><span class="badge">${esc(p.kind)} · ${esc(p.team)}</span></div>
    ${[['Goal', p.goal], ['Challenge and what I did', p.challenge], ['My role', p.role]].map(([l, t]) => t ? `<div class="muted xs" style="margin-top:9px">${l}</div><div class="small">${esc(t)}</div>` : '').join('')}
    ${p.result ? `<div class="muted xs" style="margin-top:9px">Result</div><div class="small bold">${esc(p.result)}</div>` : ''}
    <div class="row" style="margin-top:12px">${UI.link(p.liveUrl, 'Open live version')}${UI.link(p.codeUrl, 'View code')}
      ${readonlyView ? '' : `<a class="btn small" href="#/student/projects/edit/${p.id}">Edit</a>`}
      ${p.comments && p.comments.length ? `<button class="btn small" data-act="toggleProjComments" data-id="${p.id}">Comments (${p.comments.length})</button>` : ''}</div>
    ${open && p.comments ? p.comments.map(c => `<div class="comment"><b>${esc(Names.staff(Store.user(c.by)))}:</b> ${esc(c.text)}</div>`).join('') : ''}
  </div>`;
};
UI.on('toggleProjComments', el => { const s = UI.state('projects', { open: {} }); s.open = s.open || {}; s.open[el.dataset.id] = !s.open[el.dataset.id]; UI.render(); });

SV.projects = ({ user }) => {
  const list = Q.projects(user.id), pr = user.profile || {};
  const n = list.length;
  const counter = n < CONFIG.goodProjectsMin ? `<span class="warn bold small">Add ${CONFIG.goodProjectsMin - n} more to reach a good number</span>` : n <= CONFIG.goodProjectsMax ? '<span class="good bold small">✓ A good number</span>' : '<span class="warn bold small">That is a lot. Consider keeping your best six.</span>';
  const canEdit = Session.can('edit_profile');
  return wrapS(user, '/projects', `
    ${UI.crumbs([{ label: 'Home', href: '#/student' }, { label: 'My projects' }])}
    <div class="page-head"><div><h1>My projects</h1><p>Show your best work. Three to six strong projects work better than lots of small ones. Your supervisor and lecturers can see this page.</p></div>
      ${canEdit ? `<a class="btn primary" href="#/student/projects/new">+ Add a project</a>` : ''}</div>
    <div class="row" style="margin-bottom:12px"><span class="chip on static">${n} of ${CONFIG.goodProjectsMax} projects</span>${counter}</div>
    ${SV.aboutCard(user, pr, canEdit)}
    ${n === 0 ? `<div style="margin-top:14px">${UI.empty('No projects yet', 'Add your first project. Tell employers the goal, the challenge, your role and the result.')}</div>` : `
    <div class="grid g2" style="margin-top:14px;align-items:start">${list.slice(0, 2).map(p => SV.projectCard(p, user)).join('')}</div>
    ${n > 2 ? `<div class="card" style="margin-top:14px"><h3>More projects</h3><div class="list" style="margin-top:8px">${list.slice(2).map((p, i) => `<div class="item"><span class="dot">${i + 3}</span><div class="grow"><b>${esc(p.name)}</b><div class="muted small">${esc(p.kind)} · ${esc(p.team)}</div></div><button class="btn small" data-act="openProject" data-id="${p.id}">Open</button></div>`).join('')}</div></div>` : ''}`}
  `);
};
SV.aboutCard = (user, pr, canEdit) => `<div class="card"><div class="row between"><h3>About me</h3>${canEdit ? '<button class="btn small" data-act="editAbout">Edit</button>' : ''}</div>
  <div class="grid g2" style="margin-top:8px"><div><div class="muted xs">Short bio</div><p class="small">${esc(pr.bio) || '<span class="muted">No bio yet.</span>'}</p>
    <div class="muted xs" style="margin-top:9px">Skills</div><div class="row" style="gap:6px;margin-top:4px">${(pr.skills || []).map(s => `<span class="tag">${esc(s)}</span>`).join('') || '<span class="muted small">None yet</span>'}</div></div>
    <div><div class="muted xs">How to reach me</div><div class="small stack" style="margin-top:4px"><div>Email: ${esc(user.email)}</div><div>Phone: ${esc(user.phone || '–')}</div><div>LinkedIn: ${esc(pr.linkedin || '–')}</div><div>GitHub: ${esc(pr.github || '–')}</div></div></div></div></div>`;

UI.on('openProject', el => {
  const p = Store.state.projects.find(x => x.id === el.dataset.id);
  UI.modal(`${SV.projectCard(p, Session.user())}<div style="margin-top:14px"><button class="btn" data-act="closeModal">Close</button></div>`, { wide: true });
});
UI.on('editAbout', () => {
  const u = Session.user(), p = u.profile || {};
  UI.modal(`<h2>About me</h2><p class="muted small" style="margin:3px 0 12px">Supervisors, lecturers and recruiters read this first.</p>
    <form id="about-form" data-submit="saveAbout" novalidate>
      <label class="field" for="ab-bio">Short bio</label><textarea class="input" id="ab-bio" name="bio" maxlength="400">${esc(p.bio || '')}</textarea><div class="hint">Up to 400 characters. Say what you do well and what you want next.</div>
      <label class="field" for="ab-sk">Skills <span class="opt">(separate with commas)</span></label><input class="input" id="ab-sk" name="skills" value="${esc((p.skills || []).join(', '))}">
      <label class="field" for="ab-ph">Phone</label><input class="input" id="ab-ph" name="phone" value="${esc(u.phone || '')}">
      <label class="field" for="ab-li">LinkedIn</label><input class="input" id="ab-li" name="linkedin" value="${esc(p.linkedin || '')}" placeholder="linkedin.com/in/yourname">
      <label class="field" for="ab-gh">GitHub</label><input class="input" id="ab-gh" name="github" value="${esc(p.github || '')}" placeholder="github.com/yourname">
      <p class="hint">Your email (${esc(u.email)}) comes from school records and cannot be changed here.</p>
      <div class="row" style="margin-top:14px"><button class="btn primary">Save</button><button type="button" class="btn" data-act="closeModal">Cancel</button></div></form>`);
});
UI.onSubmit('saveAbout', form => {
  const u = Session.user(), d = UI.formData(form), errs = {};
  if (d.bio.length > 400) errs.bio = 'Keep the bio to 400 characters or fewer.';
  if (d.phone && !/^[+\d][\d\s-]{6,}$/.test(d.phone.trim())) errs.phone = 'Enter a phone number such as +263 77 123 4567.';
  if (Object.keys(errs).length) return UI.showErrors(form, errs);
  u.profile = Object.assign(u.profile || {}, { bio: d.bio.trim(), skills: d.skills.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12), linkedin: d.linkedin.trim(), github: d.github.trim() });
  u.phone = d.phone.trim();
  Store.save(); UI.closeModal(); UI.toast('Your profile is saved.'); UI.render();
});

/* ---- add / edit a project ---- */
SV.strength = (v) => {
  const has = s => (s || '').trim().length > 0;
  const checks = [['Goal', has(v.goal)], ['Problems and how you solved them', has(v.challenge)], ['Your role', has(v.role)], ['Result with numbers', has(v.result) && /\d/.test(v.result)], ['Link to the live version', has(v.liveUrl)], ['Link to the code', has(v.codeUrl)]];
  const done = checks.filter(c => c[1]).length;
  return `<h3>How strong is this project?</h3><p class="muted small">${done} of 6 things filled in</p><div class="progress" style="margin:8px 0 10px"><i style="width:${Math.round(done / 6 * 100)}%"></i></div>
    <div class="list">${checks.map(([l, ok]) => `<div class="item" style="padding:8px 0"><span class="status ${ok ? 'ok' : 'wait'}" style="width:18px">${ok ? '✓' : '●'}</span><span>${l}</span></div>`).join('')}</div>`;
};
UI.onInput('projStrength', el => {
  const f = el.closest('form'), v = {}; ['goal', 'challenge', 'role', 'result', 'liveUrl', 'codeUrl'].forEach(k => v[k] = f.elements[k].value);
  $('#strength-panel').innerHTML = SV.strength(v);
});

SV.projectForm = ({ user, params }) => {
  const editing = params && params[0] ? Store.state.projects.find(p => p.id === params[0] && p.userId === user.id) : null;
  if (params && params[0] && !editing) return Views.shell.redirect('/student/projects');
  const p = editing || { name: '', kind: 'Class project', team: 'Solo', goal: '', challenge: '', role: '', result: '', liveUrl: '', codeUrl: '' };
  const size = /Team of (\d+)/.exec(p.team); const teamSize = size ? size[1] : '1';
  const ta = (name, label, ph, hint) => `<label class="field" for="pf-${name}">${label}</label><textarea class="input" id="pf-${name}" name="${name}" placeholder="${esc(ph)}" data-input="projStrength">${esc(p[name])}</textarea>${hint ? `<div class="hint">${hint}</div>` : ''}`;
  return wrapS(user, '/projects', `
    ${UI.crumbs([{ label: 'Home', href: '#/student' }, { label: 'My projects', href: '#/student/projects' }, { label: editing ? 'Edit project' : 'Add a project' }])}
    <div class="page-head"><div><h1>${editing ? 'Edit project' : 'Add a project'}</h1><p>Questions guide you to write what employers look for.</p></div></div>
    <div class="grid g-side" style="align-items:start">
      <form class="card" id="project-form" data-submit="saveProject" data-id="${editing ? editing.id : ''}" novalidate>
        <label class="field" for="pf-name">Project name</label><input class="input" id="pf-name" name="name" value="${esc(p.name)}" placeholder="Library catalogue search">
        <div class="grid g2"><div><label class="field" for="pf-kind">What kind of project is it?</label><select class="input" id="pf-kind" name="kind">${Names.kinds.map(k => `<option ${k === p.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
        <div><label class="field" for="pf-team">How many people worked on it? <span class="opt">(1 if solo)</span></label><input class="input" id="pf-team" name="teamSize" type="number" min="1" max="50" value="${teamSize}"></div></div>
        ${ta('goal', 'What was the goal?', 'Help students find books faster than the old card list.')}
        ${ta('challenge', 'What problems did you hit, and how did you fix them?', 'Searches were slow on long titles. I tried two methods and picked the faster one because…', 'Explain why you made your choices, not only what you built.')}
        ${ta('role', 'What was your role?', 'Team of 3. I wrote the search and the database. (If it was a team project, say what you did.)')}
        ${ta('result', 'What was the result?', 'Searches take under 1 second. Used by 200 students.', 'Numbers help, for example time saved or people who used it.')}
        <div class="grid g2"><div><label class="field" for="pf-live">Link to the live version</label><input class="input" id="pf-live" name="liveUrl" value="${esc(p.liveUrl)}" placeholder="https://" data-input="projStrength"></div>
        <div><label class="field" for="pf-code">Link to the code (GitHub)</label><input class="input" id="pf-code" name="codeUrl" value="${esc(p.codeUrl)}" placeholder="https://github.com/" data-input="projStrength"></div></div>
        <div class="row" style="margin-top:18px"><button class="btn primary">Save project</button><a class="btn" href="#/student/projects">Cancel</a>
          ${editing ? `<button type="button" class="btn danger" style="margin-left:auto" data-act="deleteProject" data-id="${editing.id}">Remove project</button>` : ''}</div>
      </form>
      <div class="stack-lg"><div class="card" id="strength-panel">${SV.strength(p)}</div>
        <div class="card soft"><h3>Tips</h3><p class="muted small" style="margin-top:4px">Pick work that matches the job you want. Explain your thinking. Show what changed because of your work. Say exactly what you did.</p></div></div>
    </div>`);
};
UI.onSubmit('saveProject', form => {
  const user = Session.user(), d = UI.formData(form), errs = {}, id = form.dataset.id;
  if (!d.name.trim()) errs.name = 'Give your project a name.';
  const fixUrl = (u, field, label) => { u = u.trim(); if (!u) return ''; const full = /^https?:\/\//i.test(u) ? u : 'https://' + u; try { const x = new URL(full); if (!x.hostname.includes('.')) throw 0; return full; } catch (e) { errs[field] = `Enter a full web address for ${label}, like https://github.com/you/project.`; return u; } };
  const liveUrl = fixUrl(d.liveUrl, 'liveUrl', 'the live version'), codeUrl = fixUrl(d.codeUrl, 'codeUrl', 'the code');
  const ts = Math.max(1, Math.min(50, parseInt(d.teamSize, 10) || 1));
  if (Object.keys(errs).length) return UI.showErrors(form, errs);
  const rec = { name: d.name.trim(), kind: d.kind, team: ts > 1 ? `Team of ${ts}` : 'Solo', goal: d.goal.trim(), challenge: d.challenge.trim(), role: d.role.trim(), result: d.result.trim(), liveUrl, codeUrl };
  if (id) Object.assign(Store.state.projects.find(p => p.id === id), rec);
  else Store.state.projects.push({ id: Store.id('p'), userId: user.id, comments: [], ...rec });
  Store.save(); UI.clearDrafts('project-form'); UI.toast(id ? 'Project saved.' : 'Project added.'); UI.go('/student/projects');
});
UI.on('deleteProject', el => UI.confirm('Remove this project?', 'It will disappear from your portfolio. This cannot be undone.', 'Remove project', () => {
  Store.state.projects = Store.state.projects.filter(p => p.id !== el.dataset.id); Store.save(); UI.toast('Project removed.'); UI.go('/student/projects');
}, true));

/* =================== ACTIVITIES =================== */
SV.activities = ({ user, query }) => {
  const st = UI.state('acts', { filter: 'all', year: 'all', status: 'all', q: '', adding: false, editId: null, open: {} });
  if (query.add === '1' && !st.adding) { st.adding = true; st.editId = null; }
  const all = Q.acts(user.id);
  const count = t => all.filter(a => t === 'all' || a.type === t).length;
  const verified = all.filter(a => a.status === 'verified').length;
  const shown = all.filter(a => (st.filter === 'all' || a.type === st.filter) && (st.year === 'all' || a.year === Number(st.year)) && (st.status === 'all' || a.status === st.status) && (!st.q || (a.title + ' ' + (a.detail || '')).toLowerCase().includes(st.q.toLowerCase())))
    .sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt));
  const canAdd = Session.can('add_activities');
  const rows = shown.map(a => {
    const comments = a.comments || [];
    const open = st.open[a.id];
    return `<div class="item" style="display:block"><div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:12px">
      <span class="dot">${Names.typeLetter[a.type]}</span>
      <div class="grow"><b>${esc(a.title)}</b><div class="muted small">${esc(Names.typeLabel[a.type])} · Year ${a.year}${a.detail ? ' · ' + esc(a.detail) : ''}</div>
        <div class="row" style="gap:12px;margin-top:4px">
          ${comments.length ? `<button class="btn link small" data-act="toggleActComments" data-id="${a.id}">💬 ${comments.length} comment${comments.length > 1 ? 's' : ''}</button>` : ''}
          ${a.certificate ? (a.certificate.data ? `<a class="small" href="${a.certificate.data}" download="${esc(a.certificate.name)}">📎 ${esc(a.certificate.name)}</a>` : `<span class="small muted">📎 ${esc(a.certificate.name)}</span>`) : ''}
          ${canAdd ? `<button class="btn link small" data-act="editAct" data-id="${a.id}">${a.status === 'evidence' ? 'Add evidence' : 'Edit'}</button><button class="btn link small" data-act="removeAct" data-id="${a.id}">Remove</button>` : ''}</div></div>
      <div>${SV.actStatus(a)}</div></div>
      ${a.status === 'evidence' ? `<div class="banner warn small" style="margin:8px 0 0 48px">${esc(a.evidenceNote || 'A teacher asked for evidence.')}</div>` : ''}
      ${open ? `<div style="margin:6px 0 0 48px">${comments.map(c => `<div class="comment"><b>${esc(Names.staff(Store.user(c.by)))}:</b> ${esc(c.text)}</div>`).join('')}</div>` : ''}</div>`;
  }).join('');

  const editing = st.editId && all.find(a => a.id === st.editId);
  const form = st.adding ? `<form class="card soft" id="act-form" data-submit="saveAct" novalidate style="margin-top:14px">
      <h3>${editing ? 'Edit activity' : 'Add an activity'}</h3>
      <div class="grid g2"><div><label class="field" for="af-type">What kind is it?</label><select class="input" id="af-type" name="type">${Object.keys(Names.typeShort).map(t => `<option value="${t}" ${editing && editing.type === t ? 'selected' : ''}>${t === 'achievement' ? 'School achievement' : t === 'leadership' ? 'Leadership role' : 'Extracurricular activity'}</option>`).join('')}</select></div>
      <div><label class="field" for="af-year">Which year?</label><select class="input" id="af-year" name="year">${[1, 2, 3, 4].map(y => `<option value="${y}" ${(editing ? editing.year : user.year) === y ? 'selected' : ''}>${y}</option>`).join('')}</select></div></div>
      <label class="field" for="af-title">What is it called?</label><input class="input" id="af-title" name="title" value="${esc(editing ? editing.title : '')}" placeholder="Debate society captain">
      <label class="field" for="af-detail">Where or what role? <span class="opt">(optional)</span></label><input class="input" id="af-detail" name="detail" value="${esc(editing ? editing.detail : '')}" placeholder="Students' union, 2 hours a week">
      <label class="field" for="af-cert">Attach a certificate <span class="opt">(optional, a picture or PDF under 250 KB is kept)</span></label><input class="input" id="af-cert" name="cert" type="file" accept="image/*,.pdf">
      <div class="row" style="margin-top:14px"><button class="btn primary">Save activity</button><button type="button" class="btn" data-act="cancelAct">Cancel</button></div>
      <p class="hint">A teacher will check it before it shows as verified.</p></form>` : '';

  return wrapS(user, '/activities', `
    ${UI.crumbs([{ label: 'Home', href: '#/student' }, { label: 'Achievements & activities' }])}
    <div class="page-head"><div><h1>Achievements &amp; activities</h1><p>Achievements, leadership roles and extracurricular activities, by year.</p></div>
      ${canAdd ? `<button class="btn primary" data-act="addAct">+ Add an activity</button>` : ''}</div>
    <p class="muted" style="margin:-4px 0 12px">${UI.plural(all.length, 'entry', 'entries')} in total, ${verified} checked by a teacher.</p>
    <div class="row between" style="margin-bottom:6px"><div class="tabs">${[['all', 'Everything'], ['achievement', 'Achievements'], ['leadership', 'Leadership'], ['extra', 'Extracurricular']].map(([k, l]) => `<button class="chip ${st.filter === k ? 'on' : ''}" data-act="actFilter" data-f="${k}">${l} (${count(k)})</button>`).join('')}</div>
      <select class="input" style="width:auto;margin:0" data-change="actYear" aria-label="Filter by year"><option value="all">All years</option>${[1, 2, 3, 4].map(y => `<option value="${y}" ${String(st.year) === String(y) ? 'selected' : ''}>Year ${y}</option>`).join('')}</select></div>
    <div class="row" style="margin:0 0 10px;flex-wrap:nowrap"><input class="input" style="margin:0" type="search" placeholder="Search your entries" aria-label="Search entries" value="${esc(st.q)}" data-input="actSearch" data-keep="act-q">
      <select class="input" style="width:auto;margin:0" data-change="actStatus" aria-label="Filter by status"><option value="all">All status</option>${[['verified', 'Verified'], ['waiting', 'Waiting'], ['evidence', 'Evidence needed']].map(([k, l]) => `<option value="${k}" ${st.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="list">${rows || `<div style="margin-top:10px">${UI.empty(all.length ? 'Nothing matches that filter' : 'No entries yet', all.length ? 'Try another tab or year.' : 'Add your first achievement, leadership role or activity.')}</div>`}</div>
    ${form}
    ${all.length ? `<div style="margin-top:16px"><button class="btn" data-act="printRecord">Download my portfolio (PDF)</button></div>` : ''}
  `);
};
UI.on('actFilter', el => { UI.state('acts').filter = el.dataset.f; UI.render(); });
UI.onInput('actSearch', el => { UI.state('acts').q = el.value; UI.render(); });
UI.onChange('actStatus', el => { UI.state('acts').status = el.value; UI.render(); });
UI.on('goActs', el => { const s = UI.state('acts'); s.filter = el.dataset.f; s.year = 'all'; s.status = 'all'; s.q = ''; UI.go('/student/activities'); });
UI.onChange('actYear', el => { UI.state('acts').year = el.value; UI.render(); });
UI.on('addAct', () => { const s = UI.state('acts'); s.adding = true; s.editId = null; UI.clearDrafts('act-form'); UI.render(); const f = $('#act-form'); if (f) { f.scrollIntoView({ block: 'center' }); $('#af-title').focus(); } });
UI.on('editAct', el => { const s = UI.state('acts'); s.adding = true; s.editId = el.dataset.id; UI.clearDrafts('act-form'); UI.render(); const f = $('#act-form'); if (f) f.scrollIntoView({ block: 'center' }); });
UI.on('cancelAct', () => { const s = UI.state('acts'); s.adding = false; s.editId = null; UI.clearDrafts('act-form'); if (location.hash.includes('add=1')) location.hash = '#/student/activities'; else UI.render(); });
UI.on('toggleActComments', el => { const s = UI.state('acts'); s.open[el.dataset.id] = !s.open[el.dataset.id]; UI.render(); });
UI.on('removeAct', el => UI.confirm('Remove this entry?', 'It will be taken out of your record. This cannot be undone.', 'Remove', () => {
  Store.state.activities = Store.state.activities.filter(a => a.id !== el.dataset.id); Store.save(); UI.toast('Entry removed.'); UI.render();
}, true));
UI.onSubmit('saveAct', async form => {
  const user = Session.user(), st = UI.state('acts'), d = UI.formData(form), errs = {};
  if (!d.title.trim()) errs.title = 'Give this entry a name.';
  if (Object.keys(errs).length) return UI.showErrors(form, errs);
  const cert = await UI.readAttachment(d.cert);
  const S = Store.state;
  let a = st.editId && S.activities.find(x => x.id === st.editId);
  if (a) {
    Object.assign(a, { type: d.type, year: Number(d.year), title: d.title.trim(), detail: d.detail.trim(), status: 'waiting', updated: true, verifiedBy: null, evidenceNote: '' });
    if (cert) a.certificate = cert;
    Store.event(user.id, 'waiting', `${a.title} was updated and is waiting to be checked`, a.id);
  } else {
    a = { id: Store.id('a'), userId: user.id, type: d.type, year: Number(d.year), title: d.title.trim(), detail: d.detail.trim(), status: 'waiting', createdAt: new Date().toISOString(), certificate: cert, verifiedBy: null, comments: [], updated: false };
    S.activities.push(a);
    Store.event(user.id, 'waiting', `${a.title} is waiting to be checked`, a.id);
  }
  if (cert && cert.note) UI.toast(`The file ${cert.name} is ${cert.note}, so only its name was saved.`, true);
  Store.save(); st.adding = false; st.editId = null; UI.clearDrafts('act-form');
  UI.toast('Saved. A teacher will check it soon.');
  if (location.hash.includes('add=1')) location.hash = '#/student/activities'; else UI.render();
});
UI.on('printRecord', () => {
  const u = Session.user(), pr = u.profile || {}, sems = Calc.sems(u.id);
  const status = (a) => a.status === 'verified' ? 'Verified' : a.status === 'evidence' ? 'Evidence needed' : 'Waiting to be checked';
  const logo = new URL(CONFIG.logo, location.href).href;
  UI.print(`Portfolio: ${u.name}`, `
    <div style="display:flex;align-items:center;gap:12pt;border-bottom:3pt solid #c8191f;padding-bottom:8pt;margin-bottom:10pt"><img src="${logo}" alt="" style="height:44pt"><div><div style="font-size:9pt;letter-spacing:.08em;text-transform:uppercase;color:#555">Africa University · AU Launchpad</div><div style="font-size:18pt;font-weight:700">${esc(u.name)}</div></div></div>
    <p>${esc(u.schoolId)} · Year ${u.year} · ${esc(u.programme)} · ${esc(u.email)}</p>
    <p><b>Overall GPA ${Calc.fmt(Calc.overall(u.id))}</b> (certified by the school) · ${Calc.credits(u.id)} of 120 credits</p>
    ${pr.bio ? `<h2>About</h2><p>${esc(pr.bio)}</p>` : ''}${(pr.skills || []).length ? `<p><b>Skills:</b> ${esc(pr.skills.join(', '))}</p>` : ''}
    ${sems.length ? `<h2>Academic record</h2><table><thead><tr><th>Year</th><th>Semester</th><th>Semester GPA</th><th>Credits</th></tr></thead><tbody>${sems.map(x => `<tr><td>${x.year}</td><td>${x.sem}</td><td>${Calc.fmt(Calc.semGpa(x))}</td><td>${Calc.semCredits(x)}</td></tr>`).join('')}</tbody></table>` : ''}
    <h2>Achievements, leadership and activities</h2>
    <table><thead><tr><th>Entry</th><th>Type</th><th>Year</th><th>Details</th><th>Status</th></tr></thead><tbody>${Q.acts(u.id).map(a => `<tr><td>${esc(a.title)}</td><td>${esc(Names.typeShort[a.type])}</td><td>${a.year}</td><td>${esc(a.detail)}</td><td>${status(a)}</td></tr>`).join('') || '<tr><td colspan="5">No entries yet.</td></tr>'}</tbody></table>
    <h2>Projects</h2>${Q.projects(u.id).map(p => `<p><b>${esc(p.name)}</b> (${esc(p.kind)} · ${esc(p.team)})<br>${esc(p.goal)} ${esc(p.result)}</p>`).join('') || '<p>No projects yet.</p>'}
    <p style="margin-top:16pt;font-size:8pt;color:#666">Generated ${UI.fmtDateLong(new Date().toISOString())}. Only entries marked Verified have been checked by a teacher.</p>`);
});

/* =================== LETTERS =================== */
SV.letters = ({ user }) => {
  const S = Store.state;
  const staff = S.users.filter(u => u.role === 'staff' && u.active);
  const mine = Q.letters(user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const canAsk = Session.can('ask_letter');
  const card = (l) => {
    const s = Store.user(l.staffId), v = l.versions[l.versions.length - 1];
    const left = CONFIG.maxLetterChanges - l.changesUsed;
    let actions = '';
    if (l.status === 'ready' || l.status === 'changes') {
      actions = `<div class="row" style="margin-top:8px"><button class="btn small" data-act="downloadLetter" data-id="${l.id}">Download letter</button>
        ${l.status === 'ready' && left > 0 ? `<button class="btn small" data-act="askChanges" data-id="${l.id}">Ask for changes</button>` : ''}</div>
        <div class="hint">${l.status === 'changes' ? `Waiting for ${esc(Names.staff(s))} to update it. You can still download version ${v.n}.` : left > 0 ? `You can ask for changes up to ${CONFIG.maxLetterChanges} times (${l.changesUsed} used).` : `You have used both changes. For anything else, contact ${esc(Names.staff(s))} directly.`}</div>`;
    }
    if (l.status === 'declined') actions = `<div class="small" style="margin-top:6px"><span class="muted">Reply:</span> ${esc(l.declineReason)}</div><button class="btn small" style="margin-top:8px" data-act="askSomeoneElse" data-id="${l.id}">Ask someone else</button>`;
    return `<div class="item" style="display:block"><div class="row between" style="align-items:flex-start;flex-wrap:nowrap"><div><b>${esc(Names.staff(s))}${s.department ? ', ' + esc(s.department) : ''}</b>
      <div class="muted small">${esc(l.purpose)} · needed by ${UI.fmtDate(l.due)}${v && v.n > 1 ? ` · version ${v.n}` : ''}</div></div><div>${SV.letterStatus(l)}</div></div>${actions}</div>`;
  };
  return wrapS(user, '/letters', `
    ${UI.crumbs([{ label: 'Home', href: '#/student' }, { label: 'My letters' }])}
    <div class="page-head"><div><h1>My letters</h1><p>Ask a staff member for a recommendation letter and keep it after graduating.</p></div></div>
    <div class="banner info" style="margin-bottom:14px">ⓘ You can still download your finished letters after you graduate. Just sign in with your school email.</div>
    <div class="grid g2" style="align-items:start">
      ${canAsk ? `<form class="card" id="letter-form" data-submit="sendLetter" novalidate>
        <h2>Ask for a new letter</h2>
        <label class="field" for="lf-staff">Who would you like to ask?</label><select class="input" id="lf-staff" name="staffId"><option value="">Choose a staff member</option>${staff.map(s => `<option value="${s.id}">${esc(Names.staff(s))}, ${esc(s.department)}</option>`).join('')}</select>
        <label class="field" for="lf-purpose">What is the letter for?</label><select class="input" id="lf-purpose" name="purpose">${Names.purposes.map(p => `<option>${p}</option>`).join('')}</select>
        <label class="field" for="lf-due">When do you need it by?</label><input class="input" id="lf-due" name="due" type="date" min="${UI.today()}"><div class="hint">Give your writer at least two weeks.</div>
        <label class="field" for="lf-msg">Anything you'd like them to mention? <span class="opt">(optional)</span></label><textarea class="input" id="lf-msg" name="message" placeholder="I'm applying for a software internship…"></textarea>
        <div class="field" style="margin-top:14px">What can your writer see?</div>
        ${[['grades', 'My grades'], ['achievements', 'My achievements'], ['leadership', 'My leadership roles'], ['extracurricular', 'My extracurricular activities']].map(([k, l]) => `<label class="check"><input type="checkbox" name="share_${k}" checked> ${l}</label>`).join('')}
        <button class="btn primary block" style="margin-top:16px">Send request</button>
      </form>` : `<div class="card"><p class="muted">Asking for letters is switched off for students at the moment.</p></div>`}
      <div class="card"><h2>My requests</h2><div class="list" style="margin-top:8px">${mine.map(card).join('') || '<p class="muted small">No requests yet. Your requests and their answers will show here.</p>'}</div></div>
    </div>
    <div style="margin-top:14px">${SV.changePanel(user)}</div>
  `);
};
UI.on('askSomeoneElse', el => {
  const l = Store.state.letters.find(x => x.id === el.dataset.id);
  UI.drafts['letter-form'] = { staffId: '', purpose: l.purpose, due: l.due >= UI.today() ? l.due : '', message: l.message || '' };
  UI.render(); const f = $('#letter-form'); if (f) { f.scrollIntoView({ block: 'center' }); $('#lf-staff').focus(); }
});
UI.onSubmit('sendLetter', form => {
  const user = Session.user(), d = UI.formData(form), errs = {};
  if (!d.staffId) errs.staffId = 'Choose who you would like to ask.';
  if (!d.due) errs.due = 'Choose the date you need the letter by.';
  else if (d.due < UI.today()) errs.due = 'That date has passed. Choose a date in the future.';
  if (Object.keys(errs).length) return UI.showErrors(form, errs);
  const S = Store.state, staff = Store.user(d.staffId);
  S.letters.push({ id: Store.id('l'), studentId: user.id, staffId: d.staffId, purpose: d.purpose, due: d.due, message: d.message.trim(),
    share: { grades: d.share_grades, achievements: d.share_achievements, leadership: d.share_leadership, extracurricular: d.share_extracurricular },
    status: 'new', createdAt: new Date().toISOString(), changesUsed: 0, changeRequests: [], draft: '', versions: [] });
  Store.save(); UI.clearDrafts('letter-form');
  UI.toast(UI.daysUntil(d.due) < 14 ? `Sent to ${Names.staff(staff)}. That is under two weeks, so they may not manage it in time.` : `Request sent to ${Names.staff(staff)}.`);
  UI.render();
});
