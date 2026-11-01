/* Constants shared with the server. The sample school data (accounts, grades...) now lives on the server only. */
const GRADE_POINTS = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D': 1.0, 'F': 0 };

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
