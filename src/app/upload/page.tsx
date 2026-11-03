"use client";

import { useRef, useState } from "react";
import StorageStatus from "@/components/StorageStatus";
import { downloadText, parseCsv } from "@/lib/csv";
import { CSV_HEADER, COLUMN_HELP, templateCsv } from "@/lib/export";
import type { IncidentRecord, ReportInput } from "@/lib/options";
import { useAppData } from "@/lib/store";
import { validateReport } from "@/lib/validation";

type Good = Omit<IncidentRecord, "id" | "createdAt" | "status">;
type Checked = { fileName: string; good: Good[]; bad: { row: number; reasons: string[] }[]; error?: string };

const MAX_ROWS = 5000;

function check(fileName: string, text: string): Checked {
  const rows = parseCsv(text);
  if (rows.length < 2) return { fileName, good: [], bad: [], error: "The file has no data rows." };
  const header = rows[0].map((h) => h.trim());
  const missing = CSV_HEADER.filter((c) => !header.includes(c));
  if (missing.length) return { fileName, good: [], bad: [], error: `The first row is missing these column names: ${missing.join(", ")}.` };
  if (rows.length - 1 > MAX_ROWS) return { fileName, good: [], bad: [], error: `The file has more than ${MAX_ROWS} rows.` };

  const good: Good[] = [];
  const bad: Checked["bad"] = [];
  rows.slice(1).forEach((cells, i) => {
    const input: ReportInput = {};
    CSV_HEADER.forEach((c) => (input[c] = cells[header.indexOf(c)] ?? ""));
    const result = validateReport(input);
    // Row 1 is the header, so the first data row is row 2, matching what a spreadsheet shows.
    if (result.ok) good.push(result.record);
    else bad.push({ row: i + 2, reasons: Object.values(result.errors) });
  });
  return { fileName, good, bad };
}

export default function UploadPage() {
  const { addRecords, ready, error, refresh, saving } = useAppData();
  const requestId = useRef<string | null>(null);
  const importing = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [imported, setImported] = useState<number | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    requestId.current = null;
    setSaveError(null);
    setImported(null);
    if (!file) return setChecked(null);
    if (file.size > 5_000_000) return setChecked({ fileName: file.name, good: [], bad: [], error: "The file is larger than 5 MB." });
    setChecked(check(file.name, await file.text()));
    e.target.value = "";
  }

  async function importChecked() {
    if (!checked || importing.current) return;
    importing.current = true;
    requestId.current ??= crypto.randomUUID();
    setSaveError(null);
    try { setImported((await addRecords(checked.good, requestId.current)).length); }
    catch (err) { setSaveError(err instanceof Error ? err.message : "Could not import. Retry with this file."); }
    finally { importing.current = false; }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload past incidents (CSV)</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Each row is checked with the same rules as the report form. Good rows can be imported; rows with problems are
          listed with the reason and are not imported. Row numbers match your spreadsheet (row 1 is the column names).
        </p>
      </div>

      <StorageStatus error={error} retry={() => void refresh()} />
      {saveError && <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">{saveError}</p>}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Choose CSV file
            <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={saving} className="sr-only" />
          </label>
          <button onClick={() => downloadText("incident-template.csv", templateCsv())} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Download a template
          </button>
        </div>
        <p className="text-xs text-slate-500">Columns needed in the first row: {COLUMN_HELP}. Dates as YYYY-MM-DD.</p>
      </div>

      {checked?.error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {checked.fileName}: {checked.error}
        </div>
      )}

      {checked && !checked.error && (
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
            <p>
              <strong>{checked.fileName}</strong>: {checked.good.length} row{checked.good.length === 1 ? "" : "s"} ready to import,{" "}
              {checked.bad.length} rejected.
            </p>
            {imported === null ? (
              <button
                disabled={!ready || saving || checked.good.length === 0}
                onClick={() => void importChecked()}
                className="mt-3 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40"
              >
                {saving ? "Importing..." : `Import ${checked.good.length} good row${checked.good.length === 1 ? "" : "s"}`}
              </button>
            ) : (
              <p role="status" className="mt-3 text-green-800">Imported {imported} records. They now appear in Records and Reports.</p>
            )}
          </div>
          {checked.bad.length > 0 && (
            <div className="rounded-md border border-red-200 bg-white">
              <h2 className="border-b border-red-100 px-4 py-2 text-sm font-semibold text-red-900">Rejected rows</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {checked.bad.map((b) => (
                  <li key={b.row} className="px-4 py-2">
                    <span className="font-medium">Row {b.row}:</span> {b.reasons.join(" ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
