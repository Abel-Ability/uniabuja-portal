# Security Model

This document describes the security controls implemented in the demo and the
hardening required before production use.

## Implemented controls

| Control | Where | Notes |
| --- | --- | --- |
| Password hashing | `src/lib/password.ts` | bcrypt, cost 12. |
| Password policy | `src/lib/password.ts` | 10+ chars, upper/lower/digit/special, 180-day max age, 5-password history in spec (history checks are a TODO in the change-password flow). |
| Account lockout | `src/app/login/actions.ts` | 5 failed attempts → 15-minute lock (`failedAttempts`, `lockedUntil`). |
| Rate limiting | `src/lib/rate-limit.ts` | In-memory token buckets on login (20/min/IP) and public API endpoints. Replace with a shared store (Redis) in multi-instance production. |
| Bot protection | `login-form.tsx` | Honeypot field; CAPTCHA is production-only (see below). |
| Session cookies | `src/lib/session.ts` | `httpOnly`, `sameSite=lax`, `secure` in production, 4-hour TTL, server-side `Session` rows with revocation + idle tracking. |
| Session management | `portal/account` | View active sessions, revoke individual/all, "sign out other devices". |
| Forced password change | `User.mustChangePassword` | First-login and post-reset. |
| RBAC | `src/lib/constants.ts` | Access Control Matrix enforced server-side by `can()` / `visibleModules()`; every portal module resolves its permission list from the role. |
| Audit trail | `src/lib/audit.ts` | Append-only, SHA-256 hash-chained `AuditLog`; `verifyChain()` recomputes and detects tampering (tested). No UPDATE/DELETE code paths exist in the app. |
| Data minimisation | `verify` pages, `/api/v1/verify/transcript` | Public verification returns only issued-date + graduate + programme, never results or contact data. |
| Secrets | `.env` | `SESSION_SECRET`; never committed. |
| Headers/IDs | `src/app/globals.css`, layouts | Skip-to-content links, visible focus rings, WCAG colour contrast. |

## Production hardening checklist

1. **Database** — move from SQLite to PostgreSQL (see `docs/MIGRATION.md`).
   Grant the app role only `INSERT`/`SELECT` on `AuditLog` so the append-only
   invariant is enforced at the database level.
2. **Secrets** — set a real random `SESSION_SECRET` (openssl rand -base64 48).
   Rotate on key compromise. Use a KMS (AWS KMS / GCP KMS) for transcript
   signing keys (`TranscriptRequest.signedKeyRef`).
3. **MFA / step-up auth** — `User.mfaEnabled` and `Session.mfaVerifiedAt`
   exist; wire a TOTP/WebAuthn provider and require step-up
   (`STEP_UP` audit action) for approval and sensitive mutations.
4. **CAPTCHA** — add Turnstile/hCaptcha to `/login` and public forms behind
   the `FEATURES` flag system (`src/lib/features.ts`).
5. **TLS + security headers** — terminate TLS at the load balancer; add
   CSP, HSTS, X-Content-Type-Options, frame-ancestors via Next.js headers.
6. **OAuth 2.0 / OIDC** — the SSO surface is mocked at `/login`. In
   production, front the portal with an identity provider (e.g. Keycloak or
   a university IdP) and keep the RBAC matrix as the authorisation layer.
7. **Rate limiter** — move `src/lib/rate-limit.ts` to Redis so limits
   survive horizontal scaling and multiple instances.
8. **Backup & retention** — nightly encrypted backups of `dev.db`/Postgres;
   NDPA retention schedules per data class (see `docs/SCOPE-MEMO.md`).

## Incident response

- Breach notifications are modelled in the DPO module
  (`DataSubjectRequest`, consent register). Production should attach the
  NDPA 72-hour internal reporting SLA to the DPO dashboard.
- The audit chain makes post-incident forensics possible: run
  `verifyChain()` (also exposed through tests) to prove log integrity.

## Reporting

Security issues should be reported privately to the IT directorate; the demo
is a training/staging artifact and must not hold real personal data.
