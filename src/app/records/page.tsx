"use client";
import { useState } from "react";
import Link from "next/link";
import Filters, { EMPTY_FILTERS, applyFilters } from "@/components/Filters";
import PageHeader from "@/components/PageHeader";
import DataStatus from "@/components/DataStatus";
import { downloadText } from "@/lib/csv";
import { recordsToCsv } from "@/lib/export";
import { STATUSES, type IncidentRecord, type Status } from "@/lib/options";
import { sortRecords, filterError, type SortOrder } from "@/lib/record-view";
import { useAppData } from "@/lib/store";
const PAGE = 12;

function RecordCard({
  record,
  changeStatus,
  busy,
}: {
  record: IncidentRecord;
  changeStatus: (id: string, status: Status) => void;
  busy: boolean;
}) {
  const r = record;
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-mono text-sm font-bold text-teal-900">
              {r.id}
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {r.id.startsWith("S-") ? "Sample" : "Added report"}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold">
            {r.eventType}{" "}
            <span className="font-normal text-slate-500">· {r.eventDate}</span>
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${r.status === "Closed" ? "bg-slate-100 text-slate-600" : r.status === "Open" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900"}`}
        >
          {r.status}
        </span>
      </div>
      <p className="mt-4 break-words text-sm leading-7 text-slate-800">
        {r.description}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs leading-5">
        <div>
          <dt className="text-slate-500">Location</dt>
          <dd className="break-words font-medium">
            {r.location}
            {r.buildingName && ` · ${r.buildingName}`}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Severity</dt>
          <dd className="break-words font-medium">
            {r.severity}
            {r.daysAway !== null ? ` · ${r.daysAway} days away` : ""}
          </dd>
        </div>
      </dl>
      <details className="mt-4 border-t border-slate-100 pt-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-teal-800">
          Report details{" "}
          <span aria-hidden="true" className="ml-2">
            +
          </span>
        </summary>
        <dl className="grid gap-3 py-3 text-sm sm:grid-cols-2">
          {[
            ["Time", r.eventTime || "Not provided"],
            ["Shift", r.shift],
            ["Equipment", r.equipment],
            ["Immediate action", r.immediateAction || "Not provided"],
            ["Reporter", r.reporterName],
            ["Reporter email", r.reporterEmail],
            ["Created", r.createdAt.slice(0, 10)],
          ].map(([name, value]) => (
            <div key={name} className="min-w-0">
              <dt className="text-xs text-slate-500">{name}</dt>
              <dd className="mt-1 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </details>
      <label className="mt-3 block text-xs font-semibold text-slate-600">
        Status of {r.id}
        <select
          className="control mt-2"
          value={r.status}
          disabled={busy}
          onChange={(e) => changeStatus(r.id, e.target.value as Status)}
        >
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
    </article>
  );
}

export default function RecordsPage() {
  const { ready, error, refresh, records, setStatus } = useAppData();
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [shown, setShown] = useState(PAGE);
  const [order, setOrder] = useState<SortOrder>("newest");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const rows = sortRecords(applyFilters(records, filters), order);
  async function changeStatus(id: string, status: Status) {
    setBusy(id);
    setMessage("");
    setSaveError("");
    try {
      await setStatus(id, status);
      setMessage(`${id} saved as ${status}.`);
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Status could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Incident register"
        title="Find a report. Follow it through."
        description="Search incidents and near misses, review the full report, and keep its status current."
      >
        <Link href="/report" className="btn-primary">
          New report
        </Link>
        <button
          className="btn-secondary"
          disabled={!ready || !rows.length || !!filterError(filters)}
          onClick={() =>
            downloadText(
              `incidents-${new Date().toISOString().slice(0, 10)}.csv`,
              recordsToCsv(rows),
            )
          }
        >
          Export {rows.length} {rows.length === 1 ? "record" : "records"}
        </button>
      </PageHeader>
      <DataStatus error={error} retry={refresh} />
      <Filters
        value={filters}
        onChange={(f) => {
          setFilters(f);
          setShown(PAGE);
        }}
      />
      {saveError && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {saveError}
        </p>
      )}
      <p role="status" className="text-sm font-medium text-teal-900">
        {message}
      </p>
      {ready && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              <strong className="text-slate-900">{rows.length}</strong> of{" "}
              {records.length} records ·{" "}
              {rows.filter((r) => r.status !== "Closed").length} open or under
              review
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Sort by
              <select
                className="control !w-auto"
                value={order}
                onChange={(e) => {
                  setOrder(e.target.value as SortOrder);
                  setShown(PAGE);
                }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="severity">Highest severity</option>
              </select>
            </label>
          </div>
          {rows.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {rows.slice(0, shown).map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  changeStatus={changeStatus}
                  busy={!!busy}
                />
              ))}
            </div>
          ) : (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <h2 className="text-xl font-semibold">No matching reports</h2>
              <p className="mt-2 text-sm text-slate-600">
                Try fewer filters or a different search term. Your saved reports
                have not changed.
              </p>
              <button
                className="btn-secondary mt-5"
                onClick={() => setFilters({ ...EMPTY_FILTERS })}
              >
                Clear filters
              </button>
            </section>
          )}
          {shown < rows.length && (
            <div className="text-center">
              <button
                className="btn-secondary"
                onClick={() => setShown((s) => s + PAGE)}
              >
                Show {Math.min(PAGE, rows.length - shown)} more{" "}
                {rows.length - shown === 1 ? "report" : "reports"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Showing {Math.min(shown, rows.length)} of {rows.length}
              </p>
            </div>
          )}
        </>
      )}
      {!ready && !error && (
        <p role="status" className="py-12 text-center text-slate-500">
          Loading saved reports…
        </p>
      )}
    </div>
  );
}
