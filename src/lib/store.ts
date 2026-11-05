"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IncidentRecord, Status } from "./options";
import type { AppData, NewIncident } from "./data-types";
export type { QuestionLogEntry } from "./data-types";

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Shared storage is unavailable. Please retry.");
  return body as T;
}

export function useAppData() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AppData>({ records: [], questions: [] });
  const [saving, setSaving] = useState(false);
  const generation = useRef(0);
  const pending = useRef(0);

  const refresh = useCallback(async () => {
    if (pending.current) return;
    const request = ++generation.current;
    try {
      const next = await json<AppData>("/api/data");
      if (request !== generation.current) return;
      setData(next);
      setReady(true);
      setError(null);
    } catch (err) {
      if (request === generation.current) setError(err instanceof Error ? err.message : "Could not load shared records.");
    }
  }, []);

  useEffect(() => {
    const version = generation;
    // refresh updates state only after its network request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(onFocus, 15_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      ++version.current;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const addRecords = useCallback(async (items: NewIncident[], requestId: string) => {
    ++pending.current;
    ++generation.current;
    setSaving(true);
    try {
      const result = await json<{ records: IncidentRecord[] }>("/api/records", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: items, requestId }),
      });
      setData(old => {
        const ids = new Set(result.records.map(r => r.id));
        return { ...old, records: [...result.records, ...old.records.filter(r => !ids.has(r.id))] };
      });
      return result.records.map(r => r.id);
    } finally {
      --pending.current;
      ++generation.current;
      setSaving(pending.current > 0);
    }
  }, []);

  const setStatus = useCallback(async (id: string, status: Status) => {
    ++pending.current;
    ++generation.current;
    setSaving(true);
    try {
      const result = await json<{ record: IncidentRecord }>(`/api/records/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      setData(old => ({ ...old, records: old.records.map(r => r.id === id ? result.record : r) }));
    } finally {
      --pending.current;
      ++generation.current;
      setSaving(pending.current > 0);
    }
  }, []);

  const records = [...data.records].sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.id.localeCompare(a.id, undefined, { numeric: true }));
  return { ready, error, saving, refresh, records, questions: data.questions, addRecords, setStatus };
}
