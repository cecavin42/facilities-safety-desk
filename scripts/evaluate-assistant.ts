import { writeFile, mkdir } from "node:fs/promises";
import { ask } from "../tests/baseline-search";
import { answerFromTopics } from "../src/lib/assistant/answer";
import { CASES } from "../tests/assistant-cases";
async function main() {
const results = CASES.map(c => {
  const before = ask(c.question); const after = answerFromTopics(c.question);
  function check(supported: boolean, text: string, docs: string[]) {
    return supported === c.supported && (!c.supported || ((c.phrases ?? []).every(p => text.toLowerCase().includes(p.toLowerCase())) && (!c.docs || docs.some(d => c.docs!.includes(d)))));
  }
  return { id: c.id, question: c.question, beforePassed: check(before.answered, before.answered ? before.citations.map(c => c.excerpt).join(" ") : "", before.answered ? before.citations.map(c => c.document.id) : []), afterPassed: check(after.answered, after.sections.map(s => s.summary).join(" "), after.evidence.map(e => e.documentId)), afterOutcome: after.outcome };
});
await mkdir("test-results", { recursive: true });
const report = { cases: results.length, baselinePassed: results.filter(r => r.beforePassed).length, revisedPassed: results.filter(r => r.afterPassed).length, method: "Expected support status, required answer phrases, and source identity; not an independent general-accuracy estimate.", results };
await writeFile("test-results/assistant-evaluation.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, results: results.filter(r => !r.afterPassed) }, null, 2));
}
void main();
