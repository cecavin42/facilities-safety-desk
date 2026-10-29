"use client";

import { useState } from "react";
import { DataTable, HorizontalBars, StackedColumns } from "@/components/Charts";
import Filters, { EMPTY_FILTERS, applyFilters } from "@/components/Filters";
import { downloadText, toCsv } from "@/lib/csv";
import { recordsToCsv } from "@/lib/export";
import { EQUIPMENT, EVENT_TYPES, LOCATIONS, SEVERITIES, type IncidentRecord } from "@/lib/options";
import { useAppData, type QuestionLogEntry } from "@/lib/store";

function lastMonths(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(m.toISOString().slice(0, 7));
  }
  return out;
}

function monthLabel(ym: string) {
  return new Date(ym + "-01T00:00:00Z").toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

function weekStart(iso: string) {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}

function countBy<T extends string>(rows: IncidentRecord[], key: keyof IncidentRecord, values: readonly T[]) {
  return values.map((v) => ({ label: v, value: rows.filter((r) => r[key] === v).length })).sort((a, b) => b.value - a.value);
}

function topDeclined(questions: QuestionLogEntry[], n = 5) {
  const counts = new Map<string, number>();
  for (const q of questions) if (!q.answered) counts.set(q.question, (counts.get(q.question) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function Card({ title, viewer, children }: { title: string; viewer: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-slate-500">For: {viewer}</p>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { ready, records, questions } = useAppData();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  if (!ready) return <p className="text-sm text-slate-500">Loading...</p>;

  const rows = applyFilters(records, filters);
  const months = lastMonths(12);
  const byMonth = months.map((m) => ({
    label: monthLabel(m),
    values: EVENT_TYPES.map((t) => rows.filter((r) => r.eventDate.startsWith(m) && r.eventType === t).length),
  }));
  const byLocation = countBy(rows, "location", LOCATIONS);
  const byEquipment = countBy(rows, "equipment", EQUIPMENT);
  const bySeverity = SEVERITIES.map((s) => ({ label: s, value: rows.filter((r) => r.severity === s).length }));
  const open = rows.filter((r) => r.status !== "Closed").length;

  const weeks = [...new Set(questions.map((q) => weekStart(q.askedAt)))].sort().slice(-12);
  const byWeek = weeks.map((w) => ({
    label: w.slice(5),
    values: [
      questions.filter((q) => q.answered && weekStart(q.askedAt) === w).length,
      questions.filter((q) => !q.answered && weekStart(q.askedAt) === w).length,
    ],
  }));
  const answeredPct = questions.length ? Math.round((100 * questions.filter((q) => q.answered).length) / questions.length) : 0;
  const declined = topDeclined(questions);

  const range = `${filters.from || rows.at(-1)?.eventDate || "-"} to ${filters.to || rows[0]?.eventDate || "-"}`;

  function exportSummary() {
    const line = (label: string, value: string | number) => [label, value];
    const csv = toCsv(["Item", "Value"], [
      line("Date range", range),
      line("Filters", [filters.location, filters.shift, filters.eventType].filter(Boolean).join(", ") || "None"),
      line("Total records", rows.length),
      line("Open or under review", open),
      ...EVENT_TYPES.map((t) => line(`Event type: ${t}`, rows.filter((r) => r.eventType === t).length)),
      ...byLocation.map((l) => line(`Location: ${l.label}`, l.value)),
      ...bySeverity.map((s) => line(`Severity: ${s.label}`, s.value)),
      line("Assistant questions answered (%)", answeredPct),
      ...declined.map(([q, n], i) => line(`Top declined question ${i + 1}`, `${q} (${n})`)),
    ]);
    downloadText(`safety-summary-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-slate-600">
            {rows.length} records, {range}.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button onClick={() => downloadText(`incidents-${new Date().toISOString().slice(0, 10)}.csv`, recordsToCsv(rows))} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Export records CSV
          </button>
          <button onClick={exportSummary} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Export summary CSV
          </button>
          <button onClick={() => window.print()} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Print / save as PDF
          </button>
        </div>
      </div>

      <Filters value={filters} onChange={setFilters} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Records" value={rows.length} />
        <Stat label="Injuries" value={rows.filter((r) => r.eventType === "Injury").length} />
        <Stat label="Near misses" value={rows.filter((r) => r.eventType === "Near miss").length} />
        <Stat label="Open or under review" value={open} />
      </div>

      <Card title="1. Incidents over time (last 12 months, by event type)" viewer="safety manager, leadership, safety committee">
        <StackedColumns data={byMonth} names={[...EVENT_TYPES]} />
        <DataTable head={["Month", ...EVENT_TYPES, "Total"]} rows={byMonth.map((m) => [m.label, ...m.values, m.values.reduce((a, b) => a + b, 0)])} />
      </Card>

      <Card title="2. Where and with what" viewer="shift supervisors">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium">By location</h3>
            <HorizontalBars data={byLocation} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">By equipment</h3>
            <HorizontalBars data={byEquipment} />
          </div>
        </div>
        <DataTable head={["Category", "Count"]} rows={[...byLocation.map((l) => [`Location: ${l.label}`, l.value]), ...byEquipment.map((e) => [`Equipment: ${e.label}`, e.value])]} />
      </Card>

      <Card title="3. Assistant questions (last 12 weeks, answered vs. declined)" viewer="safety manager">
        <p className="mb-3 text-sm">
          <span className="text-2xl font-semibold tabular-nums">{answeredPct}%</span> of {questions.length} questions answered. Not
          affected by the record filters.
        </p>
        <StackedColumns data={byWeek} names={["Answered", "Declined"]} height={140} />
        <DataTable head={["Week of", "Answered", "Declined"]} rows={byWeek.map((w) => [w.label, ...w.values])} />
        <h3 className="mt-5 mb-2 text-sm font-medium">Top declined questions</h3>
        {declined.length ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            {declined.map(([q, n]) => (
              <li key={q}>
                {q} <span className="text-slate-500">({n})</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">None yet.</p>
        )}
      </Card>
    </div>
  );
}
