import { readFile, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate, seedSources } from "./database";
async function main() {
  process.loadEnvFile(".env.local");
  const oldUrl = new URL(process.env.DATABASE_URL!);
  if (oldUrl.hostname !== "127.0.0.1" || oldUrl.port !== "54331")
    throw new Error("Only the isolated local auth database can be upgraded.");
  const old = new Pool({ connectionString: oldUrl.toString() });
  const name = "facilities_auth_utf8";
  let target: Pool | undefined;
  try {
    const encoding = (await old.query("SHOW server_encoding")).rows[0]
      .server_encoding;
    if (encoding === "UTF8") {
      console.log("Database already uses UTF-8.");
      return;
    }
    await migrate(old);
    if (
      (
        await old.query("SELECT datname FROM pg_database WHERE datname=$1", [
          name,
        ])
      ).rowCount
    )
      throw new Error(
        "UTF-8 target already exists; review it before proceeding.",
      );
    await old.query(
      `CREATE DATABASE ${name} WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    const newUrl = new URL(oldUrl);
    newUrl.pathname = "/" + name;
    target = new Pool({ connectionString: newUrl.toString() });
    await migrate(target);
    await old.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await target.query("BEGIN");
    const tables = [
      "schema_migrations",
      "user",
      "account",
      "session",
      "verification",
      "rateLimit",
      "twoFactor",
      "incident_records",
      "record_batches",
      "question_log",
      "demo_seed_runs",
      "audit_log",
      "auth_attempts",
      "account_recovery",
      "source_versions",
    ];
    const counts: Record<string, number> = {};
    await target.query("DELETE FROM schema_migrations");
    for (const table of tables) {
      const rows = (
        await old.query(`SELECT to_jsonb(t) AS row FROM "${table}" t`)
      ).rows.map((r) => r.row);
      await target.query(
        `INSERT INTO "${table}" SELECT * FROM jsonb_populate_recordset(NULL::"${table}",$1::jsonb)`,
        [JSON.stringify(rows)],
      );
      counts[table] = rows.length;
    }
    for (const sequence of ["incident_record_number", "audit_log_id_seq"]) {
      const r = (
        await old.query(`SELECT last_value::text,is_called FROM ${sequence}`)
      ).rows[0];
      await target.query("SELECT setval($1::regclass,$2,$3)", [
        sequence,
        r.last_value,
        r.is_called,
      ]);
    }
    await target.query("COMMIT");
    await old.query("COMMIT");
    for (const table of tables) {
      const n = Number(
        (await target.query(`SELECT count(*) AS n FROM "${table}"`)).rows[0].n,
      );
      if (n !== counts[table]) throw new Error("Copied row counts differ.");
    }
    await seedSources(target);
    const env = await readFile(".env.local", "utf8");
    await writeFile(
      ".env.local",
      env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${newUrl.toString()}`),
    );
    console.log(
      JSON.stringify({
        encoding: "UTF8",
        copiedTables: counts,
        originalDatabasePreserved: true,
      }),
    );
  } finally {
    await target?.end();
    await old.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "UTF-8 upgrade failed");
  process.exitCode = 1;
});
