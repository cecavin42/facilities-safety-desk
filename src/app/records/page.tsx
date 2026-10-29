"use client";

import { useState } from "react";
import Filters, { EMPTY_FILTERS, applyFilters } from "@/components/Filters";
import { downloadText } from "@/lib/csv";
import { recordsToCsv } from "@/lib/export";
import { STATUSES, type Status } from "@/lib/options";
import { useAppData } from "@/lib/store";

const PAGE = 25;

export default function RecordsPage() {
  const { ready, records, setStatus, resetDemo } = useAppData();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [shown, setShown] = useState(PAGE);
  const rows = applyFilters(records, filters);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Records</h1>
          <p className="text-sm text-slate-600">
            {ready ? `${rows.length} of ${records.length} records match.` : "Loading..."} IDs starting with S are fake seed
            records; R are ones added in this browser.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadText(`incidents-${new Date().toISOString().slice(0, 10)}.csv`, recordsToCsv(rows))}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Export {rows.length} as CSV
          </button>
          <button
            onClick={() => confirm("Remove the reports, status changes and questions added in this browser?") && resetDemo()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Reset demo data
          </button>
        </div>
      </div>

      <Filters value={filters} onChange={(f) => { setFilters(f); setShown(PAGE); }} />

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Equipment</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, shown).map((r) => (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.id}</td>
                <td className="whitespace-nowrap px-3 py-2">{r.eventDate}</td>
                <td className="px-3 py-2">{r.eventType}</td>
                <td className="px-3 py-2">{r.severity}{r.daysAway ? ` (${r.daysAway} days)` : ""}</td>
                <td className="px-3 py-2">{r.location}{r.buildingName ? `: ${r.buildingName}` : ""}</td>
                <td className="px-3 py-2">{r.equipment}</td>
                <td className="max-w-xs px-3 py-2 text-slate-600">{r.description}</td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Status of ${r.id}`}
                    value={r.status}
                    onChange={(e) => setStatus(r.id, e.target.value as Status)}
                    className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown < rows.length && (
        <button onClick={() => setShown(shown + PAGE)} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
          Show more ({rows.length - shown} left)
        </button>
      )}
    </div>
  );
}
