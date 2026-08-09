# REST API v1

Base URL: `/api/v1`. All endpoints are JSON.

## Public endpoints

### `GET /health`

Health + database check.

```json
{ "status": "ok", "service": "uniabuja-portal-api", "version": "v1", "checks": { "database": true } }
```

### `GET /announcements`

Public announcements (PUBLIC scope, not expired). Rate limited to 60/min/IP.

```json
{ "count": 2, "items": [ { "id": "...", "title": "...", "body": "...", "category": "NEWS", "publishedAt": "..." } ] }
```

### `POST /verify/transcript`

Third-party verification of an issued transcript by its reference number.
Rate limited to 10/min/IP. Every check is written to the audit log
(`VERIFY` / `TRANSCRIPT`).

Request body:

```json
{ "referenceNo": "TXN-2026-000001" }
```

Reference format: `TXN-\d{4}-\d{6}`.

Responses:

- `200` — verified, with issued date and graduate/programme.
- `400` — malformed reference number.
- `404` — no issued record matches.

## Session-protected endpoint

### `GET /me`

Requires the `uap_session` cookie (the same HMAC cookie used by the web app).

- `200` — current user profile (`id`, `username`, `email`, `fullName`,
  `role`, `roleLabel`, `lastLoginAt`).
- `401` — `{ "error": "Unauthenticated" }`.

## Authentication model

- Web and API share the `uap_session` cookie — an HMAC-signed bearer token
  pointing at a row in `Session` (server-revocable, 4-hour TTL, idle tracking).
- Public endpoints are rate-limited by IP via `src/lib/rate-limit.ts`.
- In production, third-party integrations should use issued API credentials
  (modelled in `ApiCredential`) with mTLS/`x-api-key`, not the session cookie.
  See `docs/SECURITY.md`.

## Examples

```bash
# health
curl http://localhost:3000/api/v1/health

# verify a transcript
curl -X POST http://localhost:3000/api/v1/verify/transcript \
  -H "Content-Type: application/json" \
  -d '{"referenceNo":"TXN-2026-000001"}'

# who am I (with cookie jar from the web login)
curl --cookie cookies.txt http://localhost:3000/api/v1/me
```
