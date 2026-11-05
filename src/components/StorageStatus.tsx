"use client";

export default function StorageStatus({ error, retry }: { error: string | null; retry: () => void }) {
  if (!error) return null;
  return <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
    {error} <button type="button" onClick={retry} className="ml-2 font-semibold underline">Retry loading</button>
  </div>;
}
