# Putting AU Launchpad online (free)

Three free services work together:

| Service | Job |
|---|---|
| **Supabase** | Stores all the data (a PostgreSQL database) |
| **Render** | Runs our Node.js server and gives the website a public `https://` link |
| **Brevo** | Sends the emails (invitations, password resets) |

The code decides what to use by itself. With no settings it runs on your computer with a SQLite file. When `DATABASE_URL` is set, it uses Supabase.

## 1. Supabase (the database)
1. Create a project at supabase.com (organisation type Personal, plan Free).
2. Click **Connect** > **Direct** tab > method **Session pooler**. Copy the address that starts with `postgresql://postgres.`
3. Replace `[YOUR-PASSWORD]` (brackets too) with your database password. This is your **DATABASE_URL**. Keep it secret: never put it in GitHub or in a chat.
4. You do not need to create any tables. The server creates them on first start and turns on Row Level Security for each one.

## 2. GitHub
The repository must show `server`, `public`, `package.json` and the other files at the top level (not inside a zip file or a sub-folder). Render builds straight from the repository.

## 3. Brevo (emails)
1. Sign up at brevo.com (free plan: 300 emails a day).
2. **Senders & IP** > add the email address you want to send from and confirm the code Brevo emails you.
3. **SMTP & API** > **API keys** > create a key. Copy it. This is **BREVO_API_KEY**.
4. Your sender address is **MAIL_FROM**. Emails from a Gmail address may land in spam at first, so tell people to check there.

Email is optional. Without it, links are printed in the Render log, where an administrator can copy them.

## 4. Render (the server)
1. Sign in at render.com with GitHub. **New** > **Web Service** > choose the repository.
2. Settings: Runtime **Node**, Build command `npm install`, Start command `npm start`, Instance type **Free**.
3. Add these **Environment variables**:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22.13.0` |
| `DATABASE_URL` | the Supabase address from step 1 |
| `ADMIN_EMAIL` | the email of the first administrator |
| `ADMIN_PASSWORD` | a strong password for that administrator (12+ characters) |
| `ADMIN_NAME` | for example `Registry Office` |
| `APP_URL` | your Render address, for example `https://au-launchpad.onrender.com` (add it after the first deploy) |
| `BREVO_API_KEY` | from Brevo (optional) |
| `MAIL_FROM` | the sender you verified in Brevo (optional) |

4. Click **Create Web Service** and wait for "Your service is live".
5. Open the link and sign in as the administrator (choose the Administrator tab).

On the first start with an empty database, the server creates that one administrator. It does **not** create any sample people or demo passwords online.

## 5. Setting up the real school data
1. Sign in as the administrator and open **Users**. Import the student registry (school ID, name, email, programme, year).
2. Students open the site, choose **Create an account**, and enter their school ID. The administrator approves each sign-up.
3. Add lecturers, teachers and supervisors from **Users** > **Add staff**. They get an email invitation to choose a password.

## Good to know
- **Render free sleeps** after about 15 minutes without visitors. The first visit then takes 30 to 60 seconds. Open the site a minute before presenting. A free monitor such as UptimeRobot, pinging `/api/health` every 5 minutes, keeps it awake.
- **Supabase free pauses** a project after a week with no activity. If that happens, press **Restore** in the Supabase dashboard.
- Change `ADMIN_PASSWORD` only before the first start. Later, use **Forgot password**.
- To try the live site against fake data, run it on your computer (`npm start`), not online.
