// Semantic search: ranking passages by how close their meaning is to the
// question's, using embeddings (one list of numbers per text, made by an
// embedding model). Nothing here talks to a network or a database. The
// provider and the stored vectors are passed in, so this file can be tested
// with a stand-in.
//
// The result only ever adds to keyword search (see retrieveCandidates in
// ../search.ts). Whenever it cannot be trusted for a question (no provider, a
// passage without a vector, a failed or slow call), semanticRanking returns
// undefined and the caller ranks by keywords exactly as before.
import { createHash } from "node:crypto";
import { sharesAWord, type SemanticRanking } from "../search";
import { eligiblePassages, type Catalog } from "../source-types";

export type EmbeddingKind = "query" | "document";
export type Embedded = { vectors: Float32Array[]; tokens: number };
export type EmbeddingProvider = {
  // Stored beside every vector this provider makes. Vectors made under
  // different ids are never compared with each other.
  id: string;
  embed(
    texts: string[],
    kind: EmbeddingKind,
    signal?: AbortSignal,
  ): Promise<Embedded>;
};

// A provider failure the caller can name without reading an error message.
export class EmbeddingError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

// Unit length, so the similarity of two vectors is a plain dot product.
// Undefined for anything that is not a usable vector.
export function unitVector(values: ArrayLike<number>): Float32Array | undefined {
  if (!values || !values.length) return undefined;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
    sum += v * v;
  }
  if (!sum) return undefined;
  const norm = Math.sqrt(sum);
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = values[i] / norm;
  return out;
}

export function similarity(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

// The fingerprint stored beside a vector: the exact text that was embedded.
export function textHash(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export type SemanticSearch = {
  provider: EmbeddingProvider;
  // How long one question may wait for its embedding.
  timeoutMs: number;
  // The stored vectors of this provider for the catalog's passages, by passage
  // id. A passage that has none, or whose text changed since, is left out.
  vectors(catalog: Catalog): Promise<Map<string, Float32Array>>;
};

// How many passages the ranking by meaning lists. The fusion in ../search.ts
// uses the first few; the rest are there for a caller that wants to look.
const MAX_RANKED = 32;
// A title line or a page footer on its own tells a reader nothing, however
// close its few words are to the question (the same floor as the passages
// sent to the model).
const MIN_PASSAGE_CHARS = 120;

const paused = new WeakMap<SemanticSearch, number>();
const remembered = new WeakMap<SemanticSearch, Map<string, Float32Array>>();
// After a failed call the provider is left alone for this long, so a provider
// that is down costs one question a short wait and not every question.
const PAUSE_MS = 30_000;

async function questionVector(
  question: string,
  search: SemanticSearch,
  signal?: AbortSignal,
): Promise<Float32Array | undefined> {
  let memory = remembered.get(search);
  if (!memory) remembered.set(search, (memory = new Map()));
  const hit = memory.get(question);
  if (hit) return hit;
  if ((paused.get(search) ?? 0) > Date.now()) return undefined;
  try {
    const limit = AbortSignal.timeout(search.timeoutMs);
    const { vectors } = await search.provider.embed(
      [question],
      "query",
      signal ? AbortSignal.any([signal, limit]) : limit,
    );
    const vector = vectors.length === 1 ? unitVector(vectors[0]) : undefined;
    if (!vector) throw new EmbeddingError("bad-response");
    memory.set(question, vector);
    if (memory.size > 200) memory.delete(memory.keys().next().value!);
    return vector;
  } catch (error) {
    // The person closing the page is not the provider's fault.
    if (!signal?.aborted) {
      paused.set(search, Date.now() + PAUSE_MS);
      console.warn(
        `[assistant] semantic search fell back to keywords: ${error instanceof EmbeddingError ? error.reason : "error"}`,
      );
    }
    return undefined;
  }
}

export async function semanticRanking(
  question: string,
  catalog: Catalog,
  search: SemanticSearch,
  signal?: AbortSignal,
): Promise<SemanticRanking | undefined> {
  const eligible = eligiblePassages(question, catalog);
  // A greeting, or a question none of whose words occur in the documents, is
  // not sent to the provider at all.
  if (!eligible.length || !sharesAWord(question, eligible)) return undefined;
  let vectors: Map<string, Float32Array>;
  try {
    vectors = await search.vectors(catalog);
  } catch {
    console.warn("[assistant] semantic search fell back to keywords: store");
    return undefined;
  }
  // One passage without a vector could never be found by meaning, and the
  // ranking would quietly favor the rest. Keyword search treats every passage
  // alike, so it answers alone until the index is complete.
  if (eligible.some((p) => !vectors.has(p.id))) return undefined;
  const vector = await questionVector(question, search, signal);
  if (!vector) return undefined;
  const scored: { id: string; similarity: number }[] = [];
  for (const passage of eligible) {
    const stored = vectors.get(passage.id)!;
    // Vectors of another size were made by another model.
    if (stored.length !== vector.length) return undefined;
    if (passage.text.length >= MIN_PASSAGE_CHARS)
      scored.push({ id: passage.id, similarity: similarity(vector, stored) });
  }
  return {
    model: search.provider.id,
    ids: scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, MAX_RANKED)
      .map((s) => s.id),
  };
}

// The text that is embedded for a passage.
export function passageText(text: string) {
  return text;
}

const STAND_IN_STOP = new Set(
  "a an and are as at be by do does for from how i if in is it me my of on or our that the their them then there these they this to us was we what when where which who why will with you your".split(
    " ",
  ),
);

// A deterministic stand-in for tests and local checks: no network, no model,
// nothing leaves the process. Each word of a text adds weight to one slot of a
// fixed-size vector, chosen by a hash of the word. Words listed together in
// sameMeaning share one slot and weigh three times as much, which is how a
// test says "these words mean the same thing, and it matters". It knows
// nothing else about meaning.
export function standInEmbeddings(
  sameMeaning: string[][] = [],
  dimensions = 256,
  id = "stand-in",
): EmbeddingProvider {
  const group = new Map<string, string>();
  for (const words of sameMeaning)
    for (const word of words)
      group.set(word.toLowerCase(), words[0].toLowerCase());
  const slot = (word: string) => {
    // FNV-1a, so the result is the same on every machine.
    let hash = 0x811c9dc5;
    for (let i = 0; i < word.length; i++) {
      hash ^= word.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0) % dimensions;
  };
  return {
    id,
    async embed(texts) {
      let tokens = 0;
      const vectors = texts.map((text) => {
        const values = new Float32Array(dimensions);
        const words = new Set(
          (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
            (w) => w.length > 1 && !STAND_IN_STOP.has(w),
          ),
        );
        tokens += words.size;
        for (const word of words) {
          const shared = group.get(word);
          values[slot(shared ?? word)] += shared ? 3 : 1;
        }
        // A text with no words still needs a direction of its own.
        if (!words.size) values[0] = 1;
        return unitVector(values)!;
      });
      return { vectors, tokens };
    },
  };
}

// A semantic search held in memory: every passage of the catalog embedded
// once with the given provider. For tests and local measurements.
export async function memorySearch(
  provider: EmbeddingProvider,
  catalog: Catalog,
  timeoutMs = 2500,
): Promise<SemanticSearch> {
  const { vectors } = await provider.embed(
    catalog.passages.map((p) => passageText(p.text)),
    "document",
  );
  const stored = new Map(catalog.passages.map((p, i) => [p.id, vectors[i]]));
  return { provider, timeoutMs, vectors: async () => stored };
}
