"use client";

import { useState } from "react";
import { downloadText } from "@/lib/csv";
import { recordsToCsv } from "@/lib/export";
import type { IncidentRecord } from "@/lib/options";

export default function LegacyExport() {
  const [message, setMessage] = useState("");
  function exportPrevious() {
    try {
      const records = JSON.parse(localStorage.getItem("fsa.records.v1") ?? "[]") as IncidentRecord[];
      const statuses = JSON.parse(localStorage.getItem("fsa.statuses.v1") ?? "{}");
      if (!Array.isArray(records) || !records.length) { setMessage("No previous reports were found in this browser."); return; }
      downloadText("previous-browser-reports.csv", recordsToCsv(records.map(r => ({ ...r, status: statuses?.[r.id] ?? r.status }))));
      setMessage("Downloaded your previous reports. Use Upload CSV to review and import them. Imported reports receive new IDs and Open status; the export retains the old IDs and statuses. The browser copy is unchanged.");
    } catch { setMessage("Could not export the previous browser records. The browser copy is unchanged."); }
  }
  return <details className="text-sm text-slate-600">
    <summary className="cursor-pointer">Reports saved in the previous browser demo</summary>
    <p className="mt-2">Previous browser reports are not automatically copied into shared storage.</p>
    <button type="button" onClick={exportPrevious} className="mt-2 rounded border px-3 py-1">Export previous browser reports</button>
    {message && <p role="status" className="mt-2">{message}</p>}
  </details>;
}
