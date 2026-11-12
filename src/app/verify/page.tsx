"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
export default function VerifyPage() {
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/auth/two-factor/${backup ? "verify-backup-code" : "verify-totp"}`,
        { method: "POST", body: JSON.stringify({ code, trustDevice: false }) },
        { redirectOnUnauthorized: false },
      );
      window.location.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      className="mx-auto my-14 w-[calc(100%-32px)] max-w-md rounded-2xl border border-slate-200 bg-white p-8"
    >
      <h1 className="text-2xl font-semibold">Verify your sign-in</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {backup
          ? "Enter one unused backup code."
          : "Enter the six-digit code from your authenticator app."}
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm font-semibold">
          {backup ? "Backup code" : "Authenticator code"}
          <input
            className="control mt-2"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode={backup ? "text" : "numeric"}
            pattern={backup ? undefined : "[0-9]{6}"}
            maxLength={backup ? 64 : 6}
            autoComplete="one-time-code"
            required
          />
        </label>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Verifying…" : "Verify"}
        </button>
      </form>
      <button
        className="text-action mt-4"
        onClick={() => {
          setBackup((v) => !v);
          setCode("");
          setError("");
        }}
      >
        {backup ? "Use an authenticator code" : "Use a backup code"}
      </button>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-800">
          {error}
        </p>
      )}
      <a href="/sign-in" className="text-action mt-5 block">
        Start sign-in again
      </a>
    </main>
  );
}
