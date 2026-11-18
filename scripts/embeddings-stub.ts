// A local stand-in for the embeddings API, for development only. It lets
// semantic search run on one machine with no key, no cost and no document text
// leaving it. It answers POST /embeddings in the shape of Voyage AI's
// embeddings endpoint.
//
// It is not a model. Each word of a text adds weight to one slot of the
// vector; the only "meanings" it knows are the word groups it is given (see
// standInEmbeddings in src/lib/assistant/semantic.ts). It answers only for the
// model name "stand-in", so its vectors can never be stored under a real
// model's name.
//
//   npm run embeddings:stub
//   ASSISTANT_EMBEDDINGS_API_KEY=local-stand-in-not-a-real-key
//   ASSISTANT_EMBEDDINGS_BASE_URL=http://127.0.0.1:3996
//   ASSISTANT_EMBEDDINGS_MODEL=stand-in
import { createServer, type IncomingMessage } from "node:http";
import { pathToFileURL } from "node:url";
import { standInEmbeddings } from "../src/lib/assistant/semantic";

export const EMBEDDINGS_STUB_PORT = 3996;
export const EMBEDDINGS_STUB_KEY = "local-stand-in-not-a-real-key";
export const EMBEDDINGS_STUB_MODEL = "stand-in";
export type EmbeddingsStubMode = "answer" | "error" | "busy" | "slow";
export type EmbeddingsStubRequest = {
  headers: IncomingMessage["headers"];
  body: Record<string, unknown>;
};

export async function startEmbeddingsStub(port = EMBEDDINGS_STUB_PORT) {
  const requests: EmbeddingsStubRequest[] = [];
  const state = {
    mode: "answer" as EmbeddingsStubMode,
    delayMs: 8000,
    // Word groups the stand-in treats as meaning the same.
    sameMeaning: [] as string[][],
  };
  const server = createServer(async (request, response) => {
    const send = (status: number, value: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
    };
    if (request.method !== "POST" || request.url !== "/embeddings")
      return send(404, { detail: "The stand-in serves /embeddings." });
    let raw = "";
    for await (const chunk of request) raw += chunk;
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return send(400, { detail: "The body is not JSON." });
    }
    requests.push({ headers: request.headers, body });
    if (request.headers.authorization !== `Bearer ${EMBEDDINGS_STUB_KEY}`)
      return send(401, { detail: "invalid api key" });
    const input = Array.isArray(body.input) ? body.input : [body.input];
    if (
      body.model !== EMBEDDINGS_STUB_MODEL ||
      !input.length ||
      input.some((text) => typeof text !== "string" || !text) ||
      !["query", "document"].includes(body.input_type as string)
    )
      return send(400, {
        detail: `The stand-in answers for model "${EMBEDDINGS_STUB_MODEL}", with texts and an input_type.`,
      });
    const mode = state.mode;
    if (mode === "error")
      return send(500, { detail: "The stand-in was told to fail." });
    if (mode === "busy")
      return send(429, { detail: "The stand-in was told to be busy." });
    if (mode === "slow") await new Promise((r) => setTimeout(r, state.delayMs));
    const { vectors, tokens } = await standInEmbeddings(
      state.sameMeaning,
    ).embed(input as string[], body.input_type as "query" | "document");
    send(200, {
      object: "list",
      data: vectors.map((vector, index) => ({
        object: "embedding",
        embedding: Array.from(vector),
        index,
      })),
      model: body.model,
      usage: { total_tokens: tokens },
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
  startEmbeddingsStub().then(
    () =>
      console.log(
        `Embeddings stand-in listening on http://127.0.0.1:${EMBEDDINGS_STUB_PORT}. It hashes words into a vector; it is not a model. Stop it with Ctrl+C.`,
      ),
    (error) => {
      console.error(
        error?.code === "EADDRINUSE"
          ? `Port ${EMBEDDINGS_STUB_PORT} is in use. Is the stand-in already running?`
          : "The stand-in could not start.",
      );
      process.exitCode = 1;
    },
  );
