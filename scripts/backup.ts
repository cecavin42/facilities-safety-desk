import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Pool } from "pg";
import {
  backupKey,
  snapshot,
  encryptBackup,
  decryptBackup,
  restore,
} from "./backup-lib";
async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const key = await backupKey();
  if (process.argv[2] === "restore") {
    if (
      process.env.FSA_ALLOW_RESTORE !== "1" ||
      !process.env.RESTORE_DATABASE_URL ||
      !process.argv[3]
    )
      throw new Error(
        "Set FSA_ALLOW_RESTORE=1 and RESTORE_DATABASE_URL for a new empty target, then provide the backup path.",
      );
    const data = decryptBackup(await readFile(process.argv[3], "utf8"), key);
    const pool = new Pool({
      connectionString: process.env.RESTORE_DATABASE_URL,
    });
    try {
      await restore(data, pool);
      console.log(
        "Restore complete. All prior sessions and recovery links remain invalid.",
      );
    } finally {
      await pool.end();
    }
    return;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const data = await snapshot(pool);
    await mkdir(".local/backups", { recursive: true });
    const file = `.local/backups/facilities-${new Date().toISOString().replace(/[:.]/g, "-")}.json.enc`;
    await writeFile(file, encryptBackup(data, key), {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      JSON.stringify({
        file,
        tables: Object.fromEntries(
          Object.entries(data.tables).map(([name, rows]) => [
            name,
            rows.length,
          ]),
        ),
        sessionsExcluded: true,
      }),
    );
  } finally {
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Backup operation failed");
  process.exitCode = 1;
});
