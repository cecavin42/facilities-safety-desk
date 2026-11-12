import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:3102";
const cases = [
  { question: "Our lift runs all day and all night. How frequently must someone look it over?", topic: "inspection" },
  { question: "An operator barely avoided hitting someone with a forklift. Is their old certificate enough to go straight back to work?", topic: "refresher" },
  { question: "The clinic kept an employee just for tests, no treatment. Is that a reportable hospital stay?", topic: "hospital" },
  { question: "Can my identity be kept private when I raise a workplace hazard concern?", topic: "confidential" },
  { question: "An accident killed a worker. When does the Tennessee employer need to notify the regulator?", topic: "fatality" },
  { question: "Our forklift's stopping mechanism is failing. Can we use it until the mechanic comes?", topic: "defect" },
  { question: "What information proves that someone completed operator instruction and assessment?", topic: "training-record" },
  { question: "I am learning to drive a forklift. May I practice with a qualified trainer watching?", topic: "training" },
  { question: "Who should hear about a close call, and could raising it cost me my job?", topics: ["hazard-report", "retaliation"] },
  { question: "What exact glove material is required for an acetone spill?", unsupported: true },
  { question: "How many hours does the forklift training course have to last?", unsupported: true },
  { question: "What is the injury reporting deadline under Nevada law?", unsupported: true },
];
async function main() {
  const results = [];
  for (const c of cases) {
    const started = Date.now();
    const response = await fetch(base + "/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: c.question }) });
    assert.equal(response.status, 200);
    const answer = await response.json();
    const topics = answer.sections.map((s: { id: string }) => s.id);
    const passed = c.unsupported ? !answer.answered : answer.answered && (c.topic ? topics.includes(c.topic) : c.topics!.every(t => topics.includes(t)));
    const result = { question: c.question, passed, elapsedMs: Date.now() - started, outcome: answer.outcome, method: answer.method, topics, answer };
    results.push(result);
    console.log(JSON.stringify({ ...result, answer: undefined }));
  }
  for (const [body, headers, expected] of [["{", { "Content-Type": "application/json" }, 400], [JSON.stringify({ question: "" }), { "Content-Type": "application/json" }, 400], ["x".repeat(5000), { "Content-Type": "application/json" }, 413], [JSON.stringify({ question: "test" }), { "Content-Type": "application/json", Origin: "https://example.invalid" }, 403], ["test", { "Content-Type": "text/plain" }, 415]] as const) {
    const response = await fetch(base + "/api/ask", { method: "POST", headers, body });
    assert.equal(response.status, expected);
  }
  await writeFile("test-results/assistant-live-model.json", JSON.stringify({ cases: results.length, passed: results.filter(r => r.passed).length, requestBoundaries: "5/5 passed", results }, null, 2));
  console.log(`Live challenge: ${results.filter(r => r.passed).length}/${results.length}; request boundaries 5/5`);
  if (results.some(r => !r.passed)) process.exitCode = 1;
}
void main();
