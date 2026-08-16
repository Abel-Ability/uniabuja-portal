# UniAbuja Portal

A working Next.js demo application implementing the University of Abuja unified
student portal specification in
[`Prompt_UniAbuja_Portal_v3.md`](./Prompt_UniAbuja_Portal_v3.md): 16 modules,
role-based access control, mock SSO, tamper-evident audit logging, PostgreSQL
data layer and an integration-tested API.

> **Status:** functional demo running on PostgreSQL via an embedded Postgres
> binary for local development (see [`docs/MIGRATION.md`](./docs/MIGRATION.md))
> and review [`docs/SECURITY.md`](./docs/SECURITY.md) for hardening.

## Stack

- **Next.js 16** (App Router, Turbopack), React 19, TypeScript
- **Tailwind CSS v4** with the university brand theme (Jost + Roboto)
- **Prisma 7** (driver adapters) on **PostgreSQL** via `@prisma/adapter-pg`
- **bcryptjs** password hashing, HMAC-signed session cookies
- **Vitest 4** for unit + integration tests

## Quickstart

```bash
npm install
npm run db:start        # starts embedded PostgreSQL on port 5432 (keep running)
npm run db:migrate      # prisma migrate dev (applies migrations to portal DB)
npm run db:generate     # generates data/staff.csv + data/students.csv from live sheet
npm run db:seed         # loads 15 demo users + academic records (keep-list: 12/345ABC/678, UA/PG1234/567890, 99/123XYZ/456)
npm run db:sync-roster  # syncs staff/students from the Google Sheet
                      #   or from data/ files (--from=data) with optional purge (--purge-stale-students)
npm run dev             # http://localhost:3000 (in a second terminal)
```

Check quality:

```bash
npm run lint
npm test
npm run build
```

## Demo accounts

Any account signs in with the password `UniAbuja@2026` (the applicant and PG
student are forced to change it on first login).

| Username | Role |
| --- | --- |
| `12/345ABC/678` | Undergraduate Student |
| `applicant@uniabuja.edu.ng` | Applicant |
| `UA/PG1234/567890` | PG Student |
| `ACA3879` | Lecturer |
| `ACA140` | Head of Department |
| `SS6424` | Registry / Admissions |
| `SS5762` | Bursary |
| `SS8229` | Student Affairs |
| `SS953` | Exams & Records |
| `SS8026` | PG School |
| `SS6753` | SIWES |
| `QR78` | Timetable / Venue |
| `SS5103` | IT Admin |
| `ACA5129` | DVC Oversight |
| `ACA3998` | Vice-Chancellor |
| `ACA8614` | Dean of Faculty |
| `AC13` | SBC Chairman |
| `BD24` | Governance Oversight |

> The seed above is a demo subset. `npm run db:sync-roster` upserts the full
> staff and student roster from the Google Sheet (staff tab → staff users,
> students tab → students). Demo staff accounts use their real sheet staff
> numbers as usernames, so a re-sync updates their details in place without
> overwriting passwords.

> The CSV files under `data/` are generated from the live Google Sheet via
> `npm run db:generate` (see `scripts/generate-roster-files.ts`). They may be
> pasted directly into the sheet tabs; running `npm run db:sync-roster` (with
> `--from=data`) will materialise them into the DB. Stale roster students can be
> purged with `--purge-stale-students`, keeping the three seed demo accounts
> (`12/345ABC/678`, `UA/PG1234/567890`, `99/123XYZ/456`) and their dependents.

## What works

- **Public site:** landing page, admissions info, notices, policies, service
  status, and public transcript verification (`/verify`).
- **Auth/SSO:** login with lockout (5 attempts → 15 min) + rate limiting,
  honeypot field, forced password change, session list with revoke-all,
  logout. **MFA:** TOTP two-step login (`/login/mfa`) with self-service
  enable/disable on the Account page, plus step-up verification that gates
  sensitive actions (payments, transcript issuance, allocations, admin).
- **Portal:** role-scoped dashboard (stats per role), 12 module pages +
  Admin/DPO/Communications scaffolds, helpdesk ticket creation, notifications.
- **Student-facing modules (functional):** Fees (invoices, simulated Remita
  payment, waivers/scholarships, payment plans), Results (per-semester GPA +
  CGPA with award class), Transcripts (online requests with generated
  references, fee billing, exams-unit issuance), Graduation & Clearance
  (6-department checklist with role-matched sign-off that auto-completes),
  Accommodation (apply → allocate with auto-waitlist → fee invoice → pay →
  fee verification, plus maintenance queue).
- **RBAC:** the full access-control matrix lives in
  `src/lib/constants.ts` and is enforced by `can()` / `visibleModules()`.
- **Audit trail:** append-only, hash-chained `AuditLog`; `verifyChain()`
  detects any tampering (covered by tests).
- **API v1:** `/api/v1/health`, `/announcements`, `/verify/transcript`,
  `/me` (session-protected). See [`docs/API.md`](./docs/API.md).

## Project layout

```
prisma/schema.prisma   # ~45 models across all 16 modules
prisma/seed.ts         # demo data (users, programmes, results, invoices...)
scripts/start-db.ts    # embedded PostgreSQL launcher (npm run db:start)
src/lib/               # prisma, session, audit, password, RBAC, rate-limit
src/components/        # design system, header/footer, portal shell, forms
src/app/               # pages: public + /login + /portal/* + /api/v1/*
src/app/portal/        # dashboard, 12 modules, helpdesk, notifications, account
src/generated/prisma/  # generated Prisma client (Prisma 7 driver adapter)
```

## Environment

`.env` (see `.env.example`):

```env
DATABASE_URL="postgresql://portal:password@localhost:5432/portal?schema=public"
SESSION_SECRET="replace-with-a-long-random-secret"
PGPORT=5432
PGUSER=portal
PGPASSWORD=password
PGDATABASE=portal
PGDATADIR=./data/pgdata
```

> The seed password policy requires a temporary password on first login, so the
> seeded demo password `UniAbuja@2026` satisfies the policy rules.

## Docs

- [`docs/API.md`](./docs/API.md) — REST API reference
- [`docs/SECURITY.md`](./docs/SECURITY.md) — security model & production hardening
- [`docs/SCOPE-MEMO.md`](./docs/SCOPE-MEMO.md) — what is implemented vs. simulated
- [`docs/MIGRATION.md`](./docs/MIGRATION.md) — SQLite → PostgreSQL migration
- CI: `.github/workflows/ci.yml` runs lint, test and build
