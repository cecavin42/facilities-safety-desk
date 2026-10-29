"use client";

import { EVENT_TYPES, LOCATIONS, SHIFTS, type IncidentRecord } from "@/lib/options";

export type FilterState = { from: string; to: string; location: string; shift: string; eventType: string };

export const EMPTY_FILTERS: FilterState = { from: "", to: "", location: "", shift: "", eventType: "" };

export function applyFilters(records: IncidentRecord[], f: FilterState) {
  return records.filter(
    (r) =>
      (!f.from || r.eventDate >= f.from) &&
      (!f.to || r.eventDate <= f.to) &&
      (!f.location || r.location === f.location) &&
      (!f.shift || r.shift === f.shift) &&
      (!f.eventType || r.eventType === f.eventType),
  );
}

const box = "mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";

export default function Filters({ value, onChange }: { value: FilterState; onChange: (f: FilterState) => void }) {
  const set = (k: keyof FilterState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [k]: e.target.value });
  const sel = (k: keyof FilterState, label: string, opts: readonly string[]) => (
    <label className="text-xs font-medium text-slate-700">
      {label}
      <select className={box} value={value[k]} onChange={set(k)}>
        <option value="">All</option>
        {opts.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="no-print grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-6">
      <label className="text-xs font-medium text-slate-700">
        From
        <input type="date" className={box} value={value.from} onChange={set("from")} />
      </label>
      <label className="text-xs font-medium text-slate-700">
        To
        <input type="date" className={box} value={value.to} onChange={set("to")} />
      </label>
      {sel("location", "Location", LOCATIONS)}
      {sel("shift", "Shift", SHIFTS)}
      {sel("eventType", "Event type", EVENT_TYPES)}
      <div className="flex items-end">
        <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-50">
          Clear filters
        </button>
      </div>
    </div>
  );
}
