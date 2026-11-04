"use client";

import { useCallback, useEffect, useState } from "react";
import type { IncidentRecord, Status } from "./options";
import { seedQuestions, seedRecords } from "./seed";
import { appendLocalRecords } from "./local-records";
export { newRecordId } from "./local-records";

export type QuestionLogEntry = { question: string; answered: boolean; askedAt: string };

// Draft storage: new data lives only in this browser until a database is added.
const KEYS = {
  records: "fsa.records.v1",
  statuses: "fsa.statuses.v1",
  questions: "fsa.questions.v1",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function useAppData() {
  const [ready, setReady] = useState(false);
  const [seed, setSeed] = useState<IncidentRecord[]>([]);
  const [added, setAdded] = useState<IncidentRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [questions, setQuestions] = useState<QuestionLogEntry[]>([]);

  useEffect(() => {
    // Loaded after mount because localStorage only exists in the browser.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSeed(seedRecords());
    setAdded(read(KEYS.records, []));
    setStatuses(read(KEYS.statuses, {}));
    setQuestions([...seedQuestions(), ...read<QuestionLogEntry[]>(KEYS.questions, [])]);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const records = [...added, ...seed]
    .map((r) => (statuses[r.id] ? { ...r, status: statuses[r.id] } : r))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.id.localeCompare(a.id));

  const addRecords = useCallback((items: Omit<IncidentRecord, "id" | "createdAt" | "status">[]) => {
    const { records, ids } = appendLocalRecords(localStorage, items);
    setAdded(records);
    return ids;
  }, []);

  const setStatus = useCallback((id: string, status: Status) => {
    const next = { ...read<Record<string, Status>>(KEYS.statuses, {}), [id]: status };
    write(KEYS.statuses, next);
    setStatuses(next);
  }, []);

  const logQuestion = useCallback((question: string, answered: boolean) => {
    const entry = { question, answered, askedAt: new Date().toISOString() };
    const next = [...read<QuestionLogEntry[]>(KEYS.questions, []), entry];
    write(KEYS.questions, next);
    setQuestions((q) => [...q, entry]);
  }, []);

  const resetDemo = useCallback(() => {
    Object.values(KEYS).forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
    setAdded([]);
    setStatuses({});
    setQuestions(seedQuestions());
  }, []);

  return { ready, records, questions, addRecords, setStatus, logQuestion, resetDemo };
}
