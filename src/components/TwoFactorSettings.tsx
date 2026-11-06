"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { api } from "@/lib/client-api";
export default function TwoFactorSettings() {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{
    totpURI: string;
    backupCodes: string[];
  } | null>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<{ enabled: boolean; available: boolean }>(
      "/api/account/security",
    )
      .then((r) => {
        setEnabled(r.enabled);
        setAvailable(r.available);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function begin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (enabled) {
        await api("/api/auth/two-factor/disable", {
          method: "POST",
          body: JSON.stringify({ password }),
        });
        setEnabled(false);
        setMessage("Authenticator protection disabled for this account.");
      } else {
        const r = await api<{ totpURI: string; backupCodes: string[] }>(
          "/api/auth/two-factor/enable",
          {
            method: "POST",
            body: JSON.stringify({ password, method: "totp" }),
          },
        );
        setQr(await QRCode.toDataURL(r.totpURI, { width: 220, margin: 2 }));
        setSetup(r);
      }
      setPassword("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The security change was not completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        "/api/auth/two-factor/verify-totp",
        {
          method: "POST",
          body: JSON.stringify({ code, trustDevice: false }),
        },
        { redirectOnUnauthorized: false },
      );
      setEnabled(true);
      setCode("");
      setMessage(
        "Authenticator protection is enabled. Save the recovery codes privately before leaving this page.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The code could not be verified.",
      );
    } finally {
      setBusy(false);
    }
  }
  // Held back for now: shown only where MFA is switched on, or to an account that already has it.
  if (!available && !enabled) return null;
  return (
    <section className="mt-8 border-t border-slate-200 pt-7">
      <h2 className="text-xl font-semibold">Authenticator protection</h2>
      <p className="mt-2 text-sm leading-7 text-slate-600">
        {loading
          ? "Checking security settings…"
          : enabled
            ? "Enabled. Sign-in requires a code from your authenticator app or an unused backup code."
            : "Add a second factor with an authenticator app. Recommended for safety managers and administrators."}
      </p>
      {!setup && !loading && (
        <form onSubmit={begin} className="mt-4 space-y-3">
          <label className="block text-sm font-semibold">
            Current password for security changes
            <input
              type="password"
              className="control mt-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={busy}
            />
          </label>
          <button className="btn-secondary" disabled={busy}>
            {enabled ? "Disable authenticator" : "Set up authenticator"}
          </button>
        </form>
      )}
      {setup && (
        <div className="mt-4 space-y-4">
          {!enabled && (
            <>
              <p className="text-sm">
                Scan this private QR code in your authenticator app, then enter
                its six-digit code.
              </p>
              {qr && (
                <Image
                  src={qr}
                  alt="Private authenticator setup QR code"
                  width={220}
                  height={220}
                  unoptimized
                />
              )}
              <form onSubmit={verify} className="space-y-3">
                <label className="block text-sm">
                  Authenticator code
                  <input
                    className="control mt-2"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="one-time-code"
                    required
                  />
                </label>
                <button className="btn-primary" disabled={busy}>
                  Verify and enable
                </button>
              </form>
            </>
          )}
          <div className="rounded-lg bg-amber-50 p-4">
            <h3 className="font-semibold">Backup codes — save privately</h3>
            <p className="mt-2 text-xs leading-6">
              Each code works once. These codes are shown only during setup. Do
              not put them in shared project documents.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
              {setup.backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          {enabled && (
            <button
              className="btn-secondary"
              onClick={() => {
                setSetup(null);
                setQr("");
              }}
            >
              I have saved my backup codes
            </button>
          )}
        </div>
      )}
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
    </section>
  );
}
