"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/report", label: "Report" },
  { href: "/records", label: "Records" },
  { href: "/upload", label: "Upload CSV" },
  { href: "/reports", label: "Reports" },
  { href: "/assistant", label: "Assistant" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link href="/" className="mr-auto font-semibold text-teal-800">
          Facilities Safety Desk
        </Link>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={
              path === l.href || path.startsWith(l.href + "/")
                ? "text-sm font-medium text-teal-800 underline underline-offset-4"
                : "text-sm text-slate-600 hover:text-slate-900"
            }
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
