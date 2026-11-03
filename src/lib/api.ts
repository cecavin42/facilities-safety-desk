export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// Existing app is a public fictional-data demo. This is a CSRF guard, not sign-in.
export async function readJson(request: Request) {
  const origin = request.headers.get("origin");
  // Next.js can use its internal hostname in request.url behind a proxy.
  // The browser's Origin must match the incoming HTTP Host instead.
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (origin) {
    let matches = false;
    try { const url = new URL(origin); matches = ["http:", "https:"].includes(url.protocol) && url.host === host; } catch {}
    if (!matches) throw new RequestError("Cross-site changes are not allowed.", 403);
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new RequestError("Cross-site changes are not allowed.", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new RequestError("Send JSON data.", 415);
  }
  const limit = 3_500_000;
  if (Number(request.headers.get("content-length")) > limit) throw new RequestError("Request is too large. Import a smaller file.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("Request body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); throw new RequestError("Request is too large. Import a smaller file.", 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("Request body must be valid JSON.");
  } finally { reader.releaseLock(); }
}

export function failure(error: unknown) {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Database operation failed.");
  return Response.json({ error: "Shared storage is unavailable. Your changes have not been confirmed. Keep this page open and retry." }, { status: 503 });
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
