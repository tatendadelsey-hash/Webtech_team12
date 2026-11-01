/* App shell (sidebar + page frame) and the access pages: log in, sign up, set password. */

const NAV = {
  student: { title: 'AU Launchpad', base: '/student', items: [['', 'Dashboard'], ['/grades', 'Academic record'], ['/projects', 'My projects'], ['/activities', 'Achievements & activities'], ['/letters', 'Letters']] },
  staff: { title: 'Staff portal', base: '/staff', items: [['', 'Dashboard'], ['/students', 'My students'], ['/verify', 'Verify entries'], ['/letters', 'Letter requests']] },
  supervisor: { title: 'Supervisor', base: '/supervisor', items: [['', 'Dashboard'], ['/students', 'My students']] },
  admin: { title: 'Admin', base: '/admin', items: [['', 'Dashboard'], ['/people', 'Users'], ['/permissions', 'Permissions'], ['/reports', 'Reports'], ['/audit', 'Audit log']] },
};

Views.shell.home = (user) => NAV[user.role].base;
Views.shell.redirect = (path) => { setTimeout(() => UI.go(path), 0); return '<div class="main muted">Taking you there…</div>'; };

/* active = the nav suffix that should be highlighted, e.g. '/grades' */
const NAV_ICON = { '': '▦', '/grades': '▤', '/projects': '◧', '/activities': '★', '/letters': '✉', '/students': '☰', '/people': '☰', '/permissions': '⚿', '/reports': '▥', '/verify': '✓', '/audit': '☷' };
const ROLE_LABEL = { student: 'Student', staff: 'Staff', supervisor: 'Supervisor', admin: 'Administrator' };
Views.shell.wrap = (user, active, inner) => {
  const nav = NAV[user.role];
  const links = nav.items.map(([suffix, label]) => `<a href="#${nav.base}${suffix}" class="${suffix === active ? 'on' : ''}" ${suffix === active ? 'aria-current="page"' : ''}><i aria-hidden="true">${NAV_ICON[suffix] || '•'}</i>${label}</a>`).join('');
  return `<div class="app">
    <header class="topbar">
      <img class="tb-logo" src="${CONFIG.logo}" alt="${esc(CONFIG.schoolName)}">
      <span class="tb-title">AU <b>LAUNCHPAD</b></span><span class="tb-role">${ROLE_LABEL[user.role]}</span>
      <span class="sp"></span><span class="tb-who">${esc(user.name)}</span>${UI.avatar(user)}<a href="#" class="tb-out" data-act="logout">Log out</a>
    </header>
    <div class="app-body"><nav class="rail" aria-label="Main">${links}</nav><main class="main" id="main">${inner}</main></div>
  </div>`;
};

UI.on('logout', async () => {
  try { await API.post('/api/logout'); } catch (e) {}
  await Store.bootstrap(); UI.toast('You have signed out.'); UI.go('/login');
});
UI.on('resetDemo', () => UI.confirm('Reset demo data?', 'This puts every account, grade, letter and entry back to how it started, for everyone. It cannot be undone.', 'Reset', async () => {
  try { await Store.reset(); UI.drafts = {}; UI.vs = {}; UI.toast('Demo data reset.'); UI.go('/login'); } catch (e) { UI.toast(e.message, true); }
}, true));

/* =================== LOG IN =================== */
const ROLE_TABS = [['student', 'Student'], ['staff', 'Staff'], ['supervisor', 'Supervisor'], ['admin', 'Administrator']];

Views.auth.panel = () => `<aside class="auth-panel">
  <a class="ap-brand" href="#/"><img src="${CONFIG.logo}" alt="${esc(CONFIG.schoolName)}"></a>
  <div class="ap-body">
    <div class="ap-kicker">${esc(CONFIG.appName)}</div>
    <h2>Your achievements, <em>verified.</em></h2>
    <ul class="ap-list">
      <li><i>✓</i><span>Certified grades and GPA, straight from the registry</span></li>
      <li><i>✓</i><span>Lecturers verify every achievement you add</span></li>
      <li><i>✓</i><span>Recommendation letters you can download for life</span></li>
    </ul>
  </div>
  <div class="ap-foot">© ${new Date().getFullYear()} ${esc(CONFIG.schoolName)} · <a href="#/">Back to home</a></div>
</aside>`;

Views.auth.login = (o = {}) => {
  const st = UI.state('login', { role: 'student' });
  const role = st.role;
  const label = ROLE_TABS.find(r => r[0] === role)[1];
  const idLabel = role === 'student' ? 'School email or school ID' : 'Work email';
  const idHolder = role === 'student' ? `name@${CONFIG.studentEmailDomain} or 230148` : role === 'supervisor' ? 'name@company.example' : `name@${CONFIG.staffEmailDomain}`;
  const foot = role === 'student'
    ? `New student? <a href="#/sign-up">Create an account</a>`
    : role === 'supervisor'
      ? 'Supervisors do not create their own account. The registry office sets it up and links you to your students.'
      : 'Staff and administrator accounts are created by the school. Contact the registry office if you need one.';
  return `<div class="auth-page split">${Views.auth.panel()}<div class="auth-wrap">
    <div class="card auth-card">
      <img class="logo" src="${CONFIG.logo}" alt="${esc(CONFIG.schoolName)} logo">
      <h1>Sign in to AU Launchpad</h1>
      <div class="school">${esc(CONFIG.schoolName)} · <a href="#/">Home</a></div>
      ${o.notice ? `<div class="banner info" style="margin-bottom:12px">${esc(o.notice)}</div>` : ''}
      <div class="seg" role="tablist" aria-label="Who are you?">${ROLE_TABS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === role}" class="${k === role ? 'on' : ''}" data-act="loginRole" data-role="${k}">${l}</button>`).join('')}</div>
      <form id="login-form" data-submit="login" novalidate style="margin-top:16px">
        <label class="field" for="lg-id">${idLabel}</label>
        <input class="input" id="lg-id" name="identifier" autocomplete="username" placeholder="${idHolder}">
        <label class="field" for="lg-pw">Password</label>
        <div class="pw-wrap"><input class="input" id="lg-pw" name="password" type="password" autocomplete="current-password" placeholder="Your password"><button type="button" data-act="togglePw" data-target="lg-pw">Show</button></div>
        <div class="row between" style="margin-top:10px">
          <label class="check" style="margin:0"><input type="checkbox" name="remember"> <span class="muted">Keep me signed in</span></label>
          <a href="#" data-act="forgot" class="small">Forgot password?</a>
        </div>
        <button class="btn primary block" style="margin-top:14px">Sign in as ${label.toLowerCase()}</button>
      </form>
      <p class="small muted" style="text-align:center;margin-top:14px">${foot}</p>
    </div>
    ${CONFIG.demoMode ? `<details class="card demo-box" style="padding:10px 14px"><summary>Demo accounts (password for all: <b>${esc(CONFIG.demoPassword)}</b>)</summary>
      <table>
        ${[['student', 'Tendai Moyo', '230148'], ['staff', 'Rudo Chikwanha (lecturer)', `rudo.chikwanha@${CONFIG.staffEmailDomain}`], ['supervisor', 'Casey Brooks', 'casey.brooks@acme.example'], ['admin', 'Admin Office', `admin@${CONFIG.staffEmailDomain}`]]
          .map(([r, n, id]) => `<tr><td><b>${ROLE_TABS.find(x => x[0] === r)[1]}</b></td><td>${esc(n)}<br><span class="muted">${esc(id)}</span></td><td><button class="btn small" data-act="demoFill" data-role="${r}" data-id="${esc(id)}">Fill in</button></td></tr>`).join('')}
      </table>
    </details>` : ''}
  </div></div>`;
};

UI.on('loginRole', el => { UI.state('login').role = el.dataset.role; UI.clearDrafts('login-form'); UI.render(); });
UI.on('demoFill', el => {
  UI.state('login').role = el.dataset.role;
  UI.drafts['login-form'] = { identifier: el.dataset.id };
  UI.render();
  $('#lg-pw').value = CONFIG.demoPassword;
});
UI.on('togglePw', el => {
  const inp = document.getElementById(el.dataset.target); const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password'; el.textContent = show ? 'Hide' : 'Show';
});

UI.onSubmit('login', async form => {
  const role = UI.state('login').role, d = UI.formData(form), errs = {};
  if (!d.identifier.trim()) errs.identifier = role === 'student' ? 'Enter your school email or school ID.' : 'Enter your work email.';
  if (!d.password) errs.password = 'Enter your password.';
  if (Object.keys(errs).length) return UI.showErrors(form, errs);

  const btn = form.querySelector('button.primary'); btn.disabled = true;
  try {
    // The server checks the password and role, and starts the session (a secure cookie the browser cannot read).
    await API.post('/api/login', { identifier: d.identifier.trim(), password: d.password, role, remember: !!d.remember });
    await Store.bootstrap();
  } catch (e) {
    btn.disabled = false;
    const field = e.field && form.elements[e.field] ? e.field : 'password';
    return UI.showErrors(form, { [field]: e.message });
  }
  const user = Session.user();
  UI.clearDrafts('login-form');
  const after = sessionStorage.getItem('spp.after'); sessionStorage.removeItem('spp.after');
  UI.toast(`Welcome, ${user.name.split(' ')[0]}.`);
  UI.go(after && after.startsWith('#/' + user.role) ? after.slice(1) : Views.shell.home(user));
});

/* ----- forgot password ----- */
UI.on('forgot', () => {
  UI.modal(`<h2>Reset your password</h2><p class="muted small" style="margin:4px 0 12px">Enter your school email. We will send a link to set a new password.</p>
    <form id="forgot-form" data-submit="forgot" novalidate>
      <label class="field" for="fg-em">School email</label><input class="input" id="fg-em" name="email" type="email" placeholder="name@${CONFIG.studentEmailDomain}">
      <div class="row" style="margin-top:14px"><button class="btn primary">Send reset link</button><button type="button" class="btn" data-act="closeModal">Cancel</button></div>
    </form><div id="forgot-done"></div>`);
});
UI.onSubmit('forgot', async form => {
  const email = form.elements.email.value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return UI.showErrors(form, { email: 'Enter a valid email address.' });
  let r;
  try { r = await API.post('/api/forgot', { email }); } catch (e) { return UI.showErrors(form, { email: e.message }); }
  const shortcut = r.demoToken ? `<p class="small muted" style="margin-top:10px">Demo mode: no real email is sent. <a href="#/set-password/${r.demoToken}" data-native="1" data-act="closeModal">Open the reset page</a></p>` : '';
  form.classList.add('hidden');
  $('#forgot-done').innerHTML = `<div class="banner ok">If that email belongs to a school account, a reset link is on its way. Check your inbox.</div>${shortcut}<div style="margin-top:14px"><button class="btn" data-act="closeModal">Close</button></div>`;
});

/* =================== SET PASSWORD (invites and resets) =================== */
Views.auth.setPassword = ({ params }) => {
  const token = params[0];
  // The server checks the link; until it answers we show the form shell.
  UI.after(() => API.get('/api/token/' + encodeURIComponent(token)).then(info => {
    const who = $('#sp-who'), h = $('#sp-title');
    if (who) who.textContent = `${info.name} · ${info.email}`;
    if (h) h.textContent = info.type === 'invite' ? 'Welcome. Set your password' : 'Choose a new password';
  }).catch(() => {
    $('#app').innerHTML = `<div class="auth-page split">${Views.auth.panel()}<div class="auth-wrap"><div class="card auth-card"><h1>This link has expired</h1><p class="muted" style="text-align:center;margin:10px 0 16px">Ask the registry office to send a new one, or use "Forgot password?" on the sign-in page.</p><a class="btn primary block" href="#/login">Back to sign in</a></div></div></div>`;
  }));
  return `<div class="auth-page split">${Views.auth.panel()}<div class="auth-wrap"><div class="card auth-card">
    <h1 id="sp-title">Set your password</h1>
    <p class="school" id="sp-who">Checking your link…</p>
    <form id="setpw-form" data-submit="setpw" data-token="${esc(token)}" novalidate>
      <label class="field" for="sp-pw">New password</label>
      <div class="pw-wrap"><input class="input" id="sp-pw" name="password" type="password" autocomplete="new-password" data-input="pwStrength"><button type="button" data-act="togglePw" data-target="sp-pw">Show</button></div>
      <div class="strength" id="sp-strength"><i></i><i></i><i></i><i></i></div>
      <div class="hint">At least 8 characters, one number, one symbol.</div>
      <label class="field" for="sp-pw2">Confirm password</label><input class="input" id="sp-pw2" name="confirm" type="password" autocomplete="new-password" placeholder="Password again">
      <button class="btn primary block" style="margin-top:16px">Save password</button>
    </form></div></div></div>`;
};
UI.onSubmit('setpw', async form => {
  const d = UI.formData(form), errs = {};
  const pwErr = Auth.passwordProblem(d.password); if (pwErr) errs.password = pwErr;
  else if (d.password !== d.confirm) errs.confirm = 'The two passwords do not match.';
  if (Object.keys(errs).length) return UI.showErrors(form, errs);
  try { await API.post('/api/set-password', { token: form.dataset.token, password: d.password }); }
  catch (e) { return UI.showErrors(form, { [e.field && form.elements[e.field] ? e.field : 'password']: e.message }); }
  UI.toast('Password saved. You can sign in now.'); UI.go('/login');
});

/* =================== SIGN UP =================== */
const Auth = {
  passwordScore(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    if (pw.length >= 12 || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) s++;
    return pw ? Math.max(1, s) : 0;
  },
  passwordProblem(pw) {
    if (!pw) return 'Create a password.';
    if (pw.length < 8) return 'Use at least 8 characters.';
    if (!/\d/.test(pw)) return 'Add at least one number.';
    if (!/[^A-Za-z0-9]/.test(pw)) return 'Add at least one symbol, such as ! or @.';
    return '';
  },
};
UI.onInput('pwStrength', el => {
  const bar = el.closest('form').querySelector('.strength');
  bar.className = 'strength' + (el.value ? ' s' + Auth.passwordScore(el.value) : '');
});

Views.auth.signup = () => {
  const st = UI.state('signup', { done: null });
  if (st.done) {
    return `<div class="auth-page split">${Views.auth.panel()}<div class="auth-wrap"><div class="card auth-card">
      <div class="logo" aria-hidden="true">✓</div><h1>Thank you, ${esc(st.done.name.split(' ')[0])}</h1>
      <p class="muted" style="text-align:center;margin:10px 0">Your email and phone are verified. The administrator will check that your details match school records, then approve your account.</p>
      ${st.done.status === 'mismatch' ? `<div class="banner warn">Some details did not match school records, so the administrator will look at them more closely. They may ask you to correct them.</div>` : ''}
      <p class="small muted" style="text-align:center;margin:12px 0 16px">You will be able to sign in once you are approved.</p>
      <a class="btn primary block" href="#/login" data-act="signupDone" data-native="1">Back to sign in</a></div></div></div>`;
  }
  return `<div class="auth-page split">${Views.auth.panel()}<div class="auth-wrap"><div class="card auth-card">
    <h1 style="text-align:left">Create your account</h1>
    <p class="muted small" style="margin:3px 0 14px">Use the details the school has on file for you.</p>
    <form id="signup-form" data-submit="signup" novalidate>
      <label class="field" for="su-id">School ID</label><input class="input" id="su-id" name="schoolId" placeholder="230148" autocomplete="off">
      <label class="field" for="su-em">School email</label><input class="input" id="su-em" name="email" type="email" placeholder="name@${CONFIG.studentEmailDomain}" autocomplete="email">
      <div class="hint">We'll send a verification code here.</div>
      <label class="field" for="su-ph">Phone number</label>
      <div class="row phone-row" style="flex-wrap:nowrap;gap:8px"><input class="input" name="cc" value="+263" style="width:84px;flex:none" aria-label="Country code"><input class="input" id="su-ph" name="phone" placeholder="77 123 4567" inputmode="tel" autocomplete="tel-national"></div>
      <label class="field" for="su-pw">Create password</label>
      <div class="pw-wrap"><input class="input" id="su-pw" name="password" type="password" autocomplete="new-password" data-input="pwStrength"><button type="button" data-act="togglePw" data-target="su-pw">Show</button></div>
      <div class="strength"><i></i><i></i><i></i><i></i></div>
      <div class="hint">At least 8 characters, one number, one symbol.</div>
      <label class="field" for="su-pw2">Confirm password</label><input class="input" id="su-pw2" name="confirm" type="password" autocomplete="new-password" placeholder="Password again">
      <label class="check" style="margin-top:14px"><input type="checkbox" name="agree"> <span class="muted">I agree to the school's data and privacy policy</span></label>
      <button class="btn primary block" style="margin-top:14px">Create account</button>
    </form>
    <p class="small" style="text-align:center;margin-top:14px">Already registered? <a href="#/login">Sign in</a></p>
  </div></div></div>`;
};
UI.on('signupDone', () => { UI.state('signup').done = null; UI.state('login').role = 'student'; });

UI.onSubmit('signup', async form => {
  const d = UI.formData(form), errs = {};
  d.schoolId = d.schoolId.trim(); d.email = d.email.trim();
  if (!/^\d{6}$/.test(d.schoolId)) errs.schoolId = 'Enter your 6-digit school ID, for example 250493.';
  if (!/^\S+@\S+\.\S+$/.test(d.email)) errs.email = 'Enter a valid school email.';
  const digits = d.phone.replace(/[\s-]/g, '');
  if (!/^\d{7,10}$/.test(digits)) errs.phone = 'Enter your phone number without the country code, for example 77 123 4567.';
  const pe = Auth.passwordProblem(d.password); if (pe) errs.password = pe;
  else if (d.password !== d.confirm) errs.confirm = 'The two passwords do not match.';
  if (!d.agree) errs.agree = 'Please agree to the privacy policy to continue.';
  if (Object.keys(errs).length) return UI.showErrors(form, errs);

  // The server checks the school ID against school records (the records are not sent to the browser).
  try { await API.post('/api/signup/check', { schoolId: d.schoolId, email: d.email }); }
  catch (e) { return UI.showErrors(form, { [e.field && form.elements[e.field] ? e.field : 'schoolId']: e.message }); }
  Auth.verify({ schoolId: d.schoolId, email: d.email, cc: d.cc, phone: d.phone, password: d.password });
});

/* Two-step verification: a code to the school email, then a code to the phone.
   (Demo mode only: the code is shown on screen. Online, sign-ups are checked against school records and approved by the administrator instead.) */
Auth.verify = async (entry) => {
  if (!CONFIG.demoMode) {                                        // a real site: no pretend codes. The administrator checks every sign-up against school records.
    try { const r = await API.post('/api/signup', entry); UI.clearDrafts('signup-form'); UI.state('signup').done = { name: r.name, status: r.status }; UI.render(); }
    catch (e) { UI.toast(e.message, true); }
    return;
  }
  const CODE = '482913';
  const step = (which) => {
    const where = which === 'email' ? entry.email : `${entry.cc} ${entry.phone}`;
    UI.modal(`<h2>Verify your ${which}</h2>
      <p class="muted small" style="margin:4px 0 12px">We sent a 6-digit code to <b>${esc(where)}</b>.</p>
      <div class="banner info small">Demo mode: no real message is sent. Your code is <b>${CODE}</b>.</div>
      <form id="verify-form" data-submit="verify" novalidate style="margin-top:12px">
        <label class="field" for="vf-code">6-digit code</label><input class="input" id="vf-code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code">
        <div class="row" style="margin-top:14px"><button class="btn primary">Verify ${which}</button><button type="button" class="btn" data-act="closeModal">Cancel</button></div>
      </form>`);
    UI.submits.verify = async f => {
      if (f.elements.code.value.trim() !== CODE) return UI.showErrors(f, { code: 'That code is not right. Check it and try again.' });
      if (which === 'email') return step('phone');
      let r;
      try { r = await API.post('/api/signup', entry); }
      catch (e) { UI.closeModal(); return UI.toast(e.message, true); }
      UI.closeModal(); UI.clearDrafts('signup-form');
      UI.state('signup').done = { name: r.name, status: r.status };
      UI.render();
    };
  };
  step('email');
};

/* =================== LANDING PAGE (public) =================== */
Views.auth.landing = () => `
  <div class="lx">
  <header class="lx-nav"><div class="lx-wrap lx-navrow">
    <a class="lx-brand" href="#/" aria-label="${esc(CONFIG.appName)} home"><img src="${CONFIG.logo}" alt="${esc(CONFIG.schoolName)}"><span>AU <b>LAUNCHPAD</b></span></a>
    <nav class="lx-links" aria-label="Page sections"><a href="#/" data-act="scrollTo" data-to="lx-how">How it works</a><a href="#/" data-act="scrollTo" data-to="lx-who">Who it is for</a></nav>
    <div class="row"><a class="lx-btn ghost" href="#/login">Sign in</a><a class="lx-btn solid" href="#/sign-up">Get started</a></div></div></header>

  <section class="lx-hero"><div class="lx-wrap lx-herogrid">
    <div>
      <div class="lx-kicker">Africa University · Student portfolio</div>
      <h1>Launch your career <em>from campus.</em></h1>
      <p class="lx-lead">AU Launchpad keeps your certified grades, projects, leadership and activities in one place. Lecturers verify them, so employers and scholarship committees can trust what they read.</p>
      <div class="row" style="gap:12px;margin-top:26px"><a class="lx-btn solid big" href="#/sign-up">Create your account</a><a class="lx-btn ghost big" href="#/login">Sign in</a></div>
      <p class="lx-note">Your achievements, verified.</p>
    </div>
    <div class="lx-card" aria-hidden="true">
      <div class="lx-card-top"><span class="lx-dot"></span><span class="lx-dot"></span><span class="lx-dot"></span><span class="lx-card-t">portfolio / preview</span></div>
      <div class="lx-gpa"><div><small>CUMULATIVE GPA</small><b>3.41</b></div><span class="lx-cert">✓ School certified</span></div>
      <div class="lx-row"><span class="lx-tick ok">✓</span><div><b>Dean's list</b><small>Achievement · Year 3</small></div><span class="lx-tag ok">Verified</span></div>
      <div class="lx-row"><span class="lx-tick ok">✓</span><div><b>Class representative</b><small>Leadership · Year 2</small></div><span class="lx-tag ok">Verified</span></div>
      <div class="lx-row"><span class="lx-tick wait">●</span><div><b>Chess club treasurer</b><small>Leadership · Year 3</small></div><span class="lx-tag wait">Waiting</span></div>
      <div class="lx-letter">✉ Recommendation letter ready to download</div>
    </div>
  </div></section>

  <section class="lx-stats"><div class="lx-wrap lx-statgrid">
    <div><b>4</b><span>roles, one login</span></div><div><b>1</b><span>place for your certified record</span></div><div><b>2</b><span>steps to verify any entry</span></div><div><b>0</b><span>paper forms to chase</span></div></div></section>

  <section class="lx-sec" id="lx-how"><div class="lx-wrap">
    <div class="lx-eyebrow">How it works</div><h2>Three steps from sign-up to letter</h2>
    <div class="lx-steps">
      <div class="lx-step"><span>1</span><h3>Sign up</h3><p>Use your 6-digit school ID. It is matched to registry records and approved by an administrator.</p></div>
      <div class="lx-step"><span>2</span><h3>Build and verify</h3><p>Add projects, achievements and activities. A teacher checks each one and marks it verified.</p></div>
      <div class="lx-step go"><span>3</span><h3>Ask for a letter</h3><p>Choose a lecturer and what they can see. Download the finished letter, even after you graduate.</p></div>
    </div></div></section>

  <section class="lx-sec dark" id="lx-who"><div class="lx-wrap">
    <div class="lx-eyebrow">Who it is for</div><h2>Built for everyone involved</h2>
    <div class="lx-roles">
      <div><h3>Students</h3><p>Track current and certified GPA, record achievements, show projects and request letters.</p></div>
      <div><h3>Staff</h3><p>Open the portfolios of students you teach, verify entries, give feedback and write letters.</p></div>
      <div><h3>Supervisors</h3><p>Follow students on attachment with weekly progress notes and a final report.</p></div>
      <div><h3>Administrators</h3><p>Create accounts, approve sign-ups, set permissions and export reports.</p></div></div></div></section>

  <section class="lx-cta"><div class="lx-wrap lx-ctarow"><div><h2>Ready to build your portfolio?</h2><p>Sign in with your school email or ID, or create an account in two minutes.</p></div>
    <div class="row" style="gap:12px"><a class="lx-btn light big" href="#/sign-up">Create your account</a><a class="lx-btn outline big" href="#/login">Sign in</a></div></div></section>

  <footer class="lx-foot"><div class="lx-wrap lx-footrow"><span>© ${new Date().getFullYear()} ${esc(CONFIG.schoolName)} · ${esc(CONFIG.appName)}</span><span><a href="#/login">Sign in</a> · <a href="#/sign-up">Create an account</a></span></div></footer>
  </div>`;
UI.on('scrollTo', (el, e) => { e.preventDefault(); const t = document.getElementById(el.dataset.to); if (t) t.scrollIntoView({ behavior: 'smooth' }); });

