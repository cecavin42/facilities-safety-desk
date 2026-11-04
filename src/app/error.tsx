"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8">
      <h1 className="text-2xl font-bold">This page could not finish loading</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Try loading it again. This does not delete saved browser records. If the
        problem continues, return to the overview and download a browser backup
        before making changes.
      </p>
      <div className="mt-5 flex gap-3">
        <button className="btn-primary" onClick={reset}>
          Try again
        </button>
        <Link className="btn-secondary" href="/">
          Go to overview
        </Link>
      </div>
    </section>
  );
}
