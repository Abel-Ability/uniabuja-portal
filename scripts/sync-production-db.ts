// Full-parity production database sync: copies every table (schema + data) from
// the local development PostgreSQL (DATABASE_URL) into a target PostgreSQL
// database (TARGET_DATABASE_URL or first CLI argument), e.g. the Neon database
// behind the Vercel deployment.
//
// The target schema must already match (run `prisma migrate deploy` against the
// target first). The copy is destructive on the target: all target rows are
// replaced by the local rows. It is safe to re-run; the source is the truth.
//
// Usage:
//   $env:TARGET_DATABASE_URL = "postgres://..."
//   npx tsx scripts/sync-production-db.ts            # full copy
//   npx tsx scripts/sync-production-db.ts --dry-run  # print plan, no target I/O
//
// Security: the target URL is never written to disk, logs, or git.
import "dotenv/config";
import { Pool } from "pg";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  const DRY_RUN = process.argv.includes("--dry-run");
  const targetUrl = process.env.TARGET_DATABASE_URL ?? process.argv[2];
  const sourceUrl = process.env.DATABASE_URL;

  if (!sourceUrl) {
    console.error("DATABASE_URL is not set (source/local DB).");
    process.exit(1);
  }
  if (!targetUrl && !DRY_RUN) {
    console.error("Target DB URL is missing. Set TARGET_DATABASE_URL or pass it as the first argument.");
    process.exit(1);
  }
  if (!DRY_RUN && /localhost|127\.0\.0\.1|::1/.test(targetUrl)) {
    console.error("Refusing to run against a localhost target. Provide the production URL.");
    process.exit(1);
  }

  const source = new Pool({ connectionString: sourceUrl });
  const target = DRY_RUN ? null : new Pool({ connectionString: targetUrl });

  const tablesRes = await source.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'
     ORDER BY table_name`
  );
  const tables = tablesRes.rows.map((r) => r.table_name as string).filter((t) => t !== "_prisma_migrations");

  const fkRes = await source.query(
    `SELECT tc.table_name AS t, ccu.table_name AS ref
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`
  );
  const deps = new Map<string, Set<string>>(tables.map((t) => [t, new Set()]));
  for (const r of fkRes.rows) {
    if (deps.has(r.t) && deps.has(r.ref)) deps.get(r.t)!.add(r.ref);
  }

  const visited = new Set<string>();
  const order: string[] = [];
  function visit(t: string): void {
    if (visited.has(t)) return;
    visited.add(t);
    for (const d of deps.get(t) ?? []) visit(d);
    order.push(t);
  }
  for (const t of tables) visit(t);

  if (DRY_RUN) {
    console.log("Planned full-parity copy (target untouched):");
    for (const t of order) {
      const c = await source.query(`SELECT count(*)::int AS n FROM "${t}"`);
      console.log(`  ${t}: ${c.rows[0].n} rows`);
    }
    await source.end();
    return;
  }

  console.log(`Copying ${tables.length} tables from source to target...`);

  const targetTablesRes = await target!.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'`
  );
  const targetTables = targetTablesRes.rows.map((r) => r.table_name as string);
  const extraTables = targetTables.filter((t) => t !== "_prisma_migrations" && !tables.includes(t));
  for (const t of extraTables) {
    console.log(`  dropping target-only table ${t}`);
    await target!.query(`DROP TABLE IF EXISTS "public"."${t}" CASCADE`);
  }

  console.log("  truncating target tables...");
  await target!.query(
    `TRUNCATE TABLE ${tables.map((t) => `"public"."${t}"`).join(", ")} RESTART IDENTITY CASCADE`
  );

  const totals: Record<string, number> = {};
  for (const t of order) {
    const colsRes = await source.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER'
       ORDER BY ordinal_position`,
      [t]
    );
    const colDefs = colsRes.rows.map((r) => ({ name: r.column_name as string, type: r.data_type as string }));
    const cols = colDefs.map((c) => c.name);
    if (cols.length === 0) continue;

    const selectExpr = colDefs
      .map((c) => (c.type === "json" || c.type === "jsonb" ? `"${c.name}"::text AS "${c.name}"` : `"${c.name}"`))
      .join(", ");
    const data = await source.query(`SELECT ${selectExpr} FROM "public"."${t}"`);
    const rows = data.rows;
    if (rows.length === 0) {
      console.log(`  ${t}: 0 rows`);
      continue;
    }

    const BATCH = 500;
    for (const batch of chunk(rows, BATCH)) {
      const values: unknown[] = [];
      const tuples = batch.map((row) => {
        const placeholders = colDefs.map((c) => `$${values.length + 1 + colDefs.indexOf(c)}`).join(", ");
        for (const c of colDefs) {
          let v = row[c.name];
          if ((c.type === "json" || c.type === "jsonb") && typeof v === "string") {
            try {
              JSON.parse(v);
            } catch {
              v = JSON.stringify(v);
            }
          }
          values.push(v);
        }
        return `(${placeholders})`;
      });
      const sql = `INSERT INTO "public"."${t}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES ${tuples.join(", ")}`;
      await target!.query(sql, values);
    }

    for (const c of cols) {
      const seqRes = await source.query(`SELECT pg_get_serial_sequence($1, $2) AS seq`, [`"public"."${t}"`, c]);
      const seq = seqRes.rows[0].seq as string | null;
      if (!seq) continue;
      const maxRes = await source.query(`SELECT max("${c}") AS m FROM "public"."${t}"`);
      const m = maxRes.rows[0].m;
      if (m !== null && m !== undefined) {
        await target!.query(`SELECT setval($1, $2, true)`, [seq, m]);
      }
    }

    totals[t] = rows.length;
    console.log(`  ${t}: ${rows.length} rows`);
  }

  await source.end();
  await target!.end();
  console.log(`\nDone. Copied ${Object.keys(totals).length} tables with data (${Object.values(totals).reduce((a, b) => a + b, 0)} total rows).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
