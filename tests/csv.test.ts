import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toCsv } from "../src/lib/csv";
import { checkIncidentCsv } from "../src/lib/incident-import";
import { FORM_FIELDS } from "../src/lib/options";

const today = new Date().toISOString().slice(0, 10);
const values = [
  today,
  "09:00",
  "Loading dock",
  "",
  "Day",
  "Near miss",
  "None",
  "",
  "Forklift",
  'Synthetic example, with a "quoted" detail\nand a second line.',
  "Area cleared.",
  "Demo Tester",
  "demo@example.test",
];

test("quoted commas, newlines, escaped quotes and BOM survive import", () => {
  const csv = "\uFEFF" + toCsv([...FORM_FIELDS], [values]);
  const checked = checkIncidentCsv("quoted.csv", csv);
  assert.equal(checked.error, undefined);
  assert.equal(checked.good.length, 1);
  assert.equal(checked.good[0].description, values[9]);
});

test("malformed quoting is rejected instead of silently changing field values", () => {
  for (const csv of [
    'name,value\n"unfinished,abc',
    'name,value\n"closed"junk,abc',
    'name,value\nabc"def,ghi',
  ]) {
    assert.throws(() => parseCsv(csv), /quote/i);
  }
});

test("duplicate headers and extra cells cannot silently overwrite or discard data", () => {
  const duplicate = checkIncidentCsv(
    "duplicate.csv",
    toCsv([...FORM_FIELDS, "description"], [[...values, "Other description"]]),
  );
  assert.match(duplicate.error!, /Repeated column names/);
  const extra = checkIncidentCsv(
    "extra.csv",
    toCsv([...FORM_FIELDS], [[...values, "unexpected"]]),
  );
  assert.equal(extra.good.length, 0);
  assert.equal(extra.bad[0].row, 2);
  assert.match(extra.bad[0].reasons[0], /columns/);
});

test("blank records do not shift rejected spreadsheet row numbers", () => {
  const bad = [...values];
  bad[12] = "invalid-email";
  const csv =
    toCsv([...FORM_FIELDS], [values]) +
    "\r\n" +
    toCsv([], [bad]).replace(/^\r\n/, "");
  const checked = checkIncidentCsv("rows.csv", csv);
  assert.equal(checked.good.length, 1);
  assert.equal(checked.bad[0].row, 4);
});

test("an expanded import larger than the server limit is caught before submission", () => {
  const large = [...values];
  large[9] = "x".repeat(2000);
  const checked = checkIncidentCsv(
    "large.csv",
    toCsv(
      [...FORM_FIELDS],
      Array.from({ length: 1700 }, () => large),
    ),
  );
  assert.match(checked.error!, /too large for one import/);
});
