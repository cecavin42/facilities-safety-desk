// Settings for semantic search. The feature is off unless
// ASSISTANT_EMBEDDINGS_API_KEY is set. The names are this app's own, so a key
// that happens to be on a developer's machine is never picked up by a test
// run. Values are read here and never printed.
export const DEFAULT_EMBEDDINGS_MODEL = "voyage-4";
// Where Voyage AI's documentation sends a model API key made in MongoDB Atlas
// (read 2026-11-15). A key from the older Voyage AI platform needs
// ASSISTANT_EMBEDDINGS_BASE_URL=https://api.voyageai.com/v1.
const DEFAULT_BASE_URL = "https://ai.mongodb.com/v1";
// The local model answers on this machine only. The address is fixed.
export const OLLAMA_URL = "http://127.0.0.1:11434";
// How long one question may wait for its embedding before keyword search
// answers alone.
const DEFAULT_TIMEOUT_MS = 2500;

export type EmbeddingSettings =
  | { on: false; problems: string[] }
  | {
      on: true;
      problems: [];
      provider: "voyage" | "ollama";
      // Stored beside every vector. Vectors made by different models are
      // never compared with each other.
      id: string;
      model: string;
      apiKey: string;
      baseURL: string;
      timeoutMs: number;
    };

export function embeddingSettings(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingSettings {
  const problems: string[] = [];
  // A browser-visible setting would publish the key to every visitor.
  for (const name of Object.keys(env))
    if (/^NEXT_PUBLIC_.*(EMBEDDING|VOYAGE)/i.test(name) && env[name])
      problems.push(
        `${name} would be sent to every browser; remove it and use ASSISTANT_EMBEDDINGS_API_KEY`,
      );
  const apiKey = env.ASSISTANT_EMBEDDINGS_API_KEY?.trim() ?? "";
  // For measurements on a development computer: a model served by Ollama on
  // this machine. A key, when set, wins.
  const local = env.ASSISTANT_EMBEDDINGS_OLLAMA_MODEL?.trim() ?? "";
  if (!apiKey && !local) return { on: false, problems };

  let baseURL = DEFAULT_BASE_URL;
  const base = env.ASSISTANT_EMBEDDINGS_BASE_URL?.trim();
  if (apiKey && base) {
    try {
      const url = new URL(base);
      const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(
        url.hostname,
      );
      // Plain http would send the key unencrypted. Only a stand-in on this
      // machine may use it.
      if (url.protocol === "https:" || (url.protocol === "http:" && loopback))
        baseURL = url.toString().replace(/\/$/, "");
      else
        problems.push("ASSISTANT_EMBEDDINGS_BASE_URL must start with https://");
    } catch {
      problems.push("ASSISTANT_EMBEDDINGS_BASE_URL is not a valid URL");
    }
  }
  const model = apiKey
    ? env.ASSISTANT_EMBEDDINGS_MODEL?.trim() || DEFAULT_EMBEDDINGS_MODEL
    : local;
  if (!/^[a-z0-9][a-z0-9.:@_/-]{1,80}$/i.test(model))
    problems.push(
      `${apiKey ? "ASSISTANT_EMBEDDINGS_MODEL" : "ASSISTANT_EMBEDDINGS_OLLAMA_MODEL"} is not a model name`,
    );
  // A hosted site cannot reach a model on somebody's computer.
  if (!apiKey && env.VERCEL)
    problems.push(
      "ASSISTANT_EMBEDDINGS_OLLAMA_MODEL only works on a development computer; remove it here and use ASSISTANT_EMBEDDINGS_API_KEY",
    );
  const timeout = env.ASSISTANT_EMBEDDINGS_TIMEOUT_MS?.trim();
  const timeoutMs = timeout ? Number(timeout) : DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 300 || timeoutMs > 10_000)
    problems.push("ASSISTANT_EMBEDDINGS_TIMEOUT_MS must be 300 to 10000");
  if (problems.length) return { on: false, problems };
  return {
    on: true,
    problems: [],
    provider: apiKey ? "voyage" : "ollama",
    id: `${apiKey ? "voyage" : "ollama"}:${model}`,
    model,
    apiKey,
    baseURL: apiKey ? baseURL : OLLAMA_URL,
    timeoutMs,
  };
}
