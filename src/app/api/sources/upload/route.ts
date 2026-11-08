import {
  requireFreshAdmin,
  json,
  failure,
  HttpError,
} from "@/lib/server-access";
import { authOrigins } from "@/lib/auth-url";
import { createSource } from "@/lib/sources";
export async function POST(request: Request) {
  try {
    const user = await requireFreshAdmin(request);
    const origin = request.headers.get("origin");
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && !authOrigins().trusted.includes(origin))
    )
      throw new HttpError("Cross-site uploads are not allowed.", 403);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
      throw new HttpError("Choose a source file.", 415);
    const limit = 5_100_000;
    if (Number(request.headers.get("content-length")) > limit)
      throw new HttpError("File is too large.", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError("File required.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > limit) {
          await reader.cancel();
          throw new HttpError("File is too large.", 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const data = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: Buffer.concat(chunks),
    }).formData();
    const file = data.get("file");
    if (!(file instanceof File)) throw new HttpError("Choose a source file.");
    const fields: Record<string, string> = {};
    for (const key of [
      "title",
      "publisher",
      "revision",
      "sourceUrl",
      "scope",
      "credit",
      "documentId",
    ]) {
      const value = data.get(key);
      fields[key] = typeof value === "string" ? value : "";
    }
    return json(await createSource(user.id, fields, file), 201);
  } catch (error) {
    return failure(error);
  }
}
