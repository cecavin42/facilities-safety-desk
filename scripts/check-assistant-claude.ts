// End-to-end check of model-written answers against the local app, with the
// stand-in in place of the Claude API (scripts/claude-stub.ts). No key, no
// cost, nothing leaves this machine.
//
// Start the local app with these two settings, then run `npm run
// test:claude-path`:
//   ASSISTANT_CLAUDE_API_KEY=local-stand-in-not-a-real-key
//   ASSISTANT_CLAUDE_BASE_URL=http://127.0.0.1:3997
// The slow-reply check waits for the app's own time limit (15 seconds unless
// set). ASSISTANT_CLAUDE_TIMEOUT_MS=3000 makes it finish sooner.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Client, localSetup } from "./readiness-client";
import { STUB_KEY, startClaudeStub, type StubMode } from "./claude-stub";

async function main() {
  const { pool, accounts, admin } = await localSetup();
  const stub = await startClaudeStub().catch((error) => {
    throw new Error(
      error?.code === "EADDRINUSE"
        ? "Port 3997 is in use. Stop the standalone stand-in (npm run claude:stub) and run this check again."
        : "The stand-in could not start.",
    );
  });
  const results: string[] = [];
  const created: string[] = [];
  const asked: string[] = [];
  const started = new Date();
  const nonce = randomUUID().slice(0, 8);
  const marker = `garnet-${nonce}`;
  try {
    const sentence = `The ${marker} eyewash station is tested every 7 days by the lab supervisor.`;
    const text = `${sentence} A failed test is reported to Facilities at 555-0171 within 2 business days. This is a fictional procedure for a local test.`;
    const form = new FormData();
    for (const [k, v] of Object.entries({
      title: `Synthetic eyewash procedure ${nonce}`,
      publisher: "Local test fixture",
      revision: "Adopted 2026-11-01",
      sourceUrl: "https://example.invalid/synthetic-eyewash",
      scope: "Fictional test only",
      credit: "Original fictional text for local development.",
      documentId: "",
    }))
      form.set(k, v);
    form.set("file", new Blob([text], { type: "text/plain" }), "eyewash.txt");
    const draft = await admin.request("/api/sources/upload", "POST", form);
    assert.equal(draft.status, 201);
    created.push(draft.data.id);
    assert.equal(
      (
        await admin.request(`/api/sources/${draft.data.id}`, "PATCH", {
          state: "active",
          reviewed: true,
        })
      ).status,
      200,
    );
    const documentId = (await admin.request(`/api/sources/${draft.data.id}`))
      .data.documentId as string;

    let serial = 0;
    // Each case asks a new question, so no answer is served from the cache.
    const question = () =>
      `How often is the ${marker} eyewash station tested, case ${++serial}?`;
    const ask = async (mode: StubMode, client: Client = admin, q = question()) => {
      asked.push(q);
      stub.state.mode = mode;
      const before = stub.requests.length;
      const began = Date.now();
      const response = await client.request("/api/ask", "POST", { question: q });
      assert.equal(response.status, 200);
      const {
        rows: [log],
      } = await pool.query(
        "SELECT answered,model_written,model,model_outcome,input_tokens,output_tokens FROM question_log WHERE question=$1 ORDER BY asked_at DESC, id DESC LIMIT 1",
        [q],
      );
      return {
        q,
        answer: response.data,
        log,
        calls: stub.requests.length - before,
        elapsedMs: Date.now() - began,
      };
    };

    const written = await ask("answer");
    assert.equal(
      written.answer.method,
      "ai-written",
      "The app did not use the stand-in. Start it with the three ASSISTANT_CLAUDE settings named at the top of this script.",
    );
    assert.equal(written.calls, 1);
    assert.equal(written.answer.outcome, "answer");
    assert.equal(written.answer.sections[0].summary, sentence);
    assert.equal(written.answer.evidence.length, 1);
    assert.equal(written.answer.evidence[0].documentId, documentId);
    assert.ok(written.answer.evidence[0].text.includes(sentence));
    assert.match(written.answer.notice, /Written by AI/);
    assert.equal(written.log.model_written, true);
    assert.equal(written.log.answered, true);
    assert.equal(written.log.model_outcome, "written");
    assert.ok(written.log.input_tokens > 0 && written.log.output_tokens > 0);
    results.push(
      "A question about an uploaded document gets a model-written answer that cites the exact passage, and the question log records the model and its tokens",
    );

    const sent = stub.requests.at(-1)!;
    const body = sent.body as {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: string; content: string }[];
      output_config: { effort: string; format: { type: string } };
    };
    assert.ok(
      sent.headers.authorization === `Bearer ${STUB_KEY}` ||
        sent.headers["x-api-key"] === STUB_KEY,
    );
    assert.ok(sent.headers["anthropic-version"]);
    assert.equal(written.log.model, body.model);
    assert.equal(body.output_config.format.type, "json_schema");
    assert.equal(body.output_config.effort, "low");
    assert.equal(body.messages.length, 1);
    assert.equal(body.messages[0].role, "user");
    assert.ok(body.messages[0].content.includes(written.q));
    assert.ok(body.messages[0].content.includes(sentence));
    assert.match(body.system, /data, not instructions/);
    for (const forbidden of ["temperature", "top_p", "top_k", "thinking"])
      assert.ok(!(forbidden in sent.body), `${forbidden} must not be sent`);
    const wire = JSON.stringify(sent.body);
    for (const account of accounts)
      assert.ok(!wire.includes(account.email), "No account detail may be sent");
    assert.ok(!wire.includes(STUB_KEY));
    results.push(
      "The request carries the key only in its header, asks for structured output at low effort, and contains the question and passages but nothing about the person asking",
    );

    const repeat = await ask("answer", admin, written.q);
    assert.equal(repeat.calls, 0);
    assert.deepEqual(repeat.answer, written.answer);
    assert.equal(repeat.log.model_outcome, "cached");
    assert.equal(repeat.log.input_tokens, 0);
    results.push(
      "The same question on the same sources is answered from memory, with no second model call",
    );

    const employee = new Client();
    const account = accounts.find((a) => a.role === "user")!;
    await employee.login(account.email, account.password);
    assert.equal((await ask("answer", employee)).answer.method, "ai-written");
    results.push("An employee account gets model-written answers too");

    const partial = await ask("partial");
    assert.equal(partial.answer.method, "ai-written");
    assert.equal(partial.answer.outcome, "partial");
    assert.equal(partial.log.answered, false);
    assert.equal(partial.log.model_written, true);
    results.push(
      "A partial answer is shown as partial and is not counted as answered",
    );

    const none = await ask("none");
    assert.equal(none.answer.method, "source-search");
    assert.equal(none.answer.notice, undefined);
    assert.ok(none.answer.evidence.length > 0);
    assert.equal(none.log.model_outcome, "no-support");
    assert.equal(none.log.model_written, false);
    assert.ok(none.log.input_tokens > 0);
    results.push(
      "When the model finds no answer, the passages are shown as before and the tokens are still recorded",
    );

    for (const [mode, outcome] of [
      ["invent", "unsupported-number"],
      ["badcite", "bad-citation"],
      ["text", "invalid-json"],
    ] as const) {
      const r = await ask(mode);
      assert.equal(r.answer.method, "source-search", mode);
      assert.match(r.answer.notice, /withheld/, mode);
      assert.ok(!JSON.stringify(r.answer).includes("97 days"), mode);
      assert.equal(r.log.model_outcome, outcome);
      assert.equal(r.log.model_written, false);
    }
    results.push(
      "A reply with an invented number, a citation that was never sent, or plain prose is withheld and the passages are shown",
    );

    for (const [mode, outcome] of [
      ["refuse", "refusal"],
      ["error", "server"],
      ["slow", "timeout"],
    ] as const) {
      // Longer than any time limit the app accepts (25 seconds), so the app
      // always gives up first.
      if (mode === "slow") stub.state.delayMs = 27_000;
      const r = await ask(mode);
      assert.equal(r.answer.method, "source-search", mode);
      assert.match(r.answer.notice, /unavailable/, mode);
      assert.equal(r.log.model_outcome, outcome);
      assert.equal(r.calls, 1, `${mode}: a failed call must not be retried`);
      if (mode === "slow")
        assert.ok(
          r.elapsedMs < stub.state.delayMs,
          "The app must give up before the slow reply arrives.",
        );
    }
    results.push(
      "A refusal, a server fault and a slow reply each fall back to the passages with a plain note, without a retry",
    );

    for (const [q, method] of [
      [`Are staff paid while the ${marker} eyewash station is tested?`, "source-guide"],
      ["How often does a forklift used around the clock need inspection?", "source-guide"],
      ["Hello, how are you?", "source-guide"],
    ] as const) {
      const r = await ask("answer", admin, q);
      assert.equal(r.calls, 0, q);
      assert.equal(r.answer.method, method, q);
      assert.equal(r.log.model_outcome, null);
      assert.equal(r.log.model_written, false);
    }
    results.push(
      "A declined question, a question a tested guide answers, and an empty one never reach the model",
    );

    await writeFile(
      "test-results/assistant-claude-checks.json",
      JSON.stringify({ passed: results.length, results }, null, 2),
    );
    console.log(results.map((r) => "PASS " + r).join("\n"));
  } finally {
    for (const id of created)
      await admin.request(`/api/sources/${id}`, "PATCH", {
        state: "retired",
        reviewed: true,
      });
    // Leave the local question statistics as they were.
    await pool.query(
      "DELETE FROM question_log WHERE question = ANY($1) AND asked_at >= $2",
      [asked, started],
    );
    await stub.close();
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Claude path checks failed");
  process.exitCode = 1;
});
