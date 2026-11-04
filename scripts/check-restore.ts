import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Pool } from "pg";
import { createAuth } from "../src/lib/auth-config";
import {
  backupKey,
  snapshot,
  encryptBackup,
  decryptBackup,
  restore,
  tableHashes,
} from "./backup-lib";
async function main() {
  process.loadEnvFile(".env.local");
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || url.port !== "54331")
    throw new Error(
      "Restore rehearsal is restricted to the isolated local database.",
    );
  const source = new Pool({ connectionString: url.toString() });
  const name = `fsd_restore_${Date.now()}`;
  let target: Pool | undefined;
  let created = false;
  try {
    const data = await snapshot(source);
    const key = await backupKey();
    const encrypted = encryptBackup(data, key);
    assert.throws(() => decryptBackup(encrypted, Buffer.alloc(32)));
    const corrupted = JSON.parse(encrypted);
    const bytes = Buffer.from(corrupted.data, "base64");
    bytes[30] ^= 1;
    corrupted.data = bytes.toString("base64");
    assert.throws(() => decryptBackup(JSON.stringify(corrupted), key));
    const decoded = decryptBackup(encrypted, key);
    await mkdir(".local/backups", { recursive: true });
    const file = `.local/backups/verified-${Date.now()}.json.enc`;
    await writeFile(file, encrypted, { flag: "wx", mode: 0o600 });
    await source.query(
      `CREATE DATABASE ${name} WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    created = true;
    url.pathname = "/" + name;
    target = new Pool({ connectionString: url.toString() });
    await restore(decoded, target);
    const after = await snapshot(target);
    assert.deepEqual(tableHashes(after), tableHashes(data));
    assert.deepEqual(after.sequences, data.sequences);
    assert.equal(
      Number(
        (await target.query('SELECT count(*) FROM "session"')).rows[0].count,
      ),
      0,
    );
    assert.equal(
      Number(
        (await target.query("SELECT count(*) FROM account_recovery")).rows[0]
          .count,
      ),
      0,
    );
    await assert.rejects(() => restore(decoded, target!), /empty database/);
    const accounts = JSON.parse(
      await readFile(".local/review-accounts.json", "utf8"),
    );
    const admin = accounts.find((a: { role: string }) => a.role === "admin");
    const signed = await createAuth(target).api.signInEmail({
      body: { email: admin.email, password: admin.password },
    });
    assert.ok(signed.user.id);
    const receipt = {
      tables: Object.fromEntries(
        Object.entries(data.tables).map(([name, rows]) => [name, rows.length]),
      ),
      tableHashesMatch: true,
      sequencesMatch: true,
      sessionsNotRestored: true,
      recoveryLinksNotRestored: true,
      restoredAdminPasswordWorks: true,
      tamperRejected: true,
      wrongKeyRejected: true,
      nonemptyTargetRejected: true,
      encryptedBackup: file,
    };
    await writeFile(
      "test-results/restore-checks.json",
      JSON.stringify(receipt, null, 2),
    );
    console.log(JSON.stringify(receipt, null, 2));
  } finally {
    await target?.end();
    if (created) {
      if (!/^fsd_restore_\d+$/.test(name))
        throw new Error("Unexpected scratch database name");
      await source.query(`DROP DATABASE ${name}`);
    }
    await source.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Restore check failed");
  process.exitCode = 1;
});
