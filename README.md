# UniAbuja Portal

A working Next.js demo application implementing the University of Abuja unified
student portal specification in
[`Prompt_UniAbuja_Portal_v3.md`](./Prompt_UniAbuja_Portal_v3.md): 16 modules,
role-based access control, mock SSO, tamper-evident audit logging, SQLite data
layer and an integration-tested API.

> **Status:** functional demo. Replace the SQLite store with PostgreSQL for
> production (see [`docs/MIGRATION.md`](./docs/MIGRATION.md)) and review
> [`docs/SECURITY.md`](./docs/SECURITY.md) for hardening.

## Stack

- **Next.js 16** (App Router, Turbopack), React 19, TypeScript
- **Tailwind CSS v4** with the university brand theme (Jost + Roboto)
- **Prisma 7** (driver adapters) on **SQLite** via `better-sqlite3`
- **bcryptjs** password hashing, HMAC-signed session cookies
- **Vitest 4** for unit + integration tests

## Quickstart

```bash
npm install
npm run db:migrate      # prisma migrate dev (creates dev.db)
npm run db:seed         # loads 15 demo users + academic records
npm run dev             # http://localhost:3000
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
| `AB12` | Lecturer |
| `CD34` | HOD / Dean |
| `EF56` | Registry / Admissions |
| `GH78` | Bursary |
| `IJ90` | Student Affairs |
| `KL12` | Exams & Records |
| `MN34` | PG School |
| `OP56` | SIWES |
| `QR78` | Timetable / Venue |
| `ST90` | IT Admin |
| `UV12` | DVC Oversight |

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
src/lib/               # prisma, session, audit, password, RBAC, rate-limit
src/components/        # design system, header/footer, portal shell, forms
src/app/               # pages: public + /login + /portal/* + /api/v1/*
src/app/portal/        # dashboard, 12 modules, helpdesk, notifications, account
src/generated/prisma/  # generated Prisma client (Prisma 7 driver adapter)
```

## Environment

`.env` (see `.env.example`):

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="replace-with-a-long-random-secret"
```

> The seed password policy requires a temporary password on first login, so the
> seeded demo password `UniAbuja@2026` satisfies the policy rules.

## Docs

- [`docs/API.md`](./docs/API.md) — REST API reference
- [`docs/SECURITY.md`](./docs/SECURITY.md) — security model & production hardening
- [`docs/SCOPE-MEMO.md`](./docs/SCOPE-MEMO.md) — what is implemented vs. simulated
- [`docs/MIGRATION.md`](./docs/MIGRATION.md) — SQLite → PostgreSQL migration
- CI: `.github/workflows/ci.yml` runs lint, test and build
