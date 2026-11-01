# AU Launchpad: team roles

Web Technologies final project, Africa University (lecturer: Ms Mafu). Each member owns one project role and the files that belong to it.

| Member | Role | Files they own |
|---|---|---|
| Delsey Chipamuriwo | Backend developer | `server/index.js`, `routes.js`, `sync.js`, `scope.js`, `security.js` |
| Ralph Nyasha Chiwota | Database engineer | `server/db.js`, `seed-data.js`, `config.js`, `mailer.js` |
| Nyashadzaishe Chivaviro | Frontend developer | `public/js/` (`app.js`, `store.js`, `ui.js`, `data.js`, `config.js`) and `public/js/views/` `student.js`, `staff.js`, `supervisor.js`, `admin.js` |
| Shaune Bakasa | UI/UX designer | `public/css/styles.css`, `public/index.html`, `public/js/views/shell.js`, `public/assets/` |
| Leerose Bwanya | QA tester and deployment lead | `tests/`, `package.json`, `render.yaml`, `.gitignore`, `README.md`, `DEPLOY.md`, `TEAM.md` |

## What each role did

**Backend developer.** Built the web server and the API: sign-in with secure cookie sessions and hashed passwords, a login rate limit, protection against cross-site requests, and the permission rules. `scope.js` decides what each role may see, and `sync.js` checks every change someone tries to save (for example, a student cannot verify their own entry and nobody can edit grades).

**Database engineer.** Built the database layer that runs on SQLite on a laptop and on PostgreSQL (Supabase) online: the tables, the order rows come back in, row level security, the first administrator and the sample data for demos. Also the email sending for invitations and password resets.

**Frontend developer.** Built how the pages work: loading data from the server, the router, forms and validation, and the four role screens (student, staff, supervisor, administrator).

**UI/UX designer.** Designed how it looks: the red, black and white identity, the landing page, sign-in and sign-up pages, the navigation, phone layouts and dark mode.

**QA tester and deployment lead.** Wrote the 36 automatic tests, ran the browser checks, and set up hosting (Supabase for data, Render for the server, Brevo for email). Wrote the README and the deployment guide.

## How the system fits together
Browser (public/) -> API (server/routes.js, sync.js, scope.js) -> database (server/db.js) -> SQLite locally or Supabase online.

The project was built with the help of an AI assistant (Claude); the team reviewed, tested and deployed it.
