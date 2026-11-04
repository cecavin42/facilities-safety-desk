"use client";

import { useState } from "react";

import { DataTable, HorizontalBars, StackedColumns } from "@/components/Charts";

import Filters, { EMPTY_FILTERS, applyFilters } from "@/components/Filters";

import PageHeader from "@/components/PageHeader";

import DataStatus from "@/components/DataStatus";

import { downloadText, toCsv } from "@/lib/csv";

import { recordsToCsv } from "@/lib/export";

import {
  EQUIPMENT,
  EVENT_TYPES,
  LOCATIONS,
  SEVERITIES,
  type IncidentRecord,
} from "@/lib/options";

import { assistantWindow, monthSeries } from "@/lib/analytics";

import { filterError } from "@/lib/record-view";

import { useAppData } from "@/lib/store";

function countBy(
  rows: IncidentRecord[],
  field: keyof IncidentRecord,
  values: readonly string[],
) {
  return values
    .map((label) => ({
      label,
      value: rows.filter((r) => r[field] === label).length,
    }))
    .sort((a, b) => b.value - a.value);
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="print-section min-w-0 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">
        {description}
      </p>
      {children}
    </section>
  );
}

export default function ReportsPage() {
  const { ready, error, refresh, records, questions } = useAppData();

  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });

  if (!ready)
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Safety insights"
          title="Safety insights"
          description="Explore incident trends and assistant coverage. Every chart has exact values you can inspect or export."
        />
        <DataStatus error={error} retry={refresh} />
        {!error && <p role="status">Loading insights…</p>}
      </div>
    );

  const rows = applyFilters(records, filters);

  const timeline = monthSeries(rows, filters.from, filters.to);

  const byMonth = timeline.months.map((m) => ({
    label: m.label,
    values: EVENT_TYPES.map(
      (type) =>
        rows.filter(
          (r) => r.eventDate.startsWith(m.key) && r.eventType === type,
        ).length,
    ),
  }));

  const byLocation = countBy(rows, "location", LOCATIONS);
  const byEquipment = countBy(rows, "equipment", EQUIPMENT);

  const assistant = assistantWindow(questions);
  const answeredPct = assistant.selected.length
    ? Math.round((100 * assistant.answered) / assistant.selected.length)
    : null;

  const range = rows.length
    ? `${filters.from || rows.at(-1)?.eventDate} to ${filters.to || rows[0]?.eventDate}`
    : "No matching records";

  function exportSummary() {
    const lines: (string | number)[][] = [
      ["Record date range", range],
      ["Record filters", JSON.stringify(filters)],
      ["Total records", rows.length],
      [
        "Open or under review",
        rows.filter((r) => r.status !== "Closed").length,
      ],
      ...EVENT_TYPES.map((type) => [
        `Event type: ${type}`,
        rows.filter((r) => r.eventType === type).length,
      ]),
      ...byLocation.map((r) => [`Location: ${r.label}`, r.value]),
      ...byEquipment.map((r) => [`Equipment: ${r.label}`, r.value]),
      ...countBy(rows, "severity", SEVERITIES).map((r) => [
        `Severity: ${r.label}`,
        r.value,
      ]),
      [
        "Assistant period (independent of record filters)",
        `${assistant.from} to ${assistant.to}`,
      ],
      ["Assistant questions", assistant.selected.length],
      [
        "Assistant responses marked answered (%) - not accuracy",
        answeredPct ?? "N/A",
      ],
      ...assistant.declined.map(([q, n]) => [`Unanswered or partial: ${q}`, n]),
    ];

    downloadText(
      `safety-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(["Measure", "Value"], lines),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Safety insights"
        title="Safety insights"
        description="Explore incident trends and assistant coverage. Every chart has exact values you can inspect or export."
      >
        <button
          className="btn-secondary"
          disabled={!ready || !!filterError(filters)}
          onClick={exportSummary}
        >
          Export summary
        </button>
        <button
          className="btn-secondary"
          disabled={!ready}
          onClick={() => window.print()}
        >
          Print report
        </button>
      </PageHeader>
      <p className="print-only">
        Facilities Safety Desk · Team A classroom demo · all incident data is
        fictional.
      </p>
      <DataStatus error={error} retry={refresh} />
      <Filters value={filters} onChange={setFilters} />

      {ready && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Incident period: <strong>{range}</strong>
            </p>
            <button
              disabled={!rows.length}
              className="no-print min-h-11 text-sm font-semibold text-teal-800 underline"
              onClick={() =>
                downloadText("filtered-incidents.csv", recordsToCsv(rows))
              }
            >
              Export {rows.length} matching records
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [rows.length, "Matching records"],
              [rows.filter((r) => r.eventType === "Injury").length, "Injuries"],
              [
                rows.filter((r) => r.eventType === "Near miss").length,
                "Near misses",
              ],
              [
                rows.filter((r) => r.status !== "Closed").length,
                "Open or under review",
              ],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <p className="text-3xl font-bold tabular-nums text-teal-950">
                  {value}
                </p>
                <p className="mt-2 text-xs text-slate-600">{label}</p>
              </div>
            ))}
          </div>

          <Card
            title="Incidents over time"
            description="Matching records by month and event type. Months with no records remain visible."
          >
            {!rows.length ? (
              <p className="py-6 text-sm text-slate-500">
                No incidents match these filters. Clear or adjust them to see
                the trend.
              </p>
            ) : timeline.warning ? (
              <p role="status" className="text-sm text-amber-900">
                {timeline.warning}
              </p>
            ) : (
              <>
                <StackedColumns data={byMonth} names={[...EVENT_TYPES]} />
                <DataTable
                  head={["Month", ...EVENT_TYPES, "Total"]}
                  rows={byMonth.map((m) => [
                    m.label,
                    ...m.values,
                    m.values.reduce((a, b) => a + b, 0),
                  ])}
                />
              </>
            )}
          </Card>

          <Card
            title="Where incidents happen"
            description="Counts show where to investigate; they do not measure risk without exposure or staffing data."
          >
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-4 font-semibold">Location</h3>
                <HorizontalBars data={byLocation} />
              </div>
              <div>
                <h3 className="mb-4 font-semibold">Equipment involved</h3>
                <HorizontalBars data={byEquipment} />
              </div>
            </div>
            <DataTable
              head={["Category", "Count"]}
              rows={[
                ...byLocation.map((r) => [r.label, r.value]),
                ...byEquipment.map((r) => [r.label, r.value]),
              ]}
            />
          </Card>

          <Card
            title="Assistant coverage"
            description={`The last 12 calendar weeks (${assistant.from} to ${assistant.to}, UTC). Independent of incident filters; empty weeks are included.`}
          >
            <div className="mb-5 rounded-xl bg-teal-50 p-4">
              <p className="text-3xl font-bold text-teal-950">
                {answeredPct === null ? "—" : `${answeredPct}%`}
              </p>
              <p className="mt-2 text-sm text-teal-950">
                {assistant.answered} of {assistant.selected.length} questions
                marked answered.
              </p>
              <p className="mt-1 text-xs leading-6 text-teal-900">
                This measures response availability, not correctness. Partial
                and unsupported responses are counted together below.
              </p>
            </div>
            <StackedColumns
              data={assistant.weeks}
              names={["Answered", "Partial / unsupported"]}
              height={150}
              unit="questions"
            />
            <DataTable
              head={["Week beginning", "Answered", "Partial / unsupported"]}
              rows={assistant.weeks.map((w) => [w.start, ...w.values])}
            />
            <h3 className="mb-3 mt-6 font-semibold">Questions to review</h3>
            {assistant.declined.length ? (
              <ol className="space-y-3">
                {assistant.declined.map(([q, n]) => (
                  <li
                    key={q}
                    className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm"
                  >
                    <span className="break-words leading-6">{q}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-bold">
                      {n}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">
                No partial or unsupported questions in this period.
              </p>
            )}
          </Card>
        </>
      )}

      {!ready && !error && <p role="status">Loading insights…</p>}
    </div>
  );
}
