# Africa University Student Portfolio System

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
| Staff (lecturer) | `riley.adams@school.edu` |
| Supervisor | `casey.brooks@acme.example` |
| Administrator | `quinn.moyer@school.edu` |

Put the sample data back at any time with `npm run reset-db`, or with "Reset demo data" in the app.

## Extra features
- Students: "Download my portfolio (PDF)" on the home page (branded, print-ready).
- Lecturers: "Draft from portfolio" in the letter editor builds a first draft from what the student shared (verified entries only). It leaves [brackets] for the lecturer's own words, and the server refuses to send a letter that still has them.

## How it is built
- `public/` : the website the browser loads (HTML, CSS, JavaScript, logo).
- `server/index.js` : web server, security headers, cookies.
- `server/routes.js` : login, sign-up, password links, administrator actions.
- `server/sync.js` : checks every save against the rules (who may change what).
- `server/scope.js` : decides what data each role may receive.
- `server/db.js` : SQLite database (`data/portfolio.db`, created on first start).
- `tests/api.test.js` : 36 automatic tests. Run with `npm test`.

## Security in plain words
- Passwords are stored as salted scrypt hashes, never as text.
- Login uses a secure cookie the page's JavaScript cannot read (HttpOnly, SameSite).
- Too many wrong passwords are blocked for a while.
- The server, not the browser, decides what you can see and change. Changing the page in the browser does not help.
- Students cannot verify their own entries, grades cannot be edited, comments cannot be deleted.

## Demo mode
By default `DEMO_MODE` is on: invite and reset links appear on screen because no email service is connected. For real use, start with `DEMO_MODE=0` and add email sending in `server/routes.js` where tokens are created.

## Putting it online
GitHub Pages cannot run this server. Use a Node host such as Render or Railway: build command none, start command `npm start`, set `NODE_ENV=production` and `DEMO_MODE=0`, and keep a persistent disk for `data/`.
