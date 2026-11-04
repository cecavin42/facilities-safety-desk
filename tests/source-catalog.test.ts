import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILTIN_CATALOG,
  catalogOf,
  eligiblePassages,
} from "../src/lib/source-types";
import { answerFromTopics } from "../src/lib/assistant/answer";
import { parseRouting } from "../src/lib/assistant/model-protocol";
import { retrieveCandidates } from "../src/lib/search";
import challenge from "./assistant-challenge.json";
for (const c of challenge.cases)
  test(`challenge: ${c.id}`, () => {
    const r = answerFromTopics(c.question);
    if (c.expect === "withhold") assert.equal(r.answered, false);
    else {
      if (c.expect === "answer") assert.equal(r.answered, true);
      for (const id of "evidence" in c ? (c.evidence ?? []) : [])
        assert.ok(
          r.evidence.some((e) => e.id === id),
          `Expected evidence ${id}`,
        );
    }
  });
test("retired evidence cannot be recovered from a static guide", () => {
  const catalog = catalogOf(
    BUILTIN_CATALOG.documents.filter((d) => d.id !== "cfr-1910-178"),
    BUILTIN_CATALOG.passages.filter((p) => p.docId !== "cfr-1910-178"),
  );
  const r = answerFromTopics(
    "How often must a forklift be inspected?",
    undefined,
    catalog,
  );
  assert.ok(r.evidence.every((e) => e.documentId !== "cfr-1910-178"));
  assert.notEqual(catalog.version, BUILTIN_CATALOG.version);
});
test("an unrelated custom source cannot authorize a general chemical-cleanup answer", () => {
  const catalog = catalogOf(
    [
      ...BUILTIN_CATALOG.documents,
      {
        id: "fixture",
        title: "Binder",
        owner: "Demo",
        dated: "v1",
        url: "https://example.invalid",
        credit: "Test",
        origin: "upload",
      },
    ],
    [
      ...BUILTIN_CATALOG.passages,
      {
        id: "fixture:1",
        docId: "fixture",
        label: "page 1",
        text: "The fictional binder is in Cabinet Q17.",
      },
    ],
  );
  const r = answerFromTopics(
    "How do I neutralize a forklift battery acid spill?",
    undefined,
    catalog,
  );
  assert.equal(r.answered, false);
  assert.ok(r.evidence.every((e) => e.documentId === "fixture"));
});
test("explicit UT scope excludes federal-only snippets", () => {
  assert.ok(
    eligiblePassages(
      "Under UT rules can passengers ride a forklift?",
      BUILTIN_CATALOG,
    ).every((p) => p.docId.startsWith("ut-")),
  );
});
test("model routing cannot select an inactive guide even if its ID is well formed", () => {
  assert.throws(() =>
    parseRouting('{"topicIds":["inspection"],"fullyCovered":true}', [], []),
  );
});
test("long policy passages with a heading remain retrievable", () => {
  const text =
    "Effective Date: 2026. " +
    "The special violet cabinet stores the fictional training binder. ".repeat(
      8,
    );
  assert.equal(
    retrieveCandidates(
      "Where is the special violet training binder stored?",
      1,
      [{ id: "p", docId: "d", label: "page 1", text }],
    )[0]?.id,
    "p",
  );
});
