"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Status } from "./options";
import type { AppData, NewIncident } from "./data-types";
import { api } from "./client-api";
export type { QuestionLogEntry } from "./data-types";
export function useAppData() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AppData>({ records: [], questions: [] });
  const generation = useRef(0);
  const pendingImport = useRef<{ payload: string; id: string } | null>(null);
  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    try {
      const next = await api<AppData>("/api/data");
      if (ticket === generation.current) {
        setData(next);
        setReady(true);
        setError(null);
      }
    } catch (e) {
      if (ticket === generation.current) {
        setData({ records: [], questions: [] });
        setReady(false);
        setError(e instanceof Error ? e.message : "Could not load records.");
      }
    }
  }, []);
  useEffect(() => {
    const stateGuard = generation;
    void Promise.resolve().then(refresh);
    const focus = () => {
      void refresh();
    };
    const logout = (e: StorageEvent) => {
      if (e.key === "fsa.session-event") {
        setData({ records: [], questions: [] });
        window.location.replace("/sign-in");
      }
    };
    const interval = setInterval(focus, 15000);
    window.addEventListener("focus", focus);
    window.addEventListener("storage", logout);
    return () => {
      stateGuard.current++;
      clearInterval(interval);
      window.removeEventListener("focus", focus);
      window.removeEventListener("storage", logout);
    };
  }, [refresh]);
  const addRecords = useCallback(
    async (items: NewIncident[], requestId = crypto.randomUUID()) => {
      const result = await api<{ ids: string[] }>("/api/records", {
        method: "POST",
        body: JSON.stringify({ records: items, requestId }),
      });
      await refresh();
      return result.ids;
    },
    [refresh],
  );
  const setStatus = useCallback(
    async (id: string, status: Status) => {
      const record = data.records.find((r) => r.id === id);
      await api(`/api/records/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, expectedUpdatedAt: record?.updatedAt }),
      });
      await refresh();
    },
    [data.records, refresh],
  );
  const importRecords = useCallback(
    async (items: NewIncident[], allowDuplicates = false) => {
      const payload = JSON.stringify({ records: items, allowDuplicates });
      if (pendingImport.current?.payload !== payload)
        pendingImport.current = { payload, id: crypto.randomUUID() };
      const result = await api<{ ids: string[]; duplicateCount: number }>(
        "/api/import",
        {
          method: "POST",
          body: JSON.stringify({
            records: items,
            allowDuplicates,
            requestId: pendingImport.current.id,
          }),
        },
      );
      pendingImport.current = null;
      await refresh();
      return result;
    },
    [refresh],
  );
  return {
    ready,
    error,
    records: data.records,
    questions: data.questions,
    refresh,
    addRecords,
    setStatus,
    importRecords,
  };
}
