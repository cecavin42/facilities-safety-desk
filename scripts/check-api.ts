import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { toCsv } from "../src/lib/csv";
import { FORM_FIELDS } from "../src/lib/options";

async function main() {
  const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
  if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Use a local test app only");
  const get = async () => (await fetch(`${base}/api/data`)).json();
  const post = (path: string, body: unknown, extra: Record<string, string> = {}) => fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json", origin: base, ...extra }, body: JSON.stringify(body),
  });
  const record = { eventDate: new Date().toISOString().slice(0, 10), eventTime: "11:00", location: "Loading dock",
    buildingName: "", shift: "Day", eventType: "Near miss", severity: "None", daysAway: null, equipment: "Forklift",
    description: "SYNTHETIC API CHECK: all records are fictional classroom examples.", immediateAction: "Area cleared.",
    reporterName: "Demo Tester", reporterEmail: "demo@example.test" };
  const before = await get();
  const requestId = randomUUID();
  const saved = await post("/api/records", { requestId, records: [record], id: "FORGED", status: "Closed" });
  assert.equal(saved.status, 201);
  const result = await saved.json();
  assert.match(result.records[0].id, /^R-\d+$/);
  assert.equal(result.records[0].status, "Open");
  const replay = await post("/api/records", { requestId, records: [record] });
  assert.equal(replay.status, 201);
  assert.equal((await replay.json()).records[0].id, result.records[0].id);
  const bad = await post("/api/records", { requestId: randomUUID(), records: [record, { ...record, description: "bad" }] });
  assert.equal(bad.status, 400);
  const wrongType = await post("/api/records", { requestId: randomUUID(), records: [{ ...record, eventDate: {} }] });
  assert.equal(wrongType.status, 400);
  const cross = await post("/api/records", { requestId: randomUUID(), records: [record] }, { origin: "https://other.example" });
  assert.equal(cross.status, 403);
  const invalidStatus = await fetch(`${base}/api/records/${result.records[0].id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "invented" }) });
  assert.equal(invalidStatus.status, 400);
  const missing = await fetch(`${base}/api/records/R-999999999`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "Closed" }) });
  assert.equal(missing.status, 404);
  const answer = await post("/api/ask", { question: "How often does a forklift have to be inspected?" });
  assert.equal(answer.status, 200);
  assert.equal((await answer.json()).answered, true);
  const after = await get();
  assert.equal(after.records.length, before.records.length + 1);
  assert.equal(after.questions.length, before.questions.length + 1);
  await mkdir("test-results", { recursive: true });
  const good = { ...record, description: "SYNTHETIC CSV CHECK: imported classroom incident with no real personal data." };
  const invalid = { ...good, reporterEmail: "not-an-email" };
  await writeFile("test-results/shared-import.csv", toCsv([...FORM_FIELDS], [good, invalid].map(r => FORM_FIELDS.map(f => r[f] ?? ""))));
  console.log("HTTP checks passed: shared save, retry deduplication, server validation, atomic rejection, CSRF, status validation, question logging.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
