import { answerQuestion } from "@/lib/assistant/service";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return fail("Cross-site requests are not allowed.", 403);
  if (origin) {
    try { if (new URL(origin).host !== (request.headers.get("host") ?? new URL(request.url).host)) return fail("Cross-site requests are not allowed.", 403); }
    catch { return fail("Invalid request origin.", 403); }
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return fail("Send JSON data.", 415);
  if (Number(request.headers.get("content-length")) > 4096) return fail("Question request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) return fail("Enter a question.", 400);
  let body: unknown;
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 4096) { await reader.cancel(); return fail("Question request is too large.", 413); }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return fail("Request body must be valid JSON.", 400); }
  finally { reader.releaseLock(); }
  const question = body && typeof body === "object" && "question" in body && typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 500) return fail("Please enter a question of 1 to 500 characters.", 400);
  return Response.json(await answerQuestion(question, request.signal), { headers });
}
