import { spawn } from "node:child_process";
import path from "node:path";
const next = path.resolve("node_modules/next/dist/bin/next");
function run(args, env = process.env) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [next, ...args], { env, stdio: "inherit", windowsHide: true });
    child.on("exit", code => resolve(code ?? 1));
  });
}
if (await run(["build"]) !== 0) process.exit(1);
const model = process.env.ASSISTANT_OLLAMA_MODEL || "qwen3.6:35b-a3b";
console.log(`Warming the installed local model ${model}. No model will be downloaded.`);
let ready = false;
try {
  const response = await fetch("http://127.0.0.1:11434/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt: "", stream: false, keep_alive: "5m", options: { num_ctx: 8192 } }), signal: AbortSignal.timeout(120000) });
  ready = response.ok;
} catch { /* The source guide remains available without Ollama. */ }
const env = { ...process.env };
if (ready) env.ASSISTANT_OLLAMA_MODEL = model; else delete env.ASSISTANT_OLLAMA_MODEL;
console.log(ready ? "Local AI ready. Open http://127.0.0.1:3102/assistant" : "AI unavailable. Starting the source guide at http://127.0.0.1:3102/assistant");
process.exitCode = await run(["start", "--hostname", "127.0.0.1", "--port", "3102"], env);
