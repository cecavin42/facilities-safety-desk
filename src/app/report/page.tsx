"use client";

import IncidentReportForm from "@/components/IncidentReportForm";
import { useAppData } from "@/lib/store";

export default function ReportPage() {
  const { ready, error, refresh, addRecords } = useAppData();
  return (
    <IncidentReportForm
      ready={ready}
      loadError={error}
      onRetry={refresh}
      storageDescription="This demo saves reports in this browser. Shared database storage is being connected separately."
      onSave={async (record) => {
        const [id] = await addRecords([record]);
        return id;
      }}
    />
  );
}
