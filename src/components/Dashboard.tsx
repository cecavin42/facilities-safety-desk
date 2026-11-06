"use client";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  ClipboardList,
  Clock3,
  CircleCheck,
  FileSpreadsheet,
  Sparkles,
  MapPin,
  ShieldCheck,
  Plus,
  FileText,
} from "lucide-react";
import { useCurrentUser } from "./SessionUser";
import { useAppData } from "@/lib/store";
import StatusBadge from "./StatusBadge";
import OverviewChart from "./OverviewChart";
import DataStatus from "./DataStatus";
export default function Dashboard({ lastUpdated }: { lastUpdated: string }) {
  const user = useCurrentUser();
  const { ready, error, refresh, records } = useAppData();
  const counts = {
    open: records.filter((r) => r.status === "Open").length,
    review: records.filter((r) => r.status === "Under review").length,
    closed: records.filter((r) => r.status === "Closed").length,
  };
  const stats = [
    {
      label: user.role === "admin" ? "Total reports" : "Your reports",
      value: records.length,
      note: "Across accessible records",
      icon: ClipboardList,
      tone: "teal",
      href: "/records",
    },
    {
      label: "Open",
      value: counts.open,
      note: "Awaiting review",
      icon: FileText,
      tone: "amber",
      href: "/records?status=Open",
    },
    {
      label: "Under review",
      value: counts.review,
      note: "In the review process",
      icon: Clock3,
      tone: "blue",
      href: "/records?status=Under%20review",
    },
    {
      label: "Closed",
      value: counts.closed,
      note: "Marked complete",
      icon: CircleCheck,
      tone: "green",
      href: "/records?status=Closed",
    },
  ];
  let offset = 0;
  const segments = [
    { label: "Open", value: counts.open, color: "#dba757" },
    { label: "Under review", value: counts.review, color: "#7a8ecc" },
    { label: "Closed", value: counts.closed, color: "#1b9782" },
  ];
  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <p className="section-kicker">YOUR WORKSPACE</p>
          <h1>Overview</h1>
          <p>
            Track reports, review activity, and keep safety information within
            reach.
          </p>
        </div>
        <div className="workspace-date">
          <ShieldCheck size={15} />
          <span>Access controlled workspace</span>
        </div>
      </header>
      {error && <DataStatus error={error} retry={refresh} />}
      <section className="metric-grid" aria-label="Report overview">
        {stats.map((s) => (
          <Link href={s.href} key={s.label} className="metric-card">
            <div className="metric-top">
              <span>{s.label}</span>
              <span className={`metric-icon tone-${s.tone}`}>
                <s.icon size={18} strokeWidth={1.7} />
              </span>
            </div>
            <strong
              className={`metric-value ${!ready ? "metric-loading" : ""}`}
            >
              {ready ? s.value : "—"}
            </strong>
            <div className="metric-bottom">
              <span>{s.note}</span>
              <ArrowUpRight size={15} />
            </div>
          </Link>
        ))}
      </section>
      <section className="dashboard-analytics">
        <div className="surface trend-card">
          <div className="surface-heading">
            <div>
              <h2>Reporting activity</h2>
              <p>Monthly volume across the last six months</p>
            </div>
            <span className="subtle-tag">6 months</span>
          </div>
          {ready ? (
            <OverviewChart records={records} />
          ) : (
            <div className="chart-loading" role="status">
              Loading report activity…
            </div>
          )}
        </div>
        <div className="surface status-card">
          <div className="surface-heading">
            <div>
              <h2>Report status</h2>
              <p>Current distribution</p>
            </div>
          </div>
          <div className="status-breakdown">
            <div className="donut">
              <svg viewBox="0 0 36 36" aria-hidden="true">
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#edf1f2"
                  strokeWidth="3.4"
                />
                {segments.map((s) => {
                  const percent = records.length
                    ? (s.value / records.length) * 100
                    : 0;
                  const start = offset;
                  offset += percent;
                  return (
                    <circle
                      key={s.label}
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke={s.color}
                      strokeWidth="3.4"
                      strokeDasharray={`${percent} ${100 - percent}`}
                      strokeDashoffset={-start}
                      transform="rotate(-90 18 18)"
                    />
                  );
                })}
              </svg>
              <div>
                <strong>{ready ? records.length : "—"}</strong>
                <span>reports</span>
              </div>
            </div>
            <dl>
              {segments.map((s) => (
                <div key={s.label}>
                  <dt>
                    <i style={{ background: s.color }} />
                    {s.label}
                  </dt>
                  <dd>{ready ? s.value : "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
      <section className="dashboard-bottom">
        <div className="surface recent-reports">
          <div className="surface-heading">
            <div>
              <h2>Recent reports</h2>
              <p>
                {user.role === "admin"
                  ? "Latest activity in your register"
                  : "Your most recent submissions"}
              </p>
            </div>
            <Link href="/records" className="text-action">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          {ready && records.length ? (
            <div className="recent-table">
              <div className="recent-table-head">
                <span>Report</span>
                <span>Location</span>
                <span>Status</span>
              </div>
              {records.slice(0, 5).map((r) => (
                <Link
                  className="recent-row"
                  key={r.id}
                  href={`/records?q=${encodeURIComponent(r.id)}`}
                >
                  <span className="recent-report-name">
                    <i>
                      <FileText size={17} />
                    </i>
                    <span>
                      <strong>{r.eventType}</strong>
                      <small>
                        {r.id} <b>·</b> {r.eventDate}
                      </small>
                    </span>
                  </span>
                  <span className="recent-location">
                    <MapPin size={13} />
                    {r.location}
                  </span>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <ClipboardList size={30} />
              <h3>
                {ready ? "Your register starts here" : "Loading reports…"}
              </h3>
              <p>
                {ready
                  ? "Create a report and follow its progress in this workspace."
                  : "Retrieving your accessible records."}
              </p>
              {ready && (
                <Link href="/report" className="text-action">
                  Create a report <ArrowRight size={15} />
                </Link>
              )}
            </div>
          )}
        </div>
        <aside className="dashboard-aside">
          <div className="assistant-card">
            <div className="assistant-card-art">
              <Image
                src="/brand/campus-illustration.png"
                alt=""
                width={1672}
                height={941}
                sizes="360px"
              />
            </div>
            <div className="assistant-card-body">
              <span className="assistant-label">
                <Sparkles size={13} />
                KNOWLEDGE ASSISTANT
              </span>
              <h2>A source for your next step.</h2>
              <p>Check safety guidance with citations you can inspect.</p>
              <Link href="/assistant">
                Ask a question <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
          <div className="surface quick-actions">
            <h2>Quick actions</h2>
            <Link href="/report">
              <Plus size={17} />
              Create a report
              <ArrowRight size={14} />
            </Link>
            {user.role === "admin" ? (
              <Link href="/upload">
                <FileSpreadsheet size={17} />
                Import a CSV
                <ArrowRight size={14} />
              </Link>
            ) : (
              <Link href="/records">
                <ClipboardList size={17} />
                View my reports
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </aside>
      </section>
      <footer className="dashboard-footer">
        <span>
          <span className="live-dot" />
          Server-saved records ·{" "}
          {user.role === "admin" ? "Shared register" : "Your reports only"}
        </span>
        <span>Last updated {lastUpdated}</span>
      </footer>
    </div>
  );
}
