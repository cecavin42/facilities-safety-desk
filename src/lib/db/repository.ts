import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { AppData, NewIncident, QuestionLogEntry } from "../data-types";
import type { IncidentRecord, Status } from "../options";

const fields = `id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "createdAt",
  status, event_date::text AS "eventDate", event_time AS "eventTime", location,
  building_name AS "buildingName", shift, event_type AS "eventType", severity,
  days_away AS "daysAway", equipment, description, immediate_action AS "immediateAction",
  reporter_name AS "reporterName", reporter_email AS "reporterEmail"`;

export class BatchConflict extends Error {}

export async function transaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function readData(pool: Pool): Promise<AppData> {
  const [records, questions] = await Promise.all([
    pool.query<IncidentRecord>(
      `SELECT ${fields} FROM incident_records ORDER BY event_date DESC, created_at DESC, id DESC`,
    ),
    pool.query<QuestionLogEntry>(
      `SELECT question, answered, to_char(asked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "askedAt" FROM question_log ORDER BY asked_at, id`,
    ),
  ]);
  return { records: records.rows, questions: questions.rows };
}

export async function insertRecords(client: PoolClient, items: NewIncident[]) {
  return client.query<IncidentRecord>(
    `INSERT INTO incident_records
    (event_date, event_time, location, building_name, shift, event_type, severity, days_away,
     equipment, description, immediate_action, reporter_name, reporter_email)
    SELECT "eventDate"::date, "eventTime", location, "buildingName", shift, "eventType", severity,
      "daysAway", equipment, description, "immediateAction", "reporterName", "reporterEmail"
    FROM jsonb_to_recordset($1::jsonb) AS x("eventDate" text, "eventTime" text, location text,
      "buildingName" text, shift text, "eventType" text, severity text, "daysAway" integer,
      equipment text, description text, "immediateAction" text, "reporterName" text, "reporterEmail" text)
    RETURNING ${fields}`,
    [JSON.stringify(items)],
  );
}

// A retried form/import request returns its original IDs instead of duplicating records.
export async function addRecords(
  pool: Pool,
  items: NewIncident[],
  requestId: string,
): Promise<IncidentRecord[]> {
  const hash = createHash("sha256").update(JSON.stringify(items)).digest("hex");
  return transaction(pool, async (client) => {
    const claimed = await client.query(
      `INSERT INTO record_batches (id, payload_hash) VALUES ($1, $2)
      ON CONFLICT DO NOTHING RETURNING id`,
      [requestId, hash],
    );
    if (!claimed.rowCount) {
      const {
        rows: [batch],
      } = await client.query<{ payload_hash: string; record_ids: string[] }>(
        "SELECT payload_hash, record_ids FROM record_batches WHERE id = $1",
        [requestId],
      );
      if (batch.payload_hash !== hash)
        throw new BatchConflict(
          "Request ID already used for different records",
        );
      return (
        await client.query<IncidentRecord>(
          `SELECT ${fields} FROM incident_records WHERE id = ANY($1::text[]) ORDER BY id`,
          [batch.record_ids],
        )
      ).rows;
    }
    const { rows } = await insertRecords(client, items);
    await client.query(
      "UPDATE record_batches SET record_ids = $2 WHERE id = $1",
      [requestId, rows.map((r) => r.id)],
    );
    return rows;
  });
}

export async function changeStatus(pool: Pool, id: string, status: Status) {
  const result = await pool.query<IncidentRecord>(
    `UPDATE incident_records SET status = $2, updated_at = now() WHERE id = $1 RETURNING ${fields}`,
    [id, status],
  );
  return result.rows[0] ?? null;
}

export async function saveQuestion(
  pool: Pool,
  question: string,
  answered: boolean,
) {
  await pool.query(
    "INSERT INTO question_log (question, answered) VALUES ($1, $2)",
    [question, answered],
  );
}
