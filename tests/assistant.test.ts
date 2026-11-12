import test from "node:test";
import assert from "node:assert/strict";
import { answerFromTopics, evidenceFor } from "../src/lib/assistant/answer";
import { PASSAGES, TOPICS } from "../src/lib/assistant/topics";
import { parseRouting } from "../src/lib/assistant/model-protocol";
import { CASES } from "./assistant-cases";
for (const c of CASES) test(c.id, () => {
  const result = answerFromTopics(c.question);
  assert.equal(result.answered, c.supported, result.message);
  const text = result.sections.map(s => s.summary).join(" ").toLowerCase();
  if (c.supported) {
    for (const phrase of c.phrases ?? []) assert.ok(text.includes(phrase.toLowerCase()), `Missing ${phrase}: ${text}`);
    if (c.docs) assert.ok(result.evidence.some(e => c.docs!.includes(e.documentId)), "Missing expected source");
    for (const section of result.sections) for (const id of section.evidenceIds) assert.ok(result.evidence.some(e => e.id === id));
  }
});
test("every topic cites existing exact source text", () => {
  for (const topic of TOPICS) for (const id of topic.evidence) {
    const evidence = evidenceFor(id);
    assert.equal(evidence.text, PASSAGES.find(p => p.id === id)!.text);
    assert.match(evidence.url, /^https:\/\//);
  }
});
test("policy cannot grant individual clearance to return to work", () => {
  const result = answerFromTopics("After a forklift near miss is their certificate enough to go back to work?");
  assert.equal(result.outcome, "partial"); assert.equal(result.answered, false);
  assert.ok(result.sections.some(s => s.id === "refresher"));
});
test("training record retention is not confused with incident record retention", () => {
  const result = answerFromTopics("How long should we keep forklift training records?");
  assert.equal(result.answered, false);
  assert.ok(!result.sections.some(s => s.id === "retention"));
});
test("model cannot introduce invented sources, claims, duplicate topics or malformed routing", () => {
  for (const value of ["{}", "null", '{"topicIds":["invented"],"fullyCovered":true}', '{"topicIds":["inspection","inspection"],"fullyCovered":true}', '{"topicIds":[],"fullyCovered":"true"}', '{"topicIds":[],"fullyCovered":true,"answer":"fabricated"}']) assert.throws(() => parseRouting(value));
  assert.deepEqual(parseRouting('{"topicIds":["inspection"],"fullyCovered":true}'), { topicIds: ["inspection"], fullyCovered: true });
});
