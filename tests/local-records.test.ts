import { test } from "node:test";
import assert from "node:assert/strict";
import { appendLocalRecords } from "../src/lib/local-records";
import type { IncidentRecord } from "../src/lib/options";

const report = { eventDate: "2026-11-03", eventTime: "10:00", location: "Loading dock", buildingName: "", shift: "Day",
  eventType: "Near miss", severity: "None", daysAway: null, equipment: "Forklift", description: "Synthetic report for the local save regression.",
  immediateAction: "Area cleared.", reporterName: "Demo Reporter", reporterEmail: "demo@example.test" } satisfies Omit<IncidentRecord,"id"|"createdAt"|"status">;

test("a successful save persists unique IDs before returning confirmation", () => {
  let raw: string | null = null;
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  const first = appendLocalRecords(storage, [report, report], "2026-11-03");
  const second = appendLocalRecords(storage, [report], "2026-11-03");
  assert.deepEqual(first.ids, ["R-0001", "R-0002"]);
  assert.deepEqual(second.ids, ["R-0003"]);
  const stored = JSON.parse(raw!);
  assert.equal(stored.length, 3);
  assert.equal(stored[0].status, "Open");
  assert.equal(stored[0].createdAt, "2026-11-03");
});

test("storage refusal throws instead of returning a false success", () => {
  assert.throws(() => appendLocalRecords({ getItem: () => null, setItem: () => { throw new Error("quota"); } }, [report]), /could not save/);
});

test("unreadable existing records are preserved rather than overwritten", () => {
  for (const raw of ["not-json", "{}", '[{"other":"data"}]']) {
    let written = false;
    assert.throws(() => appendLocalRecords({ getItem: () => raw, setItem: () => { written = true; } }, [report]), /could not be read|Could not read/);
    assert.equal(written, false);
  }
});
