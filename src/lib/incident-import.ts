import { parseCsv } from "./csv";
import { CSV_HEADER } from "./export";
import { MAX_IMPORT_ROWS, MAX_JSON_BYTES } from "./import-limits";
import type { NewIncident } from "./data-types";
import { FORM_FIELDS, type ReportInput, type IncidentRecord } from "./options";
import { validateReport } from "./validation";

export type CheckedImport = {
  fileName: string;
  good: NewIncident[];
  bad: { row: number; reasons: string[] }[];
  error?: string;
  ignoredColumns?: string[];
};

export function checkIncidentCsv(
  fileName: string,
  text: string,
): CheckedImport {
  const failure = (error: string): CheckedImport => ({
    fileName,
    good: [],
    bad: [],
    error,
  });
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Could not read this CSV.",
    );
  }
  const nonempty = (row: string[]) => row.some((cell) => cell.trim() !== "");
  const headerIndex = rows.findIndex(nonempty);
  if (headerIndex < 0) return failure("The file has no data rows.");
  const header = rows[headerIndex].map((h) => h.trim());
  const duplicates = [
    ...new Set(header.filter((h, i) => h && header.indexOf(h) !== i)),
  ];
  if (duplicates.length)
    return failure(
      `Repeated column names: ${duplicates.join(", ")}. Keep each column once.`,
    );
  const missing = CSV_HEADER.filter((c) => !header.includes(c));
  if (missing.length)
    return failure(
      `The header is missing these column names: ${missing.join(", ")}.`,
    );
  const ignoredColumns = header.filter(
    (c) => !CSV_HEADER.includes(c as (typeof CSV_HEADER)[number]),
  );
  const unknown = ignoredColumns.filter(
    (c) => !["id", "status", "createdAt", "updatedAt"].includes(c),
  );
  if (unknown.length)
    return failure(
      `Unrecognized columns: ${unknown.join(", ")}. Use the template column names so no data is silently discarded.`,
    );
  const dataRows = rows
    .slice(headerIndex + 1)
    .map((cells, i) => ({ cells, row: headerIndex + i + 2 }))
    .filter((r) => nonempty(r.cells));
  if (!dataRows.length) return failure("The file has no data rows.");
  if (dataRows.length > MAX_IMPORT_ROWS)
    return failure(`The file has more than ${MAX_IMPORT_ROWS} data rows.`);
  const good: NewIncident[] = [];
  const bad: CheckedImport["bad"] = [];
  for (const { cells, row } of dataRows) {
    if (cells.length !== header.length) {
      bad.push({
        row,
        reasons: [
          `Expected ${header.length} columns but found ${cells.length}. Check commas and quotation marks.`,
        ],
      });
      continue;
    }
    const input: ReportInput = {};
    CSV_HEADER.forEach((c) => {
      input[c] = cells[header.indexOf(c)];
    });
    const result = validateReport(input);
    if (result.ok) good.push(result.record);
    else bad.push({ row, reasons: Object.values(result.errors) });
  }
  // A UUID is always 36 characters. Check the exact JSON shape sent by the client.
  const bytes = new TextEncoder().encode(
    JSON.stringify({ records: good, requestId: "0".repeat(36) }),
  ).length;
  if (bytes > MAX_JSON_BYTES)
    return failure(
      "These records are too large for one import. Split the CSV into smaller files.",
    );
  return { fileName, good, bad, ignoredColumns };
}

function fingerprint(record: NewIncident) {
  return JSON.stringify(
    FORM_FIELDS.map((field) =>
      typeof record[field] === "string" ? record[field].trim() : record[field],
    ),
  );
}
export function planImport(
  incoming: NewIncident[],
  existing: IncidentRecord[],
) {
  const seen = new Set(existing.map(fingerprint));
  const records: NewIncident[] = [];
  let duplicateCount = 0;
  for (const record of incoming) {
    const key = fingerprint(record);
    if (seen.has(key)) duplicateCount++;
    else {
      seen.add(key);
      records.push(record);
    }
  }
  return { records, duplicateCount };
}
