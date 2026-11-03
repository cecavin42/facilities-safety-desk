import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
import { createPool } from "../src/lib/db/pool";
import { migrate, seed } from "./database";

async function main() {
  const directory = path.resolve(".test-db/local");
  const postgres = new EmbeddedPostgres({
    databaseDir: directory, user: "postgres", password: "local-demo-only", port: 54330,
    persistent: true, postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: () => {}, onError: () => {},
  });
  if (!existsSync(path.join(directory, "PG_VERSION"))) await postgres.initialise();
  await postgres.start();
  const pool = createPool("postgresql://postgres:local-demo-only@127.0.0.1:54330/postgres");
  try { await migrate(pool); await seed(pool); } finally { await pool.end(); }
  console.log("Local PostgreSQL ready on 127.0.0.1:54330. Demo data is persistent. Ctrl+C stops it.");
  const stop = async () => { await postgres.stop(); process.exit(0); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await new Promise(() => {});
}
main().catch(() => { console.error("Local PostgreSQL failed to start. Check that port 54330 is free."); process.exitCode = 1; });
