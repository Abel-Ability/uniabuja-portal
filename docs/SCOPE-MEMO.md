# Scope Memo — What's Implemented vs. Simulated

Maps the requirements in `Prompt_UniAbuja_Portal_v3.md` to the demo
implementation. Where a requirement is simulated or deferred, this memo says
so explicitly so reviewers can separate working code from placeholders.

## Implemented (working in this repo)

| Area | Implementation |
| --- | --- |
| Portal shell & navigation | Role-scoped sidebar, mobile drawer, per-module pages. |
| Auth & session | Login, lockout, rate limit, honeypot + arithmetic CAPTCHA, forced password change with reuse-history check (last 5), logout, session listing + revocation. |
| MFA / step-up auth | TOTP (RFC 6238, base32 secret) enable/disable on the Account page, `/login/mfa` second step, and `requireStepUp()` gating on sensitive actions (payments, transcript issuance, clearance sign-off, bed allocation, admissions/PG advances, admin config, API credential revocation). |
| RBAC matrix | Full Access Control Matrix in `src/lib/constants.ts`, enforced in layouts and dashboard actions. |
| Audit log | Append-only hash-chained `AuditLog`; `verifyChain()` verifies integrity; tests detect tampering. |
| Demo data | 15 users (one per role), programmes/courses, results (multi-stage), invoices, hostel app, transcript requests, venue bookings, announcements, help tickets. |
| Public verification | `/verify` page + `POST /api/v1/verify/transcript` with audit logging and IP rate limits. |
| Helpdesk | Create + list tickets (functional); staff assignment/SLA are schema-only. |
| Notifications | List + mark-all-read; channel rows exist for IN_APP/EMAIL/SMS. |
| Dashboard | Role-scoped stat cards and quick actions. |
| Accommodation (deep workflow) | Apply (hostel + room preference) → allocation by Student Affairs (with auto waitlisting when beds run out) → auto-created accommodation invoice → Remita payment → fee verification on the application. Maintenance request + resolve queue. |

## Simulated / placeholder (schema + scaffold, not full flows)

| Area | Status |
| --- | --- |
| 12 module pages (`/portal/*`) | Scaffolded pages showing the role's permissions and planned screens. Deep flows (apply→offer→CAPS, result entry→senate approval, etc.) are schema + seed only. |
| Remita/NIBSS payments | `Payment` rows seeded with statuses; no real PSP call. `ApiCredential` models provider credentials. |
| Moodle SSO / LMS grade passback | `LmsSyncLog` model; no external Moodle call. |
| KMS/HSM transcript signing | `TranscriptRequest.signedKeyRef` references a key path; no signing is performed. |
| CAPTCHA | Arithmetic CAPTCHA (HMAC-signed challenge, per-request) plus the honeypot field on the login form. |
| CAPS / NIPEDS / ITEX / NYSC integration | Status fields (`capsStatus`, `nipedsStatus`, `nyscRecord`) seeded; no live calls. |
| FOI & data-subject requests | `DataSubjectRequest` / `FOIRequest` models + DPO scaffold; no self-serve DSR wizard. |
| OCR/ID checks | `IdCard.qrRef` unique per holder; no ID issuance workflow. |
| Timetable clash engine | `VenueBooking` model; no solver. |

## Cross-cutting requirements covered

- **Accessibility:** skip links, visible focus, reduced-motion, semantic
  headings, contrast-checked palette (verified for AA).
- **Branding:** `#32a320` green, slate `#2e3e4e`, gold `#c9a227`; Jost +
  Roboto loaded via `next/font`.
- **Data protection (NDPA 2023):** consent banner, consent register,
  DPO/DPO-dashboard scaffolds, verification minimisation, audit trail.
- **Roles:** the 14 portal roles in the spec are represented by demo users
  and enforced through the matrix.

## Known TODOs (tracked)

- WebAuthn / passkeys alongside TOTP.
- Deep implementations of the remaining scaffolded module workflows (Applications → offer → CAPS, PG admissions, SIWES sign-off, Timetabling).
- Postgres adapter + CI against a real Postgres service.
- Replace `public/images/gate.svg` placeholder with the official gate photo.

See `README.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/MIGRATION.md`.
