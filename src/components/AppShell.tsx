"use client";
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Plus, Search, X } from "lucide-react";
import Nav from "./Nav";
const titles: Record<string, string> = {
  "/": "Overview",
  "/records": "Incident register",
  "/report": "New report",
  "/reports": "Safety insights",
  "/upload": "Import incidents",
  "/assistant": "Safety assistant",
  "/admin": "Team access",
  "/account": "My account",
};
export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  function close() {
    dialog.current?.close();
    setOpen(false);
  }
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar no-print">
        <Nav />
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar no-print">
          <div className="topbar-location">
            <button
              className="icon-button mobile-menu-button"
              aria-label="Open navigation"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => {
                dialog.current?.showModal();
                setOpen(true);
              }}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-parent">Workspace</span>
            <ChevronRight size={14} aria-hidden="true" />
            <span>{titles[path] || "Workspace"}</span>
          </div>
          <form
            className="global-search"
            action="/records"
            method="get"
            role="search"
          >
            <Search size={17} aria-hidden="true" />
            <input
              name="q"
              type="search"
              aria-label="Search reports"
              placeholder="Search reports…"
              maxLength={120}
            />
            <span className="search-hint" aria-hidden="true">
              ↵
            </span>
          </form>
          <Link href="/report" className="btn-primary topbar-create">
            <Plus size={16} aria-hidden="true" />
            <span>New report</span>
          </Link>
        </header>
        <main id="main-content" tabIndex={-1} className="app-main">
          {children}
        </main>
      </div>
      <dialog
        ref={dialog}
        className="mobile-nav-dialog"
        aria-label="Workspace navigation"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onClose={() => setOpen(false)}
      >
        <button
          className="mobile-nav-close icon-button"
          aria-label="Close navigation"
          onClick={close}
        >
          <X size={20} />
        </button>
        <Nav onNavigate={close} />
      </dialog>
    </div>
  );
}
