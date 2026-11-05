import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DATA_KEYS,
  loadBrowserData,
  saveStatus,
  rawBackup,
} from "../src/lib/browser-data";
import {
  EMPTY_FILTERS,
  applyFilters,
  sortRecords,
} from "../src/lib/record-view";
import { assistantWindow, monthSeries } from "../src/lib/analytics";
import { checkIncidentCsv, planImport } from "../src/lib/incident-import";
import { recordsToCsv } from "../src/lib/export";
import { parseCsv, toCsv } from "../src/lib/csv";
import { seedRecords } from "../src/lib/seed";
function store() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
const now = new Date("2026-11-03T12:00:00Z");
test("sample dates stay stable across later visits", () => {
  const s = store();
  const first = loadBrowserData(s, now);
  const later = loadBrowserData(s, new Date("2026-11-20T12:00:00Z"));
  assert.deepEqual(later, first);
});
test("failed status writes never replace the stored status", () => {
  const s = store();
  const data = loadBrowserData(s, now);
  const id = data.records[0].id;
  saveStatus(s, id, "Under review");
  assert.throws(
    () =>
      saveStatus(
        {
          ...s,
          setItem: () => {
            throw new Error("quota");
          },
        },
        id,
        "Closed",
      ),
    /could not save/,
  );
  assert.equal(
    loadBrowserData(s, now).records.find((r) => r.id === id)!.status,
    "Under review",
  );
});
test("bad records and status maps are preserved, not silently replaced by samples", () => {
  for (const [key, raw] of [
    [DATA_KEYS.records, '[{"id":"R-1"}]'],
    [DATA_KEYS.statuses, '{"S-0001":"Made up"}'],
    [DATA_KEYS.questions, '{"wrong":"shape"}'],
  ]) {
    const s = store();
    s.data.set(key, raw);
    assert.throws(() => loadBrowserData(s, now), /preserved/);
    assert.equal(s.data.get(key), raw);
    assert.ok(rawBackup(s).includes("facilities-safety-browser-backup-v1"));
  }
});
test("status updates are visible when another reader reloads", () => {
  const s = store();
  const first = loadBrowserData(s, now);
  const id = first.records[0].id;
  saveStatus(s, id, "Closed");
  assert.equal(
    loadBrowserData(s, now).records.find((r) => r.id === id)!.status,
    "Closed",
  );
});
test("combined search, status and date filtering applies to the same result set", () => {
  const records = seedRecords(now);
  const r = records[0];
  const matches = applyFilters(records, {
    ...EMPTY_FILTERS,
    search: r.id.toLowerCase(),
    status: r.status,
    from: r.eventDate,
    to: r.eventDate,
  });
  assert.deepEqual(
    matches.map((x) => x.id),
    [r.id],
  );
  assert.equal(
    applyFilters(records, {
      ...EMPTY_FILTERS,
      from: "2026-12-01",
      to: "2026-01-01",
    }).length,
    0,
  );
});
test("numeric record IDs sort consistently and inputs remain unchanged", () => {
  const r = seedRecords(now)[0];
  const rows = [
    { ...r, id: "R-9" },
    { ...r, id: "R-10" },
  ];
  assert.deepEqual(
    sortRecords(rows, "newest").map((r) => r.id),
    ["R-10", "R-9"],
  );
  assert.equal(rows[0].id, "R-9");
});
test("monthly bins include zero months and distinguish calendar years", () => {
  const r = seedRecords(now)[0];
  const result = monthSeries([
    { ...r, eventDate: "2025-12-20" },
    { ...r, eventDate: "2026-02-01" },
  ]);
  assert.deepEqual(
    result.months.map((m) => m.key),
    ["2025-12", "2026-01", "2026-02"],
  );
  assert.notEqual(result.months[0].label, result.months[1].label);
});
test("assistant period is exactly twelve calendar weeks including empty weeks", () => {
  const result = assistantWindow(
    [
      { question: "old", answered: true, askedAt: "2025-01-01" },
      { question: "recent", answered: false, askedAt: "2026-11-02" },
      { question: "future", answered: true, askedAt: "2026-12-01" },
    ],
    now,
  );
  assert.equal(result.weeks.length, 12);
  assert.equal(result.selected.length, 1);
  assert.equal(result.answered, 0);
  assert.equal(result.weeks.at(-1)!.values[1], 1);
  assert.equal(result.weeks[0].values[0], 0);
});
test("import duplicate detection checks existing records and repeats in the file", () => {
  const [a, b] = seedRecords(now);
  const result = planImport([a, b, b], [a]);
  assert.equal(result.duplicateCount, 2);
  assert.deepEqual(result.records, [b]);
});
test("export metadata is disclosed while unknown columns are rejected", () => {
  const r = seedRecords(new Date())[0];
  const csv = recordsToCsv([r]);
  const checked = checkIncidentCsv("export.csv", csv);
  assert.equal(checked.good.length, 1);
  assert.deepEqual(checked.ignoredColumns, ["id", "status", "createdAt"]);
  const rows = parseCsv(csv);
  rows[0].push("misspelledField");
  rows[1].push("important");
  assert.match(
    checkIncidentCsv("bad.csv", toCsv(rows[0], rows.slice(1))).error!,
    /Unrecognized columns/,
  );
});
test("CSV formula protection includes leading whitespace and tabs", () => {
  const rows = parseCsv(
    toCsv(["Value"], [[" =1+1"], ["\t@SUM(A1)"], ["plain text"]]),
  );
  assert.equal(rows[1][0], "' =1+1");
  assert.equal(rows[2][0], "'\t@SUM(A1)");
  assert.equal(rows[3][0], "plain text");
});
