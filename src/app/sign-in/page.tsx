"use client";
import { useState } from "react";
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          rememberMe: false,
        }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many attempts. Wait 15 minutes before trying again."
            : response.status >= 500
              ? "Sign-in is not available. Ask the administrator to check the server setup."
              : "Unable to sign in. Check your email and password, or ask an administrator about access.",
        );
        return;
      }
      setPassword("");
      window.location.replace("/");
    } catch {
      setError("Could not reach sign-in. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-12"
    >
      <div className="grid w-full gap-8 md:grid-cols-2">
        <section className="rounded-3xl bg-teal-950 p-8 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-200">
            Facilities Safety Desk
          </p>
          <h1 className="mt-6 text-4xl font-bold">Your reporting workspace.</h1>
          <p className="mt-5 leading-8 text-teal-100">
            Sign in to report incidents, follow your reports, and check safety
            sources.
          </p>
          <p className="mt-8 text-sm leading-7 text-teal-100">
            Approved accounts only. Employee reports are visible to their owner
            and the safety manager. This is a classroom prototype using
            fictional records.
          </p>
        </section>
        <form
          onSubmit={submit}
          className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <h2 className="text-2xl font-bold">Sign in</h2>
          <label className="mt-6 block text-sm font-semibold">
            Email
            <input
              className="control mt-2"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label className="mt-5 block text-sm font-semibold">
            Password
            <input
              className="control mt-2"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-900"
            >
              {error}
            </p>
          )}
          <button className="btn-primary mt-6 w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-5 text-sm leading-6 text-slate-500">
            Need access? Ask your team administrator. Registering an email
            address does not grant access.
          </p>
        </form>
      </div>
    </main>
  );
}
