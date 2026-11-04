"use client";
import { LockKeyhole, RefreshCw } from "lucide-react";
import { useCurrentUser } from "./SessionUser";
export default function DataStatus({
  error,
  retry,
}: {
  error: string | null;
  retry: () => void;
}) {
  const user = useCurrentUser();
  return (
    <div className={`connection-strip ${error ? "connection-error" : ""}`}>
      <LockKeyhole size={13} />
      <span>
        {user.role === "admin" ? "Shared register" : "Your reports only"}
        <b>·</b>Server-saved records
      </span>
      {error && (
        <div role="alert">
          {error}
          <button className="btn-secondary" onClick={retry}>
            <RefreshCw size={13} />
            Retry loading
          </button>
        </div>
      )}
    </div>
  );
}
