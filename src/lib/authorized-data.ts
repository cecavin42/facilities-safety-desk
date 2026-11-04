import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { database } from "./database";
import { transaction } from "./db/repository";
import type { CurrentUser } from "./access";
import type { IncidentRecord, Status } from "./options";
import type { NewIncident } from "./data-types";
import { planImport } from "./incident-import";
import { HttpError } from "./server-access";

const fields = `id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "createdAt", updated_at::text AS "updatedAt", status,
event_date::text AS "eventDate", event_time AS "eventTime", location, building_name AS "buildingName", shift,
event_type AS "eventType", severity, days_away AS "daysAway", equipment, description, immediate_action AS "immediateAction", reporter_name AS "reporterName", reporter_email AS "reporterEmail"`;
async function activeActor(
  client: PoolClient,
  user: CurrentUser,
  adminOnly = false,
) {
  const {
    rows: [actor],
  } = await client.query(
    'SELECT role, banned FROM "user" WHERE id=$1 FOR SHARE',
    [user.id],
  );
  if (!actor || actor.banned) throw new HttpError("Sign in to continue.", 401);
  if (adminOnly && actor.role !== "admin")
    throw new HttpError("Administrator access is required.", 403);
}
export async function scopedData(user: CurrentUser) {
  const records = await database().query<IncidentRecord>(
    `SELECT ${fields} FROM incident_records WHERE ($1::boolean OR created_by=$2) ORDER BY event_date DESC, created_at DESC`,
    [user.role === "admin", user.id],
  );
  const questions =
    user.role === "admin"
      ? await database().query(
          `SELECT question, answered, asked_at AS "askedAt" FROM question_log ORDER BY asked_at`,
        )
      : { rows: [] };
  return { records: records.rows, questions: questions.rows, user };
}
export async function scopedRecord(user: CurrentUser, id: string) {
  const {
    rows: [record],
  } = await database().query(
    `SELECT ${fields} FROM incident_records WHERE id=$1 AND ($2::boolean OR created_by=$3)`,
    [id, user.role === "admin", user.id],
  );
  if (!record) throw new HttpError("Report not found.", 404);
  return record;
}
export async function createRecords(
  user: CurrentUser,
  items: NewIncident[],
  requestId: string,
  isImport = false,
  allowDuplicates = false,
) {
  const hash = createHash("sha256")
    .update(JSON.stringify({ items, isImport, allowDuplicates }))
    .digest("hex");
  return transaction(database(), async (client) => {
    await activeActor(client, user, isImport);
    await client.query("SELECT pg_advisory_xact_lock(5563, 2)");
    const {
      rows: [existing],
    } = await client.query(
      "SELECT requested_by,payload_hash,record_ids,duplicate_count FROM record_batches WHERE id=$1",
      [requestId],
    );
    if (existing) {
      if (existing.requested_by !== user.id || existing.payload_hash !== hash)
        throw new HttpError(
          "This request identifier cannot be reused for this operation.",
          409,
        );
      return {
        ids: existing.record_ids as string[],
        duplicateCount: existing.duplicate_count as number,
      };
    }
    let records = items;
    let duplicateCount = 0;
    if (isImport && !allowDuplicates) {
      const all = await client.query<IncidentRecord>(
        `SELECT ${fields} FROM incident_records`,
      );
      const plan = planImport(items, all.rows);
      records = plan.records;
      duplicateCount = plan.duplicateCount;
    }
    const result = records.length
      ? await client.query<{ id: string }>(
          `INSERT INTO incident_records (event_date,event_time,location,building_name,shift,event_type,severity,days_away,equipment,description,immediate_action,reporter_name,reporter_email,created_by)
      SELECT "eventDate"::date,"eventTime",location,"buildingName",shift,"eventType",severity,"daysAway",equipment,description,"immediateAction","reporterName","reporterEmail",$2
      FROM jsonb_to_recordset($1::jsonb) AS x("eventDate" text,"eventTime" text,location text,"buildingName" text,shift text,"eventType" text,severity text,"daysAway" integer,equipment text,description text,"immediateAction" text,"reporterName" text,"reporterEmail" text) RETURNING id`,
          [JSON.stringify(records), user.id],
        )
      : { rows: [] };
    const ids = result.rows.map((r) => r.id);
    await client.query(
      "INSERT INTO record_batches(id,payload_hash,record_ids,requested_by,duplicate_count) VALUES($1,$2,$3,$4,$5)",
      [requestId, hash, ids, user.id, duplicateCount],
    );
    await client.query(
      "INSERT INTO audit_log(actor_id,action,details) VALUES($1,$2,$3)",
      [
        user.id,
        isImport ? "reports.imported" : "report.created",
        JSON.stringify({ ids, duplicateCount }),
      ],
    );
    return { ids, duplicateCount };
  });
}
export async function updateStatus(
  user: CurrentUser,
  id: string,
  status: Status,
  expected: string,
) {
  return transaction(database(), async (client) => {
    await activeActor(client, user, true);
    const {
      rows: [record],
    } = await client.query(
      `UPDATE incident_records SET status=$2,updated_at=now() WHERE id=$1 AND updated_at=$3::timestamptz RETURNING ${fields}`,
      [id, status, expected],
    );
    if (!record)
      throw new HttpError(
        "The report changed or is unavailable. Refresh before trying again.",
        409,
      );
    await client.query(
      "INSERT INTO audit_log(actor_id,action,target_id,details) VALUES($1,'report.status_changed',$2,$3)",
      [user.id, id, JSON.stringify({ status })],
    );
    return record;
  });
}
export async function updateAccount(
  actor: CurrentUser,
  id: string,
  role: string,
  active: boolean,
) {
  if (actor.id === id)
    throw new HttpError(
      "You cannot change your own role or disable your own account.",
    );
  if (!["user", "admin"].includes(role))
    throw new HttpError("Choose an allowed role.");
  await transaction(database(), async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(5563, 3)");
    await activeActor(client, actor, true);
    const {
      rows: [target],
    } = await client.query(
      'SELECT role,banned FROM "user" WHERE id=$1 FOR UPDATE',
      [id],
    );
    if (!target) throw new HttpError("Account not found.", 404);
    if (target.role === "admin" && (role !== "admin" || !active)) {
      const count = await client.query(
        "SELECT count(*)::int AS n FROM \"user\" WHERE role='admin' AND COALESCE(banned,false)=false",
      );
      if (count.rows[0].n <= 1)
        throw new HttpError(
          "At least one active administrator must remain.",
          409,
        );
    }
    await client.query(
      'UPDATE "user" SET role=$2,banned=$3,"banReason"=$4,"banExpires"=NULL,"updatedAt"=now() WHERE id=$1',
      [
        id,
        role,
        !active,
        active ? null : "Account disabled by an administrator.",
      ],
    );
    await client.query('DELETE FROM "session" WHERE "userId"=$1', [id]);
    await client.query(
      "INSERT INTO audit_log(actor_id,action,target_id,details) VALUES($1,'account.access_changed',$2,$3)",
      [actor.id, id, JSON.stringify({ role, active })],
    );
  });
}
