"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, MapPin, FileText, Download, Plus } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { useCurrentUser } from "@/components/SessionUser";
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
  record: r,
  changeStatus,
  busy,
}: {
  record: IncidentRecord;
  changeStatus: (id: string, status: Status) => void;
  busy: boolean;
}) {
  const canManage = useCurrentUser().role === "admin";
  const [expanded, setExpanded] = useState(false);
  return (
    <article className={`register-row ${expanded ? "register-row-open" : ""}`}>
      <div className="register-row-summary">
        <div className="register-identity">
          <span className="register-file">
            <FileText size={17} />
          </span>
          <span>
            <h3>{r.id}</h3>
            <small>{r.eventType}</small>
          </span>
        </div>
        <p className="register-description">{r.description}</p>
        <span className="register-location">
          <MapPin size={13} />
          {r.location}
        </span>
        <time className="register-date">{r.eventDate}</time>
        <StatusBadge status={r.status} />
        <button
          className="icon-button row-toggle"
          aria-label={`${expanded ? "Hide" : "View"} details for ${r.id}`}
          aria-expanded={expanded}
          aria-controls={`details-${r.id}`}
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown size={17} />
        </button>
      </div>
      {expanded && (
        <div className="register-details" id={`details-${r.id}`}>
          <p className="register-full-description">{r.description}</p>
          <dl>
            {[
              [
                "Location",
                r.location + (r.buildingName ? ` · ${r.buildingName}` : ""),
              ],
              [
                "Severity",
                r.severity +
                  (r.daysAway !== null ? ` · ${r.daysAway} days away` : ""),
              ],
              ["Time", r.eventTime || "Not provided"],
              ["Shift", r.shift],
              ["Equipment", r.equipment],
              ["Immediate action", r.immediateAction || "Not provided"],
              ["Reporter", r.reporterName],
              ["Email", r.reporterEmail],
              ["Created", r.createdAt.slice(0, 10)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {canManage && (
            <label className="register-status-label">
              Status of {r.id}
              <select
                className="control"
                value={r.status}
                disabled={busy}
                onChange={(e) => changeStatus(r.id, e.target.value as Status)}
              >
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </article>
  );
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<p role="status">Loading register…</p>}>
      <RecordsQuery />
    </Suspense>
  );
}
function RecordsQuery() {
  const query = useSearchParams();
  const q = query.get("q") || "";
  const status = query.get("status") || "";
  return (
    <RecordsContent
      key={query.toString()}
      initialFilters={{
        ...EMPTY_FILTERS,
        search: q.slice(0, 120),
        status: STATUSES.includes(status as Status) ? status : "",
      }}
    />
  );
}
function RecordsContent({
  initialFilters,
}: {
  initialFilters: typeof EMPTY_FILTERS;
}) {
  const user = useCurrentUser();
  const { ready, error, refresh, records, setStatus } = useAppData();
  const [filters, setFilters] = useState(initialFilters);
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
        title="Incident register"
        description={
          user.role === "admin"
            ? "Search incidents and near misses, review the full report, and keep its status current."
            : "Search and review your submitted reports. Safety managers update their status."
        }
      >
        <Link href="/report" className="btn-primary">
          <Plus size={15} /> New report
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
          <Download size={14} />{" "}
          {`Export ${rows.length} ${rows.length === 1 ? "record" : "records"}`}
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
            <div className="register-list">
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
              <h2 className="text-xl font-semibold">
                {records.length ? "No matching reports" : "No reports yet"}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {records.length
                  ? "Try fewer filters or a different search term. Your saved reports have not changed."
                  : "Create your first report to start your register. You will see only reports that your account can access."}
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
