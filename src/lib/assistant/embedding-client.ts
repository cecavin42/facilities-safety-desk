import "server-only";
import {
  embeddingSettings,
  type EmbeddingSettings,
} from "./embedding-settings";
import {
  EmbeddingError,
  unitVector,
  type Embedded,
  type EmbeddingKind,
  type EmbeddingProvider,
} from "./semantic";

type On = Extract<EmbeddingSettings, { on: true }>;

// Shared by both providers: one POST, a JSON reply, and a named reason for
// every failure. The reply's text is never read into an error or logged, and
// neither is the key.
async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal,
      // A redirect could carry the key to another host.
      redirect: "error",
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError") throw new EmbeddingError("timeout");
    if (name === "AbortError") throw new EmbeddingError("aborted");
    throw new EmbeddingError("network");
  }
  if (!response.ok) {
    // Free the connection without keeping what the provider said.
    await response.body?.cancel().catch(() => {});
    const status = response.status;
    throw new EmbeddingError(
      status === 401 || status === 403
        ? "auth"
        : status === 404
          ? "model-not-found"
          : status === 429
            ? "rate-limit"
            : status >= 500
              ? "server"
              : "bad-request",
    );
  }
  try {
    return await response.json();
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError") throw new EmbeddingError("timeout");
    if (name === "AbortError") throw new EmbeddingError("aborted");
    throw new EmbeddingError("bad-response");
  }
}

// One vector per text, in the order asked, all the same length.
function vectorsOf(lists: unknown, expected: number): Float32Array[] {
  if (!Array.isArray(lists) || lists.length !== expected)
    throw new EmbeddingError("bad-response");
  const vectors = lists.map((list) =>
    Array.isArray(list) ? unitVector(list as number[]) : undefined,
  );
  if (
    vectors.some((v) => !v || v.length < 8 || v.length !== vectors[0]!.length)
  )
    throw new EmbeddingError("bad-response");
  return vectors as Float32Array[];
}

// Voyage AI's embeddings endpoint, as documented for a model API key from
// MongoDB Atlas (POST {base}/embeddings; read 2026-11-15). input_type tells
// the model whether a text is a question or a passage; Voyage's documentation
// says to always set it for retrieval.
export function voyageProvider(settings: On): EmbeddingProvider {
  return {
    id: settings.id,
    async embed(texts, kind, signal): Promise<Embedded> {
      const reply = (await postJson(
        `${settings.baseURL}/embeddings`,
        { Authorization: `Bearer ${settings.apiKey}` },
        {
          input: texts,
          model: settings.model,
          input_type: kind,
          // A text that is too long is an error, never silently shortened.
          truncation: false,
        },
        signal,
      )) as {
        data?: { embedding?: unknown; index?: unknown }[];
        usage?: { total_tokens?: unknown };
      } | null;
      if (!reply || !Array.isArray(reply.data))
        throw new EmbeddingError("bad-response");
      const ordered = [...reply.data].sort(
        (a, b) => Number(a?.index) - Number(b?.index),
      );
      if (ordered.some((item, i) => item?.index !== i))
        throw new EmbeddingError("bad-response");
      return {
        vectors: vectorsOf(
          ordered.map((item) => item.embedding),
          texts.length,
        ),
        tokens:
          typeof reply.usage?.total_tokens === "number"
            ? reply.usage.total_tokens
            : 0,
      };
    },
  };
}

// What each local model family expects in front of a question (from the
// models' own cards). A family that is not listed gets the plain text.
const LOCAL_PROMPTS: [RegExp, Record<EmbeddingKind, string>][] = [
  [
    /^nomic-embed-text/,
    { query: "search_query: ", document: "search_document: " },
  ],
  [
    /^mxbai-embed-large/,
    {
      query: "Represent this sentence for searching relevant passages: ",
      document: "",
    },
  ],
  [
    /^qwen3-embedding/,
    {
      query:
        "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery:",
      document: "",
    },
  ],
];

// Development only: a model served by Ollama on this machine, for measuring
// retrieval without a key and without any text leaving the computer. Fixed
// loopback address, no automatic downloads. It cannot run on a hosted site.
export function ollamaProvider(settings: On): EmbeddingProvider {
  const prompts = LOCAL_PROMPTS.find(([family]) =>
    family.test(settings.model),
  )?.[1] ?? { query: "", document: "" };
  return {
    id: settings.id,
    async embed(texts, kind, signal): Promise<Embedded> {
      const reply = (await postJson(
        `${settings.baseURL}/api/embed`,
        {},
        {
          model: settings.model,
          input: texts.map((text) => prompts[kind] + text),
          // A local model with a short context reads the start of a long
          // passage. Good enough for a measurement; the hosted provider never
          // shortens a text.
          truncate: true,
          keep_alive: "15m",
        },
        signal,
      )) as { embeddings?: unknown; prompt_eval_count?: unknown } | null;
      return {
        vectors: vectorsOf(reply?.embeddings, texts.length),
        tokens:
          typeof reply?.prompt_eval_count === "number"
            ? reply.prompt_eval_count
            : 0,
      };
    },
  };
}

let cached: { key: string; provider: EmbeddingProvider } | undefined;

// The provider the running app uses, or null when the feature is off.
export function configuredProvider(
  env: NodeJS.ProcessEnv = process.env,
): { provider: EmbeddingProvider; timeoutMs: number } | null {
  const settings = embeddingSettings(env);
  if (!settings.on) return null;
  const key = [
    settings.provider,
    settings.apiKey,
    settings.baseURL,
    settings.model,
  ].join("\0");
  if (cached?.key !== key)
    cached = {
      key,
      provider:
        settings.provider === "voyage"
          ? voyageProvider(settings)
          : ollamaProvider(settings),
    };
  return { provider: cached.provider, timeoutMs: settings.timeoutMs };
}
