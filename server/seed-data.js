/* Seed data: this is the "school database" the prototype starts with.
   Everything here is invented sample data. The first time the site loads, it is copied into
   localStorage; the "Reset demo data" button (bottom right) copies it back. */

const GRADE_POINTS = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D': 1.0, 'F': 0 };
const GRADE_ORDER = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'];

const D = {
  iso(offsetDays = 0, hour = 9) {
    const d = new Date(); d.setHours(hour, 0, 0, 0); d.setDate(d.getDate() + offsetDays); return d.toISOString();
  },
  day(offsetDays = 0) { return D.iso(offsetDays).slice(0, 10); },
};

/* One semester template per slot: [code, title, credits, grade] */
const SEM_TEMPLATES = [
  { y: 1, s: 1, cert: 'Dec 2023', courses: [['CSC 101', 'Introduction to programming', 4, 'B+'], ['MTH 101', 'Calculus I', 3, 'B'], ['CSC 103', 'Computer systems', 3, 'B+'], ['COM 101', 'Communication skills', 3, 'B+']] },
  { y: 1, s: 2, cert: 'Jun 2024', courses: [['CSC 102', 'Data structures', 4, 'A-'], ['MTH 102', 'Calculus II', 3, 'B+'], ['CSC 104', 'Discrete mathematics', 3, 'B'], ['STA 101', 'Statistics', 3, 'A-']] },
  { y: 2, s: 1, cert: 'Dec 2024', courses: [['CSC 201', 'Algorithms', 4, 'B+'], ['CSC 203', 'Object-oriented programming', 3, 'A'], ['INF 201', 'Systems analysis', 3, 'A-'], ['MTH 201', 'Linear algebra', 3, 'B']] },
  { y: 2, s: 2, cert: 'Jun 2025', courses: [['CSC 202', 'Operating systems', 4, 'B'], ['CSC 204', 'Web development', 3, 'A'], ['CSC 206', 'Computer networks', 3, 'B+'], ['BUS 201', 'Entrepreneurship', 3, 'A-']] },
  { y: 3, s: 1, cert: 'Dec 2025', courses: [['CSC 301', 'Software engineering', 4, 'B+'], ['CSC 303', 'Computer graphics', 3, 'B'], ['CSC 307', 'Mobile applications', 3, 'A-'], ['ETH 301', 'Professional ethics', 2, 'B+']] },
  { y: 3, s: 2, cert: 'Jun 2026', courses: [['CSC 302', 'Machine learning', 4, 'A'], ['CSC 305', 'Databases', 4, 'B+'], ['MTH 310', 'Numerical methods', 3, 'A-'], ['CSC 312', 'Security basics', 3, 'B']] },
  { y: 4, s: 1, cert: 'Dec 2026', courses: [['CSC 401', 'Capstone project I', 5, 'B+'], ['CSC 403', 'Cloud computing', 4, 'B'], ['CSC 405', 'Distributed systems', 3, 'B+'], ['INF 401', 'IT management', 3, 'A-']] },
  { y: 4, s: 2, cert: 'Jun 2027', courses: [['CSC 402', 'Capstone project II', 6, 'A-'], ['CSC 404', 'Cybersecurity', 4, 'B+'], ['BUS 401', 'Professional practice', 5, 'B']] },
];

function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

/* Tendai keeps the exact grades shown in the wireframe; others get slightly shifted versions. */
function makeGrades(studentId, yearsDone, exact) {
  const out = [];
  SEM_TEMPLATES.filter(t => t.y <= yearsDone).forEach(t => {
    out.push({
      year: t.y, sem: t.s,
      // Certified in Dec (semester 1) or Jun (semester 2) of the right calendar year for this student's cohort.
      certified: `${t.s === 1 ? 'Dec' : 'Jun'} ${(t.s === 1 ? 2025 : 2026) - (yearsDone - t.y)}`,
      courses: t.courses.map(([code, title, credits, grade]) => {
        if (!exact) {
          const shift = (hashStr(studentId + code) % 3) - 1; // -1, 0 or +1 step
          const i = Math.min(GRADE_ORDER.length - 1, Math.max(0, GRADE_ORDER.indexOf(grade) + shift));
          grade = GRADE_ORDER[i];
        }
        return { code, title, credits, grade };
      }),
    });
  });
  return out;
}

const FIRST = ['Amara', 'Blessing', 'Chipo', 'Dalitso', 'Edgar', 'Farai', 'Grace', 'Hope', 'Isaac', 'Joy', 'Kudzai', 'Lerato', 'Mandla', 'Nyasha', 'Obert', 'Praise', 'Rudo', 'Simba', 'Tendai', 'Unity', 'Vimbai', 'Wallace', 'Yemi', 'Zodwa', 'Ayanda', 'Brian', 'Chiedza', 'Daniel', 'Esther', 'Felix', 'Gift', 'Hilda', 'Ian', 'Janet', 'Kelvin', 'Linda', 'Moses'];
const LAST = ['Moyo', 'Ncube', 'Dube', 'Banda', 'Phiri', 'Sibanda', 'Mutasa', 'Chikwanha', 'Zulu', 'Mensah', 'Okafor', 'Tembo', 'Mwale', 'Chirwa', 'Ndlovu', 'Gumbo', 'Marufu', 'Chideme', 'Mlambo', 'Kamau', 'Osei', 'Nkomo', 'Bvuma', 'Makoni', 'Sithole', 'Chuma', 'Zimba', 'Hove', 'Katsande', 'Mpofu', 'Jere', 'Lunga', 'Mapfumo', 'Gondo', 'Tshuma', 'Khumalo', 'Mhlanga'];
const PROGRAMMES = ['BSc Computer Science', 'BSc Information Systems', 'BSc Computer Science', 'BA Communication', 'BSc Mathematics'];

function buildSeed() {
  const S = CONFIG.studentEmailDomain, T = CONFIG.staffEmailDomain, pw = CONFIG.demoPassword;
  const users = [];
  const add = (u) => { users.push(Object.assign({ active: true, photo: null, password: pw }, u)); };

  /* ---- named students (the ones in the wireframes) ---- */
  const named = [
    { id: 'u-tendai', name: 'Tendai Moyo', schoolId: '230148', year: 3, programme: 'BSc Computer Science', email: `tendai.moyo@${S}`, phone: '+263 77 123 4567' },
    { id: 'u-chipo', name: 'Chipo Ncube', schoolId: '230152', year: 3, programme: 'BSc Computer Science', email: `chipo.ncube@${S}`, phone: '+263 77 555 0152' },
    { id: 'u-farai', name: 'Farai Dube', schoolId: '240310', year: 2, programme: 'BSc Information Systems', email: `farai.dube@${S}`, phone: '+263 71 555 0310' },
    { id: 'u-taylor', name: 'Taylor Kim', schoolId: '220087', year: 4, programme: 'BSc Computer Science', email: `taylor.kim@${S}`, phone: '+263 78 555 0087' },
    { id: 'u-casey', name: 'Casey Nguyen', schoolId: '220119', year: 4, programme: 'BSc Computer Science', email: `casey.nguyen@${S}`, phone: '+263 77 555 0119' },
  ];
  named.forEach(n => add({
    role: 'student', ...n,
    profile: n.id === 'u-tendai'
      ? { bio: "Third-year Computer Science student who enjoys building tools that save people time. Strong in databases and web development. I'm looking for a software developer role after I graduate.", skills: ['Python', 'SQL', 'JavaScript', 'Git'], linkedin: 'linkedin.com/in/yourname', github: 'github.com/yourname' }
      : { bio: `${n.programme} student interested in practical software work.`, skills: ['Python', 'Git'], linkedin: '', github: '' },
  }));

  /* ---- generated students, so the staff list really has 42 students ---- */
  const fillers = [];
  for (let i = 0; i < 37; i++) {
    const year = (i % 4) + 1;
    const id = `u-s${i + 1}`;
    fillers.push(id);
    const fn = FIRST[i % FIRST.length], ln = LAST[(i * 7 + 3) % LAST.length];
    add({
      id, role: 'student', name: `${fn} ${ln}`, schoolId: `${String(2026 - year).slice(2)}${String(200 + i * 3).padStart(4, '0')}`, year,
      programme: PROGRAMMES[i % PROGRAMMES.length], email: `${fn}.${ln}@${S}`.toLowerCase(), phone: `+263 77 ${String(100 + i)} ${String(4000 + i * 7)}`,
      profile: { bio: `${PROGRAMMES[i % PROGRAMMES.length]} student.`, skills: [], linkedin: '', github: '' },
    });
  }

  /* ---- staff, supervisor, admin ---- */
  const allStudents = users.filter(u => u.role === 'student').map(u => u.id);
  add({ id: 'u-rudo', role: 'staff', staffRole: 'lecturer', name: 'Rudo Chikwanha', prefix: 'Dr.', title: 'Lecturer', department: 'Engineering', email: `rudo.chikwanha@${T}`, teaches: allStudents });
  add({ id: 'u-tafara', role: 'staff', staffRole: 'lecturer', name: 'Tafara Sibanda', prefix: 'Mr.', title: 'Lecturer', department: 'Business', email: `tafara.sibanda@${T}`, teaches: ['u-tendai', 'u-chipo', ...fillers.slice(0, 10)] });
  add({ id: 'u-ortiz', role: 'staff', staffRole: 'teacher', name: 'Jamie Ortiz', prefix: 'Ms.', title: 'Teacher', department: 'Communication', email: `jamie.ortiz@${T}`, teaches: ['u-tendai', ...fillers.slice(0, 5)] });
  add({ id: 'u-dana', role: 'staff', staffRole: 'lecturer', name: 'Dana Whitfield', prefix: 'Dr.', title: 'Lecturer', department: 'Mathematics', email: `dana.whitfield@${T}`, teaches: [], active: false });
  add({ id: 'u-brooks', role: 'supervisor', name: 'Casey Brooks', department: 'Acme Ltd', unit: 'Software team', email: 'casey.brooks@acme.example' });
  add({ id: 'u-admin', role: 'admin', name: 'Admin Office', department: 'Registry office', email: `admin@${T}` });

  /* ---- grades ---- */
  const grades = {};
  users.filter(u => u.role === 'student').forEach(u => { grades[u.id] = makeGrades(u.id, u.year >= 3 && u.id === 'u-tendai' ? 3 : u.year, u.id === 'u-tendai'); });
  // Students who just finished Year N have N years of grades; Year 1 students have one year.

  /* ---- projects ---- */
  const projects = [
    { id: 'p1', userId: 'u-tendai', name: 'Student results portal', kind: 'Class project', team: 'Team of 4', goal: 'Let lecturers upload marks and let students see them.', challenge: 'Marks pages loaded slowly. I added a database index and cut the load time from 6 seconds to 2.', role: 'I built the database and the login system. Two teammates built the screens, one wrote tests.', result: 'Used by 3 classes, 120 students', liveUrl: 'https://example.com/results-portal', codeUrl: 'https://github.com/example/results-portal', comments: [] },
    { id: 'p2', userId: 'u-tendai', name: 'Clinic booking app', kind: 'Freelance', team: 'Solo', goal: 'Help a small clinic stop double-booking patients.', challenge: 'Two people booked the same slot. I chose to lock a slot the moment someone starts booking it.', role: 'I did everything: design, code and set-up.', result: 'Missed appointments down by a third', liveUrl: 'https://example.com/clinic', codeUrl: 'https://github.com/example/clinic', comments: [] },
    { id: 'p3', userId: 'u-tendai', name: 'Budget tracker', kind: 'Personal build', team: 'Solo', goal: 'Track my own spending without a spreadsheet.', challenge: 'Charts were slow with a year of data, so I summarised by month.', role: 'Solo build.', result: 'Used daily for 8 months', liveUrl: '', codeUrl: 'https://github.com/example/budget', comments: [] },
    { id: 'p4', userId: 'u-tendai', name: 'Library catalogue search', kind: 'Class project', team: 'Team of 3', goal: 'Help students find books faster than the old card list.', challenge: 'Searches were slow on long titles. I tried two methods and picked the faster one.', role: 'Team of 3. I wrote the search and the database.', result: 'Searches take under 1 second. Used by 200 students.', liveUrl: 'https://example.com/library', codeUrl: 'https://github.com/example/library', comments: [] },
    { id: 'p5', userId: 'u-chipo', name: 'Campus events board', kind: 'Class project', team: 'Team of 3', goal: 'Show all campus events in one place.', challenge: 'Events had many formats, so I wrote a small import step.', role: 'I built the import and the calendar view.', result: 'Used by 2 societies', liveUrl: '', codeUrl: 'https://github.com/example/events', comments: [] },
  ];

  /* ---- activities (9 for Tendai: 7 verified, 1 waiting, 1 needs evidence) ---- */
  const act = (id, userId, type, title, year, detail, status, ageDays, extra = {}) => ({ id, userId, type, title, year, detail, status, createdAt: D.iso(-ageDays), certificate: null, verifiedBy: status === 'verified' ? 'u-rudo' : null, comments: [], updated: false, ...extra });
  const activities = [
    act('a1', 'u-tendai', 'achievement', "Dean's list", 3, 'Faculty of Science', 'verified', 120),
    act('a2', 'u-tendai', 'leadership', 'Chess club treasurer', 3, "Students' union", 'waiting', 3),
    act('a3', 'u-tendai', 'leadership', 'Class representative', 2, 'Computing', 'verified', 400),
    act('a4', 'u-tendai', 'extra', 'Debate society', 3, 'Member, years 1 to 3', 'verified', 100),
    act('a5', 'u-tendai', 'extra', 'Football, first team', 1, 'University sport', 'verified', 700),
    act('a6', 'u-tendai', 'achievement', 'Hackathon finalist', 2, 'Inter-university', 'verified', 380),
    act('a7', 'u-tendai', 'achievement', 'Programming contest, first place', 1, 'Department contest', 'evidence', 650),
    act('a8', 'u-tendai', 'leadership', 'Hall committee secretary', 1, 'Student residence', 'verified', 690),
    act('a9', 'u-tendai', 'extra', 'Volunteer tutor', 2, 'Maths for first years, 2 hours a week', 'verified', 360),
    act('a10', 'u-chipo', 'achievement', 'Faculty award for teamwork', 3, 'Faculty of Science', 'waiting', 2),
    act('a11', 'u-farai', 'extra', 'Drama club', 2, 'Lighting crew', 'waiting', 1, { updated: true }),
  ];
  activities.find(a => a.id === 'a7').evidenceNote = 'Please attach the certificate or a photo of the results.';
  activities.find(a => a.id === 'a6').comments = [];
  activities.find(a => a.id === 'a2').comments = [{ by: 'u-rudo', text: 'Please add a letter from the club president.', ts: D.iso(-2) }];

  /* ---- letters ---- */
  const letters = [
    { id: 'l1', studentId: 'u-tendai', staffId: 'u-rudo', purpose: 'Internship', due: D.day(27), message: '', share: { grades: true, achievements: true, leadership: true, extracurricular: true }, status: 'ready', createdAt: D.iso(-20), changesUsed: 0, changeRequests: [], draft: '', versions: [{ n: 1, text: `Dear hiring manager,\n\nIt is my pleasure to recommend Tendai Moyo for the software internship. In my databases class they showed strong problem-solving skills and led their team with calm and care.\n\nI am confident they would be a valuable team member.\n\nYours sincerely,\nRudo Chikwanha`, sentAt: D.iso(-13) }] },
    { id: 'l2', studentId: 'u-tendai', staffId: 'u-tafara', purpose: 'Scholarship', due: D.day(40), message: '', share: { grades: true, achievements: true, leadership: false, extracurricular: false }, status: 'progress', createdAt: D.iso(-6), changesUsed: 0, changeRequests: [], draft: '', versions: [] },
    { id: 'l3', studentId: 'u-tendai', staffId: 'u-ortiz', purpose: 'Job application', due: D.day(17), message: '', share: { grades: true, achievements: true, leadership: true, extracurricular: true }, status: 'declined', createdAt: D.iso(-9), changesUsed: 0, changeRequests: [], draft: '', versions: [], declineReason: "I've left the university. Please ask another lecturer." },
    { id: 'l4', studentId: 'u-tendai', staffId: 'u-rudo', purpose: 'Scholarship', due: D.day(10), message: 'I would like my leadership in the chess club mentioned.', share: { grades: true, achievements: true, leadership: true, extracurricular: false }, status: 'new', createdAt: D.iso(-2), changesUsed: 0, changeRequests: [], draft: '', versions: [] },
    { id: 'l5', studentId: 'u-chipo', staffId: 'u-rudo', purpose: 'Job application', due: D.day(27), message: '', share: { grades: true, achievements: true, leadership: true, extracurricular: true }, status: 'new', createdAt: D.iso(-1), changesUsed: 0, changeRequests: [], draft: '', versions: [] },
    { id: 'l6', studentId: 'u-taylor', staffId: 'u-rudo', purpose: 'Internship', due: D.day(30), message: '', share: { grades: true, achievements: true, leadership: true, extracurricular: true }, status: 'changes', createdAt: D.iso(-20), changesUsed: 1, changeRequests: [{ n: 1, text: 'Please mention my final-year project and how I led the team.', ts: D.iso(-1) }], draft: '', versions: [{ n: 1, text: `Dear hiring manager,\n\nIt is my pleasure to recommend Taylor Kim for the software internship. In my databases class they showed strong problem-solving skills.\n\nI am confident they would be a valuable team member.\n\nYours sincerely,\nRudo Chikwanha`, sentAt: D.iso(-13) }] },
  ];

  /* ---- supervisor attachments ---- */
  const att = (studentId, week, notes) => ({ studentId, supervisorId: 'u-brooks', company: 'Acme Ltd', weeks: 12, start: D.day(-((week - 1) * 7 + 2)), end: D.day(-((week - 1) * 7 + 2) + 84), notes, report: null });
  const attachments = [
    att('u-tendai', 6, [
      { week: 4, text: 'Started the reports page. Needs a clearer plan.', ratings: { punctuality: 5, quality: 3, teamwork: 4 }, ts: D.iso(-17) },
      { week: 5, text: 'Settled in well. Asks good questions.', ratings: { punctuality: 5, quality: 4, teamwork: 5 }, ts: D.iso(-10) },
    ]),
    att('u-chipo', 6, [{ week: 5, text: 'Good start on the API tests.', ratings: { punctuality: 4, quality: 4, teamwork: 4 }, ts: D.iso(-10) }]),
    att('u-casey', 10, [{ week: 10, text: 'Finished the deployment scripts ahead of time.', ratings: { punctuality: 5, quality: 5, teamwork: 4 }, ts: D.iso(-2) }]),
  ];

  /* ---- sign-up queue and school records ---- */
  const registry = [
    { schoolId: '250412', name: 'Robin Hale', email: `robin.hale@${S}`, programme: 'BSc Computer Science', year: 1 },
    { schoolId: '250413', name: 'Drew Sato', email: `drew.s@${S}`, programme: 'BSc Information Systems', year: 1 },
    { schoolId: '250420', name: 'Maya Okoye', email: `maya.okoye@${S}`, programme: 'BA Communication', year: 1 },
    { schoolId: '240555', name: 'Tariq Mensah', email: `tariq.mensah@${S}`, programme: 'BSc Mathematics', year: 2 },
    { schoolId: '260001', name: 'Test Student', email: `test.student@${S}`, programme: 'BSc Computer Science', year: 1 },
    { schoolId: '260002', name: 'Second Student', email: `second.student@${S}`, programme: 'BSc Information Systems', year: 1 },
  ];
  const signups = [
    { id: 'su1', schoolId: '250412', name: 'Robin Hale', email: `robin.hale@${S}`, phone: '+263 77 400 0412', password: pw, status: 'match', note: '', ts: D.iso(-1) },
    { id: 'su2', schoolId: '250413', name: 'Drew Sato', email: 'drew.sato@mail.com', registryEmail: `drew.s@${S}`, phone: '+263 77 400 0413', password: pw, status: 'mismatch', note: '', ts: D.iso(-1) },
  ];
  for (let i = 0; i < 10; i++) {
    const fn = FIRST[(i * 3 + 5) % FIRST.length], ln = LAST[(i * 5 + 11) % LAST.length];
    const sid = `25${String(600 + i).padStart(4, '0')}`;
    const em = `${fn}.${ln}@${S}`.toLowerCase();
    registry.push({ schoolId: sid, name: `${fn} ${ln}`, email: em, programme: PROGRAMMES[i % PROGRAMMES.length], year: 1 });
    signups.push({ id: `su${i + 3}`, schoolId: sid, name: `${fn} ${ln}`, email: em, phone: `+263 77 4${i}0 0${600 + i}`, password: pw, status: 'match', note: '', ts: D.iso(-1) });
  }

  /* ---- events (student "Recent updates"), audit log, assessments ---- */
  const events = [
    { id: 'e1', userId: 'u-tendai', kind: 'verified', text: "Dean's list was checked by a teacher", ts: D.iso(-4), ref: 'a1' },
    { id: 'e2', userId: 'u-tendai', kind: 'waiting', text: 'Chess club treasurer is waiting to be checked', ts: D.iso(-3), ref: 'a2' },
    { id: 'e3', userId: 'u-tendai', kind: 'letter', text: 'Your letter from Dr. Rudo Chikwanha is ready', ts: D.iso(-2), ref: 'l1' },
  ];
  const audit = [
    { id: 'g1', text: 'Registry updated Year 2 grades', ts: D.iso(0, 9) , by: 'Registry office' },
    { id: 'g2', text: 'Permissions changed for Lecturers', ts: D.iso(-1, 14), by: 'Admin Office', perm: true },
    { id: 'g3', text: '12 students signed up', ts: D.iso(-1, 11), by: 'System' },
    { id: 'g4', text: 'Teachers can now comment on portfolios', ts: D.iso(-21, 10), by: 'Admin Office', perm: true },
  ];

  const reports = [
    { id: 'r1', name: 'Year 3 progress', type: 'progress', group: 'Year 3', period: '2025/26', include: { grades: true, credits: true, activities: false, compliance: true }, format: 'pdf', ts: D.iso(-21) },
    { id: 'r2', name: 'Compliance summary', type: 'compliance', group: 'All students', period: '2025/26', include: { grades: false, credits: false, activities: true, compliance: true }, format: 'excel', ts: D.iso(-32) },
  ];

  return {
    v: 2, users, grades, projects, activities, letters, attachments, registry, signups, events, audit, reports,
    assessments: [], tokens: {},
    permissions: defaultPermissions(),
    seq: 1000,
  };
}

/* ---- Permission matrix (screen 15). value: true/false = editable, 'L1'/'L0' = locked on/off, null = not applicable ---- */
const PERM_ROLES = [['student', 'Student'], ['teacher', 'Teacher'], ['lecturer', 'Lecturer'], ['supervisor', 'Supervisor'], ['admin', 'Administrator']];
const PERM_ROWS = [
  { section: 'Portfolios' },
  { key: 'view_own', label: 'View their own portfolio', v: { student: 'L1', teacher: null, lecturer: null, supervisor: null, admin: null }, why: 'Every student can always see their own portfolio.' },
  { key: 'edit_profile', label: 'Add projects and edit their profile', v: { student: true, teacher: null, lecturer: null, supervisor: null, admin: null } },
  { key: 'view_taught', label: 'View portfolios of students they teach or supervise', v: { student: null, teacher: true, lecturer: true, supervisor: true, admin: true } },
  { key: 'view_all', label: "View every student's portfolio", v: { student: 'L0', teacher: false, lecturer: false, supervisor: 'L0', admin: true }, whyBy: { student: 'Students only see their own portfolio.', supervisor: 'Supervisors only see the students linked to them.' } },
  { key: 'add_activities', label: 'Add activities and achievements', v: { student: true, teacher: false, lecturer: false, supervisor: false, admin: true } },
  { key: 'verify', label: 'Check (verify) entries', v: { student: 'L0', teacher: true, lecturer: true, supervisor: false, admin: true }, why: 'Students cannot verify their own entries.' },
  { key: 'comment_rate', label: 'Comment on and rate portfolios', v: { student: 'L0', teacher: true, lecturer: true, supervisor: false, admin: false }, why: 'Students cannot verify or rate their own entries.' },
  { key: 'progress_notes', label: 'Add attachment progress notes', v: { student: 'L0', teacher: false, lecturer: false, supervisor: true, admin: false }, why: 'Students cannot write their own progress notes.' },
  { key: 'change_gpa', label: 'Change certified GPA and grades', v: { student: 'L0', teacher: 'L0', lecturer: 'L0', supervisor: 'L0', admin: 'L0' }, why: 'Nobody can edit certified GPA or grades here. Only the registry office certifies them.' },
  { section: 'Letters' },
  { key: 'ask_letter', label: 'Ask for a recommendation letter', v: { student: true, teacher: null, lecturer: null, supervisor: null, admin: null } },
  { key: 'write_letters', label: 'Write recommendation letters', v: { student: 'L0', teacher: true, lecturer: true, supervisor: false, admin: false }, why: 'Students cannot write their own recommendation letters.' },
  { section: 'People and reports' },
  { key: 'manage_accounts', label: 'Create and manage accounts', v: { student: 'L0', teacher: 'L0', lecturer: 'L0', supervisor: 'L0', admin: 'L1' }, why: 'Administrators always keep access to accounts and permissions. Nobody else can have it.' },
  { key: 'change_perms', label: 'Change permissions', v: { student: 'L0', teacher: 'L0', lecturer: 'L0', supervisor: 'L0', admin: 'L1' }, why: 'Administrators always keep access to accounts and permissions. Nobody else can have it.' },
  { key: 'dashboard', label: 'See the dashboard and reports', v: { student: 'L0', teacher: false, lecturer: true, supervisor: false, admin: true }, why: 'Students cannot see school-wide numbers.' },
];
function defaultPermissions() {
  const p = {};
  PERM_ROWS.forEach(r => { if (!r.key) return; p[r.key] = {}; PERM_ROLES.forEach(([role]) => { const v = r.v[role]; p[r.key][role] = v === 'L1' ? true : v === 'L0' ? false : v === null ? null : v; }); });
  return p;
}

/* Sample school-wide figures that sit behind the admin dashboard (the real school would have a database). */
const SCHOOL_BASELINE = {
  '2025/26': { people: 3240, students: 2980, staff: 260, completed: 84, entriesOver30: 30, lettersOverdue: 5, gpa: [3.05, 3.18, 3.31, 3.44], done: [71, 80, 88, 94] },
  '2024/25': { people: 3105, students: 2850, staff: 255, completed: 79, entriesOver30: 22, lettersOverdue: 3, gpa: [3.02, 3.15, 3.27, 3.40], done: [66, 75, 84, 91] },
  '2023/24': { people: 2960, students: 2710, staff: 250, completed: 72, entriesOver30: 18, lettersOverdue: 2, gpa: [2.98, 3.10, 3.22, 3.36], done: [58, 69, 80, 88] },
};

/* Typical figures per year group, used only for the report preview ("Sample figures"). */
const PREVIEW_BASELINE = {
  'Year 1': { credits: 26, entries: 2.1, waiting: 14 }, 'Year 2': { credits: 52, entries: 3.8, waiting: 11 },
  'Year 3': { credits: 78, entries: 6.2, waiting: 10 }, 'Year 4': { credits: 104, entries: 7.5, waiting: 6 },
};
