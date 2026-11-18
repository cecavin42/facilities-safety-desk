// Where passage embeddings are kept (table passage_embeddings, migration 009)
// and how they are made. The vectors are ordinary arrays of real numbers in
// PostgreSQL; the app loads them once and compares them in memory. Functions
// here take the database as an argument, so the command-line indexer and the
// running app share them.
import type { Pool } from "pg";
import {
  EmbeddingError,
  passageText,
  textHash,
  unitVector,
  type EmbeddingProvider,
  type SemanticSearch,
} from "./semantic";

type Db = Pick<Pool, "query">;
export type IndexedPassage = { id: string; text: string };

// Small enough for every provider's limit on one request (Voyage: 1,000 texts
// and 120,000 tokens for its largest model; a passage is at most 1,600
// characters).
const BATCH = 64;
const SMALLEST_BATCH = 4;
// Failures worth a second try: the provider was busy or the line dropped.
const RETRYABLE = new Set(["rate-limit", "server", "timeout", "network"]);

// The fingerprints of the texts that already have a vector, by passage id.
export async function storedHashes(db: Db, model: string, versionId: string) {
  const { rows } = await db.query(
    "SELECT passage_id, text_hash FROM passage_embeddings WHERE model = $1 AND version_id = $2::uuid",
    [model, versionId],
  );
  return new Map<string, string>(
    rows.map((row) => [row.passage_id, row.text_hash]),
  );
}

async function storedVectors(db: Db, model: string, versionIds: string[]) {
  const found = new Map<
    string,
    Map<string, { hash: string; vector: Float32Array }>
  >();
  if (!versionIds.length) return found;
  const { rows } = await db.query(
    "SELECT version_id, passage_id, text_hash, embedding FROM passage_embeddings WHERE model = $1 AND version_id = ANY($2::uuid[])",
    [model, versionIds],
  );
  for (const row of rows) {
    const vector = unitVector(row.embedding as number[]);
    if (!vector) continue;
    let version = found.get(row.version_id);
    if (!version) found.set(row.version_id, (version = new Map()));
    version.set(row.passage_id, { hash: row.text_hash, vector });
  }
  return found;
}

async function saveVectors(
  db: Db,
  model: string,
  versionId: string,
  rows: { passageId: string; hash: string; vector: Float32Array }[],
) {
  if (!rows.length) return;
  await db.query(
    `INSERT INTO passage_embeddings(version_id, passage_id, model, dimensions, text_hash, embedding)
     SELECT $1::uuid, x.passage_id, $2, $3, x.text_hash,
       ARRAY(SELECT e.value::real FROM jsonb_array_elements_text(x.embedding) WITH ORDINALITY AS e(value, place) ORDER BY e.place)
     FROM jsonb_to_recordset($4::jsonb) AS x(passage_id text, text_hash text, embedding jsonb)
     ON CONFLICT (version_id, passage_id, model) DO UPDATE
       SET dimensions = EXCLUDED.dimensions, text_hash = EXCLUDED.text_hash,
           embedding = EXCLUDED.embedding, created_at = now()`,
    [
      versionId,
      model,
      rows[0].vector.length,
      JSON.stringify(
        rows.map((r) => ({
          passage_id: r.passageId,
          text_hash: r.hash,
          // Nine significant digits carry a 32-bit number exactly.
          embedding: Array.from(r.vector, (v) => Number(v.toPrecision(9))),
        })),
      ),
    ],
  );
}

export type IndexResult = {
  passages: number;
  // Had a current vector before this run.
  already: number;
  embedded: number;
  tokens: number;
  // Why the run stopped early, when it did. Nothing made so far is lost.
  stopped?: string;
};

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

// Embeds the passages of one source version that have no current vector and
// stores them. Safe to repeat: a passage that is already indexed is skipped.
// A provider or database failure never throws; the result says why the run
// stopped.
export async function indexVersion(
  db: Db,
  provider: EmbeddingProvider,
  versionId: string,
  passages: IndexedPassage[],
  options: {
    // Stops the run when it fires (a time limit, or the caller leaving).
    signal?: AbortSignal;
    // How many times one batch is tried again after a busy or dropped call.
    retries?: number;
    // Time allowed for one request.
    requestMs?: number;
  } = {},
): Promise<IndexResult> {
  const { signal, retries = 0, requestMs = 30_000 } = options;
  const texts = passages.map((p) => ({
    id: p.id,
    text: passageText(p.text),
    hash: textHash(passageText(p.text)),
  }));
  const result: IndexResult = {
    passages: passages.length,
    already: 0,
    embedded: 0,
    tokens: 0,
  };
  let stored: Map<string, string>;
  try {
    stored = await storedHashes(db, provider.id, versionId);
  } catch {
    return { ...result, stopped: "store" };
  }
  const todo = texts.filter((t) => stored.get(t.id) !== t.hash);
  result.already = passages.length - todo.length;
  let size = BATCH;
  let failures = 0;
  for (let at = 0; at < todo.length; ) {
    if (signal?.aborted) {
      result.stopped = "out-of-time";
      break;
    }
    const batch = todo.slice(at, at + size);
    try {
      const limit = AbortSignal.timeout(requestMs);
      const { vectors, tokens } = await provider.embed(
        batch.map((t) => t.text),
        "document",
        signal ? AbortSignal.any([signal, limit]) : limit,
      );
      if (vectors.length !== batch.length)
        throw new EmbeddingError("bad-response");
      await saveVectors(
        db,
        provider.id,
        versionId,
        batch.map((t, i) => ({
          passageId: t.id,
          hash: t.hash,
          vector: vectors[i],
        })),
      );
      result.embedded += batch.length;
      result.tokens += tokens;
      at += batch.length;
      failures = 0;
    } catch (error) {
      const reason = error instanceof EmbeddingError ? error.reason : "store";
      if (signal?.aborted) {
        result.stopped = "out-of-time";
        break;
      }
      if (!RETRYABLE.has(reason) || failures >= retries) {
        result.stopped = reason;
        break;
      }
      failures++;
      // A provider that says "too much at once" gets smaller requests.
      if (reason === "rate-limit")
        size = Math.max(SMALLEST_BATCH, Math.floor(size / 2));
      await wait(Math.min(60_000, 1000 * 2 ** (failures - 1)), signal);
    }
  }
  return result;
}

// A version whose index was incomplete is looked at again after this long, so
// a run of the indexer is picked up without a restart.
const RECHECK_MS = 60_000;

// The semantic search the running app uses: stored vectors, kept in memory
// per source version. A version's passages never change, so a complete
// version is read from the database once.
export function storedSearch(
  // A function, when the database should not be opened before it is needed.
  db: Db | (() => Db),
  provider: EmbeddingProvider,
  timeoutMs: number,
): SemanticSearch {
  const versions = new Map<
    string,
    { complete: boolean; checkedAt: number; vectors: Map<string, Float32Array> }
  >();
  let merged:
    | { catalog: string; vectors: Map<string, Float32Array> }
    | undefined;
  return {
    provider,
    timeoutMs,
    async vectors(catalog) {
      if (merged?.catalog === catalog.version) return merged.vectors;
      const byVersion = new Map<string, IndexedPassage[]>();
      for (const document of catalog.documents)
        if (document.versionId) byVersion.set(document.versionId, []);
      const versionOf = new Map(
        catalog.documents.map((d) => [d.id, d.versionId]),
      );
      for (const passage of catalog.passages)
        byVersion.get(versionOf.get(passage.docId) ?? "")?.push(passage);
      const now = Date.now();
      const wanted = [...byVersion.keys()].filter((id) => {
        const known = versions.get(id);
        return !known || (!known.complete && now - known.checkedAt > RECHECK_MS);
      });
      if (wanted.length) {
        const stored = await storedVectors(
          typeof db === "function" ? db() : db,
          provider.id,
          wanted,
        );
        for (const id of wanted) {
          const rows = stored.get(id);
          const vectors = new Map<string, Float32Array>();
          for (const passage of byVersion.get(id)!) {
            const row = rows?.get(passage.id);
            // A vector made from other text than the passage now holds is
            // not this passage's vector.
            if (row && row.hash === textHash(passageText(passage.text)))
              vectors.set(passage.id, row.vector);
          }
          versions.set(id, {
            complete: vectors.size === byVersion.get(id)!.length,
            checkedAt: now,
            vectors,
          });
        }
      }
      for (const id of versions.keys())
        if (!byVersion.has(id)) versions.delete(id);
      const all = new Map<string, Float32Array>();
      for (const id of byVersion.keys())
        for (const [passageId, vector] of versions.get(id)!.vectors)
          all.set(passageId, vector);
      // Kept only when complete: an unfinished index is looked at again.
      merged =
        all.size === catalog.passages.length
          ? { catalog: catalog.version, vectors: all }
          : undefined;
      return all;
    },
  };
}
