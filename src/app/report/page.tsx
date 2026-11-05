"use client";

import IncidentReportForm from "@/components/IncidentReportForm";
import { useAppData } from "@/lib/store";

export default function ReportPage() {
  const { ready, addRecords, error, refresh } = useAppData();
  return <IncidentReportForm
    ready={ready}
    loadError={error}
    onRetry={() => void refresh()}
    storageDescription="Reports are saved in shared storage and can be viewed from another browser."
    onSave={async (record, requestId) => {
      const [id] = await addRecords([record], requestId);
      return id;
    }}
  />;
}
