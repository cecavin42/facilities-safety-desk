import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import type { Pool } from "pg";

export function authOptions(pool: Pool) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
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
    trustedOrigins: [url.origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 15,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 8,
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
    plugins: [admin()],
    logger: { disabled: true },
    telemetry: { enabled: false },
  };
}
export function createAuth(pool: Pool) {
  return betterAuth(authOptions(pool));
}
