### 🧩 `shell.js` (App Shell, Navigation & Authentication Views)

`shell.js` implements the global layout scaffolding (top navigation bar and side navigation rail) and manages all public authentication workflows (login, password reset, account claim, and public landing page).

#### Navigation & Role Scaffolding
- **Role Navigation Matrix (`NAV`)**: Defines routes and menu labels across four role personas (`student`, `staff`, `supervisor`, `admin`).
- **Dynamic Layout Wrapper (`Views.shell.wrap`)**: Assembles the top bar, branding logo, user identity info, and active role navigation rail.

#### Auth & Onboarding Views
- **Landing Page (`Views.auth.landing`)**: Hero showcase detailing portfolio benefits, workflow steps, role breakdowns, and call-to-action triggers.
- **Multi-Role Login (`Views.auth.login`)**: Tabbed interface for switching role contexts with integrated demo helper shortcuts (`demoFill`).
- **Password Management & Invites (`Views.auth.setPassword`, `Views.auth.landing`)**:
  - Validates reset/invite tokens via `/api/token/`.
  - Enforces minimum strength requirements (at least 8 characters, 1 number, and 1 symbol).
- **Two-Step Verification Simulator (`Auth.verify`)**: Demonstrates step-by-step email and phone SMS code validation prior to final sign-up submission.

---