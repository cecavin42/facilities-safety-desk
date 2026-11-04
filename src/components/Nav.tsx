"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCurrentUser, signOut } from "./SessionUser";
import { ROLE_LABELS } from "@/lib/access";
const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/report", label: "New report" },
  { href: "/records", label: "Records" },
  { href: "/upload", label: "Import CSV", admin: true },
  { href: "/reports", label: "Insights", admin: true },
  { href: "/assistant", label: "Assistant" },
  { href: "/admin", label: "Accounts", admin: true },
];
export default function Nav() {
  const path = usePathname();
  const user = useCurrentUser();
  const [error, setError] = useState("");
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3">
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
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-600">
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <Link
              href="/account"
              className="min-h-11 content-center text-sm font-semibold text-teal-800 underline"
            >
              My account
            </Link>
            <button
              className="btn-secondary"
              onClick={() => {
                void signOut().catch((e) => setError(e.message));
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="p-3 text-red-800">
            {error}
          </p>
        )}
        <nav
          aria-label="Main navigation"
          className="grid grid-cols-3 gap-1 py-2 sm:flex sm:flex-wrap"
        >
          {LINKS.filter((l) => !l.admin || user.role === "admin").map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path === l.href ? "page" : undefined}
              className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold sm:px-5 ${path === l.href ? "bg-teal-50 text-teal-950" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
