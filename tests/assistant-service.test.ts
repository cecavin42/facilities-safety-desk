import test from "node:test";
import assert from "node:assert/strict";
import { answerQuestion } from "../src/lib/assistant/service";
import { POST } from "../src/app/api/ask/route";

test("request boundaries reject malformed, large and cross-site bodies after authentication", async () => {
  const { readBody, HttpError } = await import("../src/lib/server-access");
  const original = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "http://localhost";
  try {
    for (const [body, headers, expected] of [
      ["{", { "Content-Type": "application/json" }, 400],
      ["x".repeat(5000), { "Content-Type": "application/json" }, 413],
      [
        JSON.stringify({ question: "test" }),
        {
          "Content-Type": "application/json",
          Origin: "https://example.invalid",
        },
        403,
      ],
      ["test", { "Content-Type": "text/plain" }, 415],
    ] as const) {
      await assert.rejects(
        () =>
          readBody(
            new Request("http://localhost/api/ask", {
              method: "POST",
              headers,
              body,
            }),
            4096,
          ),
        (e: unknown) => e instanceof HttpError && e.status === expected,
      );
    }
    assert.equal(
      (
        await POST(
          new Request("http://localhost/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: "" }),
          }),
        )
      ).status,
      401,
    );
  } finally {
    if (original === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = original;
  }
});

test("malformed AI output and network failure preserve source-based fallback", async () => {
  const originalFetch = global.fetch;
  const originalModel = process.env.ASSISTANT_OLLAMA_MODEL;
  try {
    process.env.ASSISTANT_OLLAMA_MODEL = "test-local";
    global.fetch = async () =>
      Response.json({
        message: { content: '{"topicIds":["fabricated"],"fullyCovered":true}' },
      });
    const invalid = await answerQuestion(
      "How often should a forklift be inspected? malformed test",
    );
    assert.equal(invalid.method, "source-guide");
    assert.match(invalid.notice!, /unavailable/);
    global.fetch = async () => {
      throw new Error("sensitive backend detail");
    };
    const offline = await answerQuestion(
      "How often should a forklift be inspected? offline test",
    );
    assert.equal(offline.answered, true);
    assert.doesNotMatch(JSON.stringify(offline), /sensitive backend/);
  } finally {
    global.fetch = originalFetch;
    if (originalModel === undefined) delete process.env.ASSISTANT_OLLAMA_MODEL;
    else process.env.ASSISTANT_OLLAMA_MODEL = originalModel;
  }
});

test("AI evidence selection can only return exact supplied passages", async () => {
  const originalFetch = global.fetch;
  const originalModel = process.env.ASSISTANT_OLLAMA_MODEL;
  try {
    process.env.ASSISTANT_OLLAMA_MODEL = "test-evidence";
    global.fetch = async () =>
      Response.json({
        message: {
          content:
            '{"topicIds":[],"passageIds":["not-supplied"],"fullyCovered":true}',
        },
      });
    const invalid = await answerQuestion(
      "What are the rules for charging batteries?",
    );
    assert.notEqual(invalid.method, "ai-assisted");
    assert.ok(!invalid.evidence.some((e) => e.id === "not-supplied"));
  } finally {
    global.fetch = originalFetch;
    if (originalModel === undefined) delete process.env.ASSISTANT_OLLAMA_MODEL;
    else process.env.ASSISTANT_OLLAMA_MODEL = originalModel;
  }
});
