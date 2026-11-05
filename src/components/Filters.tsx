"use client";
import { EVENT_TYPES, LOCATIONS, SHIFTS, STATUSES } from "@/lib/options";
import {
  EMPTY_FILTERS,
  filterError,
  type FilterState,
} from "@/lib/record-view";
export { EMPTY_FILTERS, applyFilters } from "@/lib/record-view";
export type { FilterState } from "@/lib/record-view";

export default function Filters({
  value,
  onChange,
}: {
  value: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const set =
    (key: keyof FilterState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...value, [key]: event.target.value });
  const select = (
    key: keyof FilterState,
    label: string,
    options: readonly string[],
  ) => (
    <label className="text-xs font-semibold text-slate-700">
      {label}
      <select className="control mt-2" value={value[key]} onChange={set(key)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
  const error = filterError(value);
  const active = Object.values(value).filter(Boolean).length;
  return (
    <section
      aria-label="Filter records"
      className="no-print rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Filter records{" "}
          {active > 0 && (
            <span className="ml-1 text-xs font-normal text-slate-500">
              ({active} active)
            </span>
          )}
        </h2>
        <button
          className="min-h-11 rounded px-2 text-sm font-semibold text-teal-800 underline disabled:text-slate-400"
          disabled={!active}
          type="button"
          onClick={() => onChange({ ...EMPTY_FILTERS })}
        >
          Clear filters
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
          Search ID or report text
          <input
            type="search"
            className="control mt-2"
            value={value.search}
            onChange={set("search")}
            placeholder="For example: R-0001 or loading dock"
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          From
          <input
            type="date"
            className="control mt-2"
            value={value.from}
            onChange={set("from")}
            aria-invalid={!!error}
            aria-describedby={error ? "filter-error" : undefined}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          To
          <input
            type="date"
            className="control mt-2"
            value={value.to}
            onChange={set("to")}
            aria-invalid={!!error}
            aria-describedby={error ? "filter-error" : undefined}
          />
        </label>
        {select("location", "Location", LOCATIONS)}
        {select("eventType", "Event type", EVENT_TYPES)}
        {select("status", "Status", STATUSES)}
        {select("shift", "Shift", SHIFTS)}
      </div>
      {error && (
        <p
          role="alert"
          id="filter-error"
          className="mt-3 text-sm font-medium text-red-800"
        >
          {error}
        </p>
      )}
    </section>
  );
}
