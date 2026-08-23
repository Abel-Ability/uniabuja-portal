# Future Database Update Runbook

How to wipe the **production** database (Neon, behind Vercel) and repopulate it
with the current records from the **local** development database.

Status: **Last executed successfully on 2026-08-16** — 60 tables / 40,777 rows
copied (User 38,755 · Programme 589 · Announcement 8 · Session 113 · AuditLog
1,160 · AcademicCalendarEntry 5 · Course 8).

---

## 1. Prerequisites

| Requirement | How to check / get it |
| --- | --- |
| Local embedded PostgreSQL running | `npm run db:start` (keep running) |
| Local DB contains the source records | `DATABASE_URL` in `.env` (the local URL, e.g. `postgresql://portal:password@localhost:5432/portal?schema=public`) |
| Node + installed dependencies | `npm install` (needs `tsx`, `pg`, Prisma CLI) |
| Production Neon `DATABASE_URL` | See Section 2 — **cannot be pulled via `vercel env pull`** |
| Git branch is current | `git pull` / `git status` on `main` |

> The sync script is `scripts/sync-production-db.ts`. Run its dry-run before the
> real thing: `npx tsx scripts/sync-production-db.ts --dry-run`.

## 2. Obtaining the production DATABASE_URL (the gotcha)

- `vercel env pull` produces a **masked** file: every value is literally
  `[SENSITIVE]`. A `.env.production.local` created that way is **not usable** —
  do not rely on it.
- Get the real value from one of:
  1. **Vercel → Storage → Neon Postgres → Connection string** (copy button), or
  2. **Neon dashboard** (neon.tech → project → Connection Details → pooled
     `DATABASE_URL`).
- The URL looks like:
  `postgresql://neondb_owner:<password>@ep-<name>-pooler.c-<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- **Security:** never commit the URL to git. `.env.production.local` is covered
  by `.gitignore` (`.env*`), so it will not be pushed. If a URL is shared in
  chat/logs, rotate the password afterwards.

## 3. Safety check before wiping production

The sync is **destructive**: it replaces all production rows with local rows.
Recommended:

1. Confirm the local DB is the intended source of truth:
   `npx tsx scripts/sync-production-db.ts --dry-run` (prints planned row counts,
   touches nothing).
2. Optionally snapshot production first, e.g. via the Neon dashboard
   (point-in-time restore / branch) so a mistake is recoverable.
3. The script **never** touches `_prisma_migrations` (migrations are managed by
   `prisma migrate deploy`).

## 4. Commands (Windows PowerShell)

```powershell
# 4.1 Make the local DB schema the source of truth for migrations
$env:DATABASE_URL = "<production-neon-url>"
npx prisma migrate deploy

# 4.2 Clear production and repopulate from the local DB
$env:TARGET_DATABASE_URL = "<production-neon-url>"
npx tsx scripts/sync-production-db.ts
```

Expected tail of output:
```
Done. Copied 60 tables with data (40777 total rows).
```

On Linux/macOS, replace `$env:VAR` with `export VAR`.

## 5. What the sync script does

1. Reads source = `DATABASE_URL` (from `.env`, the local DB) and target =
   `TARGET_DATABASE_URL`.
2. Lists all source base tables (excluding `_prisma_migrations`).
3. **Drops** any target-only tables.
4. **Truncates** all target tables with `RESTART IDENTITY CASCADE`.
5. Copies each table in **foreign-key-safe order** (dependencies first),
   batches of 500 rows.
6. Casts `json`/`jsonb` columns to text and **sanitizes invalid JSON**
   (leftovers from the SQLite → Postgres migration, e.g. `{"CSC201"}` become
   valid JSON strings so the copy never aborts).
7. **Restores sequences** to the source max id.
8. Refuses to run against a `localhost`/`127.0.0.1` target.

## 6. Verification after the sync

```powershell
# Health (must show database:true)
curl.exe -s https://uniabuja-portal-rho.vercel.app/api/v1/health

# Pages backed by the DB must return 200
curl.exe -s -o NUL -w "%{http_code}`n" https://uniabuja-portal-rho.vercel.app/fees
curl.exe -s -o NUL -w "%{http_code}`n" https://uniabuja-portal-rho.vercel.app/notices
```

Optional direct DB count check (set `$env:PROD_URL` then run a small query or
the `_dbcheck` probe) — expected values to match the local DB:

| Table | Expected |
| --- | --- |
| User | 38,755 |
| Programme | 589 |
| Announcement | 8 |
| AcademicCalendarEntry | 5 |
| Session | 113 |
| AuditLog | 1,160 |

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `error: syntax error at or near "RESTART"` | Old script bug — pull latest `main` (`scripts/sync-production-db.ts` fixed: `TRUNCATE ... RESTART IDENTITY CASCADE`). |
| `error: invalid input syntax for type json` | Old script bug — json sanitization added; pull latest `main`. |
| `SECURITY WARNING: The SSL modes 'prefer'...` | Cosmetic `pg` driver warning; ignore. |
| Target still shows old data after deploy | Deployment only ships code; the **data** requires the sync (Section 4). |
| `.env.production.local` has `[SENSITIVE]` values | It came from `vercel env pull`; get the real URL from Section 2. |
| Login/pages behave like the DB is empty | Re-run Section 4; the sync is idempotent from scratch. |
