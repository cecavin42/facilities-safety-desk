"use client";
import TwoFactorSettings from "@/components/TwoFactorSettings";
import { useState } from "react";
import { useCurrentUser } from "@/components/SessionUser";
import { ROLE_LABELS } from "@/lib/access";
import { api } from "@/lib/client-api";
export default function AccountPage() {
  const user = useCurrentUser();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function change(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setMessage("");
    if (data.get("newPassword") !== data.get("confirmation")) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          newPassword: data.get("newPassword"),
          revokeOtherSessions: true,
        }),
      });
      form.reset();
      setMessage("Password changed. Other sessions have ended.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password was not changed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8">
      <h1 className="text-3xl font-bold">Your account</h1>
      <p className="mt-3">
        {user.name} · {ROLE_LABELS[user.role]}
      </p>
      <p className="break-all text-sm text-slate-500">{user.email}</p>
      <h2 className="mt-8 text-xl font-semibold">Change password</h2>
      <form onSubmit={change} className="mt-4 space-y-4">
        {[
          ["currentPassword", "Current password", "current-password"],
          ["newPassword", "New password", "new-password"],
          ["confirmation", "Confirm new password", "new-password"],
        ].map(([name, label, complete]) => (
          <label className="block text-sm font-semibold" key={name}>
            {label}
            <input
              name={name}
              type="password"
              className="control mt-2"
              autoComplete={complete}
              minLength={name === "currentPassword" ? 1 : 15}
              maxLength={128}
              required
              disabled={busy}
            />
          </label>
        ))}
        <button className="btn-primary" disabled={busy}>
          Change password
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm text-teal-800">
          {message}
        </p>
      )}
      <TwoFactorSettings />
    </section>
  );
}
