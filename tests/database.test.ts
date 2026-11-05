import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createServer } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import type { Pool } from "pg";
import { createPool } from "../src/lib/db/pool";
import { addRecords, BatchConflict, changeStatus, readData, saveQuestion } from "../src/lib/db/repository";
import { migrate, seed } from "../scripts/database";
import { failure, readJson, RequestError } from "../src/lib/api";
import type { NewIncident } from "../src/lib/data-types";

let server: EmbeddedPostgres;
let pool: Pool;
let other: Pool;
const today = new Date().toISOString().slice(0, 10);
const record: NewIncident = {
  eventDate: today, eventTime: "10:00", location: "Loading dock", buildingName: "", shift: "Day",
  eventType: "Near miss", severity: "None", daysAway: null, equipment: "Forklift",
  description: "Synthetic database check: a blocked aisle was cleared.", immediateAction: "Supervisor notified.",
  reporterName: "Demo Tester", reporterEmail: "demo@example.test",
};

before(async () => {
  const socket = createServer();
  await new Promise<void>(resolve => socket.listen(0, "127.0.0.1", resolve));
  const address = socket.address();
  if (!address || typeof address === "string") throw new Error("No local port");
  const port = address.port;
  await new Promise<void>(resolve => socket.close(() => resolve()));
  server = new EmbeddedPostgres({ databaseDir: path.resolve(`.test-db/test-${randomUUID()}`),
    user: "postgres", password: "test-only", port, persistent: true,
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"], onLog: () => {}, onError: () => {} });
  await server.initialise();
  await server.start();
  pool = createPool(`postgresql://postgres:test-only@127.0.0.1:${port}/postgres`);
  other = createPool(`postgresql://postgres:test-only@127.0.0.1:${port}/postgres`);
  await migrate(pool);
  await seed(pool);
}, { timeout: 60_000 });

after(async () => { await pool?.end(); await other?.end(); await server?.stop(); });

test("seed and migration reruns preserve shared records, statuses and stable demo dates", async () => {
  const original = await readData(pool);
  assert.equal(original.records.length, 150);
  assert.equal(original.questions.length, 80);
  await changeStatus(pool, "S-0001", "Open");
  await migrate(other);
  assert.equal(await seed(other, new Date("2030-01-01")), false);
  const current = await readData(other);
  assert.equal(current.records.length, 150);
  assert.equal(current.records.find(r => r.id === "S-0001")?.status, "Open");
  assert.equal(current.records.find(r => r.id === "S-0001")?.eventDate, original.records.find(r => r.id === "S-0001")?.eventDate);
});

test("concurrent writers receive distinct IDs and a separate connection sees committed data", async () => {
  const batches = await Promise.all(Array.from({ length: 12 }, (_, i) => addRecords(i % 2 ? other : pool, [record], randomUUID())));
  const ids = batches.flat().map(r => r.id);
  assert.equal(new Set(ids).size, 12);
  const shared = await readData(other);
  assert.ok(ids.every(id => shared.records.some(r => r.id === id)));
  await changeStatus(pool, ids[0], "Closed");
  assert.equal((await readData(other)).records.find(r => r.id === ids[0])?.status, "Closed");
});

test("concurrent retries are idempotent and cannot reuse an ID for different input", async () => {
  const id = randomUUID();
  const results = await Promise.all([addRecords(pool, [record, record], id), addRecords(other, [record, record], id)]);
  assert.deepEqual(results[0].map(r => r.id).sort(), results[1].map(r => r.id).sort());
  await assert.rejects(() => addRecords(pool, [{ ...record, description: "A different synthetic incident for the same request." }], id), BatchConflict);
});

test("a failed batch rolls back every record and its retry marker", async () => {
  const before = (await readData(pool)).records.length;
  const id = randomUUID();
  await assert.rejects(() => addRecords(pool, [record, { ...record, severity: "Hospitalization" }], id));
  assert.equal((await readData(other)).records.length, before);
  assert.equal((await addRecords(pool, [record], id)).length, 1);
});

test("question metrics are persisted and SQL metacharacters remain data", async () => {
  const question = "Synthetic check '; DROP TABLE question_log; --";
  await saveQuestion(pool, question, false);
  const shared = await readData(other);
  assert.ok(shared.questions.some(q => q.question === question && !q.answered));
  assert.match(shared.questions.at(-1)!.askedAt, /Z$/);
});

test("request boundary rejects cross-site, non-JSON and oversized input", async () => {
  assert.deepEqual(await readJson(new Request("http://localhost:3100/api/records", {
    method: "POST", headers: { "content-type": "application/json", host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" }, body: "{}",
  })), {});
  for (const [headers, body, status] of [
    [{ "content-type": "application/json", origin: "https://elsewhere.example" }, "{}", 403],
    [{ "content-type": "text/plain" }, "{}", 415],
    [{ "content-type": "application/json" }, "{broken", 400],
    [{ "content-type": "application/json" }, JSON.stringify("x".repeat(3_500_001)), 413],
  ] as const) {
    await assert.rejects(() => readJson(new Request("http://localhost/api/records", { method: "POST", headers, body })),
      (e: unknown) => e instanceof RequestError && e.status === status);
  }
});

test("outages distinguish load failures from uncertain saves without exposing driver details", async () => {
  const internal = new Error("private-driver-detail");
  const load = failure(internal, "read");
  const save = failure(internal, "write");
  assert.equal(load.status, 503);
  assert.equal(save.status, 503);
  const loadMessage = (await load.json()).error;
  const saveMessage = (await save.json()).error;
  assert.match(loadMessage, /loaded/);
  assert.doesNotMatch(loadMessage, /changes/);
  assert.match(saveMessage, /not been confirmed/);
  assert.doesNotMatch(loadMessage + saveMessage, /private-driver-detail/);
});
