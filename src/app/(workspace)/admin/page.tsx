"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { useCurrentUser } from "@/components/SessionUser";
import { Plus, X, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
const actionLabels: Record<string, string> = {
  "report.created": "Report created",
  "report.status_changed": "Report status updated",
  "reports.imported": "Reports imported",
  "account.created": "Account created",
  "account.access_changed": "Account access changed",
};
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
};
type Audit = {
  id: string;
  actor: string;
  action: string;
  targetId: string | null;
  occurredAt: string;
};
export default function AdminPage() {
  const actor = useCurrentUser();
  const accountDialog = useRef<HTMLDialogElement>(null);
  const [visibleAudit, setVisibleAudit] = useState(6);
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const [u, a] = await Promise.all([
        api<User[]>("/api/admin/users"),
        api<Audit[]>("/api/admin/audit"),
      ]);
      setUsers(u);
      setAudit(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts.");
    }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(data)),
      });
      form.reset();
      accountDialog.current?.close();
      setMessage(
        "Account created. Share the initial password privately with the approved person.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Account was not created.");
    } finally {
      setBusy(false);
    }
  }
  async function access(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: data.get("role"),
          active: data.get("active") === "on",
        }),
      });
      setMessage(
        "Access updated. Existing sessions for that account have ended.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Access change was not saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6 team-access-page">
      <PageHeader
        eyebrow="Access management"
        title="Team access"
        description="Manage approved accounts, roles, and access to the facilities workspace."
      >
        <button
          className="btn-primary"
          onClick={() => {
            setError("");
            accountDialog.current?.showModal();
          }}
        >
          <Plus size={15} />
          Add account
        </button>
      </PageHeader>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-900">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg bg-teal-50 p-4 text-teal-900">
          {message}
        </p>
      )}
      <div className="access-callout">
        <ShieldCheck size={18} />
        <div>
          <strong>Access follows the role.</strong>
          <p>
            Employees see their own reports. Safety managers manage the shared
            register. Access changes end the affected account&apos;s sessions.
          </p>
        </div>
      </div>
      <dialog
        ref={accountDialog}
        className="account-dialog"
        aria-labelledby="account-dialog-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <div className="dialog-heading">
          <div>
            <p className="section-kicker">APPROVED ACCESS</p>
            <h2 id="account-dialog-title">Create an approved account</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close account form"
            disabled={busy}
            onClick={() => accountDialog.current?.close()}
          >
            <X size={19} />
          </button>
        </div>
        {error && (
          <p role="alert" className="signin-error">
            {error}
          </p>
        )}
        <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Name
            <input
              className="control mt-2"
              name="name"
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <label className="text-sm font-semibold">
            Email
            <input
              className="control mt-2"
              name="email"
              type="email"
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Initial password
            <input
              className="control mt-2"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={15}
              maxLength={128}
            />
          </label>
          <label className="text-sm font-semibold">
            Role
            <select className="control mt-2" name="role">
              <option value="user">Employee</option>
              <option value="admin">Safety manager / admin</option>
            </select>
          </label>
          <button className="btn-primary" disabled={busy}>
            Create account
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          Passwords require at least 15 characters. No invitation email is sent
          by this prototype. Account management requires a sign-in from the last
          15 minutes.
        </p>
      </dialog>
      <section className="member-section">
        <div className="member-section-heading">
          <h2>
            Team members <span>{users.length}</span>
          </h2>
          <small>{users.filter((u) => !u.banned).length} active accounts</small>
        </div>
        {users.map((user) => (
          <form
            onSubmit={(event) => void access(event, user.id)}
            key={user.id}
            className="member-row"
          >
            <span className="member-avatar">
              {user.name
                .split(/\s+/)
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="member-identity">
              <p className="font-semibold">
                {user.name}
                {user.id === actor.id ? " (you)" : ""}
              </p>
              <p className="break-all text-sm text-slate-500">{user.email}</p>
            </div>
            <span
              className={`member-state ${user.banned ? "member-disabled" : ""}`}
            >
              {user.banned ? "Disabled" : "Active"}
            </span>
            <label className="member-role">
              <span className="sr-only">Role for {user.name}</span>
              <select
                name="role"
                className="control mt-1"
                defaultValue={user.role}
                disabled={busy || user.id === actor.id}
              >
                <option value="user">Employee</option>
                <option value="admin">Safety manager / admin</option>
              </select>
            </label>
            <label className="member-enable">
              <input
                name="active"
                type="checkbox"
                defaultChecked={!user.banned}
                disabled={busy || user.id === actor.id}
              />
              Active
            </label>
            <button
              className="btn-secondary member-save"
              aria-label={`Save access for ${user.name}`}
              disabled={busy || user.id === actor.id}
            >
              Save access
            </button>
          </form>
        ))}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">
          Recent security and record activity
        </h2>
        <ul className="mt-4 divide-y">
          {audit.slice(0, visibleAudit).map((item) => (
            <li className="py-3 text-sm" key={item.id}>
              <p className="font-medium">
                {actionLabels[item.action] || item.action} ·{" "}
                {item.actor || "System"}
              </p>
              <p className="mt-1 break-all text-xs text-slate-500">
                {new Date(item.occurredAt).toLocaleString()}
                {item.targetId ? ` · ${item.targetId}` : ""}
              </p>
            </li>
          ))}
        </ul>
        {visibleAudit < audit.length && (
          <button
            className="text-action audit-more"
            onClick={() => setVisibleAudit((n) => n + 10)}
          >
            Show more activity
          </button>
        )}
        {!audit.length && (
          <p className="mt-3 text-sm text-slate-500">
            No recorded changes yet.
          </p>
        )}
      </section>
    </div>
  );
}
