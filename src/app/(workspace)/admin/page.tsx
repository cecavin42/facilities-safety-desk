"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { useCurrentUser } from "@/components/SessionUser";
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access management"
        title="Approved people. Clear permissions."
        description="Employees access their own reports. Safety managers manage all reports, imports, insights and accounts. Access changes end the affected account's existing sessions."
      />
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
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Create an approved account</h2>
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
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Accounts</h2>
        {users.map((user) => (
          <form
            onSubmit={(event) => void access(event, user.id)}
            key={user.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {user.name}
                {user.id === actor.id ? " (you)" : ""}
              </p>
              <p className="break-all text-sm text-slate-500">{user.email}</p>
            </div>
            <label className="text-sm">
              Role for {user.name}
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
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                name="active"
                type="checkbox"
                defaultChecked={!user.banned}
                disabled={busy || user.id === actor.id}
              />
              Active
            </label>
            <button
              className="btn-secondary"
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
          {audit.map((item) => (
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
        {!audit.length && (
          <p className="mt-3 text-sm text-slate-500">
            No recorded changes yet.
          </p>
        )}
      </section>
    </div>
  );
}
