import {
  EQUIPMENT,
  EVENT_TYPES,
  LOCATIONS,
  SEVERITIES,
  SHIFTS,
  STATUSES,
  type IncidentRecord,
  type Status,
} from "./options";
import type { QuestionLogEntry } from "./data-types";
import { seedQuestions, seedRecords } from "./seed";

export const DATA_KEYS = {
  records: "fsa.records.v1",
  statuses: "fsa.statuses.v1",
  questions: "fsa.questions.v1",
  seedDate: "fsa.seed-date.v1",
};
type Store = Pick<Storage, "getItem" | "setItem">;
const invalid = () =>
  new Error(
    "Saved browser data could not be read safely. It has been preserved. Download a backup before asking the team for help.",
  );
export function readValue<T>(
  storage: Store,
  key: string,
  fallback: T,
  validate: (value: unknown) => boolean,
): T {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    if (!validate(value)) throw invalid();
    return value as T;
  } catch {
    throw invalid();
  }
}
function member(value: unknown, list: readonly string[]) {
  return typeof value === "string" && list.includes(value);
}
function date(value: unknown) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
export function isRecord(value: unknown): value is IncidentRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    [
      "id",
      "eventTime",
      "buildingName",
      "description",
      "immediateAction",
      "reporterName",
      "reporterEmail",
    ].every((k) => typeof r[k] === "string") &&
    date(r.eventDate) &&
    date(String(r.createdAt).slice(0, 10)) &&
    member(r.status, STATUSES) &&
    member(r.location, LOCATIONS) &&
    member(r.shift, SHIFTS) &&
    member(r.eventType, EVENT_TYPES) &&
    member(r.severity, SEVERITIES) &&
    member(r.equipment, EQUIPMENT) &&
    (r.daysAway === null ||
      (Number.isInteger(r.daysAway) && Number(r.daysAway) >= 0))
  );
}
export function readAdded(storage: Store): IncidentRecord[] {
  return readValue(
    storage,
    DATA_KEYS.records,
    [],
    (v) =>
      Array.isArray(v) &&
      v.every(isRecord) &&
      new Set(v.map((r) => r.id)).size === v.length,
  );
}
export function readStatuses(storage: Store): Record<string, Status> {
  return readValue(
    storage,
    DATA_KEYS.statuses,
    {},
    (v) =>
      !!v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      Object.values(v).every((s) => member(s, STATUSES)),
  );
}
export function readQuestions(storage: Store): QuestionLogEntry[] {
  return readValue(
    storage,
    DATA_KEYS.questions,
    [],
    (v) =>
      Array.isArray(v) &&
      v.every(
        (q) =>
          q &&
          typeof q.question === "string" &&
          typeof q.answered === "boolean" &&
          typeof q.askedAt === "string" &&
          Number.isFinite(Date.parse(q.askedAt)),
      ),
  );
}
export function writeValue(storage: Store, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error(
      "This browser could not save the change. Nothing has been confirmed. Keep your entries and check browser storage access.",
    );
  }
}
export function loadBrowserData(storage: Store, now = new Date()) {
  const added = readAdded(storage);
  const statuses = readStatuses(storage);
  const questions = readQuestions(storage);
  let seedDate = readValue<string | null>(
    storage,
    DATA_KEYS.seedDate,
    null,
    date,
  );
  if (!seedDate) {
    seedDate = now.toISOString().slice(0, 10);
    writeValue(storage, DATA_KEYS.seedDate, seedDate);
  }
  const anchor = new Date(seedDate + "T12:00:00Z");
  return {
    records: [...added, ...seedRecords(anchor)]
      .map((r) => ({ ...r, status: statuses[r.id] ?? r.status }))
      .sort(
        (a, b) =>
          b.eventDate.localeCompare(a.eventDate) ||
          b.id.localeCompare(a.id, undefined, { numeric: true }),
      ),
    questions: [...seedQuestions(anchor), ...questions],
  };
}
export function saveStatus(storage: Store, id: string, status: Status) {
  if (!STATUSES.includes(status)) throw new Error("Choose a valid status.");
  const data = loadBrowserData(storage);
  if (!data.records.some((r) => r.id === id))
    throw new Error("This record is no longer available. Reload the records.");
  writeValue(storage, DATA_KEYS.statuses, {
    ...readStatuses(storage),
    [id]: status,
  });
}
export function rawBackup(storage: Pick<Storage, "getItem">) {
  const values = Object.fromEntries(
    Object.entries(DATA_KEYS).map(([name, key]) => [
      name,
      storage.getItem(key),
    ]),
  );
  return JSON.stringify(
    {
      format: "facilities-safety-browser-backup-v1",
      exportedAt: new Date().toISOString(),
      values,
    },
    null,
    2,
  );
}
