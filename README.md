# CampusLedger

A complete college attendance portal: administrators manage students, take daily
attendance and share assignments; students log in, change their temporary
password on first sign-in, view their attendance and download class files.
Emails (welcome + attendance notices) go out through Gmail SMTP, or are printed
to the server console in local dev mode.

Built as an npm-workspaces monorepo — Express + better-sqlite3 API, React (Vite)
client, Vitest/Supertest unit tests and a Playwright browser smoke test.

## Features

**Administrator**
- Email/password sign-in (httpOnly session cookie), forced change on first run
- Dashboard: total students, present/absent today, assignment count
- Add students (class B.Tech/M.Tech, sections CSE/AIML/IT/Civil, roll number,
  email, phone); duplicate roll/email rejected; temporary password shown once
- Delete students (confirmation dialog; attendance history cascades away)
- Daily attendance: load roster by class/section, toggle present/absent/not-marked,
  "mark all" shortcuts, save (upsert per student+date) or re-send email
- Filterable student records with present/absent/not-marked counts and per-student
  totals
- Upload assignments (PDF/PNG/JPG/DOC/DOCX, max 10 MB) to a class section;
  students of that class/section see and download them

**Student**
- Roll number + password sign-in; blocked (403 `PASSWORD_CHANGE_REQUIRED`)
  from all data endpoints until the password is changed once
- Dashboard with today's mark, overall percentage and assignment count
- Today/total attendance modal, assignment list + download (section-scoped)
- Every attendance save emails the whole class the correct status; a failed
  email never loses attendance data

## Tech stack

| Layer    | Choice |
|----------|--------|
| API      | Node 20+, Express 4, Zod validation, Multer (memory) uploads |
| Database | SQLite via better-sqlite3 (WAL), schema in `server/src/db.js` |
| Auth     | JWT (7 days) in httpOnly `campusledger_session` cookie, bcryptjs |
| Email    | Nodemailer — SMTP (`smtp`) or console (`dev`) transport |
| Client   | React 18 + react-router 6, Vite 6, plain CSS (no UI framework) |
| Tests    | Vitest + Supertest (50 unit/API tests), Playwright (8-step E2E) |

## Quick start (zero email setup)

```bash
npm install
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:4000 (health check: `GET /api/health`)

In dev mode (`MAIL_TRANSPORT=dev`, the default when no SMTP credentials are
set) nothing is actually delivered — rendered emails are printed to the server
console, and the admin "add student" response includes the temporary password
so you can try the student flow locally.

Demo administrator (from `server/.env`):

```
admin@campusledger.edu / Admin@Campus123
```

Reset local data any time:

```bash
rm -f server/data/campusledger.sqlite*
```

## Scripts

Run from the repository root:

| Command            | What it does |
|--------------------|--------------|
| `npm run dev`      | API (`:4000`, watch) + Vite client (`:5173`) together |
| `npm run build`    | Production client bundle into `client/dist/` |
| `npm start`        | Serve everything on one port (`build` first; API + built client) |
| `npm test`         | Backend unit/API tests (Vitest, in-memory SQLite) |
| `npm run e2e`      | Playwright smoke test (servers must already be running) |

## Environment variables

`server/.env` is loaded automatically. Copy `server/.env.example` to get started.

| Variable          | Default | Notes |
|-------------------|---------|-------|
| `PORT`            | `4000`  | API port |
| `APP_URL`         | `http://localhost:5173` | Used in emails/links |
| `NODE_ENV`        | —       | `production` enforces strong secrets |
| `JWT_SECRET`      | dev fallback | Required in production |
| `ADMIN_EMAIL`     | `admin@campusledger.edu` | Administrator account |
| `ADMIN_PASSWORD`  | `Admin@Campus123` | Administrator account |
| `DATABASE_PATH`   | `server/data/campusledger.sqlite` | SQLite file |
| `UPLOADS_DIR`     | `server/uploads/assignments` | Assignment files |
| `MAIL_TRANSPORT`  | `smtp` if SMTP creds set, else `dev` | `smtp` or `dev` |
| `MAIL_FROM`       | `CampusLedger <…>` | From header |
| `SMTP_HOST`       | `smtp.gmail.com` | |
| `SMTP_PORT`       | `587` | `465` switches to implicit TLS |
| `SMTP_USER`       | — | Your Gmail address |
| `SMTP_PASS`       | — | Gmail App Password (16 chars) |

## Sending real email with Gmail

Regular Gmail passwords will not work — Google requires an **App Password**:

1. Enable 2-Step Verification on the Google account.
2. Visit myaccount.google.com → Security → 2-Step Verification → App passwords.
3. Create one (name it e.g. "CampusLedger"); Google shows a 16-character
   password once.
4. Put your Gmail address and that App Password in `server/.env`:

```env
MAIL_TRANSPORT=smtp
SMTP_USER=you@gmail.com
SMTP_PASS=abcdefghijklmnop
```

5. Restart the server. Emails for welcome (temporary password) and attendance
   now go out for real, and the temporary password is never returned in the API
   response again — it is emailed instead.

## Demo flow

1. Sign in as the administrator → **Add student** (note the shown-once
   temporary password).
2. **Take attendance** → pick class/section → load roster → toggle → save.
   Watch the console for dev-mode emails.
3. **Student records** → filter by date/class; **Upload assignment** → pick a
   class section and a file.
4. Sign out, sign in as the student (roll number + temporary password) →
   forced password change → dashboard, attendance modal, assignments + download.
5. Back as admin → **Manage students** → delete; the student can no longer log in.

## API

All endpoints are JSON under `/api`. Session cookie required unless noted.

| Method & path | Role | Notes |
|---------------|------|-------|
| `GET /api/health` | public | `{ status: "ok" }` |
| `POST /api/auth/admin/login` | public | body `{ email, password }` |
| `POST /api/auth/student/login` | public | body `{ roll, password }` |
| `POST /api/auth/logout` | any | clears cookie |
| `GET /api/auth/me` | any | current session |
| `POST /api/auth/student/change-password` | student (pre-change OK) | `{ current_password, new_password }` |
| `GET /api/admin/overview` | admin | dashboard counts |
| `GET /api/admin/students` | admin | optional `?class=&section=&q=` |
| `POST /api/admin/students` | admin | returns `temp_password` only in dev/failed-email mode |
| `DELETE /api/admin/students/:id` | admin | cascades attendance |
| `GET /api/admin/attendance` | admin | `?date=&class=&section=` |
| `PUT /api/admin/attendance` | admin | `{ date, class, section, entries: [{ student_id, status }] }` |
| `GET /api/admin/assignments` | admin | |
| `POST /api/admin/assignments` | admin | multipart: `title, class, section, file` |
| `GET /api/admin/assignments/:id/download` | admin | |
| `GET /api/student/overview` | student | dashboard + stats |
| `GET /api/student/attendance` | student | today + totals |
| `GET /api/student/assignments` | student | own class/section only |
| `GET /api/student/assignments/:id/download` | student | 403 for other sections |

Errors are `{ "error": { "code", "message", "details?" } }`. Validation uses
Zod; uploads are capped at 10 MB (413 on overflow).

## Data model

- **students** — id, name, roll (unique, stored uppercase), class, section,
  email (unique, lowercase), phone, password_hash, must_change_password
- **attendance** — id, student_id (FK, cascade delete), date `YYYY-MM-DD`,
  status `present|absent`, emailed_at; UNIQUE(student_id, date)
- **assignments** — id, title, class, section, original_name, stored_name,
  mime, size_bytes, uploaded_at

## Security notes

- Passwords: bcryptjs; sessions: JWT in an httpOnly, SameSite=Lax cookie
  (`Secure` in production)
- `must_change_password` is re-checked from the DB on every student request
- Rate-limited logins; helmet security headers; Zod-validated inputs everywhere
- Uploads: type/extension whitelist, 10 MB cap, opaque generated filenames,
  path-traversal guard on downloads
- Section isolation: students can only fetch assignments for their own
  class/section; cross-section attempts return 403
- Never return secrets in production responses: temporary passwords are emailed,
  and the create-student response includes one only in dev mailer mode

## Testing

```bash
npm test          # 50 unit/API tests (in-memory SQLite, fake mail transport)
```

```bash
npm run dev       # terminal 1: keep servers running
npm run e2e       # terminal 2: Playwright 8-step browser smoke test
```

The E2E test drives the real UI: admin login → create student → take
attendance → records → upload assignment → student first-login password
change → attendance views → assignment download → delete student → verify
access is gone. Screenshots land in `$TMPDIR/campusledger-e2e/shots/`.
Requires Playwright's Chromium once: `npx playwright install chromium`.

## Project layout

```
attendance-portal/
├── package.json            # workspaces + dev/build/test/e2e/start scripts
├── e2e/smoke.js            # Playwright end-to-end smoke test
├── server/
│   ├── .env.example        # copy to .env
│   ├── src/
│   │   ├── index.js        # entry (serves client/dist in production)
│   │   ├── app.js          # express app, wiring, error handling
│   │   ├── config.js       # env parsing + dev fallbacks
│   │   ├── db.js           # schema, migrations, prepared statements
│   │   ├── lib/            # auth, mailer, files, validation, datetime…
│   │   ├── middleware/     # auth guards, rate limit, error handler
│   │   └── routes/         # auth / admin / student
│   └── tests/              # Vitest + Supertest suite
└── client/
    ├── vite.config.js      # dev proxy /api → :4000
    └── src/
        ├── App.jsx         # routes + auth guards
        ├── pages/          # landing, logins, admin + student screens
        └── components/     # shell, modals, tables, forms
```
