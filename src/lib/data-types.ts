import type { IncidentRecord } from "./options";

export type NewIncident = Omit<IncidentRecord, "id" | "createdAt" | "status">;
export type QuestionLogEntry = { question: string; answered: boolean; askedAt: string };
export type AppData = { records: IncidentRecord[]; questions: QuestionLogEntry[] };
