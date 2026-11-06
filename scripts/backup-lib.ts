import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import type { Pool } from "pg";
import { migrate } from "./database";
const EPHEMERAL = new Set([
  "session",
  "verification",
  "rateLimit",
  "auth_attempts",
  "account_recovery",
]);
const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';
export type Snapshot = {
  format: string;
  createdAt: string;
  authSecretFingerprint: string;
  tables: Record<string, unknown[]>;
  dependencies: { child: string; parent: string }[];
  sequences: Record<string, { last_value: string; is_called: boolean }>;
};
export async function backupKey() {
  if (process.env.FSA_BACKUP_KEY) {
    const key = Buffer.from(process.env.FSA_BACKUP_KEY, "base64");
    if (key.length !== 32)
      throw new Error("Backup key must decode to 32 bytes.");
    return key;
  }
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname !== "127.0.0.1")
    throw new Error(
      "Set FSA_BACKUP_KEY through a separate secret store for hosted backups.",
    );
  await mkdir(".local", { recursive: true });
  if (!existsSync(".local/backup.key"))
    await writeFile(".local/backup.key", randomBytes(32), {
      flag: "wx",
      mode: 0o600,
    });
  const key = await readFile(".local/backup.key");
  if (key.length !== 32) throw new Error("Invalid local backup key.");
  return key;
}
export async function snapshot(pool: Pool): Promise<Snapshot> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const names = (
      await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
      )
    ).rows
      .map((r) => r.table_name as string)
      .filter((n) => !EPHEMERAL.has(n));
    const tables: Record<string, unknown[]> = {};
    for (const name of names)
      tables[name] = (
        await client.query(
          `SELECT to_jsonb(t) AS row FROM ${quote(name)} t ORDER BY to_jsonb(t)::text`,
        )
      ).rows.map((r) => r.row);
    const dependencies = (
      await client.query(
        `SELECT DISTINCT tc.table_name AS child,ccu.table_name AS parent FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.constraint_schema=tc.constraint_schema WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`,
      )
    ).rows.filter(
      (r) =>
        names.includes(r.child) &&
        names.includes(r.parent) &&
        r.child !== r.parent,
    );
    const sequences: Snapshot["sequences"] = {};
    for (const { sequencename } of (
      await client.query(
        "SELECT sequencename FROM pg_sequences WHERE schemaname='public'",
      )
    ).rows)
      sequences[sequencename] = (
        await client.query(
          `SELECT last_value::text,is_called FROM ${quote(sequencename)}`,
        )
      ).rows[0];
    await client.query("COMMIT");
    return {
      format: "fsd-authenticated-backup-v1",
      createdAt: new Date().toISOString(),
      authSecretFingerprint: createHash("sha256")
        .update(process.env.BETTER_AUTH_SECRET || "")
        .digest("hex"),
      tables,
      dependencies,
      sequences,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export function encryptBackup(data: Snapshot, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = Buffer.concat([
    cipher.update(gzipSync(JSON.stringify(data))),
    cipher.final(),
  ]);
  return JSON.stringify({
    format: "fsd-encrypted-backup-v1",
    createdAt: data.createdAt,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: payload.toString("base64"),
  });
}
export function decryptBackup(text: string, key: Buffer): Snapshot {
  const envelope = JSON.parse(text);
  if (envelope.format !== "fsd-encrypted-backup-v1")
    throw new Error("Unknown backup format.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const raw = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64")),
    decipher.final(),
  ]);
  const result = JSON.parse(gunzipSync(raw).toString("utf8"));
  if (result.format !== "fsd-authenticated-backup-v1")
    throw new Error("Unknown snapshot format.");
  return result;
}
export async function restore(data: Snapshot, pool: Pool) {
  const count = Number(
    (
      await pool.query(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
      )
    ).rows[0].count,
  );
  if (count)
    throw new Error(
      "Restore requires a new empty database. Existing tables were not changed.",
    );
  if (
    data.authSecretFingerprint !==
    createHash("sha256")
      .update(process.env.BETTER_AUTH_SECRET || "")
      .digest("hex")
  )
    throw new Error(
      "Restore requires the original auth secret, stored separately.",
    );
  if (
    (await pool.query("SHOW server_encoding")).rows[0].server_encoding !==
    "UTF8"
  )
    throw new Error("Restore target must use UTF-8.");
  await migrate(pool);
  const current = (
    await pool.query(
      "SELECT name,checksum FROM schema_migrations ORDER BY name",
    )
  ).rows;
  const expected = (
    data.tables.schema_migrations as { name: string; checksum: string }[]
  )
    .map(({ name, checksum }) => ({ name, checksum }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (JSON.stringify(current) !== JSON.stringify(expected))
    throw new Error(
      "Migration versions differ. Restore using the matching application revision.",
    );
  const available = new Set(
    (
      await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
      )
    ).rows.map((r) => r.table_name),
  );
  const pending = new Set(Object.keys(data.tables));
  const order: string[] = [];
  while (pending.size) {
    const ready = [...pending].filter(
      (n) =>
        !data.dependencies.some((d) => d.child === n && pending.has(d.parent)),
    );
    if (!ready.length)
      throw new Error("Unsupported circular table dependencies.");
    for (const name of ready) {
      if (!available.has(name) || EPHEMERAL.has(name))
        throw new Error("Unexpected backup table.");
      order.push(name);
      pending.delete(name);
    }
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM schema_migrations");
    for (const name of order)
      await client.query(
        `INSERT INTO ${quote(name)} SELECT * FROM jsonb_populate_recordset(NULL::${quote(name)},$1::jsonb)`,
        [JSON.stringify(data.tables[name])],
      );
    for (const [name, sequence] of Object.entries(data.sequences))
      await client.query("SELECT setval($1::regclass,$2,$3)", [
        quote(name),
        sequence.last_value,
        sequence.is_called,
      ]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export const tableHashes = (data: Snapshot) =>
  Object.fromEntries(
    Object.entries(data.tables).map(([name, rows]) => [
      name,
      createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    ]),
  );
