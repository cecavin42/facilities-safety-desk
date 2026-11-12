import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Client, localSetup } from "./readiness-client";
import { snapshot } from "./backup-lib";
async function main() {
  const { pool, accounts, admin } = await localSetup();
  try {
    const employee = new Client();
    const a = accounts.find((a) => a.role === "user")!;
    await employee.login(a.email, a.password);
    const record = {
      eventDate: new Date().toISOString().slice(0, 10),
      eventTime: "10:00",
      location: "Office",
      buildingName: "",
      shift: "Day",
      eventType: "Unsafe condition",
      severity: "None",
      daysAway: null,
      equipment: "None",
      description: `SYNTHETIC CONCURRENCY ${randomUUID()}`,
      immediateAction: "Area marked.",
      reporterName: "Concurrency fixture",
      reporterEmail: a.email,
    };
    const id = randomUUID();
    const same = await Promise.all(
      Array.from({ length: 10 }, () =>
        employee.request("/api/records", "POST", {
          records: [record],
          requestId: id,
        }),
      ),
    );
    assert.ok(same.every((r) => r.status === 201));
    assert.equal(new Set(same.map((r) => r.data.ids[0])).size, 1);
    const reportId = same[0].data.ids[0];
    const version = (await admin.request(`/api/records/${reportId}`)).data
      .updatedAt;
    const updates = await Promise.all(
      ["Closed", "Under review"].map((status) =>
        admin.request(`/api/records/${reportId}`, "PATCH", {
          status,
          expectedUpdatedAt: version,
        }),
      ),
    );
    assert.deepEqual(updates.map((r) => r.status).sort(), [200, 409]);
    const writing = Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        employee.request("/api/records", "POST", {
          records: [{ ...record, description: record.description + " " + i }],
          requestId: randomUUID(),
        }),
      ),
    );
    const snap = await snapshot(pool);
    const created = await writing;
    assert.ok(created.every((r) => r.status === 201));
    assert.equal(new Set(created.flatMap((r) => r.data.ids)).size, 10);
    const ids = new Set(
      (snap.tables.incident_records as { id: string }[]).map((r) => r.id),
    );
    for (const batch of snap.tables.record_batches as {
      record_ids: string[];
    }[])
      assert.ok(batch.record_ids.every((id) => ids.has(id)));
    const users = new Set(
      (snap.tables.user as { id: string }[]).map((u) => u.id),
    );
    for (const r of snap.tables.incident_records as {
      created_by: string | null;
    }[])
      if (r.created_by) assert.ok(users.has(r.created_by));
    const result = {
      concurrentSameRequestCount: 10,
      createdOnce: true,
      concurrentUniqueRequests: 10,
      uniqueIds: true,
      staleUpdateConflict: true,
      consistentSnapshotDuringWrites: true,
    };
    await writeFile(
      "test-results/concurrency-checks.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.query('DELETE FROM "rateLimit";DELETE FROM auth_attempts');
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Concurrency checks failed");
  process.exitCode = 1;
});
