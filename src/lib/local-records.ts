import type { IncidentRecord } from "./options";
import { readAdded } from "./browser-data";

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

export function appendLocalRecords(
  storage: ReportStorage,
  items: NewIncident[],
  createdAt = new Date().toISOString().slice(0, 10),
) {
  const previous = readAdded(storage);
  const records = [...previous];
  const ids: string[] = [];
  const firstNumber = Number(newRecordId(records).slice(2));
  const additions = items.map((item, index) => {
    const id = `R-${String(firstNumber + index).padStart(4, "0")}`;
    ids.push(id);
    return { ...item, id, createdAt, status: "Open" as const };
  });
  records.unshift(...additions.reverse());
  try {
    storage.setItem(KEY, JSON.stringify(records));
  } catch {
    throw new Error(
      "This browser could not save the report. Your entries are still here. Check available storage or try another browser, then save again.",
    );
  }
  return { records, ids };
}
