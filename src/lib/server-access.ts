import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";
import { authOrigins } from "./auth-url";
import { database } from "./database";
import type { CurrentUser } from "./access";

export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function currentUser(
  requestHeaders: Headers,
): Promise<CurrentUser | null> {
  if (!requestHeaders.get("cookie")) return null;
  const session = await auth().api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });
  if (!session) return null;
  const {
    rows: [user],
  } = await database().query(
    'SELECT u.id, u.name, u.email, u.role, u.banned, u."twoFactorEnabled", s.mfa_verified FROM "user" u JOIN "session" s ON s."userId"=u.id WHERE u.id=$1 AND s.id=$2',
    [session.user.id, session.session.id],
  );
  if (!user || user.banned || !["user", "admin"].includes(user.role))
    return null;
  // A password-only session is never sufficient after MFA is enabled.
  if (user.twoFactorEnabled && !user.mfa_verified) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
export async function pageUser() {
  return currentUser(await headers());
}
export async function requireUser(request: Request, adminOnly = false) {
  const user = await currentUser(request.headers);
  if (!user) throw new HttpError("Sign in to continue.", 401);
  if (adminOnly && user.role !== "admin")
    throw new HttpError(
      "This action requires a safety manager or administrator.",
      403,
    );
  return user;
}
export async function requireFreshAdmin(request: Request) {
  const user = await requireUser(request, true);
  const session = await auth().api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (
    !session ||
    Date.now() - new Date(session.session.createdAt).getTime() > 15 * 60_000
  )
    throw new HttpError(
      "Sign out and sign in again before changing account access.",
      403,
    );
  return user;
}
export async function requireFreshUser(request: Request) {
  const user = await requireUser(request);
  const session = await auth().api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (
    !session ||
    Date.now() - new Date(session.session.createdAt).getTime() > 15 * 60_000
  )
    throw new HttpError(
      "Sign out and sign in again before changing authenticator settings.",
      403,
    );
  return user;
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  return error instanceof HttpError
    ? json({ error: error.message }, error.status)
    : json(
        {
          error:
            "The service is unavailable. No change has been confirmed. Please retry.",
        },
        503,
      );
}
export async function readBody(
  request: Request,
  limit = 3_500_000,
): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && !authOrigins().trusted.includes(origin))
  )
    throw new HttpError("Cross-site requests are not allowed.", 403);
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new HttpError("Send JSON data.", 415);
  if (Number(request.headers.get("content-length")) > limit)
    throw new HttpError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("Request body is required.");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError("Request is too large.", 413);
      }
      parts.push(value);
    }
    const body: unknown = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError("Request body must be a JSON object.");
  } finally {
    reader.releaseLock();
  }
}
