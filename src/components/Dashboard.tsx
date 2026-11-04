"use client";
import Link from "next/link";
import { useCurrentUser } from "./SessionUser";
import DataStatus from "./DataStatus";
import { useAppData } from "@/lib/store";
export default function Dashboard({ lastUpdated }: { lastUpdated: string }) {
  const user = useCurrentUser();
  const { ready, error, refresh, records } = useAppData();
  const tasks = [
    {
      href: "/records",
      label: "Review the register",
      text:
        user.role === "admin"
          ? "Find a report, read its details, and update its status."
          : "Find your reports and follow their current status.",
      tag: "Follow through",
    },
    {
      href: "/reports",
      label: "Explore safety insights",
      text: "See incident patterns and the questions the assistant could not fully answer.",
      tag: "Understand patterns",
    },
    {
      href: "/upload",
      label: "Import past incidents",
      text: "Check a CSV, review duplicates, and save valid records.",
      tag: "Bring records together",
    },
  ];
  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-3xl border border-teal-900 bg-teal-950 px-6 py-9 text-white sm:px-9 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-200">
          Facilities Safety Desk · Team A
        </p>
        <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          Report clearly.
          <br />
          Follow through confidently.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-teal-100">
          A shared project for recording incidents, checking safety sources, and
          learning from patterns. Start with the task you need today.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/report"
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-bold text-teal-950 hover:bg-teal-50"
          >
            Report an incident
          </Link>
          <Link
            href="/assistant"
            className="inline-flex min-h-12 items-center justify-center rounded-lg border border-teal-300 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-900"
          >
            Ask the safety assistant
          </Link>
        </div>
      </section>
      <DataStatus error={error} retry={refresh} />
      <section
        aria-label="Demo record overview"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {[
          [
            records.length,
            user.role === "admin" ? "Total records" : "Your reports",
          ],
          [
            records.filter((r) => r.status !== "Closed").length,
            "Open or under review",
          ],
          [
            records.filter((r) => r.eventType === "Near miss").length,
            "Near misses",
          ],
          [records.filter((r) => r.status === "Closed").length, "Closed"],
        ].map(([value, label]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
          >
            <p className="text-3xl font-bold tabular-nums text-slate-900">
              {ready ? value : "—"}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{label}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-4 md:grid-cols-3" aria-label="Next tasks">
        {tasks
          .filter((task) => user.role === "admin" || task.href === "/records")
          .map((task) => (
            <Link
              key={task.href}
              href={task.href}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-teal-600"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                {task.tag}
              </p>
              <h2 className="mt-3 text-lg font-semibold">
                {task.label}{" "}
                <span aria-hidden="true" className="text-teal-700">
                  →
                </span>
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {task.text}
              </p>
            </Link>
          ))}
      </section>
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent accessible reports</h2>
            <Link
              href="/records"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 underline"
            >
              View all
            </Link>
          </div>
          {ready && records.length ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {records.slice(0, 3).map((r) => (
                <li key={r.id} className="py-4">
                  <div className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="font-mono font-bold text-teal-900">
                      {r.id}
                    </span>
                    <span className="text-slate-500">
                      {r.eventDate} · {r.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium">
                    {r.eventType} · {r.location}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                    {r.description}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              {error
                ? "Records are unavailable until browser data can be read."
                : ready
                  ? "No reports yet. Create your first report to start your register."
                  : "Loading your reports…"}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-6">
          <h2 className="text-lg font-semibold text-teal-950">
            Know the limits of the demo
          </h2>
          <ul className="mt-4 space-y-4 text-sm leading-7 text-teal-950">
            <li>All incidents and reporter details should be fictional.</li>
            <li>
              Reports are saved to the server. Employees see their own reports;
              safety managers manage the shared register.
            </li>
            <li>
              The assistant links answers to five source documents and labels
              incomplete coverage.
            </li>
            <li>
              UT examples do not establish Lipscomb policy. Verify current local
              procedures.
            </li>
          </ul>
          <p className="mt-5 border-t border-teal-200 pt-4 text-xs text-teal-900">
            Last updated: {lastUpdated}
          </p>
        </div>
      </section>
    </div>
  );
}
