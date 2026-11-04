import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";
import { transaction } from "../src/lib/db/repository";
import { seedQuestions, seedRecords } from "../src/lib/seed";

export async function migrate(pool: Pool) {
  const directory = path.resolve("db/migrations");
  const files = (await readdir(directory))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  await transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(5563, 1)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const file of files) {
      // Git checkouts on Windows may use CRLF; hash the same SQL on every host.
      const sql = (await readFile(path.join(directory, file), "utf8")).replace(
        /\r\n/g,
        "\n",
      );
      const checksum = createHash("sha256").update(sql).digest("hex");
      const { rows } = await client.query(
        "SELECT checksum FROM schema_migrations WHERE name = $1",
        [file],
      );
      if (rows.length) {
        if (rows[0].checksum !== checksum)
          throw new Error(`Applied migration was changed: ${file}`);
        continue;
      }
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
        [file, checksum],
      );
    }
  });
}

// Insert the original demo once. Reruns never reset shared records or status changes.
export async function seed(pool: Pool, today = new Date()) {
  return transaction(pool, async (client) => {
    const claim = await client.query(
      "INSERT INTO demo_seed_runs (name) VALUES ('original-demo-v1') ON CONFLICT DO NOTHING RETURNING name",
    );
    if (!claim.rowCount) return false;
    for (const r of seedRecords(today)) {
      await client.query(
        `INSERT INTO incident_records
        (id, created_at, status, event_date, event_time, location, building_name, shift, event_type, severity,
         days_away, equipment, description, immediate_action, reporter_name, reporter_email)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT DO NOTHING`,
        [
          r.id,
          r.createdAt,
          r.status,
          r.eventDate,
          r.eventTime,
          r.location,
          r.buildingName,
          r.shift,
          r.eventType,
          r.severity,
          r.daysAway,
          r.equipment,
          r.description,
          r.immediateAction,
          r.reporterName,
          r.reporterEmail,
        ],
      );
    }
    const questions = seedQuestions(today);
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await client.query(
        "INSERT INTO question_log (id, question, answered, asked_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [`S-Q-${i + 1}`, q.question, q.answered, q.askedAt],
      );
    }
    return true;
  });
}
