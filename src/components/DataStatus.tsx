"use client";
import { useState } from "react";
import { rawBackup } from "@/lib/browser-data";
import { downloadText } from "@/lib/csv";

export default function DataStatus({
  error,
  retry,
}: {
  error: string | null;
  retry: () => void;
}) {
  const [message, setMessage] = useState("");
  function backup() {
    try {
      downloadText(
        "facilities-safety-browser-backup.json",
        rawBackup(localStorage),
        "application/json",
      );
      setMessage(
        "Backup downloaded. Keep it private; it contains this browser's demo data.",
      );
    } catch {
      setMessage("Browser storage could not be accessed. No data was changed.");
    }
  }
  return (
    <div
      className={
        error
          ? "no-print rounded-xl border border-red-200 bg-red-50 p-4"
          : "no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
      }
    >
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-900">
          {error}
        </p>
      ) : (
        <p className="text-xs text-slate-600">
          <span
            className="mr-2 inline-block h-2 w-2 rounded-full bg-teal-600"
            aria-hidden="true"
          />
          Saved in this browser · fictional demo data
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {error && (
          <button onClick={retry} className="btn-secondary">
            Retry loading
          </button>
        )}
        <button
          onClick={backup}
          className="min-h-11 rounded px-2 text-xs font-semibold text-teal-800 underline"
        >
          Download browser backup
        </button>
      </div>
      {message && (
        <p role="status" className="w-full text-xs text-slate-700">
          {message}
        </p>
      )}
    </div>
  );
}
