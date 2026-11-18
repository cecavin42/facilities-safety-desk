// Makes the embeddings semantic search needs, for source versions that are
// already in the database. New uploads are embedded when they are uploaded;
// this command covers what was there before, and anything a failed call left
// behind. Safe to repeat: a passage that already has a current embedding is
// skipped, and nothing is ever deleted.
//
//   npm run embeddings:index               every version that is not retired
//   npm run embeddings:index -- --all      retired versions too
//   npm run embeddings:index -- --status   counts only; nothing is embedded
//   npm run embeddings:index -- --build    the form the Vercel build runs
//
// It sends passage text to the embeddings provider, so it does nothing unless
// ASSISTANT_EMBEDDINGS_API_KEY is set (or, on a development computer,
// ASSISTANT_EMBEDDINGS_OLLAMA_MODEL). Setting values are never printed.
//
// --build: one summary line, no document titles, at most four minutes, and it
// never fails the build. Until every active passage is indexed the assistant
// simply keeps using keyword search.
import { configuredProvider } from "../src/lib/assistant/embedding-client";
import { embeddingSettings } from "../src/lib/assistant/embedding-settings";
import { indexVersion, storedHashes } from "../src/lib/assistant/embedding-store";
import { passageText, textHash } from "../src/lib/assistant/semantic";
import { createPool } from "../src/lib/db/pool";
import { readableText, type SourcePassage } from "../src/lib/source-types";

const BUILD_SECONDS = 240;

function argument(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const build = process.argv.includes("--build");
  const statusOnly = process.argv.includes("--status");
  if (!build) {
    try {
      process.loadEnvFile(".env.local");
    } catch {
      // No local settings file: the environment is used as it is.
    }
  }
  const settings = embeddingSettings();
  if (!settings.on) {
    console.log(
      settings.problems.length
        ? `Semantic search: off until its settings are fixed.\n${settings.problems.map((p) => `- ${p}`).join("\n")}`
        : "Semantic search: off (ASSISTANT_EMBEDDINGS_API_KEY is not set). Nothing was indexed.",
    );
    if (!build && settings.problems.length) process.exitCode = 1;
    return;
  }
  // A Vercel preview build must never change a database, because Preview may
  // point at the production database (the same rule as scripts/db-cli.ts).
  if (
    process.env.VERCEL_ENV === "preview" &&
    process.env.PREVIEW_DB_SETUP !== "1"
  ) {
    console.log(
      "Preview build: semantic index skipped. No database was changed.",
    );
    return;
  }
  const provider = configuredProvider()!.provider;
  const pool = createPool(
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  );
  const seconds = Number(argument("seconds") ?? (build ? BUILD_SECONDS : 0));
  const deadline =
    Number.isFinite(seconds) && seconds > 0
      ? AbortSignal.timeout(seconds * 1000)
      : undefined;
  try {
    const { rows } = await pool.query(
      `SELECT id, title, state, passages FROM source_versions ${process.argv.includes("--all") ? "" : "WHERE state <> 'retired'"} ORDER BY state, title, version`,
    );
    const total = { passages: 0, already: 0, embedded: 0, tokens: 0 };
    let stopped: string | undefined;
    const started = Date.now();
    for (const row of rows) {
      const passages = (row.passages as SourcePassage[]).map((p) => ({
        id: p.id,
        // The same text the assistant searches.
        text: readableText(p.text),
      }));
      if (statusOnly || stopped) {
        const stored = await storedHashes(pool, provider.id, row.id);
        const current = passages.filter(
          (p) => stored.get(p.id) === textHash(passageText(p.text)),
        ).length;
        total.passages += passages.length;
        total.already += current;
        if (!build)
          console.log(
            `  ${String(current).padStart(4)} of ${String(passages.length).padStart(4)}  ${row.state.padEnd(7)} ${row.title}`,
          );
        continue;
      }
      const result = await indexVersion(pool, provider, row.id, passages, {
        signal: deadline,
        retries: build ? 3 : 6,
      });
      total.passages += result.passages;
      total.already += result.already;
      total.embedded += result.embedded;
      total.tokens += result.tokens;
      stopped = result.stopped;
      if (!build)
        console.log(
          `  ${String(result.already + result.embedded).padStart(4)} of ${String(result.passages).padStart(4)}  ${row.state.padEnd(7)} ${row.title}${result.embedded ? `  (+${result.embedded})` : ""}${result.stopped ? `  stopped: ${result.stopped}` : ""}`,
        );
    }
    const indexed = total.already + total.embedded;
    const complete = indexed === total.passages;
    console.log(
      `Semantic index (${provider.id}): ${indexed} of ${total.passages} passages in ${rows.length} source versions.` +
        (total.embedded
          ? ` Embedded ${total.embedded} now, ${total.tokens} tokens, ${((Date.now() - started) / 1000).toFixed(1)} s.`
          : "") +
        (complete
          ? ""
          : statusOnly
            ? " The assistant uses keyword search until every active passage is indexed."
            : ` Stopped early (${stopped ?? "unknown"}). Nothing was lost; ${build ? "redeploy" : "run it again"} to continue. The assistant uses keyword search until every active passage is indexed.`),
    );
    if (!complete && !build && !statusOnly) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  // The reason, with any connection string removed.
  const message =
    error instanceof Error
      ? error.message.replace(/postgres(ql)?:\/\/\S+/gi, "[connection string]")
      : "unknown error";
  console.error(`The semantic index could not be updated: ${message}`);
  // A missing index only means keyword search; it must not stop a deployment.
  if (!process.argv.includes("--build")) process.exitCode = 1;
});
