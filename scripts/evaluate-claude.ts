// Runs a set of questions through model-written answers and reports, for each
// model: how many expectations were met, how often the answer was written or
// fell back (and why), the tokens used, the cost and the time taken.
//
// It calls the real API, so it spends money: a few cents for a hundred
// questions on the default model. Without --yes it only prints the plan.
//
//   npm run eval:claude -- --yes
//   npm run eval:claude -- --questions path/to/questions.json --models claude-haiku-5-5,claude-sonnet-5-5 --yes
//
// The catalog is the active Source library of the database in .env.local, so
// the same documents the local app serves. Question files that quote private
// documents stay outside this repository.
//
// Semantic search takes part when its settings are present, exactly as in the
// app, and each row says whether it did ("hybrid") or not ("keyword"). To
// compare, run the same questions once with and once without
// ASSISTANT_EMBEDDINGS_API_KEY (or ASSISTANT_EMBEDDINGS_OLLAMA_MODEL).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { claudeTransport } from "../src/lib/assistant/claude-client";
import { claudeSettings } from "../src/lib/assistant/claude-settings";
import { embeddingSettings } from "../src/lib/assistant/embedding-settings";
import { answerWithTrace } from "../src/lib/assistant/service";
import { activeCatalog } from "../src/lib/sources";

type Question = {
  id: string;
  question: string;
  // written: the model's answer is shown. withheld: it is not (no model call,
  // a fallback, or "none").
  expect: "written" | "withheld";
  // Each must appear in the title of a cited document.
  cites?: string[];
  // Each is a regular expression the answer text must match.
  contains?: string[];
  // The least number of different documents the answer must cite, for
  // questions where two documents disagree.
  documents?: number;
};

// US dollars per million tokens, input and output, for prompts up to 100,000
// tokens. Read on 2026-11-03; check the current price list before quoting.
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};

function argument(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  process.loadEnvFile(".env.local");
  const settings = claudeSettings();
  if (!settings.on) {
    console.error(
      settings.problems.length
        ? settings.problems.join("\n")
        : "ASSISTANT_CLAUDE_API_KEY is not set in .env.local. Nothing was run.",
    );
    process.exitCode = 1;
    return;
  }
  const file = argument("questions") ?? "tests/fixtures/claude-eval-questions.json";
  const questions = JSON.parse(await readFile(file, "utf8")) as Question[];
  const models = (argument("models") ?? settings.model).split(",");
  const standIn = /^http:/.test(settings.baseURL);
  console.log(
    `${questions.length} questions from ${file}, on ${models.join(" and ")}${standIn ? " (the local stand-in, not a model)" : ""}. Up to ${questions.length * models.length} model calls.`,
  );
  if (!process.argv.includes("--yes")) {
    console.log("Nothing was run. Add --yes to run it.");
    return;
  }
  const catalog = await activeCatalog();
  console.log(
    `Catalog: ${catalog.documents.length} documents, ${catalog.passages.length} passages, snapshot ${catalog.version}.`,
  );
  const semantic = embeddingSettings();
  console.log(
    `Semantic search: ${semantic.on ? `on (${semantic.id})` : "off (keyword search only)"}.`,
  );
  const report = [];
  for (const model of models) {
    const transport = claudeTransport({ ...settings, model });
    const rows = [];
    for (const q of questions) {
      const started = Date.now();
      const { answer, trace, retrieval } = await answerWithTrace(
        q.question,
        undefined,
        catalog,
        transport,
      );
      const written = answer.method === "ai-written";
      const text = answer.sections
        .map((s) => `${s.title}. ${s.summary}`)
        .join(" ");
      const cited = [...new Set(answer.evidence.map((e) => e.title))];
      const problems = [
        ...(written === (q.expect === "written")
          ? []
          : [`expected ${q.expect}, got ${written ? "written" : (trace?.outcome ?? "no model call")}`]),
        ...(written
          ? [
              ...(q.cites ?? [])
                .filter((c) => !cited.some((t) => t.toLowerCase().includes(c.toLowerCase())))
                .map((c) => `does not cite ${c}`),
              ...(q.contains ?? [])
                .filter((c) => !new RegExp(c, "i").test(text))
                .map((c) => `does not say /${c}/`),
              ...(q.documents && cited.length < q.documents
                ? [`cites ${cited.length} document(s), expected ${q.documents}`]
                : []),
            ]
          : []),
      ];
      rows.push({
        id: q.id,
        question: q.question,
        passed: !problems.length,
        problems,
        outcome: trace?.outcome ?? "no model call",
        retrieval,
        supported: written ? answer.outcome : undefined,
        cited,
        // The passages the answer rests on, by id (never their text).
        citedPassages: written ? answer.evidence.map((e) => e.id) : undefined,
        answer: written ? answer.sections.map((s) => ({ heading: s.title, text: s.summary })) : undefined,
        inputTokens: trace?.inputTokens ?? 0,
        outputTokens: trace?.outputTokens ?? 0,
        ms: Date.now() - started,
      });
      console.log(
        `  ${problems.length ? "MISS" : "ok  "} ${q.id.padEnd(28)} ${(trace?.outcome ?? "no model call").padEnd(20)} ${retrieval.padEnd(7)} ${String(Date.now() - started).padStart(6)} ms${problems.length ? "  " + problems.join("; ") : ""}`,
      );
    }
    const called = rows.filter((r) => r.outcome !== "no model call");
    const input = rows.reduce((n, r) => n + r.inputTokens, 0);
    const output = rows.reduce((n, r) => n + r.outputTokens, 0);
    const price = PRICES[model];
    const cost = price ? (input * price[0] + output * price[1]) / 1e6 : undefined;
    const times = called.map((r) => r.ms).sort((a, b) => a - b);
    const outcomes: Record<string, number> = {};
    for (const r of rows) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
    const summary = {
      model,
      questions: rows.length,
      passed: rows.filter((r) => r.passed).length,
      outcomes,
      // Questions where semantic search took part in choosing the passages.
      hybrid: rows.filter((r) => r.retrieval === "hybrid").length,
      inputTokens: input,
      outputTokens: output,
      costUsd: cost === undefined ? "price not listed" : Number(cost.toFixed(5)),
      costPer1000ModelCallsUsd:
        cost === undefined || !called.length
          ? undefined
          : Number(((cost / called.length) * 1000).toFixed(3)),
      medianMs: times[Math.floor(times.length / 2)],
      slowestMs: times.at(-1),
    };
    console.log(JSON.stringify(summary, null, 2));
    report.push({ ...summary, rows });
  }
  const out = argument("out") ?? "test-results/claude-evaluation.json";
  await mkdir("test-results", { recursive: true });
  await writeFile(
    out,
    JSON.stringify(
      { when: new Date().toISOString(), questionFile: file, catalog: catalog.version, standIn, semanticSearch: semantic.on ? semantic.id : null, report },
      null,
      2,
    ),
  );
  console.log(`Saved to ${out}.`);
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "The evaluation failed.");
    process.exitCode = 1;
  })
  .finally(() => process.exit());
