"use client";
import { useCurrentUser } from "./SessionUser";
import { ROLE_LABELS } from "@/lib/access";
export default function DataStatus({
  error,
  retry,
}: {
  error: string | null;
  retry: () => void;
}) {
  const user = useCurrentUser();
  return (
    <div
      className={`no-print rounded-xl border p-4 ${error ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}
    >
      <p className="text-xs text-slate-600">
        {user.name} · {ROLE_LABELS[user.role]} · Server-saved records
      </p>
      {error && (
        <div role="alert" className="mt-3 text-sm text-red-900">
          {error}
          <button className="btn-secondary ml-3" onClick={retry}>
            Retry loading
          </button>
        </div>
      )}
    </div>
  );
}
