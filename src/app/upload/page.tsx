"use client";

import { useRef, useState } from "react";
import StorageStatus from "@/components/StorageStatus";
import { downloadText } from "@/lib/csv";
import { COLUMN_HELP, templateCsv } from "@/lib/export";
import { useAppData } from "@/lib/store";
import { checkIncidentCsv, type CheckedImport } from "@/lib/incident-import";
import { MAX_CSV_BYTES } from "@/lib/import-limits";

export default function UploadPage() {
  const { addRecords, ready, error, refresh, saving } = useAppData();
  const requestId = useRef<string | null>(null);
  const importing = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checked, setChecked] = useState<CheckedImport | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const selection = useRef(0);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (importing.current) return;
    const file = e.target.files?.[0];
    e.target.value = "";
    const selected = ++selection.current;
    requestId.current = null;
    setSaveError(null);
    setImported(null);
    setChecked(null);
    setReading(null);
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) return setChecked({ fileName: file.name, good: [], bad: [], error: "The file is larger than 5 MB." });
    setReading(file.name);
    try {
      const text = await file.text();
      if (selected === selection.current) setChecked(checkIncidentCsv(file.name, text));
    } catch {
      if (selected === selection.current) setChecked({ fileName: file.name, good: [], bad: [], error: "Could not read this file. Choose it again or export a fresh CSV." });
    } finally {
      if (selected === selection.current) setReading(null);
    }
  }

  async function importChecked() {
    if (!checked || checked.error || !checked.good.length || reading || !ready || importing.current) return;
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
          <label className="cursor-pointer rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-within:ring-2 focus-within:ring-teal-600 focus-within:ring-offset-2">
            Choose CSV file
            <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={saving} className="sr-only" />
          </label>
          <button onClick={() => downloadText("incident-template.csv", templateCsv())} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Download a template
          </button>
        </div>
        <p className="text-xs text-slate-500">Columns needed in the first row: {COLUMN_HELP}. Dates as YYYY-MM-DD.</p>
      </div>

      {reading && <p role="status" className="text-sm text-slate-600">Reading {reading}...</p>}
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
              <p role="status" className="mt-3 text-green-800">Imported {imported} {imported === 1 ? "record" : "records"}. {imported === 1 ? "It now appears" : "They now appear"} in Records and Reports.</p>
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
