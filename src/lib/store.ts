"use client";

import { useCallback, useEffect, useState } from "react";
import type { IncidentRecord, Status } from "./options";
import type { QuestionLogEntry } from "./data-types";
import { appendLocalRecords } from "./local-records";
import {
  DATA_KEYS,
  loadBrowserData,
  readQuestions,
  saveStatus,
  writeValue,
} from "./browser-data";
import { planImport } from "./incident-import";
export { newRecordId } from "./local-records";
export type { QuestionLogEntry } from "./data-types";
const CHANGED = "fsa-data-changed";

async function mutate<T>(work: () => T): Promise<T> {
  const commit = () => {
    const value = work();
    window.dispatchEvent(new Event(CHANGED));
    return value;
  };
  return navigator.locks
    ? navigator.locks.request("fsa-browser-write", commit)
    : commit();
}

export function useAppData() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [questions, setQuestions] = useState<QuestionLogEntry[]>([]);
  const refresh = useCallback(() => {
    try {
      const data = loadBrowserData(localStorage);
      setRecords(data.records);
      setQuestions(data.questions);
      setError(null);
      setReady(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Browser data could not be loaded.",
      );
      setReady(false);
    }
  }, []);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    refresh();
    /* eslint-enable react-hooks/set-state-in-effect */
    const storage = (event: StorageEvent) => {
      if (!event.key || Object.values(DATA_KEYS).includes(event.key)) refresh();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", refresh);
    window.addEventListener(CHANGED, refresh);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(CHANGED, refresh);
    };
  }, [refresh]);
  const addRecords = useCallback(
    (items: Omit<IncidentRecord, "id" | "createdAt" | "status">[]) =>
      mutate(() => {
        loadBrowserData(localStorage);
        return appendLocalRecords(localStorage, items).ids;
      }),
    [],
  );
  const setStatus = useCallback(
    (id: string, status: Status) =>
      mutate(() => saveStatus(localStorage, id, status)),
    [],
  );
  const importRecords = useCallback(
    (
      items: Omit<IncidentRecord, "id" | "createdAt" | "status">[],
      allowDuplicates = false,
    ) =>
      mutate(() => {
        const current = loadBrowserData(localStorage);
        const plan = allowDuplicates
          ? { records: items, duplicateCount: 0 }
          : planImport(items, current.records);
        return {
          ids: plan.records.length
            ? appendLocalRecords(localStorage, plan.records).ids
            : [],
          duplicateCount: plan.duplicateCount,
        };
      }),
    [],
  );
  const logQuestion = useCallback(
    (question: string, answered: boolean) =>
      mutate(() => {
        const rows = readQuestions(localStorage);
        writeValue(localStorage, DATA_KEYS.questions, [
          ...rows,
          { question, answered, askedAt: new Date().toISOString() },
        ]);
      }),
    [],
  );
  return {
    ready,
    error,
    records,
    questions,
    addRecords,
    importRecords,
    setStatus,
    logQuestion,
    refresh,
  };
}
