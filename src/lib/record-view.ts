import { SEVERITIES, type IncidentRecord } from "./options";
export type FilterState = {
  from: string;
  to: string;
  location: string;
  shift: string;
  eventType: string;
  status: string;
  search: string;
};
export const EMPTY_FILTERS: FilterState = {
  from: "",
  to: "",
  location: "",
  shift: "",
  eventType: "",
  status: "",
  search: "",
};
export function filterError(f: FilterState) {
  return f.from && f.to && f.from > f.to
    ? "The start date must be on or before the end date."
    : null;
}
export function applyFilters(records: IncidentRecord[], f: FilterState) {
  if (filterError(f)) return [];
  const terms = f.search
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return records.filter(
    (r) =>
      (!f.from || r.eventDate >= f.from) &&
      (!f.to || r.eventDate <= f.to) &&
      (!f.location || r.location === f.location) &&
      (!f.shift || r.shift === f.shift) &&
      (!f.eventType || r.eventType === f.eventType) &&
      (!f.status || r.status === f.status) &&
      terms.every((term) =>
        [
          r.id,
          r.description,
          r.location,
          r.buildingName,
          r.eventType,
          r.equipment,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(term),
      ),
  );
}
export type SortOrder = "newest" | "oldest" | "severity";
export function sortRecords(records: IncidentRecord[], order: SortOrder) {
  return [...records].sort((a, b) => {
    if (order === "severity") {
      const diff =
        SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity);
      if (diff) return diff;
    }
    const diff =
      a.eventDate.localeCompare(b.eventDate) ||
      a.id.localeCompare(b.id, undefined, { numeric: true });
    return order === "oldest" ? diff : -diff;
  });
}
