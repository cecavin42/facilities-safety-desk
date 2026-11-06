"use client";
import { useEffect, useState } from "react";
export default function RecoverPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => {
      setToken(
        new URLSearchParams(window.location.hash.slice(1)).get("token") || "",
      );
      window.history.replaceState(null, "", "/recover");
    });
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Recovery failed.");
      setPassword("");
      setConfirm("");
      setToken("");
      window.location.replace("/sign-in");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recovery failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      className="mx-auto my-14 w-[calc(100%-32px)] max-w-md rounded-2xl border border-slate-200 bg-white p-8"
    >
      <h1 className="text-2xl font-semibold">Recover your account</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Use the one-time link provided privately by your administrator. A
        successful reset ends all existing sessions; authenticator protection
        remains enabled.
      </p>
      {!token ? (
        <p className="mt-5 text-sm text-amber-900">
          Open a valid recovery link. If it has expired, ask an administrator
          for a new one.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-sm">
            New password
            <input
              type="password"
              className="control mt-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={15}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="block text-sm">
            Confirm new password
            <input
              type="password"
              className="control mt-2"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={15}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
          <button className="btn-primary w-full" disabled={busy}>
            Set password and sign out other sessions
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-800">
          {error}
        </p>
      )}
    </main>
  );
}
