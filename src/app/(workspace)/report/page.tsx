"use client";

import { useCurrentUser } from "@/components/SessionUser";
import IncidentReportForm from "@/components/IncidentReportForm";
import { useAppData } from "@/lib/store";

export default function ReportPage() {
  const user = useCurrentUser();
  const { ready, error, refresh, addRecords } = useAppData();
  return (
    <IncidentReportForm
      ready={ready}
      draftKey={`fsa.report-draft.${user.id}`}
      loadError={error}
      onRetry={refresh}
      storageDescription="Reports are saved to the server under your account. Only you and a safety manager can view your reports."
      onSave={async (record, requestId) => {
        const [id] = await addRecords([record], requestId);
        return id;
      }}
    />
  );
}
