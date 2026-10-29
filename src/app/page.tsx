import Link from "next/link";

const CARDS = [
  { href: "/report", title: "Report an incident", text: "Report an injury, near miss, property damage or unsafe condition. The form checks your entries before saving." },
  { href: "/assistant", title: "Ask the safety assistant", text: "Get answers from five forklift and incident-reporting documents, with the passage cited. It says so when the answer isn't there." },
  { href: "/reports", title: "See the reports", text: "Incidents over time, where and with what equipment, and which questions the assistant answered or declined." },
  { href: "/records", title: "Browse and export records", text: "Filter all reports, update their status and download them as a CSV file." },
  { href: "/upload", title: "Upload past incidents", text: "Import a spreadsheet (CSV) of past incidents. Each row is checked, and bad rows are listed with the reason." },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Facilities Safety Desk</h1>
        <p className="max-w-2xl text-slate-600">
          One place for a university facilities department to report safety incidents and near misses, ask safety
          questions answered from the rules, and see where problems happen.
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-teal-600">
            <h2 className="font-semibold text-teal-800">{c.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{c.text}</p>
          </Link>
        ))}
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-800">About this draft</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>The app starts with 150 fake incident records so the reports have something to show.</li>
          <li>Reports you add are saved only in this web browser for now. A shared database comes in a later version.</li>
          <li>The assistant finds and quotes matching passages. It does not use an AI model yet.</li>
          <li>No sign-in yet. Roles (employee, supervisor, safety manager) come in a later version.</li>
        </ul>
      </section>
    </div>
  );
}
