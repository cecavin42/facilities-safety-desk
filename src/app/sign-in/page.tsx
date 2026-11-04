"use client";
import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  LoaderCircle,
} from "lucide-react";
import Brand from "@/components/Brand";
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
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
    <main id="main-content" className="sign-in-layout">
      <div className="sign-in-card">
        <section className="signin-visual">
          <Brand light />
          <div className="signin-story">
            <span className="signin-kicker">
              A CLEARER VIEW OF CAMPUS SAFETY
            </span>
            <h1>
              Every report.
              <br />A better next step.
            </h1>
            <p>
              Keep your reports, safety information, and follow-through in one
              place.
            </p>
          </div>
          <Image
            src="/brand/campus-illustration.png"
            alt="Architectural illustration of a university campus"
            width={1672}
            height={941}
            sizes="(max-width: 900px) 100vw, 55vw"
            loading="eager"
            className="signin-campus"
          />
          <span className="signin-visual-caption">
            Built for the people who keep places running.
          </span>
        </section>
        <div className="signin-form-panel">
          <form onSubmit={submit} className="signin-form">
            <span className="signin-lock">
              <LockKeyhole size={21} />
            </span>
            <h2>Welcome back</h2>
            <p>Sign in to your facilities workspace.</p>
            <label htmlFor="signin-email">Email address</label>
            <input
              id="signin-email"
              className="control"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
            <label htmlFor="signin-password">Password</label>
            <div className="password-control">
              <input
                id="signin-password"
                className="control"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
              <button
                className="icon-button"
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((s) => !s)}
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {error && (
              <p role="alert" className="signin-error">
                {error}
              </p>
            )}
            <button className="btn-primary signin-submit" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle size={17} className="loading-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={17} />
                </>
              )}
            </button>
            <div className="signin-access-note">
              <LockKeyhole size={14} />
              <span>
                Approved accounts only. Contact your team administrator if you
                need access.
              </span>
            </div>
          </form>
          <div className="signin-panel-footer">
            <span>Team A · AI Studio I</span>
            <span>Classroom prototype</span>
          </div>
        </div>
      </div>
    </main>
  );
}
