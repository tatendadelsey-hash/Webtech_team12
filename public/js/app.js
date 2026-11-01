/* Routes and start-up. Each line: path pattern, who may open it, the screen function, the page title. */
const R = Router;
R.add('/', null, () => { const u = Session.user(); return u ? Views.shell.redirect(Views.shell.home(u)) : Views.auth.landing(); }, 'Welcome');
R.add('/login', null, () => Views.auth.login({}), 'Sign in');
R.add('/sign-up', null, () => Views.auth.signup(), 'Create your account');
R.add('/set-password/:token', null, (c) => Views.auth.setPassword(c), 'Set your password');

R.add('/student', ['student'], (c) => Views.student.home(c), 'My portfolio');
R.add('/student/grades', ['student'], (c) => Views.student.grades(c), 'My grades');
R.add('/student/projects', ['student'], (c) => Views.student.projects(c), 'My projects');
R.add('/student/projects/new', ['student'], (c) => Views.student.projectForm(c), 'Add a project');
R.add('/student/projects/edit/:id', ['student'], (c) => Views.student.projectForm(c), 'Edit project');
R.add('/student/activities', ['student'], (c) => Views.student.activities(c), 'My activities');
R.add('/student/letters', ['student'], (c) => Views.student.letters(c), 'My letters');

R.add('/staff', ['staff'], (c) => Views.staff.home(c), 'Staff home');
R.add('/staff/students', ['staff'], (c) => Views.staff.students(c), 'My students');
R.add('/staff/students/:id', ['staff'], (c) => Views.staff.review(c), 'Review a portfolio');
R.add('/staff/verify', ['staff'], (c) => Views.staff.verify(c), 'Verify entries');
R.add('/staff/letters', ['staff'], (c) => Views.staff.letters(c), 'Letter requests');
R.add('/staff/letters/write/:id', ['staff'], (c) => Views.staff.write(c), 'Write a letter');
R.add('/staff/letters/update/:id', ['staff'], (c) => Views.staff.update(c), 'Update a letter');

R.add('/supervisor', ['supervisor'], (c) => Views.sup.home(c), 'Supervisor home');
R.add('/supervisor/students', ['supervisor'], (c) => Views.sup.students(c), 'My students');
R.add('/supervisor/students/:id', ['supervisor'], (c) => Views.sup.monitor(c), 'Student portfolio');

R.add('/admin', ['admin'], (c) => Views.admin.home(c), 'Administrator home');
R.add('/admin/people', ['admin'], (c) => Views.admin.people(c), 'People');
R.add('/admin/permissions', ['admin'], (c) => Views.admin.permissions(c), 'Permissions');
R.add('/admin/reports', ['admin'], (c) => Views.admin.reports(c), 'Reports');
R.add('/admin/audit', ['admin'], (c) => Views.admin.audit(c), 'Audit log');

window.addEventListener('hashchange', () => { UI.closeModal(); UI.render(); });
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const health = await (await fetch('/api/health')).json();
    CONFIG.demoMode = !!health.demoMode;                              // online sites run with demo mode off
    if (!CONFIG.demoMode) document.querySelectorAll('.demo-bar').forEach(el => el.remove());
    await Store.bootstrap();
  }
  catch (e) {
    document.getElementById('app').innerHTML = '<div class="auth-page"><div class="auth-wrap"><div class="card auth-card"><h1>Cannot reach the server</h1><p class="muted" style="text-align:center;margin:10px 0 16px">The portfolio server is not running or is not reachable. Start it with <b>npm start</b> and reload this page.</p><button class="btn primary block" onclick="location.reload()">Try again</button></div></div></div>';
    return;
  }
  UI.render();
});
