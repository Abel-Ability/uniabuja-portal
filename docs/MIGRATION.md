# Migrating from SQLite to PostgreSQL

The demo runs on SQLite so it needs zero external services. Production should
run PostgreSQL. The Prisma schema uses only portable types (no SQLite-specific
features), so the migration is a configuration change plus a data dump.

## Why Postgres

- Multi-user concurrency (SQLite serialises writers).
- Real `Json`/arrays, full-text search for the catalogue and timetable.
- Row-level security options and stronger backup tooling.

## Steps

### 1. Install the adapter and a PG client

```bash
npm install @prisma/adapter-pg pg
npm install -D @types/pg
```

### 2. Swap the adapter in `src/lib/prisma.ts`

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

### 3. Point `.env` at Postgres

```env
DATABASE_URL="postgresql://portal:password@db.uniabuja.edu.ng:5432/portal?schema=public"
```

### 4. Reset the provider and migrate

In `prisma/schema.prisma` change `provider = "sqlite"` to `provider = "postgresql"`.

```bash
npm run db:generate
npx prisma migrate dev --name postgres
```

> Existing SQLite rows can be exported with the Prisma Studio UI or a small
> migration script; for the demo, re-running `npm run db:seed` is the fastest
> path since it is pure relational data with no files.

### 5. Verify

```bash
npm test
npm run build
```

## Post-migration hardening

- Use a dedicated app role with least privilege; revoke `UPDATE`/`DELETE`
  on `AuditLog` (append-only enforcement at the DB level).
- Enable TLS for the connection string.
- Add nightly `pg_dump` backups and retention schedules.
- If you scale beyond one instance, replace the in-memory rate limiter
  (`src/lib/rate-limit.ts`) with Redis.
