"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/report", label: "New report" },
  { href: "/records", label: "Records" },
  { href: "/upload", label: "Import CSV" },
  { href: "/reports", label: "Insights" },
  { href: "/assistant", label: "Assistant" },
];
export default function Nav() {
  const path = usePathname();
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-100 py-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-3 font-bold text-teal-950"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-800 text-sm text-white"
            >
              FS
            </span>
            Facilities Safety Desk
          </Link>
          <span className="hidden rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900 sm:block">
            Team A · classroom demo
          </span>
        </div>
        <nav
          aria-label="Main navigation"
          className="grid grid-cols-3 gap-1 py-2 sm:flex sm:flex-wrap"
        >
          {LINKS.map((link) => {
            const active =
              path === link.href ||
              (link.href !== "/" && path.startsWith(link.href + "/"));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold sm:px-5 ${active ? "bg-teal-50 text-teal-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
