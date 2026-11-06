import { createHmac } from "node:crypto";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import {
  failure,
  HttpError,
  json,
  readBody,
  requireFreshUser,
  requireUser,
} from "@/lib/server-access";

const GET_ROUTES = new Set(["get-session", "list-sessions"]);
const POST_ROUTES = new Set([
  "sign-in/email",
  "sign-out",
  "change-password",
  "revoke-session",
  "revoke-sessions",
  "revoke-other-sessions",
  "two-factor/enable",
  "two-factor/disable",
  "two-factor/verify-totp",
  "two-factor/verify-backup-code",
]);
async function handle(request: Request) {
  const route = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
  if (!(request.method === "GET" ? GET_ROUTES : POST_ROUTES).has(route))
    return json({ error: "Not found." }, 404);
  try {
    if (
      request.method === "GET" ||
      [
        "change-password",
        "revoke-session",
        "revoke-sessions",
        "revoke-other-sessions",
      ].includes(route)
    )
      await requireUser(request);
    let throttleKey: string | undefined;
    let enrollmentUserId: string | undefined;
    let securityUserId: string | undefined;
    if (request.method === "POST") {
      const body = await readBody(request.clone(), 32_768);
      if (route.startsWith("two-factor/") && body.trustDevice === true)
        throw new HttpError(
          "This prototype requires a second factor for each sign-in.",
        );
      if (route === "two-factor/enable" || route === "two-factor/disable")
        securityUserId = (await requireFreshUser(request)).id;
      if (route === "two-factor/verify-totp") {
        const prior = await auth().api.getSession({
          headers: request.headers,
          query: { disableCookieCache: true },
        });
        if (prior) {
          const {
            rows: [current],
          } = await database().query(
            'SELECT "twoFactorEnabled" FROM "user" WHERE id=$1',
            [prior.user.id],
          );
          if (!current?.twoFactorEnabled) enrollmentUserId = prior.user.id;
        }
      }
      if (route === "sign-in/email") {
        const email =
          typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        throttleKey = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
          .update(email)
          .digest("hex");
        const {
          rows: [attempt],
        } = await database().query(
          `INSERT INTO auth_attempts (key, attempts, resets_at) VALUES ($1,1,now()+interval '15 minutes')
          ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN auth_attempts.resets_at < now() THEN 1 ELSE auth_attempts.attempts+1 END,
          resets_at=CASE WHEN auth_attempts.resets_at < now() THEN now()+interval '15 minutes' ELSE auth_attempts.resets_at END RETURNING attempts`,
          [throttleKey],
        );
        if (attempt.attempts > 10)
          throw new HttpError(
            "Too many sign-in attempts. Try again in 15 minutes.",
            429,
          );
      }
    }
    const response = await auth().handler(request);
    if (
      response.ok &&
      (route === "two-factor/verify-totp" ||
        route === "two-factor/verify-backup-code" ||
        (route === "two-factor/disable" && securityUserId))
    ) {
      const pairs = new Map(
        (request.headers.get("cookie") || "")
          .split(";")
          .filter(Boolean)
          .map((pair) => {
            const i = pair.indexOf("=");
            return [pair.slice(0, i).trim(), pair.slice(i + 1)] as [
              string,
              string,
            ];
          }),
      );
      for (const value of response.headers.getSetCookie()) {
        const pair = value.split(";", 1)[0];
        const i = pair.indexOf("=");
        if (pair.slice(i + 1)) pairs.set(pair.slice(0, i), pair.slice(i + 1));
        else pairs.delete(pair.slice(0, i));
      }
      const updatedHeaders = new Headers(request.headers);
      updatedHeaders.set(
        "cookie",
        [...pairs].map(([k, v]) => `${k}=${v}`).join("; "),
      );
      let keepId: string | undefined;
      let userId = enrollmentUserId || securityUserId;
      try {
        const current = await auth().api.getSession({
          headers: updatedHeaders,
          query: { disableCookieCache: true },
        });
        if (current && (!userId || current.user.id === userId)) {
          userId = current.user.id;
          keepId = current.session.id;
          if (route !== "two-factor/disable")
            await database().query(
              'UPDATE "session" SET mfa_verified=true WHERE id=$1 AND "userId"=$2',
              [keepId, userId],
            );
        }
      } finally {
        if ((enrollmentUserId || securityUserId) && keepId)
          await database().query(
            'DELETE FROM "session" WHERE "userId"=$1 AND id<>$2',
            [userId, keepId],
          );
        else if (enrollmentUserId || securityUserId)
          await database().query('DELETE FROM "session" WHERE "userId"=$1', [
            userId,
          ]);
      }
      if (enrollmentUserId || securityUserId)
        await database().query(
          "INSERT INTO audit_log(actor_id,action,target_id) VALUES($1,$2,$1)",
          [
            userId,
            enrollmentUserId ? "account.mfa_enabled" : "account.mfa_disabled",
          ],
        );
    }
    if (throttleKey && response.ok)
      await database().query("DELETE FROM auth_attempts WHERE key=$1", [
        throttleKey,
      ]);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const response = failure(error);
    if (error instanceof HttpError && error.status === 429)
      response.headers.set("Retry-After", "900");
    return response;
  }
}
export const GET = handle;
export const POST = handle;
