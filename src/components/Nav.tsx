"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  FilePlus2,
  ChartNoAxesCombined,
  FileSpreadsheet,
  Sparkles,
  BookOpen,
  UsersRound,
  Settings2,
  LogOut,
  Building2,
  ArrowUpRight,
} from "lucide-react";
import { useCurrentUser, signOut } from "./SessionUser";
import Brand from "./Brand";
const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/records", label: "Incident register", icon: ClipboardList },
  { href: "/report", label: "New report", icon: FilePlus2 },
  {
    href: "/reports",
    label: "Safety insights",
    icon: ChartNoAxesCombined,
    admin: true,
  },
  {
    href: "/upload",
    label: "Import incidents",
    icon: FileSpreadsheet,
    admin: true,
  },
  { href: "/sources", label: "Source library", icon: BookOpen },
  { href: "/assistant", label: "Safety assistant", icon: Sparkles },
];
export default function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const user = useCurrentUser();
  const [error, setError] = useState("");
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
  const item = (href: string, label: string, Icon: typeof LayoutDashboard) => (
    <Link
      key={href}
      href={href}
      onClick={onNavigate}
      aria-current={path === href ? "page" : undefined}
      className={`side-link ${path === href ? "side-link-active" : ""}`}
    >
      <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
      <span>{label}</span>
      {path === href && <span className="active-dot" />}
    </Link>
  );
  return (
    <div className="sidenav">
      <Link
        href="/"
        className="side-brand"
        onClick={onNavigate}
        aria-label="Facilities Safety Desk overview"
      >
        <Brand light />
      </Link>
      <div className="workspace-label">
        <span className="workspace-symbol">
          <Building2 size={18} />
        </span>
        <span>
          <strong>Team A</strong>
          <small>Facilities workspace</small>
        </span>
        <span className="workspace-initial">TA</span>
      </div>
      <nav aria-label="Main navigation">
        <p className="nav-section-label">WORKSPACE</p>
        {links
          .filter((l) => !l.admin || user.role === "admin")
          .map((l) => item(l.href, l.label, l.icon))}
        <p className="nav-section-label nav-section-second">MANAGE</p>
        {user.role === "admin" && item("/admin", "Team access", UsersRound)}
        {item("/account", "My account", Settings2)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span className="note-dot" />
          Classroom environment
          <Link
            href="/assistant"
            onClick={onNavigate}
            aria-label="Open the safety assistant"
          >
            <ArrowUpRight size={15} />
          </Link>
        </div>
        {error && (
          <p role="alert" className="side-error">
            {error}
          </p>
        )}
        <div className="side-profile">
          <span className="avatar">{initials}</span>
          <Link href="/account" onClick={onNavigate}>
            <strong>{user.name}</strong>
            <small>
              {user.role === "admin" ? "Safety manager" : "Employee"}
            </small>
          </Link>
          <button
            aria-label="Sign out"
            title="Sign out"
            className="side-signout icon-button"
            onClick={() => {
              void signOut().catch((e) => setError(e.message));
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
