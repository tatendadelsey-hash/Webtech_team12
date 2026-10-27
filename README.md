# Student Portfolio System (prototype)

A working, click-through prototype of the student portfolio system from the wireframes (16 screens, 4 roles).
Plain HTML, CSS and JavaScript. **No install, no build step.** Data is saved in the browser (localStorage), so it behaves like a real app but there is no server.

## Run it
Open `index.html` in a browser, or serve the folder (`python3 -m http.server`) and visit http://localhost:8000.
On GitHub: Settings → Pages → deploy from the `main` branch to get a live link.

## Demo accounts (password for all: `Demo@1234`)
| Role | Sign in with |
|---|---|
| Student | `230148` (Jordan Lee) |
| Staff | `riley.adams@school.edu` (lecturer) |
| Supervisor | `casey.brooks@acme.example` |
| Administrator | `quinn.moyer@school.edu` |

The sign-in page has a "Fill in" shortcut. The **Reset demo data** button (bottom right) restores the sample data.

## What works
- **Log in / sign up:** role tabs, validation, password strength bar, email + phone verification (code shown on screen), admin approval, mismatch flagging.
- **Student:** home with GPA graph, grades by year and semester, transcript (print to PDF), projects with strength checklist, activities with filters and certificates, recommendation letters with 2 change requests.
- **Staff:** dashboard, search, review portfolios (verify, ask for evidence, comment, rate), accept/decline letters, letter editor with templates and bracket check, versioned updates.
- **Supervisor:** linked students only, weekly progress notes and ratings, final report.
- **Administrator:** dashboard, add staff/supervisor (invite link), approve sign-ups, CSV import, deactivate/reactivate, permission matrix with locks and audit log, reports (PDF, Excel, CSV).

## Structure
```
index.html          page shell, loads the scripts in order
css/styles.css      all styling (colours in :root)
js/config.js        school name, limits
js/data.js          sample "school database" + permission matrix
js/store.js         data storage, session, GPA maths, queries  <- replace with API calls for a real backend
js/ui.js            helpers: forms, modals, toasts, router
js/views/*.js       one file per role: shell (login/sign-up), student, staff, supervisor, admin
js/app.js           routes
```

## Limits of the prototype
No real server, email or SMS. Passwords are stored in the browser for demo purposes only. Do not use real student data.
