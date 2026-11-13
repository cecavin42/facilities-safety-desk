import { betterAuth } from "better-auth";
import { admin, twoFactor } from "better-auth/plugins";
import type { Pool } from "pg";
import { authOrigins } from "./auth-url";

export function authOptions(pool: Pool) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const { base: baseURL, trusted } = authOrigins();
  if (!secret || secret.length < 32 || !baseURL)
    throw new Error("Authentication is not configured");
  const url = new URL(baseURL);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error("Authentication requires HTTPS");
  return {
    appName: "Facilities Safety Desk",
    baseURL: url.origin,
    secret,
    database: pool,
    trustedOrigins: trusted.includes(url.origin)
      ? trusted
      : [url.origin, ...trusted],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 15,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 8,
      disableSessionRefresh: true,
      updateAge: 60 * 30,
      freshAge: 60 * 15,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database" as const,
      window: 60,
      max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 20 } },
    },
    advanced: {
      cookiePrefix: "fsa",
      useSecureCookies: url.protocol === "https:",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: url.protocol === "https:",
      },
    },
    plugins: [admin(), twoFactor()],
    logger: { disabled: true },
    telemetry: { enabled: false },
  };
}
export function createAuth(pool: Pool) {
  return betterAuth(authOptions(pool));
}
// True when this deployment has what authOptions needs to run sign-in: a secret
// of at least 32 characters and a sign-in address. A Vercel preview that shares
// the live database has no address by design (see auth-url.ts).
export function signInConfigured(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.BETTER_AUTH_SECRET;
  return Boolean(secret && secret.length >= 32 && authOrigins(env).base);
}
