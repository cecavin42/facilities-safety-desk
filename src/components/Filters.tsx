"use client";
import { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
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
  const [advanced, setAdvanced] = useState(
    Boolean(
      value.from ||
        value.to ||
        value.location ||
        value.shift ||
        value.eventType,
    ),
  );
  const set =
    (key: keyof FilterState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...value, [key]: event.target.value });
  const error = filterError(value);
  const active = Object.values(value).filter(Boolean).length;
  const select = (
    key: keyof FilterState,
    label: string,
    options: readonly string[],
  ) => (
    <label className="advanced-filter-label">
      {label}
      <select className="control" value={value[key]} onChange={set(key)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
  return (
    <section aria-label="Filter records" className="filter-panel no-print">
      <div className="filter-toolbar">
        <label className="filter-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search ID or report text</span>
          <input
            type="search"
            value={value.search}
            onChange={set("search")}
            placeholder="Search ID, description, or location…"
          />
        </label>
        <label className="filter-status">
          <span className="sr-only">Status</span>
          <select
            className="control"
            value={value.status}
            onChange={set("status")}
          >
            <option value="">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`btn-secondary filter-toggle ${advanced ? "filter-toggle-open" : ""}`}
          aria-expanded={advanced}
          aria-controls="advanced-filters"
          onClick={() => setAdvanced((v) => !v)}
        >
          <SlidersHorizontal size={14} />
          Filters{active > 0 && <span className="filter-count">{active}</span>}
          <ChevronDown size={12} />
        </button>
        {active > 0 && (
          <button
            className="filter-clear"
            type="button"
            onClick={() => {
              onChange({ ...EMPTY_FILTERS });
              setAdvanced(false);
            }}
          >
            <RotateCcw size={12} />
            Clear filters
          </button>
        )}
      </div>
      {advanced && (
        <div className="advanced-filters" id="advanced-filters">
          <label className="advanced-filter-label">
            From
            <input
              type="date"
              className="control"
              value={value.from}
              onChange={set("from")}
              aria-invalid={!!error}
              aria-describedby={error ? "filter-error" : undefined}
            />
          </label>
          <label className="advanced-filter-label">
            To
            <input
              type="date"
              className="control"
              value={value.to}
              onChange={set("to")}
              aria-invalid={!!error}
              aria-describedby={error ? "filter-error" : undefined}
            />
          </label>
          {select("location", "Location", LOCATIONS)}
          {select("eventType", "Event type", EVENT_TYPES)}
          {select("shift", "Shift", SHIFTS)}
        </div>
      )}
      {error && (
        <p role="alert" id="filter-error" className="filter-error">
          {error}
        </p>
      )}
    </section>
  );
}
