import type { IncidentRecord } from "./options";

type NewIncident = Omit<IncidentRecord, "id" | "createdAt" | "status">;
type ReportStorage = Pick<Storage, "getItem" | "setItem">;
const KEY = "fsa.records.v1";

export function newRecordId(existing: IncidentRecord[]): string {
  const max = existing.reduce((n, r) => {
    const match = /^R-(\d+)$/.exec(r.id);
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  return `R-${String(max + 1).padStart(4, "0")}`;
}

export function appendLocalRecords(storage: ReportStorage, items: NewIncident[], createdAt = new Date().toISOString().slice(0, 10)) {
  let previous: unknown;
  try { previous = JSON.parse(storage.getItem(KEY) ?? "[]"); }
  catch { throw new Error("Could not read saved reports in this browser. Your report has not been saved. Keep your entries and check browser storage access."); }
  if (!Array.isArray(previous) || previous.some(r => !r || typeof r.id !== "string")) {
    throw new Error("The existing browser records could not be read safely. Your report has not been saved. Keep your entries and ask the team for help.");
  }
  const records = [...previous] as IncidentRecord[];
  const ids: string[] = [];
  for (const item of items) {
    const id = newRecordId(records);
    ids.push(id);
    records.unshift({ ...item, id, createdAt, status: "Open" });
  }
  try { storage.setItem(KEY, JSON.stringify(records)); }
  catch { throw new Error("This browser could not save the report. Your entries are still here. Check available storage or try another browser, then save again."); }
  return { records, ids };
}
