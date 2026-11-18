import "server-only";
import { database } from "../database";
import { configuredProvider } from "./embedding-client";
import { storedSearch } from "./embedding-store";
import type { EmbeddingProvider, SemanticSearch } from "./semantic";

// One search for the whole server process, however the framework splits the
// code between pages and routes: the vectors are held in memory once, and a
// provider that just failed is left alone by every caller.
const state = globalThis as typeof globalThis & {
  safetyDeskSemantic?: {
    provider: EmbeddingProvider;
    timeoutMs: number;
    search: SemanticSearch;
  };
};

// The semantic search the running app uses, or null when the feature is off
// (no embeddings key). The database is not touched until the first question
// that needs it.
export function configuredSemantic(
  env: NodeJS.ProcessEnv = process.env,
): SemanticSearch | null {
  const configured = configuredProvider(env);
  if (!configured) return null;
  const held = state.safetyDeskSemantic;
  // The provider's id names the model. Compared by name, not by object: each
  // part of the server may hold its own copy of the provider.
  if (
    held?.provider.id !== configured.provider.id ||
    held.timeoutMs !== configured.timeoutMs
  )
    state.safetyDeskSemantic = {
      ...configured,
      search: storedSearch(
        () => database(),
        configured.provider,
        configured.timeoutMs,
      ),
    };
  return state.safetyDeskSemantic!.search;
}
