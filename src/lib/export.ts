import { toCsv } from "./csv";
import { FIELD_LABELS, FORM_FIELDS, type IncidentRecord } from "./options";

export const CSV_HEADER = [...FORM_FIELDS];

export function recordsToCsv(records: IncidentRecord[]): string {
  const header = ["id", "status", "createdAt", ...FORM_FIELDS];
  return toCsv(
    header,
    records.map((r) => [r.id, r.status, r.createdAt, ...FORM_FIELDS.map((f) => r[f] ?? "")]),
  );
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export function templateCsv(): string {
  return toCsv(CSV_HEADER, [
    [daysAgo(20), "08:30", "Loading dock", "", "Day", "Near miss", "None", "", "Forklift", "Forklift reversed toward a worker who stepped behind it.", "Spotter added.", "Pat Lee", "pat.lee@example.edu"],
    [daysAgo(75), "", "Inside a campus building", "Science Hall", "Evening", "Injury", "Days away from work", "3", "Ladder", "Worker fell from the second step of a ladder and sprained an ankle.", "", "Jo Kim", "jo.kim@example.edu"],
  ]);
}

export const COLUMN_HELP = FORM_FIELDS.map((f) => `${f} (${FIELD_LABELS[f]})`).join(", ");
