import { writeFile, mkdir } from "node:fs/promises";
import cases from "../tests/assistant-challenge.json";
import {
  answerFromTopics,
  type AssistantAnswer,
} from "../src/lib/assistant/answer";
import { localSetup, Client } from "./readiness-client";
async function main() {
  await mkdir("test-results", { recursive: true });
  const live = process.argv.includes("--live");
  const setup = live ? await localSetup() : null;
  let client: Client | undefined;
  try {
    if (setup) {
      client = new Client();
      const a = setup.accounts.find((a) => a.role === "user")!;
      await client.login(a.email, a.password);
    }
    const rows = [];
    for (const c of cases.cases) {
      const started = Date.now();
      const result: AssistantAnswer = client
        ? (await client.request("/api/ask", "POST", { question: c.question }))
            .data
        : answerFromTopics(c.question);
      const ids = result.evidence.map((e) => e.id);
      const wanted = "evidence" in c ? (c.evidence ?? []) : [];
      const passed =
        c.expect === "withhold"
          ? !result.answered
          : (c.expect === "answer" ? result.answered : true) &&
            wanted.every((id) => ids.includes(id));
      const row = {
        id: c.id,
        question: c.question,
        expected: c.expect,
        passed,
        outcome: result.outcome,
        method: result.method,
        evidenceIds: ids,
        elapsedMs: Date.now() - started,
      };
      rows.push(row);
      console.log(JSON.stringify(row));
    }
    const label =
      process.argv.find((a) => a.startsWith("--label="))?.slice(8) ||
      (live ? "live" : "current");
    await writeFile(
      `test-results/challenge-${label}.json`,
      JSON.stringify(
        {
          passed: rows.filter((r) => r.passed).length,
          total: rows.length,
          live,
          results: rows,
        },
        null,
        2,
      ),
    );
    if (rows.some((r) => !r.passed)) process.exitCode = 1;
  } finally {
    await setup?.pool.end();
  }
}
void main();
