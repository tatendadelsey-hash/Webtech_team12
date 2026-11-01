# AU Launchpad (Africa University student portfolio system)

A website with a real backend. Students, staff (teachers and lecturers), supervisors and administrators sign in and see only what their role allows.

## Run it (3 steps)
1. Install Node.js 22.13 or newer (https://nodejs.org). Check with `node -v`.
2. Open a terminal in this folder and run: `npm start`
3. Open http://localhost:3000

No `npm install` is needed. The project uses only what comes with Node.

Demo password for every sample account: `Demo@1234`

| Role | Sign in with |
|---|---|
| Student | `230148` |
| Staff (lecturer) | `rudo.chikwanha@africau.edu` |
| Supervisor | `casey.brooks@acme.example` |
| Administrator | `admin@africau.edu` |

Put the sample data back at any time with `npm run reset-db`, or with "Reset demo data" in the app.

## Extra features
- Students: "Download my portfolio (PDF)" on the home page (branded, print-ready).
- Students: "My journey" timeline of every entry by year, coloured by status.
- Lecturers: "Draft from portfolio" in the letter editor builds a first draft from what the student shared (verified entries only). It leaves [brackets] for the lecturer's own words, and the server refuses to send a letter that still has them.

## Design
The identity is "AU Launchpad": a clean, light design with thin borders, soft shadows and rounded corners. Red is used only as an accent, in the school colours (red, black, white), with automatic dark mode. The app layout (top bar, left menu, profile header, stat cards, "GPA by year" bars) follows the team prototype. Colours are variables at the top of `public/css/styles.css`.

## How it is built
- `public/` : the website the browser loads (HTML, CSS, JavaScript, logo).
- `server/index.js` : web server, security headers, cookies.
- `server/routes.js` : login, sign-up, password links, administrator actions.
- `server/sync.js` : checks every save against the rules (who may change what).
- `server/scope.js` : decides what data each role may receive.
- `server/db.js` : the database layer. SQLite file on your computer (`data/portfolio.db`), PostgreSQL (Supabase) when `DATABASE_URL` is set.
- `server/config.js`, `server/mailer.js` : settings from environment variables, and email sending through Brevo.
- `tests/api.test.js` : 36 automatic tests. Run with `npm test`.

## Security in plain words
- Passwords are stored as salted scrypt hashes, never as text.
- Login uses a secure cookie the page's JavaScript cannot read (HttpOnly, SameSite).
- Too many wrong passwords are blocked for a while.
- The server, not the browser, decides what you can see and change. Changing the page in the browser does not help.
- Students cannot verify their own entries, grades cannot be edited, comments cannot be deleted.

## Demo mode
On your own computer `DEMO_MODE` is on: sample people are loaded and invite or reset links appear on screen. As soon as `DATABASE_URL` is set (online), demo mode switches off by itself: the database starts empty with one administrator from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, and links are emailed.

## Putting it online
GitHub Pages cannot run this server. Follow **DEPLOY.md**: Supabase (database) + Render (server) + Brevo (email), all free.
