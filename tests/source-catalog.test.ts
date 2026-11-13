import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILTIN_CATALOG,
  catalogOf,
  eligiblePassages,
  readableText,
} from "../src/lib/source-types";
import { answerFromTopics, scopeGap } from "../src/lib/assistant/answer";
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
test("the University of Tennessee documents are retired from the bundled collection", () => {
  assert.ok(BUILTIN_CATALOG.documents.every((d) => !d.id.startsWith("ut-")));
  assert.ok(BUILTIN_CATALOG.passages.every((p) => !p.docId.startsWith("ut-")));
  const r = answerFromTopics("Under UT rules can passengers ride a forklift?");
  assert.equal(r.answered, false);
  assert.equal(r.evidence.length, 0);
  assert.match(r.message, /University of Tennessee procedures were retired/);
});
test("explicit federal scope excludes state-rule snippets", () => {
  assert.ok(
    eligiblePassages(
      "Under the federal OSHA standard can passengers ride a forklift?",
      BUILTIN_CATALOG,
    ).every((p) => p.docId === "cfr-1910-178"),
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
test("text from a PDF that stores spaces as control characters stays readable", () => {
  const gap = String.fromCharCode(3);
  const lineBreak = String.fromCharCode(10);
  const tab = String.fromCharCode(9);
  // The control character becomes a space; line breaks and tabs are kept.
  assert.equal(
    readableText(`Submit${gap}a${gap}copy${lineBreak}${tab}to the office`),
    `Submit a copy${lineBreak}${tab}to the office`,
  );
});
test("a policy question that says 'how many' is not taken for a records question", () => {
  for (const question of [
    "How many doctors must the employer offer me for a back injury?",
    "How many days do I have to report an injury?",
  ])
    assert.equal(scopeGap(question, true), undefined, question);
  for (const question of [
    "How many injuries were reported this year?",
    "How many forklift incidents happened at the dock?",
    "How many near misses did we log?",
  ])
    assert.match(scopeGap(question, true) ?? "", /incident records/, question);
});
