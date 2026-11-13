// A local stand-in for the Claude Messages API, for development only. It lets
// the whole model-written path run on one machine with no key, no cost and no
// document text leaving it. It answers POST /v1/messages the way the real API
// answers a structured-output request: one text block holding JSON.
//
// It does not think. By default it copies the first sentence of the first
// passage it was sent. The other modes return the faults the app must survive.
//
//   npm run claude:stub
//   ASSISTANT_CLAUDE_API_KEY=local-stand-in-not-a-real-key
//   ASSISTANT_CLAUDE_BASE_URL=http://127.0.0.1:3997
import { createServer, type IncomingMessage } from "node:http";
import { pathToFileURL } from "node:url";

export const STUB_PORT = 3997;
export const STUB_KEY = "local-stand-in-not-a-real-key";
export type StubMode =
  | "answer"
  | "partial"
  | "none"
  | "invent"
  | "badcite"
  | "text"
  | "refuse"
  | "error"
  | "slow";
export type StubRequest = {
  headers: IncomingMessage["headers"];
  body: Record<string, unknown>;
};

function firstSentence(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  const end = flat.search(/(?<=[.!?])\s/);
  return (end > 0 ? flat.slice(0, end) : flat).slice(0, 400);
}

function reply(mode: StubMode, user: string) {
  const passages = [
    ...user.matchAll(
      /<passage tag="(P\d)" document="([^"]*)"[^>]*>\n([\s\S]*?)\n<\/passage>/g,
    ),
  ].map((m) => ({ tag: m[1], document: m[2], text: m[3] }));
  const first = passages[0];
  const point = (p: typeof first, text = firstSentence(p.text)) => ({
    heading: p.document.slice(0, 80) || "From the document",
    text,
    cites: [p.tag],
  });
  if (mode === "text") return "Here is what I found in the passages.";
  if (mode === "none" || !first)
    return JSON.stringify({ supported: "none", points: [], not_covered: "" });
  if (mode === "invent")
    return JSON.stringify({
      supported: "full",
      points: [point(first, "This must be done within 97 days.")],
      not_covered: "",
    });
  if (mode === "badcite")
    return JSON.stringify({
      supported: "full",
      points: [{ ...point(first), cites: ["P9"] }],
      not_covered: "",
    });
  return JSON.stringify({
    supported: mode === "partial" ? "partial" : "full",
    points: [point(first)],
    not_covered: mode === "partial" ? "the rest of the question" : "",
  });
}

export async function startClaudeStub(port = STUB_PORT) {
  const requests: StubRequest[] = [];
  const state = { mode: "answer" as StubMode, delayMs: 6000 };
  const server = createServer(async (request, response) => {
    const send = (status: number, value: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
    };
    const fault = (status: number, type: string, message: string) =>
      send(status, { type: "error", error: { type, message } });
    if (request.method !== "POST" || request.url !== "/v1/messages")
      return fault(404, "not_found_error", "The stand-in serves /v1/messages.");
    let raw = "";
    for await (const chunk of request) raw += chunk;
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return fault(400, "invalid_request_error", "The body is not JSON.");
    }
    requests.push({ headers: request.headers, body });
    // Current SDKs send the key as a bearer token; older ones as x-api-key.
    if (
      request.headers.authorization !== `Bearer ${STUB_KEY}` &&
      request.headers["x-api-key"] !== STUB_KEY
    )
      return fault(401, "authentication_error", "invalid api key");
    const messages = body.messages as { content?: unknown }[] | undefined;
    const user =
      typeof messages?.[0]?.content === "string" ? messages[0].content : "";
    const mode = state.mode;
    if (mode === "error")
      return fault(500, "api_error", "The stand-in was told to fail.");
    if (mode === "slow") await new Promise((r) => setTimeout(r, state.delayMs));
    const text = mode === "refuse" ? "" : reply(mode, user);
    send(200, {
      id: `msg_stand_in_${requests.length}`,
      type: "message",
      role: "assistant",
      model: body.model,
      content: text ? [{ type: "text", text }] : [],
      stop_reason: mode === "refuse" ? "refusal" : "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: Math.ceil(raw.length / 4),
        output_tokens: Math.ceil(text.length / 4),
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    // Loopback only: nothing off this machine can reach it.
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    requests,
    state,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  startClaudeStub().then(
    () =>
      console.log(
        `Claude stand-in listening on http://127.0.0.1:${STUB_PORT}. It copies sentences from the passages it is sent; it is not a model. Stop it with Ctrl+C.`,
      ),
    (error) => {
      console.error(
        error?.code === "EADDRINUSE"
          ? `Port ${STUB_PORT} is in use. Is the stand-in already running?`
          : "The stand-in could not start.",
      );
      process.exitCode = 1;
    },
  );
