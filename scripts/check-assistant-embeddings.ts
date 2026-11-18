// End-to-end check of semantic search against the local app, with stand-ins in
// place of the embeddings API (scripts/embeddings-stub.ts) and the Claude API
// (scripts/claude-stub.ts). No key, no cost, nothing leaves this machine.
//
// Start the local app with these five settings, then run `npm run
// test:semantic-path`:
//   ASSISTANT_EMBEDDINGS_API_KEY=local-stand-in-not-a-real-key
//   ASSISTANT_EMBEDDINGS_BASE_URL=http://127.0.0.1:3996
//   ASSISTANT_EMBEDDINGS_MODEL=stand-in
//   ASSISTANT_CLAUDE_API_KEY=local-stand-in-not-a-real-key
//   ASSISTANT_CLAUDE_BASE_URL=http://127.0.0.1:3997
// Run it before anyone opens the assistant page, or a minute after (the app
// looks at an unfinished index once a minute), and not within half a minute
// of an earlier run (its last step leaves the provider paused).
//
// The check first gives every active passage a stand-in embedding (so the
// index is complete), and removes every stand-in embedding when it ends.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { voyageProvider } from "../src/lib/assistant/embedding-client";
import { embeddingSettings } from "../src/lib/assistant/embedding-settings";
import { indexVersion } from "../src/lib/assistant/embedding-store";
import { readableText, type SourcePassage } from "../src/lib/source-types";
import { STUB_KEY, startClaudeStub } from "./claude-stub";
import {
  EMBEDDINGS_STUB_KEY,
  EMBEDDINGS_STUB_MODEL,
  EMBEDDINGS_STUB_PORT,
  startEmbeddingsStub,
} from "./embeddings-stub";
import { Client, localSetup } from "./readiness-client";

const HOW_TO_START =
  "Start the app with the five settings named at the top of this script. If the assistant page was opened or this check was run in the last minute, wait a minute and run it again.";

async function main() {
  const { pool, accounts, admin } = await localSetup();
  const inUse = (name: string, port: number) => (error: { code?: string }) => {
    throw new Error(
      error?.code === "EADDRINUSE"
        ? `Port ${port} is in use. Stop the standalone ${name} stand-in and run this check again.`
        : `The ${name} stand-in could not start.`,
    );
  };
  const embeddings = await startEmbeddingsStub().catch(
    inUse("embeddings", EMBEDDINGS_STUB_PORT),
  );
  const claude = await startClaudeStub().catch(inUse("Claude", 3997));
  const settings = embeddingSettings({
    NODE_ENV: "test",
    ASSISTANT_EMBEDDINGS_API_KEY: EMBEDDINGS_STUB_KEY,
    ASSISTANT_EMBEDDINGS_BASE_URL: `http://127.0.0.1:${EMBEDDINGS_STUB_PORT}`,
    ASSISTANT_EMBEDDINGS_MODEL: EMBEDDINGS_STUB_MODEL,
  });
  assert.ok(settings.on);
  const provider = voyageProvider(settings);
  const results: string[] = [];
  const created: string[] = [];
  const asked: string[] = [];
  const started = new Date();
  const nonce = randomUUID().replace(/-/g, "").slice(0, 8);
  // The document says "garnet… eyewash … tested"; the questions say "ruby…
  // eyerinse … verified". Only the stand-in is told they mean the same.
  const marker = `garnet${nonce}`;
  embeddings.state.sameMeaning = [
    [marker, `ruby${nonce}`],
    ["eyewash", "eyerinse"],
    ["tested", "verified"],
  ];
  try {
    const indexed = async (versionId: string) =>
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM passage_embeddings WHERE version_id=$1 AND model=$2",
          [versionId, provider.id],
        )
      ).rows[0].n as number;
    const upload = async (title: string, text: string) => {
      const form = new FormData();
      for (const [k, v] of Object.entries({
        title,
        publisher: "Local test fixture",
        revision: "Adopted 2026-11-01",
        sourceUrl: "https://example.invalid/synthetic-semantic",
        scope: "Fictional test only",
        credit: "Original fictional text for local development.",
        documentId: "",
      }))
        form.set(k, v);
      form.set("file", new Blob([text], { type: "text/plain" }), "fixture.txt");
      const draft = await admin.request("/api/sources/upload", "POST", form);
      assert.equal(draft.status, 201);
      created.push(draft.data.id);
      return draft.data as { id: string; passageCount: number; indexedCount?: number };
    };
    const setState = (id: string, state: "active" | "retired") =>
      admin.request(`/api/sources/${id}`, "PATCH", { state, reviewed: true });

    // Every passage that is active now gets a stand-in embedding, as the
    // indexer would give it a real one.
    const { rows: active } = await pool.query(
      "SELECT id, passages FROM source_versions WHERE state='active'",
    );
    for (const row of active) {
      const done = await indexVersion(
        pool,
        provider,
        row.id,
        (row.passages as SourcePassage[]).map((p) => ({
          id: p.id,
          text: readableText(p.text),
        })),
      );
      assert.equal(done.stopped, undefined);
    }

    const sentence = `The ${marker} eyewash station is tested every 7 days by the lab supervisor.`;
    const text = `${sentence} A failed test is reported to Facilities at 555-0171 within 2 business days. This is a fictional procedure for a local test.`;
    const before = embeddings.requests.length;
    const draft = await upload(`Synthetic eyewash procedure ${nonce}`, text);
    assert.equal(
      draft.indexedCount,
      draft.passageCount,
      `The app did not make embeddings at upload. ${HOW_TO_START}`,
    );
    assert.equal(await indexed(draft.id), draft.passageCount);
    const sent = embeddings.requests.slice(before);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].headers.authorization, `Bearer ${EMBEDDINGS_STUB_KEY}`);
    assert.equal(sent[0].body.input_type, "document");
    assert.equal(sent[0].body.model, EMBEDDINGS_STUB_MODEL);
    assert.ok((sent[0].body.input as string[]).some((t) => t.includes(sentence)));
    const wire = JSON.stringify(sent[0].body);
    assert.ok(!wire.includes(EMBEDDINGS_STUB_KEY) && !wire.includes(STUB_KEY));
    for (const account of accounts)
      assert.ok(!wire.includes(account.email), "No account detail may be sent");
    results.push(
      "An uploaded document gets an embedding for every passage at upload; the request carries the key only in its header and nothing about the person",
    );
    assert.equal((await setState(draft.id, "active")).status, 200);
    const documentId = (await admin.request(`/api/sources/${draft.id}`)).data
      .documentId as string;

    let serial = 0;
    // The document's words are not in the question, except "station".
    const question = () =>
      `Is the ruby${nonce} eyerinse station verified in case zq${nonce}${++serial}?`;
    const ask = async (client: Client = admin, q = question()) => {
      asked.push(q);
      const counts = [embeddings.requests.length, claude.requests.length];
      const began = Date.now();
      const response = await client.request("/api/ask", "POST", { question: q });
      assert.equal(response.status, 200);
      const {
        rows: [log],
      } = await pool.query(
        "SELECT answered,model_written,model_outcome FROM question_log WHERE question=$1 ORDER BY asked_at DESC, id DESC LIMIT 1",
        [q],
      );
      return {
        q,
        answer: response.data,
        log,
        embedded: embeddings.requests.slice(counts[0]),
        modelCalls: claude.requests.length - counts[1],
        elapsedMs: Date.now() - began,
      };
    };

    const found = await ask();
    assert.equal(
      found.answer.method,
      "ai-written",
      `The app did not use search by meaning. ${HOW_TO_START}`,
    );
    assert.equal(found.modelCalls, 1);
    assert.equal(found.answer.sections[0].summary, sentence);
    assert.equal(found.answer.evidence[0].documentId, documentId);
    assert.equal(found.log.model_outcome, "written");
    assert.equal(found.embedded.length, 1);
    assert.equal(found.embedded[0].body.input_type, "query");
    assert.deepEqual(found.embedded[0].body.input, [found.q]);
    for (const account of accounts)
      assert.ok(!JSON.stringify(found.embedded[0].body).includes(account.email));
    results.push(
      "A question that uses other words than the document reaches the model with the right passage, and the written answer cites it",
    );

    const repeat = await ask(admin, found.q);
    assert.equal(repeat.embedded.length, 0);
    assert.equal(repeat.modelCalls, 0);
    assert.deepEqual(repeat.answer, found.answer);
    results.push(
      "The same question again is sent neither to the embeddings provider nor to the model",
    );

    const employee = new Client();
    const account = accounts.find((a) => a.role === "user")!;
    await employee.login(account.email, account.password);
    assert.equal((await ask(employee)).answer.method, "ai-written");
    for (const q of [
      "How often does a forklift used around the clock need inspection?",
      `Are staff paid while the ruby${nonce} eyerinse station is verified?`,
      "Hello, how are you?",
    ]) {
      const r = await ask(admin, q);
      assert.equal(r.embedded.length, 0, q);
      assert.equal(r.modelCalls, 0, q);
      assert.equal(r.answer.method, "source-guide", q);
    }
    results.push(
      "An employee account gets the same; a question a guide answers, a declined question and a greeting are sent nowhere",
    );

    // A version without embeddings: keyword search answers alone.
    embeddings.state.mode = "error";
    const second = await upload(
      `Synthetic cupboard procedure ${nonce}`,
      `The topaz${nonce} fume cupboard is serviced every 30 days by the building engineer. A fault is reported to Facilities at 555-0172 within 3 business days. This is a fictional procedure for a local test.`,
    );
    assert.equal(second.indexedCount, 0);
    assert.equal((await setState(second.id, "active")).status, 200);
    assert.equal(await indexed(second.id), 0);
    const alone = await ask();
    assert.equal(alone.embedded.length, 0, "Nothing is sent while a passage has no embedding");
    assert.equal(alone.modelCalls, 0);
    assert.equal(alone.answer.method, "source-guide");
    assert.equal(alone.answer.outcome, "unsupported");
    assert.equal(alone.log.model_outcome, null);
    const list = (await admin.request("/api/sources")).data as {
      id: string;
      passageCount: number;
      indexedCount?: number;
    }[];
    assert.equal(list.find((r) => r.id === second.id)!.indexedCount, 0);
    assert.equal(list.find((r) => r.id === draft.id)!.indexedCount, draft.passageCount);
    const employeeList = (await employee.request("/api/sources")).data as Record<string, unknown>[];
    assert.ok(employeeList.every((r) => !("indexedCount" in r)));
    results.push(
      "When the provider fails at upload the document is still saved and activated; while one active passage has no embedding every answer is the keyword one, nothing is sent, and the administrator's source list shows which document is not indexed",
    );

    // Activating again gives the missing embeddings a second chance.
    embeddings.state.mode = "answer";
    assert.equal((await setState(second.id, "active")).status, 200);
    assert.equal(await indexed(second.id), second.passageCount);
    // Retired, it no longer counts, and search by meaning is back at once.
    assert.equal((await setState(second.id, "retired")).status, 200);
    assert.equal((await ask()).answer.method, "ai-written");
    results.push(
      "Activating the document again makes the missing embeddings, and search by meaning returns once every active passage is indexed",
    );

    // A slow provider: a bounded wait, the keyword answer, then a pause.
    embeddings.state.mode = "slow";
    const slow = await ask();
    assert.equal(slow.embedded.length, 1);
    assert.equal(slow.modelCalls, 0);
    assert.equal(slow.answer.method, "source-guide");
    assert.equal(slow.answer.outcome, "unsupported");
    assert.ok(
      slow.elapsedMs < embeddings.state.delayMs,
      "The app must give up before the slow reply arrives.",
    );
    embeddings.state.mode = "answer";
    const paused = await ask();
    assert.equal(paused.embedded.length, 0, "After a failure the provider is left alone for a while");
    assert.equal(paused.answer.outcome, "unsupported");
    results.push(
      `A slow provider costs one question a bounded wait (${slow.elapsedMs} ms here) and the keyword answer; the next question does not wait at all`,
    );

    await writeFile(
      "test-results/assistant-semantic-checks.json",
      JSON.stringify({ passed: results.length, results }, null, 2),
    );
    console.log(results.map((r) => "PASS " + r).join("\n"));
  } finally {
    embeddings.state.mode = "answer";
    for (const id of created)
      await admin.request(`/api/sources/${id}`, "PATCH", {
        state: "retired",
        reviewed: true,
      });
    // Leave the local question statistics and the index as they were.
    await pool.query(
      "DELETE FROM question_log WHERE question = ANY($1) AND asked_at >= $2",
      [asked, started],
    );
    await pool.query("DELETE FROM passage_embeddings WHERE model = $1", [
      provider.id,
    ]);
    await embeddings.close();
    await claude.close();
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Semantic path checks failed");
  process.exitCode = 1;
});
