// Starts the embedded PostgreSQL cluster used for local development.
// Reads connection settings from .env (PGDATADIR, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
// Usage: npm run db:start
import "dotenv/config";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const databaseDir = path.resolve(process.env.PGDATADIR ?? "./data/pgdata");
const port = Number(process.env.PGPORT ?? 5432);
const user = process.env.PGUSER ?? "postgres";
const password = process.env.PGPASSWORD ?? "password";
const database = process.env.PGDATABASE ?? "portal";

function isPortInUse(targetPort: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(targetPort, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function main(): Promise<void> {
  if (await isPortInUse(port)) {
    console.log(
      `PostgreSQL is already listening on port ${port}; nothing to do.`,
    );
    return;
  }

  // If the port is free, any leftover postmaster.pid is stale and would block
  // a clean start.
  const pidFile = path.join(databaseDir, "postmaster.pid");
  if (fs.existsSync(pidFile)) {
    fs.rmSync(pidFile, { force: true });
    console.log(`Removed stale ${pidFile}.`);
  }

  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user,
    password,
    authMethod: "password",
    persistent: true,
  });

  if (!fs.existsSync(path.join(databaseDir, "PG_VERSION"))) {
    console.log("Initialising a new PostgreSQL cluster...");
    await pg.initialise();
  }

  console.log(
    `Starting embedded PostgreSQL on port ${port} (data dir: ${databaseDir})...`,
  );
  await pg.start();
  console.log("PostgreSQL is running and ready to accept connections.");

  const client = pg.getPgClient();
  await client.connect();
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [database],
  );
  if (result.rowCount === 0) {
    await client.end();
    await pg.createDatabase(database);
    console.log(`Created database "${database}".`);
  } else {
    await client.end();
  }

  console.log(
    `Database "${database}" is available at postgresql://${user}:***@localhost:${port}/${database}`,
  );
  console.log("Keep this process running while developing (Ctrl+C to stop).");
  await new Promise<void>(() => {});
}

main().catch((err: unknown) => {
  console.error("Failed to start PostgreSQL:", err);
  process.exit(1);
});
