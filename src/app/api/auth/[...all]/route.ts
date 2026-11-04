import { createHmac } from "node:crypto";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { failure, HttpError, json, readBody } from "@/lib/server-access";

const GET_ROUTES = new Set(["get-session", "list-sessions"]);
const POST_ROUTES = new Set([
  "sign-in/email",
  "sign-out",
  "change-password",
  "revoke-session",
  "revoke-sessions",
  "revoke-other-sessions",
]);
async function handle(request: Request) {
  const route = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
  if (!(request.method === "GET" ? GET_ROUTES : POST_ROUTES).has(route))
    return json({ error: "Not found." }, 404);
  try {
    let throttleKey: string | undefined;
    if (request.method === "POST") {
      const body = await readBody(request.clone(), 32_768);
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
