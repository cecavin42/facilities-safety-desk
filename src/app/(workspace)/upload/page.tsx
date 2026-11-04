"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import DataStatus from "@/components/DataStatus";
import { downloadText, toCsv } from "@/lib/csv";
import { COLUMN_HELP, templateCsv } from "@/lib/export";
import {
  checkIncidentCsv,
  planImport,
  type CheckedImport,
} from "@/lib/incident-import";
import { MAX_CSV_BYTES } from "@/lib/import-limits";
import { useAppData } from "@/lib/store";

export default function UploadPage() {
  const { ready, error, refresh, records, importRecords } = useAppData();
  const [checked, setChecked] = useState<CheckedImport | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [completed, setCompleted] = useState<{
    count: number;
    skipped: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const sequence = useRef(0);
  const plan = checked
    ? planImport(checked.good, records)
    : { records: [], duplicateCount: 0 };
  const count = allowDuplicates
    ? (checked?.good.length ?? 0)
    : plan.records.length;
  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const ticket = ++sequence.current;
    const file = event.target.files?.[0];
    event.target.value = "";
    setCompleted(null);
    setChecked(null);
    setMessage("");
    setAllowDuplicates(false);
    setLoading(false);
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      setChecked({
        fileName: file.name,
        good: [],
        bad: [],
        error: "The file is larger than 5 MB. Split it into smaller files.",
      });
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      if (ticket === sequence.current)
        setChecked(checkIncidentCsv(file.name, text));
    } catch {
      if (ticket === sequence.current)
        setMessage(
          "The file could not be read. Choose it again or save a fresh CSV copy.",
        );
    } finally {
      if (ticket === sequence.current) setLoading(false);
    }
  }
  async function importNow() {
    if (!checked || saving || loading || !count || !ready) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await importRecords(checked.good, allowDuplicates);
      setCompleted({
        count: result.ids.length,
        skipped: result.duplicateCount + checked.bad.length,
      });
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "The import was not saved. Keep this preview and retry.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Import records"
        title="Import incidents"
        description="Preview your spreadsheet, correct any problems, and bring valid incidents into the register. Nothing is saved until you confirm the import."
      />
      <DataStatus error={error} retry={refresh} />
      <ol className="grid gap-3 text-sm sm:grid-cols-3">
        {[
          "1. Choose a CSV",
          "2. Review rows and duplicates",
          "3. Confirm the import",
        ].map((step) => (
          <li
            key={step}
            className="rounded-xl border border-slate-200 bg-white p-4 font-semibold text-slate-700"
          >
            {step}
          </li>
        ))}
      </ol>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Start with the template</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Up to 5 MB and 5,000 rows per file. The template contains two
          fictional example rows; replace them with your own demo records.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <label
            className={`btn-primary cursor-pointer ${saving ? "pointer-events-none opacity-50" : ""}`}
          >
            Choose CSV file
            <input
              aria-label="Choose CSV file"
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              disabled={saving}
              className="sr-only"
            />
          </label>
          <button
            className="btn-secondary"
            onClick={() => downloadText("incident-template.csv", templateCsv())}
          >
            Download CSV template
          </button>
        </div>
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-teal-800">
            Column requirements
          </summary>
          <p className="break-words text-sm leading-7 text-slate-600">
            {COLUMN_HELP}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Use the same choices as the incident form. An exported file can be
            reimported, but imported rows receive new IDs, a new creation date,
            and Open status.
          </p>
        </details>
      </section>
      {loading && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900"
        >
          Reading and checking the file…
        </p>
      )}
      {message && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {message}
        </p>
      )}
      {completed ? (
        <section
          role="status"
          className="rounded-2xl border border-teal-200 bg-teal-50 p-6"
        >
          <h2 className="text-xl font-semibold text-teal-950">
            {completed.count} {completed.count === 1 ? "report" : "reports"}{" "}
            imported
          </h2>
          <p className="mt-2 text-sm text-teal-900">
            {completed.skipped} duplicate or invalid rows were skipped. The
            imported reports are saved to the shared server.
          </p>
          <Link href="/records" className="btn-primary mt-5">
            View records
          </Link>
        </section>
      ) : (
        checked && (
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                File preview
              </p>
              <h2 className="mt-2 break-all text-lg font-semibold">
                {checked.fileName}
              </h2>
            </div>
            {checked.error ? (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-4 text-sm text-red-900"
              >
                {checked.error}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    [checked.good.length, "Valid rows"],
                    [checked.bad.length, "Need correction"],
                    [plan.duplicateCount, "Exact duplicates"],
                  ].map(([n, label]) => (
                    <div key={label} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-2xl font-bold tabular-nums">{n}</p>
                      <p className="mt-1 text-xs text-slate-600">{label}</p>
                    </div>
                  ))}
                </div>
                {!!checked.ignoredColumns?.length && (
                  <p className="text-sm text-amber-900">
                    Existing metadata ({checked.ignoredColumns.join(", ")}) will
                    not be imported. New records start with Open status.
                  </p>
                )}
                {plan.duplicateCount > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm leading-6 text-amber-950">
                      Exact duplicates in this file or the existing register are
                      skipped by default.
                    </p>
                    <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={allowDuplicates}
                        onChange={(e) => setAllowDuplicates(e.target.checked)}
                        className="h-5 w-5 accent-teal-700"
                      />
                      Import duplicates as separate incidents
                    </label>
                  </div>
                )}
                {plan.records.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold">
                      Preview of new reports
                    </h3>
                    <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {plan.records.slice(0, 5).map((r, i) => (
                        <li key={i} className="p-3 text-sm">
                          <p className="font-medium">
                            {r.eventDate} · {r.eventType} · {r.location}
                          </p>
                          <p className="mt-1 break-words leading-6 text-slate-600">
                            {r.description}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-slate-500">
                      Showing {Math.min(5, plan.records.length)} of{" "}
                      {plan.records.length} new valid reports.
                    </p>
                  </div>
                )}
                {checked.bad.length > 0 && (
                  <div className="rounded-xl bg-red-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-red-950">
                        Rows to correct
                      </h3>
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          downloadText(
                            "import-row-errors.csv",
                            toCsv(
                              ["Row", "Problems"],
                              checked.bad.map((b) => [
                                b.row,
                                b.reasons.join(" "),
                              ]),
                            ),
                          )
                        }
                      >
                        Download row errors
                      </button>
                    </div>
                    <ul className="mt-3 space-y-3 text-sm leading-6 text-red-900">
                      {checked.bad.slice(0, 10).map((b) => (
                        <li key={b.row}>
                          <strong>Row {b.row}:</strong> {b.reasons.join(" ")}
                        </li>
                      ))}
                    </ul>
                    {checked.bad.length > 10 && (
                      <p className="mt-3 text-sm">
                        Download the error file for all {checked.bad.length}{" "}
                        rows.
                      </p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-5">
                  <button
                    disabled={!ready || !count || saving || loading}
                    onClick={importNow}
                    className="btn-primary"
                  >
                    {saving
                      ? "Saving reports…"
                      : `Import ${count} ${count === 1 ? "report" : "reports"}`}
                  </button>
                  <p className="text-xs leading-6 text-slate-500">
                    Only valid, selected rows will be saved.
                    <br />
                    Invalid rows stay out of the register.
                  </p>
                </div>
              </>
            )}
          </section>
        )
      )}
    </div>
  );
}
