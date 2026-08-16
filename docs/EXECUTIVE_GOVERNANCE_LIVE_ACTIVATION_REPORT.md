# Executive & Governance Demo Account Activation — Milestone Report

Status: **COMPLETE** — 2026-08-15
Source config: `docs/EXECUTIVE_GOVERNANCE_RECOVERY_MILESTONE.md`
Tooling: `scripts/activate-executive-governance-demo.ts` (tsx)

## 1. Activation status

**COMPLETE** — all five demo accounts and both governance memberships are now
live in the current database. Post-activation verification passed every check.

## 2. Safety guard confirmation

- `DATABASE_URL` was parsed and asserted **before any write**:
  host `localhost`, port `5432`, database `portal`, schema `public`
  (`postgresql://portal:...@localhost:5432/portal?schema=public`).
- Guard would have aborted on any non-local host, non-`portal` database, or
  non-`public` schema. Target is the local demo database.

## 3. Accounts created (3)

| Username | Email | Role | Faculty | Department |
|---|---|---|---|---|
| YZ12 | dean@uniabuja.edu.ng | DEAN | Science | Computer Science |
| AC13 | sbc@uniabuja.edu.ng | SBC_CHAIRMAN | — | — |
| BD24 | gov@uniabuja.edu.ng | GOVERNANCE_OVERSIGHT_MEMBER | — | — |

All created with the demo password (bcrypt, cost 12 — same mechanism as
`prisma/seed.ts` via `src/lib/password.ts`), `mustChangePassword: true`,
`status: ACTIVE`, `emailVerifiedAt` set, and their seed-consistent
identity/staffNo fields. Password hashes/plaintext intentionally not printed.

## 4. Accounts updated (2)

- **hod@uniabuja.edu.ng** (CD34, HOD_DEAN): backfilled `faculty = Science`,
  `department = Computer Science`, `mustChangePassword = true`. Was already on
  the demo password and ACTIVE; password untouched.
- **dvc@uniabuja.edu.ng** (UV12, DVC_OVERSIGHT): backfilled `faculty = Science`,
  `department = Computer Science`, `mustChangePassword = true`. Was already on
  the demo password and ACTIVE; password untouched.

## 5. Accounts unchanged (0 on first run, 5 on re-run)

First run: no account already matched (hod/dvc needed faculty/department).
Second (idempotency) run: all 5 reported `[unchanged]`.

## 6. Governance memberships

| Email | Committee | Designation | Status | Result |
|---|---|---|---|---|
| dvc@uniabuja.edu.ng | GOVERNANCE_OVERSIGHT | CHAIRMAN | ACTIVE | created |
| gov@uniabuja.edu.ng | GOVERNANCE_OVERSIGHT | MEMBER | ACTIVE | created |

No pre-existing membership rows existed (`CommitteeMembership: 0`); both were
created once. No other committees/users touched.

## 7. Post-activation verification

All **26 checks PASS** (script `verify` subcommand):

- **[A] Accounts (5)** — role/faculty/department/status exact for hod, dean,
  sbc, gov, dvc; each resolves to exactly one row (no duplicates).
- **[B] Memberships (2)** — dvc CHAIRMAN/ACTIVE, gov MEMBER/ACTIVE via
  `membershipIsActive()`.
- **[C] RBAC (12)** — programmatic `can()`/`isHodRole()` checks: HOD & HOD_DEAN
  approve results; DEAN read-only (no approve, no submit); SBC Senate
  write+approve but cannot finalise results; GOV member read-only; DVC reads
  across Senate/Fees; VC executive read preserved.
- **[D] Pipeline (2)** — `RESULT_STAGE_ORDER` =
  `["SUBMITTED","HOD_APPROVED","SENATE_APPROVED","FINAL"]`; `DEAN_APPROVED`
  absent.
- **[E] Labels (7)** — `ROLE_LABELS` present for HOD, HOD_DEAN, DEAN,
  SBC_CHAIRMAN, GOVERNANCE_OVERSIGHT_MEMBER, DVC_OVERSIGHT, VC.

## 8. Data-integrity (before → after, first run)

| Table | Before | After | Delta |
|---|---|---|---|
| User | 16 | 19 | +3 |
| Staff Users | 12 | 15 | +3 |
| Student Users | 3 | 3 | +0 |
| Course | 8 | 8 | +0 |
| CourseOffering | 0 | 0 | +0 |
| CourseRegistration | 6 | 6 | +0 |
| Registration | 0 | 0 | +0 |
| Payment | 1 | 1 | +0 |
| Invoice | 3 | 3 | +0 |
| AuditLog | 56 | 56 | +0 |
| CommitteeMembership | 0 | 2 | +2 |
| Result | 6 | 6 | +0 |

No existing record modified or removed; changes are strictly additive.

## 9. Idempotency test

Second `apply` run: **created 0, updated 0, unchanged 7** (5 accounts + 2
memberships). All integrity deltas were `+0`. No duplicate users or membership
rows (protected by `@@unique([committee, userId])`). No AuditLog growth (the
script performs no audit writes — matching the seed's behaviour).

## 10. Test suite results

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 41 warnings (baseline; script adds none) |
| `npm test` | 15 files / 195 tests passed |
| `npm run build` | success |

## 11. Constraints honoured

- No `prisma migrate reset` / `db:reset` / `db:push` / `db:seed` / `db:migrate`.
- No destructive commands, no deletes, no truncates, no schema changes.
- No CSV/Sheet import; `scripts/generate-demo-users.mjs` not used.
- `ACCESS_CONTROL_MATRIX` untouched (read-only verification only).
- Unrelated staff/student/financial/academic records preserved (see §8).
- No audit-log noise introduced (idempotent no-ops produce no rows).

## 12. Remaining issues

- None blocking. Minor observations:
  - `hod@` and `dvc@` have `mustChangePassword = true` (forced change on next
    login, consistent with demo policy); if a shared demo session is desired,
    change once and it stays.
  - Live DB is the small seeded demo set (16 → 19 users), not the large CSV
    roster; the activation is intentionally targeted at the demo accounts only.

## 13. Report & tooling locations

- Report: `docs/EXECUTIVE_GOVERNANCE_LIVE_ACTIVATION_REPORT.md`
- Script: `scripts/activate-executive-governance-demo.ts`
  (`precheck` / `apply` / `verify` subcommands, safe-target guard built in)

## 14. Recommended next milestone

A **Demo walkthrough / UAT pass**: log in as each activated account
(hod, dean, sbc, gov, dvc) and exercise the HOD/Dean/SBC/DVC pages end-to-end
against the live database (results approval queue, Senate actions, governance
visibility), confirming the flows that RBAC unit tests assert are actually
reachable in the running app.
